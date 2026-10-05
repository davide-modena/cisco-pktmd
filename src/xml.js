// Parser/serializzatore XML "lossless" per i file di Packet Tracer.
// Testo e attributi restano grezzi (entita` incluse), cosi` parse -> serialize e` identico byte per byte.

/** @typedef {{tag:string, attrs:[string,string][], children:XNode[], text:string|null, selfClosing:boolean}} XNode */

export function parseXml(src) {
  let i = 0;
  const n = src.length;

  const skipWs = () => { while (i < n && /\s/.test(src[i])) i++; };

  function readText() {
    const start = i;
    while (i < n) {
      if (src.startsWith("<![CDATA[", i)) {
        const e = src.indexOf("]]>", i);
        i = e < 0 ? n : e + 3;
      } else if (src[i] === "<") break;
      else i++;
    }
    return src.slice(start, i);
  }

  function readElement() {
    i++; // <
    const ts = i;
    while (i < n && !/[\s/>]/.test(src[i])) i++;
    const tag = src.slice(ts, i);
    const attrs = [];
    for (;;) {
      skipWs();
      if (src[i] === "/" || src[i] === ">") break;
      const ks = i;
      while (i < n && src[i] !== "=") i++;
      const key = src.slice(ks, i).trim();
      i++; // =
      const q = src[i++];
      const vs = i;
      while (i < n && src[i] !== q) i++;
      attrs.push([key, src.slice(vs, i)]);
      i++;
    }
    /** @type {XNode} */
    const node = { tag, attrs, children: [], text: null, selfClosing: false };
    if (src[i] === "/") { i += 2; node.selfClosing = true; return node; }
    i++; // >
    for (;;) {
      const t = readText();
      if (src.startsWith("</", i)) {
        i = src.indexOf(">", i) + 1;
        if (node.children.length === 0) node.text = t; // foglia: testo grezzo ("" => <X></X>)
        return node;
      }
      if (t.trim() !== "" && node.children.length === 0) throw new Error(`XML misto non supportato in <${tag}>`);
      node.children.push(readElement());
    }
  }

  skipWs();
  return readElement();
}

export function serializeXml(root) {
  const out = [];
  const walk = (nd, depth) => {
    const pad = " ".repeat(depth);
    const a = nd.attrs.map(([k, v]) => ` ${k}="${v}"`).join("");
    if (nd.children.length) {
      out.push(`${pad}<${nd.tag}${a}>\n`);
      for (const c of nd.children) walk(c, depth + 1);
      out.push(`${pad}</${nd.tag}>\n`);
    } else if (nd.selfClosing) {
      out.push(`${pad}<${nd.tag}${a}/>\n`);
    } else {
      out.push(`${pad}<${nd.tag}${a}>${nd.text ?? ""}</${nd.tag}>\n`);
    }
  };
  walk(root, 0);
  return out.join("");
}

// ---- helper -------------------------------------------------------------

export const unescapeXml = (s) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, c) => c)
    .replace(/&(lt|gt|amp|quot|apos);/g, (_, e) => ({ lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" })[e]);

// PT scrive "&" e "<" come entita`, ">" resta com'e`.
export const escapeXml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

export const child = (nd, tag) => nd?.children.find((c) => c.tag === tag);
export const childrenOf = (nd, tag) => (nd ? nd.children.filter((c) => c.tag === tag) : []);
/** testo decodificato del figlio `tag` ("" se assente) */
export const textOf = (nd, tag) => {
  const c = child(nd, tag);
  return c && c.text != null ? unescapeXml(c.text) : "";
};
/** percorso "A/B/C" */
export function path(nd, p) {
  let cur = nd;
  for (const part of p.split("/")) { cur = child(cur, part); if (!cur) return undefined; }
  return cur;
}
export function setText(nd, value) {
  nd.children = [];
  nd.selfClosing = false;
  nd.text = escapeXml(String(value));
}
/** imposta il testo del figlio `tag`, creandolo se manca */
export function setChildText(nd, tag, value) {
  let c = child(nd, tag);
  if (!c) { c = el(tag); nd.children.push(c); }
  setText(c, value);
  return c;
}
export const el = (tag, text = "", attrs = []) => ({ tag, attrs, children: [], text: escapeXml(text), selfClosing: false });
export const clone = (nd) => ({ ...nd, attrs: nd.attrs.map((a) => [...a]), children: nd.children.map(clone) });
export function* walkNodes(nd) {
  yield nd;
  for (const c of nd.children) yield* walkNodes(c);
}
export const attr = (nd, k) => nd.attrs.find(([a]) => a === k)?.[1];
