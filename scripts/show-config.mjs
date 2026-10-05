// Mostra la running-config generata per ogni router/switch di un .pktmd (o .pkt):  node scripts/show-config.mjs file [dispositivo]
import { readFileSync } from "node:fs";
import { decodePkt } from "../src/pkt.js";
import { parseXml, child, childrenOf, textOf, attr, unescapeXml } from "../src/xml.js";
import { pktmdToPkt } from "../src/index.js";

const [file, only] = process.argv.slice(2);
const xml = file.endsWith(".pkt") ? await decodePkt(new Uint8Array(readFileSync(file))) : (await pktmdToPkt(readFileSync(file, "utf8"))).xml;
const root = parseXml(xml);
for (const d of childrenOf(child(child(root, "NETWORK"), "DEVICES"), "DEVICE")) {
  const e = child(d, "ENGINE");
  const name = textOf(e, "NAME");
  if (only && name !== only) continue;
  const rc = child(e, "RUNNINGCONFIG");
  if (!rc) continue;
  console.log(`===== ${name} (${attr(child(e, "TYPE"), "model")})`);
  console.log(childrenOf(rc, "LINE").map((l) => unescapeXml(l.text ?? "")).filter((l) => l !== "!").join("\n"));
}
