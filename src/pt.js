// Modello di rete  <->  XML di Packet Tracer.
// Nessun file intermedio: il "rumore" (decine di KB di impostazioni) viene dai telai in template-data.js.
import {
  parseXml, serializeXml, child, childrenOf, textOf, attr, setChildText, setText, el, clone, walkNodes, unescapeXml, path,
} from "./xml.js";
import TEMPLATE_B64 from "./template-data.js";
import { PktmdError, isIPv4, shortPort } from "./model.js";
import { MODELS, MODEL_BY_PT, DEFAULT_MODEL, DEFAULT_MODULES, MODULE_ALIASES } from "./catalog.js";
import { inventory, slotContainers, installModule, setNic, cableKind, isSerialPort, resolveModuleName } from "./hw.js";
import { liftIos, blocksToCli } from "./ios.js";
import { lowerIos } from "./ios-lower.js";
import { compile, simplify } from "./implied.js";
import { liftHost, applyHost } from "./hosts.js";
import { autoLayout } from "./layout.js";
import { stripPhysicalDevices, cleanOptions, unplace, placeDevices } from "./skeleton.js";
import { validateXml } from "./validate.js";
import { resolveLinks, resolveLinksSafe, mergeLinkOptions } from "./links.js";
import { applyCli } from "./cli.js";

// ---------------------------------------------------------------------------------------------------------------
// Template

let tplPromise;
export const getTemplate = () => (tplPromise ??= loadTemplate());

async function inflate(b64) {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const res = new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate")));
  return new TextDecoder("utf-8").decode(new Uint8Array(await res.arrayBuffer()));
}

async function loadTemplate() {
  const root = parseXml(await inflate(TEMPLATE_B64));
  const tpl = {
    skeleton: child(child(root, "SKELETON"), "PACKETTRACER5"),
    models: new Map(),
    modules: new Map(),
    links: new Map(),
  };
  // difese in piu': anche se il template contenesse residui (nodi fisici di altri dispositivi, file recenti...)
  stripPhysicalDevices(tpl.skeleton);
  cleanOptions(tpl.skeleton);
  for (const m of childrenOf(root, "MODEL")) tpl.models.set(attr(m, "key"), child(m, "DEVICE"));
  for (const m of childrenOf(root, "MODULEDEF")) tpl.modules.set(attr(m, "name"), { slotType: attr(m, "slotType"), node: child(m, "MODULE") });
  for (const l of childrenOf(root, "LINKDEF")) tpl.links.set(attr(l, "key"), child(l, "LINK"));
  /** porte di un modello nuovo (senza moduli aggiuntivi) */
  tpl.portsOf = (key) => inventory(child(tpl.models.get(key), "ENGINE"), MODELS[key]).map((p) => p.name);
  return tpl;
}

export const specOf = (dev) => MODELS[dev.model ?? DEFAULT_MODEL[dev.type]];

// ---------------------------------------------------------------------------------------------------------------
// Utilita'

const cfgLines = (engine) => childrenOf(child(engine, "RUNNINGCONFIG"), "LINE").map((l) => unescapeXml(l.text ?? ""));
const sanitize = (s) => s.replace(/[^A-Za-z0-9_-]+/g, "_");

function setConfig(engine, lines, withStartup) {
  const set = (tag) => {
    let nd = child(engine, tag);
    if (!nd) { nd = el(tag); engine.children.push(nd); }
    nd.text = null; nd.selfClosing = false;
    nd.children = lines.map((l) => el("LINE", l));
  };
  set("RUNNINGCONFIG");
  if (withStartup) set("STARTUPCONFIG");
}

const defaultHostname = (spec) => (spec.type === "router" ? "Router" : "Switch");

// ---------------------------------------------------------------------------------------------------------------
// XML -> modello

/** moduli installati, espressi come differenza rispetto al telaio nuovo */
function liftModules(engine, spec, inv, tpl) {
  const slots = slotContainers(engine, spec);
  if (!slots.length || spec.family === "host") return [];
  const defaults = DEFAULT_MODULES[spec.key] ?? [];
  const actual = slots.map((s) => { const m = child(s, "MODULE"); return m ? textOf(m, "MODEL") : null; });
  const base = slots.map((_, i) => defaults[i] ?? null);
  const diff = [];
  actual.forEach((m, i) => { if (m !== base[i]) diff.push({ slot: i, name: m }); });
  // senza `slot` se il posizionamento automatico nel primo slot libero riproduce la stessa disposizione
  const adds = diff.filter((d) => d.name);
  const onlyAdds = diff.every((d) => d.name && base[d.slot] === null);
  if (onlyAdds) {
    const sim = [...base];
    let ok = true;
    for (const d of adds.sort((a, b) => a.slot - b.slot)) {
      const def = tpl.modules.get(d.name);
      const free = slots.findIndex((s, i) => sim[i] === null && def && textOf(s, "TYPE") === def.slotType);
      if (free !== d.slot) { ok = false; break; }
      sim[free] = d.name;
    }
    if (ok) return adds.map((d) => ({ name: d.name }));
  }
  return diff.map((d) => ({ name: d.name ?? "none", slot: d.slot }));
}

/**
 * @returns {{network, warnings: string[]}}  il modello e' "esplicito": va semplificato (simplifyNetwork) prima di scriverlo
 */
export function fromXml(root, tpl) {
  const net = child(root, "NETWORK");
  const warnings = [];
  const devices = [];
  const refToId = new Map();
  const info = new Map();                // id -> {spec, inv}
  const used = new Set();
  const devNodes = childrenOf(child(net, "DEVICES"), "DEVICE");

  devNodes.forEach((dn, idx) => {
    const engine = child(dn, "ENGINE");
    const ptModel = attr(child(engine, "TYPE"), "model");
    const rawName = textOf(engine, "NAME");
    const spec = MODEL_BY_PT[ptModel];
    if (!spec) { if (ptModel !== "Power Distribution Device") warnings.push(`dispositivo "${rawName}" (${ptModel}) non supportato: ignorato`); return; }

    let id = sanitize(rawName) || spec.type;
    if (id !== rawName) warnings.push(`nome "${rawName}" rinominato in "${id}"`);
    for (let n = 2; used.has(id); n++) id = `${sanitize(rawName)}_${n}`;
    used.add(id);
    refToId.set(textOf(engine, "SAVE_REF_ID") || String(idx), id);

    const inv = inventory(engine, spec);
    const dev = { id, type: spec.type, ports: [], files: [], dns: [], routes: [], nat: [], acls: [], dhcpPools: [], dhcpExcluded: [], vlans: [], modules: [] };
    if (spec.key !== DEFAULT_MODEL[spec.type]) dev.model = spec.key;
    const logical = path(dn, "WORKSPACE/LOGICAL");
    if (logical) dev.pos = { x: +textOf(logical, "X"), y: +textOf(logical, "Y") };
    info.set(id, { spec, inv, engine });

    if (spec.family === "host") {
      const t = inv[0]?.type ?? "";
      if (/Gigabit/.test(t)) dev.nic = /Fiber/.test(t) ? "fiber" : "gig";
      if (dev.nic && inv[0].slot > 0) dev.nicSlot = inv[0].slot;
      if (!dev.nic && inv[0]?.slot > 0) { dev.nic = "fa"; dev.nicSlot = inv[0].slot; }
      Object.assign(dev, liftHost(engine, spec.type, inv));
    } else {
      dev.modules = liftModules(engine, spec, inv, tpl);
      const lines = cfgLines(engine);
      const { patch, leftover } = liftIos(lines, { type: spec.type, defaultHost: defaultHostname(spec) });
      const { portExtras, ...rest } = patch;
      Object.assign(dev, rest);
      // vlan del database (strutturate)
      const vl = child(engine, "VLANS");
      if (vl && spec.type === "switch") {
        for (const v of childrenOf(vl, "VLAN")) {
          const num = +attr(v, "number");
          if (num > 1 && num < 1002) dev.vlans.push({ id: num, name: attr(v, "name") });
        }
      }
      // avanzi: righe che il modello non sa esprimere
      const extra = [...leftover];
      for (const pe of portExtras) extra.push({ head: pe.head, body: pe.body });
      if (extra.length) dev.cli = blocksToCli(extra);
      // la config puo' citare porte che non esistono nell'inventario (es. sottointerfacce): nessun problema
    }
    devices.push(dev);
  });

  const links = [];
  for (const ln of childrenOf(child(net, "LINKS"), "LINK")) {
    const cable = child(ln, "CABLE");
    if (!cable) continue;
    const from = textOf(cable, "FROM"), to = textOf(cable, "TO");
    const ports = cable.children.filter((c) => c.tag === "PORT").map((c) => unescapeXml(c.text ?? ""));
    const a = refToId.get(from), b = refToId.get(to);
    if (!a || !b) { warnings.push("collegamento con un dispositivo ignorato: saltato"); continue; }
    const link = { a: { dev: a, port: ports[0] }, b: { dev: b, port: ports[1] } };
    const dce = textOf(cable, "DCEDEV");
    if (dce) {
      const dceId = refToId.get(dce);
      if (dceId === b) [link.a, link.b] = [link.b, link.a];   // il primo estremo e' sempre il DCE
    }
    links.push(link);
  }
  return { network: { devices, links }, warnings, info };
}

// ---------------------------------------------------------------------------------------------------------------
// modello -> XML

function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seedOf(s) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
const hex = (rng, n) => Array.from({ length: n }, () => Math.floor(rng() * 16).toString(16)).join("").toUpperCase();
const mac = (rng) => { const h = "00" + hex(rng, 10); return `${h.slice(0, 4)}.${h.slice(4, 8)}.${h.slice(8, 12)}`; };
const uuid = (rng) => `{${hex(rng, 8)}-${hex(rng, 4)}-4${hex(rng, 3)}-${hex(rng, 4)}-${hex(rng, 12)}}`.toLowerCase();
const bigDigits = (rng) => String(BigInt(Math.floor(rng() * 9e15)) * 1000n + BigInt(Math.floor(rng() * 1000)) + 1000000000000000000n);
const memAddr = (rng) => String(50000000000 + Math.floor(rng() * 600000000) * 8);

function linkLocal(m) {
  const b = m.replace(/\./g, "").match(/../g).map((x) => parseInt(x, 16));
  const g = (a, c) => ((a << 8) | c).toString(16).toUpperCase();
  return `FE80::${g(b[0] ^ 2, b[1])}:${g(b[2], 0xff)}:${g(0xfe, b[3])}:${g(b[4], b[5])}`;
}

/** rende unico un dispositivo clonato dal template */
function freshen(dn, id, rng, pos) {
  const engine = child(dn, "ENGINE");
  setChildText(engine, "NAME", id);
  setChildText(engine, "SAVE_REF_ID", `save-ref-id:${bigDigits(rng)}`);
  const sn = textOf(engine, "SERIALNUMBER");
  setChildText(engine, "SERIALNUMBER", sn.slice(0, 7) + hex(rng, 4) + (sn.endsWith("-") ? "-" : ""));

  const macs = new Map();
  for (const n of walkNodes(dn)) {
    if (!n.children.length && /^[0-9A-F]{4}\.[0-9A-F]{4}\.[0-9A-F]{4}$/.test(n.text ?? "")) {
      if (!macs.has(n.text)) macs.set(n.text, mac(rng));
      n.text = macs.get(n.text);
    }
  }
  for (const n of walkNodes(dn)) {
    if (n.tag !== "PORT") continue;
    const m = textOf(n, "MACADDRESS");
    if (!m) continue;
    for (const t of ["IPV6_LINK_LOCAL", "IPV6_DEFAULT_LINK_LOCAL"]) if (child(n, t) && textOf(n, t)) setChildText(n, t, linkLocal(m));
  }
  const clock = path(engine, "PTP_PROCESS/PTP_CLOCK_ID");
  if (clock) {
    const b = mac(rng).replace(/\./g, "").match(/../g);
    setText(clock, `0x${b[0]}:${b[1]}:${b[2]}:FF:FE:${b[3]}:${b[4]}:${b[5]}`);
  }
  const duid = path(engine, "DHCPV6_MAIN/PARTIAL_DUID");
  if (duid) setText(duid, hex(rng, 8).match(/../g).join("-") + "-");
  const beacon = path(engine, "BLUETOOTH_MANAGER/BEACON_UUID");
  if (beacon) setText(beacon, uuid(rng));

  const logical = path(dn, "WORKSPACE/LOGICAL");
  setChildText(logical, "X", pos.x);
  setChildText(logical, "Y", pos.y);
  setChildText(logical, "MEM_ADDR", memAddr(rng));
  setChildText(logical, "DEV_ADDR", memAddr(rng));
  // vista fisica: il dispositivo non e' collocato (vedi skeleton.js). `uuid` resta per le versioni che lo richiedono altrove.
  unplace(dn);
  return engine;
}

/** (ri)costruisce l'elemento VLANS dello switch */
function writeVlans(engine, vlans) {
  const vl = child(engine, "VLANS");
  if (!vl) return;
  const std = (id, name) => { const v = el("VLAN", ""); v.text = null; v.selfClosing = true; v.attrs = [["name", name], ["number", String(id)], ["rspan", "0"]]; return v; };
  vl.children = [std(1, "default"), ...vlans.filter((v) => v.id > 1).map((v) => std(v.id, v.name)), std(1002, "fddi-default"), std(1003, "token-ring-default"), std(1004, "fddinet-default"), std(1005, "trnet-default")];
}

/** telaio del dispositivo con scheda di rete e moduli richiesti */
function buildHardware(dev, tpl) {
  const spec = specOf(dev);
  if (!spec) throw new PktmdError(`${dev.id}: modello sconosciuto`, dev.line);
  const dn = clone(tpl.models.get(spec.key));
  const engine = child(dn, "ENGINE");
  if (dev.nic) setNic(engine, spec, dev.nic, tpl.modules, dev.nicSlot ?? 0);
  if (dev.modules?.length) {
    if (spec.family === "host") throw new PktmdError(`${dev.id}: i moduli valgono solo per router e switch`, dev.line);
    for (const m of dev.modules) {
      const slots = slotContainers(engine, spec);
      const name = m.name === "none" ? null : resolveModuleName(m.name);
      try {
        if (m.slot !== undefined && child(slots[m.slot] ?? {}, "MODULE")) slots[m.slot].children = slots[m.slot].children.filter((c) => c.tag !== "MODULE");
        if (name) installModule(engine, spec, name, tpl.modules, m.slot);
      } catch (e) {
        throw e instanceof PktmdError ? new PktmdError(`${dev.id}: ${e.rawMessage}`, dev.line) : e;
      }
    }
  }
  return { spec, dn, engine, inv: inventory(engine, spec) };
}

/** nomi delle porte di un dispositivo del modello (compresi i moduli); lancia PktmdError se l'hardware e' incoerente */
export async function portNamesOf(dev) {
  const tpl = await getTemplate();
  return buildHardware(dev, tpl).inv.map((p) => p.name);
}

/**
 * @param {import("./model.js").Network} network  modello come lo scrive l'utente
 * @param {{layout?: boolean, warnings?: string[]}} [opts]
 * @returns {Promise<string>} XML
 */
export async function toXml(network, { layout = true, warnings = [] } = {}) {
  const tpl = await getTemplate();
  const root = clone(tpl.skeleton);
  const netNode = child(root, "NETWORK");
  const ids = new Set();
  for (const d of network.devices) {
    if (ids.has(d.id)) throw new PktmdError(`dispositivo "${d.id}" definito due volte`, d.line);
    ids.add(d.id);
  }

  // ---- 1. hardware
  const built = new Map();
  for (const dev of network.devices) {
    const hw = buildHardware(dev, tpl);
    built.set(dev.id, { dev, ...hw, rng: mulberry32(seedOf(dev.id)) });
  }

  // ---- 2. collegamenti: porte, opzioni (vlan/trunk), DCE
  const resolved = resolveLinks(network, (d) => built.get(d.id)?.inv.map((p) => p.name) ?? [], (id) => built.get(id)?.dev);
  const work = new Map();   // id -> dispositivo con le opzioni dei link fuse nelle porte
  for (const b of built.values()) work.set(b.dev.id, JSON.parse(JSON.stringify(b.dev)));
  mergeLinkOptions(resolved, work, (id) => built.get(id)?.spec.type);

  // ---- 3. configurazione di ogni dispositivo
  const portInfo = (b) => {
    const dceOf = new Set();
    const linked = new Set();
    for (const l of resolved) {
      for (const [e, other] of [[l.a, l.b], [l.b, l.a]]) {
        if (e.dev !== b.dev.id || !e.port) continue;
        linked.add(e.port);
        void other;
      }
      if (l.a.dev === b.dev.id && l.a.port && b.inv.find((p) => p.name === l.a.port && isSerialPort(p))) dceOf.add(l.a.port);
    }
    return { dceOf, linked };
  };

  for (const b of built.values()) {
    const { spec, engine, inv } = b;
    const dev = work.get(b.dev.id);
    if (spec.family === "host") {
      if (dev.hostname) throw new PktmdError(`${dev.id}: "name" non e' supportato su ${dev.type} (e' l'hostname di router e switch)`, dev.line);
      for (const k of ["rip", "ospf"]) if (dev[k]) throw new PktmdError(`${dev.id}: ${k} vale solo per i router`, dev.line);
      if (dev.cli) throw new PktmdError(`${dev.id}: il blocco cli vale solo per router e switch`, dev.line);
      if (spec.type !== "server" && (dev.files?.length || dev.dnsRecords?.length || dev.dhcpPools?.length || dev.mailDomain || dev.mailUsers?.length)) {
        throw new PktmdError(`${dev.id}: file, record DNS, pool DHCP e utenti di posta valgono solo per i server`, dev.line);
      }
      applyHost(engine, dev, spec.type, inv);
      continue;
    }
    if (dev.files?.length) throw new PktmdError(`${dev.id}: i file HTTP valgono solo per i server`, dev.line);
    if (dev.gw && spec.type === "router") throw new PktmdError(`${dev.id}: un router non ha "gw": usa "route default via <indirizzo>"`, dev.line);
    const { dceOf } = portInfo(b);
    const primary = inv[0]?.name;
    const comp = compile(dev, { type: spec.type, primary });
    // le porte citate devono esistere
    const known = new Set(inv.map((p) => p.name));
    for (const p of comp.ports) {
      const base = p.name.replace(/\.\d+$/, "");
      if (/^Vlan\d+$/.test(p.name)) { if (spec.type === "switch" || spec.type === "router") continue; }
      if (!known.has(base)) throw new PktmdError(`${dev.id}: la porta ${shortPort(base)} non esiste (porte: ${inv.map((x) => shortPort(x.name)).join(", ")})`, p.line ?? dev.line);
    }
    if (spec.type === "switch" && comp.rip) throw new PktmdError(`${dev.id}: rip non ha senso su uno switch`, dev.line);
    if (spec.type === "switch" && comp.ports.some((p) => p.ip && !/^Vlan\d+$/.test(p.name))) {
      throw new PktmdError(`${dev.id}: gli switch non hanno IP sulle porte fisiche (usa "ip A/n" per la gestione)`, dev.line);
    }
    const base = cfgLines(engine);
    const ctxPorts = inv.map((p) => ({
      name: p.name,
      serial: isSerialPort(p),
      dce: isSerialPort(p) && (dceOf.has(p.name) || !resolved.some((l) => (l.a.dev === dev.id && l.a.port === p.name) || (l.b.dev === dev.id && l.b.port === p.name))),
      duplex: spec.family === "isr" && p.module === "" && /Ethernet/.test(p.name),
      defaultShutdown: spec.type === "router",
    }));
    const lines = lowerIos(comp, base, { type: spec.type, ports: ctxPorts, vlan1: spec.family !== "ptrouter" });
    const withCli = comp.cli ? applyCli(lines, comp.cli, { dev, known: new Set(inv.map((p) => p.name)) }) : lines;
    setConfig(engine, withCli, true);
    syncPorts(inv, withCli);
    if (spec.type === "switch") writeVlans(engine, comp.vlans);
  }

  // ---- 4. identita' e posizioni
  const pos = layout ? autoLayout({ devices: network.devices, links: resolved }) : new Map();
  for (const b of built.values()) freshen(b.dn, b.dev.id, b.rng, pos.get(b.dev.id) ?? { x: 100, y: 100 });
  // il numero di serie cambia in freshen: ricalcolo la riga della licenza
  for (const b of built.values()) {
    if (b.spec.family === "host") continue;
    const sn = textOf(b.engine, "SERIALNUMBER");
    const rc = child(b.engine, "RUNNINGCONFIG");
    for (const t of ["RUNNINGCONFIG", "STARTUPCONFIG"]) {
      const n = child(b.engine, t);
      for (const l of childrenOf(n, "LINE")) l.text = (l.text ?? "").replace(/^(license udi pid \S+ sn ).*$/, `$1FTX${sn.slice(7, 11)}${sn.slice(3, 7)}-`);
    }
    void rc;
  }

  // ---- 5. cavi
  const linkNodes = [];
  for (const l of resolved) {
    const A = built.get(l.a.dev), B = built.get(l.b.dev);
    if (!A || !B) throw new PktmdError(`dispositivo "${(A ? l.b : l.a).dev}" inesistente`, l.line);
    const pa = A.inv.find((p) => p.name === l.a.port), pb = B.inv.find((p) => p.name === l.b.port);
    if (!pa) throw new PktmdError(`${l.a.dev}: la porta ${shortPort(l.a.port ?? "?")} non esiste (porte: ${A.inv.map((x) => shortPort(x.name)).join(", ")})`, l.line);
    if (!pb) throw new PktmdError(`${l.b.dev}: la porta ${shortPort(l.b.port ?? "?")} non esiste (porte: ${B.inv.map((x) => shortPort(x.name)).join(", ")})`, l.line);
    let kind = cableKind(pa, pb);
    if (!kind) kind = [A, B].filter((x) => x.spec.type === "switch").length === 1 ? "eCopper:eStraightThrough" : "eCopper:eCrossOver";
    const ln = clone(tpl.links.get(kind));
    const cable = child(ln, "CABLE");
    const refs = [A, B].map((x) => textOf(x.engine, "SAVE_REF_ID"));
    let pi = 0;
    for (const c of cable.children) {
      if (c.tag === "FROM") setText(c, refs[0]);
      else if (c.tag === "TO") setText(c, refs[1]);
      else if (c.tag === "PORT") setText(c, [pa, pb][pi++].name);
    }
    setChildText(cable, "FROM_DEVICE_MEM_ADDR", textOf(path(A.dn, "WORKSPACE/LOGICAL"), "DEV_ADDR"));
    setChildText(cable, "TO_DEVICE_MEM_ADDR", textOf(path(B.dn, "WORKSPACE/LOGICAL"), "DEV_ADDR"));
    setChildText(cable, "FROM_PORT_MEM_ADDR", memAddr(A.rng));
    setChildText(cable, "TO_PORT_MEM_ADDR", memAddr(B.rng));
    if (kind === "eSerial") {
      setChildText(cable, "DCEDEV", refs[0]);
      setChildText(cable, "DCEPORT", pa.name);
    }
    linkNodes.push(ln);
  }

  child(netNode, "DEVICES").children = [...built.values()].map((b) => b.dn);
  child(netNode, "LINKS").children = linkNodes;
  const guidRng = mulberry32(seedOf("vista-fisica:" + [...built.keys()].join(",")));
  placeDevices(root, [...built.values()].map((b) => b.dn), () => uuid(guidRng));
  // rete di sicurezza: un file incoerente verrebbe rifiutato da Packet Tracer ("file corrotto"), meglio fermarsi qui
  const problems = validateXml(root, { generated: true });
  if (problems.length) throw new Error(`Il file generato non e' coerente (errore di pktmd, non del testo): ${problems.slice(0, 4).join("; ")}`);
  return serializeXml(root);
}

/** riporta nei nodi PORT (dati strutturati) cio' che dice la configurazione finale */
function syncPorts(inv, lines) {
  for (const p of inv) {
    const i = lines.indexOf(`interface ${p.name}`);
    if (i < 0) continue;
    let j = i + 1;
    const body = [];
    while (j < lines.length && /^\s/.test(lines[j])) body.push(lines[j++].trim());
    const m = body.map((l) => /^ip address (\S+) (\S+)$/.exec(l)).find(Boolean);
    if (m) { setChildText(p.node, "IP", m[1]); setChildText(p.node, "SUBNET", m[2]); }
    else if (textOf(p.node, "IP")) {
      for (const t of ["IP", "SUBNET"]) { const c = child(p.node, t); if (c) { c.children = []; c.text = null; c.selfClosing = true; } }
    }
    setChildText(p.node, "POWER", body.includes("shutdown") ? "false" : "true");
    // porte seriali: Packet Tracer segna come "DCE" quelle che hanno il clock (lo correggerebbe da solo all'apertura)
    if (isSerialPort(p) && child(p.node, "CLOCKRATEFLAG")) {
      const ck = body.map((l) => /^clock rate (\d+)$/.exec(l)).find(Boolean);
      setChildText(p.node, "CLOCKRATEFLAG", ck ? "true" : "false");
      if (ck && child(p.node, "CLOCKRATE")) setChildText(p.node, "CLOCKRATE", ck[1]);
    }
  }
}

/** porte di un modello nuovo, per i controlli/anteprime fuori dalla generazione */
export async function portsFor(key) {
  return (await getTemplate()).portsOf(key);
}

/**
 * Da modello esplicito (letto da un .pkt) a modello minimo (quello che si scrive nel .pktmd).
 * @param info  la mappa restituita da fromXml
 */
export function simplifyNetwork(network, info) {
  const dce = new Set();
  for (const l of network.links) if (/^Serial/.test(l.a.port ?? "")) dce.add(`${l.a.dev}|${l.a.port}`);
  const devices = network.devices.map((d) => {
    const i = info.get(d.id);
    if (!i || i.spec.family === "host") return d;
    const copy = JSON.parse(JSON.stringify(d));
    for (const p of copy.ports) {
      if (p.clock !== undefined && (!dce.has(`${d.id}|${p.name}`) || p.clock === 2000000)) delete p.clock;
    }
    return simplify(copy, { type: i.spec.type, primary: i.inv[0]?.name });
  });
  return { ...network, devices };
}

/**
 * Informazioni per disegnare la rete: porte dei collegamenti risolte, tipo di cavo, modello di ogni dispositivo.
 * Non lancia mai: se qualcosa non torna, restituisce quello che riesce.
 * @returns {Promise<{links: object[], models: Map<string,string>}>}
 */
export async function describeNetwork(network) {
  const tpl = await getTemplate();
  const hw = new Map();
  const models = new Map();
  for (const d of network.devices) {
    try { const h = buildHardware(d, tpl); hw.set(d.id, h); models.set(d.id, h.spec.pt); } catch { /* hardware incoerente */ }
  }
  const byId = new Map(network.devices.map((d) => [d.id, d]));
  const resolved = resolveLinksSafe(network, (d) => hw.get(d.id)?.inv.map((p) => p.name) ?? [], (id) => byId.get(id));
  const links = resolved.map((l) => {
    const A = hw.get(l.a.dev), B = hw.get(l.b.dev);
    const pa = A?.inv.find((p) => p.name === l.a.port), pb = B?.inv.find((p) => p.name === l.b.port);
    let kind = "straight";
    try {
      const k = pa && pb ? cableKind(pa, pb) : null;
      if (k === "eSerial") kind = "serial";
      else if (k) kind = "fiber";
      else if (A && B) kind = [A, B].filter((x) => x.spec.type === "switch").length === 1 ? "straight" : "cross";
    } catch { /* cavo non valido: lo segnala toXml */ }
    return { ...l, kind };
  });
  return { links, models };
}
