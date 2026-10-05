// Pulizia dello scheletro e dei telai presi da file di Packet Tracer reali.
//
// Un .pkt ha una "vista fisica" (citta' > edificio > ufficio > armadio > rack) con un nodo per ogni dispositivo:
// ogni dispositivo cita il proprio nodo con un percorso di identificativi, e ogni file ha identificativi casuali suoi.
// Se un dispositivo clonato da un altro file cita un nodo che nel nostro file non esiste, o non cita nulla,
// Packet Tracer dichiara il file corrotto ("File contains corrupted Physical Workspace data").
// Per questo si tolgono i nodi dei telai (`stripPhysicalDevices`) e, a file composto, si collocano tutti i dispositivi
// come fa Packet Tracer (`placeDevices`): PC nell'ufficio, apparati nell'armadio, ognuno col suo nodo e il suo percorso.
import { child, childrenOf, textOf, el } from "./xml.js";

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

/** il dispositivo non e' (ancora) collocato nella vista fisica: stato dei telai nei template */
export function unplace(dn) {
  const ws = child(dn, "WORKSPACE");
  if (!ws) return;
  const phys = child(ws, "PHYSICAL");
  if (phys) { phys.children = []; phys.text = ""; phys.selfClosing = false; }
  const cpur = child(ws, "PHYSICAL_CPUR");
  if (cpur) { cpur.children = []; cpur.text = null; cpur.selfClosing = true; }
}

// ---- collocazione nella vista fisica -------------------------------------------------------------
/** unita' occupate nell'armadio (ricavate dai file reali) */
const RACK_HEIGHT = { "2901": 8, "2911": 11, "1841": 8, "2960-24TT": 4, "2950-24": 4, "Router-PT": 7, "Router-PT-Empty": 7, "Switch-PT": 9, "Switch-PT-Empty": 9, "Server-PT": 16 };
const RACK_UNITS = 110;

function deviceNode(name, x, y, guid) {
  const t = (tag, v) => el(tag, String(v));
  const kids = el("CHILDREN", "");
  kids.text = null; kids.selfClosing = true;
  const n = el("NODE", "");
  n.text = null;
  n.children = [
    t("X", x), t("Y", y), t("TYPE", 6), el("NAME", name, [["translate", "true"]]),
    t("SX", "1e-05"), t("SY", "1e-05"), t("W", "0.001"), t("H", "0.001"), t("D", 0),
    el("PATH", "../art/Background/grid_100x100.png", [["isanim", "false"]]), kids,
    t("MANUAL_SCALING", "false"), t("SCALED_PIXMAP_WIDTH", 0), t("SCALED_PIXMAP_HEIGHT", 0),
    t("INIT_WIDTH", "0.001"), t("INIT_HEIGHT", "0.001"), t("INIT_DEPTH", 0),
    t("INIT_SX", "1e-05"), t("INIT_SY", "1e-05"), t("INIT_SZ", "1e-05"),
    t("BG_TILED", "false"), t("CUSTOM_IMAGE_WIDTH", -1), t("CUSTOM_IMAGE_HEIGHT", -1), t("SCALE_FACTOR", 1),
    t("UUID_STR", guid), t("SLOT", 0), t("SUB_SLOT", 0), t("ICP_CSX", 0), t("ICP_CSY", 0),
  ];
  return n;
}

/**
 * Colloca tutti i dispositivi (`devices`: nodi DEVICE) nella vista fisica dello scheletro.
 * @param {() => string} newGuid  genera un GUID nel formato `{...}`
 */
export function placeDevices(root, devices, newGuid) {
  const pw = child(root, "PHYSICALWORKSPACE");
  const holderOf = (node) => [node, child(node, "CHILDREN")].filter(Boolean);
  const found = {};
  const go = (node, acc) => {
    for (const h of holderOf(node)) {
      for (const c of childrenOf(h, "NODE")) {
        const p = [...acc, textOf(c, "UUID_STR")];
        const type = textOf(c, "TYPE");
        if ((type === "2" || type === "4") && !found[type]) found[type] = { node: c, path: p };
        go(c, p);
      }
    }
  };
  go(pw, []);
  const office = found["2"], rack = found["4"];
  if (!office || !rack) throw new Error("lo scheletro non ha ufficio e armadio nella vista fisica");
  for (const z of [office, rack]) {
    const k = child(z.node, "CHILDREN");
    k.selfClosing = false; k.text = null;
  }

  let nextRack = 4, nextOffice = 0;
  for (const dn of devices) {
    const eng = child(dn, "ENGINE");
    const name = textOf(eng, "NAME");
    const model = child(eng, "TYPE")?.attrs.find(([k]) => k === "model")?.[1] ?? "";
    const height = RACK_HEIGHT[model] ?? 8;
    const inRack = model !== "PC-PT" && nextRack + height <= RACK_UNITS;
    const guid = newGuid();
    let x, y, zone;
    if (inRack) { x = nextRack; y = 0; nextRack += height; zone = rack; }
    else { x = 86 * ((nextOffice % 10) + 1); y = 215 + 100 * Math.floor(nextOffice / 10); nextOffice++; zone = office; }
    child(zone.node, "CHILDREN").children.push(deviceNode(name, x, y, guid));

    const ws = child(dn, "WORKSPACE");
    const phys = child(ws, "PHYSICAL");
    phys.children = []; phys.text = [...zone.path, guid].join(","); phys.selfClosing = false;
    const cpur = child(ws, "PHYSICAL_CPUR");
    const f = (tag, v) => el(tag, String(v));
    cpur.selfClosing = false; cpur.text = null;
    cpur.children = [
      f("X_PN", inRack ? 0.1 : +(x / 2000).toFixed(5)), f("Y_PN", inRack ? 0.05 : +(y / 2000).toFixed(5)), f("X", x), f("Y", y),
      f("SLOT", 0), f("SUBSLOT", 0), f("PARENT_PATH", zone.path.join(",")), f("CONTAINER_ID", zone.path[zone.path.length - 1]),
      f("ICP_CONTAINER_SCENE_X", 0), f("ICP_CONTAINER_SCENE_Y", 0), f("ORIGINAL_DEVICE_UUID", newGuid()),
    ];
  }
}
