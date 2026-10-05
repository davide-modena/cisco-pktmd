// Catalogo dei modelli di dispositivo supportati.
// I telai veri (XML) arrivano da template-data.js, costruito da file .pkt reali (scripts/build-templates.mjs).

/**
 * key      identificativo interno
 * type     pc | server | router | switch
 * pt       nome del modello in Packet Tracer (attributo `model`)
 * token    come si scrive nel .pktmd dopo il tipo (`r1: router 2911`); "" = modello di default del tipo
 * family   host | isr | ptrouter | ptswitch | fixed   (decide come si chiamano le porte)
 * sig      regex sulla "firma" dei moduli per scegliere il campione giusto (solo build)
 * emptySlots(slot)  slot da svuotare nel template (solo build)
 */
export const MODELS = {
  pc: { key: "pc", type: "pc", pt: "PC-PT", token: "", family: "host" },
  server: { key: "server", type: "server", pt: "Server-PT", token: "", family: "host" },
  r2901: { key: "r2901", type: "router", pt: "2901", token: "2901", family: "isr", emptySlots: (s) => slotTypeOf(s) === "eInterfaceCard" },
  r2911: { key: "r2911", type: "router", pt: "2911", token: "2911", family: "isr", emptySlots: (s) => slotTypeOf(s) === "eInterfaceCard" },
  r1841: { key: "r1841", type: "router", pt: "1841", token: "1841", family: "isr", emptySlots: (s) => slotTypeOf(s) === "eInterfaceCard" },
  rpt: { key: "rpt", type: "router", pt: "Router-PT", token: "pt", family: "ptrouter", sig: /^\[PT-ROUTER-NM-1CFE#1,PT-ROUTER-NM-1CFE#1,PT-ROUTER-NM-1S#1/ },
  rempty: { key: "rempty", type: "router", pt: "Router-PT-Empty", token: "empty", family: "ptrouter", emptySlots: () => true },
  s2960: { key: "s2960", type: "switch", pt: "2960-24TT", token: "2960", family: "fixed" },
  s2950: { key: "s2950", type: "switch", pt: "2950-24", token: "2950", family: "fixed" },
  spt: { key: "spt", type: "switch", pt: "Switch-PT", token: "pt", family: "ptswitch" },
  sempty: { key: "sempty", type: "switch", pt: "Switch-PT-Empty", token: "empty", family: "ptswitch", emptySlots: () => true },
};

function slotTypeOf(slot) {
  const t = slot.children.find((c) => c.tag === "TYPE");
  return t?.text ?? "";
}

/** modello usato quando non se ne scrive uno */
export const DEFAULT_MODEL = { pc: "pc", server: "server", router: "r2901", switch: "s2960" };

export const MODEL_BY_PT = Object.fromEntries(Object.values(MODELS).map((m) => [m.pt, m]));

/** `router 2911` -> modello; undefined se non esiste */
export function modelFromToken(type, token) {
  if (!token) return MODELS[DEFAULT_MODEL[type]];
  const t = token.toLowerCase();
  return Object.values(MODELS).find((m) => m.type === type && (m.token || "").toLowerCase() === t);
}

export function tokensFor(type) {
  return Object.values(MODELS).filter((m) => m.type === type && m.token).map((m) => m.token);
}

// ---- schede di rete dei host: `pc gig`, `server fiber` ----------------------------------------------------------
export const NICS = {
  fa: "PT-HOST-NM-1CFE",
  gig: "PT-HOST-NM-1CGE",
  fiber: "PT-HOST-NM-1FGE",
};

// ---- moduli --------------------------------------------------------------------------------------------------------
/** nomi brevi per i moduli piu' comuni (`module serial`) */
export const MODULE_ALIASES = {
  serial: "HWIC-2T",
  "hwic-2t": "HWIC-2T",
  sfp: "HWIC-1GE-SFP",
  fiber: "HWIC-1GE-SFP",
  "hwic-1ge-sfp": "HWIC-1GE-SFP",
  // moduli dei Router-PT / Switch-PT
  "r-fe": "PT-ROUTER-NM-1CFE",
  "r-ge": "PT-ROUTER-NM-1CGE",
  "r-fiber": "PT-ROUTER-NM-1FGE",
  "r-fiber-sm": "PT-ROUTER-NM-1FGE-SM",
  "r-fiber-fe": "PT-ROUTER-NM-1FFE",
  "r-serial": "PT-ROUTER-NM-1S",
  "s-fe": "PT-SWITCH-NM-1CFE",
  "s-ge": "PT-SWITCH-NM-1CGE",
  "s-fiber": "PT-SWITCH-NM-1FGE",
  "s-fiber-fe": "PT-SWITCH-NM-1FFE",
};

/** moduli presenti nei telai "Router-PT"/"Switch-PT" appena creati */
export const DEFAULT_MODULES = {
  rpt: ["PT-ROUTER-NM-1CFE", "PT-ROUTER-NM-1CFE", "PT-ROUTER-NM-1S", "PT-ROUTER-NM-1S", "PT-ROUTER-NM-1FFE", "PT-ROUTER-NM-1FFE"],
  spt: ["PT-SWITCH-NM-1CFE", "PT-SWITCH-NM-1CFE", "PT-SWITCH-NM-1CFE", "PT-SWITCH-NM-1CFE", "PT-SWITCH-NM-1FFE", "PT-SWITCH-NM-1FFE"],
};

// ---- nomi delle porte -------------------------------------------------------------------------------------------------
const PREFIX = {
  eCopperFastEthernet: "FastEthernet",
  eFiberFastEthernet: "FastEthernet",
  eCopperGigabitEthernet: "GigabitEthernet",
  eFiberGigabitEthernet: "GigabitEthernet",
  eSerial: "Serial",
  eSmartSerial: "Serial",
};
export const prefixOfPortType = (t) => PREFIX[t] ?? "FastEthernet";
export const isFiberPortType = (t) => /Fiber/.test(t);
export const isSerialPortType = (t) => /Serial/.test(t);
