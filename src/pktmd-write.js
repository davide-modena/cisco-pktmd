// Modello "semplificato" -> testo .pktmd
import { shortPort, inferType } from "./model.js";
import { MODELS, DEFAULT_MODEL, MODULE_ALIASES } from "./catalog.js";

/** nome breve del modulo se esiste (HWIC-2T -> serial) */
const moduleAlias = (name) => Object.entries(MODULE_ALIASES).find(([k, v]) => v === name && k !== name.toLowerCase())?.[0] ?? name;
import { resolveLinks } from "./links.js";

const cidr = (ip, prefix) => `${ip}/${prefix}`;
const clone = (o) => JSON.parse(JSON.stringify(o));

// ---------------------------------------------------------------------------------------------------------------
// opzioni dei link (vlan / trunk / clock) al posto delle righe di porta

const PORT_KEYS_LINKABLE = new Set(["name", "mode", "access", "allowed", "native", "line"]);

function portOption(p) {
  if (!p) return { kind: "none" };
  const extra = Object.keys(p).filter((k) => !PORT_KEYS_LINKABLE.has(k));
  if (extra.length) return { kind: "other" };
  if (p.mode === "trunk") return p.access !== undefined ? { kind: "other" } : { kind: "trunk", allowed: p.allowed, native: p.native };
  if (p.access !== undefined && (p.mode === undefined || p.mode === "access")) return { kind: "access", vlan: p.access };
  if (!p.access && !p.mode && !p.allowed && p.native === undefined) return { kind: "none" };
  return { kind: "other" };
}

const sameOpt = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** sposta access/trunk dalle porte ai collegamenti quando e' espressibile; ritorna una copia */
function liftLinkOptions(net) {
  const devs = new Map(net.devices.map((d) => [d.id, clone(d)]));
  const links = net.links.map((l) => ({ ...clone(l) }));
  for (const l of links) {
    const sw = [l.a, l.b].filter((e) => devs.get(e.dev)?.type === "switch" && e.port);
    if (!sw.length) continue;
    const opts = sw.map((e) => portOption(devs.get(e.dev).ports.find((p) => p.name === e.port)));
    if (opts.some((o) => o.kind === "none" || o.kind === "other")) continue;
    if (!opts.every((o) => sameOpt(o, opts[0]))) continue;
    const o = opts[0];
    l.opts = { ...(l.opts ?? {}), ...(o.kind === "trunk" ? { trunk: { ...(o.allowed ? { allowed: o.allowed } : {}), ...(o.native !== undefined ? { native: o.native } : {}) } } : { vlan: o.vlan }) };
    for (const e of sw) {
      const d = devs.get(e.dev);
      const p = d.ports.find((x) => x.name === e.port);
      for (const k of ["mode", "access", "allowed", "native"]) delete p[k];
      if (Object.keys(p).filter((k) => k !== "name" && k !== "line").length === 0) d.ports.splice(d.ports.indexOf(p), 1);
    }
  }
  return { devs: [...devs.values()], links };
}

// ---------------------------------------------------------------------------------------------------------------
// righe di porta

function portTokens(p) {
  const t = [];
  if (p.ip) t.push(cidr(p.ip, p.prefix));
  else if (p.dhcp) t.push("dhcp");
  else if (p.unnumbered) t.push("unnumbered", shortPort(p.unnumbered));
  if (p.vlan !== undefined) t.push("vlan", p.vlan);
  if (p.mode === "trunk") {
    if (p.access !== undefined) t.push("access", p.access);
    t.push("trunk"); if (p.allowed) t.push(p.allowed); if (p.native !== undefined) t.push("native", p.native);
  } else if (p.access !== undefined) t.push("access", p.access);
  else if (p.mode === "access") t.push("access");
  for (const h of p.helper ?? []) t.push("helper", h);
  if (p.acl?.in) t.push("acl", p.acl.in, "in");
  if (p.acl?.out) t.push("acl", p.acl.out, "out");
  if (p.nat === "inside" || p.nat === "outside") t.push(p.nat);
  else if (p.nat === "off") t.push("nat", "off");
  if (p.clock !== undefined) t.push("clock", p.clock);
  if (p.admin) t.push(p.admin);
  if (p.desc) t.push("desc", p.desc);
  return t.join(" ");
}

/** raggruppa porte consecutive con le stesse opzioni: fa0/5-24 */
function portLines(ports) {
  const items = ports.map((p) => ({ name: p.name, toks: portTokens(p) }));
  const out = [];
  for (let i = 0; i < items.length;) {
    let j = i;
    const m = /^(.*?)(\d+)$/.exec(items[i].name);
    while (m && j + 1 < items.length) {
      const n = /^(.*?)(\d+)$/.exec(items[j + 1].name);
      const cur = /^(.*?)(\d+)$/.exec(items[j].name);
      if (!n || n[1] !== m[1] || +n[2] !== +cur[2] + 1 || items[j + 1].toks !== items[i].toks) break;
      j++;
    }
    const first = shortPort(items[i].name);
    const label = j > i ? `${first}-${/(\d+)$/.exec(items[j].name)[1]}` : first;
    out.push(`  ${label}${items[i].toks ? " " + items[i].toks : ""}`);
    i = j + 1;
  }
  return out;
}

const netList = (nets) => nets.map((n) => cidr(n.net, n.prefix)).join(" ");

function addrText(a) {
  return a.any ? "any" : a.host ? `host ${a.host}` : cidr(a.net, a.prefix);
}
function portSpecText(p) {
  return p ? ` ${p.op} ${p.a}${p.b ? " " + p.b : ""}` : "";
}

// ---------------------------------------------------------------------------------------------------------------
// dispositivo

function deviceLines(d, opts) {
  const L = [];
  const host = d.type === "pc" || d.type === "server";
  const spec = MODELS[d.model ?? DEFAULT_MODEL[d.type]];
  const tokens = [];
  if (d.model && spec.token) tokens.push(spec.token);
  if (d.nic) tokens.push(d.nic === "fa" ? "fa" + (d.nicSlot ?? "") : d.nic + (d.nicSlot ?? ""));
  const auto = inferType(d.id) === d.type && !tokens.length;
  L.push(auto ? `${d.id}:` : `${d.id}: ${d.type}${tokens.length ? " " + tokens.join(" ") : ""}`);

  if (d.hostname) L.push(`  name ${d.hostname}`);
  if (opts.pos && d.pos) L.push(`  pos ${Math.round(d.pos.x)} ${Math.round(d.pos.y)}`);
  for (const m of d.modules ?? []) L.push(`  module ${m.name === "none" ? "slot " + m.slot + " none" : moduleAlias(m.name)}${m.slot !== undefined && m.name !== "none" ? " slot " + m.slot : ""}`);

  // indirizzi principali: `ip`
  const rest = [];
  for (const p of d.ports) {
    const isPrimary = host ? p.name === null : false;
    const isSvi = /^Vlan\d+$/.test(p.name ?? "");
    const svi = isSvi && !p.vlan && Object.keys(p).filter((k) => !["name", "ip", "prefix", "dhcp", "line"].includes(k)).length === 0;
    if (isPrimary || svi) {
      const vl = svi && p.name !== "Vlan1" ? ` vlan ${p.name.slice(4)}` : "";
      L.push(p.dhcp ? "  ip dhcp" : `  ip ${cidr(p.ip, p.prefix)}${vl}`);
    } else if (!host) rest.push(p);
  }
  if (d.gw) L.push(`  gw ${d.gw}`);
  if (d.dns?.length) L.push(`  dns ${d.dns.join(" ")}`);
  if (d.domain) L.push(`  domain ${d.domain}`);
  if (d.mail) {
    const m = d.mail;
    L.push(`  mail ${m.address} ${m.pass}${m.pop3 ? " pop3 " + m.pop3 : ""}${m.smtp ? " smtp " + m.smtp : ""}${m.user ? " user " + m.user : ""}${m.name ? " name " + m.name : ""}`);
  }

  for (const v of d.vlans ?? []) L.push(`  vlan ${v.id}${v.name ? " " + v.name : ""}`);
  L.push(...portLines(rest));

  for (const r of d.routes ?? []) L.push(`  route ${r.prefix === 0 && r.net === "0.0.0.0" ? "default" : cidr(r.net, r.prefix)} via ${r.via ?? shortPort(r.port)}${r.ad ? " ad " + r.ad : ""}`);
  if (d.rip) {
    const t = ["rip"];
    if (d.rip.v === 1) t.push("v1");
    if (d.rip.autosum) t.push("autosum");
    if (d.rip.networks?.length) t.push(...d.rip.networks);
    else if (d.rip.networks) t.push("none");
    if (d.rip.default) t.push("default");
    if (d.rip.static) t.push("static");
    L.push("  " + t.join(" "));
    if (d.rip.passive?.length) L.push(`  rip passive ${d.rip.passive.map(shortPort).join(" ")}`);
  }
  if (d.ospf) {
    L.push(d.ospf.pid !== 1 ? `  ospf id ${d.ospf.pid}` : "  ospf");
    for (const n of d.ospf.networks) L.push(`  ospf ${cidr(n.net, n.prefix)} area ${n.area}`);
    if (d.ospf.passive?.length) L.push(`  ospf passive ${d.ospf.passive.map(shortPort).join(" ")}`);
    if (d.ospf.default) L.push("  ospf default");
  }
  for (const r of d.nat ?? []) {
    const src = r.nets ? netList(r.nets) : `acl ${r.acl}`;
    if (r.kind === "overload") L.push(`  nat overload ${src}${r.via ? " via " + shortPort(r.via) : ""}`);
    else if (r.kind === "pool") L.push(`  nat pool ${r.start}-${r.end} /${r.prefix} for ${src}${r.overload ? " overload" : ""}${r.name ? " name " + r.name : ""}`);
    else if (r.kind === "static") L.push(r.proto ? `  nat static ${r.proto} ${r.local}:${r.lport} ${r.global}:${r.gport}` : `  nat static ${r.local} ${r.global}`);
  }
  for (const x of d.dhcpExcluded ?? []) L.push(`  dhcp exclude ${x.from}${x.to ? "-" + x.to : ""}`);
  for (const p of d.dhcpPools ?? []) {
    L.push(`  dhcp ${cidr(p.net, p.prefix)}${p.gw ? " gw " + p.gw : ""}${p.dns?.length ? " dns " + p.dns.join(" ") : ""}${p.domain ? " domain " + p.domain : ""}${p.from ? " from " + p.from : ""}${p.max ? " max " + p.max : ""}${p.name ? " name " + p.name : ""}`);
  }
  for (const a of d.acls ?? []) {
    for (const r of a.rules) {
      L.push(`  acl ${a.id} ${r.action}${r.proto ? " " + r.proto : ""} ${addrText(r.src)}${portSpecText(r.sp)}${r.dst ? " " + addrText(r.dst) + portSpecText(r.dp) : ""}${r.est ? " established" : ""}${r.log ? " log" : ""}`);
    }
  }
  const s = d.sec ?? {};
  if (s.enableSecret) L.push(`  enable secret ${s.enableSecret}`);
  if (s.enablePassword) L.push(`  enable password ${s.enablePassword}`);
  for (const u of s.users ?? []) L.push(`  user ${u.name} ${u.pass}${u.priv ? " priv " + u.priv : ""}`);
  for (const [key, o] of [["vty", s.vty], ["console", s.console]]) {
    if (!o) continue;
    const t = [key];
    if (o.password) t.push("password", o.password);
    if (o.login === "local") t.push("login", "local");
    else if (o.login === "plain" && !o.password) t.push("login");
    if (o.transport) t.push("transport", o.transport);
    L.push("  " + t.join(" "));
  }
  if (s.ssh) L.push(`  ssh ${s.ssh}`);

  // servizi del server
  for (const [k, v] of Object.entries(d.services ?? {})) {
    if (k === "mail") L.push(`  mail ${v ? "on" : "off"}`);
    else L.push(`  ${k} ${v ? "on" : "off"}`);
  }
  if (d.mailDomain) L.push(`  mail ${d.mailDomain}`);
  for (const u of d.mailUsers ?? []) L.push(`  user ${u.name} ${u.pass}`);
  for (const r of d.dnsRecords ?? []) L.push(`  ${r.type} ${r.name} ${r.value}`);

  for (const f of d.files ?? []) L.push("", `  \`\`\`html ${f.name}`, ...f.content.split("\n").map((l) => (l ? "  " + l : l)), "  ```");
  if (d.cli) L.push("", "  ```cli", ...d.cli.split("\n").map((l) => (l ? "  " + l : l)), "  ```");
  return L;
}

// ---------------------------------------------------------------------------------------------------------------
// collegamenti

const optText = (o) => {
  if (!o) return "";
  const t = [];
  if (o.vlan !== undefined) t.push("vlan", o.vlan);
  if (o.trunk) { t.push("trunk"); if (o.trunk.allowed) t.push(o.trunk.allowed); if (o.trunk.native !== undefined) t.push("native", o.trunk.native); }
  if (o.clock !== undefined) t.push("clock", o.clock);
  return t.length ? " " + t.join(" ") : "";
};

/** sceglie, per ogni estremo, se la porta si puo' omettere (la assegnazione automatica la ritrova identica) */
function shortenLinks(devs, links, portsOf) {
  const devOf = (id) => devs.find((d) => d.id === id);
  const full = links.map((l) => ({ ...l, a: { ...l.a }, b: { ...l.b } }));
  const hidden = full.map(() => ({ a: true, b: true }));
  for (let guard = 0; guard < 4000; guard++) {
    const probe = full.map((l, i) => ({ ...l, a: { dev: l.a.dev, port: hidden[i].a ? undefined : l.a.port }, b: { dev: l.b.dev, port: hidden[i].b ? undefined : l.b.port } }));
    let resolved;
    try { resolved = resolveLinks({ links: probe }, portsOf, devOf); } catch { resolved = null; }
    let bad = null;
    if (resolved) {
      outer: for (let i = 0; i < full.length; i++) for (const side of ["a", "b"]) {
        if (hidden[i][side] && resolved[i][side].port !== full[i][side].port) { bad = [i, side]; break outer; }
      }
    } else {
      // non risolvibile: scopri il primo estremo nascosto e rendilo esplicito
      outer2: for (let i = 0; i < full.length; i++) for (const side of ["a", "b"]) if (hidden[i][side]) { bad = [i, side]; break outer2; }
    }
    if (!bad) break;
    hidden[bad[0]][bad[1]] = false;
  }
  return hidden;
}

/**
 * @param {import("./model.js").Network} net   modello SEMPLIFICATO
 * @param {{portsOf:(dev)=>string[], pos?:boolean}} opts
 */
export function stringifyPktmd(net, opts) {
  const { devs, links } = liftLinkOptions(net);
  const out = [];
  for (const d of devs) { out.push(...deviceLines(d, opts), ""); }
  out.push("links:");
  const hidden = shortenLinks(devs, links, opts.portsOf);
  links.forEach((l, i) => {
    const a = hidden[i].a ? l.a.dev : `${l.a.dev}.${shortPort(l.a.port)}`;
    const b = hidden[i].b ? l.b.dev : `${l.b.dev}.${shortPort(l.b.port)}`;
    out.push(`  ${a} ${b}${optText(l.opts)}`);
  });
  return out.join("\n") + "\n";
}
