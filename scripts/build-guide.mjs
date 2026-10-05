// Costruisce docs/guida.html: un unico file autonomo (si apre con doppio clic) con la guida in Markdown,
// la libreria pktmd e il lettore di Markdown incorporati.
//
//   node scripts/build-guide.mjs
//
// Prima controlla che ogni esempio ```pktmd della guida sia valido: se uno non lo e', la build si ferma.
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { build } from "esbuild";
import { marked } from "marked";
import { checkPktmd, previewConfig } from "../src/embed.js";

const md = readFileSync("docs/guida.md", "utf8");

// ---- 1. controllo degli esempi ---------------------------------------------------------------------------------
const demos = marked.lexer(md).filter((t) => t.type === "code" && /^pktmd(\s|$)/.test(t.lang ?? ""));
let bad = 0;
for (const [i, t] of demos.entries()) {
  const label = `esempio ${i + 1} (${t.text.split("\n")[0].slice(0, 40)}...)`;
  const r = await checkPktmd(t.text);
  if (!r.ok) { bad++; console.error(`ERRORE ${label}: ${r.error}`); continue; }
  const ios = /\bios(?:=(\S+))?/.exec(t.lang)?.[1];
  if (ios) {
    const cfg = await previewConfig(t.text);
    for (const id of ios.split(",")) if (!cfg.has(id)) { bad++; console.error(`ERRORE ${label}: ios=${id} non e' un router/switch dell'esempio`); }
  }
}
if (bad) { console.error(`${bad} problemi: guida non generata`); process.exit(1); }
console.log(`${demos.length} esempi controllati`);

// ---- 2. libreria e lettore di markdown ------------------------------------------------------------------------
const lib = (await build({ entryPoints: ["src/index.js"], bundle: true, format: "iife", globalName: "pktmd", minify: true, target: "es2022", write: false, legalComments: "none" })).outputFiles[0].text;
const marked_ = readFileSync("node_modules/marked/lib/marked.umd.js", "utf8");

// ---- 3. assemblaggio ----------------------------------------------------------------------------------------------
const safe = (js) => js.replace(/<\/script/gi, "<\\/script");
const json = safe(JSON.stringify(md)).split(String.fromCharCode(0x2028)).join("\u2028").split(String.fromCharCode(0x2029)).join("\u2029");
let html = readFileSync("scripts/guida.template.html", "utf8");
const favicon = "data:image/svg+xml;base64," + readFileSync("assets/favicon.svg").toString("base64");
html = html.replace("/*FAVICON*/", () => favicon).replace("/*MARKED*/", () => safe(marked_)).replace("/*PKTMD_LIB*/", () => safe(lib)).replace("/*MARKDOWN_JSON*/", () => json);
writeFileSync("docs/guida.html", html);
console.log(`docs/guida.html: ${Math.round(statSync("docs/guida.html").size / 1024)} KB`);
