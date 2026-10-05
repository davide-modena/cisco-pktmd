import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { decodePkt, encodePkt, eaxDecrypt, eaxEncrypt } from "../src/pkt.js";
import { parseXml, serializeXml } from "../src/xml.js";
import { pktmdToPkt } from "../src/index.js";

function eaxRoundTrip(r) {
  const n = r.length;
  const s1 = new Uint8Array(n);
  for (let i = 0; i < n; i++) s1[i] = r[n - 1 - i] ^ ((n - i * n) & 255);
  assert.deepEqual(eaxEncrypt(eaxDecrypt(s1)), s1);
}

// ---- senza file esterni: si parte da un esempio .pktmd --------------------------------------------------------
test("codec: un .pkt generato si decodifica, l'XML e' lossless e il tag EAX torna", async () => {
  const { bytes, xml } = await pktmdToPkt(readFileSync("examples/pktmd/01-rete-base.pktmd", "utf8"));
  assert.equal(await decodePkt(bytes), xml);
  assert.equal(serializeXml(parseXml(xml)), xml);
  assert.equal(await decodePkt(await encodePkt(xml)), xml);
  eaxRoundTrip(bytes);
});

// ---- con i .pkt di riferimento (non sono nel repository: si saltano se mancano) ---------------------------------
for (const f of ["samples/cisco 6.2.pkt", "samples/cisco 9.0.pkt"]) {
  const skip = !existsSync(f) || !existsSync(f.replace(".pkt", ".xml"));
  const raw = () => new Uint8Array(readFileSync(f));

  test(`decode ${f} coincide con l'XML di riferimento (python)`, { skip }, async () => {
    assert.equal(await decodePkt(raw()), readFileSync(f.replace(".pkt", ".xml"), "utf8"));
  });
  test(`xml lossless ${f}`, { skip }, async () => {
    const xml = await decodePkt(raw());
    assert.equal(serializeXml(parseXml(xml)), xml);
  });
  test(`encode -> decode ${f}`, { skip }, async () => {
    const xml = await decodePkt(raw());
    assert.equal(await decodePkt(await encodePkt(xml)), xml);
  });
  test(`tag EAX riprodotto ${f}`, { skip }, () => eaxRoundTrip(raw()));
}
