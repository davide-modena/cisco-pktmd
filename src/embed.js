// Funzioni di alto livello per usare pktmd dentro altre pagine: schema incorporabile, controllo del testo, anteprima della config.
import { parsePktmd } from "./pktmd.js";
import { toXml, describeNetwork } from "./pt.js";
import { parseXml, child, childrenOf, textOf, unescapeXml } from "./xml.js";
import { createNetworkView } from "./renderer.js";

/**
 * Controlla un testo .pktmd fino in fondo (sintassi + hardware + generazione) senza produrre il file.
 * @returns {Promise<{ok:boolean, error?:string, line?:number, warnings:string[], network?:object}>}
 */
export async function checkPktmd(text) {
  let parsed;
  try { parsed = parsePktmd(text); }
  catch (e) { return { ok: false, error: e.message, line: e.line, warnings: [] }; }
  const warnings = [...parsed.warnings];
  try { await toXml(parsed.network, { layout: false, warnings }); }
  catch (e) { return { ok: false, error: e.message, line: e.line, warnings, network: parsed.network }; }
  return { ok: true, warnings, network: parsed.network };
}

/**
 * La running-config IOS che il testo genera, per ogni router/switch.
 * @returns {Promise<Map<string,string[]>>}  id -> righe (senza i "!" di separazione)
 */
export async function previewConfig(text) {
  const { network } = parsePktmd(text);
  const xml = await toXml(network, { layout: false });
  const root = parseXml(xml);
  const out = new Map();
  for (const d of childrenOf(child(child(root, "NETWORK"), "DEVICES"), "DEVICE")) {
    const e = child(d, "ENGINE");
    const rc = child(e, "RUNNINGCONFIG");
    if (!rc) continue;
    out.set(textOf(e, "NAME"), childrenOf(rc, "LINE").map((l) => unescapeXml(l.text ?? "")).filter((l) => l !== "!"));
  }
  return out;
}

/**
 * Disegna una rete .pktmd dentro `container`.
 *
 *   const m = mountNetwork(el, testo);          // ritorna subito; m.ready e' una promise
 *   await m.setText(altroTesto);                // aggiorna
 *   m.destroy();
 *
 * @param {HTMLElement} container   deve avere un'altezza (es. height: 320px)
 * @param {string} text
 * @param {{theme?: "light"|"dark"|"auto" (predefinito "light"), wheel?: "ctrl"|"always", autoFit?: boolean}} [opts]
 */
export function mountNetwork(container, text, opts = {}) {
  const view = createNetworkView(container, { theme: opts.theme, wheel: opts.wheel ?? "ctrl", autoFit: opts.autoFit ?? true, compact: opts.compact ?? true });
  let seq = 0;
  async function setText(t) {
    const token = ++seq;
    const { network, warnings } = parsePktmd(t);
    const described = await describeNetwork(network);
    if (token !== seq) return { network, warnings, stale: true };
    view.setNetwork(network, described);
    view.resetView();
    return { network, warnings };
  }
  const api = { view, setText, destroy: () => view.destroy(), ready: text === undefined ? Promise.resolve() : setText(text) };
  return api;
}
