// IOS running-config  <->  modello semplice del dispositivo.
//
//   liftIos(lines, ctx)  -> { patch, leftover }   riconosce le funzioni note; il resto resta in `leftover` (diventa `cli`)
//   lowerIos(dev, base, ctx) -> lines             genera la config a partire dal modello
//
// Il modello e' lo stesso che produce il parser del .pktmd (vedi model.js e README).

import {
  isIPv4, prefixToMask, maskToPrefix, prefixToWildcard, wildcardToPrefix, inNet, classfulNetwork, networkAddress,
  ipToInt, intToIp, normalizePort, classfulPrefix,
} from "./model.js";

// ---------------------------------------------------------------------------------------------------------------
// Blocchi

export function toBlocks(lines) {
  const blocks = [];
  let cur = null;
  for (const l of lines) {
    const t = l.trim();
    if (!t || t === "!" || t === "end") { cur = null; continue; }
    if (/^\s/.test(l)) { if (cur) cur.body.push(l); }
    else { cur = { head: l.trimEnd(), body: [] }; blocks.push(cur); }
  }
  return blocks;
}

export const blockLines = (b) => [b.head, ...b.body];
export const blocksToCli = (blocks) => blocks.map((b) => blockLines(b).join("\n")).join("\n");

// ---------------------------------------------------------------------------------------------------------------
// ACL

const PORT_OPS = ["eq", "gt", "lt", "neq"];

function parseAddr(t, i) {
  if (t[i] === "any") return [{ any: true }, i + 1];
  if (t[i] === "host" && isIPv4(t[i + 1] ?? "")) return [{ host: t[i + 1] }, i + 2];
  if (isIPv4(t[i] ?? "")) {
    if (isIPv4(t[i + 1] ?? "")) {
      const p = wildcardToPrefix(t[i + 1]);
      if (p === undefined) return [null, i];
      return [p === 32 ? { host: t[i] } : { net: networkAddress(t[i], p), prefix: p }, i + 2];
    }
    return [{ host: t[i] }, i + 1];
  }
  return [null, i];
}

function parsePortSpec(t, i) {
  if (PORT_OPS.includes(t[i]) && t[i + 1]) return [{ op: t[i], a: t[i + 1] }, i + 2];
  if (t[i] === "range" && t[i + 1] && t[i + 2]) return [{ op: "range", a: t[i + 1], b: t[i + 2] }, i + 3];
  return [undefined, i];
}

/** testo di una regola ACL -> struttura; null se non riesco a rappresentarla */
export function parseAclRule(text, extended) {
  const t = text.trim().split(/\s+/);
  const action = t[0];
  if (action !== "permit" && action !== "deny") return null;
  let i = 1;
  const rule = { action };
  if (extended) {
    rule.proto = t[i++];
    if (!rule.proto) return null;
    let a;
    [a, i] = parseAddr(t, i); if (!a) return null; rule.src = a;
    [rule.sp, i] = parsePortSpec(t, i);
    [a, i] = parseAddr(t, i); if (!a) return null; rule.dst = a;
    [rule.dp, i] = parsePortSpec(t, i);
    for (; i < t.length; i++) {
      if (t[i] === "established") rule.est = true;
      else if (t[i] === "log") rule.log = true;
      else return null;
    }
  } else {
    const [a, j] = parseAddr(t, i); if (!a) return null; rule.src = a;
    i = j;
    for (; i < t.length; i++) { if (t[i] === "log") rule.log = true; else return null; }
  }
  return rule;
}

const addrToIos = (a) => (a.any ? "any" : a.host ? `host ${a.host}` : `${a.net} ${prefixToWildcard(a.prefix)}`);
const portSpecToIos = (p) => (p ? ` ${p.op} ${p.a}${p.b ? " " + p.b : ""}` : "");

export function aclRuleToIos(r) {
  if (r.proto === undefined) return `${r.action} ${addrToIos(r.src)}${r.log ? " log" : ""}`;
  return `${r.action} ${r.proto} ${addrToIos(r.src)}${portSpecToIos(r.sp)} ${addrToIos(r.dst)}${portSpecToIos(r.dp)}${r.est ? " established" : ""}${r.log ? " log" : ""}`;
}

const isNumberedStd = (n) => (n >= 1 && n <= 99) || (n >= 1300 && n <= 1999);
const isNumberedExt = (n) => (n >= 100 && n <= 199) || (n >= 2000 && n <= 2699);

// ---------------------------------------------------------------------------------------------------------------
// Parsing di un'interfaccia

const DEFAULT_CLOCK = 2000000;

function liftInterface(b, name, ctx) {
  const p = { name };
  const extras = [];
  for (const raw of b.body) {
    const l = raw.trim();
    let m;
    if ((m = /^ip address (\S+) (\S+)$/.exec(l)) && isIPv4(m[1]) && maskToPrefix(m[2]) !== undefined) { p.ip = m[1]; p.prefix = maskToPrefix(m[2]); }
    else if (l === "ip address dhcp") p.dhcp = true;
    else if (l === "no ip address") { /* default */ }
    else if (l === "shutdown") p.shutdown = true;
    else if (l === "duplex auto" || l === "speed auto") { /* default */ }
    else if ((m = /^description (.+)$/.exec(l))) p.desc = m[1];
    else if (l === "ip nat inside") p.nat = "inside";
    else if (l === "ip nat outside") p.nat = "outside";
    else if ((m = /^ip helper-address (\S+)$/.exec(l)) && isIPv4(m[1])) (p.helper ??= []).push(m[1]);
    else if ((m = /^ip access-group (\S+) (in|out)$/.exec(l))) (p.acl ??= {})[m[2]] = m[1];
    else if ((m = /^encapsulation dot1Q (\d+)$/i.exec(l))) p.vlan = +m[1];
    else if ((m = /^clock rate (\d+)$/.exec(l))) p.clock = +m[1];
    else if ((m = /^ip unnumbered (\S+)$/.exec(l))) p.unnumbered = m[1];
    else if (l === "switchport mode access") p.mode = "access";
    else if (l === "switchport mode trunk") p.mode = "trunk";
    else if ((m = /^switchport access vlan (\d+)$/.exec(l))) p.access = +m[1];
    else if ((m = /^switchport trunk allowed vlan ([\d,\-]+)$/.exec(l))) p.allowed = m[1];
    else if ((m = /^switchport trunk native vlan (\d+)$/.exec(l))) p.native = +m[1];
    else extras.push(raw);
  }
  return { port: p, extras };
}

// ---------------------------------------------------------------------------------------------------------------
// LIFT

const BOILERPLATE = /^(version |no service |service timestamps|license udi|spanning-tree|ip cef$|no ip cef$|no ipv6 cef$|ipv6 cef$|ptp clock|ip classless$|ip flow-export|mls qos|ip http (server|secure))/;

/**
 * @param {string[]} lines     RUNNINGCONFIG
 * @param {{type:'router'|'switch', defaultHost:string}} ctx
 * @returns {{patch: object, leftover: {head:string, body:string[]}[]}}
 */
export function liftIos(lines, ctx) {
  const blocks = toBlocks(lines);
  const patch = {
    ports: [], routes: [], dns: [], acls: [], dhcpPools: [], dhcpExcluded: [], nat: [], sec: {}, rip: undefined, ospf: undefined,
  };
  const leftover = [];
  const natRaw = { pools: [], rules: [] };
  const aclLines = new Map();       // id -> {numbered, rules:[text]}
  const refs = new Map();           // id -> riferimenti
  const addRef = (id) => refs.set(id, (refs.get(id) ?? 0) + 1);
  const portExtras = [];

  for (const b of blocks) {
    const h = b.head;
    let m;
    const keep = () => leftover.push(b);

    if (BOILERPLATE.test(h)) continue;
    if ((m = /^hostname (.+)$/.exec(h))) { if (m[1] !== ctx.defaultHost) patch.hostname = m[1]; continue; }

    if ((m = /^interface (\S+)$/.exec(h))) {
      const { port, extras } = liftInterface(b, m[1], ctx);
      patch.ports.push(port);
      if (extras.length) portExtras.push({ head: h, body: extras });
      continue;
    }

    if ((m = /^ip default-gateway (\S+)$/.exec(h)) && isIPv4(m[1])) { patch.gw = m[1]; continue; }
    if ((m = /^ip name-server (.+)$/.exec(h))) {
      const ips = m[1].split(/\s+/);
      if (ips.every(isIPv4)) { patch.dns.push(...ips.filter((x) => x !== "0.0.0.0")); continue; }
    }
    if ((m = /^ip domain-name (\S+)$/.exec(h))) { patch.domain = m[1]; continue; }
    if ((m = /^ip ssh version (\d)$/.exec(h))) { patch.sec.ssh = +m[1]; continue; }
    if ((m = /^enable (secret|password)(?: 0)? (\S+)$/.exec(h)) && !/^[57]$/.test(m[2]) ) { patch.sec[m[1] === "secret" ? "enableSecret" : "enablePassword"] = m[2]; continue; }
    if ((m = /^username (\S+)(?: privilege (\d+))? password(?: 0)? (\S+)$/.exec(h))) { (patch.sec.users ??= []).push({ name: m[1], pass: m[3], ...(m[2] && m[2] !== "1" ? { priv: +m[2] } : {}) }); continue; }

    if ((m = /^ip route (\S+) (\S+) (\S+)(?: (\d+))?$/.exec(h)) && isIPv4(m[1]) && maskToPrefix(m[2]) !== undefined) {
      const r = { net: m[1], prefix: maskToPrefix(m[2]) };
      if (isIPv4(m[3])) r.via = m[3]; else r.port = m[3];
      if (m[4]) r.ad = +m[4];
      patch.routes.push(r);
      continue;
    }

    if (h === "router rip") {
      const rip = { v: 1, networks: [], passive: [], autosum: true };
      const extras = [];
      for (const raw of b.body) {
        const l = raw.trim(); let mm;
        if ((mm = /^version (\d)$/.exec(l))) rip.v = +mm[1];
        else if ((mm = /^network (\S+)$/.exec(l))) rip.networks.push(mm[1]);
        else if (l === "no auto-summary") rip.autosum = false;
        else if ((mm = /^passive-interface (\S+)$/.exec(l))) rip.passive.push(mm[1]);
        else if (l === "default-information originate") rip.default = true;
        else if (l === "redistribute static") rip.static = true;
        else extras.push(raw);
      }
      patch.rip = rip;
      if (extras.length) leftover.push({ head: h, body: extras });
      continue;
    }

    if ((m = /^router ospf (\d+)$/.exec(h))) {
      const ospf = { pid: +m[1], networks: [], passive: [] };
      const extras = [];
      for (const raw of b.body) {
        const l = raw.trim(); let mm;
        if ((mm = /^network (\S+) (\S+) area (\S+)$/.exec(l)) && wildcardToPrefix(mm[2]) !== undefined) ospf.networks.push({ net: mm[1], prefix: wildcardToPrefix(mm[2]), area: mm[3] });
        else if ((mm = /^passive-interface (\S+)$/.exec(l))) ospf.passive.push(mm[1]);
        else if (l === "default-information originate") ospf.default = true;
        else extras.push(raw);
      }
      patch.ospf = ospf;
      if (extras.length) leftover.push({ head: h, body: extras });
      continue;
    }

    if ((m = /^ip nat pool (\S+) (\S+) (\S+) (?:netmask (\S+)|prefix-length (\d+))$/.exec(h)) && isIPv4(m[2]) && isIPv4(m[3])) {
      natRaw.pools.push({ name: m[1], start: m[2], end: m[3], prefix: m[4] ? maskToPrefix(m[4]) : +m[5] });
      continue;
    }
    if ((m = /^ip nat inside source list (\S+) interface (\S+) overload$/.exec(h))) { natRaw.rules.push({ kind: "overload", list: m[1], via: m[2] }); addRef(m[1]); continue; }
    if ((m = /^ip nat inside source list (\S+) pool (\S+)( overload)?$/.exec(h))) { natRaw.rules.push({ kind: "pool", list: m[1], pool: m[2], overload: !!m[3] }); addRef(m[1]); continue; }
    if ((m = /^ip nat inside source static (?:(tcp|udp) )?(\S+) (?:(\d+) )?(\S+)(?: (\d+))?$/.exec(h)) && isIPv4(m[2]) && isIPv4(m[4])) {
      const st = { kind: "static", local: m[2], global: m[4] };
      if (m[1]) Object.assign(st, { proto: m[1], lport: +m[3], gport: +m[5] });
      natRaw.rules.push(st);
      continue;
    }

    if ((m = /^access-list (\d+) (.+)$/.exec(h))) {
      const e = aclLines.get(m[1]) ?? aclLines.set(m[1], { numbered: true, rules: [], order: aclLines.size }).get(m[1]);
      e.rules.push(m[2]);
      continue;
    }
    if ((m = /^ip access-list (standard|extended) (\S+)$/.exec(h))) {
      aclLines.set(m[2], { numbered: false, ext: m[1] === "extended", rules: b.body.map((x) => x.trim()), order: aclLines.size, block: b });
      continue;
    }

    if ((m = /^ip dhcp excluded-address (\S+)(?: (\S+))?$/.exec(h)) && isIPv4(m[1])) { patch.dhcpExcluded.push({ from: m[1], to: m[2] && isIPv4(m[2]) ? m[2] : undefined }); continue; }
    if ((m = /^ip dhcp pool (\S+)$/.exec(h))) {
      const pool = { name: m[1], dns: [] };
      const extras = [];
      for (const raw of b.body) {
        const l = raw.trim(); let mm;
        if ((mm = /^network (\S+) (\S+)$/.exec(l)) && maskToPrefix(mm[2]) !== undefined) { pool.net = mm[1]; pool.prefix = maskToPrefix(mm[2]); }
        else if ((mm = /^default-router (\S+)$/.exec(l))) pool.gw = mm[1];
        else if ((mm = /^dns-server (.+)$/.exec(l))) pool.dns.push(...mm[1].split(/\s+/));
        else if ((mm = /^domain-name (\S+)$/.exec(l))) pool.domain = mm[1];
        else extras.push(raw);
      }
      if (!pool.net) { leftover.push(b); continue; }
      patch.dhcpPools.push(pool);
      if (extras.length) leftover.push({ head: h, body: extras });
      continue;
    }

    if ((m = /^line (con|aux|vty) (.+)$/.exec(h))) {
      const kind = m[1];
      const o = {};
      const extras = [];
      for (const raw of b.body) {
        const l = raw.trim(); let mm;
        if ((mm = /^password(?: 0)? (\S+)$/.exec(l)) && !/^[57]$/.test(mm[1])) o.password = mm[1];
        else if (l === "login") o.login = "plain";
        else if (l === "login local") o.login = "local";
        else if ((mm = /^transport input (\S+)$/.exec(l))) o.transport = mm[1];
        else extras.push(raw);
      }
      if (kind === "vty") {
        // si modella solo se tutti i blocchi vty sono uguali; il primo fissa il riferimento
        const prev = patch.sec._vty;
        if (!prev) patch.sec._vty = { o, range: m[2], extras };
        else if (JSON.stringify(prev.o) !== JSON.stringify(o)) { leftover.push(b); }
        else if (extras.length) leftover.push({ head: h, body: extras });
        if (!prev) { if (extras.length) leftover.push({ head: h, body: extras }); }
        patch.sec._vtyRanges = [...(patch.sec._vtyRanges ?? []), m[2]];
      } else if (kind === "con") {
        patch.sec.console = o;
        if (extras.length) leftover.push({ head: h, body: extras });
      } else if (Object.keys(o).length || extras.length) leftover.push(b);
      continue;
    }

    keep();
  }

  // ---- ACL: separa quelle "semplici" (solo reti permesse) dalle altre
  const acls = [];
  const simpleNets = new Map();     // id -> [{net,prefix}]
  for (const [id, e] of aclLines) {
    const ext = e.numbered ? isNumberedExt(+id) : e.ext;
    const rules = e.rules.map((r) => parseAclRule(r, ext));
    if (rules.some((r) => !r)) {
      // non rappresentabile: resta com'e' nel cli
      if (e.block) leftover.push(e.block);
      else for (const r of e.rules) leftover.push({ head: `access-list ${id} ${r}`, body: [] });
      continue;
    }
    const acl = { id, numbered: e.numbered, ext, rules, order: e.order };
    const nets = [];
    let simple = true;
    for (const r of rules) {
      const onlyIp = r.proto === undefined || (r.proto === "ip" && r.dst?.any);
      if (r.action !== "permit" || !onlyIp || r.src.any || r.log) { simple = false; break; }
      nets.push(r.src.host ? { net: r.src.host, prefix: 32 } : { net: r.src.net, prefix: r.src.prefix });
    }
    if (simple && nets.length) simpleNets.set(id, nets);
    acls.push(acl);
  }

  // ---- NAT
  const portRefs = new Set(patch.ports.flatMap((p) => Object.values(p.acl ?? {})));
  const nat = [];
  for (const r of natRaw.rules) {
    if (r.kind === "static") { nat.push(r); continue; }
    const nets = simpleNets.get(r.list);
    const onlyNat = (refs.get(r.list) ?? 0) === 1 && !portRefs.has(r.list);
    const base = r.kind === "overload" ? { kind: "overload", via: r.via } : { kind: "pool", overload: r.overload };
    if (r.kind === "pool") {
      const pool = natRaw.pools.find((p) => p.name === r.pool);
      if (!pool) { leftover.push({ head: `ip nat inside source list ${r.list} pool ${r.pool}${r.overload ? " overload" : ""}`, body: [] }); continue; }
      Object.assign(base, { name: pool.name, start: pool.start, end: pool.end, prefix: pool.prefix });
    }
    if (nets && onlyNat) { base.nets = nets; const k = acls.findIndex((a) => a.id === r.list); if (k >= 0) acls.splice(k, 1); }
    else base.acl = r.list;
    nat.push(base);
  }
  // pool non usati da nessuna regola: restano nel cli
  for (const p of natRaw.pools) if (!natRaw.rules.some((r) => r.pool === p.name)) leftover.push({ head: `ip nat pool ${p.name} ${p.start} ${p.end} netmask ${prefixToMask(p.prefix)}`, body: [] });
  patch.nat = nat;
  patch.acls = acls.sort((a, b) => a.order - b.order).map(({ order, ...a }) => a);

  // ---- vty / console
  if (patch.sec._vty) {
    patch.sec.vty = patch.sec._vty.o;
    patch.sec.vtyExtras = patch.sec._vty.extras;
  }
  delete patch.sec._vty; delete patch.sec._vtyRanges;
  for (const k of ["vty", "console"]) if (patch.sec[k] && !Object.keys(patch.sec[k]).length) delete patch.sec[k];
  // `login` semplice e' il default dei vty: non e' una funzione
  if (patch.sec.vty?.login === "plain" && Object.keys(patch.sec.vty).length === 1) delete patch.sec.vty;

  // ---- porte
  patch.portExtras = portExtras;
  return { patch, leftover };
}
