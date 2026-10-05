// Modello "compilato" (tutto esplicito)  ->  righe di running-config IOS.
import { prefixToMask, prefixToWildcard } from "./model.js";
import { toBlocks, blockLines, aclRuleToIos } from "./ios.js";

export const DEFAULT_CLOCK = 2000000;

const ipMask = (ip, prefix) => `${ip} ${prefixToMask(prefix)}`;

/** corpo di un blocco `interface` (stesso ordine delle righe che stampa Packet Tracer) */
function portBody(p, info, devType) {
  const L = [];
  if (p.vlan !== undefined) L.push(` encapsulation dot1Q ${p.vlan}`);
  if (p.desc) L.push(` description ${p.desc}`);
  if (p.ip) L.push(` ip address ${ipMask(p.ip, p.prefix)}`);
  else if (p.dhcp) L.push(" ip address dhcp");
  else if (p.unnumbered) L.push(` ip unnumbered ${p.unnumbered}`);
  else if (devType === "router" || info.svi || info.sub) L.push(" no ip address");
  for (const h of p.helper ?? []) L.push(` ip helper-address ${h}`);
  if (p.acl?.in) L.push(` ip access-group ${p.acl.in} in`);
  if (p.acl?.out) L.push(` ip access-group ${p.acl.out} out`);
  if (p.nat === "inside") L.push(" ip nat inside");
  if (p.nat === "outside") L.push(" ip nat outside");
  if (p.access !== undefined) L.push(` switchport access vlan ${p.access}`);
  if (p.native !== undefined) L.push(` switchport trunk native vlan ${p.native}`);
  if (p.allowed) L.push(` switchport trunk allowed vlan ${p.allowed}`);
  if (p.mode) L.push(` switchport mode ${p.mode}`);
  if (info.serial && info.dce) L.push(` clock rate ${p.clock ?? DEFAULT_CLOCK}`);
  if (info.duplex) L.push(" duplex auto", " speed auto");
  if (p.shutdown) L.push(" shutdown");
  return L;
}

/**
 * @param dev   modello compilato (porte con `shutdown` e `nat` espliciti, rip.networks, nat[].list, acls...)
 * @param base  righe della config "vuota" del template (senza interfacce)
 * @param ctx   { type, ports:[{name, serial, dce, duplex, defaultShutdown}] }
 * @returns {string[]}
 */
export function lowerIos(dev, base, ctx) {
  const portMap = new Map(dev.ports.filter((p) => p.name).map((p) => [p.name, p]));
  const sec = dev.sec ?? {};

  // ---- funzioni "globali" che vanno subito dopo hostname
  const early = [];
  if (sec.enableSecret) early.push(`enable secret ${sec.enableSecret}`);
  if (sec.enablePassword) early.push(`enable password ${sec.enablePassword}`);
  for (const u of sec.users ?? []) early.push(`username ${u.name}${u.priv ? " privilege " + u.priv : ""} password ${u.pass}`);
  for (const x of dev.dhcpExcluded ?? []) early.push(`ip dhcp excluded-address ${x.from}${x.to ? " " + x.to : ""}`);
  for (const p of dev.dhcpPools ?? []) {
    early.push(`ip dhcp pool ${p.name}`, ` network ${ipMask(p.net, p.prefix)}`);
    if (p.gw) early.push(` default-router ${p.gw}`);
    if (p.dns?.length) early.push(` dns-server ${p.dns.join(" ")}`);
    if (p.domain) early.push(` domain-name ${p.domain}`);
    early.push("!");
  }
  if (dev.domain) early.push(`ip domain-name ${dev.domain}`);
  if (dev.dns?.length) early.push(`ip name-server ${dev.dns.join(" ")}`);
  if (sec.ssh) early.push(`ip ssh version ${sec.ssh}`);

  // ---- interfacce
  const blocks = [];
  const emit = (name, info) => {
    const p = portMap.get(name) ?? { name };
    const shut = p.shutdown ?? info.defaultShutdown;
    blocks.push(`interface ${name}`, ...portBody({ ...p, shutdown: shut }, info, ctx.type), "!");
  };
  for (const pi of ctx.ports) {
    emit(pi.name, pi);
    const subs = [...portMap.keys()].filter((n) => n.startsWith(pi.name + ".")).sort((a, b) => +a.split(".").pop() - +b.split(".").pop());
    for (const s of subs) emit(s, { sub: true, defaultShutdown: false });
  }
  const svis = [...new Set([...(ctx.vlan1 === false ? [] : ["Vlan1"]), ...[...portMap.keys()].filter((n) => /^Vlan\d+$/.test(n))])].sort((a, b) => +a.slice(4) - +b.slice(4));
  for (const v of svis) emit(v, { svi: true, defaultShutdown: true });

  // ---- routing, NAT, ACL
  const routing = [];
  if (dev.rip) {
    routing.push("router rip");
    if (dev.rip.v === 2) routing.push(" version 2");
    for (const n of dev.rip.networks) routing.push(` network ${n}`);
    if (dev.rip.v === 2 && !dev.rip.autosum) routing.push(" no auto-summary");
    for (const p of dev.rip.passive ?? []) routing.push(` passive-interface ${p}`);
    if (dev.rip.default) routing.push(" default-information originate");
    if (dev.rip.static) routing.push(" redistribute static");
    routing.push("!");
  }
  if (dev.ospf) {
    routing.push(`router ospf ${dev.ospf.pid}`);
    for (const n of dev.ospf.networks) routing.push(` network ${n.net} ${prefixToWildcard(n.prefix)} area ${n.area}`);
    for (const p of dev.ospf.passive ?? []) routing.push(` passive-interface ${p}`);
    if (dev.ospf.default) routing.push(" default-information originate");
    routing.push("!");
  }
  const natLines = [];
  for (const r of dev.nat ?? []) {
    if (r.kind === "static") {
      natLines.push(r.proto ? `ip nat inside source static ${r.proto} ${r.local} ${r.lport} ${r.global} ${r.gport}` : `ip nat inside source static ${r.local} ${r.global}`);
    } else if (r.kind === "overload") {
      natLines.push(`ip nat inside source list ${r.list} interface ${r.via} overload`);
    } else if (r.kind === "pool") {
      natLines.push(`ip nat pool ${r.name} ${r.start} ${r.end} netmask ${prefixToMask(r.prefix)}`);
      natLines.push(`ip nat inside source list ${r.list} pool ${r.name}${r.overload ? " overload" : ""}`);
    }
  }
  const aclLines = [];
  for (const a of dev.acls ?? []) {
    if (a.numbered) for (const r of a.rules) aclLines.push(`access-list ${a.id} ${aclRuleToIos(r)}`);
    else aclLines.push(`ip access-list ${a.ext ? "extended" : "standard"} ${a.id}`, ...a.rules.map((r) => " " + aclRuleToIos(r)), "!");
  }
  const routes = (dev.routes ?? []).map((r) => `ip route ${r.net} ${prefixToMask(r.prefix)} ${r.via ?? r.port}${r.ad ? " " + r.ad : ""}`);

  // ---- composizione
  const out = [];
  const tailAt = base.findIndex((l) => /^(ip classless|ip flow-export|line con|line aux|line vty)/.test(l));
  const head = tailAt < 0 ? base : base.slice(0, tailAt);
  const tail = tailAt < 0 ? [] : base.slice(tailAt);
  for (const l of head) {
    if (/^hostname /.test(l)) {
      out.push(`hostname ${dev.hostname ?? l.slice(9)}`, "!");
      if (early.length) { out.push(...early); if (early[early.length - 1] !== "!") out.push("!"); }
      continue;
    }
    out.push(l);
  }
  out.push(...blocks, ...routing);
  if (natLines.length) out.push(...natLines, "!");
  if (aclLines.length) { out.push(...aclLines); if (aclLines[aclLines.length - 1] !== "!") out.push("!"); }

  const tailBlocks = toBlocks(tail);
  for (const b of tailBlocks.filter((b) => !/^line /.test(b.head))) out.push(...blockLines(b), "!");
  if (routes.length) out.push(...routes, "!");
  if (dev.gw && ctx.type === "switch") out.push(`ip default-gateway ${dev.gw}`, "!");
  for (const b of tailBlocks.filter((b) => /^line /.test(b.head))) {
    const kind = /^line (con|aux|vty)/.exec(b.head)[1];
    const o = kind === "vty" ? sec.vty : kind === "con" ? sec.console : undefined;
    const body = b.body.filter((l) => l.trim() !== "login");
    const lines = [];
    if (o?.password) lines.push(` password ${o.password}`);
    if (o?.transport) lines.push(` transport input ${o.transport}`);
    const login = o?.login ?? (b.body.some((l) => l.trim() === "login") ? "plain" : undefined);
    if (login === "plain") lines.push(" login");
    if (login === "local") lines.push(" login local");
    out.push(b.head, ...body, ...lines, ...(kind === "vty" ? sec.vtyExtras ?? [] : []), "!");
  }
  out.push("end");
  return out;
}
