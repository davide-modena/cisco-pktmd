// Collaudo di fedelta': per ogni .pkt  leggi -> semplifica -> (testo .pktmd) -> rigenera -> rileggi -> confronta.
//
//   node scripts/fidelity.mjs [cartella-di-pkt ...] [--text] [--only=nome] [--verbose]
//
// Senza --text si confronta il modello; con --text si passa anche dal testo .pktmd (serializza e rileggi).
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { decodePkt } from "../src/pkt.js";
import { parseXml } from "../src/xml.js";
import { getTemplate, fromXml, toXml, simplifyNetwork } from "../src/pt.js";
import { child, childrenOf, unescapeXml } from "../src/xml.js";

// righe di config significative: (testa del blocco | riga figlia), senza il rumore di piattaforma
const NOISE = /^(version |license udi|no service|service timestamps|spanning-tree|ip cef|no ip cef|no ipv6 cef|ipv6 cef|ptp clock|ip classless|ip flow-export|mls qos)/;
function cfgSet(engine) {
  const out = new Map();
  let head = null;
  for (const raw of childrenOf(child(engine, "RUNNINGCONFIG"), "LINE").map((x) => unescapeXml(x.text ?? ""))) {
    // forme equivalenti: numero delle ACL generate per il NAT, `username ... privilege 1 password 0`, spazi finali
    const l = raw.replace(/\s+$/, "")
      .replace(/^(\s*)ip nat inside source list \S+/, "$1ip nat inside source list #")
      .replace(/^access-list \d+ permit ip (\S+ \S+) any$/, "access-list # permit $1")
      .replace(/^access-list \d+ /, "access-list # ")
      .replace(/^(username \S+) privilege 1 password 0 /, "$1 password ");
    if (!l.trim() || l.trim() === "!" || l.trim() === "end") { head = null; continue; }
    let key;
    if (/^\s/.test(l)) {
      const t = l.trim();
      if (t === "duplex auto" || t === "speed auto" || /^clock rate/.test(t) || t === "switchport mode access" || NOISE.test(t)) continue;
      key = head + " | " + t;
    } else { head = l; if (NOISE.test(l)) { head = null; continue; } key = l; }
    out.set(key, (out.get(key) ?? 0) + 1);
  }
  return out;
}
function cfgDiff(infoA, infoB) {
  const lost = [], added = [];
  for (const [id, a] of infoA) {
    const b = infoB.get(id);
    if (!b || a.spec.family === "host") continue;
    const A = cfgSet(a.engine), B = cfgSet(b.engine);
    for (const k of A.keys()) if (!B.has(k)) lost.push(id + ": " + k);
    for (const k of B.keys()) if (!A.has(k)) added.push(id + ": " + k);
  }
  return { lost, added };
}

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const only = args.find((a) => a.startsWith("--only="))?.slice(7);
const dirs = args.filter((a) => !a.startsWith("--"));
if (!dirs.length) dirs.push("examples", "samples");

let text = null;
if (flag("text")) text = await import("../src/pktmd.js");

const tpl = await getTemplate();
let ok = 0, fail = 0, skipped = 0, cfgBad = 0;
const canon = (v) => (Array.isArray(v) ? v.map(canon) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);
const strip = (n) => JSON.stringify(canon({ d: n.devices.map(({ pos, line, ...d }) => d), l: n.links.map(({ line, ...l }) => l) }));

for (const dir of dirs) {
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".pkt"))) {
    if (only && !f.includes(only)) continue;
    if (["rete-base.pkt", "vlan.pkt"].includes(f)) { skipped++; continue; }
    try {
      const root = parseXml(await decodePkt(new Uint8Array(readFileSync(`${dir}/${f}`))));
      const a = fromXml(root, tpl);
      let na = simplifyNetwork(a.network, a.info);
      if (text) {
        const t = text.stringifyPktmd(na, { portsOf: (d) => a.info.get(d.id).inv.map((p) => p.name) });
        if (flag("dump") && f.includes(only ?? "")) console.log(`--- ${f}\n${t}`);
        na = text.parsePktmd(t).network;
      }
      const xml = await toXml(na, { layout: false });
      const b = fromXml(parseXml(xml), tpl);
      const nb = simplifyNetwork(b.network, b.info);
      let A = strip(simplifyNetwork(a.network, a.info)), B = strip(nb);
      const cd = cfgDiff(a.info, b.info);
      if (cd.lost.length || cd.added.length) {
        cfgBad++;
        console.log(`CONFIG ${f}: perse ${cd.lost.length}, aggiunte ${cd.added.length}`);
        for (const l of cd.lost.slice(0, 4)) console.log("   - " + l);
        for (const l of cd.added.slice(0, 4)) console.log("   + " + l);
      }
      if (A === B) { ok++; continue; }
      fail++;
      let i = 0; while (A[i] === B[i]) i++;
      console.log(`DIVERSO ${f}\n  A: ...${A.slice(Math.max(0, i - 140), i + 180)}\n  B: ...${B.slice(Math.max(0, i - 140), i + 180)}`);
    } catch (e) {
      fail++;
      console.log(`ERRORE ${f}: ${e.message}${flag("verbose") ? "\n" + e.stack : ""}`);
    }
  }
}
console.log(`\nuguali: ${ok}   diversi/errori: ${fail}   config con differenze: ${cfgBad}   saltati: ${skipped}`);
process.exit(fail || cfgBad ? 1 : 0);
