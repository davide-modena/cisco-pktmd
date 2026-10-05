// Costruisce la libreria in dist/:
//   dist/pktmd.js        script classico (IIFE): <script src="pktmd.js"></script> -> window.pktmd   (funziona anche da file://)
//   dist/pktmd.esm.js    modulo ES:  import { mountNetwork } from "./pktmd.esm.js"
//   dist/pktmd.min.js    come pktmd.js, minificato
//
//   node scripts/build-lib.mjs
import { build } from "esbuild";
import { statSync } from "node:fs";

const common = { entryPoints: ["src/index.js"], bundle: true, target: "es2022", legalComments: "none" };

await build({ ...common, format: "iife", globalName: "pktmd", outfile: "dist/pktmd.js" });
await build({ ...common, format: "iife", globalName: "pktmd", outfile: "dist/pktmd.min.js", minify: true });
await build({ ...common, format: "esm", outfile: "dist/pktmd.esm.js" });

for (const f of ["pktmd.js", "pktmd.min.js", "pktmd.esm.js"]) console.log(`dist/${f}: ${Math.round(statSync(`dist/${f}`).size / 1024)} KB`);
