// Collegamenti: assegnazione delle porte, opzioni dei link (vlan/trunk/clock) e forma corta per il testo.
import { PktmdError, shortPort } from "./model.js";

/** porte che un dispositivo "prenota": quelle dichiarate con un indirizzo (o senza altro), nell'ordine di scrittura */
function reservedPorts(dev, primary) {
  const out = [];
  for (const p of dev.ports ?? []) {
    const name = p.name ?? primary;
    if (!name || /\.\d+$/.test(name) || /^Vlan\d+$/.test(name)) continue;
    const keys = Object.keys(p).filter((k) => !["name", "line", "sub"].includes(k));
    const reserve = p.ip || p.dhcp || p.unnumbered || p.vlan !== undefined || keys.length === 0;
    if (reserve && !out.includes(name)) out.push(name);
  }
  return out;
}

/**
 * Riempie le porte mancanti dei collegamenti: prima le porte esplicite di tutti i link, poi le altre in ordine,
 * dando la precedenza alle porte prenotate (con IP o dichiarate "nude") e poi all'ordine dell'hardware.
 *
 * @param portsOf  (dev) => nomi delle porte in ordine
 * @param devOf    (id) => dispositivo del modello (per le porte prenotate)
 */
export function resolveLinks(network, portsOf, devOf) {
  const taken = new Map();
  const set = (id) => taken.get(id) ?? taken.set(id, new Set()).get(id);
  const links = network.links.map((l) => ({ ...l, a: { ...l.a }, b: { ...l.b } }));
  for (const l of links) for (const e of [l.a, l.b]) if (e.port) set(e.dev).add(e.port);
  const priority = new Map();
  const order = (id) => {
    if (!priority.has(id)) {
      const dev = devOf(id);
      const all = dev ? portsOf(dev) : [];
      const reserved = dev ? reservedPorts(dev, all[0]).filter((n) => all.includes(n)) : [];
      priority.set(id, [...reserved, ...all.filter((n) => !reserved.includes(n))]);
    }
    return priority.get(id);
  };
  for (const l of links) {
    for (const e of [l.a, l.b]) {
      if (e.port) continue;
      const t = set(e.dev);
      const free = order(e.dev).find((n) => !t.has(n));
      if (!free) throw new PktmdError(`${e.dev}: nessuna porta libera`, l.line);
      e.port = free;
      t.add(free);
    }
  }
  // porta usata due volte
  const seen = new Set();
  for (const l of links) for (const e of [l.a, l.b]) {
    const k = `${e.dev}|${e.port}`;
    if (seen.has(k)) throw new PktmdError(`${e.dev}: la porta ${shortPort(e.port)} e' gia' collegata`, l.line);
    seen.add(k);
  }
  return links;
}

/** versione "tollerante" per l'anteprima: se non si riesce, lascia le porte non risolte */
export function resolveLinksSafe(network, portsOf, devOf) {
  try { return resolveLinks(network, portsOf, devOf); } catch { return network.links.map((l) => ({ ...l })); }
}

const sameCfg = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** riporta le opzioni dei link (vlan, trunk, clock) nelle porte dei dispositivi (`work`: id -> dispositivo da modificare) */
export function mergeLinkOptions(links, work, typeOf) {
  const port = (devId, name) => {
    const d = work.get(devId);
    let p = d.ports.find((x) => x.name === name);
    if (!p) { p = { name }; d.ports.push(p); }
    return p;
  };
  for (const l of links) {
    const o = l.opts;
    if (!o) continue;
    const ends = [l.a, l.b];
    const sw = ends.filter((e) => typeOf(e.dev) === "switch");
    if ((o.vlan !== undefined || o.trunk) && !sw.length) throw new PktmdError("\"vlan\" e \"trunk\" servono almeno uno switch ad un estremo del collegamento", l.line);
    for (const e of sw) {
      const p = port(e.dev, e.port);
      const want = o.trunk ? { mode: "trunk", ...(o.trunk.allowed ? { allowed: o.trunk.allowed } : {}), ...(o.trunk.native !== undefined ? { native: o.trunk.native } : {}) } : { access: o.vlan, mode: "access" };
      for (const [k, v] of Object.entries(want)) {
        if (p[k] !== undefined && !sameCfg(p[k], v)) throw new PktmdError(`${e.dev}: la porta ${shortPort(e.port)} e' gia' configurata diversamente (${k})`, l.line);
        p[k] = v;
      }
    }
    if (o.clock !== undefined) port(l.a.dev, l.a.port).clock = o.clock;
  }
}
