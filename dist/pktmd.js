var pktmd = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/index.js
  var index_exports = {};
  __export(index_exports, {
    DEFAULT_MODEL: () => DEFAULT_MODEL,
    DEFAULT_PHYSICS: () => DEFAULT_PHYSICS,
    MODELS: () => MODELS,
    PktmdError: () => PktmdError,
    autoLayout: () => autoLayout,
    checkPktmd: () => checkPktmd,
    createNetworkView: () => createNetworkView,
    decodePkt: () => decodePkt,
    describeNetwork: () => describeNetwork,
    encodePkt: () => encodePkt,
    fromXml: () => fromXml,
    getTemplate: () => getTemplate,
    mountNetwork: () => mountNetwork,
    parsePktmd: () => parsePktmd,
    pktToPktmd: () => pktToPktmd,
    pktmdToPkt: () => pktmdToPkt,
    portNamesOf: () => portNamesOf,
    portsFor: () => portsFor,
    previewConfig: () => previewConfig,
    resolveLinks: () => resolveLinks,
    resolveLinksSafe: () => resolveLinksSafe,
    seedPositions: () => seedPositions,
    simplifyNetwork: () => simplifyNetwork,
    simulationStep: () => simulationStep,
    stringifyPktmd: () => stringifyPktmd,
    toPtCoords: () => toPtCoords,
    toXml: () => toXml
  });

  // src/twofish.js
  var T = {
    q0: [
      [8, 1, 7, 13, 6, 15, 3, 2, 0, 11, 5, 9, 14, 12, 10, 4],
      [14, 12, 11, 8, 1, 2, 3, 5, 15, 4, 10, 6, 7, 0, 9, 13],
      [11, 10, 5, 14, 6, 13, 9, 0, 12, 8, 15, 3, 2, 4, 7, 1],
      [13, 7, 15, 4, 1, 2, 6, 14, 9, 11, 3, 0, 8, 5, 12, 10]
    ],
    q1: [
      [2, 8, 11, 13, 15, 7, 6, 14, 3, 1, 9, 4, 0, 10, 12, 5],
      [1, 14, 2, 11, 4, 12, 3, 7, 6, 13, 10, 5, 15, 9, 0, 8],
      [4, 12, 7, 5, 1, 6, 9, 10, 0, 14, 13, 8, 2, 11, 3, 15],
      [11, 9, 5, 1, 12, 3, 13, 14, 6, 4, 7, 15, 2, 0, 8, 10]
    ]
  };
  var ror4 = (x, n) => (x >> n | x << 4 - n) & 15;
  function buildQ(t) {
    const q = new Uint8Array(256);
    for (let x = 0; x < 256; x++) {
      const a0 = x >> 4, b0 = x & 15;
      const a1 = a0 ^ b0;
      const b1 = a0 ^ ror4(b0, 1) ^ 8 * a0 & 15;
      const a2 = t[0][a1], b2 = t[1][b1];
      const a3 = a2 ^ b2;
      const b3 = a2 ^ ror4(b2, 1) ^ 8 * a2 & 15;
      q[x] = 16 * t[3][b3] + t[2][a3];
    }
    return q;
  }
  var Q0 = buildQ(T.q0);
  var Q1 = buildQ(T.q1);
  function gfMul(a, b, poly) {
    let r = 0;
    while (b) {
      if (b & 1) r ^= a;
      a <<= 1;
      if (a & 256) a ^= poly;
      b >>= 1;
    }
    return r;
  }
  var MDS = [
    [1, 239, 91, 91],
    [91, 239, 239, 1],
    [239, 91, 1, 239],
    [239, 1, 239, 91]
  ];
  var RS = [
    [1, 164, 85, 135, 90, 88, 219, 158],
    [164, 86, 130, 243, 30, 198, 104, 229],
    [2, 161, 252, 193, 71, 174, 61, 25],
    [164, 85, 135, 90, 88, 219, 158, 3]
  ];
  var rol = (x, n) => (x << n | x >>> 32 - n) >>> 0;
  var ror = (x, n) => (x >>> n | x << 32 - n) >>> 0;
  var word = (b, o) => (b[o] | b[o + 1] << 8 | b[o + 2] << 16 | b[o + 3] << 24) >>> 0;
  function h(x, L0, L1) {
    const y = [x & 255, x >> 8 & 255, x >> 16 & 255, x >> 24 & 255];
    const z0 = Q1[Q0[Q0[y[0]] ^ L1[0]] ^ L0[0]];
    const z1 = Q0[Q0[Q1[y[1]] ^ L1[1]] ^ L0[1]];
    const z2 = Q1[Q1[Q0[y[2]] ^ L1[2]] ^ L0[2]];
    const z3 = Q0[Q1[Q1[y[3]] ^ L1[3]] ^ L0[3]];
    const z = [z0, z1, z2, z3];
    let out = 0;
    for (let i = 0; i < 4; i++) {
      let v = 0;
      for (let j = 0; j < 4; j++) v ^= gfMul(MDS[i][j], z[j], 361);
      out |= v << 8 * i;
    }
    return out >>> 0;
  }
  var wordBytes = (w) => [w & 255, w >>> 8 & 255, w >>> 16 & 255, w >>> 24 & 255];
  var Twofish = class {
    /** @param {Uint8Array} key 16 byte */
    constructor(key) {
      if (key.length !== 16) throw new Error("Twofish: solo chiavi da 128 bit");
      const Me = [word(key, 0), word(key, 8)];
      const Mo = [word(key, 4), word(key, 12)];
      const S = [];
      for (let i = 0; i < 2; i++) {
        const w = [0, 0, 0, 0];
        for (let r = 0; r < 4; r++) {
          let v = 0;
          for (let c = 0; c < 8; c++) v ^= gfMul(RS[r][c], key[8 * i + c], 333);
          w[r] = v;
        }
        S.push(w);
      }
      const sL0 = S[1], sL1 = S[0];
      const K = new Uint32Array(40);
      const meL0 = wordBytes(Me[0]), meL1 = wordBytes(Me[1]);
      const moL0 = wordBytes(Mo[0]), moL1 = wordBytes(Mo[1]);
      for (let i = 0; i < 20; i++) {
        const A = h(2 * i * 16843009 >>> 0, meL0, meL1);
        const B = rol(h((2 * i + 1) * 16843009 >>> 0, moL0, moL1), 8);
        K[2 * i] = A + B >>> 0;
        K[2 * i + 1] = rol(A + 2 * B >>> 0, 9);
      }
      this.K = K;
      this.sb = [0, 1, 2, 3].map(() => new Uint32Array(256));
      for (let x = 0; x < 256; x++) {
        const z = [
          Q1[Q0[Q0[x] ^ sL1[0]] ^ sL0[0]],
          Q0[Q0[Q1[x] ^ sL1[1]] ^ sL0[1]],
          Q1[Q1[Q0[x] ^ sL1[2]] ^ sL0[2]],
          Q0[Q1[Q1[x] ^ sL1[3]] ^ sL0[3]]
        ];
        for (let j = 0; j < 4; j++) {
          let out = 0;
          for (let i = 0; i < 4; i++) out |= gfMul(MDS[i][j], z[j], 361) << 8 * i;
          this.sb[j][x] = out >>> 0;
        }
      }
    }
    g(x) {
      const s = this.sb;
      return (s[0][x & 255] ^ s[1][x >>> 8 & 255] ^ s[2][x >>> 16 & 255] ^ s[3][x >>> 24]) >>> 0;
    }
    /** @param {Uint8Array} p 16 byte @returns {Uint8Array} */
    encrypt(p) {
      const K = this.K;
      let r0 = (word(p, 0) ^ K[0]) >>> 0, r1 = (word(p, 4) ^ K[1]) >>> 0;
      let r2 = (word(p, 8) ^ K[2]) >>> 0, r3 = (word(p, 12) ^ K[3]) >>> 0;
      for (let r = 0; r < 16; r++) {
        const t0 = this.g(r0), t1 = this.g(rol(r1, 8));
        const f0 = t0 + t1 + K[2 * r + 8] >>> 0;
        const f1 = t0 + 2 * t1 + K[2 * r + 9] >>> 0;
        const n2 = ror((r2 ^ f0) >>> 0, 1);
        const n3 = (rol(r3, 1) ^ f1) >>> 0;
        r2 = r0;
        r3 = r1;
        r0 = n2;
        r1 = n3;
      }
      const c = [r2 ^ K[4], r3 ^ K[5], r0 ^ K[6], r1 ^ K[7]];
      const out = new Uint8Array(16);
      for (let i = 0; i < 4; i++) {
        const w = c[i] >>> 0;
        out[4 * i] = w & 255;
        out[4 * i + 1] = w >>> 8 & 255;
        out[4 * i + 2] = w >>> 16 & 255;
        out[4 * i + 3] = w >>> 24;
      }
      return out;
    }
  };

  // src/pkt.js
  var KEY = new Uint8Array(16).fill(137);
  var NONCE = new Uint8Array(16).fill(16);
  var tf = new Twofish(KEY);
  var xor16 = (a, b) => {
    const r = new Uint8Array(16);
    for (let i = 0; i < 16; i++) r[i] = a[i] ^ b[i];
    return r;
  };
  function dbl(b) {
    const r = new Uint8Array(16);
    const carry = b[0] >> 7;
    for (let i = 0; i < 15; i++) r[i] = (b[i] << 1 | b[i + 1] >> 7) & 255;
    r[15] = b[15] << 1 & 255;
    if (carry) r[15] ^= 135;
    return r;
  }
  var L = tf.encrypt(new Uint8Array(16));
  var K1 = dbl(L);
  var K2 = dbl(K1);
  function omac(t, data) {
    const m = new Uint8Array(16 + data.length);
    m[15] = t;
    m.set(data, 16);
    const nb = Math.ceil(m.length / 16);
    let x = new Uint8Array(16);
    for (let b = 0; b < nb - 1; b++) x = tf.encrypt(xor16(x, m.subarray(16 * b, 16 * b + 16)));
    const lastStart = 16 * (nb - 1);
    let last = new Uint8Array(16);
    if (m.length - lastStart === 16) last = xor16(m.subarray(lastStart), K1);
    else {
      last.set(m.subarray(lastStart));
      last[m.length - lastStart] = 128;
      last = xor16(last, K2);
    }
    return tf.encrypt(xor16(x, last));
  }
  function ctr(data) {
    const counter = omac(0, NONCE);
    const out = new Uint8Array(data.length);
    for (let off = 0; off < data.length; off += 16) {
      const ks = tf.encrypt(counter);
      const len = Math.min(16, data.length - off);
      for (let j = 0; j < len; j++) out[off + j] = data[off + j] ^ ks[j];
      for (let k = 15; k >= 0; k--) {
        counter[k] = counter[k] + 1 & 255;
        if (counter[k]) break;
      }
    }
    return out;
  }
  function eaxDecrypt(data) {
    return ctr(data.subarray(0, data.length - 16));
  }
  function eaxEncrypt(plain) {
    const ct = ctr(plain);
    const a = omac(0, NONCE), b = omac(1, new Uint8Array(0)), c = omac(2, ct);
    const out = new Uint8Array(ct.length + 16);
    out.set(ct);
    for (let i = 0; i < 16; i++) out[ct.length + i] = a[i] ^ b[i] ^ c[i];
    return out;
  }
  async function pipe(bytes, stream) {
    const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
    return new Uint8Array(await res.arrayBuffer());
  }
  async function decodePkt(raw) {
    const n = raw.length;
    const s1 = new Uint8Array(n);
    for (let i = 0; i < n; i++) s1[i] = raw[n - 1 - i] ^ n - i * n & 255;
    const s2 = eaxDecrypt(s1);
    const m = s2.length;
    const s3 = new Uint8Array(m);
    for (let i = 0; i < m; i++) s3[i] = s2[i] ^ m - i & 255;
    const size = new DataView(s3.buffer).getUint32(0, false);
    const xml = await pipe(s3.subarray(4), new DecompressionStream("deflate"));
    if (xml.length !== size) throw new Error(`pkt: dimensione attesa ${size}, ottenuta ${xml.length}`);
    return new TextDecoder("utf-8").decode(xml);
  }
  async function encodePkt(xml) {
    const bytes = new TextEncoder().encode(xml);
    const z = await pipe(bytes, new CompressionStream("deflate"));
    const s3 = new Uint8Array(4 + z.length);
    new DataView(s3.buffer).setUint32(0, bytes.length, false);
    s3.set(z, 4);
    const m = s3.length;
    const s2 = new Uint8Array(m);
    for (let i = 0; i < m; i++) s2[i] = s3[i] ^ m - i & 255;
    const s1 = eaxEncrypt(s2);
    const n = s1.length;
    const raw = new Uint8Array(n);
    for (let i = 0; i < n; i++) raw[n - 1 - i] = s1[i] ^ n - i * n & 255;
    return raw;
  }

  // src/xml.js
  function parseXml(src) {
    let i = 0;
    const n = src.length;
    const skipWs = () => {
      while (i < n && /\s/.test(src[i])) i++;
    };
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
      i++;
      const ts = i;
      while (i < n && !/[\s/>]/.test(src[i])) i++;
      const tag = src.slice(ts, i);
      const attrs = [];
      for (; ; ) {
        skipWs();
        if (src[i] === "/" || src[i] === ">") break;
        const ks = i;
        while (i < n && src[i] !== "=") i++;
        const key = src.slice(ks, i).trim();
        i++;
        const q = src[i++];
        const vs = i;
        while (i < n && src[i] !== q) i++;
        attrs.push([key, src.slice(vs, i)]);
        i++;
      }
      const node = { tag, attrs, children: [], text: null, selfClosing: false };
      if (src[i] === "/") {
        i += 2;
        node.selfClosing = true;
        return node;
      }
      i++;
      for (; ; ) {
        const t = readText();
        if (src.startsWith("</", i)) {
          i = src.indexOf(">", i) + 1;
          if (node.children.length === 0) node.text = t;
          return node;
        }
        if (t.trim() !== "" && node.children.length === 0) throw new Error(`XML misto non supportato in <${tag}>`);
        node.children.push(readElement());
      }
    }
    skipWs();
    return readElement();
  }
  function serializeXml(root) {
    const out = [];
    const walk = (nd, depth) => {
      const pad = " ".repeat(depth);
      const a = nd.attrs.map(([k, v]) => ` ${k}="${v}"`).join("");
      if (nd.children.length) {
        out.push(`${pad}<${nd.tag}${a}>
`);
        for (const c of nd.children) walk(c, depth + 1);
        out.push(`${pad}</${nd.tag}>
`);
      } else if (nd.selfClosing) {
        out.push(`${pad}<${nd.tag}${a}/>
`);
      } else {
        out.push(`${pad}<${nd.tag}${a}>${nd.text ?? ""}</${nd.tag}>
`);
      }
    };
    walk(root, 0);
    return out.join("");
  }
  var unescapeXml = (s) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, c) => c).replace(/&(lt|gt|amp|quot|apos);/g, (_, e) => ({ lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" })[e]);
  var escapeXml = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  var child = (nd, tag) => nd?.children.find((c) => c.tag === tag);
  var childrenOf = (nd, tag) => nd ? nd.children.filter((c) => c.tag === tag) : [];
  var textOf = (nd, tag) => {
    const c = child(nd, tag);
    return c && c.text != null ? unescapeXml(c.text) : "";
  };
  function path(nd, p) {
    let cur = nd;
    for (const part of p.split("/")) {
      cur = child(cur, part);
      if (!cur) return void 0;
    }
    return cur;
  }
  function setText(nd, value) {
    nd.children = [];
    nd.selfClosing = false;
    nd.text = escapeXml(String(value));
  }
  function setChildText(nd, tag, value) {
    let c = child(nd, tag);
    if (!c) {
      c = el(tag);
      nd.children.push(c);
    }
    setText(c, value);
    return c;
  }
  var el = (tag, text = "", attrs = []) => ({ tag, attrs, children: [], text: escapeXml(text), selfClosing: false });
  var clone = (nd) => ({ ...nd, attrs: nd.attrs.map((a) => [...a]), children: nd.children.map(clone) });
  function* walkNodes(nd) {
    yield nd;
    for (const c of nd.children) yield* walkNodes(c);
  }
  var attr = (nd, k) => nd.attrs.find(([a]) => a === k)?.[1];

  // src/model.js
  var PktmdError = class extends Error {
    constructor(message, line) {
      super(line ? `riga ${line}: ${message}` : message);
      this.line = line;
      this.rawMessage = message;
    }
  };
  var TYPES = ["pc", "laptop", "server", "switch", "router"];
  var ALIASES = {
    pc: "pc",
    laptop: "laptop",
    lap: "laptop",
    server: "server",
    srv: "server",
    switch: "switch",
    sw: "switch",
    router: "router",
    r: "router"
  };
  var typeFromAlias = (word2) => ALIASES[word2.toLowerCase()];
  function inferType(id) {
    const m = /^([A-Za-z]+)\d+$/.exec(id);
    return m ? typeFromAlias(m[1]) : void 0;
  }
  var PORT_PREFIX = [
    ["FastEthernet", "fa", /^(fa|fastethernet)$/i],
    ["GigabitEthernet", "gi", /^(gi|gig|gigabitethernet)$/i],
    ["Serial", "se", /^(se|ser|serial)$/i],
    ["Ethernet", "eth", /^(eth|ethernet)$/i],
    ["Wireless", "wl", /^(wl|wireless)$/i],
    ["Vlan", "vlan", /^vlan$/i]
  ];
  var PORT_RE = /^([A-Za-z]+)\s*(\d+(?:\/\d+)*(?:\.\d+)?)$/;
  function normalizePort(s) {
    const m = PORT_RE.exec(s);
    if (!m) return void 0;
    const p = PORT_PREFIX.find(([, , re]) => re.test(m[1]));
    return p ? p[0] + m[2] : void 0;
  }
  var looksLikePort = (s) => normalizePort(s) !== void 0;
  function shortPort(name) {
    const m = PORT_RE.exec(name);
    const p = m && PORT_PREFIX.find(([long]) => long === m[1]);
    return p ? p[1] + m[2] : name;
  }
  var isIPv4 = (s) => /^\d{1,3}(\.\d{1,3}){3}$/.test(s) && s.split(".").every((o) => +o <= 255);
  function maskToPrefix(mask) {
    if (!isIPv4(mask)) return void 0;
    const bits = mask.split(".").map((o) => (+o).toString(2).padStart(8, "0")).join("");
    return /^1*0*$/.test(bits) ? bits.indexOf("0") === -1 ? 32 : bits.indexOf("0") : void 0;
  }
  function prefixToMask(p) {
    const bits = "1".repeat(p).padEnd(32, "0");
    return [0, 8, 16, 24].map((i) => parseInt(bits.slice(i, i + 8), 2)).join(".");
  }
  function classfulPrefix(ip) {
    const first = +ip.split(".")[0];
    return first < 128 ? 8 : first < 192 ? 16 : 24;
  }
  function networkAddress(ip, prefix) {
    const m = prefixToMask(prefix).split(".").map(Number);
    return ip.split(".").map((o, i) => +o & m[i]).join(".");
  }
  var ipToInt = (ip) => ip.split(".").reduce((a, o) => (a << 8 | +o) >>> 0, 0);
  var intToIp = (n) => [24, 16, 8, 0].map((s) => n >>> s & 255).join(".");
  var prefixToWildcard = (p) => intToIp(~ipToInt(prefixToMask(p)) >>> 0);
  function wildcardToPrefix(wc) {
    if (!isIPv4(wc)) return void 0;
    return maskToPrefix(intToIp(~ipToInt(wc) >>> 0));
  }
  function inNet(ip, net, prefix) {
    if (prefix === 0) return true;
    const m = ~0 << 32 - prefix >>> 0;
    return (ipToInt(ip) & m) >>> 0 === (ipToInt(net) & m) >>> 0;
  }
  var classfulNetwork = (ip) => networkAddress(ip, classfulPrefix(ip));
  function parseCidr(s) {
    const [net, p] = s.split("/");
    if (!isIPv4(net)) return void 0;
    const prefix = p === void 0 ? 32 : /^\d+$/.test(p) ? +p : NaN;
    if (!(prefix >= 0 && prefix <= 32)) return void 0;
    return { net, prefix };
  }

  // src/catalog.js
  var MODELS = {
    pc: { key: "pc", type: "pc", pt: "PC-PT", token: "", family: "host" },
    server: { key: "server", type: "server", pt: "Server-PT", token: "", family: "host" },
    r2901: { key: "r2901", type: "router", pt: "2901", token: "2901", family: "isr", emptySlots: (s) => slotTypeOf(s) === "eInterfaceCard" },
    r2911: { key: "r2911", type: "router", pt: "2911", token: "2911", family: "isr", emptySlots: (s) => slotTypeOf(s) === "eInterfaceCard" },
    r1841: { key: "r1841", type: "router", pt: "1841", token: "1841", family: "isr", emptySlots: (s) => slotTypeOf(s) === "eInterfaceCard" },
    rpt: { key: "rpt", type: "router", pt: "Router-PT", token: "pt", family: "ptrouter", sig: /^\[PT-ROUTER-NM-1CFE#1,PT-ROUTER-NM-1CFE#1,PT-ROUTER-NM-1S#1/ },
    rempty: { key: "rempty", type: "router", pt: "Router-PT-Empty", token: "empty", family: "ptrouter", emptySlots: () => true },
    s2960: { key: "s2960", type: "switch", pt: "2960-24TT", token: "2960", family: "fixed" },
    s2950: { key: "s2950", type: "switch", pt: "2950-24", token: "2950", family: "fixed" },
    spt: { key: "spt", type: "switch", pt: "Switch-PT", token: "pt", family: "ptswitch" },
    sempty: { key: "sempty", type: "switch", pt: "Switch-PT-Empty", token: "empty", family: "ptswitch", emptySlots: () => true }
  };
  function slotTypeOf(slot) {
    const t = slot.children.find((c) => c.tag === "TYPE");
    return t?.text ?? "";
  }
  var DEFAULT_MODEL = { pc: "pc", server: "server", router: "r2901", switch: "s2960" };
  var MODEL_BY_PT = Object.fromEntries(Object.values(MODELS).map((m) => [m.pt, m]));
  function modelFromToken(type, token) {
    if (!token) return MODELS[DEFAULT_MODEL[type]];
    const t = token.toLowerCase();
    return Object.values(MODELS).find((m) => m.type === type && (m.token || "").toLowerCase() === t);
  }
  function tokensFor(type) {
    return Object.values(MODELS).filter((m) => m.type === type && m.token).map((m) => m.token);
  }
  var NICS = {
    fa: "PT-HOST-NM-1CFE",
    gig: "PT-HOST-NM-1CGE",
    fiber: "PT-HOST-NM-1FGE"
  };
  var MODULE_ALIASES = {
    serial: "HWIC-2T",
    "hwic-2t": "HWIC-2T",
    sfp: "HWIC-1GE-SFP",
    fiber: "HWIC-1GE-SFP",
    "hwic-1ge-sfp": "HWIC-1GE-SFP",
    // moduli dei Router-PT / Switch-PT
    "r-fe": "PT-ROUTER-NM-1CFE",
    "r-ge": "PT-ROUTER-NM-1CGE",
    "r-fiber": "PT-ROUTER-NM-1FGE",
    "r-fiber-sm": "PT-ROUTER-NM-1FGE-SM",
    "r-fiber-fe": "PT-ROUTER-NM-1FFE",
    "r-serial": "PT-ROUTER-NM-1S",
    "s-fe": "PT-SWITCH-NM-1CFE",
    "s-ge": "PT-SWITCH-NM-1CGE",
    "s-fiber": "PT-SWITCH-NM-1FGE",
    "s-fiber-fe": "PT-SWITCH-NM-1FFE"
  };
  var DEFAULT_MODULES = {
    rpt: ["PT-ROUTER-NM-1CFE", "PT-ROUTER-NM-1CFE", "PT-ROUTER-NM-1S", "PT-ROUTER-NM-1S", "PT-ROUTER-NM-1FFE", "PT-ROUTER-NM-1FFE"],
    spt: ["PT-SWITCH-NM-1CFE", "PT-SWITCH-NM-1CFE", "PT-SWITCH-NM-1CFE", "PT-SWITCH-NM-1CFE", "PT-SWITCH-NM-1FFE", "PT-SWITCH-NM-1FFE"]
  };
  var PREFIX = {
    eCopperFastEthernet: "FastEthernet",
    eFiberFastEthernet: "FastEthernet",
    eCopperGigabitEthernet: "GigabitEthernet",
    eFiberGigabitEthernet: "GigabitEthernet",
    eSerial: "Serial",
    eSmartSerial: "Serial"
  };
  var prefixOfPortType = (t) => PREFIX[t] ?? "FastEthernet";
  var isFiberPortType = (t) => /Fiber/.test(t);
  var isSerialPortType = (t) => /Serial/.test(t);

  // src/links.js
  function reservedPorts(dev, primary) {
    const out = [];
    for (const p of dev.ports ?? []) {
      const name = p.name ?? primary;
      if (!name || /\.\d+$/.test(name) || /^Vlan\d+$/.test(name)) continue;
      const keys = Object.keys(p).filter((k) => !["name", "line", "sub"].includes(k));
      const reserve = p.ip || p.dhcp || p.unnumbered || p.vlan !== void 0 || keys.length === 0;
      if (reserve && !out.includes(name)) out.push(name);
    }
    return out;
  }
  function resolveLinks(network, portsOf, devOf) {
    const taken = /* @__PURE__ */ new Map();
    const set = (id) => taken.get(id) ?? taken.set(id, /* @__PURE__ */ new Set()).get(id);
    const links = network.links.map((l) => ({ ...l, a: { ...l.a }, b: { ...l.b } }));
    for (const l of links) for (const e of [l.a, l.b]) if (e.port) set(e.dev).add(e.port);
    const priority = /* @__PURE__ */ new Map();
    const order = (id) => {
      if (!priority.has(id)) {
        const dev = devOf(id);
        const all = dev ? portsOf(dev) : [];
        const reserved = dev ? reservedPorts(dev, all[0]).filter((n) => all.includes(n)) : [];
        priority.set(id, [...reserved, ...all.filter((n) => !reserved.includes(n))]);
      }
      return priority.get(id);
    };
    for (const l of links) {
      for (const e of [l.a, l.b]) {
        if (e.port) continue;
        const t = set(e.dev);
        const free = order(e.dev).find((n) => !t.has(n));
        if (!free) throw new PktmdError(`${e.dev}: nessuna porta libera`, l.line);
        e.port = free;
        t.add(free);
      }
    }
    const seen = /* @__PURE__ */ new Set();
    for (const l of links) for (const e of [l.a, l.b]) {
      const k = `${e.dev}|${e.port}`;
      if (seen.has(k)) throw new PktmdError(`${e.dev}: la porta ${shortPort(e.port)} e' gia' collegata`, l.line);
      seen.add(k);
    }
    return links;
  }
  function resolveLinksSafe(network, portsOf, devOf) {
    try {
      return resolveLinks(network, portsOf, devOf);
    } catch {
      return network.links.map((l) => ({ ...l }));
    }
  }
  var sameCfg = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function mergeLinkOptions(links, work, typeOf) {
    const port = (devId, name) => {
      const d = work.get(devId);
      let p = d.ports.find((x) => x.name === name);
      if (!p) {
        p = { name };
        d.ports.push(p);
      }
      return p;
    };
    for (const l of links) {
      const o = l.opts;
      if (!o) continue;
      const ends = [l.a, l.b];
      const sw = ends.filter((e) => typeOf(e.dev) === "switch");
      if ((o.vlan !== void 0 || o.trunk) && !sw.length) throw new PktmdError('"vlan" e "trunk" servono almeno uno switch ad un estremo del collegamento', l.line);
      for (const e of sw) {
        const p = port(e.dev, e.port);
        const want = o.trunk ? { mode: "trunk", ...o.trunk.allowed ? { allowed: o.trunk.allowed } : {}, ...o.trunk.native !== void 0 ? { native: o.trunk.native } : {} } : { access: o.vlan, mode: "access" };
        for (const [k, v] of Object.entries(want)) {
          if (p[k] !== void 0 && !sameCfg(p[k], v)) throw new PktmdError(`${e.dev}: la porta ${shortPort(e.port)} e' gia' configurata diversamente (${k})`, l.line);
          p[k] = v;
        }
      }
      if (o.clock !== void 0) port(l.a.dev, l.a.port).clock = o.clock;
    }
  }

  // src/pktmd-write.js
  var moduleAlias = (name) => Object.entries(MODULE_ALIASES).find(([k, v]) => v === name && k !== name.toLowerCase())?.[0] ?? name;
  var cidr = (ip, prefix) => `${ip}/${prefix}`;
  var clone2 = (o) => JSON.parse(JSON.stringify(o));
  var PORT_KEYS_LINKABLE = /* @__PURE__ */ new Set(["name", "mode", "access", "allowed", "native", "line"]);
  function portOption(p) {
    if (!p) return { kind: "none" };
    const extra = Object.keys(p).filter((k) => !PORT_KEYS_LINKABLE.has(k));
    if (extra.length) return { kind: "other" };
    if (p.mode === "trunk") return p.access !== void 0 ? { kind: "other" } : { kind: "trunk", allowed: p.allowed, native: p.native };
    if (p.access !== void 0 && (p.mode === void 0 || p.mode === "access")) return { kind: "access", vlan: p.access };
    if (!p.access && !p.mode && !p.allowed && p.native === void 0) return { kind: "none" };
    return { kind: "other" };
  }
  var sameOpt = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function liftLinkOptions(net) {
    const devs = new Map(net.devices.map((d) => [d.id, clone2(d)]));
    const links = net.links.map((l) => ({ ...clone2(l) }));
    for (const l of links) {
      const sw = [l.a, l.b].filter((e) => devs.get(e.dev)?.type === "switch" && e.port);
      if (!sw.length) continue;
      const opts = sw.map((e) => portOption(devs.get(e.dev).ports.find((p) => p.name === e.port)));
      if (opts.some((o2) => o2.kind === "none" || o2.kind === "other")) continue;
      if (!opts.every((o2) => sameOpt(o2, opts[0]))) continue;
      const o = opts[0];
      l.opts = { ...l.opts ?? {}, ...o.kind === "trunk" ? { trunk: { ...o.allowed ? { allowed: o.allowed } : {}, ...o.native !== void 0 ? { native: o.native } : {} } } : { vlan: o.vlan } };
      for (const e of sw) {
        const d = devs.get(e.dev);
        const p = d.ports.find((x) => x.name === e.port);
        for (const k of ["mode", "access", "allowed", "native"]) delete p[k];
        if (Object.keys(p).filter((k) => k !== "name" && k !== "line").length === 0) d.ports.splice(d.ports.indexOf(p), 1);
      }
    }
    return { devs: [...devs.values()], links };
  }
  function portTokens(p) {
    const t = [];
    if (p.ip) t.push(cidr(p.ip, p.prefix));
    else if (p.dhcp) t.push("dhcp");
    else if (p.unnumbered) t.push("unnumbered", shortPort(p.unnumbered));
    if (p.vlan !== void 0) t.push("vlan", p.vlan);
    if (p.mode === "trunk") {
      if (p.access !== void 0) t.push("access", p.access);
      t.push("trunk");
      if (p.allowed) t.push(p.allowed);
      if (p.native !== void 0) t.push("native", p.native);
    } else if (p.access !== void 0) t.push("access", p.access);
    else if (p.mode === "access") t.push("access");
    for (const h2 of p.helper ?? []) t.push("helper", h2);
    if (p.acl?.in) t.push("acl", p.acl.in, "in");
    if (p.acl?.out) t.push("acl", p.acl.out, "out");
    if (p.nat === "inside" || p.nat === "outside") t.push(p.nat);
    else if (p.nat === "off") t.push("nat", "off");
    if (p.clock !== void 0) t.push("clock", p.clock);
    if (p.admin) t.push(p.admin);
    if (p.desc) t.push("desc", p.desc);
    return t.join(" ");
  }
  function portLines(ports) {
    const items = ports.map((p) => ({ name: p.name, toks: portTokens(p) }));
    const out = [];
    for (let i = 0; i < items.length; ) {
      let j = i;
      const m = /^(.*?)(\d+)$/.exec(items[i].name);
      while (m && j + 1 < items.length) {
        const n = /^(.*?)(\d+)$/.exec(items[j + 1].name);
        const cur = /^(.*?)(\d+)$/.exec(items[j].name);
        if (!n || n[1] !== m[1] || +n[2] !== +cur[2] + 1 || items[j + 1].toks !== items[i].toks) break;
        j++;
      }
      const first = shortPort(items[i].name);
      const label = j > i ? `${first}-${/(\d+)$/.exec(items[j].name)[1]}` : first;
      out.push(`  ${label}${items[i].toks ? " " + items[i].toks : ""}`);
      i = j + 1;
    }
    return out;
  }
  var netList = (nets) => nets.map((n) => cidr(n.net, n.prefix)).join(" ");
  function addrText(a) {
    return a.any ? "any" : a.host ? `host ${a.host}` : cidr(a.net, a.prefix);
  }
  function portSpecText(p) {
    return p ? ` ${p.op} ${p.a}${p.b ? " " + p.b : ""}` : "";
  }
  function deviceLines(d, opts) {
    const L2 = [];
    const host = d.type === "pc" || d.type === "server";
    const spec = MODELS[d.model ?? DEFAULT_MODEL[d.type]];
    const tokens = [];
    if (d.model && spec.token) tokens.push(spec.token);
    if (d.nic) tokens.push(d.nic === "fa" ? "fa" + (d.nicSlot ?? "") : d.nic + (d.nicSlot ?? ""));
    const auto = inferType(d.id) === d.type && !tokens.length;
    L2.push(auto ? `${d.id}:` : `${d.id}: ${d.type}${tokens.length ? " " + tokens.join(" ") : ""}`);
    if (d.hostname) L2.push(`  name ${d.hostname}`);
    if (opts.pos && d.pos) L2.push(`  pos ${Math.round(d.pos.x)} ${Math.round(d.pos.y)}`);
    for (const m of d.modules ?? []) L2.push(`  module ${m.name === "none" ? "slot " + m.slot + " none" : moduleAlias(m.name)}${m.slot !== void 0 && m.name !== "none" ? " slot " + m.slot : ""}`);
    const rest = [];
    for (const p of d.ports) {
      const isPrimary = host ? p.name === null : false;
      const isSvi = /^Vlan\d+$/.test(p.name ?? "");
      const svi = isSvi && !p.vlan && Object.keys(p).filter((k) => !["name", "ip", "prefix", "dhcp", "line"].includes(k)).length === 0;
      if (isPrimary || svi) {
        const vl = svi && p.name !== "Vlan1" ? ` vlan ${p.name.slice(4)}` : "";
        L2.push(p.dhcp ? "  ip dhcp" : `  ip ${cidr(p.ip, p.prefix)}${vl}`);
      } else if (!host) rest.push(p);
    }
    if (d.gw) L2.push(`  gw ${d.gw}`);
    if (d.dns?.length) L2.push(`  dns ${d.dns.join(" ")}`);
    if (d.domain) L2.push(`  domain ${d.domain}`);
    if (d.mail) {
      const m = d.mail;
      L2.push(`  mail ${m.address} ${m.pass}${m.pop3 ? " pop3 " + m.pop3 : ""}${m.smtp ? " smtp " + m.smtp : ""}${m.user ? " user " + m.user : ""}${m.name ? " name " + m.name : ""}`);
    }
    for (const v of d.vlans ?? []) L2.push(`  vlan ${v.id}${v.name ? " " + v.name : ""}`);
    L2.push(...portLines(rest));
    for (const r of d.routes ?? []) L2.push(`  route ${r.prefix === 0 && r.net === "0.0.0.0" ? "default" : cidr(r.net, r.prefix)} via ${r.via ?? shortPort(r.port)}${r.ad ? " ad " + r.ad : ""}`);
    if (d.rip) {
      const t = ["rip"];
      if (d.rip.v === 1) t.push("v1");
      if (d.rip.autosum) t.push("autosum");
      if (d.rip.networks?.length) t.push(...d.rip.networks);
      else if (d.rip.networks) t.push("none");
      if (d.rip.default) t.push("default");
      if (d.rip.static) t.push("static");
      L2.push("  " + t.join(" "));
      if (d.rip.passive?.length) L2.push(`  rip passive ${d.rip.passive.map(shortPort).join(" ")}`);
    }
    if (d.ospf) {
      L2.push(d.ospf.pid !== 1 ? `  ospf id ${d.ospf.pid}` : "  ospf");
      for (const n of d.ospf.networks) L2.push(`  ospf ${cidr(n.net, n.prefix)} area ${n.area}`);
      if (d.ospf.passive?.length) L2.push(`  ospf passive ${d.ospf.passive.map(shortPort).join(" ")}`);
      if (d.ospf.default) L2.push("  ospf default");
    }
    for (const r of d.nat ?? []) {
      const src = r.nets ? netList(r.nets) : `acl ${r.acl}`;
      if (r.kind === "overload") L2.push(`  nat overload ${src}${r.via ? " via " + shortPort(r.via) : ""}`);
      else if (r.kind === "pool") L2.push(`  nat pool ${r.start}-${r.end} /${r.prefix} for ${src}${r.overload ? " overload" : ""}${r.name ? " name " + r.name : ""}`);
      else if (r.kind === "static") L2.push(r.proto ? `  nat static ${r.proto} ${r.local}:${r.lport} ${r.global}:${r.gport}` : `  nat static ${r.local} ${r.global}`);
    }
    for (const x of d.dhcpExcluded ?? []) L2.push(`  dhcp exclude ${x.from}${x.to ? "-" + x.to : ""}`);
    for (const p of d.dhcpPools ?? []) {
      L2.push(`  dhcp ${cidr(p.net, p.prefix)}${p.gw ? " gw " + p.gw : ""}${p.dns?.length ? " dns " + p.dns.join(" ") : ""}${p.domain ? " domain " + p.domain : ""}${p.from ? " from " + p.from : ""}${p.max ? " max " + p.max : ""}${p.name ? " name " + p.name : ""}`);
    }
    for (const a of d.acls ?? []) {
      for (const r of a.rules) {
        L2.push(`  acl ${a.id} ${r.action}${r.proto ? " " + r.proto : ""} ${addrText(r.src)}${portSpecText(r.sp)}${r.dst ? " " + addrText(r.dst) + portSpecText(r.dp) : ""}${r.est ? " established" : ""}${r.log ? " log" : ""}`);
      }
    }
    const s = d.sec ?? {};
    if (s.enableSecret) L2.push(`  enable secret ${s.enableSecret}`);
    if (s.enablePassword) L2.push(`  enable password ${s.enablePassword}`);
    for (const u of s.users ?? []) L2.push(`  user ${u.name} ${u.pass}${u.priv ? " priv " + u.priv : ""}`);
    for (const [key, o] of [["vty", s.vty], ["console", s.console]]) {
      if (!o) continue;
      const t = [key];
      if (o.password) t.push("password", o.password);
      if (o.login === "local") t.push("login", "local");
      else if (o.login === "plain" && !o.password) t.push("login");
      if (o.transport) t.push("transport", o.transport);
      L2.push("  " + t.join(" "));
    }
    if (s.ssh) L2.push(`  ssh ${s.ssh}`);
    for (const [k, v] of Object.entries(d.services ?? {})) {
      if (k === "mail") L2.push(`  mail ${v ? "on" : "off"}`);
      else L2.push(`  ${k} ${v ? "on" : "off"}`);
    }
    if (d.mailDomain) L2.push(`  mail ${d.mailDomain}`);
    for (const u of d.mailUsers ?? []) L2.push(`  user ${u.name} ${u.pass}`);
    for (const r of d.dnsRecords ?? []) L2.push(`  ${r.type} ${r.name} ${r.value}`);
    for (const f of d.files ?? []) L2.push("", `  \`\`\`html ${f.name}`, ...f.content.split("\n").map((l) => l ? "  " + l : l), "  ```");
    if (d.cli) L2.push("", "  ```cli", ...d.cli.split("\n").map((l) => l ? "  " + l : l), "  ```");
    return L2;
  }
  var optText = (o) => {
    if (!o) return "";
    const t = [];
    if (o.vlan !== void 0) t.push("vlan", o.vlan);
    if (o.trunk) {
      t.push("trunk");
      if (o.trunk.allowed) t.push(o.trunk.allowed);
      if (o.trunk.native !== void 0) t.push("native", o.trunk.native);
    }
    if (o.clock !== void 0) t.push("clock", o.clock);
    return t.length ? " " + t.join(" ") : "";
  };
  function shortenLinks(devs, links, portsOf) {
    const devOf = (id) => devs.find((d) => d.id === id);
    const full = links.map((l) => ({ ...l, a: { ...l.a }, b: { ...l.b } }));
    const hidden = full.map(() => ({ a: true, b: true }));
    for (let guard = 0; guard < 4e3; guard++) {
      const probe = full.map((l, i) => ({ ...l, a: { dev: l.a.dev, port: hidden[i].a ? void 0 : l.a.port }, b: { dev: l.b.dev, port: hidden[i].b ? void 0 : l.b.port } }));
      let resolved;
      try {
        resolved = resolveLinks({ links: probe }, portsOf, devOf);
      } catch {
        resolved = null;
      }
      let bad = null;
      if (resolved) {
        outer: for (let i = 0; i < full.length; i++) for (const side of ["a", "b"]) {
          if (hidden[i][side] && resolved[i][side].port !== full[i][side].port) {
            bad = [i, side];
            break outer;
          }
        }
      } else {
        outer2: for (let i = 0; i < full.length; i++) for (const side of ["a", "b"]) if (hidden[i][side]) {
          bad = [i, side];
          break outer2;
        }
      }
      if (!bad) break;
      hidden[bad[0]][bad[1]] = false;
    }
    return hidden;
  }
  function stringifyPktmd(net, opts) {
    const { devs, links } = liftLinkOptions(net);
    const out = [];
    for (const d of devs) {
      out.push(...deviceLines(d, opts), "");
    }
    out.push("links:");
    const hidden = shortenLinks(devs, links, opts.portsOf);
    links.forEach((l, i) => {
      const a = hidden[i].a ? l.a.dev : `${l.a.dev}.${shortPort(l.a.port)}`;
      const b = hidden[i].b ? l.b.dev : `${l.b.dev}.${shortPort(l.b.port)}`;
      out.push(`  ${a} ${b}${optText(l.opts)}`);
    });
    return out.join("\n") + "\n";
  }

  // src/pktmd.js
  var ID_RE = /^[A-Za-z0-9_-]+$/;
  var HEADER_RE = /^([A-Za-z0-9_.-]+)\s*:\s*(.*)$/;
  var KEYWORDS = [
    "name",
    "pos",
    "ip",
    "gw",
    "dns",
    "domain",
    "vlan",
    "route",
    "rip",
    "ospf",
    "nat",
    "dhcp",
    "acl",
    "enable",
    "user",
    "vty",
    "console",
    "ssh",
    "module",
    "mail",
    "a",
    "cname",
    "ns",
    "http",
    "https",
    "ntp",
    "ftp",
    "tftp",
    "syslog"
  ];
  var SERVICES = ["http", "https", "ntp", "ftp", "tftp", "syslog"];
  var ON = ["on", "true", "yes", "si", "1"];
  var OFF = ["off", "false", "no", "0"];
  function dedent(lines) {
    const ind = Math.min(...lines.filter((l) => l.trim()).map((l) => /^\s*/.exec(l)[0].length), Infinity);
    return lines.map((l) => Number.isFinite(ind) ? l.slice(Math.min(ind, /^\s*/.exec(l)[0].length)) : l);
  }
  function ipToken(tok, nextTok, ln) {
    const [ip, p] = tok.split("/");
    if (!isIPv4(ip)) return null;
    let prefix, used = 1;
    if (p !== void 0) {
      prefix = /^\d+$/.test(p) ? +p : NaN;
      if (!(prefix >= 0 && prefix <= 32)) throw new PktmdError(`prefisso non valido: "/${p}"`, ln);
    } else if (nextTok !== void 0 && isIPv4(nextTok) && maskToPrefix(nextTok) !== void 0 && maskToPrefix(nextTok) > 0) {
      prefix = maskToPrefix(nextTok);
      used = 2;
    } else prefix = classfulPrefix(ip);
    return { ip, prefix, used };
  }
  var intTok = (t, what, ln) => {
    if (!/^\d+$/.test(t ?? "")) throw new PktmdError(`${what}: serve un numero (trovato "${t ?? ""}")`, ln);
    return +t;
  };
  var needIp = (t, what, ln) => {
    if (!isIPv4(t ?? "")) throw new PktmdError(`${what}: indirizzo IP non valido "${t ?? ""}"`, ln);
    return t;
  };
  var cidr2 = (t, ln) => {
    const c = parseCidr(t ?? "");
    if (!c || !String(t).includes("/")) throw new PktmdError(`rete non valida "${t ?? ""}" (si scrive come 192.168.1.0/24)`, ln);
    return c;
  };
  function expandPorts(spec, ln) {
    const out = [];
    for (const item of spec.split(",")) {
      const m = /^(.*?)(\d+)-(\d+)$/.exec(item);
      if (m && normalizePort(m[1] + m[2])) {
        const first = normalizePort(m[1] + m[2]);
        const a = +m[2], b = +m[3];
        if (b < a) throw new PktmdError(`intervallo non valido "${item}"`, ln);
        for (let i = a; i <= b; i++) out.push(first.replace(/(\d+)$/, String(i)));
      } else {
        const n = normalizePort(item);
        if (!n) throw new PktmdError(`porta non valida "${item}"`, ln);
        out.push(n);
      }
    }
    return out;
  }
  function parsePortOptions(toks, ln) {
    const a = {};
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i], tl = t.toLowerCase();
      const ip = ipToken(t, toks[i + 1], ln);
      if (ip) {
        a.ip = ip.ip;
        a.prefix = ip.prefix;
        i += ip.used - 1;
        continue;
      }
      switch (tl) {
        case "dhcp":
          a.dhcp = true;
          break;
        case "unnumbered": {
          const p = normalizePort(toks[++i] ?? "");
          if (!p) throw new PktmdError("unnumbered: manca la porta", ln);
          a.unnumbered = p;
          break;
        }
        case "access":
          a.mode = "access";
          if (/^\d+$/.test(toks[i + 1] ?? "")) a.access = +toks[++i];
          break;
        case "trunk": {
          a.mode = "trunk";
          if (/^[\d,\-]+$/.test(toks[i + 1] ?? "")) a.allowed = toks[++i];
          if ((toks[i + 1] ?? "").toLowerCase() === "native") {
            i++;
            a.native = intTok(toks[++i], "native", ln);
          }
          break;
        }
        case "native":
          a.native = intTok(toks[++i], "native", ln);
          break;
        case "vlan":
          a.vlan = intTok(toks[++i], "vlan", ln);
          break;
        case "down":
          a.admin = "down";
          break;
        case "up":
          a.admin = "up";
          break;
        case "inside":
        case "outside":
          a.nat = tl;
          break;
        case "nat": {
          const v = (toks[++i] ?? "").toLowerCase();
          if (!["inside", "outside", "off"].includes(v)) throw new PktmdError("nat: scrivi inside, outside oppure off", ln);
          a.nat = v;
          break;
        }
        case "helper":
          (a.helper ??= []).push(needIp(toks[++i], "helper", ln));
          break;
        case "acl": {
          const name = toks[++i], dir = (toks[++i] ?? "").toLowerCase();
          if (!name || !["in", "out"].includes(dir)) throw new PktmdError('acl: scrivi "acl NOME in" oppure "acl NOME out"', ln);
          (a.acl ??= {})[dir] = name;
          break;
        }
        case "clock": {
          if (/^\d+$/.test(toks[i + 1] ?? "")) a.clock = +toks[++i];
          else a.clock = 2e6;
          break;
        }
        case "desc":
        case "description":
          a.desc = toks.slice(i + 1).join(" ");
          i = toks.length;
          break;
        default:
          throw new PktmdError(`opzione di porta sconosciuta "${t}" (valide: IP/n, dhcp, access N, trunk [lista] [native N], vlan N, down, up, inside, outside, helper IP, acl NOME in|out, clock, desc testo)`, ln);
      }
    }
    return a;
  }
  function parseNets(toks, from, stop, ln) {
    const nets = [];
    let i = from;
    for (; i < toks.length && !stop.includes(toks[i].toLowerCase()); i++) nets.push(cidr2(toks[i], ln));
    return [nets, i];
  }
  function parseAddrTok(toks, i, ln) {
    const t = toks[i];
    if (t === "any") return [{ any: true }, i + 1];
    if (t === "host") return [{ host: needIp(toks[i + 1], "host", ln) }, i + 2];
    if (t && t.includes("/")) {
      const c = cidr2(t, ln);
      return [c.prefix === 32 ? { host: c.net } : { net: c.net, prefix: c.prefix }, i + 1];
    }
    if (isIPv4(t ?? "")) return [{ host: t }, i + 1];
    throw new PktmdError(`indirizzo non valido "${t ?? ""}" (usa any, host A, oppure rete/n)`, ln);
  }
  var ACL_PROTOS = /* @__PURE__ */ new Set(["ip", "tcp", "udp", "icmp", "eigrp", "ospf", "gre", "esp", "ahp"]);
  function parseAclLine(toks, ln) {
    const id = toks[1], action = (toks[2] ?? "").toLowerCase();
    if (!id) throw new PktmdError("acl: manca il nome", ln);
    if (!["permit", "deny"].includes(action)) throw new PktmdError("acl: dopo il nome scrivi permit o deny", ln);
    let i = 3;
    const rule = { action };
    const extended = ACL_PROTOS.has((toks[i] ?? "").toLowerCase());
    if (extended) rule.proto = toks[i++].toLowerCase();
    [rule.src, i] = parseAddrTok(toks, i, ln);
    const portSpec = () => {
      const op = (toks[i] ?? "").toLowerCase();
      if (["eq", "gt", "lt", "neq"].includes(op)) {
        const p = { op, a: toks[i + 1] };
        i += 2;
        return p;
      }
      if (op === "range") {
        const p = { op, a: toks[i + 1], b: toks[i + 2] };
        i += 3;
        return p;
      }
      return void 0;
    };
    if (extended) {
      const sp = portSpec();
      if (sp) rule.sp = sp;
      [rule.dst, i] = parseAddrTok(toks, i, ln);
      const dp = portSpec();
      if (dp) rule.dp = dp;
    }
    for (; i < toks.length; i++) {
      const f = toks[i].toLowerCase();
      if (f === "log") rule.log = true;
      else if (f === "established" && extended) rule.est = true;
      else throw new PktmdError(`acl: "${toks[i]}" non e' valido qui`, ln);
    }
    return { id, rule, extended };
  }
  function parsePktmd(text) {
    const lines = text.replace(/\r\n?/g, "\n").split("\n");
    const devices = [];
    const links = [];
    const warnings = [];
    const byId = /* @__PURE__ */ new Map();
    let cur = null;
    let inLinks = false;
    for (let i = 0; i < lines.length; i++) {
      const ln = i + 1;
      const t0 = lines[i].trim();
      if (!t0 || t0.startsWith("//")) continue;
      const t = t0.startsWith("```") ? t0 : t0.replace(/\s+\/\/.*$/, "");
      if (t0.startsWith("```")) {
        const info = t0.slice(3).trim().split(/\s+/).filter(Boolean);
        const body = [];
        let j = i + 1;
        while (j < lines.length && lines[j].trim() !== "```") {
          if (/^```\S/.test(lines[j].trim())) {
            throw new PktmdError(`il blocco aperto qui non e' chiuso: manca \`\`\` prima della riga ${j + 1} (nuovo blocco "${lines[j].trim()}")`, ln);
          }
          body.push(lines[j++]);
        }
        if (j >= lines.length) throw new PktmdError("blocco ``` non chiuso (manca la riga ``` finale)", ln);
        i = j;
        if (!cur) throw new PktmdError("blocco di codice fuori da un dispositivo", ln);
        const content = dedent(body).join("\n");
        const kind = (info[0] || "").toLowerCase();
        if (kind === "cli" || kind === "ios") {
          if (cur.type === "pc" || cur.type === "server") throw new PktmdError(`${cur.id}: il blocco cli vale solo per router e switch`, ln);
          cur.cli = cur.cli ? cur.cli + "\n" + content : content;
        } else {
          const name = info[1] ?? (info[0]?.includes(".") ? info[0] : void 0);
          if (!name) throw new PktmdError("blocco senza nome: usa ```cli oppure ```html nomefile.html", ln);
          if (cur.type !== "server") throw new PktmdError(`i file HTTP sono supportati solo sui server (${cur.id} e' un ${cur.type})`, ln);
          cur.files = cur.files.filter((f) => f.name !== name);
          cur.files.push({ name, content });
        }
        continue;
      }
      if (t === "---" || /^links\s*:$/i.test(t)) {
        inLinks = true;
        cur = null;
        continue;
      }
      if (inLinks) {
        links.push(parseLink(t, ln));
        continue;
      }
      const h2 = HEADER_RE.exec(t);
      if (h2) {
        const [, id, rest] = h2;
        if (KEYWORDS.includes(id.toLowerCase()) && rest.trim() && !typeFromAlias(rest.trim().split(/\s+/)[0])) {
          throw new PktmdError(`"${id}" e' una proprieta': si scrive senza i due punti (es. "${id} ${rest.trim()}")`, ln);
        }
        if (!ID_RE.test(id)) throw new PktmdError(`nome non valido: "${id}" (ammessi lettere, cifre, _ e -)`, ln);
        if (byId.has(id)) throw new PktmdError(`dispositivo "${id}" definito due volte (riga ${byId.get(id).line})`, ln);
        cur = newDevice(id, rest.trim(), ln);
        devices.push(cur);
        byId.set(id, cur);
        continue;
      }
      if (!cur) throw new PktmdError(`riga fuori da un dispositivo: "${t}"`, ln);
      parseProperty(cur, t.split(/\s+/), ln);
    }
    for (const l of links) {
      for (const e of [l.a, l.b]) if (!byId.has(e.dev)) throw new PktmdError(`collegamento verso "${e.dev}": dispositivo inesistente`, l.line);
      if (l.a.dev === l.b.dev) throw new PktmdError(`"${l.a.dev}" collegato a se stesso`, l.line);
    }
    for (const d of devices) finishDevice(d);
    return { network: { devices, links }, warnings };
  }
  function newDevice(id, rest, ln) {
    let type, model, nic, nicSlot;
    if (rest) {
      const toks = rest.split(/\s+/);
      type = typeFromAlias(toks[0]);
      if (!type) {
        const hint = KEYWORDS.includes(toks[0].toLowerCase()) || looksLikePort(toks[0]) ? `: dopo i due punti va solo il tipo, scrivi "${toks.join(" ")}" sulla riga sotto` : ` (tipi: ${TYPES.join(", ")})`;
        throw new PktmdError(`tipo sconosciuto "${toks[0]}"${hint}`, ln);
      }
      for (const tok of toks.slice(1)) {
        const lower = tok.toLowerCase();
        const nm = /^(fa|gig|fiber)(\d)?$/.exec(lower);
        if ((type === "pc" || type === "server") && nm) {
          nic = nm[1];
          if (nm[2]) nicSlot = +nm[2];
          continue;
        }
        const m = modelFromToken(type, tok);
        if (!m) throw new PktmdError(`modello sconosciuto "${tok}" per ${type} (validi: ${[...tokensFor(type), ...type === "pc" || type === "server" ? Object.keys(NICS) : []].join(", ") || "nessuno"})`, ln);
        model = m.key;
      }
    } else {
      type = inferType(id);
      if (!type) throw new PktmdError(`non riconosco il tipo di "${id}": scrivi "${id}: router" (o pc, switch, server), oppure usa un nome come pc1, r1, sw1, srv1`, ln);
    }
    if (type === "laptop") throw new PktmdError("il laptop non e' ancora supportato (non ho un template: mandami un .pkt che ne contenga uno)", ln);
    const d = {
      id,
      type,
      ports: [],
      files: [],
      dns: [],
      routes: [],
      nat: [],
      acls: [],
      dhcpPools: [],
      dhcpExcluded: [],
      vlans: [],
      modules: [],
      line: ln
    };
    if (model && model !== DEFAULT_MODEL[type]) d.model = model;
    if (nic && !(nic === "fa" && !nicSlot)) {
      d.nic = nic;
      if (nicSlot) d.nicSlot = nicSlot;
    }
    return d;
  }
  function finishDevice(d) {
    if (d.sec?.vty?.password && !d.sec.vty.login) d.sec.vty.login = "plain";
    if (d.sec?.console?.password && !d.sec.console.login) d.sec.console.login = "plain";
  }
  var LINK_SEPARATORS = /* @__PURE__ */ new Set(["-", "--", "->", "<->", "=", "=="]);
  function parseLink(t, ln) {
    const toks = t.split(/\s+/).filter((x) => !LINK_SEPARATORS.has(x));
    if (toks.length < 2) throw new PktmdError(`collegamento non valido: "${t}" (servono due estremi, es. "pc1 sw1")`, ln);
    const ends = toks.slice(0, 2).map((tok) => {
      const k = tok.indexOf(".");
      const dev = k < 0 ? tok : tok.slice(0, k);
      let port;
      if (k >= 0) {
        port = normalizePort(tok.slice(k + 1));
        if (!port) throw new PktmdError(`porta non valida: "${tok.slice(k + 1)}"`, ln);
      }
      return { dev, port };
    });
    const link = { a: ends[0], b: ends[1], line: ln };
    const opts = {};
    const rest = toks.slice(2);
    for (let i = 0; i < rest.length; i++) {
      const w = rest[i].toLowerCase();
      if (w === "vlan") opts.vlan = intTok(rest[++i], "vlan", ln);
      else if (w === "trunk") {
        const tr = {};
        if (/^[\d,\-]+$/.test(rest[i + 1] ?? "")) tr.allowed = rest[++i];
        if ((rest[i + 1] ?? "").toLowerCase() === "native") {
          i++;
          tr.native = intTok(rest[++i], "native", ln);
        }
        opts.trunk = tr;
      } else if (w === "clock") opts.clock = /^\d+$/.test(rest[i + 1] ?? "") ? +rest[++i] : 2e6;
      else throw new PktmdError(`opzione di collegamento sconosciuta "${rest[i]}" (valide: vlan N, trunk [lista] [native N], clock [rate])`, ln);
    }
    if (opts.vlan !== void 0 && opts.trunk) throw new PktmdError(`un collegamento non puo' essere insieme "vlan" e "trunk"`, ln);
    if (Object.keys(opts).length) link.opts = opts;
    return link;
  }
  function parseProperty(d, toks, ln) {
    const key = toks[0].toLowerCase();
    const rest = toks.slice(1);
    const only = (types, what) => {
      if (!types.includes(d.type)) throw new PktmdError(`${d.id}: "${what}" non vale per un ${d.type}`, ln);
    };
    const toggle = (v) => ON.includes(v) ? true : OFF.includes(v) ? false : void 0;
    if (looksLikeStart(toks[0])) {
      only(["router", "switch"], "le porte");
      const names = expandPorts(toks[0], ln);
      const opts = parsePortOptions(rest, ln);
      for (const name of names) {
        const p = { name, ...opts, line: ln };
        const sub = /\.(\d+)$/.exec(name);
        if (sub && p.vlan === void 0) p.vlan = +sub[1];
        if (p.helper) p.helper = [...p.helper];
        d.ports.push(p);
      }
      return;
    }
    switch (key) {
      case "name":
        only(["router", "switch"], "name");
        if (!rest.length) throw new PktmdError("name: manca l'hostname", ln);
        d.hostname = rest.join(" ");
        return;
      case "pos": {
        const x = parseFloat(rest[0]), y = parseFloat(rest[1]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) throw new PktmdError("pos vuole due numeri: pos 120 80", ln);
        d.pos = { x, y };
        d.posLine = ln;
        return;
      }
      case "ip": {
        if ((rest[0] ?? "").toLowerCase() === "dhcp") {
          d.ports.push({ name: ipName(d, void 0), dhcp: true, line: ln });
          return;
        }
        const ip = ipToken(rest[0] ?? "", rest[1], ln);
        if (!ip) throw new PktmdError(`ip: indirizzo non valido "${rest[0] ?? ""}" (esempio: ip 192.168.1.1/24)`, ln);
        const tail = rest.slice(ip.used);
        let vlan;
        if ((tail[0] ?? "").toLowerCase() === "vlan") {
          vlan = intTok(tail[1], "vlan", ln);
          if (tail.length > 2) throw new PktmdError(`dopo "vlan N" non c'e' altro`, ln);
          if (d.type !== "switch" && d.type !== "router") throw new PktmdError('"ip ... vlan N" vale per switch e router', ln);
        } else if (tail.length) throw new PktmdError(`ip: "${tail[0]}" non e' valido qui`, ln);
        d.ports.push({ name: ipName(d, vlan), ip: ip.ip, prefix: ip.prefix, line: ln });
        return;
      }
      case "gw":
        d.gw = needIp(rest[0], "gw", ln);
        return;
      case "dns": {
        const v = (rest[0] ?? "").toLowerCase();
        if (d.type === "server" && (ON.includes(v) || OFF.includes(v))) {
          (d.services ??= {}).dns = toggle(v);
          return;
        }
        if (!rest.length) throw new PktmdError("dns: manca l'indirizzo del server DNS", ln);
        d.dns.push(...rest.map((x) => needIp(x, "dns", ln)));
        return;
      }
      case "domain":
        only(["router", "switch"], "domain");
        d.domain = rest[0];
        if (!d.domain) throw new PktmdError("domain: manca il nome", ln);
        return;
      case "vlan": {
        only(["switch"], "vlan");
        const id = intTok(rest[0], "vlan", ln);
        if (id < 1 || id > 4094) throw new PktmdError(`vlan ${id}: fuori intervallo (1-4094)`, ln);
        d.vlans.push({ id, ...rest.length > 1 ? { name: rest.slice(1).join("_") } : {}, line: ln });
        return;
      }
      case "route": {
        only(["router"], "route");
        const r = { line: ln };
        if ((rest[0] ?? "").toLowerCase() === "default") {
          r.net = "0.0.0.0";
          r.prefix = 0;
        } else {
          const c = cidr2(rest[0], ln);
          r.net = c.net;
          r.prefix = c.prefix;
        }
        if ((rest[1] ?? "").toLowerCase() !== "via") throw new PktmdError('route: manca "via <indirizzo|porta>" (es. route 10.0.0.0/8 via 192.168.1.2)', ln);
        const via = rest[2];
        if (isIPv4(via ?? "")) r.via = via;
        else if (normalizePort(via ?? "")) r.port = normalizePort(via);
        else throw new PktmdError(`route: "via ${via ?? ""}" non e' un indirizzo ne' una porta`, ln);
        if ((rest[3] ?? "").toLowerCase() === "ad") r.ad = intTok(rest[4], "ad", ln);
        d.routes.push(r);
        return;
      }
      case "rip": {
        only(["router"], "rip");
        const rip = d.rip ??= { passive: [] };
        for (let i = 0; i < rest.length; i++) {
          const w = rest[i].toLowerCase();
          if (w === "v1") rip.v = 1;
          else if (w === "v2") rip.v = 2;
          else if (w === "autosum") rip.autosum = true;
          else if (w === "none") rip.networks = [];
          else if (w === "default") rip.default = true;
          else if (w === "static") rip.static = true;
          else if (w === "passive") {
            for (i++; i < rest.length && normalizePort(rest[i]); i++) rip.passive.push(normalizePort(rest[i]));
            i--;
          } else if (isIPv4(rest[i])) (rip.networks ??= []).push(rest[i]);
          else throw new PktmdError(`rip: "${rest[i]}" non e' valido (valide: v1, v2, autosum, default, static, passive <porte>, oppure reti come 10.0.0.0)`, ln);
        }
        return;
      }
      case "ospf": {
        only(["router"], "ospf");
        const o = d.ospf ??= { pid: 1, networks: [], passive: [] };
        const w = (rest[0] ?? "").toLowerCase();
        if (w === "id") o.pid = intTok(rest[1], "ospf id", ln);
        else if (w === "passive") for (const p of rest.slice(1)) {
          const n = normalizePort(p);
          if (!n) throw new PktmdError(`porta non valida "${p}"`, ln);
          o.passive.push(n);
        }
        else if (w === "default") o.default = true;
        else if (rest.length) {
          const c = cidr2(rest[0], ln);
          if ((rest[1] ?? "").toLowerCase() !== "area") throw new PktmdError('ospf: manca "area N" (es. ospf 192.168.1.0/24 area 0)', ln);
          o.networks.push({ net: c.net, prefix: c.prefix, area: rest[2] ?? "0" });
        }
        return;
      }
      case "nat":
        only(["router"], "nat");
        d.nat.push(parseNat(rest, ln));
        return;
      case "dhcp":
        return parseDhcp(d, rest, ln, toggle);
      case "acl": {
        only(["router", "switch"], "acl");
        const { id, rule, extended } = parseAclLine(toks, ln);
        let acl = d.acls.find((a) => a.id === id);
        if (!acl) {
          acl = { id, numbered: /^\d+$/.test(id), ext: extended, rules: [], line: ln };
          d.acls.push(acl);
        } else if (acl.ext !== extended) throw new PktmdError(`acl ${id}: non si possono mescolare regole standard (solo sorgente) ed estese (con protocollo)`, ln);
        acl.rules.push(rule);
        return;
      }
      case "enable": {
        only(["router", "switch"], "enable");
        const kind = (rest[0] ?? "").toLowerCase();
        if (!["secret", "password"].includes(kind) || !rest[1]) throw new PktmdError('enable: scrivi "enable secret <password>" oppure "enable password <password>"', ln);
        (d.sec ??= {})[kind === "secret" ? "enableSecret" : "enablePassword"] = rest[1];
        return;
      }
      case "user": {
        if (d.type === "server") {
          if (rest.length < 2) throw new PktmdError("user: servono nome e password (utente di posta)", ln);
          (d.mailUsers ??= []).push({ name: rest[0], pass: rest[1] });
          return;
        }
        only(["router", "switch"], "user");
        if (rest.length < 2) throw new PktmdError("user: servono nome e password", ln);
        const u = { name: rest[0], pass: rest[1] };
        if ((rest[2] ?? "").toLowerCase() === "priv") u.priv = intTok(rest[3], "priv", ln);
        ((d.sec ??= {}).users ??= []).push(u);
        return;
      }
      case "vty":
      case "console": {
        only(["router", "switch"], key);
        const o = {};
        for (let i = 0; i < rest.length; i++) {
          const w = rest[i].toLowerCase();
          if (w === "password") o.password = rest[++i];
          else if (w === "login") {
            if ((rest[i + 1] ?? "").toLowerCase() === "local") {
              i++;
              o.login = "local";
            } else o.login = "plain";
          } else if (w === "local") o.login = "local";
          else if (w === "transport") o.transport = rest[++i];
          else if (w === "ssh") {
            o.login = "local";
            o.transport = "ssh";
          } else if (w === "telnet") o.transport = "telnet";
          else throw new PktmdError(`${key}: "${rest[i]}" non e' valido (valide: password X, login [local], transport T, ssh, telnet)`, ln);
        }
        const sec = d.sec ??= {};
        sec[key] = { ...sec[key] ?? {}, ...o };
        return;
      }
      case "ssh":
        only(["router", "switch"], "ssh");
        (d.sec ??= {}).ssh = rest[0] ? intTok(rest[0], "ssh", ln) : 2;
        return;
      case "module": {
        only(["router", "switch"], "module");
        const m = {};
        for (let i = 0; i < rest.length; i++) {
          if (rest[i].toLowerCase() === "slot") m.slot = intTok(rest[++i], "slot", ln);
          else if (!m.name) m.name = rest[i];
          else throw new PktmdError(`module: "${rest[i]}" non e' valido qui`, ln);
        }
        if (!m.name) throw new PktmdError("module: manca il nome del modulo (es. module serial)", ln);
        d.modules.push(m);
        return;
      }
      case "mail": {
        if (d.type === "server") {
          const v = (rest[0] ?? "").toLowerCase();
          if (ON.includes(v) || OFF.includes(v)) {
            (d.services ??= {}).mail = ON.includes(v);
            return;
          }
          if (!rest[0] || !rest[0].includes(".")) throw new PktmdError("mail: scrivi il dominio del server (es. mail pippo.it) oppure on/off", ln);
          d.mailDomain = rest[0];
          return;
        }
        only(["pc"], "mail");
        if (!/^[^@\s]+@[^@\s]+$/.test(rest[0] ?? "") || !rest[1]) throw new PktmdError('mail: scrivi "mail utente@dominio.it password [pop3 host] [smtp host]"', ln);
        const m = { address: rest[0], pass: rest[1] };
        for (let i = 2; i < rest.length; i += 2) {
          const w = rest[i].toLowerCase();
          if (!["pop3", "smtp", "user", "name"].includes(w) || !rest[i + 1]) throw new PktmdError(`mail: "${rest[i]}" non e' valido (valide: pop3 H, smtp H, user U, name N)`, ln);
          m[w] = rest[i + 1];
        }
        d.mail = m;
        return;
      }
      case "a":
      case "cname":
      case "ns": {
        only(["server"], key);
        if (rest.length !== 2) throw new PktmdError(`${key}: servono due valori (${key === "a" ? "a www.esempio.it 1.2.3.4" : key === "cname" ? "cname web.esempio.it www.esempio.it" : "ns . dnsroot"})`, ln);
        if (key === "a") needIp(rest[1], "a", ln);
        (d.dnsRecords ??= []).push({ type: key, name: rest[0], value: rest[1] });
        return;
      }
      default:
        if (SERVICES.includes(key)) {
          only(["server"], key);
          const v = (rest[0] ?? "").toLowerCase();
          if (!ON.includes(v) && !OFF.includes(v)) throw new PktmdError(`${key}: scrivi on oppure off`, ln);
          (d.services ??= {})[key] = ON.includes(v);
          return;
        }
        throw new PktmdError(`proprieta' sconosciuta "${toks[0]}" (usa ip, gw, dns, name, vlan, route, rip, nat, dhcp, acl, user, mail, ... oppure il nome di una porta come fa0/0)`, ln);
    }
  }
  function looksLikeStart(tok) {
    return tok.split(",").every((item) => {
      const m = /^(.*?)(\d+)-(\d+)$/.exec(item);
      return !!normalizePort(m ? m[1] + m[2] : item);
    });
  }
  function ipName(d, vlan) {
    if (vlan !== void 0) return `Vlan${vlan}`;
    return d.type === "switch" ? "Vlan1" : null;
  }
  function parseNat(rest, ln) {
    const kind = (rest[0] ?? "").toLowerCase();
    const r = { line: ln };
    if (kind === "overload") {
      r.kind = "overload";
      let i = 1;
      if ((rest[i] ?? "").toLowerCase() === "acl") {
        r.acl = rest[i + 1];
        if (!r.acl) throw new PktmdError("nat overload acl: manca il nome", ln);
        i += 2;
      } else {
        [r.nets, i] = parseNets(rest, i, ["via"], ln);
        if (!r.nets.length) throw new PktmdError("nat overload: manca la rete interna (es. nat overload 192.168.1.0/24)", ln);
      }
      if ((rest[i] ?? "").toLowerCase() === "via") {
        const p = normalizePort(rest[i + 1] ?? "");
        if (!p) throw new PktmdError("nat overload via: manca la porta di uscita", ln);
        r.via = p;
        i += 2;
      }
      if (i < rest.length) throw new PktmdError(`nat overload: "${rest[i]}" non e' valido qui`, ln);
      return r;
    }
    if (kind === "pool") {
      r.kind = "pool";
      const range = /^(\d+\.\d+\.\d+\.\d+)-(\d+\.\d+\.\d+\.\d+)$/.exec(rest[1] ?? "");
      if (!range) throw new PktmdError("nat pool: scrivi l'intervallo come 8.8.9.10-8.8.9.20 (es. nat pool 8.8.9.10-8.8.9.20 /24 for 192.168.1.0/24)", ln);
      r.start = range[1];
      r.end = range[2];
      const m = rest[2] ?? "";
      r.prefix = m.startsWith("/") ? +m.slice(1) : maskToPrefix(m);
      if (!(r.prefix >= 0 && r.prefix <= 32)) throw new PktmdError("nat pool: manca la maschera (es. /24)", ln);
      if ((rest[3] ?? "").toLowerCase() !== "for") throw new PktmdError('nat pool: manca "for <reti>"', ln);
      let i = 4;
      if ((rest[i] ?? "").toLowerCase() === "acl") {
        r.acl = rest[i + 1];
        i += 2;
      } else {
        [r.nets, i] = parseNets(rest, i, ["overload", "name"], ln);
        if (!r.nets.length) throw new PktmdError('nat pool: manca la rete interna dopo "for"', ln);
      }
      for (; i < rest.length; i++) {
        const w = rest[i].toLowerCase();
        if (w === "overload") r.overload = true;
        else if (w === "name") r.name = rest[++i];
        else throw new PktmdError(`nat pool: "${rest[i]}" non e' valido qui`, ln);
      }
      return r;
    }
    if (kind === "static") {
      r.kind = "static";
      let i = 1;
      if (["tcp", "udp"].includes((rest[i] ?? "").toLowerCase())) {
        r.proto = rest[i].toLowerCase();
        i++;
      }
      const split = (tok) => {
        const [ip, port] = (tok ?? "").split(":");
        if (!isIPv4(ip ?? "")) throw new PktmdError(`nat static: indirizzo non valido "${tok ?? ""}"`, ln);
        return [ip, port === void 0 ? void 0 : +port];
      };
      const [l, lp] = split(rest[i]);
      const [g, gp] = split(rest[i + 1]);
      r.local = l;
      r.global = g;
      if (r.proto) {
        if (lp === void 0 || gp === void 0) throw new PktmdError("nat static tcp/udp: servono le porte (es. nat static tcp 192.168.1.10:80 8.8.8.1:80)", ln);
        r.lport = lp;
        r.gport = gp;
      }
      return r;
    }
    throw new PktmdError('nat: scrivi "nat overload ...", "nat pool ..." oppure "nat static ..."', ln);
  }
  function parseDhcp(d, rest, ln, toggle) {
    const first = (rest[0] ?? "").toLowerCase();
    if (d.type === "server" && (ON.includes(first) || OFF.includes(first))) {
      (d.services ??= {}).dhcp = toggle(first);
      return;
    }
    if (first === "exclude") {
      if (d.type !== "router") throw new PktmdError("dhcp exclude vale per i router", ln);
      const m = /^(\d+\.\d+\.\d+\.\d+)(?:-(\d+\.\d+\.\d+\.\d+))?$/.exec(rest[1] ?? "");
      if (!m) throw new PktmdError("dhcp exclude: scrivi un indirizzo o un intervallo (10.0.0.1-10.0.0.10)", ln);
      d.dhcpExcluded.push({ from: m[1], ...m[2] ? { to: m[2] } : {} });
      return;
    }
    if (d.type !== "server" && d.type !== "router") throw new PktmdError(`${d.id}: "dhcp" non vale per un ${d.type} (per essere client scrivi "ip dhcp")`, ln);
    const c = cidr2(rest[0], ln);
    const p = { net: c.net, prefix: c.prefix, line: ln };
    for (let i = 1; i < rest.length; i++) {
      const w = rest[i].toLowerCase();
      if (w === "gw") p.gw = needIp(rest[++i], "gw", ln);
      else if (w === "dns") {
        (p.dns ??= []).push(needIp(rest[++i], "dns", ln));
        while (isIPv4(rest[i + 1] ?? "")) p.dns.push(rest[++i]);
      } else if (w === "domain") p.domain = rest[++i];
      else if (w === "name") p.name = rest[++i];
      else if (w === "from" && d.type === "server") p.from = needIp(rest[++i], "from", ln);
      else if (w === "max" && d.type === "server") p.max = intTok(rest[++i], "max", ln);
      else throw new PktmdError(`dhcp: "${rest[i]}" non e' valido qui (valide: gw, dns, domain, name${d.type === "server" ? ", from, max" : ""})`, ln);
    }
    d.dhcpPools.push(p);
  }

  // src/template-data.js
  var template_data_default = "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";

  // src/hw.js
  var SINGLE_MODE_MODULES = /* @__PURE__ */ new Set(["PT-ROUTER-NM-1FGE-SM", "HWIC-1GE-SFP"]);
  function inventory(engine, spec) {
    const top = child(engine, "MODULE");
    const out = [];
    const portsOf = (mod) => childrenOf(mod, "PORT");
    const slotsOf = (mod) => childrenOf(mod, "SLOT");
    const push = (name, node, module, slot) => out.push({ name, type: textOf(node, "TYPE"), node, module, slot });
    if (spec.family === "host") {
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
        const n = count[pre] = (count[pre] ?? 0) + 1;
        push(`${pre}0/${n}`, p, "", -1);
      }
    }
    return out;
  }
  function slotContainers(engine, spec) {
    const top = child(engine, "MODULE");
    if (spec.family === "isr") return childrenOf(child(childrenOf(top, "SLOT")[0], "MODULE"), "SLOT");
    if (spec.family === "ptrouter" || spec.family === "ptswitch" || spec.family === "host") return childrenOf(top, "SLOT");
    return [];
  }
  var resolveModuleName = (token) => MODULE_ALIASES[token.toLowerCase()] ?? token;
  function installModule(engine, spec, name, lib, slotIndex) {
    const def = lib.get(name);
    if (!def) throw new PktmdError(`modulo sconosciuto "${name}" (disponibili: ${[...lib.keys()].join(", ")})`);
    const slots = slotContainers(engine, spec);
    const fits = (s) => textOf(s, "TYPE") === def.slotType;
    let target;
    if (slotIndex !== void 0) {
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
  function setNic(engine, spec, nic, lib, slotIndex = 0) {
    const name = NICS[nic];
    if (!name) throw new PktmdError(`scheda di rete sconosciuta "${nic}" (valide: ${Object.keys(NICS).join(", ")})`);
    const slots = slotContainers(engine, spec);
    const def = lib.get(name);
    const slot = slots[slotIndex];
    if (!slot || textOf(slot, "TYPE") !== def.slotType) throw new PktmdError(`la scheda ${nic} non entra nello slot ${slotIndex}`);
    slot.children = slot.children.filter((c) => c.tag !== "MODULE");
    slot.children.push(clone(def.node));
    for (const s of slots) if (s !== slot && child(s, "MODULE") && /PT-HOST-NM/.test(textOf(child(s, "MODULE"), "MODEL"))) s.children = s.children.filter((c) => c.tag !== "MODULE");
  }
  function cableKind(a, b) {
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
    return null;
  }
  var isSerialPort = (p) => isSerialPortType(p.type);

  // src/ios.js
  function toBlocks(lines) {
    const blocks = [];
    let cur = null;
    for (const l of lines) {
      const t = l.trim();
      if (!t || t === "!" || t === "end") {
        cur = null;
        continue;
      }
      if (/^\s/.test(l)) {
        if (cur) cur.body.push(l);
      } else {
        cur = { head: l.trimEnd(), body: [] };
        blocks.push(cur);
      }
    }
    return blocks;
  }
  var blockLines = (b) => [b.head, ...b.body];
  var blocksToCli = (blocks) => blocks.map((b) => blockLines(b).join("\n")).join("\n");
  var PORT_OPS = ["eq", "gt", "lt", "neq"];
  function parseAddr(t, i) {
    if (t[i] === "any") return [{ any: true }, i + 1];
    if (t[i] === "host" && isIPv4(t[i + 1] ?? "")) return [{ host: t[i + 1] }, i + 2];
    if (isIPv4(t[i] ?? "")) {
      if (isIPv4(t[i + 1] ?? "")) {
        const p = wildcardToPrefix(t[i + 1]);
        if (p === void 0) return [null, i];
        return [p === 32 ? { host: t[i] } : { net: networkAddress(t[i], p), prefix: p }, i + 2];
      }
      return [{ host: t[i] }, i + 1];
    }
    return [null, i];
  }
  function parsePortSpec(t, i) {
    if (PORT_OPS.includes(t[i]) && t[i + 1]) return [{ op: t[i], a: t[i + 1] }, i + 2];
    if (t[i] === "range" && t[i + 1] && t[i + 2]) return [{ op: "range", a: t[i + 1], b: t[i + 2] }, i + 3];
    return [void 0, i];
  }
  function parseAclRule(text, extended) {
    const t = text.trim().split(/\s+/);
    const action = t[0];
    if (action !== "permit" && action !== "deny") return null;
    let i = 1;
    const rule = { action };
    if (extended) {
      rule.proto = t[i++];
      if (!rule.proto) return null;
      let a;
      [a, i] = parseAddr(t, i);
      if (!a) return null;
      rule.src = a;
      [rule.sp, i] = parsePortSpec(t, i);
      [a, i] = parseAddr(t, i);
      if (!a) return null;
      rule.dst = a;
      [rule.dp, i] = parsePortSpec(t, i);
      for (; i < t.length; i++) {
        if (t[i] === "established") rule.est = true;
        else if (t[i] === "log") rule.log = true;
        else return null;
      }
    } else {
      const [a, j] = parseAddr(t, i);
      if (!a) return null;
      rule.src = a;
      i = j;
      for (; i < t.length; i++) {
        if (t[i] === "log") rule.log = true;
        else return null;
      }
    }
    return rule;
  }
  var addrToIos = (a) => a.any ? "any" : a.host ? `host ${a.host}` : `${a.net} ${prefixToWildcard(a.prefix)}`;
  var portSpecToIos = (p) => p ? ` ${p.op} ${p.a}${p.b ? " " + p.b : ""}` : "";
  function aclRuleToIos(r) {
    if (r.proto === void 0) return `${r.action} ${addrToIos(r.src)}${r.log ? " log" : ""}`;
    return `${r.action} ${r.proto} ${addrToIos(r.src)}${portSpecToIos(r.sp)} ${addrToIos(r.dst)}${portSpecToIos(r.dp)}${r.est ? " established" : ""}${r.log ? " log" : ""}`;
  }
  var isNumberedExt = (n) => n >= 100 && n <= 199 || n >= 2e3 && n <= 2699;
  function liftInterface(b, name, ctx) {
    const p = { name };
    const extras = [];
    for (const raw of b.body) {
      const l = raw.trim();
      let m;
      if ((m = /^ip address (\S+) (\S+)$/.exec(l)) && isIPv4(m[1]) && maskToPrefix(m[2]) !== void 0) {
        p.ip = m[1];
        p.prefix = maskToPrefix(m[2]);
      } else if (l === "ip address dhcp") p.dhcp = true;
      else if (l === "no ip address") {
      } else if (l === "shutdown") p.shutdown = true;
      else if (l === "duplex auto" || l === "speed auto") {
      } else if (m = /^description (.+)$/.exec(l)) p.desc = m[1];
      else if (l === "ip nat inside") p.nat = "inside";
      else if (l === "ip nat outside") p.nat = "outside";
      else if ((m = /^ip helper-address (\S+)$/.exec(l)) && isIPv4(m[1])) (p.helper ??= []).push(m[1]);
      else if (m = /^ip access-group (\S+) (in|out)$/.exec(l)) (p.acl ??= {})[m[2]] = m[1];
      else if (m = /^encapsulation dot1Q (\d+)$/i.exec(l)) p.vlan = +m[1];
      else if (m = /^clock rate (\d+)$/.exec(l)) p.clock = +m[1];
      else if (m = /^ip unnumbered (\S+)$/.exec(l)) p.unnumbered = m[1];
      else if (l === "switchport mode access") p.mode = "access";
      else if (l === "switchport mode trunk") p.mode = "trunk";
      else if (m = /^switchport access vlan (\d+)$/.exec(l)) p.access = +m[1];
      else if (m = /^switchport trunk allowed vlan ([\d,\-]+)$/.exec(l)) p.allowed = m[1];
      else if (m = /^switchport trunk native vlan (\d+)$/.exec(l)) p.native = +m[1];
      else extras.push(raw);
    }
    return { port: p, extras };
  }
  var BOILERPLATE = /^(version |no service |service timestamps|license udi|spanning-tree|ip cef$|no ip cef$|no ipv6 cef$|ipv6 cef$|ptp clock|ip classless$|ip flow-export|mls qos|ip http (server|secure))/;
  function liftIos(lines, ctx) {
    const blocks = toBlocks(lines);
    const patch = {
      ports: [],
      routes: [],
      dns: [],
      acls: [],
      dhcpPools: [],
      dhcpExcluded: [],
      nat: [],
      sec: {},
      rip: void 0,
      ospf: void 0
    };
    const leftover = [];
    const natRaw = { pools: [], rules: [] };
    const aclLines = /* @__PURE__ */ new Map();
    const refs = /* @__PURE__ */ new Map();
    const addRef = (id) => refs.set(id, (refs.get(id) ?? 0) + 1);
    const portExtras = [];
    for (const b of blocks) {
      const h2 = b.head;
      let m;
      const keep = () => leftover.push(b);
      if (BOILERPLATE.test(h2)) continue;
      if (m = /^hostname (.+)$/.exec(h2)) {
        if (m[1] !== ctx.defaultHost) patch.hostname = m[1];
        continue;
      }
      if (m = /^interface (\S+)$/.exec(h2)) {
        const { port, extras } = liftInterface(b, m[1], ctx);
        patch.ports.push(port);
        if (extras.length) portExtras.push({ head: h2, body: extras });
        continue;
      }
      if ((m = /^ip default-gateway (\S+)$/.exec(h2)) && isIPv4(m[1])) {
        patch.gw = m[1];
        continue;
      }
      if (m = /^ip name-server (.+)$/.exec(h2)) {
        const ips = m[1].split(/\s+/);
        if (ips.every(isIPv4)) {
          patch.dns.push(...ips.filter((x) => x !== "0.0.0.0"));
          continue;
        }
      }
      if (m = /^ip domain-name (\S+)$/.exec(h2)) {
        patch.domain = m[1];
        continue;
      }
      if (m = /^ip ssh version (\d)$/.exec(h2)) {
        patch.sec.ssh = +m[1];
        continue;
      }
      if ((m = /^enable (secret|password)(?: 0)? (\S+)$/.exec(h2)) && !/^[57]$/.test(m[2])) {
        patch.sec[m[1] === "secret" ? "enableSecret" : "enablePassword"] = m[2];
        continue;
      }
      if (m = /^username (\S+)(?: privilege (\d+))? password(?: 0)? (\S+)$/.exec(h2)) {
        (patch.sec.users ??= []).push({ name: m[1], pass: m[3], ...m[2] && m[2] !== "1" ? { priv: +m[2] } : {} });
        continue;
      }
      if ((m = /^ip route (\S+) (\S+) (\S+)(?: (\d+))?$/.exec(h2)) && isIPv4(m[1]) && maskToPrefix(m[2]) !== void 0) {
        const r = { net: m[1], prefix: maskToPrefix(m[2]) };
        if (isIPv4(m[3])) r.via = m[3];
        else r.port = m[3];
        if (m[4]) r.ad = +m[4];
        patch.routes.push(r);
        continue;
      }
      if (h2 === "router rip") {
        const rip = { v: 1, networks: [], passive: [], autosum: true };
        const extras = [];
        for (const raw of b.body) {
          const l = raw.trim();
          let mm;
          if (mm = /^version (\d)$/.exec(l)) rip.v = +mm[1];
          else if (mm = /^network (\S+)$/.exec(l)) rip.networks.push(mm[1]);
          else if (l === "no auto-summary") rip.autosum = false;
          else if (mm = /^passive-interface (\S+)$/.exec(l)) rip.passive.push(mm[1]);
          else if (l === "default-information originate") rip.default = true;
          else if (l === "redistribute static") rip.static = true;
          else extras.push(raw);
        }
        patch.rip = rip;
        if (extras.length) leftover.push({ head: h2, body: extras });
        continue;
      }
      if (m = /^router ospf (\d+)$/.exec(h2)) {
        const ospf = { pid: +m[1], networks: [], passive: [] };
        const extras = [];
        for (const raw of b.body) {
          const l = raw.trim();
          let mm;
          if ((mm = /^network (\S+) (\S+) area (\S+)$/.exec(l)) && wildcardToPrefix(mm[2]) !== void 0) ospf.networks.push({ net: mm[1], prefix: wildcardToPrefix(mm[2]), area: mm[3] });
          else if (mm = /^passive-interface (\S+)$/.exec(l)) ospf.passive.push(mm[1]);
          else if (l === "default-information originate") ospf.default = true;
          else extras.push(raw);
        }
        patch.ospf = ospf;
        if (extras.length) leftover.push({ head: h2, body: extras });
        continue;
      }
      if ((m = /^ip nat pool (\S+) (\S+) (\S+) (?:netmask (\S+)|prefix-length (\d+))$/.exec(h2)) && isIPv4(m[2]) && isIPv4(m[3])) {
        natRaw.pools.push({ name: m[1], start: m[2], end: m[3], prefix: m[4] ? maskToPrefix(m[4]) : +m[5] });
        continue;
      }
      if (m = /^ip nat inside source list (\S+) interface (\S+) overload$/.exec(h2)) {
        natRaw.rules.push({ kind: "overload", list: m[1], via: m[2] });
        addRef(m[1]);
        continue;
      }
      if (m = /^ip nat inside source list (\S+) pool (\S+)( overload)?$/.exec(h2)) {
        natRaw.rules.push({ kind: "pool", list: m[1], pool: m[2], overload: !!m[3] });
        addRef(m[1]);
        continue;
      }
      if ((m = /^ip nat inside source static (?:(tcp|udp) )?(\S+) (?:(\d+) )?(\S+)(?: (\d+))?$/.exec(h2)) && isIPv4(m[2]) && isIPv4(m[4])) {
        const st = { kind: "static", local: m[2], global: m[4] };
        if (m[1]) Object.assign(st, { proto: m[1], lport: +m[3], gport: +m[5] });
        natRaw.rules.push(st);
        continue;
      }
      if (m = /^access-list (\d+) (.+)$/.exec(h2)) {
        const e = aclLines.get(m[1]) ?? aclLines.set(m[1], { numbered: true, rules: [], order: aclLines.size }).get(m[1]);
        e.rules.push(m[2]);
        continue;
      }
      if (m = /^ip access-list (standard|extended) (\S+)$/.exec(h2)) {
        aclLines.set(m[2], { numbered: false, ext: m[1] === "extended", rules: b.body.map((x) => x.trim()), order: aclLines.size, block: b });
        continue;
      }
      if ((m = /^ip dhcp excluded-address (\S+)(?: (\S+))?$/.exec(h2)) && isIPv4(m[1])) {
        patch.dhcpExcluded.push({ from: m[1], to: m[2] && isIPv4(m[2]) ? m[2] : void 0 });
        continue;
      }
      if (m = /^ip dhcp pool (\S+)$/.exec(h2)) {
        const pool = { name: m[1], dns: [] };
        const extras = [];
        for (const raw of b.body) {
          const l = raw.trim();
          let mm;
          if ((mm = /^network (\S+) (\S+)$/.exec(l)) && maskToPrefix(mm[2]) !== void 0) {
            pool.net = mm[1];
            pool.prefix = maskToPrefix(mm[2]);
          } else if (mm = /^default-router (\S+)$/.exec(l)) pool.gw = mm[1];
          else if (mm = /^dns-server (.+)$/.exec(l)) pool.dns.push(...mm[1].split(/\s+/));
          else if (mm = /^domain-name (\S+)$/.exec(l)) pool.domain = mm[1];
          else extras.push(raw);
        }
        if (!pool.net) {
          leftover.push(b);
          continue;
        }
        patch.dhcpPools.push(pool);
        if (extras.length) leftover.push({ head: h2, body: extras });
        continue;
      }
      if (m = /^line (con|aux|vty) (.+)$/.exec(h2)) {
        const kind = m[1];
        const o = {};
        const extras = [];
        for (const raw of b.body) {
          const l = raw.trim();
          let mm;
          if ((mm = /^password(?: 0)? (\S+)$/.exec(l)) && !/^[57]$/.test(mm[1])) o.password = mm[1];
          else if (l === "login") o.login = "plain";
          else if (l === "login local") o.login = "local";
          else if (mm = /^transport input (\S+)$/.exec(l)) o.transport = mm[1];
          else extras.push(raw);
        }
        if (kind === "vty") {
          const prev = patch.sec._vty;
          if (!prev) patch.sec._vty = { o, range: m[2], extras };
          else if (JSON.stringify(prev.o) !== JSON.stringify(o)) {
            leftover.push(b);
          } else if (extras.length) leftover.push({ head: h2, body: extras });
          if (!prev) {
            if (extras.length) leftover.push({ head: h2, body: extras });
          }
          patch.sec._vtyRanges = [...patch.sec._vtyRanges ?? [], m[2]];
        } else if (kind === "con") {
          patch.sec.console = o;
          if (extras.length) leftover.push({ head: h2, body: extras });
        } else if (Object.keys(o).length || extras.length) leftover.push(b);
        continue;
      }
      keep();
    }
    const acls = [];
    const simpleNets = /* @__PURE__ */ new Map();
    for (const [id, e] of aclLines) {
      const ext = e.numbered ? isNumberedExt(+id) : e.ext;
      const rules = e.rules.map((r) => parseAclRule(r, ext));
      if (rules.some((r) => !r)) {
        if (e.block) leftover.push(e.block);
        else for (const r of e.rules) leftover.push({ head: `access-list ${id} ${r}`, body: [] });
        continue;
      }
      const acl = { id, numbered: e.numbered, ext, rules, order: e.order };
      const nets = [];
      let simple = true;
      for (const r of rules) {
        const onlyIp = r.proto === void 0 || r.proto === "ip" && r.dst?.any;
        if (r.action !== "permit" || !onlyIp || r.src.any || r.log) {
          simple = false;
          break;
        }
        nets.push(r.src.host ? { net: r.src.host, prefix: 32 } : { net: r.src.net, prefix: r.src.prefix });
      }
      if (simple && nets.length) simpleNets.set(id, nets);
      acls.push(acl);
    }
    const portRefs = new Set(patch.ports.flatMap((p) => Object.values(p.acl ?? {})));
    const nat = [];
    for (const r of natRaw.rules) {
      if (r.kind === "static") {
        nat.push(r);
        continue;
      }
      const nets = simpleNets.get(r.list);
      const onlyNat = (refs.get(r.list) ?? 0) === 1 && !portRefs.has(r.list);
      const base = r.kind === "overload" ? { kind: "overload", via: r.via } : { kind: "pool", overload: r.overload };
      if (r.kind === "pool") {
        const pool = natRaw.pools.find((p) => p.name === r.pool);
        if (!pool) {
          leftover.push({ head: `ip nat inside source list ${r.list} pool ${r.pool}${r.overload ? " overload" : ""}`, body: [] });
          continue;
        }
        Object.assign(base, { name: pool.name, start: pool.start, end: pool.end, prefix: pool.prefix });
      }
      if (nets && onlyNat) {
        base.nets = nets;
        const k = acls.findIndex((a) => a.id === r.list);
        if (k >= 0) acls.splice(k, 1);
      } else base.acl = r.list;
      nat.push(base);
    }
    for (const p of natRaw.pools) if (!natRaw.rules.some((r) => r.pool === p.name)) leftover.push({ head: `ip nat pool ${p.name} ${p.start} ${p.end} netmask ${prefixToMask(p.prefix)}`, body: [] });
    patch.nat = nat;
    patch.acls = acls.sort((a, b) => a.order - b.order).map(({ order, ...a }) => a);
    if (patch.sec._vty) {
      patch.sec.vty = patch.sec._vty.o;
      patch.sec.vtyExtras = patch.sec._vty.extras;
    }
    delete patch.sec._vty;
    delete patch.sec._vtyRanges;
    for (const k of ["vty", "console"]) if (patch.sec[k] && !Object.keys(patch.sec[k]).length) delete patch.sec[k];
    if (patch.sec.vty?.login === "plain" && Object.keys(patch.sec.vty).length === 1) delete patch.sec.vty;
    patch.portExtras = portExtras;
    return { patch, leftover };
  }

  // src/ios-lower.js
  var DEFAULT_CLOCK = 2e6;
  var ipMask = (ip, prefix) => `${ip} ${prefixToMask(prefix)}`;
  function portBody(p, info, devType) {
    const L2 = [];
    if (p.vlan !== void 0) L2.push(` encapsulation dot1Q ${p.vlan}`);
    if (p.desc) L2.push(` description ${p.desc}`);
    if (p.ip) L2.push(` ip address ${ipMask(p.ip, p.prefix)}`);
    else if (p.dhcp) L2.push(" ip address dhcp");
    else if (p.unnumbered) L2.push(` ip unnumbered ${p.unnumbered}`);
    else if (devType === "router" || info.svi || info.sub) L2.push(" no ip address");
    for (const h2 of p.helper ?? []) L2.push(` ip helper-address ${h2}`);
    if (p.acl?.in) L2.push(` ip access-group ${p.acl.in} in`);
    if (p.acl?.out) L2.push(` ip access-group ${p.acl.out} out`);
    if (p.nat === "inside") L2.push(" ip nat inside");
    if (p.nat === "outside") L2.push(" ip nat outside");
    if (p.access !== void 0) L2.push(` switchport access vlan ${p.access}`);
    if (p.native !== void 0) L2.push(` switchport trunk native vlan ${p.native}`);
    if (p.allowed) L2.push(` switchport trunk allowed vlan ${p.allowed}`);
    if (p.mode) L2.push(` switchport mode ${p.mode}`);
    if (info.serial && info.dce) L2.push(` clock rate ${p.clock ?? DEFAULT_CLOCK}`);
    if (info.duplex) L2.push(" duplex auto", " speed auto");
    if (p.shutdown) L2.push(" shutdown");
    return L2;
  }
  function lowerIos(dev, base, ctx) {
    const portMap = new Map(dev.ports.filter((p) => p.name).map((p) => [p.name, p]));
    const sec = dev.sec ?? {};
    const early = [];
    if (sec.enableSecret) early.push(`enable secret ${sec.enableSecret}`);
    if (sec.enablePassword) early.push(`enable password ${sec.enablePassword}`);
    for (const u of sec.users ?? []) early.push(`username ${u.name}${u.priv ? " privilege " + u.priv : ""} password ${u.pass}`);
    for (const x of dev.dhcpExcluded ?? []) early.push(`ip dhcp excluded-address ${x.from}${x.to ? " " + x.to : ""}`);
    for (const p of dev.dhcpPools ?? []) {
      early.push(`ip dhcp pool ${p.name}`, ` network ${ipMask(p.net, p.prefix)}`);
      if (p.gw) early.push(` default-router ${p.gw}`);
      if (p.dns?.length) early.push(` dns-server ${p.dns.join(" ")}`);
      if (p.domain) early.push(` domain-name ${p.domain}`);
      early.push("!");
    }
    if (dev.domain) early.push(`ip domain-name ${dev.domain}`);
    if (dev.dns?.length) early.push(`ip name-server ${dev.dns.join(" ")}`);
    if (sec.ssh) early.push(`ip ssh version ${sec.ssh}`);
    const blocks = [];
    const emit = (name, info) => {
      const p = portMap.get(name) ?? { name };
      const shut = p.shutdown ?? info.defaultShutdown;
      blocks.push(`interface ${name}`, ...portBody({ ...p, shutdown: shut }, info, ctx.type), "!");
    };
    for (const pi of ctx.ports) {
      emit(pi.name, pi);
      const subs = [...portMap.keys()].filter((n) => n.startsWith(pi.name + ".")).sort((a, b) => +a.split(".").pop() - +b.split(".").pop());
      for (const s of subs) emit(s, { sub: true, defaultShutdown: false });
    }
    const svis = [.../* @__PURE__ */ new Set([...ctx.vlan1 === false ? [] : ["Vlan1"], ...[...portMap.keys()].filter((n) => /^Vlan\d+$/.test(n))])].sort((a, b) => +a.slice(4) - +b.slice(4));
    for (const v of svis) emit(v, { svi: true, defaultShutdown: true });
    const routing = [];
    if (dev.rip) {
      routing.push("router rip");
      if (dev.rip.v === 2) routing.push(" version 2");
      for (const n of dev.rip.networks) routing.push(` network ${n}`);
      if (dev.rip.v === 2 && !dev.rip.autosum) routing.push(" no auto-summary");
      for (const p of dev.rip.passive ?? []) routing.push(` passive-interface ${p}`);
      if (dev.rip.default) routing.push(" default-information originate");
      if (dev.rip.static) routing.push(" redistribute static");
      routing.push("!");
    }
    if (dev.ospf) {
      routing.push(`router ospf ${dev.ospf.pid}`);
      for (const n of dev.ospf.networks) routing.push(` network ${n.net} ${prefixToWildcard(n.prefix)} area ${n.area}`);
      for (const p of dev.ospf.passive ?? []) routing.push(` passive-interface ${p}`);
      if (dev.ospf.default) routing.push(" default-information originate");
      routing.push("!");
    }
    const natLines = [];
    for (const r of dev.nat ?? []) {
      if (r.kind === "static") {
        natLines.push(r.proto ? `ip nat inside source static ${r.proto} ${r.local} ${r.lport} ${r.global} ${r.gport}` : `ip nat inside source static ${r.local} ${r.global}`);
      } else if (r.kind === "overload") {
        natLines.push(`ip nat inside source list ${r.list} interface ${r.via} overload`);
      } else if (r.kind === "pool") {
        natLines.push(`ip nat pool ${r.name} ${r.start} ${r.end} netmask ${prefixToMask(r.prefix)}`);
        natLines.push(`ip nat inside source list ${r.list} pool ${r.name}${r.overload ? " overload" : ""}`);
      }
    }
    const aclLines = [];
    for (const a of dev.acls ?? []) {
      if (a.numbered) for (const r of a.rules) aclLines.push(`access-list ${a.id} ${aclRuleToIos(r)}`);
      else aclLines.push(`ip access-list ${a.ext ? "extended" : "standard"} ${a.id}`, ...a.rules.map((r) => " " + aclRuleToIos(r)), "!");
    }
    const routes = (dev.routes ?? []).map((r) => `ip route ${r.net} ${prefixToMask(r.prefix)} ${r.via ?? r.port}${r.ad ? " " + r.ad : ""}`);
    const out = [];
    const tailAt = base.findIndex((l) => /^(ip classless|ip flow-export|line con|line aux|line vty)/.test(l));
    const head = tailAt < 0 ? base : base.slice(0, tailAt);
    const tail = tailAt < 0 ? [] : base.slice(tailAt);
    for (const l of head) {
      if (/^hostname /.test(l)) {
        out.push(`hostname ${dev.hostname ?? l.slice(9)}`, "!");
        if (early.length) {
          out.push(...early);
          if (early[early.length - 1] !== "!") out.push("!");
        }
        continue;
      }
      out.push(l);
    }
    out.push(...blocks, ...routing);
    if (natLines.length) out.push(...natLines, "!");
    if (aclLines.length) {
      out.push(...aclLines);
      if (aclLines[aclLines.length - 1] !== "!") out.push("!");
    }
    const tailBlocks = toBlocks(tail);
    for (const b of tailBlocks.filter((b2) => !/^line /.test(b2.head))) out.push(...blockLines(b), "!");
    if (routes.length) out.push(...routes, "!");
    if (dev.gw && ctx.type === "switch") out.push(`ip default-gateway ${dev.gw}`, "!");
    for (const b of tailBlocks.filter((b2) => /^line /.test(b2.head))) {
      const kind = /^line (con|aux|vty)/.exec(b.head)[1];
      const o = kind === "vty" ? sec.vty : kind === "con" ? sec.console : void 0;
      const body = b.body.filter((l) => l.trim() !== "login");
      const lines = [];
      if (o?.password) lines.push(` password ${o.password}`);
      if (o?.transport) lines.push(` transport input ${o.transport}`);
      const login = o?.login ?? (b.body.some((l) => l.trim() === "login") ? "plain" : void 0);
      if (login === "plain") lines.push(" login");
      if (login === "local") lines.push(" login local");
      out.push(b.head, ...body, ...lines, ...kind === "vty" ? sec.vtyExtras ?? [] : [], "!");
    }
    out.push("end");
    return out;
  }

  // src/implied.js
  var portKind = (name) => /\.\d+$/.test(name) ? "sub" : /^Vlan\d+$/.test(name) ? "svi" : "phys";
  var parentOf = (name) => name.replace(/\.\d+$/, "");
  var clone3 = (o) => JSON.parse(JSON.stringify(o));
  var hasIp = (p) => !!(p.ip || p.dhcp || p.unnumbered);
  function defaultShutdown(p, ports, type) {
    const kind = portKind(p.name);
    if (kind === "sub") return false;
    if (kind === "svi") return !(p.ip || p.dhcp);
    if (type === "switch") return false;
    const hasSubs = ports.some((q) => q.name !== p.name && q.name.startsWith(p.name + "."));
    return !(hasIp(p) || hasSubs);
  }
  function impliedNat(dev) {
    const withIp = dev.ports.filter((p) => p.ip);
    const side = /* @__PURE__ */ new Map();
    const mark = (name, s) => {
      if (name && !side.has(name)) side.set(name, s);
    };
    const portOf = (ip) => withIp.find((p) => inNet(ip, p.ip, p.prefix));
    const covers = (nets, p) => (nets ?? []).some((n) => inNet(p.ip, n.net, n.prefix));
    for (const r of dev.nat ?? []) {
      if (r.kind === "overload") {
        for (const p of withIp) if (covers(r.nets, p)) mark(p.name, "inside");
        if (r.via) mark(r.via, "outside");
      } else if (r.kind === "pool") {
        for (const p of withIp) if (covers(r.nets, p)) mark(p.name, "inside");
        mark(portOf(r.start)?.name, "outside");
      } else if (r.kind === "static") {
        mark(portOf(r.local)?.name, "inside");
        mark(portOf(r.global)?.name, "outside");
      }
    }
    return side;
  }
  function autoRipNetworks(dev) {
    return [...new Set(dev.ports.filter((p) => p.ip).map((p) => classfulNetwork(p.ip)))].sort((a, b) => a.split(".").map(Number).reduce((x, y) => x * 256 + y) - b.split(".").map(Number).reduce((x, y) => x * 256 + y));
  }
  function expandVlanList(s) {
    const out = [];
    for (const part of String(s).split(",")) {
      const m = /^(\d+)(?:-(\d+))?$/.exec(part.trim());
      if (!m) continue;
      for (let v = +m[1]; v <= +(m[2] ?? m[1]); v++) out.push(v);
    }
    return out;
  }
  var vlanDefaultName = (id) => `VLAN${String(id).padStart(4, "0")}`;
  function compile(input, ctx) {
    const d = clone3(input);
    d.ports = d.ports ?? [];
    d.nat = d.nat ?? [];
    d.acls = d.acls ?? [];
    d.dhcpPools = d.dhcpPools ?? [];
    const ports = [];
    const byName = /* @__PURE__ */ new Map();
    const add = (p) => {
      const prev = byName.get(p.name);
      if (prev) {
        Object.assign(prev, p);
        return prev;
      }
      const q = { ...p };
      byName.set(q.name, q);
      ports.push(q);
      return q;
    };
    for (const raw of d.ports) {
      const p = { ...raw };
      p.name = p.name ?? ctx.primary;
      if (p.vlan !== void 0 && portKind(p.name) === "phys") {
        const parent = p.name;
        p.name = `${parent}.${p.vlan}`;
        if (!byName.has(parent)) add({ name: parent });
      }
      add(p);
    }
    d.ports = ports;
    for (const p of ports) {
      if (p.admin === "down") p.shutdown = true;
      else if (p.admin === "up") p.shutdown = false;
      else p.shutdown = defaultShutdown(p, ports, ctx.type);
    }
    const usedIds = new Set(d.acls.filter((a) => a.numbered).map((a) => String(a.id)));
    const freeId = () => {
      for (let n = 1; n < 100; n++) if (!usedIds.has(String(n))) {
        usedIds.add(String(n));
        return String(n);
      }
      throw new PktmdError("troppe ACL automatiche per il NAT");
    };
    let poolN = 0;
    for (const r of d.nat) {
      if (r.kind === "overload" && !r.via) {
        const explicitOut = ports.filter((p) => p.nat === "outside");
        const cands = explicitOut.length ? explicitOut : ports.filter((p) => p.ip && !(r.nets ?? []).some((n) => inNet(p.ip, n.net, n.prefix)) && p.nat !== "inside");
        if (cands.length !== 1) throw new PktmdError(`nat overload: non capisco su quale interfaccia uscire (${cands.length} candidate): scrivi "via <porta>"`, r.line);
        r.via = cands[0].name;
      }
      if (r.kind === "pool") r.name = r.name ?? `pool${++poolN}`;
      if (r.kind !== "static") {
        if (r.nets) {
          const id = freeId();
          d.acls.push({ id, numbered: true, ext: false, auto: true, rules: r.nets.map((n) => ({ action: "permit", src: n.prefix === 32 ? { host: n.net } : { net: n.net, prefix: n.prefix } })) });
          r.list = id;
        } else r.list = String(r.acl);
      }
    }
    const implied = impliedNat(d);
    for (const p of ports) {
      if (p.nat === "off") delete p.nat;
      else if (!p.nat && implied.has(p.name)) p.nat = implied.get(p.name);
    }
    if (d.rip) {
      d.rip.v = d.rip.v ?? 2;
      d.rip.networks = d.rip.networks ?? autoRipNetworks(d);
      d.rip.passive = d.rip.passive ?? [];
      d.rip.autosum = d.rip.autosum ?? false;
    }
    let pn = 0;
    for (const p of d.dhcpPools) p.name = p.name ?? `pool${++pn}`;
    for (const r of d.routes ?? []) if (r.default) {
      r.net = "0.0.0.0";
      r.prefix = 0;
    }
    const vl = new Map((d.vlans ?? []).map((v) => [v.id, v]));
    const use = (id) => {
      if (id > 1 && id < 1002 && !vl.has(id)) vl.set(id, { id, name: vlanDefaultName(id) });
    };
    for (const p of ports) {
      if (p.access !== void 0) use(p.access);
      if (p.native !== void 0) use(p.native);
      if (p.allowed) expandVlanList(p.allowed).forEach(use);
      if (p.mode === void 0 && p.access !== void 0) p.mode = "access";
    }
    for (const v of vl.values()) v.name = v.name ?? vlanDefaultName(v.id);
    d.vlans = [...vl.values()].sort((a, b) => a.id - b.id);
    return d;
  }
  function simplify(input, ctx) {
    const d = clone3(input);
    const ports = d.ports;
    const implied = impliedNat(d);
    for (const p of ports) {
      const def = defaultShutdown(p, ports, ctx.type);
      const actual = !!p.shutdown;
      delete p.admin;
      if (actual !== def) p.admin = actual ? "down" : "up";
      delete p.shutdown;
      const imp = implied.get(p.name);
      if (p.nat !== imp) p.nat = p.nat ?? "off";
      else delete p.nat;
      if (p.nat === void 0) delete p.nat;
      if (p.mode === "access" && p.access !== void 0) delete p.mode;
    }
    d.ports = [];
    for (const p of ports) {
      if (portKind(p.name) === "sub") {
        const suffix = +p.name.split(".").pop();
        if (p.vlan === suffix) {
          d.ports.push({ ...p, name: parentOf(p.name), sub: true });
          continue;
        }
      }
      d.ports.push(p);
    }
    const subParents = new Set(d.ports.filter((p) => p.sub).map((p) => p.name));
    d.ports = d.ports.filter((p) => {
      if (p.sub || !subParents.has(p.name)) return true;
      const keys = Object.keys(p).filter((k) => k !== "name");
      return keys.length > 0;
    });
    for (const p of d.ports) delete p.sub;
    d.ports = d.ports.filter((p) => Object.keys(p).some((k) => k !== "name"));
    for (const r of d.nat) {
      delete r.list;
      if (r.kind === "pool" && /^pool\d+$/.test(r.name ?? "")) delete r.name;
    }
    d.acls = (d.acls ?? []).filter((a) => !a.auto);
    d.nat.forEach((r, i) => {
      if (r.kind !== "overload" || !r.via) return;
      const probe = clone3(d);
      delete probe.nat[i].via;
      try {
        if (compile(probe, ctx).nat[i].via === r.via) delete r.via;
      } catch {
      }
    });
    if (d.rip) {
      const auto = autoRipNetworks(input);
      if (JSON.stringify(d.rip.networks) === JSON.stringify(auto)) delete d.rip.networks;
      if (d.rip.v === 2) delete d.rip.v;
      if (!d.rip.autosum) delete d.rip.autosum;
      if (!d.rip.passive?.length) delete d.rip.passive;
    }
    d.vlans = (d.vlans ?? []).filter((v) => v.name && v.name !== vlanDefaultName(v.id));
    return d;
  }

  // src/hosts.js
  var validIp = (s) => isIPv4(s) && s !== "0.0.0.0";
  var SERVICE_TOGGLES = {
    http: ["HTTP_SERVER", "ENABLED", true],
    https: ["HTTPS_SERVER", "HTTPSENABLED", true],
    ntp: ["NTP_SERVER", "ENABLED", true],
    ftp: ["FTP_SERVER", "ENABLED", true],
    tftp: ["TFTP_SERVER", "ENABLED", true],
    syslog: ["SYSLOG_SERVER", "ENABLED", true]
  };
  var flag = (v) => v === "1" || v === "true";
  var DEFAULT_FILES = ["copyrights.html", "cscoptlogo177x111.jpg", "helloworld.html", "image.html"];
  var DEFAULT_INDEX = `<html>
<center><font size='+2' color='blue'>Cisco Packet Tracer</font></center>
<hr>Welcome to Cisco Packet Tracer. Opening doors to new opportunities. Mind Wide Open.
<p>Quick Links:
<br><a href='helloworld.html'>A small page</a>
<br><a href='copyrights.html'>Copyrights</a>
<br><a href='image.html'>Image page</a>
<br><a href='cscoptlogo177x111.jpg'>Image</a>
</html>`;
  function httpDir(engine) {
    const fm = child(engine, "FILE_MANAGER");
    const root = fm && child(fm, "FILE");
    const fs = root && child(root, "FILES");
    return fs && childrenOf(fs, "FILE").find((f) => textOf(f, "NAME") === "http:");
  }
  function httpFiles(engine) {
    const dir = httpDir(engine);
    const out = /* @__PURE__ */ new Map();
    if (!dir) return out;
    for (const f of childrenOf(child(dir, "FILES"), "FILE")) {
      const t = path(f, "FILE_CONTENT/TEXT");
      if (t) out.set(textOf(f, "NAME"), unescapeXml(t.text ?? ""));
    }
    return out;
  }
  function setHttpFile(engine, name, content) {
    const dir = httpDir(engine);
    const files = child(dir, "FILES");
    const existing = childrenOf(files, "FILE").find((f2) => textOf(f2, "NAME") === name);
    if (existing) {
      setChildText(path(existing, "FILE_CONTENT"), "TEXT", content);
      return;
    }
    const num = (+textOf(dir, "FILE_COUNTER") || 0) + 1;
    if (child(dir, "FILE_COUNTER")) setText(child(dir, "FILE_COUNTER"), num);
    const f = el("FILE", "", [["class", "CFile"]]);
    f.text = null;
    const content_ = el("FILE_CONTENT", "", [["class", "CHttpPage"]]);
    content_.text = null;
    content_.children.push(el("TEXT", content));
    f.children.push(el("FILE_NUMBER", String(num)), el("NAME", name), el("DATE_TIME", "0"), el("PERMISSION", "6"), content_);
    files.children.push(f);
  }
  function liftHost(engine, type, inv) {
    const patch = { ports: [], dns: [] };
    const pn = inv[0]?.node;
    if (pn) {
      const dhcp = flag(textOf(pn, "PORT_DHCP_ENABLE"));
      const ip = textOf(pn, "IP"), mask = textOf(pn, "SUBNET");
      if (dhcp) patch.ports.push({ name: null, dhcp: true });
      else if (validIp(ip)) patch.ports.push({ name: null, ip, prefix: maskToPrefix(mask) ?? classfulPrefix(ip) });
    }
    inv.slice(1).forEach((p) => {
      const ip = textOf(p.node, "IP"), mask = textOf(p.node, "SUBNET");
      if (validIp(ip)) patch.ports.push({ name: p.name, ip, prefix: maskToPrefix(mask) ?? classfulPrefix(ip) });
    });
    const gw = textOf(engine, "GATEWAY");
    if (validIp(gw)) patch.gw = gw;
    const dns = textOf(child(engine, "DNS_CLIENT"), "SERVER_IP");
    if (validIp(dns)) patch.dns.push(dns);
    const mc = child(engine, "EMAIL_CLIENT");
    if (type === "pc" || type === "server") {
      if (mc && textOf(mc, "MAIL_ID")) {
        const address = textOf(mc, "MAIL_ID");
        const domain = address.split("@")[1] ?? "";
        const m = { address, pass: textOf(mc, "PASSWORD") };
        const user = textOf(mc, "USER");
        if (user && user !== address.split("@")[0]) m.user = user;
        const pop3 = textOf(mc, "POP3_SERVER"), smtp = textOf(mc, "SMTP_SERVER");
        if (pop3 !== `pop3.${domain}`) m.pop3 = pop3;
        if (smtp !== `smtp.${domain}`) m.smtp = smtp;
        const name = textOf(mc, "NAME");
        if (name && name !== address.split("@")[0]) m.name = name;
        patch.mail = m;
      }
    }
    if (type === "server") {
      const svc = {};
      for (const [k, [tag, sub, def]] of Object.entries(SERVICE_TOGGLES)) {
        const n = child(engine, tag);
        if (!n) continue;
        const v = flag(textOf(n, sub));
        if (v !== def) svc[k] = v;
      }
      patch.services = svc;
      const dn = child(engine, "DNS_SERVER");
      if (dn) {
        const recs = [];
        for (const r of childrenOf(child(dn, "NAMESERVER-DATABASE"), "RESOURCE-RECORD")) {
          const t = textOf(r, "TYPE");
          if (t === "A-REC") recs.push({ type: "a", name: textOf(r, "NAME"), value: textOf(r, "IPADDRESS") });
          else if (t === "CNAME") recs.push({ type: "cname", name: textOf(r, "NAME"), value: textOf(r, "HOSTNAME") });
          else if (t === "NS") recs.push({ type: "ns", name: textOf(r, "NAME"), value: textOf(r, "SERVER-NAME") });
        }
        patch.dnsRecords = recs;
        const on = flag(textOf(dn, "ENABLED"));
        if (on && !recs.length) svc.dns = true;
        if (!on && recs.length) svc.dns = false;
      }
      const ds = path(engine, "DHCP_SERVERS/ASSOCIATED_PORTS/ASSOCIATED_PORT/DHCP_SERVER");
      if (ds) {
        const pools = [];
        for (const p of childrenOf(child(ds, "POOLS"), "POOL")) {
          const net = textOf(p, "NETWORK"), mask = textOf(p, "MASK"), start = textOf(p, "START_IP");
          if (!validIp(net) || !validIp(start)) continue;
          const pool = { net, prefix: maskToPrefix(mask) ?? classfulPrefix(net), from: start, max: +textOf(p, "MAX_USERS") || 0 };
          if (!flag(textOf(ds, "ENABLED")) && start === net && pool.max === 512 && !validIp(textOf(p, "DEFAULT_ROUTER")) && !validIp(textOf(p, "DNS_SERVER"))) continue;
          const name = textOf(p, "NAME");
          if (name !== "serverPool") pool.name = name;
          const gw2 = textOf(p, "DEFAULT_ROUTER"), dns2 = textOf(p, "DNS_SERVER"), dom = textOf(p, "DOMAIN_NAME");
          if (validIp(gw2)) pool.gw = gw2;
          if (validIp(dns2)) pool.dns = [dns2];
          if (dom) pool.domain = dom;
          pools.push(pool);
        }
        patch.dhcpPools = pools;
        const on = flag(textOf(ds, "ENABLED"));
        if (!on && pools.length) svc.dhcp = false;
        if (on && !pools.length) svc.dhcp = true;
      }
      const es = child(engine, "EMAIL_SERVER");
      if (es) {
        const domain = textOf(es, "SMTP_DOMAIN");
        const users = [];
        const n = +textOf(es, "NO_OF_USERS") || 0;
        for (let i = 0; i < n; i++) users.push({ name: textOf(es, `USER${i}`), pass: textOf(es, `PASSWORD${i}`) });
        if (domain) patch.mailDomain = domain;
        patch.mailUsers = users;
        if (!flag(textOf(es, "SMTP_ENABLED")) && !flag(textOf(es, "POP3_ENABLED"))) svc.mail = false;
      }
      patch.files = [];
      for (const [name, content] of httpFiles(engine)) {
        if (name === "index.html" ? content === DEFAULT_INDEX : DEFAULT_FILES.includes(name)) continue;
        patch.files.push({ name, content });
      }
    }
    return patch;
  }
  function applyHost(engine, dev, type, inv) {
    const pn = inv[0]?.node;
    const primary = inv[0]?.name;
    const allowed = new Set(inv.map((p) => p.name));
    for (const p of dev.ports) {
      const name = p.name ?? primary;
      if (!allowed.has(name)) throw new PktmdError(`${dev.id}: la porta ${name} non esiste (porte: ${inv.map((x) => x.name).join(", ")})`, p.line);
      const node = inv.find((x) => x.name === name).node;
      if (p.dhcp) {
        setChildText(node, "PORT_DHCP_ENABLE", "true");
        const map = path(engine, "DHCP_CLIENT/PORT_DATA_MAP");
        if (map) {
          map.selfClosing = false;
          const entry = el("PORT_DATA_ENTRY", "");
          entry.text = null;
          entry.children.push(el("PORT", name));
          map.children.push(entry);
          map.text = null;
        }
      } else if (p.ip) {
        setChildText(node, "IP", p.ip);
        setChildText(node, "SUBNET", prefixToMask(p.prefix));
      }
    }
    if (dev.gw && pn) {
      setChildText(engine, "GATEWAY", dev.gw);
      setChildText(pn, "PORT_GATEWAY", dev.gw);
    }
    if (dev.dns?.length && pn) {
      setChildText(child(engine, "DNS_CLIENT"), "SERVER_IP", dev.dns[0]);
      setChildText(pn, "PORT_DNS", dev.dns[0]);
    }
    if (dev.mail) {
      const mc = child(engine, "EMAIL_CLIENT");
      const [user, domain] = dev.mail.address.split("@");
      setChildText(mc, "ENABLED", "1");
      setChildText(mc, "NAME", dev.mail.name ?? user);
      setChildText(mc, "MAIL_ID", dev.mail.address);
      setChildText(mc, "POP3_SERVER", dev.mail.pop3 ?? `pop3.${domain}`);
      setChildText(mc, "SMTP_SERVER", dev.mail.smtp ?? `smtp.${domain}`);
      setChildText(mc, "USER", dev.mail.user ?? user);
      setChildText(mc, "PASSWORD", dev.mail.pass);
    }
    if (type !== "server") return;
    const svc = dev.services ?? {};
    for (const [k, v] of Object.entries(svc)) {
      const t = SERVICE_TOGGLES[k];
      if (t) setChildText(child(engine, t[0]), t[1], v ? "1" : "0");
    }
    if (dev.dnsRecords?.length || svc.dns !== void 0) {
      const dn = child(engine, "DNS_SERVER");
      setChildText(dn, "ENABLED", svc.dns === false ? "0" : "1");
      const db = child(dn, "NAMESERVER-DATABASE");
      db.children = [];
      db.selfClosing = false;
      db.text = null;
      for (const r of dev.dnsRecords ?? []) {
        const rec = el("RESOURCE-RECORD", "");
        rec.text = null;
        const [type_, valueTag] = r.type === "a" ? ["A-REC", "IPADDRESS"] : r.type === "cname" ? ["CNAME", "HOSTNAME"] : ["NS", "SERVER-NAME"];
        rec.children.push(el("TYPE", type_), el("NAME", r.name), el("TTL", "86400"), el(valueTag, r.value));
        db.children.push(rec);
      }
    }
    if (dev.dhcpPools?.length || svc.dhcp !== void 0) {
      const ds = path(engine, "DHCP_SERVERS/ASSOCIATED_PORTS/ASSOCIATED_PORT/DHCP_SERVER");
      setChildText(ds, "ENABLED", svc.dhcp === false ? "0" : "1");
      const pools = child(ds, "POOLS");
      const tpl = child(pools, "POOL");
      pools.children = [];
      (dev.dhcpPools ?? []).forEach((p, i) => {
        const pool = JSON.parse(JSON.stringify(tpl));
        const max = p.max || 50;
        const from = p.from ?? intToIp(ipToInt(networkAddress(p.net, p.prefix)) + 1);
        setChildText(pool, "NAME", p.name ?? (i === 0 ? "serverPool" : `serverPool${i + 1}`));
        setChildText(pool, "NETWORK", networkAddress(p.net, p.prefix));
        setChildText(pool, "MASK", prefixToMask(p.prefix));
        setChildText(pool, "DEFAULT_ROUTER", p.gw ?? "0.0.0.0");
        setChildText(pool, "START_IP", from);
        setChildText(pool, "END_IP", intToIp(ipToInt(from) + max - 1));
        setChildText(pool, "DNS_SERVER", p.dns?.[0] ?? "0.0.0.0");
        setChildText(pool, "MAX_USERS", String(max));
        if (p.domain) setChildText(pool, "DOMAIN_NAME", p.domain);
        pools.children.push(pool);
      });
    }
    if (dev.mailDomain || dev.mailUsers?.length || svc.mail !== void 0) {
      const es = child(engine, "EMAIL_SERVER");
      const on = svc.mail === false ? "0" : "1";
      setChildText(es, "SMTP_ENABLED", on);
      setChildText(es, "POP3_ENABLED", on);
      setChildText(es, "SMTP_DOMAIN", dev.mailDomain ?? "");
      es.children = es.children.filter((c) => !/^(USER|PASSWORD|NO_OF_MAILS)\d+$/.test(c.tag));
      setChildText(es, "NO_OF_USERS", String(dev.mailUsers?.length ?? 0));
      (dev.mailUsers ?? []).forEach((u, i) => {
        es.children.push(el(`USER${i}`, u.name), el(`PASSWORD${i}`, u.pass), el(`NO_OF_MAILS${i}`, "0"));
      });
    }
    setHttpFile(engine, "index.html", DEFAULT_INDEX);
    for (const f of dev.files ?? []) setHttpFile(engine, f.name, f.content);
  }

  // src/layout.js
  var isHost = (d) => d.type === "pc" || d.type === "server" || d.type === "laptop";
  function hierarchyLayout(net, opts = {}) {
    const { vGap = 210, hostW = 150, infraW = 190, gap = 28 } = opts;
    const widthOf = opts.widthOf ?? ((d) => isHost(d) ? hostW : infraW);
    const byId = new Map(net.devices.map((d) => [d.id, d]));
    const order = new Map(net.devices.map((d, i) => [d.id, i]));
    const adj = new Map(net.devices.map((d) => [d.id, []]));
    for (const l of net.links) {
      const a = l.a.dev, b = l.b.dev;
      if (!adj.has(a) || !adj.has(b) || a === b) continue;
      if (!adj.get(a).includes(b)) adj.get(a).push(b);
      if (!adj.get(b).includes(a)) adj.get(b).push(a);
    }
    const rank = (d) => (d.type === "router" ? 1e3 : d.type === "switch" ? 100 : 0) + adj.get(d.id).length;
    const candidates = [...net.devices].sort((x, y) => rank(y) - rank(x) || order.get(x.id) - order.get(y.id));
    const depth = /* @__PURE__ */ new Map(), parent = /* @__PURE__ */ new Map(), children = new Map(net.devices.map((d) => [d.id, []]));
    const roots = [];
    for (const c of candidates) {
      if (depth.has(c.id)) continue;
      roots.push(c.id);
      depth.set(c.id, 0);
      parent.set(c.id, null);
      const queue = [c.id];
      for (let qi = 0; qi < queue.length; qi++) {
        const u = queue[qi];
        const next = adj.get(u).filter((v) => !depth.has(v)).sort((x, y) => isHost(byId.get(x)) - isHost(byId.get(y)) || order.get(x) - order.get(y));
        for (const v of next) {
          depth.set(v, depth.get(u) + 1);
          parent.set(v, u);
          children.get(u).push(v);
          queue.push(v);
        }
      }
    }
    const width = /* @__PURE__ */ new Map();
    const measure = (id) => {
      const own = widthOf(byId.get(id));
      const kids = children.get(id);
      if (!kids.length) {
        width.set(id, own);
        return own;
      }
      const sum = kids.reduce((s, k) => s + measure(k), 0) + gap * (kids.length - 1);
      width.set(id, Math.max(own, sum));
      return width.get(id);
    };
    const pos = /* @__PURE__ */ new Map();
    const place = (id, left) => {
      const w = width.get(id);
      const kids = children.get(id);
      const sum = kids.reduce((s, k) => s + width.get(k), 0) + gap * Math.max(0, kids.length - 1);
      let x = left + (w - sum) / 2;
      for (const k of kids) {
        place(k, x);
        x += width.get(k) + gap;
      }
      const first = kids.length ? pos.get(kids[0]).x : left + w / 2;
      const last = kids.length ? pos.get(kids[kids.length - 1]).x : left + w / 2;
      pos.set(id, { x: (first + last) / 2, y: depth.get(id) * vGap });
    };
    let cursor = 0;
    for (const r of roots) {
      measure(r);
      place(r, cursor);
      cursor += width.get(r) + gap * 3;
    }
    for (const d of net.devices) if (d.pos) pos.set(d.id, { x: d.pos.x, y: d.pos.y });
    return { pos, depth, parent, children, roots };
  }
  function toPtCoords(positions, { scale = 1, margin = 100 } = {}) {
    const pts = [...positions.values()];
    if (!pts.length) return /* @__PURE__ */ new Map();
    const minX = Math.min(...pts.map((p) => p.x)), minY = Math.min(...pts.map((p) => p.y));
    return new Map([...positions].map(([id, p]) => [id, { x: Math.round((p.x - minX) * scale + margin), y: Math.round((p.y - minY) * scale + margin) }]));
  }
  function autoLayout(net, { scale = 0.75, margin = 100 } = {}) {
    const { pos } = hierarchyLayout(net, { hostW: 110, infraW: 150, vGap: 190 });
    const free = new Map([...pos].filter(([id]) => !net.devices.find((d) => d.id === id)?.pos));
    const scaled = toPtCoords(free, { scale, margin });
    const out = /* @__PURE__ */ new Map();
    for (const d of net.devices) out.set(d.id, d.pos ? { x: d.pos.x, y: d.pos.y } : scaled.get(d.id));
    return out;
  }
  var DEFAULT_PHYSICS = {
    repulsion: 16e3,
    springStrength: 0.05,
    springLength: 150,
    gravity: 0.03,
    damping: 0.85,
    minEnergy: 0.05
  };
  function simulationStep(nodes, edges, ph = DEFAULT_PHYSICS, center = { x: 0, y: 0 }) {
    const n = nodes.length;
    if (!n) return 0;
    const byId = new Map(nodes.map((nd) => [nd.id, nd]));
    for (let i = 0; i < n; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < n; j++) {
        const b = nodes[j];
        let dx = a.x - b.x, dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.01) {
          dx = i - j || 1;
          dy = 1;
          d2 = dx * dx + dy * dy;
        }
        const d = Math.sqrt(d2);
        const f = ph.repulsion / d2;
        const fx = dx / d * f, fy = dy / d * f;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
    }
    for (const e of edges) {
      const a = byId.get(e.source), b = byId.get(e.target);
      if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const f = ph.springStrength * (d - ph.springLength);
      const fx = dx / d * f, fy = dy / d * f;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }
    let energy = 0;
    for (const nd of nodes) {
      if (nd.fixed) {
        nd.vx = nd.vy = 0;
        continue;
      }
      nd.vx += (center.x - nd.x) * ph.gravity;
      nd.vy += (center.y - nd.y) * ph.gravity;
      nd.vx *= ph.damping;
      nd.vy *= ph.damping;
      nd.x += nd.vx;
      nd.y += nd.vy;
      energy += nd.vx * nd.vx + nd.vy * nd.vy;
    }
    return energy;
  }
  function seedPositions(nodes, radius = 120) {
    const n = nodes.length;
    nodes.forEach((nd, i) => {
      const a = 2 * Math.PI * i / Math.max(n, 1) + 0.3;
      const r = radius * (1 + 0.15 * (i % 3));
      nd.x = Math.cos(a) * r;
      nd.y = Math.sin(a) * r;
      nd.vx = 0;
      nd.vy = 0;
    });
  }

  // src/skeleton.js
  var DEVICE_NODE = "6";
  function stripPhysicalDevices(root) {
    const pw = child(root, "PHYSICALWORKSPACE");
    if (!pw) return;
    const walk = (node) => {
      for (const holder of [node, child(node, "CHILDREN")].filter(Boolean)) {
        holder.children = holder.children.filter((c) => !(c.tag === "NODE" && textOf(c, "TYPE") === DEVICE_NODE));
        for (const c of childrenOf(holder, "NODE")) walk(c);
      }
    };
    walk(pw);
  }
  function cleanOptions(root) {
    const opts = child(root, "OPTIONS");
    const recent = opts && child(opts, "RECENT_FILES");
    if (recent) {
      recent.children = [];
      recent.text = null;
      recent.selfClosing = true;
    }
  }
  function unplace(dn) {
    const ws = child(dn, "WORKSPACE");
    if (!ws) return;
    const phys = child(ws, "PHYSICAL");
    if (phys) {
      phys.children = [];
      phys.text = "";
      phys.selfClosing = false;
    }
    const cpur = child(ws, "PHYSICAL_CPUR");
    if (cpur) {
      cpur.children = [];
      cpur.text = null;
      cpur.selfClosing = true;
    }
  }
  var RACK_HEIGHT = { "2901": 8, "2911": 11, "1841": 8, "2960-24TT": 4, "2950-24": 4, "Router-PT": 7, "Router-PT-Empty": 7, "Switch-PT": 9, "Switch-PT-Empty": 9, "Server-PT": 16 };
  var RACK_UNITS = 110;
  function deviceNode(name, x, y, guid) {
    const t = (tag, v) => el(tag, String(v));
    const kids = el("CHILDREN", "");
    kids.text = null;
    kids.selfClosing = true;
    const n = el("NODE", "");
    n.text = null;
    n.children = [
      t("X", x),
      t("Y", y),
      t("TYPE", 6),
      el("NAME", name, [["translate", "true"]]),
      t("SX", "1e-05"),
      t("SY", "1e-05"),
      t("W", "0.001"),
      t("H", "0.001"),
      t("D", 0),
      el("PATH", "../art/Background/grid_100x100.png", [["isanim", "false"]]),
      kids,
      t("MANUAL_SCALING", "false"),
      t("SCALED_PIXMAP_WIDTH", 0),
      t("SCALED_PIXMAP_HEIGHT", 0),
      t("INIT_WIDTH", "0.001"),
      t("INIT_HEIGHT", "0.001"),
      t("INIT_DEPTH", 0),
      t("INIT_SX", "1e-05"),
      t("INIT_SY", "1e-05"),
      t("INIT_SZ", "1e-05"),
      t("BG_TILED", "false"),
      t("CUSTOM_IMAGE_WIDTH", -1),
      t("CUSTOM_IMAGE_HEIGHT", -1),
      t("SCALE_FACTOR", 1),
      t("UUID_STR", guid),
      t("SLOT", 0),
      t("SUB_SLOT", 0),
      t("ICP_CSX", 0),
      t("ICP_CSY", 0)
    ];
    return n;
  }
  function placeDevices(root, devices, newGuid) {
    const pw = child(root, "PHYSICALWORKSPACE");
    const holderOf = (node) => [node, child(node, "CHILDREN")].filter(Boolean);
    const found = {};
    const go = (node, acc) => {
      for (const h2 of holderOf(node)) {
        for (const c of childrenOf(h2, "NODE")) {
          const p = [...acc, textOf(c, "UUID_STR")];
          const type = textOf(c, "TYPE");
          if ((type === "2" || type === "4") && !found[type]) found[type] = { node: c, path: p };
          go(c, p);
        }
      }
    };
    go(pw, []);
    const office = found["2"], rack = found["4"];
    if (!office || !rack) throw new Error("lo scheletro non ha ufficio e armadio nella vista fisica");
    for (const z of [office, rack]) {
      const k = child(z.node, "CHILDREN");
      k.selfClosing = false;
      k.text = null;
    }
    let nextRack = 4, nextOffice = 0;
    for (const dn of devices) {
      const eng = child(dn, "ENGINE");
      const name = textOf(eng, "NAME");
      const model = child(eng, "TYPE")?.attrs.find(([k]) => k === "model")?.[1] ?? "";
      const height = RACK_HEIGHT[model] ?? 8;
      const inRack = model !== "PC-PT" && nextRack + height <= RACK_UNITS;
      const guid = newGuid();
      let x, y, zone;
      if (inRack) {
        x = nextRack;
        y = 0;
        nextRack += height;
        zone = rack;
      } else {
        x = 86 * (nextOffice % 10 + 1);
        y = 215 + 100 * Math.floor(nextOffice / 10);
        nextOffice++;
        zone = office;
      }
      child(zone.node, "CHILDREN").children.push(deviceNode(name, x, y, guid));
      const ws = child(dn, "WORKSPACE");
      const phys = child(ws, "PHYSICAL");
      phys.children = [];
      phys.text = [...zone.path, guid].join(",");
      phys.selfClosing = false;
      const cpur = child(ws, "PHYSICAL_CPUR");
      const f = (tag, v) => el(tag, String(v));
      cpur.selfClosing = false;
      cpur.text = null;
      cpur.children = [
        f("X_PN", inRack ? 0.1 : +(x / 2e3).toFixed(5)),
        f("Y_PN", inRack ? 0.05 : +(y / 2e3).toFixed(5)),
        f("X", x),
        f("Y", y),
        f("SLOT", 0),
        f("SUBSLOT", 0),
        f("PARENT_PATH", zone.path.join(",")),
        f("CONTAINER_ID", zone.path[zone.path.length - 1]),
        f("ICP_CONTAINER_SCENE_X", 0),
        f("ICP_CONTAINER_SCENE_Y", 0),
        f("ORIGINAL_DEVICE_UUID", newGuid())
      ];
    }
  }

  // src/validate.js
  var GUID = /\{[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\}/g;
  function validateXml(xml, { generated = false } = {}) {
    const root = typeof xml === "string" ? parseXml(xml) : xml;
    const problems = [];
    const net = child(root, "NETWORK");
    const devices = childrenOf(child(net, "DEVICES"), "DEVICE");
    const known = /* @__PURE__ */ new Set();
    const pw = child(root, "PHYSICALWORKSPACE");
    if (pw) {
      for (const n of walkNodes(pw)) if (n.tag === "UUID_STR" && n.text) known.add(n.text.toLowerCase());
    }
    for (const d of devices) {
      const name = textOf(child(d, "ENGINE"), "NAME");
      const phys = textOf(child(d, "WORKSPACE"), "PHYSICAL");
      if (generated && !phys) problems.push(`${name}: non e' collocato nella vista fisica (Packet Tracer rifiuta il file)`);
      for (const g of phys.match(GUID) ?? []) {
        if (!known.has(g.toLowerCase())) problems.push(`${name}: la vista fisica cita ${g}, che non esiste nel file`);
      }
    }
    const usedNode = /* @__PURE__ */ new Map();
    for (const d of devices) {
      const phys = textOf(child(d, "WORKSPACE"), "PHYSICAL");
      const last = (phys.match(GUID) ?? []).pop();
      if (!last) continue;
      const name = textOf(child(d, "ENGINE"), "NAME");
      if (usedNode.has(last.toLowerCase())) problems.push(`${name} e ${usedNode.get(last.toLowerCase())} sono sullo stesso nodo fisico ${last}`);
      usedNode.set(last.toLowerCase(), name);
    }
    const dup = (what, values) => {
      const seen = /* @__PURE__ */ new Map();
      for (const [name, v] of values) {
        if (!v) continue;
        if (seen.has(v)) problems.push(`${what} duplicato (${v}): ${seen.get(v)} e ${name}`);
        else seen.set(v, name);
      }
    };
    const eng = (d) => child(d, "ENGINE");
    dup("nome", devices.map((d) => [textOf(eng(d), "NAME"), textOf(eng(d), "NAME")]));
    dup("SAVE_REF_ID", devices.map((d) => [textOf(eng(d), "NAME"), textOf(eng(d), "SAVE_REF_ID")]));
    dup("DEV_ADDR", devices.map((d) => [textOf(eng(d), "NAME"), textOf(child(d, "WORKSPACE") && child(child(d, "WORKSPACE"), "LOGICAL"), "DEV_ADDR")]));
    dup("MEM_ADDR", devices.map((d) => [textOf(eng(d), "NAME"), textOf(child(d, "WORKSPACE") && child(child(d, "WORKSPACE"), "LOGICAL"), "MEM_ADDR")]));
    dup("numero di serie", devices.map((d) => [textOf(eng(d), "NAME"), textOf(eng(d), "SERIALNUMBER")]));
    const macOwner = /* @__PURE__ */ new Map();
    for (const d of devices) {
      const name = textOf(eng(d), "NAME");
      const mine = /* @__PURE__ */ new Set();
      for (const n of walkNodes(eng(d))) if (n.tag === "MACADDRESS" && n.text) mine.add(n.text);
      for (const m of mine) {
        if (macOwner.has(m) && macOwner.get(m) !== name) problems.push(`MAC duplicato (${m}): ${macOwner.get(m)} e ${name}`);
        macOwner.set(m, name);
      }
    }
    const refs = new Set(devices.map((d) => textOf(eng(d), "SAVE_REF_ID")).filter(Boolean));
    const byIndex = devices.length;
    for (const l of childrenOf(child(net, "LINKS"), "LINK")) {
      const c = child(l, "CABLE");
      if (!c) {
        problems.push("collegamento senza CABLE");
        continue;
      }
      for (const tag of ["FROM", "TO", "DCEDEV"]) {
        const v = textOf(c, tag);
        if (!v) continue;
        const ok = refs.size ? refs.has(v) : /^\d+$/.test(v) && +v < byIndex;
        if (!ok) problems.push(`collegamento: ${tag} ${v} non e' un dispositivo del file`);
      }
    }
    const clusters = /* @__PURE__ */ new Set();
    const cl = child(root, "CLUSTERS");
    if (cl) {
      for (const n of walkNodes(cl)) if (n.tag === "CLUSTERID" && n.text) clusters.add(n.text);
    }
    for (const d of devices) {
      const id = textOf(child(d, "WORKSPACE") && child(child(d, "WORKSPACE"), "LOGICAL"), "DEVCLUSTERID");
      if (id && clusters.size && !clusters.has(id)) problems.push(`${textOf(eng(d), "NAME")}: gruppo ${id} inesistente`);
    }
    const opts = child(root, "OPTIONS");
    const recent = opts && child(opts, "RECENT_FILES");
    if (generated && recent && recent.children.length) problems.push("l'elenco dei file recenti non e' vuoto");
    return problems;
  }

  // src/cli.js
  var MODE_OPEN = [
    [/^interface\s+/i, "if"],
    [/^vlan\s+\d/i, "vlan"],
    [/^router\s+\S+/i, "router"],
    [/^line\s+/i, "line"],
    [/^ip\s+dhcp\s+pool\s+/i, "dhcp"],
    [/^ip\s+access-list\s+/i, "acl"]
  ];
  var MODE_CMDS = {
    if: /^(no\s+)?((ip|ipv6)\s+(address|nat|access-group|helper-address|ospf|rip|proxy-arp|summary-address|verify|flow|pim|igmp|unnumbered|mtu|redirects|unreachables|directed-broadcast|route-cache|authentication|dhcp\s+(snooping|relay))|(shutdown|description|duplex|speed|switchport|encapsulation|clock|bandwidth|mtu|spanning-tree|channel-group|standby|vrrp|cdp|lldp|power|mls|storm-control|load-interval|keepalive|ppp|frame-relay|mac|media-type|negotiation|delay|fair-queue|service-policy|snmp|autostate|trunk))(?![\w-])/i,
    vlan: /^(no\s+)?(name|state|shutdown|mtu|remote-span|private-vlan)(?![\w-])/i,
    router: /^(no\s+)?(network|version|auto-summary|passive-interface|default-information|redistribute|neighbor|router-id|distance|maximum-paths|summary-address|timers|metric|offset-list|default-metric|area|log-adjacency-changes|bgp|address-family|eigrp)(?![\w-])/i,
    line: /^(no\s+)?(password|login|transport|exec-timeout|logging|access-class|privilege|exec|history|escape-character|length|width|stopbits|speed|flowcontrol|modem|session-timeout|authorization|accounting)(?![\w-])/i,
    dhcp: /^(no\s+)?(network|default-router|dns-server|domain-name|lease|option|netbios-name-server|next-server|client-identifier|host|import|bootfile)(?![\w-])/i,
    acl: /^(permit|deny|remark|\d+\s+(permit|deny))(?![\w-])/i
  };
  function normalizeHead(l) {
    const m = /^interface\s+(\S+?)\s*$/i.exec(l);
    if (m) {
      const p = normalizePort(m[1]);
      if (p) return `interface ${p}`;
    }
    return l;
  }
  function parseCli(cli) {
    const blocks = [];
    let cur = null;
    for (const raw of cli.split("\n")) {
      const line = raw.replace(/\s+$/, "");
      const t = line.trim();
      if (!t || t === "!") continue;
      if (t === "end") {
        cur = null;
        continue;
      }
      if (t === "exit") {
        cur = null;
        continue;
      }
      if (/^\s/.test(line) && cur) {
        cur.body.push(" " + t);
        continue;
      }
      const open = MODE_OPEN.find(([re]) => re.test(t));
      if (open) {
        cur = { head: normalizeHead(t), body: [], mode: open[1] };
        blocks.push(cur);
        continue;
      }
      if (cur && MODE_CMDS[cur.mode].test(t)) {
        cur.body.push(" " + t);
        continue;
      }
      cur = null;
      blocks.push({ head: normalizeHead(t), body: [] });
    }
    return blocks;
  }
  var SINGLETON = ["duplex", "speed", "description", "ip address", "clock rate", "switchport mode", "switchport access vlan", "encapsulation", "ip default-gateway", "switchport trunk native vlan", "switchport trunk allowed vlan", "password", "transport input"];
  var childKey = (l) => SINGLETON.find((k) => l.trim().startsWith(k + " ") || l.trim() === k);
  function blockRange(lines, head) {
    const i = lines.indexOf(head);
    if (i < 0) return void 0;
    let j = i + 1;
    while (j < lines.length && /^\s/.test(lines[j])) j++;
    return [i, j];
  }
  function insertBlock(lines, block) {
    let at = lines.findIndex((l) => /^(ip classless|ip flow-export|line con|line aux|line vty|end)/.test(l));
    if (at < 0) at = lines.length;
    lines.splice(at, 0, ...block, "!");
  }
  function applyCli(lines, cli, ctx) {
    const out = [...lines];
    for (const b of parseCli(cli)) {
      const head = b.head;
      const im = /^interface\s+(\S+?)(?:\.\d+)?$/i.exec(head);
      if (im && normalizePort(im[1]) && !/^Vlan/i.test(im[1]) && !ctx.known.has(normalizePort(im[1]))) {
        throw new PktmdError(`${ctx.dev.id}: nel blocco cli, "${head}" usa la porta ${shortPort(normalizePort(im[1]))} che non esiste (porte: ${[...ctx.known].map(shortPort).join(", ")})`, ctx.dev.line);
      }
      if (!b.body.length) {
        if (/^hostname /.test(head)) {
          const i = out.findIndex((l) => l.startsWith("hostname "));
          if (i >= 0) {
            out[i] = head;
            continue;
          }
        }
        if (!head.startsWith("no ")) {
          const i = out.indexOf("no " + head);
          if (i >= 0) {
            out.splice(i, 1);
            out.splice(i, 0, head);
            continue;
          }
        } else {
          const i = out.indexOf(head.slice(3));
          if (i >= 0) {
            out.splice(i, 1, head);
            continue;
          }
        }
      }
      const r = blockRange(out, head);
      if (!r) {
        insertBlock(out, [head, ...b.body]);
        continue;
      }
      let [start, end] = r;
      for (const line of b.body) {
        if (line.trim().startsWith("no ")) {
          const target = " " + line.trim().slice(3);
          const k = out.slice(start + 1, end).findIndex((l) => l === target || childKey(target) && childKey(l) === childKey(target));
          if (k >= 0) {
            out.splice(start + 1 + k, 1);
            end--;
          }
          continue;
        }
        const key = childKey(line);
        const existing = out.slice(start + 1, end).findIndex((l) => l === line || key && childKey(l) === key);
        if (existing >= 0) out[start + 1 + existing] = line;
        else {
          out.splice(end, 0, line);
          end++;
        }
      }
    }
    return out;
  }

  // src/pt.js
  var tplPromise;
  var getTemplate = () => tplPromise ??= loadTemplate();
  async function inflate(b64) {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const res = new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate")));
    return new TextDecoder("utf-8").decode(new Uint8Array(await res.arrayBuffer()));
  }
  async function loadTemplate() {
    const root = parseXml(await inflate(template_data_default));
    const tpl = {
      skeleton: child(child(root, "SKELETON"), "PACKETTRACER5"),
      models: /* @__PURE__ */ new Map(),
      modules: /* @__PURE__ */ new Map(),
      links: /* @__PURE__ */ new Map()
    };
    stripPhysicalDevices(tpl.skeleton);
    cleanOptions(tpl.skeleton);
    for (const m of childrenOf(root, "MODEL")) tpl.models.set(attr(m, "key"), child(m, "DEVICE"));
    for (const m of childrenOf(root, "MODULEDEF")) tpl.modules.set(attr(m, "name"), { slotType: attr(m, "slotType"), node: child(m, "MODULE") });
    for (const l of childrenOf(root, "LINKDEF")) tpl.links.set(attr(l, "key"), child(l, "LINK"));
    tpl.portsOf = (key) => inventory(child(tpl.models.get(key), "ENGINE"), MODELS[key]).map((p) => p.name);
    return tpl;
  }
  var specOf = (dev) => MODELS[dev.model ?? DEFAULT_MODEL[dev.type]];
  var cfgLines = (engine) => childrenOf(child(engine, "RUNNINGCONFIG"), "LINE").map((l) => unescapeXml(l.text ?? ""));
  var sanitize = (s) => s.replace(/[^A-Za-z0-9_-]+/g, "_");
  function setConfig(engine, lines, withStartup) {
    const set = (tag) => {
      let nd = child(engine, tag);
      if (!nd) {
        nd = el(tag);
        engine.children.push(nd);
      }
      nd.text = null;
      nd.selfClosing = false;
      nd.children = lines.map((l) => el("LINE", l));
    };
    set("RUNNINGCONFIG");
    if (withStartup) set("STARTUPCONFIG");
  }
  var defaultHostname = (spec) => spec.type === "router" ? "Router" : "Switch";
  function liftModules(engine, spec, inv, tpl) {
    const slots = slotContainers(engine, spec);
    if (!slots.length || spec.family === "host") return [];
    const defaults = DEFAULT_MODULES[spec.key] ?? [];
    const actual = slots.map((s) => {
      const m = child(s, "MODULE");
      return m ? textOf(m, "MODEL") : null;
    });
    const base = slots.map((_, i) => defaults[i] ?? null);
    const diff = [];
    actual.forEach((m, i) => {
      if (m !== base[i]) diff.push({ slot: i, name: m });
    });
    const adds = diff.filter((d) => d.name);
    const onlyAdds = diff.every((d) => d.name && base[d.slot] === null);
    if (onlyAdds) {
      const sim = [...base];
      let ok = true;
      for (const d of adds.sort((a, b) => a.slot - b.slot)) {
        const def = tpl.modules.get(d.name);
        const free = slots.findIndex((s, i) => sim[i] === null && def && textOf(s, "TYPE") === def.slotType);
        if (free !== d.slot) {
          ok = false;
          break;
        }
        sim[free] = d.name;
      }
      if (ok) return adds.map((d) => ({ name: d.name }));
    }
    return diff.map((d) => ({ name: d.name ?? "none", slot: d.slot }));
  }
  function fromXml(root, tpl) {
    const net = child(root, "NETWORK");
    const warnings = [];
    const devices = [];
    const refToId = /* @__PURE__ */ new Map();
    const info = /* @__PURE__ */ new Map();
    const used = /* @__PURE__ */ new Set();
    const devNodes = childrenOf(child(net, "DEVICES"), "DEVICE");
    devNodes.forEach((dn, idx) => {
      const engine = child(dn, "ENGINE");
      const ptModel = attr(child(engine, "TYPE"), "model");
      const rawName = textOf(engine, "NAME");
      const spec = MODEL_BY_PT[ptModel];
      if (!spec) {
        if (ptModel !== "Power Distribution Device") warnings.push(`dispositivo "${rawName}" (${ptModel}) non supportato: ignorato`);
        return;
      }
      let id = sanitize(rawName) || spec.type;
      if (id !== rawName) warnings.push(`nome "${rawName}" rinominato in "${id}"`);
      for (let n = 2; used.has(id); n++) id = `${sanitize(rawName)}_${n}`;
      used.add(id);
      refToId.set(textOf(engine, "SAVE_REF_ID") || String(idx), id);
      const inv = inventory(engine, spec);
      const dev = { id, type: spec.type, ports: [], files: [], dns: [], routes: [], nat: [], acls: [], dhcpPools: [], dhcpExcluded: [], vlans: [], modules: [] };
      if (spec.key !== DEFAULT_MODEL[spec.type]) dev.model = spec.key;
      const logical = path(dn, "WORKSPACE/LOGICAL");
      if (logical) dev.pos = { x: +textOf(logical, "X"), y: +textOf(logical, "Y") };
      info.set(id, { spec, inv, engine });
      if (spec.family === "host") {
        const t = inv[0]?.type ?? "";
        if (/Gigabit/.test(t)) dev.nic = /Fiber/.test(t) ? "fiber" : "gig";
        if (dev.nic && inv[0].slot > 0) dev.nicSlot = inv[0].slot;
        if (!dev.nic && inv[0]?.slot > 0) {
          dev.nic = "fa";
          dev.nicSlot = inv[0].slot;
        }
        Object.assign(dev, liftHost(engine, spec.type, inv));
      } else {
        dev.modules = liftModules(engine, spec, inv, tpl);
        const lines = cfgLines(engine);
        const { patch, leftover } = liftIos(lines, { type: spec.type, defaultHost: defaultHostname(spec) });
        const { portExtras, ...rest } = patch;
        Object.assign(dev, rest);
        const vl = child(engine, "VLANS");
        if (vl && spec.type === "switch") {
          for (const v of childrenOf(vl, "VLAN")) {
            const num = +attr(v, "number");
            if (num > 1 && num < 1002) dev.vlans.push({ id: num, name: attr(v, "name") });
          }
        }
        const extra = [...leftover];
        for (const pe of portExtras) extra.push({ head: pe.head, body: pe.body });
        if (extra.length) dev.cli = blocksToCli(extra);
      }
      devices.push(dev);
    });
    const links = [];
    for (const ln of childrenOf(child(net, "LINKS"), "LINK")) {
      const cable = child(ln, "CABLE");
      if (!cable) continue;
      const from = textOf(cable, "FROM"), to = textOf(cable, "TO");
      const ports = cable.children.filter((c) => c.tag === "PORT").map((c) => unescapeXml(c.text ?? ""));
      const a = refToId.get(from), b = refToId.get(to);
      if (!a || !b) {
        warnings.push("collegamento con un dispositivo ignorato: saltato");
        continue;
      }
      const link = { a: { dev: a, port: ports[0] }, b: { dev: b, port: ports[1] } };
      const dce = textOf(cable, "DCEDEV");
      if (dce) {
        const dceId = refToId.get(dce);
        if (dceId === b) [link.a, link.b] = [link.b, link.a];
      }
      links.push(link);
    }
    return { network: { devices, links }, warnings, info };
  }
  function mulberry32(a) {
    return () => {
      a = a + 1831565813 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function seedOf(s) {
    let h2 = 2166136261;
    for (const c of s) h2 = Math.imul(h2 ^ c.charCodeAt(0), 16777619);
    return h2 >>> 0;
  }
  var hex = (rng, n) => Array.from({ length: n }, () => Math.floor(rng() * 16).toString(16)).join("").toUpperCase();
  var mac = (rng) => {
    const h2 = "00" + hex(rng, 10);
    return `${h2.slice(0, 4)}.${h2.slice(4, 8)}.${h2.slice(8, 12)}`;
  };
  var uuid = (rng) => `{${hex(rng, 8)}-${hex(rng, 4)}-4${hex(rng, 3)}-${hex(rng, 4)}-${hex(rng, 12)}}`.toLowerCase();
  var bigDigits = (rng) => String(BigInt(Math.floor(rng() * 9e15)) * 1000n + BigInt(Math.floor(rng() * 1e3)) + 1000000000000000000n);
  var memAddr = (rng) => String(5e10 + Math.floor(rng() * 6e8) * 8);
  function linkLocal(m) {
    const b = m.replace(/\./g, "").match(/../g).map((x) => parseInt(x, 16));
    const g = (a, c) => (a << 8 | c).toString(16).toUpperCase();
    return `FE80::${g(b[0] ^ 2, b[1])}:${g(b[2], 255)}:${g(254, b[3])}:${g(b[4], b[5])}`;
  }
  function freshen(dn, id, rng, pos) {
    const engine = child(dn, "ENGINE");
    setChildText(engine, "NAME", id);
    setChildText(engine, "SAVE_REF_ID", `save-ref-id:${bigDigits(rng)}`);
    const sn = textOf(engine, "SERIALNUMBER");
    setChildText(engine, "SERIALNUMBER", sn.slice(0, 7) + hex(rng, 4) + (sn.endsWith("-") ? "-" : ""));
    const macs = /* @__PURE__ */ new Map();
    for (const n of walkNodes(dn)) {
      if (!n.children.length && /^[0-9A-F]{4}\.[0-9A-F]{4}\.[0-9A-F]{4}$/.test(n.text ?? "")) {
        if (!macs.has(n.text)) macs.set(n.text, mac(rng));
        n.text = macs.get(n.text);
      }
    }
    for (const n of walkNodes(dn)) {
      if (n.tag !== "PORT") continue;
      const m = textOf(n, "MACADDRESS");
      if (!m) continue;
      for (const t of ["IPV6_LINK_LOCAL", "IPV6_DEFAULT_LINK_LOCAL"]) if (child(n, t) && textOf(n, t)) setChildText(n, t, linkLocal(m));
    }
    const clock = path(engine, "PTP_PROCESS/PTP_CLOCK_ID");
    if (clock) {
      const b = mac(rng).replace(/\./g, "").match(/../g);
      setText(clock, `0x${b[0]}:${b[1]}:${b[2]}:FF:FE:${b[3]}:${b[4]}:${b[5]}`);
    }
    const duid = path(engine, "DHCPV6_MAIN/PARTIAL_DUID");
    if (duid) setText(duid, hex(rng, 8).match(/../g).join("-") + "-");
    const beacon = path(engine, "BLUETOOTH_MANAGER/BEACON_UUID");
    if (beacon) setText(beacon, uuid(rng));
    const logical = path(dn, "WORKSPACE/LOGICAL");
    setChildText(logical, "X", pos.x);
    setChildText(logical, "Y", pos.y);
    setChildText(logical, "MEM_ADDR", memAddr(rng));
    setChildText(logical, "DEV_ADDR", memAddr(rng));
    unplace(dn);
    return engine;
  }
  function writeVlans(engine, vlans) {
    const vl = child(engine, "VLANS");
    if (!vl) return;
    const std = (id, name) => {
      const v = el("VLAN", "");
      v.text = null;
      v.selfClosing = true;
      v.attrs = [["name", name], ["number", String(id)], ["rspan", "0"]];
      return v;
    };
    vl.children = [std(1, "default"), ...vlans.filter((v) => v.id > 1).map((v) => std(v.id, v.name)), std(1002, "fddi-default"), std(1003, "token-ring-default"), std(1004, "fddinet-default"), std(1005, "trnet-default")];
  }
  function buildHardware(dev, tpl) {
    const spec = specOf(dev);
    if (!spec) throw new PktmdError(`${dev.id}: modello sconosciuto`, dev.line);
    const dn = clone(tpl.models.get(spec.key));
    const engine = child(dn, "ENGINE");
    if (dev.nic) setNic(engine, spec, dev.nic, tpl.modules, dev.nicSlot ?? 0);
    if (dev.modules?.length) {
      if (spec.family === "host") throw new PktmdError(`${dev.id}: i moduli valgono solo per router e switch`, dev.line);
      for (const m of dev.modules) {
        const slots = slotContainers(engine, spec);
        const name = m.name === "none" ? null : resolveModuleName(m.name);
        try {
          if (m.slot !== void 0 && child(slots[m.slot] ?? {}, "MODULE")) slots[m.slot].children = slots[m.slot].children.filter((c) => c.tag !== "MODULE");
          if (name) installModule(engine, spec, name, tpl.modules, m.slot);
        } catch (e) {
          throw e instanceof PktmdError ? new PktmdError(`${dev.id}: ${e.rawMessage}`, dev.line) : e;
        }
      }
    }
    return { spec, dn, engine, inv: inventory(engine, spec) };
  }
  async function portNamesOf(dev) {
    const tpl = await getTemplate();
    return buildHardware(dev, tpl).inv.map((p) => p.name);
  }
  async function toXml(network, { layout = true, warnings = [] } = {}) {
    const tpl = await getTemplate();
    const root = clone(tpl.skeleton);
    const netNode = child(root, "NETWORK");
    const ids = /* @__PURE__ */ new Set();
    for (const d of network.devices) {
      if (ids.has(d.id)) throw new PktmdError(`dispositivo "${d.id}" definito due volte`, d.line);
      ids.add(d.id);
    }
    const built = /* @__PURE__ */ new Map();
    for (const dev of network.devices) {
      const hw = buildHardware(dev, tpl);
      built.set(dev.id, { dev, ...hw, rng: mulberry32(seedOf(dev.id)) });
    }
    const resolved = resolveLinks(network, (d) => built.get(d.id)?.inv.map((p) => p.name) ?? [], (id) => built.get(id)?.dev);
    const work = /* @__PURE__ */ new Map();
    for (const b of built.values()) work.set(b.dev.id, JSON.parse(JSON.stringify(b.dev)));
    mergeLinkOptions(resolved, work, (id) => built.get(id)?.spec.type);
    const portInfo = (b) => {
      const dceOf = /* @__PURE__ */ new Set();
      const linked = /* @__PURE__ */ new Set();
      for (const l of resolved) {
        for (const [e, other] of [[l.a, l.b], [l.b, l.a]]) {
          if (e.dev !== b.dev.id || !e.port) continue;
          linked.add(e.port);
          void other;
        }
        if (l.a.dev === b.dev.id && l.a.port && b.inv.find((p) => p.name === l.a.port && isSerialPort(p))) dceOf.add(l.a.port);
      }
      return { dceOf, linked };
    };
    for (const b of built.values()) {
      const { spec, engine, inv } = b;
      const dev = work.get(b.dev.id);
      if (spec.family === "host") {
        if (dev.hostname) throw new PktmdError(`${dev.id}: "name" non e' supportato su ${dev.type} (e' l'hostname di router e switch)`, dev.line);
        for (const k of ["rip", "ospf"]) if (dev[k]) throw new PktmdError(`${dev.id}: ${k} vale solo per i router`, dev.line);
        if (dev.cli) throw new PktmdError(`${dev.id}: il blocco cli vale solo per router e switch`, dev.line);
        if (spec.type !== "server" && (dev.files?.length || dev.dnsRecords?.length || dev.dhcpPools?.length || dev.mailDomain || dev.mailUsers?.length)) {
          throw new PktmdError(`${dev.id}: file, record DNS, pool DHCP e utenti di posta valgono solo per i server`, dev.line);
        }
        applyHost(engine, dev, spec.type, inv);
        continue;
      }
      if (dev.files?.length) throw new PktmdError(`${dev.id}: i file HTTP valgono solo per i server`, dev.line);
      if (dev.gw && spec.type === "router") throw new PktmdError(`${dev.id}: un router non ha "gw": usa "route default via <indirizzo>"`, dev.line);
      const { dceOf } = portInfo(b);
      const primary = inv[0]?.name;
      const comp = compile(dev, { type: spec.type, primary });
      const known = new Set(inv.map((p) => p.name));
      for (const p of comp.ports) {
        const base2 = p.name.replace(/\.\d+$/, "");
        if (/^Vlan\d+$/.test(p.name)) {
          if (spec.type === "switch" || spec.type === "router") continue;
        }
        if (!known.has(base2)) throw new PktmdError(`${dev.id}: la porta ${shortPort(base2)} non esiste (porte: ${inv.map((x) => shortPort(x.name)).join(", ")})`, p.line ?? dev.line);
      }
      if (spec.type === "switch" && comp.rip) throw new PktmdError(`${dev.id}: rip non ha senso su uno switch`, dev.line);
      if (spec.type === "switch" && comp.ports.some((p) => p.ip && !/^Vlan\d+$/.test(p.name))) {
        throw new PktmdError(`${dev.id}: gli switch non hanno IP sulle porte fisiche (usa "ip A/n" per la gestione)`, dev.line);
      }
      const base = cfgLines(engine);
      const ctxPorts = inv.map((p) => ({
        name: p.name,
        serial: isSerialPort(p),
        dce: isSerialPort(p) && (dceOf.has(p.name) || !resolved.some((l) => l.a.dev === dev.id && l.a.port === p.name || l.b.dev === dev.id && l.b.port === p.name)),
        duplex: spec.family === "isr" && p.module === "" && /Ethernet/.test(p.name),
        defaultShutdown: spec.type === "router"
      }));
      const lines = lowerIos(comp, base, { type: spec.type, ports: ctxPorts, vlan1: spec.family !== "ptrouter" });
      const withCli = comp.cli ? applyCli(lines, comp.cli, { dev, known: new Set(inv.map((p) => p.name)) }) : lines;
      setConfig(engine, withCli, true);
      syncPorts(inv, withCli);
      if (spec.type === "switch") writeVlans(engine, comp.vlans);
    }
    const pos = layout ? autoLayout({ devices: network.devices, links: resolved }) : /* @__PURE__ */ new Map();
    for (const b of built.values()) freshen(b.dn, b.dev.id, b.rng, pos.get(b.dev.id) ?? { x: 100, y: 100 });
    for (const b of built.values()) {
      if (b.spec.family === "host") continue;
      const sn = textOf(b.engine, "SERIALNUMBER");
      const rc = child(b.engine, "RUNNINGCONFIG");
      for (const t of ["RUNNINGCONFIG", "STARTUPCONFIG"]) {
        const n = child(b.engine, t);
        for (const l of childrenOf(n, "LINE")) l.text = (l.text ?? "").replace(/^(license udi pid \S+ sn ).*$/, `$1FTX${sn.slice(7, 11)}${sn.slice(3, 7)}-`);
      }
      void rc;
    }
    const linkNodes = [];
    for (const l of resolved) {
      const A = built.get(l.a.dev), B = built.get(l.b.dev);
      if (!A || !B) throw new PktmdError(`dispositivo "${(A ? l.b : l.a).dev}" inesistente`, l.line);
      const pa = A.inv.find((p) => p.name === l.a.port), pb = B.inv.find((p) => p.name === l.b.port);
      if (!pa) throw new PktmdError(`${l.a.dev}: la porta ${shortPort(l.a.port ?? "?")} non esiste (porte: ${A.inv.map((x) => shortPort(x.name)).join(", ")})`, l.line);
      if (!pb) throw new PktmdError(`${l.b.dev}: la porta ${shortPort(l.b.port ?? "?")} non esiste (porte: ${B.inv.map((x) => shortPort(x.name)).join(", ")})`, l.line);
      let kind = cableKind(pa, pb);
      if (!kind) kind = [A, B].filter((x) => x.spec.type === "switch").length === 1 ? "eCopper:eStraightThrough" : "eCopper:eCrossOver";
      const ln = clone(tpl.links.get(kind));
      const cable = child(ln, "CABLE");
      const refs = [A, B].map((x) => textOf(x.engine, "SAVE_REF_ID"));
      let pi = 0;
      for (const c of cable.children) {
        if (c.tag === "FROM") setText(c, refs[0]);
        else if (c.tag === "TO") setText(c, refs[1]);
        else if (c.tag === "PORT") setText(c, [pa, pb][pi++].name);
      }
      setChildText(cable, "FROM_DEVICE_MEM_ADDR", textOf(path(A.dn, "WORKSPACE/LOGICAL"), "DEV_ADDR"));
      setChildText(cable, "TO_DEVICE_MEM_ADDR", textOf(path(B.dn, "WORKSPACE/LOGICAL"), "DEV_ADDR"));
      setChildText(cable, "FROM_PORT_MEM_ADDR", memAddr(A.rng));
      setChildText(cable, "TO_PORT_MEM_ADDR", memAddr(B.rng));
      if (kind === "eSerial") {
        setChildText(cable, "DCEDEV", refs[0]);
        setChildText(cable, "DCEPORT", pa.name);
      }
      linkNodes.push(ln);
    }
    child(netNode, "DEVICES").children = [...built.values()].map((b) => b.dn);
    child(netNode, "LINKS").children = linkNodes;
    const guidRng = mulberry32(seedOf("vista-fisica:" + [...built.keys()].join(",")));
    placeDevices(root, [...built.values()].map((b) => b.dn), () => uuid(guidRng));
    const problems = validateXml(root, { generated: true });
    if (problems.length) throw new Error(`Il file generato non e' coerente (errore di pktmd, non del testo): ${problems.slice(0, 4).join("; ")}`);
    return serializeXml(root);
  }
  function syncPorts(inv, lines) {
    for (const p of inv) {
      const i = lines.indexOf(`interface ${p.name}`);
      if (i < 0) continue;
      let j = i + 1;
      const body = [];
      while (j < lines.length && /^\s/.test(lines[j])) body.push(lines[j++].trim());
      const m = body.map((l) => /^ip address (\S+) (\S+)$/.exec(l)).find(Boolean);
      if (m) {
        setChildText(p.node, "IP", m[1]);
        setChildText(p.node, "SUBNET", m[2]);
      } else if (textOf(p.node, "IP")) {
        for (const t of ["IP", "SUBNET"]) {
          const c = child(p.node, t);
          if (c) {
            c.children = [];
            c.text = null;
            c.selfClosing = true;
          }
        }
      }
      setChildText(p.node, "POWER", body.includes("shutdown") ? "false" : "true");
      if (isSerialPort(p) && child(p.node, "CLOCKRATEFLAG")) {
        const ck = body.map((l) => /^clock rate (\d+)$/.exec(l)).find(Boolean);
        setChildText(p.node, "CLOCKRATEFLAG", ck ? "true" : "false");
        if (ck && child(p.node, "CLOCKRATE")) setChildText(p.node, "CLOCKRATE", ck[1]);
      }
    }
  }
  async function portsFor(key) {
    return (await getTemplate()).portsOf(key);
  }
  function simplifyNetwork(network, info) {
    const dce = /* @__PURE__ */ new Set();
    for (const l of network.links) if (/^Serial/.test(l.a.port ?? "")) dce.add(`${l.a.dev}|${l.a.port}`);
    const devices = network.devices.map((d) => {
      const i = info.get(d.id);
      if (!i || i.spec.family === "host") return d;
      const copy = JSON.parse(JSON.stringify(d));
      for (const p of copy.ports) {
        if (p.clock !== void 0 && (!dce.has(`${d.id}|${p.name}`) || p.clock === 2e6)) delete p.clock;
      }
      return simplify(copy, { type: i.spec.type, primary: i.inv[0]?.name });
    });
    return { ...network, devices };
  }
  async function describeNetwork(network) {
    const tpl = await getTemplate();
    const hw = /* @__PURE__ */ new Map();
    const models = /* @__PURE__ */ new Map();
    for (const d of network.devices) {
      try {
        const h2 = buildHardware(d, tpl);
        hw.set(d.id, h2);
        models.set(d.id, h2.spec.pt);
      } catch {
      }
    }
    const byId = new Map(network.devices.map((d) => [d.id, d]));
    const resolved = resolveLinksSafe(network, (d) => hw.get(d.id)?.inv.map((p) => p.name) ?? [], (id) => byId.get(id));
    const links = resolved.map((l) => {
      const A = hw.get(l.a.dev), B = hw.get(l.b.dev);
      const pa = A?.inv.find((p) => p.name === l.a.port), pb = B?.inv.find((p) => p.name === l.b.port);
      let kind = "straight";
      try {
        const k = pa && pb ? cableKind(pa, pb) : null;
        if (k === "eSerial") kind = "serial";
        else if (k) kind = "fiber";
        else if (A && B) kind = [A, B].filter((x) => x.spec.type === "switch").length === 1 ? "straight" : "cross";
      } catch {
      }
      return { ...l, kind };
    });
    return { links, models };
  }

  // src/renderer.js
  var THEMES = {
    light: {
      bg: "#ffffff",
      text: "#16202b",
      muted: "#5d6b7a",
      card: "#f3f6fa",
      cardLine: "#d3dce7",
      icon: "#2f6fb5",
      iconFill: "#d6e6f7",
      iconLight: "#f4f9ff",
      iconDark: "#1d4f87",
      straight: "#4b5a6b",
      fiber: "#e08a00",
      serial: "#d33a2c",
      pill: "#ffffff",
      pillLine: "#b9c6d4",
      sel: "#1f6feb",
      badge: "#e8f0fb"
    },
    dark: {
      bg: "#0f141a",
      text: "#e6edf5",
      muted: "#9aa7b6",
      card: "#18212b",
      cardLine: "#2b3846",
      icon: "#6aa7ee",
      iconFill: "#1f3d63",
      iconLight: "#2a4f7e",
      iconDark: "#a9cdf6",
      straight: "#8795a6",
      fiber: "#f0a030",
      serial: "#ff6b5b",
      pill: "#16202b",
      pillLine: "#3a4a5c",
      sel: "#58a6ff",
      badge: "#1b2b40"
    }
  };
  var ICON = 30;
  var isHost2 = (t) => t === "pc" || t === "server" || t === "laptop";
  function rr(ctx, x, y, w, h2, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h2, r);
  }
  function iconPaint(ctx, c, fill, stroke = true) {
    ctx.fillStyle = fill ?? c.iconFill;
    ctx.fill();
    if (stroke) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = c.icon;
      ctx.stroke();
    }
  }
  function arrow(ctx, x1, y1, x2, y2, size = 5) {
    const a = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.moveTo(x2 - size * Math.cos(a - 0.5), y2 - size * Math.sin(a - 0.5));
    ctx.lineTo(x2, y2);
    ctx.lineTo(x2 - size * Math.cos(a + 0.5), y2 - size * Math.sin(a + 0.5));
    ctx.stroke();
  }
  var DRAW = {
    pc(ctx, c) {
      rr(ctx, -19, -28, 38, 28, 3);
      iconPaint(ctx, c);
      rr(ctx, -15, -24, 30, 20, 2);
      iconPaint(ctx, c, c.iconLight, false);
      rr(ctx, -4, 0, 8, 5, 1);
      iconPaint(ctx, c);
      rr(ctx, -20, 5, 40, 9, 2);
      iconPaint(ctx, c);
      rr(ctx, -22, 17, 44, 8, 2);
      iconPaint(ctx, c, c.iconLight);
    },
    laptop(ctx, c) {
      rr(ctx, -19, -26, 38, 26, 3);
      iconPaint(ctx, c);
      rr(ctx, -15, -22, 30, 18, 2);
      iconPaint(ctx, c, c.iconLight, false);
      ctx.beginPath();
      ctx.moveTo(-26, 12);
      ctx.lineTo(26, 12);
      ctx.lineTo(20, 2);
      ctx.lineTo(-20, 2);
      ctx.closePath();
      iconPaint(ctx, c);
      rr(ctx, -26, 12, 52, 5, 2);
      iconPaint(ctx, c);
    },
    server(ctx, c) {
      rr(ctx, -16, -28, 32, 56, 3);
      iconPaint(ctx, c);
      ctx.strokeStyle = c.icon;
      ctx.lineWidth = 1.6;
      for (const y of [-19, -9, 1]) {
        rr(ctx, -11, y, 22, 6, 1);
        iconPaint(ctx, c, c.iconLight, true);
      }
      ctx.beginPath();
      ctx.arc(0, 17, 3, 0, 7);
      ctx.fillStyle = c.icon;
      ctx.fill();
    },
    switch(ctx, c) {
      rr(ctx, -29, -13, 58, 26, 4);
      iconPaint(ctx, c);
      ctx.strokeStyle = c.iconDark;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      arrow(ctx, -20, -4, 20, -4);
      arrow(ctx, 20, 4, -20, 4);
      ctx.lineCap = "butt";
      ctx.lineJoin = "miter";
    },
    router(ctx, c) {
      ctx.beginPath();
      ctx.arc(0, 0, 27, 0, 7);
      iconPaint(ctx, c);
      ctx.strokeStyle = c.iconDark;
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      arrow(ctx, -6, 0, -19, 0, 6);
      arrow(ctx, 6, 0, 19, 0, 6);
      arrow(ctx, 0, -19, 0, -6, 6);
      arrow(ctx, 0, 19, 0, 6, 6);
      ctx.lineCap = "butt";
      ctx.lineJoin = "miter";
    }
  };
  function drawOther(ctx, c, label) {
    rr(ctx, -30, -22, 60, 44, 8);
    iconPaint(ctx, c);
    ctx.fillStyle = c.iconDark;
    ctx.font = "600 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const words = String(label).split(/[\s-]+/);
    const lines = words.length > 1 ? [words.slice(0, Math.ceil(words.length / 2)).join(" "), words.slice(Math.ceil(words.length / 2)).join(" ")] : [label];
    lines.forEach((t, i) => ctx.fillText(t.slice(0, 11), 0, (i - (lines.length - 1) / 2) * 13));
  }
  function strokeLink(ctx, c, kind, a, b, trunk) {
    ctx.save();
    ctx.lineCap = "round";
    if (kind === "fiber") {
      ctx.strokeStyle = c.fiber;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.strokeStyle = c.bg;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    } else if (kind === "serial") {
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const half = Math.min(28, len / 2 - 4);
      const p = (t, o) => ({ x: mid.x + ux * t + nx * o, y: mid.y + uy * t + ny * o });
      ctx.strokeStyle = c.serial;
      ctx.lineWidth = 2.4;
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      const s = p(-half, 0), z = [p(-half * 0.35, 9), p(half * 0.1, -9), p(half, 0)];
      ctx.lineTo(s.x, s.y);
      for (const q of z) ctx.lineTo(q.x, q.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    } else {
      ctx.strokeStyle = c.straight;
      ctx.lineWidth = trunk ? 3.6 : 2.2;
      if (kind === "cross") ctx.setLineDash([9, 6]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
  }
  var overlaps = (r, s, pad = 2) => r.x < s.x + s.w + pad && r.x + r.w + pad > s.x && r.y < s.y + s.h + pad && r.y + r.h + pad > s.y;
  function createNetworkView(container, opts = {}) {
    const canvas = document.createElement("canvas");
    canvas.style.cssText = "display:block;width:100%;height:100%;touch-action:none;cursor:default";
    container.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    let nodes = [];
    let links = [];
    let layout = null;
    let view = { x: 0, y: 0, k: 1 };
    let size = { w: 300, h: 300, dpr: 1 };
    let hover = null;
    let drag = null;
    let showLegend = false;
    let userView = false;
    const dark = () => opts.theme === "dark" || opts.theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches;
    function resize() {
      const r = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      size = { w: Math.max(50, r.width), h: Math.max(50, r.height), dpr };
      canvas.width = Math.round(size.w * dpr);
      canvas.height = Math.round(size.h * dpr);
      if (opts.autoFit && !userView && nodes.length) api.fit();
      else draw();
    }
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    const toWorld = (px, py) => ({ x: (px - size.w / 2 - view.x) / view.k, y: (py - size.h / 2 - view.y) / view.k });
    const byId = () => new Map(nodes.map((n) => [n.id, n]));
    const nodeAt = (wx, wy) => [...nodes].reverse().find((n) => Math.abs(n.x - wx) <= ICON && Math.abs(n.y - wy) <= ICON);
    function measure(text, font) {
      ctx.font = font;
      return ctx.measureText(text).width;
    }
    function computeBoxes() {
      const map = byId();
      const placed = [];
      const nameBoxes = /* @__PURE__ */ new Map(), cards = /* @__PURE__ */ new Map();
      const hasKids = (n) => (layout?.children.get(n.id)?.length ?? 0) > 0 || links.filter((l) => l.a === n.id || l.b === n.id).length > 1;
      for (const n of nodes) {
        const icon = { x: n.x - ICON, y: n.y - ICON, w: ICON * 2, h: ICON * 2 };
        placed.push(icon);
        const nameW = Math.max(measure(n.label, "600 13px system-ui, sans-serif"), measure(n.model ?? "", "10.5px system-ui, sans-serif")) + 12;
        const nameH = n.model ? 31 : 19;
        const cardW = n.lines.length ? Math.max(...n.lines.map((l) => measure(l, "11px ui-monospace, Consolas, monospace"))) + 14 : 0;
        const cardH = n.lines.length ? n.lines.length * 14 + 8 : 0;
        const side = !isHost2(n.type) && hasKids(n);
        let nb, cb;
        if (side) {
          nb = { x: n.x + ICON + 8, y: n.y - ICON + 2, w: nameW, h: nameH };
          cb = n.lines.length ? { x: n.x + ICON + 8, y: nb.y + nameH + 3, w: cardW, h: cardH } : null;
        } else {
          nb = { x: n.x - nameW / 2, y: n.y + ICON + 4, w: nameW, h: nameH };
          cb = n.lines.length ? { x: n.x - cardW / 2, y: nb.y + nameH + 3, w: cardW, h: cardH } : null;
        }
        nameBoxes.set(n.id, nb);
        placed.push(nb);
        if (cb) {
          cards.set(n.id, cb);
          placed.push(cb);
        }
      }
      const badges = [];
      for (const l of links) {
        if (!l.badge) continue;
        const A = map.get(l.a), B = map.get(l.b);
        if (!A || !B) continue;
        const w = measure(l.badge, "600 10.5px system-ui, sans-serif") + 10;
        const r = { x: (A.x + B.x) / 2 - w / 2, y: (A.y + B.y) / 2 - 8, w, h: 16, text: l.badge };
        badges.push(r);
        placed.push(r);
      }
      const pills = [];
      for (const l of links) {
        const A = map.get(l.a), B = map.get(l.b);
        if (!A || !B) continue;
        for (const [n, o, port] of [[A, B, l.pa], [B, A, l.pb]]) {
          if (!port) continue;
          const text = shortPort(port);
          const w = measure(text, "10.5px ui-monospace, Consolas, monospace") + 9, h2 = 15;
          const dx = o.x - n.x, dy = o.y - n.y, d = Math.hypot(dx, dy) || 1;
          const ux = dx / d, uy = dy / d;
          const start = ICON + 4 + Math.abs(ux) * w / 2 + Math.abs(uy) * h2 / 2;
          let best = null;
          for (let k = 0; k < 9; k++) {
            const t = start + k * 13;
            if (t > d - ICON - 6) break;
            const r = { x: n.x + ux * t - w / 2, y: n.y + uy * t - h2 / 2, w, h: h2, text };
            const own = placed.filter((s) => s !== nameBoxes.get(n.id) || true);
            const hit = own.some((s) => overlaps(r, s));
            if (!best) best = r;
            if (!hit) {
              best = r;
              break;
            }
          }
          if (best) {
            pills.push(best);
            placed.push(best);
          }
        }
      }
      return { nameBoxes, cards, badges, pills };
    }
    function draw() {
      const c = THEMES[dark() ? "dark" : "light"];
      const { w, h: h2, dpr } = size;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = c.bg;
      ctx.fillRect(0, 0, w, h2);
      const map = byId();
      const boxes = computeBoxes();
      const detail = view.k > (opts.compact ? 0.4 : 0.5);
      ctx.save();
      ctx.translate(w / 2 + view.x, h2 / 2 + view.y);
      ctx.scale(view.k, view.k);
      for (const l of links) {
        const A = map.get(l.a), B = map.get(l.b);
        if (!A || !B) continue;
        strokeLink(ctx, c, l.kind, A, B, l.trunk);
      }
      for (const n of nodes) {
        ctx.save();
        ctx.translate(n.x, n.y);
        if (n === hover || n === drag?.node) {
          ctx.beginPath();
          ctx.arc(0, 0, ICON + 6, 0, 7);
          ctx.strokeStyle = c.sel;
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        if (DRAW[n.type]) DRAW[n.type](ctx, c);
        else drawOther(ctx, c, n.model ?? n.type);
        ctx.restore();
        const nb = boxes.nameBoxes.get(n.id);
        const left = nb.x > n.x;
        ctx.textBaseline = "top";
        ctx.textAlign = left ? "left" : "center";
        const tx = left ? nb.x + 2 : nb.x + nb.w / 2;
        ctx.fillStyle = c.bg;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(nb.x, nb.y, nb.w, nb.h);
        ctx.globalAlpha = 1;
        ctx.fillStyle = c.text;
        ctx.font = "600 13px system-ui, sans-serif";
        ctx.fillText(n.label, tx, nb.y + 2);
        if (n.model) {
          ctx.fillStyle = c.muted;
          ctx.font = "10.5px system-ui, sans-serif";
          ctx.fillText(n.model, tx, nb.y + 18);
        }
        const cb = boxes.cards.get(n.id);
        if (cb && detail) {
          rr(ctx, cb.x, cb.y, cb.w, cb.h, 5);
          ctx.fillStyle = c.card;
          ctx.fill();
          ctx.lineWidth = 1;
          ctx.strokeStyle = c.cardLine;
          ctx.stroke();
          ctx.fillStyle = c.text;
          ctx.font = "11px ui-monospace, Consolas, monospace";
          ctx.textAlign = "left";
          n.lines.forEach((t, i) => ctx.fillText(t, cb.x + 7, cb.y + 5 + i * 14));
        }
      }
      if (detail) {
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (const b of boxes.badges) {
          rr(ctx, b.x, b.y, b.w, b.h, 8);
          ctx.fillStyle = c.badge;
          ctx.fill();
          ctx.strokeStyle = c.icon;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = c.iconDark;
          ctx.font = "600 10.5px system-ui, sans-serif";
          ctx.fillText(b.text, b.x + b.w / 2, b.y + b.h / 2 + 0.5);
        }
        for (const p of boxes.pills) {
          rr(ctx, p.x, p.y, p.w, p.h, 4);
          ctx.fillStyle = c.pill;
          ctx.fill();
          ctx.strokeStyle = c.pillLine;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.fillStyle = c.muted;
          ctx.font = "10.5px ui-monospace, Consolas, monospace";
          ctx.fillText(p.text, p.x + p.w / 2, p.y + p.h / 2 + 0.5);
        }
      }
      ctx.restore();
      if (showLegend) drawLegend(c);
    }
    function drawLegend(c) {
      const items = [["straight", "rame dritto"], ["cross", "rame incrociato"], ["fiber", "fibra"], ["serial", "seriale"], ["trunk", "trunk"]];
      const x0 = 14, y0 = size.h - 14 - items.length * 20;
      ctx.save();
      ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
      rr(ctx, x0 - 8, y0 - 8, 148, items.length * 20 + 10, 8);
      ctx.fillStyle = c.card;
      ctx.globalAlpha = 0.92;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = c.cardLine;
      ctx.lineWidth = 1;
      ctx.stroke();
      items.forEach(([kind, label], i) => {
        const y = y0 + i * 20 + 6;
        strokeLink(ctx, c, kind === "trunk" ? "straight" : kind, { x: x0, y }, { x: x0 + 42, y }, kind === "trunk");
        ctx.fillStyle = c.muted;
        ctx.font = "11.5px system-ui, sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(label, x0 + 52, y);
      });
      ctx.restore();
    }
    const pt = (ev) => {
      const r = canvas.getBoundingClientRect();
      return { x: ev.clientX - r.left, y: ev.clientY - r.top };
    };
    const subtree = (id) => {
      const out = [id];
      for (const k of layout?.children.get(id) ?? []) out.push(...subtree(k));
      return out;
    };
    canvas.addEventListener("pointerdown", (ev) => {
      const p = pt(ev), w = toWorld(p.x, p.y);
      const n = nodeAt(w.x, w.y);
      canvas.setPointerCapture(ev.pointerId);
      if (n) {
        const ids = ev.shiftKey || isHost2(n.type) ? [n.id] : subtree(n.id);
        const map = byId();
        drag = { node: n, ids, start: { x: w.x, y: w.y }, origin: new Map(ids.map((i) => [i, { x: map.get(i).x, y: map.get(i).y }])) };
        canvas.style.cursor = "grabbing";
      } else {
        drag = { pan: true, sx: p.x, sy: p.y, vx: view.x, vy: view.y };
        canvas.style.cursor = "grabbing";
      }
    });
    canvas.addEventListener("pointermove", (ev) => {
      const p = pt(ev), w = toWorld(p.x, p.y);
      if (drag?.node) {
        const map = byId();
        for (const id of drag.ids) {
          const o = drag.origin.get(id), n = map.get(id);
          n.x = o.x + (w.x - drag.start.x);
          n.y = o.y + (w.y - drag.start.y);
          n.moved = true;
        }
        opts.onMove?.();
        draw();
      } else if (drag?.pan) {
        userView = true;
        view.x = drag.vx + p.x - drag.sx;
        view.y = drag.vy + p.y - drag.sy;
        draw();
      } else {
        const n = nodeAt(w.x, w.y) ?? null;
        if (n !== hover) {
          hover = n;
          canvas.style.cursor = n ? "grab" : "default";
          draw();
        }
      }
    });
    const end = () => {
      drag = null;
      canvas.style.cursor = hover ? "grab" : "default";
      draw();
    };
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
    canvas.addEventListener("wheel", (ev) => {
      if (opts.wheel === "ctrl" && !ev.ctrlKey && !ev.metaKey) return;
      ev.preventDefault();
      userView = true;
      const p = pt(ev);
      const before = toWorld(p.x, p.y);
      view.k = Math.min(3, Math.max(0.2, view.k * Math.exp(-ev.deltaY * 15e-4)));
      view.x = p.x - size.w / 2 - before.x * view.k;
      view.y = p.y - size.h / 2 - before.y * view.k;
      draw();
    }, { passive: false });
    canvas.addEventListener("dblclick", () => api.fit());
    const api = {
      /**
       * @param net        modello (dispositivi con porte/IP)
       * @param described  { links: [{a:{dev,port},b:{dev,port},kind,opts}], models: Map }  (da describeNetwork)
       */
      setNetwork(net, described) {
        const old = byId();
        const rl = described?.links ?? net.links;
        layout = hierarchyLayout({ devices: net.devices, links: rl }, opts.compact ? { hostW: 140, infraW: 205, vGap: 175 } : { hostW: 170, infraW: 250, vGap: 230 });
        nodes = net.devices.map((d) => {
          const lines = [];
          for (const p of d.ports) {
            if (!p.ip && !p.dhcp) continue;
            const label = p.name === null ? "" : p.name.startsWith("Vlan") ? p.name.toLowerCase() : shortPort(p.name) + (p.vlan !== void 0 && !/\./.test(p.name) ? "." + p.vlan : "");
            lines.push(`${label ? label + " " : ""}${p.ip ? p.ip + "/" + p.prefix : "dhcp"}`);
          }
          const prev = old.get(d.id);
          const at = layout.pos.get(d.id);
          const node = prev?.moved ? prev : { x: at.x, y: at.y, moved: false };
          return Object.assign(node, { id: d.id, type: d.type, label: d.id, model: described?.models?.get(d.id) ?? null, lines });
        });
        links = rl.map((l) => ({
          a: l.a.dev,
          b: l.b.dev,
          pa: l.a.port,
          pb: l.b.port,
          kind: l.kind ?? "straight",
          trunk: !!l.opts?.trunk,
          badge: l.opts?.trunk ? "trunk" + (l.opts.trunk.allowed ? " " + l.opts.trunk.allowed : "") : l.opts?.vlan !== void 0 ? "vlan " + l.opts.vlan : null
        }));
        draw();
      },
      /** rimette tutto dove lo metterebbe il layout automatico */
      relayout() {
        for (const n of nodes) {
          const at = layout.pos.get(n.id);
          if (at) {
            n.x = at.x;
            n.y = at.y;
            n.moved = false;
          }
        }
        draw();
      },
      /** posizioni correnti (coordinate del disegno) */
      getPositions() {
        return new Map(nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
      },
      fit() {
        if (!nodes.length) {
          view = { x: 0, y: 0, k: 1 };
          draw();
          return;
        }
        const boxes = computeBoxes();
        const rects = nodes.map((n) => ({ x: n.x - ICON, y: n.y - ICON, w: ICON * 2, h: ICON * 2 }));
        for (const m of [boxes.nameBoxes, boxes.cards]) rects.push(...m.values());
        const pad = 22;
        const minX = Math.min(...rects.map((r) => r.x)) - pad, maxX = Math.max(...rects.map((r) => r.x + r.w)) + pad;
        const minY = Math.min(...rects.map((r) => r.y)) - pad, maxY = Math.max(...rects.map((r) => r.y + r.h)) + pad;
        view.k = Math.min(1.25, Math.max(0.2, Math.min(size.w / (maxX - minX), size.h / (maxY - minY))));
        view.x = -((minX + maxX) / 2) * view.k;
        view.y = -((minY + maxY) / 2) * view.k;
        draw();
      },
      toggleLegend() {
        showLegend = !showLegend;
        draw();
      },
      setTheme(t) {
        opts.theme = t;
        draw();
      },
      /** dopo fit() esplicito si torna al centraggio automatico */
      resetView() {
        userView = false;
        api.fit();
      },
      redraw: draw,
      destroy() {
        ro.disconnect();
        canvas.remove();
      }
    };
    return api;
  }

  // src/embed.js
  async function checkPktmd(text) {
    let parsed;
    try {
      parsed = parsePktmd(text);
    } catch (e) {
      return { ok: false, error: e.message, line: e.line, warnings: [] };
    }
    const warnings = [...parsed.warnings];
    try {
      await toXml(parsed.network, { layout: false, warnings });
    } catch (e) {
      return { ok: false, error: e.message, line: e.line, warnings, network: parsed.network };
    }
    return { ok: true, warnings, network: parsed.network };
  }
  async function previewConfig(text) {
    const { network } = parsePktmd(text);
    const xml = await toXml(network, { layout: false });
    const root = parseXml(xml);
    const out = /* @__PURE__ */ new Map();
    for (const d of childrenOf(child(child(root, "NETWORK"), "DEVICES"), "DEVICE")) {
      const e = child(d, "ENGINE");
      const rc = child(e, "RUNNINGCONFIG");
      if (!rc) continue;
      out.set(textOf(e, "NAME"), childrenOf(rc, "LINE").map((l) => unescapeXml(l.text ?? "")).filter((l) => l !== "!"));
    }
    return out;
  }
  function mountNetwork(container, text, opts = {}) {
    const view = createNetworkView(container, { theme: opts.theme, wheel: opts.wheel ?? "ctrl", autoFit: opts.autoFit ?? true, compact: opts.compact ?? true });
    let seq = 0;
    async function setText2(t) {
      const token = ++seq;
      const { network, warnings } = parsePktmd(t);
      const described = await describeNetwork(network);
      if (token !== seq) return { network, warnings, stale: true };
      view.setNetwork(network, described);
      view.resetView();
      return { network, warnings };
    }
    const api = { view, setText: setText2, destroy: () => view.destroy(), ready: text === void 0 ? Promise.resolve() : setText2(text) };
    return api;
  }

  // src/index.js
  async function pktToPktmd(bytes, { pos = false } = {}) {
    const tpl = await getTemplate();
    const xml = await decodePkt(bytes);
    const { network, warnings, info } = fromXml(parseXml(xml), tpl);
    const simple = simplifyNetwork(network, info);
    const text = stringifyPktmd(simple, { pos, portsOf: (d) => info.get(d.id)?.inv.map((p) => p.name) ?? [] });
    return { text, network: simple, warnings };
  }
  async function pktmdToPkt(text) {
    const { network, warnings } = parsePktmd(text);
    const xml = await toXml(network, { warnings });
    return { bytes: await encodePkt(xml), xml, network, warnings };
  }
  return __toCommonJS(index_exports);
})();
