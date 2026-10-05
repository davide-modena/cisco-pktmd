// Costruisce src/template-data.js: lo scheletro di un file PT 9.0 + un telaio "pulito" per ogni modello
// supportato + la libreria dei moduli + un cavo di esempio per tipo. Tutto estratto da file .pkt reali
// (samples/ e examples/) e normalizzato ai default di Packet Tracer.
//
//   node scripts/build-templates.mjs
//
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { decodePkt } from "../src/pkt.js";
import {
  parseXml, serializeXml, child, childrenOf, textOf, attr, path, setChildText, setText, el, clone, walkNodes, unescapeXml,
} from "../src/xml.js";
import { MODELS } from "../src/catalog.js";
import { stripPhysicalDevices, cleanOptions, unplace } from "../src/skeleton.js";

// file generati da questo progetto: non sono sorgenti affidabili
const EXCLUDE = new Set(["rete-base.pkt", "vlan.pkt"]);
const dirs = ["samples", "examples"];

// ---- carica tutti i .pkt -------------------------------------------------------------------------------------
const files = [];
for (const dir of dirs) {
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".pkt") && !EXCLUDE.has(f))) {
    const root = parseXml(await decodePkt(new Uint8Array(readFileSync(`${dir}/${f}`))));
    const ver = textOf(root, "VERSION");
    files.push({ name: f, root, ver, v9: ver.startsWith("9.") });
  }
}
if (!files.length) {
  console.error("Servono dei .pkt di Packet Tracer in samples/ e examples/ (non sono inclusi nel repository).");
  console.error("Il template gia' pronto e' src/template-data.js: ricostruirlo serve solo per aggiungere modelli.");
  process.exit(1);
}
console.log(files.length, "file letti");

const devsOf = (root) => childrenOf(child(child(root, "NETWORK"), "DEVICES"), "DEVICE");
const engineOf = (d) => child(d, "ENGINE");
const modelOf = (d) => attr(child(engineOf(d), "TYPE"), "model");
const portsIn = (nd) => [...walkNodes(nd)].filter((n) => n.tag === "PORT");
const cfgOf = (d) => childrenOf(child(engineOf(d), "RUNNINGCONFIG"), "LINE").map((l) => unescapeXml(l.text ?? ""));

// ---- descrizione della struttura dei moduli ("firma") per scegliere i campioni ---------------------------------
function sig(mod) {
  const mm = textOf(mod, "MODEL");
  const slots = childrenOf(mod, "SLOT").map((s) => { const m = child(s, "MODULE"); return m ? sig(m) : "."; });
  const np = childrenOf(mod, "PORT").length;
  return `${mm}${np ? "#" + np : ""}${slots.length ? "[" + slots.join(",") + "]" : ""}`;
}
const topSig = (d) => sig(child(engineOf(d), "MODULE"));

function pick(spec) {
  const cands = [];
  for (const f of files) for (const d of devsOf(f.root)) {
    if (modelOf(d) !== spec.pt) continue;
    if (spec.sig && !spec.sig.test(topSig(d))) continue;
    cands.push({ f, d, score: (f.v9 ? 1000 : 0) + (f.ver.startsWith("8.2") ? 100 : 0) - cfgOf(d).filter((l) => /ip address|^router|ip nat|access-list|switchport|^vlan/.test(l)).length });
  }
  cands.sort((a, b) => b.score - a.score);
  if (!cands.length) throw new Error(`nessun campione per ${spec.key} (${spec.pt})`);
  return cands[0];
}

// ---- normalizzazione ai default -------------------------------------------------------------------------------
function blank(nd, tag) {
  const c = child(nd, tag);
  if (c) { c.children = []; c.text = null; c.selfClosing = true; }
}

const FEATURE_HEAD = /^(router |ip nat|ip route|access-list|ip access-list|ip dhcp|ip name-server|ip domain|ip default-gateway|enable |username|ip ssh|banner|vlan |crypto|aaa|logging|ntp|snmp|ip routing|key |ip http|ip helper|ip forward|ip flow|service password|ipv6 unicast)/;

function parseBlocks(lines) {
  const blocks = [];
  let cur = null;
  for (const l of lines) {
    if (!l.trim() || l.trim() === "!") { cur = null; continue; }
    if (/^\s/.test(l)) { cur?.body.push(l); continue; }
    cur = { head: l, body: [] };
    blocks.push(cur);
  }
  return blocks;
}

/** config "vuota": solo il boilerplate della piattaforma */
function baseConfig(lines) {
  const blocks = parseBlocks(lines).filter((b) => b.head !== "end");
  const out = [];
  const isFeature = (h) => FEATURE_HEAD.test(h) && !/^ip flow-export/.test(h);
  for (const b of blocks) {
    if (isFeature(b.head)) continue;
    if (/^interface /.test(b.head)) continue; // le interfacce si rigenerano dalle porte
    if (/^hostname /.test(b.head)) { out.push(b.head === "hostname Switch" || b.head === "hostname Router" ? b.head : "hostname " + (/Switch|2960|2950/.test(process.env.__KIND ?? "") ? "Switch" : "Router"), "!"); continue; }
    if (/^line /.test(b.head)) { out.push(b.head, ...b.body.filter((l) => l === " login"), "!"); continue; }
    out.push(b.head, ...b.body, "!");
  }
  return out;
}

function resetHostPorts(engine) {
  for (const pn of portsIn(child(engine, "MODULE"))) for (const t of ["IP", "SUBNET", "PORT_GATEWAY"]) blank(pn, t);
  blank(engine, "GATEWAY");
}

// valori "di fabbrica" dei servizi: il piu' frequente tra tutte le istanze
function modalNodes(modelName, tags) {
  const counts = {};
  for (const f of files) for (const d of devsOf(f.root)) {
    if (modelOf(d) !== modelName) continue;
    for (const t of tags) {
      const n = child(engineOf(d), t);
      if (!n) continue;
      const s = serializeXml(n).replace(/\d+\.\d+\.\d+\.\d+/g, "IP");
      const m = (counts[t] ??= new Map());
      const e = m.get(s) ?? { n: 0, node: n };
      e.n++;
      m.set(s, e);
    }
  }
  return Object.fromEntries(Object.entries(counts).map(([t, m]) => [t, [...m.values()].sort((a, b) => b.n - a.n)[0].node]));
}

function replaceChild(engine, node) {
  const i = engine.children.findIndex((c) => c.tag === node.tag);
  if (i >= 0) engine.children[i] = clone(node);
}

// ---- costruzione ---------------------------------------------------------------------------------------------
const out = { models: [], modules: new Map(), links: new Map() };
const ref9 = (() => { const f = files.find((f) => f.v9 && devsOf(f.root).some((d) => modelOf(d) === "2901")); return devsOf(f.root).find((d) => modelOf(d) === "2901"); })();

/** porta un dispositivo di una vecchia versione al formato 9.0 aggiungendo i tag mancanti */
function upgrade(dn) {
  const e = engineOf(dn), r = engineOf(ref9);
  const have = new Set(e.children.map((c) => c.tag));
  for (const [i, c] of r.children.entries()) {
    if (have.has(c.tag)) continue;
    // inserisce dopo il fratello precedente presente in entrambi
    let at = 0;
    for (let k = i - 1; k >= 0; k--) { const idx = e.children.findIndex((x) => x.tag === r.children[k].tag); if (idx >= 0) { at = idx + 1; break; } }
    e.children.splice(at, 0, clone(c));
  }
}

const hostModal = modalNodes("PC-PT", ["EMAIL_CLIENT", "DNS_CLIENT", "DHCP_CLIENT", "WIRELESS_CLIENT"]);
const srvModal = modalNodes("Server-PT", ["DNS_SERVER", "DHCP_SERVERS", "EMAIL_SERVER", "HTTP_SERVER", "HTTPS_SERVER", "NTP_SERVER", "DNS_CLIENT"]);

const KIND_OF = { pc: "host", server: "host", router: "router", switch: "switch" };

for (const spec of Object.values(MODELS)) {
  const { f, d } = pick(spec);
  const dn = clone(d);
  if (!f.v9) upgrade(dn);
  const e = engineOf(dn);
  process.env.__KIND = spec.pt;

  // identita'
  setChildText(e, "NAME", spec.key.replace(/[^A-Za-z0-9]/g, ""));
  if (spec.type === "pc" || spec.type === "server") {
    resetHostPorts(e);
    for (const t of ["EMAIL_CLIENT", "DNS_CLIENT", "DHCP_CLIENT"]) if (hostModal[t] && child(e, t)) replaceChild(e, hostModal[t]);
    if (spec.type === "server") for (const t of Object.keys(srvModal)) if (child(e, t)) replaceChild(e, srvModal[t]);
    for (const pn of portsIn(child(e, "MODULE"))) { setChildText(pn, "PORT_DHCP_ENABLE", "false"); blank(pn, "PORT_DNS"); }
    // i valori "piu' comuni" possono contenere indirizzi dell'esempio: azzera tutto
    blank(child(e, "DNS_CLIENT"), "SERVER_IP");
    const pool = path(e, "DHCP_SERVERS/ASSOCIATED_PORTS/ASSOCIATED_PORT/DHCP_SERVER/POOLS/POOL");
    if (pool) {
      for (const t of ["NETWORK", "DEFAULT_ROUTER", "TFTP_ADDRESS", "START_IP", "END_IP", "DNS_SERVER", "WLC_ADDRESS"]) setChildText(pool, t, "0.0.0.0");
      setChildText(pool, "MASK", "255.255.255.0");
      setChildText(pool, "MAX_USERS", "512");
    }
    const assoc = path(e, "DHCP_SERVERS/ASSOCIATED_PORTS/ASSOCIATED_PORT");
    void assoc;
  } else {
    // spegni e svuota tutto; la config si rigenera dal modello
    const base = baseConfig(cfgOf(dn));
    const rc = child(e, "RUNNINGCONFIG");
    rc.children = base.map((l) => el("LINE", l));
    rc.text = null; rc.selfClosing = false;
    const su = child(e, "STARTUPCONFIG");
    if (su) { su.children = []; su.text = ""; su.selfClosing = false; }
    const vl = child(e, "VLANS");
    if (vl) vl.children = vl.children.filter((v) => ["1", "1002", "1003", "1004", "1005"].includes(attr(v, "number")));
    const vtp = child(e, "VTP");
    if (vtp) setChildText(vtp, "CONFIG_REVISION", "0");
  }

  // spazio per i moduli: svuota gli slot indicati dalla specifica
  if (spec.emptySlots) {
    for (const s of [...walkNodes(child(e, "MODULE"))].filter((n) => n.tag === "SLOT")) {
      if (child(s, "MODULE") && spec.emptySlots(s)) s.children = s.children.filter((c) => c.tag !== "MODULE");
    }
  }
  out.models.push({ spec, dn, from: `${f.name}` });
  console.log(`  ${spec.key.padEnd(14)} <- ${f.name} (${f.ver}) ${topSig(dn).slice(0, 100)}`);
}

// ---- libreria dei moduli ---------------------------------------------------------------------------------------
const modFrom = new Map();
for (const f of files) {
  for (const d of devsOf(f.root)) {
    if (!/^(PC-PT|Server-PT|2901|2911|1841|Router-PT|Router-PT-Empty|Switch-PT|Switch-PT-Empty)$/.test(modelOf(d))) continue;
    for (const s of [...walkNodes(child(engineOf(d), "MODULE"))].filter((n) => n.tag === "SLOT")) {
      const m = child(s, "MODULE");
      const mm = m && textOf(m, "MODEL");
      if (!mm || modFrom.has(mm) && modFrom.get(mm).v9) continue;
      if (mm === "GLC-LH-SMD" || /^Linksys/.test(mm)) continue;      // il transceiver viaggia dentro l'HWIC
      modFrom.set(mm, { slotType: textOf(s, "TYPE"), node: m, v9: f.v9 });
    }
  }
}
for (const [name, { slotType, node }] of modFrom) {
  const m = clone(node);
  out.modules.set(name, { slotType, node: m, ports: portsIn(m).map((p) => textOf(p, "TYPE")) });
}
console.log("moduli:", [...out.modules.keys()].join(", "));

// ---- cavi ---------------------------------------------------------------------------------------------------------
for (const f of files) {
  if (!f.v9) continue;
  for (const l of childrenOf(child(child(f.root, "NETWORK"), "LINKS"), "LINK")) {
    const lt = textOf(l, "TYPE");
    const cable = child(l, "CABLE");
    const ct = cable.children.filter((c) => c.tag === "TYPE").map((c) => c.text).pop() ?? "";
    const key = lt + (ct && lt !== "eSerial" ? ":" + ct : "");
    if (!["eCopper:eStraightThrough", "eCopper:eCrossOver", "eFiber:eMultiMode", "eFiber:eSingleMode", "eSerial"].includes(key)) continue;
    if (!out.links.has(key)) out.links.set(key, clone(l));
  }
}
{
  // incrociato e seriale arrivano da versioni vecchie: si derivano dal cavo dritto 9.0
  const straight = out.links.get("eCopper:eStraightThrough");
  const lastType = (l) => child(l, "CABLE").children.filter((c) => c.tag === "TYPE").pop();
  const cross = clone(straight);
  setText(lastType(cross), "eCrossOver");
  out.links.set("eCopper:eCrossOver", cross);
  const serial = clone(straight);
  setText(child(serial, "TYPE"), "eSerial");
  const cable = child(serial, "CABLE");
  cable.children.splice(cable.children.indexOf(lastType(serial)), 1);
  setChildText(cable, "GEO_VIEW_COLOR", "#1e59a5");
  setChildText(cable, "IS_MANAGED_IN_RACK_VIEW", "true");
  cable.children.push(el("DCEDEV", ""), el("DCEPORT", ""));
  out.links.set("eSerial", serial);
}
console.log("cavi:", [...out.links.keys()].join(", "));

// ---- scheletro ---------------------------------------------------------------------------------------------------
const skelFile = files.find((f) => f.name === "cisco 9.0.pkt");
const skel = clone(skelFile.root);
child(child(skel, "NETWORK"), "DEVICES").children = [];
child(child(skel, "NETWORK"), "LINKS").children = [];
const logs = child(skel, "COMMAND_LOGS");
if (logs) { logs.children = []; logs.selfClosing = true; logs.text = null; }
// niente nodi di dispositivi nella vista fisica e niente dati personali (file recenti di chi ha creato il campione)
stripPhysicalDevices(skel);
cleanOptions(skel);
for (const { dn } of out.models) unplace(dn);

// ---- contenitore ------------------------------------------------------------------------------------------------
const wrap = (tag, attrs, kids) => ({ tag, attrs, children: kids, text: null, selfClosing: false });
const root = wrap("TEMPLATES", [["version", "2"]], [
  wrap("SKELETON", [], [skel]),
  ...out.models.map(({ spec, dn, from }) => wrap("MODEL", [["key", spec.key], ["from", from]], [dn])),
  ...[...out.modules].map(([name, m]) => wrap("MODULEDEF", [["name", name], ["slotType", m.slotType]], [m.node])),
  ...[...out.links].map(([key, l]) => wrap("LINKDEF", [["key", key]], [l])),
]);
const xml = serializeXml(root);
const b64 = deflateSync(Buffer.from(xml, "utf8"), { level: 9 }).toString("base64");
writeFileSync("src/template-data.js", `// GENERATO da scripts/build-templates.mjs - non modificare a mano\nexport default "${b64}";\n`);
console.log(`src/template-data.js: ${xml.length} byte di XML -> ${b64.length} caratteri base64`);
