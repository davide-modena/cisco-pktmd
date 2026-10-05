// Codec .pkt <-> XML (formato Packet Tracer >= 6.x).
//   decode: reverse+xor -> Twofish-EAX -> xor -> qUncompress
//   encode: l'inverso
import { Twofish } from "./twofish.js";

const KEY = new Uint8Array(16).fill(0x89);
const NONCE = new Uint8Array(16).fill(0x10);
const tf = new Twofish(KEY);

const xor16 = (a, b) => { const r = new Uint8Array(16); for (let i = 0; i < 16; i++) r[i] = a[i] ^ b[i]; return r; };

function dbl(b) {
  const r = new Uint8Array(16);
  const carry = b[0] >> 7;
  for (let i = 0; i < 15; i++) r[i] = ((b[i] << 1) | (b[i + 1] >> 7)) & 255;
  r[15] = (b[15] << 1) & 255;
  if (carry) r[15] ^= 0x87;
  return r;
}

const L = tf.encrypt(new Uint8Array(16));
const K1 = dbl(L), K2 = dbl(K1);

/** OMAC con tweak t (0 = nonce, 1 = header, 2 = ciphertext) */
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
    last[m.length - lastStart] = 0x80;
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
    for (let k = 15; k >= 0; k--) { counter[k] = (counter[k] + 1) & 255; if (counter[k]) break; }
  }
  return out;
}

export function eaxDecrypt(data) {
  return ctr(data.subarray(0, data.length - 16)); // tag finale non verificato
}

export function eaxEncrypt(plain) {
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

/** @param {Uint8Array} raw contenuto del .pkt @returns {Promise<string>} XML */
export async function decodePkt(raw) {
  const n = raw.length;
  const s1 = new Uint8Array(n);
  for (let i = 0; i < n; i++) s1[i] = raw[n - 1 - i] ^ ((n - i * n) & 255);
  const s2 = eaxDecrypt(s1);
  const m = s2.length;
  const s3 = new Uint8Array(m);
  for (let i = 0; i < m; i++) s3[i] = s2[i] ^ ((m - i) & 255);
  const size = new DataView(s3.buffer).getUint32(0, false);
  const xml = await pipe(s3.subarray(4), new DecompressionStream("deflate"));
  if (xml.length !== size) throw new Error(`pkt: dimensione attesa ${size}, ottenuta ${xml.length}`);
  return new TextDecoder("utf-8").decode(xml);
}

/** @param {string} xml @returns {Promise<Uint8Array>} contenuto del .pkt */
export async function encodePkt(xml) {
  const bytes = new TextEncoder().encode(xml);
  const z = await pipe(bytes, new CompressionStream("deflate"));
  const s3 = new Uint8Array(4 + z.length);
  new DataView(s3.buffer).setUint32(0, bytes.length, false);
  s3.set(z, 4);
  const m = s3.length;
  const s2 = new Uint8Array(m);
  for (let i = 0; i < m; i++) s2[i] = s3[i] ^ ((m - i) & 255);
  const s1 = eaxEncrypt(s2);
  const n = s1.length;
  const raw = new Uint8Array(n);
  for (let i = 0; i < n; i++) raw[n - 1 - i] = s1[i] ^ ((n - i * n) & 255);
  return raw;
}
