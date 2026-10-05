// Hardware dei dispositivi: elenco delle porte (con i loro nomi IOS), installazione dei moduli, tipo di cavo.
import { child, childrenOf, textOf, clone, walkNodes } from "./xml.js";
import { prefixOfPortType, isFiberPortType, isSerialPortType, NICS, MODULE_ALIASES } from "./catalog.js";
import { PktmdError } from "./model.js";

const SINGLE_MODE_MODULES = new Set(["PT-ROUTER-NM-1FGE-SM", "HWIC-1GE-SFP"]);

/**
 * Porte di un dispositivo, nell'ordine in cui IOS le elenca.
 * @returns {{name:string, type:string, node:object, module:string, slot:number}[]}
 */
export function inventory(engine, spec) {
  const top = child(engine, "MODULE");
  const out = [];
  const portsOf = (mod) => childrenOf(mod, "PORT");
  const slotsOf = (mod) => childrenOf(mod, "SLOT");
  const push = (name, node, module, slot) => out.push({ name, type: textOf(node, "TYPE"), node, module, slot });

  if (spec.family === "host") {
    // sugli host il numero in fondo al nome e' lo slot del modulo (una fibra nello slot 1 si chiama GigabitEthernet1)
    slotsOf(top).forEach((s, si) => {
      const m = child(s, "MODULE");
      if (!m) return;
      for (const p of portsOf(m)) push(`${prefixOfPortType(textOf(p, "TYPE"))}${si}`, p, textOf(m, "MODEL"), si);
    });
  } else if (spec.family === "isr") {
    const builtin = child(slotsOf(top)[0], "MODULE");
    portsOf(builtin).forEach((p, i) => push(`${prefixOfPortType(textOf(p, "TYPE"))}0/${i}`, p, "", -1));
    slotsOf(builtin).forEach((s, si) => {
      const m = child(s, "MODULE");
      if (!m) return;
      portsOf(m).forEach((p, k) => push(`${prefixOfPortType(textOf(p, "TYPE"))}0/${si}/${k}`, p, textOf(m, "MODEL"), si));
    });
  } else if (spec.family === "ptrouter" || spec.family === "ptswitch") {
    const second = spec.family === "ptrouter" ? 0 : 1;
    slotsOf(top).forEach((s, si) => {
      const m = child(s, "MODULE");
      if (!m) return;
      for (const p of portsOf(m)) push(`${prefixOfPortType(textOf(p, "TYPE"))}${si}/${second}`, p, textOf(m, "MODEL"), si);
    });
  } else if (spec.family === "fixed") {
    const m = child(slotsOf(top)[0], "MODULE");
    const count = {};
    for (const p of portsOf(m)) {
      const pre = prefixOfPortType(textOf(p, "TYPE"));
      const n = (count[pre] = (count[pre] ?? 0) + 1);
      push(`${pre}0/${n}`, p, "", -1);
    }
  }
  return out;
}

/** i contenitori di slot in cui si possono infilare moduli (con il loro tipo) */
export function slotContainers(engine, spec) {
  const top = child(engine, "MODULE");
  if (spec.family === "isr") return childrenOf(child(childrenOf(top, "SLOT")[0], "MODULE"), "SLOT");
  if (spec.family === "ptrouter" || spec.family === "ptswitch" || spec.family === "host") return childrenOf(top, "SLOT");
  return [];
}

export const resolveModuleName = (token) => MODULE_ALIASES[token.toLowerCase()] ?? token;

/**
 * Installa un modulo nel primo slot libero compatibile (o in quello indicato).
 * @param lib  Map nome -> {slotType, node}
 */
export function installModule(engine, spec, name, lib, slotIndex) {
  const def = lib.get(name);
  if (!def) throw new PktmdError(`modulo sconosciuto "${name}" (disponibili: ${[...lib.keys()].join(", ")})`);
  const slots = slotContainers(engine, spec);
  const fits = (s) => textOf(s, "TYPE") === def.slotType;
  let target;
  if (slotIndex !== undefined) {
    target = slots[slotIndex];
    if (!target) throw new PktmdError(`lo slot ${slotIndex} non esiste (ce ne sono ${slots.length})`);
    if (!fits(target)) throw new PktmdError(`il modulo ${name} non entra nello slot ${slotIndex} (tipo ${textOf(target, "TYPE")})`);
    if (child(target, "MODULE")) throw new PktmdError(`lo slot ${slotIndex} e' gia' occupato`);
  } else {
    target = slots.find((s) => fits(s) && !child(s, "MODULE"));
    if (!target) throw new PktmdError(`nessuno slot libero per il modulo ${name}`);
  }
  target.children.push(clone(def.node));
  return slots.indexOf(target);
}

/** cambia la scheda di rete di un host (`pc gig`, `server fiber`) */
export function setNic(engine, spec, nic, lib, slotIndex = 0) {
  const name = NICS[nic];
  if (!name) throw new PktmdError(`scheda di rete sconosciuta "${nic}" (valide: ${Object.keys(NICS).join(", ")})`);
  const slots = slotContainers(engine, spec);
  const def = lib.get(name);
  const slot = slots[slotIndex];
  if (!slot || textOf(slot, "TYPE") !== def.slotType) throw new PktmdError(`la scheda ${nic} non entra nello slot ${slotIndex}`);
  slot.children = slot.children.filter((c) => c.tag !== "MODULE");
  slot.children.push(clone(def.node));
  // la scheda precedente, se era in un altro slot, va tolta
  for (const s of slots) if (s !== slot && child(s, "MODULE") && /PT-HOST-NM/.test(textOf(child(s, "MODULE"), "MODEL"))) s.children = s.children.filter((c) => c.tag !== "MODULE");
}

/** quale tipo di cavo serve tra due porte */
export function cableKind(a, b) {
  const as = isSerialPortType(a.type), bs = isSerialPortType(b.type);
  if (as || bs) {
    if (as && bs) return "eSerial";
    throw new PktmdError(`non si puo' collegare una porta seriale (${a.name}) con una non seriale (${b.name})`);
  }
  const af = isFiberPortType(a.type), bf = isFiberPortType(b.type);
  if (af || bf) {
    if (af && bf) return SINGLE_MODE_MODULES.has(a.module) || SINGLE_MODE_MODULES.has(b.module) ? "eFiber:eSingleMode" : "eFiber:eMultiMode";
    throw new PktmdError(`non si puo' collegare una porta in fibra (${(af ? a : b).name}) con una in rame (${(af ? b : a).name})`);
  }
  return null; // rame: dritto o incrociato dipende dai dispositivi
}

export const isFiberPort = (p) => isFiberPortType(p.type);
export const isSerialPort = (p) => isSerialPortType(p.type);
