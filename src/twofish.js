// Twofish (chiave 128 bit, solo cifratura di blocco: EAX/CTR/OMAC non servono altro).

const T = {
  q0: [
    [0x8, 0x1, 0x7, 0xd, 0x6, 0xf, 0x3, 0x2, 0x0, 0xb, 0x5, 0x9, 0xe, 0xc, 0xa, 0x4],
    [0xe, 0xc, 0xb, 0x8, 0x1, 0x2, 0x3, 0x5, 0xf, 0x4, 0xa, 0x6, 0x7, 0x0, 0x9, 0xd],
    [0xb, 0xa, 0x5, 0xe, 0x6, 0xd, 0x9, 0x0, 0xc, 0x8, 0xf, 0x3, 0x2, 0x4, 0x7, 0x1],
    [0xd, 0x7, 0xf, 0x4, 0x1, 0x2, 0x6, 0xe, 0x9, 0xb, 0x3, 0x0, 0x8, 0x5, 0xc, 0xa],
  ],
  q1: [
    [0x2, 0x8, 0xb, 0xd, 0xf, 0x7, 0x6, 0xe, 0x3, 0x1, 0x9, 0x4, 0x0, 0xa, 0xc, 0x5],
    [0x1, 0xe, 0x2, 0xb, 0x4, 0xc, 0x3, 0x7, 0x6, 0xd, 0xa, 0x5, 0xf, 0x9, 0x0, 0x8],
    [0x4, 0xc, 0x7, 0x5, 0x1, 0x6, 0x9, 0xa, 0x0, 0xe, 0xd, 0x8, 0x2, 0xb, 0x3, 0xf],
    [0xb, 0x9, 0x5, 0x1, 0xc, 0x3, 0xd, 0xe, 0x6, 0x4, 0x7, 0xf, 0x2, 0x0, 0x8, 0xa],
  ],
};

const ror4 = (x, n) => ((x >> n) | (x << (4 - n))) & 15;

function buildQ(t) {
  const q = new Uint8Array(256);
  for (let x = 0; x < 256; x++) {
    const a0 = x >> 4, b0 = x & 15;
    const a1 = a0 ^ b0;
    const b1 = a0 ^ ror4(b0, 1) ^ ((8 * a0) & 15);
    const a2 = t[0][a1], b2 = t[1][b1];
    const a3 = a2 ^ b2;
    const b3 = a2 ^ ror4(b2, 1) ^ ((8 * a2) & 15);
    q[x] = 16 * t[3][b3] + t[2][a3];
  }
  return q;
}
const Q0 = buildQ(T.q0), Q1 = buildQ(T.q1);

function gfMul(a, b, poly) {
  let r = 0;
  while (b) {
    if (b & 1) r ^= a;
    a <<= 1;
    if (a & 0x100) a ^= poly;
    b >>= 1;
  }
  return r;
}

const MDS = [
  [0x01, 0xef, 0x5b, 0x5b],
  [0x5b, 0xef, 0xef, 0x01],
  [0xef, 0x5b, 0x01, 0xef],
  [0xef, 0x01, 0xef, 0x5b],
];
const RS = [
  [0x01, 0xa4, 0x55, 0x87, 0x5a, 0x58, 0xdb, 0x9e],
  [0xa4, 0x56, 0x82, 0xf3, 0x1e, 0xc6, 0x68, 0xe5],
  [0x02, 0xa1, 0xfc, 0xc1, 0x47, 0xae, 0x3d, 0x19],
  [0xa4, 0x55, 0x87, 0x5a, 0x58, 0xdb, 0x9e, 0x03],
];

const rol = (x, n) => ((x << n) | (x >>> (32 - n))) >>> 0;
const ror = (x, n) => ((x >>> n) | (x << (32 - n))) >>> 0;
const word = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

/** h(x, [L0, L1]) per chiavi da 128 bit; ogni L e` un array di 4 byte. */
function h(x, L0, L1) {
  const y = [x & 255, (x >> 8) & 255, (x >> 16) & 255, (x >> 24) & 255];
  const z0 = Q1[Q0[Q0[y[0]] ^ L1[0]] ^ L0[0]];
  const z1 = Q0[Q0[Q1[y[1]] ^ L1[1]] ^ L0[1]];
  const z2 = Q1[Q1[Q0[y[2]] ^ L1[2]] ^ L0[2]];
  const z3 = Q0[Q1[Q1[y[3]] ^ L1[3]] ^ L0[3]];
  const z = [z0, z1, z2, z3];
  let out = 0;
  for (let i = 0; i < 4; i++) {
    let v = 0;
    for (let j = 0; j < 4; j++) v ^= gfMul(MDS[i][j], z[j], 0x169);
    out |= v << (8 * i);
  }
  return out >>> 0;
}

const wordBytes = (w) => [w & 255, (w >>> 8) & 255, (w >>> 16) & 255, (w >>> 24) & 255];

export class Twofish {
  /** @param {Uint8Array} key 16 byte */
  constructor(key) {
    if (key.length !== 16) throw new Error("Twofish: solo chiavi da 128 bit");
    const Me = [word(key, 0), word(key, 8)];
    const Mo = [word(key, 4), word(key, 12)];
    // vettore S: S_i = RS * key[8i..8i+7]
    const S = [];
    for (let i = 0; i < 2; i++) {
      const w = [0, 0, 0, 0];
      for (let r = 0; r < 4; r++) {
        let v = 0;
        for (let c = 0; c < 8; c++) v ^= gfMul(RS[r][c], key[8 * i + c], 0x14d);
        w[r] = v;
      }
      S.push(w);
    }
    const sL0 = S[1], sL1 = S[0];
    // sottochiavi
    const K = new Uint32Array(40);
    const meL0 = wordBytes(Me[0]), meL1 = wordBytes(Me[1]);
    const moL0 = wordBytes(Mo[0]), moL1 = wordBytes(Mo[1]);
    for (let i = 0; i < 20; i++) {
      const A = h((2 * i * 0x01010101) >>> 0, meL0, meL1);
      const B = rol(h(((2 * i + 1) * 0x01010101) >>> 0, moL0, moL1), 8);
      K[2 * i] = (A + B) >>> 0;
      K[2 * i + 1] = rol((A + 2 * B) >>> 0, 9);
    }
    this.K = K;
    // tabelle S-box + MDS per g()
    this.sb = [0, 1, 2, 3].map(() => new Uint32Array(256));
    for (let x = 0; x < 256; x++) {
      const z = [
        Q1[Q0[Q0[x] ^ sL1[0]] ^ sL0[0]],
        Q0[Q0[Q1[x] ^ sL1[1]] ^ sL0[1]],
        Q1[Q1[Q0[x] ^ sL1[2]] ^ sL0[2]],
        Q0[Q1[Q1[x] ^ sL1[3]] ^ sL0[3]],
      ];
      for (let j = 0; j < 4; j++) {
        let out = 0;
        for (let i = 0; i < 4; i++) out |= gfMul(MDS[i][j], z[j], 0x169) << (8 * i);
        this.sb[j][x] = out >>> 0;
      }
    }
  }

  g(x) {
    const s = this.sb;
    return (s[0][x & 255] ^ s[1][(x >>> 8) & 255] ^ s[2][(x >>> 16) & 255] ^ s[3][x >>> 24]) >>> 0;
  }

  /** @param {Uint8Array} p 16 byte @returns {Uint8Array} */
  encrypt(p) {
    const K = this.K;
    let r0 = (word(p, 0) ^ K[0]) >>> 0, r1 = (word(p, 4) ^ K[1]) >>> 0;
    let r2 = (word(p, 8) ^ K[2]) >>> 0, r3 = (word(p, 12) ^ K[3]) >>> 0;
    for (let r = 0; r < 16; r++) {
      const t0 = this.g(r0), t1 = this.g(rol(r1, 8));
      const f0 = (t0 + t1 + K[2 * r + 8]) >>> 0;
      const f1 = (t0 + 2 * t1 + K[2 * r + 9]) >>> 0;
      const n2 = ror((r2 ^ f0) >>> 0, 1);
      const n3 = (rol(r3, 1) ^ f1) >>> 0;
      r2 = r0; r3 = r1; r0 = n2; r1 = n3;
    }
    const c = [r2 ^ K[4], r3 ^ K[5], r0 ^ K[6], r1 ^ K[7]];
    const out = new Uint8Array(16);
    for (let i = 0; i < 4; i++) {
      const w = c[i] >>> 0;
      out[4 * i] = w & 255; out[4 * i + 1] = (w >>> 8) & 255;
      out[4 * i + 2] = (w >>> 16) & 255; out[4 * i + 3] = w >>> 24;
    }
    return out;
  }
}
