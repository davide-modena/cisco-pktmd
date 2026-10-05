#!/usr/bin/env node
// pktmd <input> [output] [--pos]
//   file.pkt   -> file.pktmd
//   file.pktmd -> file.pkt
import { readFileSync, writeFileSync } from "node:fs";
import { pktToPktmd, pktmdToPkt } from "../src/index.js";

const args = process.argv.slice(2);
const pos = args.includes("--pos");
const files = args.filter((a) => !a.startsWith("--"));
if (!files.length || args.includes("--help")) {
  console.log("uso: pktmd <file.pkt|file.pktmd> [uscita] [--pos]\n  --pos  scrive anche le posizioni (pos x y) nel .pktmd");
  process.exit(files.length ? 0 : 1);
}
const [src, dst] = files;
try {
  if (/\.pkt$/i.test(src)) {
    const { text, warnings } = await pktToPktmd(new Uint8Array(readFileSync(src)), { pos });
    const out = dst ?? src.replace(/\.pkt$/i, ".pktmd");
    writeFileSync(out, text);
    warnings.forEach((w) => console.warn("attenzione:", w));
    console.log(`${src} -> ${out}`);
  } else {
    const { bytes, warnings } = await pktmdToPkt(readFileSync(src, "utf8"));
    const out = dst ?? src.replace(/\.pktmd$/i, "") + ".pkt";
    writeFileSync(out, bytes);
    warnings.forEach((w) => console.warn("attenzione:", w));
    console.log(`${src} -> ${out}`);
  }
} catch (e) {
  console.error("errore:", e.message);
  process.exit(1);
}
