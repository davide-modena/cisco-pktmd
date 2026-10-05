import test from "node:test";
import assert from "node:assert/strict";
import { Twofish } from "../src/twofish.js";

const hex = (u) => Buffer.from(u).toString("hex");

test("Twofish-128: vettore di test ufficiale (chiave 0, testo 0)", () => {
  const tf = new Twofish(new Uint8Array(16));
  assert.equal(hex(tf.encrypt(new Uint8Array(16))), "9f589f5cf6122c32b6bfec2f2ae8c35a");
});
