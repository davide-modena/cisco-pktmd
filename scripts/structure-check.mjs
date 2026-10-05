// Confronta, campo per campo, un dispositivo generato con uno vero dello stesso modello.
//   node scripts/structure-check.mjs
import { readFileSync } from "node:fs";
import { decodePkt } from "../src/pkt.js";
import { parseXml, child, childrenOf, textOf, attr } from "../src/xml.js";
import { pktmdToPkt } from "../src/index.js";

const RANDOM = /MACADDRESS|\/BIA|LINK_LOCAL|SERIALNUMBER|SAVE_REF_ID|MEM_ADDR|DEV_ADDR|UUID|DUID|STARTTIME|STARTSIMTIME|PTP_CLOCK|CREATE_TIME|BUILD_IN_ADDR|\/X#|\/Y#|X_COORD|Y_COORD|COORD_SETTINGS|CUSTOM_VARS|ORIGINAL_DEVICE/;

function leaves(nd, p, out, cnt = {}) {
  const q = p + "/" + nd.tag;
  if (!nd.children.length) out.set(q + "#" + (cnt[q] = (cnt[q] || 0) + 1), nd.text);
  else for (const c of nd.children) leaves(c, q, out, cnt);
  return out;
}
const devs = (root) => childrenOf(child(child(root, "NETWORK"), "DEVICES"), "DEVICE");
const modelOf = (d) => attr(child(child(d, "ENGINE"), "TYPE"), "model");

const load = async (f) => parseXml(await decodePkt(new Uint8Array(readFileSync(f))));

const text = `
r1: router 2911
  module serial
  module serial
  gi0/0 192.168.1.254/24
  se0/0/0 10.0.0.1/30
  rip
sw1: switch
  vlan 10 rosso
  fa0/1-4 access 10
pc1:
  ip 192.168.1.1/24
  gw 192.168.1.254
srv1:
  ip 192.168.1.2/24
  gw 192.168.1.254
  dns on
  a www.test.it 192.168.1.2
links:
  pc1 sw1
  srv1 sw1
  sw1 r1
`;

const gen = parseXml((await pktmdToPkt(text)).xml);
const refs = {
  "2911": ["examples/esercizio_dns3.pkt", "2911"],
  "2960-24TT": ["examples/esempiNAT.pkt", "2960-24TT"],
  "PC-PT": ["examples/esempiNAT.pkt", "PC-PT"],
  "Server-PT": ["examples/esempiNAT.pkt", "Server-PT"],
};
for (const g of devs(gen)) {
  const m = modelOf(g);
  const [file, model] = refs[m] ?? [];
  if (!file) continue;
  const ref = devs(await load(file)).find((d) => modelOf(d) === model);
  const A = leaves(ref, "", new Map()), B = leaves(g, "", new Map());
  const only = (X, Y) => [...X.keys()].filter((k) => !Y.has(k) && !RANDOM.test(k));
  const missing = only(A, B), extra = only(B, A);
  // valori diversi su campi non attesi
  const diff = [...A].filter(([k, v]) => B.has(k) && B.get(k) !== v && !RANDOM.test(k) && !/RUNNINGCONFIG|STARTUPCONFIG|VLANS|IP#|SUBNET|GATEWAY|DNS|FILE_MANAGER|NAME#|POWER#|DHCP|VTP|PHYSICAL|LICENSE|ENABLED/.test(k));
  console.log(`===== ${m}: nel vero ma non nel generato: ${missing.length}, nel generato ma non nel vero: ${extra.length}, valori diversi: ${diff.length}`);
  for (const k of missing.slice(0, 6)) console.log("  - " + k);
  for (const k of extra.slice(0, 6)) console.log("  + " + k);
  for (const [k, v] of diff.slice(0, 8)) console.log(`  ~ ${k}: ${String(v).slice(0, 40)} | ${String(B.get(k)).slice(0, 40)}`);
}
