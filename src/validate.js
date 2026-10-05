// Controllo di coerenza di un XML di Packet Tracer: cerca i difetti per cui il programma dichiara "file corrotto"
// (riferimenti a oggetti che non esistono, identificativi duplicati) senza doverlo aprire.
import { parseXml, child, childrenOf, textOf, walkNodes } from "./xml.js";

const GUID = /\{[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\}/g;

/**
 * @param {string|object} xml  testo o albero gia' letto
 * @param {{generated?: boolean}} [opts]  `generated`: file prodotto da pktmd (controlli in piu', sui dati personali)
 * @returns {string[]} problemi trovati (vuoto = coerente)
 */
export function validateXml(xml, { generated = false } = {}) {
  const root = typeof xml === "string" ? parseXml(xml) : xml;
  const problems = [];
  const net = child(root, "NETWORK");
  const devices = childrenOf(child(net, "DEVICES"), "DEVICE");

  // ---- vista fisica: ogni riferimento di un dispositivo deve esistere nell'albero
  const known = new Set();
  const pw = child(root, "PHYSICALWORKSPACE");
  if (pw) for (const n of walkNodes(pw)) if (n.tag === "UUID_STR" && n.text) known.add(n.text.toLowerCase());
  for (const d of devices) {
    const name = textOf(child(d, "ENGINE"), "NAME");
    const phys = textOf(child(d, "WORKSPACE"), "PHYSICAL");
    for (const g of phys.match(GUID) ?? []) {
      if (!known.has(g.toLowerCase())) problems.push(`${name}: la vista fisica cita ${g}, che non esiste nel file`);
    }
  }
  // nodi-dispositivo della vista fisica senza un dispositivo che li usi non sono un errore; due dispositivi sullo stesso nodo si'
  const usedNode = new Map();
  for (const d of devices) {
    const phys = textOf(child(d, "WORKSPACE"), "PHYSICAL");
    const last = (phys.match(GUID) ?? []).pop();
    if (!last) continue;
    const name = textOf(child(d, "ENGINE"), "NAME");
    if (usedNode.has(last.toLowerCase())) problems.push(`${name} e ${usedNode.get(last.toLowerCase())} sono sullo stesso nodo fisico ${last}`);
    usedNode.set(last.toLowerCase(), name);
  }

  // ---- identificativi unici
  const dup = (what, values) => {
    const seen = new Map();
    for (const [name, v] of values) {
      if (!v) continue;
      if (seen.has(v)) problems.push(`${what} duplicato (${v}): ${seen.get(v)} e ${name}`);
      else seen.set(v, name);
    }
  };
  const eng = (d) => child(d, "ENGINE");
  dup("nome", devices.map((d) => [textOf(eng(d), "NAME"), textOf(eng(d), "NAME")]));
  dup("SAVE_REF_ID", devices.map((d) => [textOf(eng(d), "NAME"), textOf(eng(d), "SAVE_REF_ID")]));
  dup("DEV_ADDR", devices.map((d) => [textOf(eng(d), "NAME"), textOf(child(d, "WORKSPACE") && child(child(d, "WORKSPACE"), "LOGICAL"), "DEV_ADDR")]));
  dup("MEM_ADDR", devices.map((d) => [textOf(eng(d), "NAME"), textOf(child(d, "WORKSPACE") && child(child(d, "WORKSPACE"), "LOGICAL"), "MEM_ADDR")]));
  dup("numero di serie", devices.map((d) => [textOf(eng(d), "NAME"), textOf(eng(d), "SERIALNUMBER")]));
  // MAC: ogni dispositivo ne ha uno per porta (alcune porte seriali lo condividono), ma fra dispositivi non devono ripetersi
  const macOwner = new Map();
  for (const d of devices) {
    const name = textOf(eng(d), "NAME");
    const mine = new Set();
    for (const n of walkNodes(eng(d))) if (n.tag === "MACADDRESS" && n.text) mine.add(n.text);
    for (const m of mine) {
      if (macOwner.has(m) && macOwner.get(m) !== name) problems.push(`MAC duplicato (${m}): ${macOwner.get(m)} e ${name}`);
      macOwner.set(m, name);
    }
  }

  // ---- collegamenti: gli estremi devono esistere
  const refs = new Set(devices.map((d) => textOf(eng(d), "SAVE_REF_ID")).filter(Boolean));
  const byIndex = devices.length;
  for (const l of childrenOf(child(net, "LINKS"), "LINK")) {
    const c = child(l, "CABLE");
    if (!c) { problems.push("collegamento senza CABLE"); continue; }
    for (const tag of ["FROM", "TO", "DCEDEV"]) {
      const v = textOf(c, tag);
      if (!v) continue;
      const ok = refs.size ? refs.has(v) : /^\d+$/.test(v) && +v < byIndex;
      if (!ok) problems.push(`collegamento: ${tag} ${v} non e' un dispositivo del file`);
    }
  }

  // ---- gruppi (cluster)
  const clusters = new Set();
  const cl = child(root, "CLUSTERS");
  if (cl) for (const n of walkNodes(cl)) if (n.tag === "CLUSTERID" && n.text) clusters.add(n.text);
  for (const d of devices) {
    const id = textOf(child(d, "WORKSPACE") && child(child(d, "WORKSPACE"), "LOGICAL"), "DEVCLUSTERID");
    if (id && clusters.size && !clusters.has(id)) problems.push(`${textOf(eng(d), "NAME")}: gruppo ${id} inesistente`);
  }

  // ---- dati personali che non devono finire nei file generati
  const opts = child(root, "OPTIONS");
  const recent = opts && child(opts, "RECENT_FILES");
  if (generated && recent && recent.children.length) problems.push("l'elenco dei file recenti non e' vuoto");
  return problems;
}
