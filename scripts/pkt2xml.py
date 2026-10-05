#!/usr/bin/env python3
"""Decodifica un file Packet Tracer (.pkt/.pka) in XML.

Pipeline (formato >= 6.x/7.x):
  1. de-offuscamento: reverse + xor con (len - i*len)
  2. Twofish-EAX (key=0x89*16, nonce=0x10*16), tag finale ignorato
  3. xor con (len - i)
  4. qUncompress: 4 byte (size, big endian) + zlib
"""
import sys, zlib, struct

try:
    import imp  # noqa: F401
except ModuleNotFoundError:  # Python >= 3.12: il pacchetto 'twofish' usa ancora imp
    import types, importlib.machinery, importlib.util
    _imp = types.ModuleType("imp")

    def _find_module(name):
        spec = importlib.machinery.PathFinder.find_spec(name)
        return None, spec.origin, None

    _imp.find_module = _find_module
    sys.modules["imp"] = _imp
import twofish

KEY = bytes([137]) * 16
IV = bytes([16]) * 16
_tf = twofish.Twofish(KEY)


def _xor(a, b):
    return bytes(x ^ y for x, y in zip(a, b))


def _dbl(b):
    n = int.from_bytes(b, "big") << 1
    if n >> 128:
        n = (n & ((1 << 128) - 1)) ^ 0x87
    return n.to_bytes(16, "big")


def _omac(t, data):
    L = _tf.encrypt(bytes(16))
    k1 = _dbl(L)
    k2 = _dbl(k1)
    pre = bytes(15) + bytes([t])
    data = pre + data
    blocks = [data[i:i + 16] for i in range(0, len(data), 16)]
    last = blocks[-1]
    if len(last) == 16:
        last = _xor(last, k1)
    else:
        last = _xor(last + b"\x80" + bytes(15 - len(last)), k2)
    x = bytes(16)
    for blk in blocks[:-1]:
        x = _tf.encrypt(_xor(x, blk))
    return _tf.encrypt(_xor(x, last))


def eax_decrypt(data, nonce):
    ct = data[:-16]  # ultimi 16 byte = tag (non verificato)
    ctr = int.from_bytes(_omac(0, nonce), "big")
    out = bytearray()
    for i in range(0, len(ct), 16):
        ks = _tf.encrypt(ctr.to_bytes(16, "big"))
        out += _xor(ct[i:i + 16], ks)
        ctr = (ctr + 1) & ((1 << 128) - 1)
    return bytes(out)


def decode(raw):
    n = len(raw)
    s1 = bytes(raw[n - 1 - i] ^ ((n - i * n) & 0xFF) for i in range(n))
    s2 = eax_decrypt(s1, IV)
    m = len(s2)
    s3 = bytes(s2[i] ^ ((m - i) & 0xFF) for i in range(m))
    size = struct.unpack(">I", s3[:4])[0]
    xml = zlib.decompress(s3[4:])
    assert len(xml) == size, (len(xml), size)
    return xml


if __name__ == "__main__":
    src = sys.argv[1]
    dst = sys.argv[2] if len(sys.argv) > 2 else src.rsplit(".", 1)[0] + ".xml"
    xml = decode(open(src, "rb").read())
    open(dst, "wb").write(xml)
    print(f"{src} -> {dst} ({len(xml)} byte)")
