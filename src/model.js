// Modello di rete in memoria + utilita` condivise (porte, IP, tipi di device).
//
// Network = {
//   devices: Device[],
//   links:   Link[],
// }
// Device = {
//   id, type, model?, hostname?, pos?:{x,y}, gw?, rip?:boolean, cli?:string,
//   ports: {name:string|null, ip?:string, prefix?:number}[],   // name null = porta principale (shorthand `ip`)
//   files: {name, content}[],                                   // file HTTP del server
//   line?                                                       // riga nel .pktmd (per gli errori)
// }
// Link = { a:{dev, port?}, b:{dev, port?}, line? }

export class PktmdError extends Error {
  constructor(message, line) {
    super(line ? `riga ${line}: ${message}` : message);
    this.line = line;
    this.rawMessage = message;
  }
}

// ---- tipi -----------------------------------------------------------------

export const TYPES = ["pc", "laptop", "server", "switch", "router"];

const ALIASES = {
  pc: "pc", laptop: "laptop", lap: "laptop", server: "server", srv: "server",
  switch: "switch", sw: "switch", router: "router", r: "router",
};
export const typeFromAlias = (word) => ALIASES[word.toLowerCase()];

/** `pc1`, `r2`, `Switch0`, `srv3` -> tipo; altrimenti undefined */
export function inferType(id) {
  const m = /^([A-Za-z]+)\d+$/.exec(id);
  return m ? typeFromAlias(m[1]) : undefined;
}

// ---- porte ----------------------------------------------------------------

const PORT_PREFIX = [
  ["FastEthernet", "fa", /^(fa|fastethernet)$/i],
  ["GigabitEthernet", "gi", /^(gi|gig|gigabitethernet)$/i],
  ["Serial", "se", /^(se|ser|serial)$/i],
  ["Ethernet", "eth", /^(eth|ethernet)$/i],
  ["Wireless", "wl", /^(wl|wireless)$/i],
  ["Vlan", "vlan", /^vlan$/i],
];
const PORT_RE = /^([A-Za-z]+)\s*(\d+(?:\/\d+)*(?:\.\d+)?)$/;

/** `fa0/1` | `FastEthernet0/1` -> `FastEthernet0/1`; undefined se non e` un nome di porta */
export function normalizePort(s) {
  const m = PORT_RE.exec(s);
  if (!m) return undefined;
  const p = PORT_PREFIX.find(([, , re]) => re.test(m[1]));
  return p ? p[0] + m[2] : undefined;
}
export const looksLikePort = (s) => normalizePort(s) !== undefined;

/** `FastEthernet0/1` -> `fa0/1` */
export function shortPort(name) {
  const m = PORT_RE.exec(name);
  const p = m && PORT_PREFIX.find(([long]) => long === m[1]);
  return p ? p[1] + m[2] : name;
}

// ---- IP -------------------------------------------------------------------

export const isIPv4 = (s) =>
  /^\d{1,3}(\.\d{1,3}){3}$/.test(s) && s.split(".").every((o) => +o <= 255);

export function maskToPrefix(mask) {
  if (!isIPv4(mask)) return undefined;
  const bits = mask.split(".").map((o) => (+o).toString(2).padStart(8, "0")).join("");
  return /^1*0*$/.test(bits) ? bits.indexOf("0") === -1 ? 32 : bits.indexOf("0") : undefined;
}

export function prefixToMask(p) {
  const bits = "1".repeat(p).padEnd(32, "0");
  return [0, 8, 16, 24].map((i) => parseInt(bits.slice(i, i + 8), 2)).join(".");
}

export function classfulPrefix(ip) {
  const first = +ip.split(".")[0];
  return first < 128 ? 8 : first < 192 ? 16 : 24;
}

/** indirizzo di rete di ip/prefix */
export function networkAddress(ip, prefix) {
  const m = prefixToMask(prefix).split(".").map(Number);
  return ip.split(".").map((o, i) => +o & m[i]).join(".");
}

// ---- aritmetica IPv4 -----------------------------------------------------------------------------------------------
export const ipToInt = (ip) => ip.split(".").reduce((a, o) => ((a << 8) | +o) >>> 0, 0);
export const intToIp = (n) => [24, 16, 8, 0].map((s) => (n >>> s) & 255).join(".");

/** 255.255.255.0 -> 0.0.0.255 */
export const prefixToWildcard = (p) => intToIp(~ipToInt(prefixToMask(p)) >>> 0);

/** 0.0.0.255 -> 24; undefined se il wildcard non e' contiguo */
export function wildcardToPrefix(wc) {
  if (!isIPv4(wc)) return undefined;
  return maskToPrefix(intToIp(~ipToInt(wc) >>> 0));
}

/** `ip` appartiene alla rete net/prefix? */
export function inNet(ip, net, prefix) {
  if (prefix === 0) return true;
  const m = (~0 << (32 - prefix)) >>> 0;
  return ((ipToInt(ip) & m) >>> 0) === ((ipToInt(net) & m) >>> 0);
}

/** rete classful (quella che compare nei `network` di RIP) */
export const classfulNetwork = (ip) => networkAddress(ip, classfulPrefix(ip));

/** "10.0.0.0/8" -> {net, prefix} */
export function parseCidr(s) {
  const [net, p] = s.split("/");
  if (!isIPv4(net)) return undefined;
  const prefix = p === undefined ? 32 : /^\d+$/.test(p) ? +p : NaN;
  if (!(prefix >= 0 && prefix <= 32)) return undefined;
  return { net, prefix };
}
