// Pulizia dello scheletro e dei telai presi da file di Packet Tracer reali.
//
// Un .pkt ha una "vista fisica" (citta' > edificio > ufficio > armadio > rack) con un nodo per ogni dispositivo:
// ogni dispositivo cita il proprio nodo con un identificativo, e ogni file ha identificativi casuali suoi.
// Se un dispositivo clonato da un altro file cita un nodo che nel nostro file non esiste, Packet Tracer
// dichiara il file corrotto. Per questo i dispositivi generati NON sono collocati nella vista fisica:
// e' lo stato che Packet Tracer stesso scrive per un dispositivo non collocato (`<PHYSICAL></PHYSICAL><PHYSICAL_CPUR/>`),
// funziona con tutte le versioni e non puo' avere riferimenti orfani ne' duplicati.
import { child, childrenOf, textOf } from "./xml.js";

/** TYPE dei nodi della vista fisica che rappresentano dispositivi */
const DEVICE_NODE = "6";

/** toglie dallo scheletro i nodi-dispositivo della vista fisica (restano citta', edificio, ufficio, armadio, rack) */
export function stripPhysicalDevices(root) {
  const pw = child(root, "PHYSICALWORKSPACE");
  if (!pw) return;
  const walk = (node) => {
    for (const holder of [node, child(node, "CHILDREN")].filter(Boolean)) {
      holder.children = holder.children.filter((c) => !(c.tag === "NODE" && textOf(c, "TYPE") === DEVICE_NODE));
      for (const c of childrenOf(holder, "NODE")) walk(c);
    }
  };
  walk(pw);
}

/** svuota i dati personali delle preferenze (file recenti, ...) */
export function cleanOptions(root) {
  const opts = child(root, "OPTIONS");
  const recent = opts && child(opts, "RECENT_FILES");
  if (recent) { recent.children = []; recent.text = null; recent.selfClosing = true; }
}

/** il dispositivo non e' collocato nella vista fisica */
export function unplace(dn) {
  const ws = child(dn, "WORKSPACE");
  if (!ws) return;
  const phys = child(ws, "PHYSICAL");
  if (phys) { phys.children = []; phys.text = ""; phys.selfClosing = false; }
  const cpur = child(ws, "PHYSICAL_CPUR");
  if (cpur) { cpur.children = []; cpur.text = null; cpur.selfClosing = true; }
}
