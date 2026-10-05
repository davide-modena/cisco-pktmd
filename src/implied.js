// Il "non detto" del linguaggio.
//
//   compile(dev, ctx)   modello scritto dall'utente  ->  modello esplicito (tutto cio' che e' implicito viene riempito)
//   simplify(dev, ctx)  modello esplicito (letto da una config) -> modello minimo da scrivere nel .pktmd
//
// Vale  compile(simplify(x)) == x  per ogni x che esce da liftIos.
import { PktmdError, inNet, networkAddress, classfulNetwork, normalizePort, isIPv4, shortPort } from "./model.js";

export const portKind = (name) => (/\.\d+$/.test(name) ? "sub" : /^Vlan\d+$/.test(name) ? "svi" : "phys");
const parentOf = (name) => name.replace(/\.\d+$/, "");

const clone = (o) => JSON.parse(JSON.stringify(o));

/** rete + prefisso dell'indirizzo di una porta */
const hasIp = (p) => !!(p.ip || p.dhcp || p.unnumbered);

/** stato "spento" quando non e' scritto niente */
export function defaultShutdown(p, ports, type) {
  const kind = portKind(p.name);
  if (kind === "sub") return false;
  if (kind === "svi") return !(p.ip || p.dhcp);
  if (type === "switch") return false;
  const hasSubs = ports.some((q) => q.name !== p.name && q.name.startsWith(p.name + "."));
  return !(hasIp(p) || hasSubs);
}

// ---- lati NAT dedotti dalle regole ---------------------------------------------------------------------------------
export function impliedNat(dev) {
  const withIp = dev.ports.filter((p) => p.ip);
  const side = new Map();
  const mark = (name, s) => { if (name && !side.has(name)) side.set(name, s); };
  const portOf = (ip) => withIp.find((p) => inNet(ip, p.ip, p.prefix));
  const covers = (nets, p) => (nets ?? []).some((n) => inNet(p.ip, n.net, n.prefix));
  for (const r of dev.nat ?? []) {
    if (r.kind === "overload") {
      for (const p of withIp) if (covers(r.nets, p)) mark(p.name, "inside");
      if (r.via) mark(r.via, "outside");
    } else if (r.kind === "pool") {
      for (const p of withIp) if (covers(r.nets, p)) mark(p.name, "inside");
      mark(portOf(r.start)?.name, "outside");
    } else if (r.kind === "static") {
      mark(portOf(r.local)?.name, "inside");
      mark(portOf(r.global)?.name, "outside");
    }
  }
  return side;
}

/** reti classful che RIP annuncia quando non se ne scrive l'elenco */
export function autoRipNetworks(dev) {
  return [...new Set(dev.ports.filter((p) => p.ip).map((p) => classfulNetwork(p.ip)))].sort((a, b) => a.split(".").map(Number).reduce((x, y) => x * 256 + y) - b.split(".").map(Number).reduce((x, y) => x * 256 + y));
}

/** VLAN citate da una lista "10,20,30-32" */
export function expandVlanList(s) {
  const out = [];
  for (const part of String(s).split(",")) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(part.trim());
    if (!m) continue;
    for (let v = +m[1]; v <= +(m[2] ?? m[1]); v++) out.push(v);
  }
  return out;
}

const vlanDefaultName = (id) => `VLAN${String(id).padStart(4, "0")}`;

// ---------------------------------------------------------------------------------------------------------------
// COMPILE
//   ctx: { type:'router'|'switch', primary: nome della porta principale, normalize(name)->nome completo }

export function compile(input, ctx) {
  const d = clone(input);
  d.ports = d.ports ?? [];
  d.nat = d.nat ?? [];
  d.acls = d.acls ?? [];
  d.dhcpPools = d.dhcpPools ?? [];

  // 1. porte: nome principale, sottointerfacce, duplicati
  const ports = [];
  const byName = new Map();
  const add = (p) => {
    const prev = byName.get(p.name);
    if (prev) { Object.assign(prev, p); return prev; }
    const q = { ...p };
    byName.set(q.name, q);
    ports.push(q);
    return q;
  };
  for (const raw of d.ports) {
    const p = { ...raw };
    p.name = p.name ?? ctx.primary;
    if (p.vlan !== undefined && portKind(p.name) === "phys") {
      const parent = p.name;
      p.name = `${parent}.${p.vlan}`;
      if (!byName.has(parent)) add({ name: parent });
    }
    add(p);
  }
  d.ports = ports;

  // 2. stato amministrativo
  for (const p of ports) {
    if (p.admin === "down") p.shutdown = true;
    else if (p.admin === "up") p.shutdown = false;
    else p.shutdown = defaultShutdown(p, ports, ctx.type);
  }

  // 3. NAT: via predefinito, lati, ACL automatiche
  const usedIds = new Set(d.acls.filter((a) => a.numbered).map((a) => String(a.id)));
  const freeId = () => { for (let n = 1; n < 100; n++) if (!usedIds.has(String(n))) { usedIds.add(String(n)); return String(n); } throw new PktmdError("troppe ACL automatiche per il NAT"); };
  let poolN = 0;
  for (const r of d.nat) {
    if (r.kind === "overload" && !r.via) {
      const explicitOut = ports.filter((p) => p.nat === "outside");
      const cands = explicitOut.length ? explicitOut : ports.filter((p) => p.ip && !(r.nets ?? []).some((n) => inNet(p.ip, n.net, n.prefix)) && p.nat !== "inside");
      if (cands.length !== 1) throw new PktmdError(`nat overload: non capisco su quale interfaccia uscire (${cands.length} candidate): scrivi "via <porta>"`, r.line);
      r.via = cands[0].name;
    }
    if (r.kind === "pool") r.name = r.name ?? `pool${++poolN}`;
    if (r.kind !== "static") {
      if (r.nets) {
        const id = freeId();
        d.acls.push({ id, numbered: true, ext: false, auto: true, rules: r.nets.map((n) => ({ action: "permit", src: n.prefix === 32 ? { host: n.net } : { net: n.net, prefix: n.prefix } })) });
        r.list = id;
      } else r.list = String(r.acl);
    }
  }
  const implied = impliedNat(d);
  for (const p of ports) {
    if (p.nat === "off") delete p.nat;
    else if (!p.nat && implied.has(p.name)) p.nat = implied.get(p.name);
  }

  // 4. RIP / OSPF
  if (d.rip) {
    d.rip.v = d.rip.v ?? 2;
    d.rip.networks = d.rip.networks ?? autoRipNetworks(d);
    d.rip.passive = d.rip.passive ?? [];
    d.rip.autosum = d.rip.autosum ?? false;
  }

  // 5. DHCP del router
  let pn = 0;
  for (const p of d.dhcpPools) p.name = p.name ?? `pool${++pn}`;

  // 6. rotte
  for (const r of d.routes ?? []) if (r.default) { r.net = "0.0.0.0"; r.prefix = 0; }

  // 7. VLAN usate
  const vl = new Map((d.vlans ?? []).map((v) => [v.id, v]));
  const use = (id) => { if (id > 1 && id < 1002 && !vl.has(id)) vl.set(id, { id, name: vlanDefaultName(id) }); };
  for (const p of ports) {
    if (p.access !== undefined) use(p.access);
    if (p.native !== undefined) use(p.native);
    if (p.allowed) expandVlanList(p.allowed).forEach(use);
    if (p.mode === undefined && p.access !== undefined) p.mode = "access";
  }
  for (const v of vl.values()) v.name = v.name ?? vlanDefaultName(v.id);
  d.vlans = [...vl.values()].sort((a, b) => a.id - b.id);
  return d;
}

// ---------------------------------------------------------------------------------------------------------------
// SIMPLIFY

export function simplify(input, ctx) {
  const d = clone(input);
  const ports = d.ports;

  // implicito: stato admin, lati NAT
  const implied = impliedNat(d);
  for (const p of ports) {
    const def = defaultShutdown(p, ports, ctx.type);
    const actual = !!p.shutdown;
    delete p.admin;
    if (actual !== def) p.admin = actual ? "down" : "up";
    delete p.shutdown;
    const imp = implied.get(p.name);
    if (p.nat !== imp) p.nat = p.nat ?? "off";
    else delete p.nat;
    if (p.nat === undefined) delete p.nat;
    // "mode access" implicito quando c'e' la VLAN di accesso
    if (p.mode === "access" && p.access !== undefined) delete p.mode;
  }

  // sotto-interfacce: `gi0/0.10` con vlan 10 -> `gi0/0 vlan 10`
  d.ports = [];
  for (const p of ports) {
    if (portKind(p.name) === "sub") {
      const suffix = +p.name.split(".").pop();
      if (p.vlan === suffix) { d.ports.push({ ...p, name: parentOf(p.name), sub: true }); continue; }
    }
    d.ports.push(p);
  }
  // le porte madri che servivano solo a ospitare sotto-interfacce spariscono
  const subParents = new Set(d.ports.filter((p) => p.sub).map((p) => p.name));
  d.ports = d.ports.filter((p) => {
    if (p.sub || !subParents.has(p.name)) return true;
    const keys = Object.keys(p).filter((k) => k !== "name");
    return keys.length > 0;
  });
  for (const p of d.ports) delete p.sub;
  // porte senza alcun attributo: non si scrivono
  d.ports = d.ports.filter((p) => Object.keys(p).some((k) => k !== "name"));

  // NAT: le ACL automatiche e i nomi dei pool predefiniti non si scrivono
  for (const r of d.nat) {
    delete r.list;
    if (r.kind === "pool" && /^pool\d+$/.test(r.name ?? "")) delete r.name;
  }
  d.acls = (d.acls ?? []).filter((a) => !a.auto);
  // `via` si omette solo se la compilazione lo ricava identico
  d.nat.forEach((r, i) => {
    if (r.kind !== "overload" || !r.via) return;
    const probe = clone(d);
    delete probe.nat[i].via;
    try {
      if (compile(probe, ctx).nat[i].via === r.via) delete r.via;
    } catch { /* serve esplicito */ }
  });

  // RIP
  if (d.rip) {
    const auto = autoRipNetworks(input);
    if (JSON.stringify(d.rip.networks) === JSON.stringify(auto)) delete d.rip.networks;
    if (d.rip.v === 2) delete d.rip.v;
    if (!d.rip.autosum) delete d.rip.autosum;
    if (!d.rip.passive?.length) delete d.rip.passive;
  }
  // VLAN: solo quelle con un nome non standard
  d.vlans = (d.vlans ?? []).filter((v) => v.name && v.name !== vlanDefaultName(v.id));
  return d;
}
