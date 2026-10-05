// Parser del formato .pktmd (vedi docs/SINTASSI.md).
//
//   parsePktmd(text) -> { network, warnings }
//
// Il modello prodotto e' quello "scritto dall'utente": contiene solo cio' che e' nel testo.
// Il non detto (lati NAT, reti RIP, stato delle porte...) lo riempie compile() in implied.js.
import {
  PktmdError, TYPES, typeFromAlias, inferType, normalizePort, looksLikePort,
  isIPv4, maskToPrefix, classfulPrefix, parseCidr,
} from "./model.js";
import { modelFromToken, tokensFor, DEFAULT_MODEL, NICS } from "./catalog.js";

export { stringifyPktmd } from "./pktmd-write.js";

const ID_RE = /^[A-Za-z0-9_-]+$/;
const HEADER_RE = /^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/;

/** parole che aprono una riga di proprieta' (servono a dare un messaggio utile se qualcuno scrive "ip: ...") */
export const KEYWORDS = [
  "name", "pos", "ip", "gw", "dns", "domain", "vlan", "route", "rip", "ospf", "nat", "dhcp", "acl", "enable", "user", "vty",
  "console", "ssh", "module", "mail", "a", "cname", "ns", "http", "https", "ntp", "ftp", "tftp", "syslog",
];

const SERVICES = ["http", "https", "ntp", "ftp", "tftp", "syslog"];
const ON = ["on", "true", "yes", "si", "1"];
const OFF = ["off", "false", "no", "0"];

function dedent(lines) {
  const ind = Math.min(...lines.filter((l) => l.trim()).map((l) => /^\s*/.exec(l)[0].length), Infinity);
  return lines.map((l) => (Number.isFinite(ind) ? l.slice(Math.min(ind, /^\s*/.exec(l)[0].length)) : l));
}

// ---------------------------------------------------------------------------------------------------------------
// pezzi di sintassi

function ipToken(tok, nextTok, ln) {
  const [ip, p] = tok.split("/");
  if (!isIPv4(ip)) return null;
  let prefix, used = 1;
  if (p !== undefined) {
    prefix = /^\d+$/.test(p) ? +p : NaN;
    if (!(prefix >= 0 && prefix <= 32)) throw new PktmdError(`prefisso non valido: "/${p}"`, ln);
  } else if (nextTok !== undefined && isIPv4(nextTok) && maskToPrefix(nextTok) !== undefined && maskToPrefix(nextTok) > 0) {
    prefix = maskToPrefix(nextTok); used = 2;
  } else prefix = classfulPrefix(ip);
  return { ip, prefix, used };
}

const intTok = (t, what, ln) => {
  if (!/^\d+$/.test(t ?? "")) throw new PktmdError(`${what}: serve un numero (trovato "${t ?? ""}")`, ln);
  return +t;
};
const needIp = (t, what, ln) => {
  if (!isIPv4(t ?? "")) throw new PktmdError(`${what}: indirizzo IP non valido "${t ?? ""}"`, ln);
  return t;
};
const cidr = (t, ln) => {
  const c = parseCidr(t ?? "");
  if (!c || !String(t).includes("/")) throw new PktmdError(`rete non valida "${t ?? ""}" (si scrive come 192.168.1.0/24)`, ln);
  return c;
};

/** `fa0/1`, `fa0/1-12`, `fa0/1,gi0/1-2` -> nomi completi */
export function expandPorts(spec, ln) {
  const out = [];
  for (const item of spec.split(",")) {
    const m = /^(.*?)(\d+)-(\d+)$/.exec(item);
    if (m && normalizePort(m[1] + m[2])) {
      const first = normalizePort(m[1] + m[2]);
      const a = +m[2], b = +m[3];
      if (b < a) throw new PktmdError(`intervallo non valido "${item}"`, ln);
      for (let i = a; i <= b; i++) out.push(first.replace(/(\d+)$/, String(i)));
    } else {
      const n = normalizePort(item);
      if (!n) throw new PktmdError(`porta non valida "${item}"`, ln);
      out.push(n);
    }
  }
  return out;
}

/** opzioni di una riga di porta (dopo il nome) */
function parsePortOptions(toks, ln) {
  const a = {};
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i], tl = t.toLowerCase();
    const ip = ipToken(t, toks[i + 1], ln);
    if (ip) { a.ip = ip.ip; a.prefix = ip.prefix; i += ip.used - 1; continue; }
    switch (tl) {
      case "dhcp": a.dhcp = true; break;
      case "unnumbered": { const p = normalizePort(toks[++i] ?? ""); if (!p) throw new PktmdError("unnumbered: manca la porta", ln); a.unnumbered = p; break; }
      case "access": a.mode = "access"; if (/^\d+$/.test(toks[i + 1] ?? "")) a.access = +toks[++i]; break;
      case "trunk": {
        a.mode = "trunk";
        if (/^[\d,\-]+$/.test(toks[i + 1] ?? "")) a.allowed = toks[++i];
        if ((toks[i + 1] ?? "").toLowerCase() === "native") { i++; a.native = intTok(toks[++i], "native", ln); }
        break;
      }
      case "native": a.native = intTok(toks[++i], "native", ln); break;
      case "vlan": a.vlan = intTok(toks[++i], "vlan", ln); break;
      case "down": a.admin = "down"; break;
      case "up": a.admin = "up"; break;
      case "inside": case "outside": a.nat = tl; break;
      case "nat": {
        const v = (toks[++i] ?? "").toLowerCase();
        if (!["inside", "outside", "off"].includes(v)) throw new PktmdError("nat: scrivi inside, outside oppure off", ln);
        a.nat = v;
        break;
      }
      case "helper": (a.helper ??= []).push(needIp(toks[++i], "helper", ln)); break;
      case "acl": {
        const name = toks[++i], dir = (toks[++i] ?? "").toLowerCase();
        if (!name || !["in", "out"].includes(dir)) throw new PktmdError("acl: scrivi \"acl NOME in\" oppure \"acl NOME out\"", ln);
        (a.acl ??= {})[dir] = name;
        break;
      }
      case "clock": { if (/^\d+$/.test(toks[i + 1] ?? "")) a.clock = +toks[++i]; else a.clock = 2000000; break; }
      case "desc": case "description": a.desc = toks.slice(i + 1).join(" "); i = toks.length; break;
      default:
        throw new PktmdError(`opzione di porta sconosciuta "${t}" (valide: IP/n, dhcp, access N, trunk [lista] [native N], vlan N, down, up, inside, outside, helper IP, acl NOME in|out, clock, desc testo)`, ln);
    }
  }
  return a;
}

function parseNets(toks, from, stop, ln) {
  const nets = [];
  let i = from;
  for (; i < toks.length && !stop.includes(toks[i].toLowerCase()); i++) nets.push(cidr(toks[i], ln));
  return [nets, i];
}

function parseAddrTok(toks, i, ln) {
  const t = toks[i];
  if (t === "any") return [{ any: true }, i + 1];
  if (t === "host") return [{ host: needIp(toks[i + 1], "host", ln) }, i + 2];
  if (t && t.includes("/")) { const c = cidr(t, ln); return [c.prefix === 32 ? { host: c.net } : { net: c.net, prefix: c.prefix }, i + 1]; }
  if (isIPv4(t ?? "")) return [{ host: t }, i + 1];
  throw new PktmdError(`indirizzo non valido "${t ?? ""}" (usa any, host A, oppure rete/n)`, ln);
}

const ACL_PROTOS = new Set(["ip", "tcp", "udp", "icmp", "eigrp", "ospf", "gre", "esp", "ahp"]);

function parseAclLine(toks, ln) {
  // acl NOME permit|deny [proto] sorgente [porta] [destinazione [porta]] [established] [log]
  const id = toks[1], action = (toks[2] ?? "").toLowerCase();
  if (!id) throw new PktmdError("acl: manca il nome", ln);
  if (!["permit", "deny"].includes(action)) throw new PktmdError("acl: dopo il nome scrivi permit o deny", ln);
  let i = 3;
  const rule = { action };
  const extended = ACL_PROTOS.has((toks[i] ?? "").toLowerCase());
  if (extended) rule.proto = toks[i++].toLowerCase();
  [rule.src, i] = parseAddrTok(toks, i, ln);
  const portSpec = () => {
    const op = (toks[i] ?? "").toLowerCase();
    if (["eq", "gt", "lt", "neq"].includes(op)) { const p = { op, a: toks[i + 1] }; i += 2; return p; }
    if (op === "range") { const p = { op, a: toks[i + 1], b: toks[i + 2] }; i += 3; return p; }
    return undefined;
  };
  if (extended) {
    const sp = portSpec(); if (sp) rule.sp = sp;
    [rule.dst, i] = parseAddrTok(toks, i, ln);
    const dp = portSpec(); if (dp) rule.dp = dp;
  }
  for (; i < toks.length; i++) {
    const f = toks[i].toLowerCase();
    if (f === "log") rule.log = true;
    else if (f === "established" && extended) rule.est = true;
    else throw new PktmdError(`acl: "${toks[i]}" non e' valido qui`, ln);
  }
  return { id, rule, extended };
}

// ---------------------------------------------------------------------------------------------------------------
// PARSER

/**
 * @param {string} text
 * @returns {{network: import("./model.js").Network, warnings: string[]}}
 */
export function parsePktmd(text) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const devices = [];
  const links = [];
  const warnings = [];
  const byId = new Map();
  let cur = null;
  let inLinks = false;

  for (let i = 0; i < lines.length; i++) {
    const ln = i + 1;
    const t0 = lines[i].trim();
    if (!t0 || t0.startsWith("//")) continue;
    const t = t0.startsWith("```") ? t0 : t0.replace(/\s+\/\/.*$/, "");

    // ---- blocco di codice
    if (t0.startsWith("```")) {
      const info = t0.slice(3).trim().split(/\s+/).filter(Boolean);
      const body = [];
      let j = i + 1;
      while (j < lines.length && lines[j].trim() !== "```") {
        if (/^```\S/.test(lines[j].trim())) {
          throw new PktmdError(`il blocco aperto qui non e' chiuso: manca \`\`\` prima della riga ${j + 1} (nuovo blocco "${lines[j].trim()}")`, ln);
        }
        body.push(lines[j++]);
      }
      if (j >= lines.length) throw new PktmdError("blocco ``` non chiuso (manca la riga ``` finale)", ln);
      i = j;
      if (!cur) throw new PktmdError("blocco di codice fuori da un dispositivo", ln);
      const content = dedent(body).join("\n");
      const kind = (info[0] || "").toLowerCase();
      if (kind === "cli" || kind === "ios") {
        if (cur.type === "pc" || cur.type === "server") throw new PktmdError(`${cur.id}: il blocco cli vale solo per router e switch`, ln);
        cur.cli = cur.cli ? cur.cli + "\n" + content : content;
      } else {
        const name = info[1] ?? (info[0]?.includes(".") ? info[0] : undefined);
        if (!name) throw new PktmdError("blocco senza nome: usa ```cli oppure ```html nomefile.html", ln);
        if (cur.type !== "server") throw new PktmdError(`i file HTTP sono supportati solo sui server (${cur.id} e' un ${cur.type})`, ln);
        cur.files = cur.files.filter((f) => f.name !== name);
        cur.files.push({ name, content });
      }
      continue;
    }

    // ---- collegamenti
    if (t === "---" || /^links\s*:$/i.test(t)) { inLinks = true; cur = null; continue; }
    if (inLinks) { links.push(parseLink(t, ln)); continue; }

    // ---- intestazione di dispositivo
    const h = HEADER_RE.exec(t);
    if (h) {
      const [, id, rest] = h;
      if (KEYWORDS.includes(id.toLowerCase()) && rest.trim() && !typeFromAlias(rest.trim().split(/\s+/)[0])) {
        throw new PktmdError(`"${id}" e' una proprieta': si scrive senza i due punti (es. "${id} ${rest.trim()}")`, ln);
      }
      if (!ID_RE.test(id)) throw new PktmdError(`nome non valido: "${id}" (ammessi lettere, cifre, _ e -)`, ln);
      if (byId.has(id)) throw new PktmdError(`dispositivo "${id}" definito due volte (riga ${byId.get(id).line})`, ln);
      cur = newDevice(id, rest.trim(), ln);
      devices.push(cur);
      byId.set(id, cur);
      continue;
    }

    // ---- proprieta'
    if (!cur) throw new PktmdError(`riga fuori da un dispositivo: "${t}"`, ln);
    parseProperty(cur, t.split(/\s+/), ln);
  }

  for (const l of links) {
    for (const e of [l.a, l.b]) if (!byId.has(e.dev)) throw new PktmdError(`collegamento verso "${e.dev}": dispositivo inesistente`, l.line);
    if (l.a.dev === l.b.dev) throw new PktmdError(`"${l.a.dev}" collegato a se stesso`, l.line);
  }
  for (const d of devices) finishDevice(d);
  return { network: { devices, links }, warnings };
}

function newDevice(id, rest, ln) {
  let type, model, nic, nicSlot;
  if (rest) {
    const toks = rest.split(/\s+/);
    type = typeFromAlias(toks[0]);
    if (!type) {
      const hint = KEYWORDS.includes(toks[0].toLowerCase()) || looksLikePort(toks[0])
        ? `: dopo i due punti va solo il tipo, scrivi "${toks.join(" ")}" sulla riga sotto`
        : ` (tipi: ${TYPES.join(", ")})`;
      throw new PktmdError(`tipo sconosciuto "${toks[0]}"${hint}`, ln);
    }
    for (const tok of toks.slice(1)) {
      const lower = tok.toLowerCase();
      const nm = /^(fa|gig|fiber)(\d)?$/.exec(lower);
      if ((type === "pc" || type === "server") && nm) { nic = nm[1]; if (nm[2]) nicSlot = +nm[2]; continue; }
      const m = modelFromToken(type, tok);
      if (!m) throw new PktmdError(`modello sconosciuto "${tok}" per ${type} (validi: ${[...tokensFor(type), ...(type === "pc" || type === "server" ? Object.keys(NICS) : [])].join(", ") || "nessuno"})`, ln);
      model = m.key;
    }
  } else {
    type = inferType(id);
    if (!type) throw new PktmdError(`non riconosco il tipo di "${id}": scrivi "${id}: router" (o pc, switch, server), oppure usa un nome come pc1, r1, sw1, srv1`, ln);
  }
  if (type === "laptop") throw new PktmdError("il laptop non e' ancora supportato (non ho un template: mandami un .pkt che ne contenga uno)", ln);
  const d = {
    id, type, ports: [], files: [], dns: [], routes: [], nat: [], acls: [], dhcpPools: [], dhcpExcluded: [], vlans: [], modules: [], line: ln,
  };
  if (model && model !== DEFAULT_MODEL[type]) d.model = model;
  if (nic && !(nic === "fa" && !nicSlot)) { d.nic = nic; if (nicSlot) d.nicSlot = nicSlot; }
  return d;
}

function finishDevice(d) {
  // con una password, `login` e' implicito
  if (d.sec?.vty?.password && !d.sec.vty.login) d.sec.vty.login = "plain";
  if (d.sec?.console?.password && !d.sec.console.login) d.sec.console.login = "plain";
}

// ---------------------------------------------------------------------------------------------------------------
// collegamenti

const LINK_SEPARATORS = new Set(["-", "--", "->", "<->", "=", "=="]);

function parseLink(t, ln) {
  const toks = t.split(/\s+/).filter((x) => !LINK_SEPARATORS.has(x));
  if (toks.length < 2) throw new PktmdError(`collegamento non valido: "${t}" (servono due estremi, es. "pc1 sw1")`, ln);
  const ends = toks.slice(0, 2).map((tok) => {
    const k = tok.indexOf(".");
    const dev = k < 0 ? tok : tok.slice(0, k);
    let port;
    if (k >= 0) {
      port = normalizePort(tok.slice(k + 1));
      if (!port) throw new PktmdError(`porta non valida: "${tok.slice(k + 1)}"`, ln);
    }
    return { dev, port };
  });
  const link = { a: ends[0], b: ends[1], line: ln };
  const opts = {};
  const rest = toks.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const w = rest[i].toLowerCase();
    if (w === "vlan") opts.vlan = intTok(rest[++i], "vlan", ln);
    else if (w === "trunk") {
      const tr = {};
      if (/^[\d,\-]+$/.test(rest[i + 1] ?? "")) tr.allowed = rest[++i];
      if ((rest[i + 1] ?? "").toLowerCase() === "native") { i++; tr.native = intTok(rest[++i], "native", ln); }
      opts.trunk = tr;
    } else if (w === "clock") opts.clock = /^\d+$/.test(rest[i + 1] ?? "") ? +rest[++i] : 2000000;
    else throw new PktmdError(`opzione di collegamento sconosciuta "${rest[i]}" (valide: vlan N, trunk [lista] [native N], clock [rate])`, ln);
  }
  if (opts.vlan !== undefined && opts.trunk) throw new PktmdError("un collegamento non puo' essere insieme \"vlan\" e \"trunk\"", ln);
  if (Object.keys(opts).length) link.opts = opts;
  return link;
}

// ---------------------------------------------------------------------------------------------------------------
// proprieta' di un dispositivo

function parseProperty(d, toks, ln) {
  const key = toks[0].toLowerCase();
  const rest = toks.slice(1);
  const only = (types, what) => { if (!types.includes(d.type)) throw new PktmdError(`${d.id}: "${what}" non vale per un ${d.type}`, ln); };
  const toggle = (v) => (ON.includes(v) ? true : OFF.includes(v) ? false : undefined);

  // ---- porte (router/switch): una riga che comincia col nome di una porta
  if (looksLikeStart(toks[0])) {
    only(["router", "switch"], "le porte");
    const names = expandPorts(toks[0], ln);
    const opts = parsePortOptions(rest, ln);
    for (const name of names) {
      const p = { name, ...opts, line: ln };
      const sub = /\.(\d+)$/.exec(name);
      if (sub && p.vlan === undefined) p.vlan = +sub[1];
      if (p.helper) p.helper = [...p.helper];
      d.ports.push(p);
    }
    return;
  }

  switch (key) {
    case "name":
      only(["router", "switch"], "name");
      if (!rest.length) throw new PktmdError("name: manca l'hostname", ln);
      d.hostname = rest.join(" ");
      return;
    case "pos": {
      const x = parseFloat(rest[0]), y = parseFloat(rest[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) throw new PktmdError("pos vuole due numeri: pos 120 80", ln);
      d.pos = { x, y };
      d.posLine = ln;
      return;
    }
    case "ip": {
      if ((rest[0] ?? "").toLowerCase() === "dhcp") { d.ports.push({ name: ipName(d, undefined), dhcp: true, line: ln }); return; }
      const ip = ipToken(rest[0] ?? "", rest[1], ln);
      if (!ip) throw new PktmdError(`ip: indirizzo non valido "${rest[0] ?? ""}" (esempio: ip 192.168.1.1/24)`, ln);
      const tail = rest.slice(ip.used);
      let vlan;
      if ((tail[0] ?? "").toLowerCase() === "vlan") {
        vlan = intTok(tail[1], "vlan", ln);
        if (tail.length > 2) throw new PktmdError("dopo \"vlan N\" non c'e' altro", ln);
        if (d.type !== "switch" && d.type !== "router") throw new PktmdError("\"ip ... vlan N\" vale per switch e router", ln);
      } else if (tail.length) throw new PktmdError(`ip: "${tail[0]}" non e' valido qui`, ln);
      d.ports.push({ name: ipName(d, vlan), ip: ip.ip, prefix: ip.prefix, line: ln });
      return;
    }
    case "gw":
      d.gw = needIp(rest[0], "gw", ln);
      return;
    case "dns": {
      const v = (rest[0] ?? "").toLowerCase();
      if (d.type === "server" && (ON.includes(v) || OFF.includes(v))) { (d.services ??= {}).dns = toggle(v); return; }
      if (!rest.length) throw new PktmdError("dns: manca l'indirizzo del server DNS", ln);
      d.dns.push(...rest.map((x) => needIp(x, "dns", ln)));
      return;
    }
    case "domain":
      only(["router", "switch"], "domain");
      d.domain = rest[0];
      if (!d.domain) throw new PktmdError("domain: manca il nome", ln);
      return;
    case "vlan": {
      only(["switch"], "vlan");
      const id = intTok(rest[0], "vlan", ln);
      if (id < 1 || id > 4094) throw new PktmdError(`vlan ${id}: fuori intervallo (1-4094)`, ln);
      d.vlans.push({ id, ...(rest.length > 1 ? { name: rest.slice(1).join("_") } : {}), line: ln });
      return;
    }
    case "route": {
      only(["router"], "route");
      const r = { line: ln };
      if ((rest[0] ?? "").toLowerCase() === "default") { r.net = "0.0.0.0"; r.prefix = 0; }
      else { const c = cidr(rest[0], ln); r.net = c.net; r.prefix = c.prefix; }
      if ((rest[1] ?? "").toLowerCase() !== "via") throw new PktmdError("route: manca \"via <indirizzo|porta>\" (es. route 10.0.0.0/8 via 192.168.1.2)", ln);
      const via = rest[2];
      if (isIPv4(via ?? "")) r.via = via;
      else if (normalizePort(via ?? "")) r.port = normalizePort(via);
      else throw new PktmdError(`route: "via ${via ?? ""}" non e' un indirizzo ne' una porta`, ln);
      if ((rest[3] ?? "").toLowerCase() === "ad") r.ad = intTok(rest[4], "ad", ln);
      d.routes.push(r);
      return;
    }
    case "rip": {
      only(["router"], "rip");
      const rip = (d.rip ??= { passive: [] });
      for (let i = 0; i < rest.length; i++) {
        const w = rest[i].toLowerCase();
        if (w === "v1") rip.v = 1;
        else if (w === "v2") rip.v = 2;
        else if (w === "autosum") rip.autosum = true;
        else if (w === "none") rip.networks = [];
        else if (w === "default") rip.default = true;
        else if (w === "static") rip.static = true;
        else if (w === "passive") { for (i++; i < rest.length && normalizePort(rest[i]); i++) rip.passive.push(normalizePort(rest[i])); i--; }
        else if (isIPv4(rest[i])) (rip.networks ??= []).push(rest[i]);
        else throw new PktmdError(`rip: "${rest[i]}" non e' valido (valide: v1, v2, autosum, default, static, passive <porte>, oppure reti come 10.0.0.0)`, ln);
      }
      return;
    }
    case "ospf": {
      only(["router"], "ospf");
      const o = (d.ospf ??= { pid: 1, networks: [], passive: [] });
      const w = (rest[0] ?? "").toLowerCase();
      if (w === "id") o.pid = intTok(rest[1], "ospf id", ln);
      else if (w === "passive") for (const p of rest.slice(1)) { const n = normalizePort(p); if (!n) throw new PktmdError(`porta non valida "${p}"`, ln); o.passive.push(n); }
      else if (w === "default") o.default = true;
      else if (rest.length) {
        const c = cidr(rest[0], ln);
        if ((rest[1] ?? "").toLowerCase() !== "area") throw new PktmdError("ospf: manca \"area N\" (es. ospf 192.168.1.0/24 area 0)", ln);
        o.networks.push({ net: c.net, prefix: c.prefix, area: rest[2] ?? "0" });
      }
      return;
    }
    case "nat":
      only(["router"], "nat");
      d.nat.push(parseNat(rest, ln));
      return;
    case "dhcp": return parseDhcp(d, rest, ln, toggle);
    case "acl": {
      only(["router", "switch"], "acl");
      const { id, rule, extended } = parseAclLine(toks, ln);
      let acl = d.acls.find((a) => a.id === id);
      if (!acl) { acl = { id, numbered: /^\d+$/.test(id), ext: extended, rules: [], line: ln }; d.acls.push(acl); }
      else if (acl.ext !== extended) throw new PktmdError(`acl ${id}: non si possono mescolare regole standard (solo sorgente) ed estese (con protocollo)`, ln);
      acl.rules.push(rule);
      return;
    }
    case "enable": {
      only(["router", "switch"], "enable");
      const kind = (rest[0] ?? "").toLowerCase();
      if (!["secret", "password"].includes(kind) || !rest[1]) throw new PktmdError("enable: scrivi \"enable secret <password>\" oppure \"enable password <password>\"", ln);
      (d.sec ??= {})[kind === "secret" ? "enableSecret" : "enablePassword"] = rest[1];
      return;
    }
    case "user": {
      if (d.type === "server") {
        if (rest.length < 2) throw new PktmdError("user: servono nome e password (utente di posta)", ln);
        (d.mailUsers ??= []).push({ name: rest[0], pass: rest[1] });
        return;
      }
      only(["router", "switch"], "user");
      if (rest.length < 2) throw new PktmdError("user: servono nome e password", ln);
      const u = { name: rest[0], pass: rest[1] };
      if ((rest[2] ?? "").toLowerCase() === "priv") u.priv = intTok(rest[3], "priv", ln);
      ((d.sec ??= {}).users ??= []).push(u);
      return;
    }
    case "vty": case "console": {
      only(["router", "switch"], key);
      const o = {};
      for (let i = 0; i < rest.length; i++) {
        const w = rest[i].toLowerCase();
        if (w === "password") o.password = rest[++i];
        else if (w === "login") { if ((rest[i + 1] ?? "").toLowerCase() === "local") { i++; o.login = "local"; } else o.login = "plain"; }
        else if (w === "local") o.login = "local";
        else if (w === "transport") o.transport = rest[++i];
        else if (w === "ssh") { o.login = "local"; o.transport = "ssh"; }
        else if (w === "telnet") o.transport = "telnet";
        else throw new PktmdError(`${key}: "${rest[i]}" non e' valido (valide: password X, login [local], transport T, ssh, telnet)`, ln);
      }
      const sec = (d.sec ??= {});
      sec[key] = { ...(sec[key] ?? {}), ...o };
      return;
    }
    case "ssh":
      only(["router", "switch"], "ssh");
      (d.sec ??= {}).ssh = rest[0] ? intTok(rest[0], "ssh", ln) : 2;
      return;
    case "module": {
      only(["router", "switch"], "module");
      const m = {};
      for (let i = 0; i < rest.length; i++) {
        if (rest[i].toLowerCase() === "slot") m.slot = intTok(rest[++i], "slot", ln);
        else if (!m.name) m.name = rest[i];
        else throw new PktmdError(`module: "${rest[i]}" non e' valido qui`, ln);
      }
      if (!m.name) throw new PktmdError("module: manca il nome del modulo (es. module serial)", ln);
      d.modules.push(m);
      return;
    }
    case "mail": {
      if (d.type === "server") {
        const v = (rest[0] ?? "").toLowerCase();
        if (ON.includes(v) || OFF.includes(v)) { (d.services ??= {}).mail = ON.includes(v); return; }
        if (!rest[0] || !rest[0].includes(".")) throw new PktmdError("mail: scrivi il dominio del server (es. mail pippo.it) oppure on/off", ln);
        d.mailDomain = rest[0];
        return;
      }
      only(["pc"], "mail");
      if (!/^[^@\s]+@[^@\s]+$/.test(rest[0] ?? "") || !rest[1]) throw new PktmdError("mail: scrivi \"mail utente@dominio.it password [pop3 host] [smtp host]\"", ln);
      const m = { address: rest[0], pass: rest[1] };
      for (let i = 2; i < rest.length; i += 2) {
        const w = rest[i].toLowerCase();
        if (!["pop3", "smtp", "user", "name"].includes(w) || !rest[i + 1]) throw new PktmdError(`mail: "${rest[i]}" non e' valido (valide: pop3 H, smtp H, user U, name N)`, ln);
        m[w] = rest[i + 1];
      }
      d.mail = m;
      return;
    }
    case "a": case "cname": case "ns": {
      only(["server"], key);
      if (rest.length !== 2) throw new PktmdError(`${key}: servono due valori (${key === "a" ? "a www.esempio.it 1.2.3.4" : key === "cname" ? "cname web.esempio.it www.esempio.it" : "ns . dnsroot"})`, ln);
      if (key === "a") needIp(rest[1], "a", ln);
      (d.dnsRecords ??= []).push({ type: key, name: rest[0], value: rest[1] });
      return;
    }
    default:
      if (SERVICES.includes(key)) {
        only(["server"], key);
        const v = (rest[0] ?? "").toLowerCase();
        if (!ON.includes(v) && !OFF.includes(v)) throw new PktmdError(`${key}: scrivi on oppure off`, ln);
        (d.services ??= {})[key] = ON.includes(v);
        return;
      }
      throw new PktmdError(`proprieta' sconosciuta "${toks[0]}" (usa ip, gw, dns, name, vlan, route, rip, nat, dhcp, acl, user, mail, ... oppure il nome di una porta come fa0/0)`, ln);
  }
}

/** la riga comincia con il nome di una porta? (`fa0/1`, `gi0/0.10`, `fa0/1-12`, `se0/0/0`) */
function looksLikeStart(tok) {
  return tok.split(",").every((item) => {
    const m = /^(.*?)(\d+)-(\d+)$/.exec(item);
    return !!normalizePort(m ? m[1] + m[2] : item);
  });
}

/** `ip ...` su uno switch va sulla SVI (Vlan1 o `vlan N`); altrove sulla porta principale (name null) */
function ipName(d, vlan) {
  if (vlan !== undefined) return `Vlan${vlan}`;
  return d.type === "switch" ? "Vlan1" : null;
}

function parseNat(rest, ln) {
  const kind = (rest[0] ?? "").toLowerCase();
  const r = { line: ln };
  if (kind === "overload") {
    r.kind = "overload";
    let i = 1;
    if ((rest[i] ?? "").toLowerCase() === "acl") { r.acl = rest[i + 1]; if (!r.acl) throw new PktmdError("nat overload acl: manca il nome", ln); i += 2; }
    else { [r.nets, i] = parseNets(rest, i, ["via"], ln); if (!r.nets.length) throw new PktmdError("nat overload: manca la rete interna (es. nat overload 192.168.1.0/24)", ln); }
    if ((rest[i] ?? "").toLowerCase() === "via") {
      const p = normalizePort(rest[i + 1] ?? "");
      if (!p) throw new PktmdError("nat overload via: manca la porta di uscita", ln);
      r.via = p; i += 2;
    }
    if (i < rest.length) throw new PktmdError(`nat overload: "${rest[i]}" non e' valido qui`, ln);
    return r;
  }
  if (kind === "pool") {
    r.kind = "pool";
    const range = /^(\d+\.\d+\.\d+\.\d+)-(\d+\.\d+\.\d+\.\d+)$/.exec(rest[1] ?? "");
    if (!range) throw new PktmdError("nat pool: scrivi l'intervallo come 8.8.9.10-8.8.9.20 (es. nat pool 8.8.9.10-8.8.9.20 /24 for 192.168.1.0/24)", ln);
    r.start = range[1]; r.end = range[2];
    const m = rest[2] ?? "";
    r.prefix = m.startsWith("/") ? +m.slice(1) : maskToPrefix(m);
    if (!(r.prefix >= 0 && r.prefix <= 32)) throw new PktmdError("nat pool: manca la maschera (es. /24)", ln);
    if ((rest[3] ?? "").toLowerCase() !== "for") throw new PktmdError("nat pool: manca \"for <reti>\"", ln);
    let i = 4;
    if ((rest[i] ?? "").toLowerCase() === "acl") { r.acl = rest[i + 1]; i += 2; }
    else { [r.nets, i] = parseNets(rest, i, ["overload", "name"], ln); if (!r.nets.length) throw new PktmdError("nat pool: manca la rete interna dopo \"for\"", ln); }
    for (; i < rest.length; i++) {
      const w = rest[i].toLowerCase();
      if (w === "overload") r.overload = true;
      else if (w === "name") r.name = rest[++i];
      else throw new PktmdError(`nat pool: "${rest[i]}" non e' valido qui`, ln);
    }
    return r;
  }
  if (kind === "static") {
    r.kind = "static";
    let i = 1;
    if (["tcp", "udp"].includes((rest[i] ?? "").toLowerCase())) { r.proto = rest[i].toLowerCase(); i++; }
    const split = (tok) => {
      const [ip, port] = (tok ?? "").split(":");
      if (!isIPv4(ip ?? "")) throw new PktmdError(`nat static: indirizzo non valido "${tok ?? ""}"`, ln);
      return [ip, port === undefined ? undefined : +port];
    };
    const [l, lp] = split(rest[i]);
    const [g, gp] = split(rest[i + 1]);
    r.local = l; r.global = g;
    if (r.proto) {
      if (lp === undefined || gp === undefined) throw new PktmdError("nat static tcp/udp: servono le porte (es. nat static tcp 192.168.1.10:80 8.8.8.1:80)", ln);
      r.lport = lp; r.gport = gp;
    }
    return r;
  }
  throw new PktmdError("nat: scrivi \"nat overload ...\", \"nat pool ...\" oppure \"nat static ...\"", ln);
}

function parseDhcp(d, rest, ln, toggle) {
  const first = (rest[0] ?? "").toLowerCase();
  if (d.type === "server" && (ON.includes(first) || OFF.includes(first))) { (d.services ??= {}).dhcp = toggle(first); return; }
  if (first === "exclude") {
    if (d.type !== "router") throw new PktmdError("dhcp exclude vale per i router", ln);
    const m = /^(\d+\.\d+\.\d+\.\d+)(?:-(\d+\.\d+\.\d+\.\d+))?$/.exec(rest[1] ?? "");
    if (!m) throw new PktmdError("dhcp exclude: scrivi un indirizzo o un intervallo (10.0.0.1-10.0.0.10)", ln);
    d.dhcpExcluded.push({ from: m[1], ...(m[2] ? { to: m[2] } : {}) });
    return;
  }
  if (d.type !== "server" && d.type !== "router") throw new PktmdError(`${d.id}: "dhcp" non vale per un ${d.type} (per essere client scrivi "ip dhcp")`, ln);
  const c = cidr(rest[0], ln);
  const p = { net: c.net, prefix: c.prefix, line: ln };
  for (let i = 1; i < rest.length; i++) {
    const w = rest[i].toLowerCase();
    if (w === "gw") p.gw = needIp(rest[++i], "gw", ln);
    else if (w === "dns") { (p.dns ??= []).push(needIp(rest[++i], "dns", ln)); while (isIPv4(rest[i + 1] ?? "")) p.dns.push(rest[++i]); }
    else if (w === "domain") p.domain = rest[++i];
    else if (w === "name") p.name = rest[++i];
    else if (w === "from" && d.type === "server") p.from = needIp(rest[++i], "from", ln);
    else if (w === "max" && d.type === "server") p.max = intTok(rest[++i], "max", ln);
    else throw new PktmdError(`dhcp: "${rest[i]}" non e' valido qui (valide: gw, dns, domain, name${d.type === "server" ? ", from, max" : ""})`, ln);
  }
  d.dhcpPools.push(p);
}
