import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { pktToPktmd, pktmdToPkt, parsePktmd, toXml, getTemplate } from "../src/index.js";
import { validateXml } from "../src/validate.js";
import { serializeXml } from "../src/xml.js";

const example = (n) => readFileSync(`examples/pktmd/${n}.pktmd`, "utf8");
const configOf = (xml, device) => {
  const i = xml.indexOf(`<NAME translate="true">${device}</NAME>`);
  const sec = xml.slice(i);
  const rc = /<RUNNINGCONFIG>([\s\S]*?)<\/RUNNINGCONFIG>/.exec(sec)[1];
  return [...rc.matchAll(/<LINE>(.*?)<\/LINE>/g)].map((m) => m[1].replace(/&lt;/g, "<").replace(/&amp;/g, "&"));
};

// i .pkt di laboratorio non sono nel repository: senza, il collaudo si salta
const haveLab = readdirSync("examples").some((f) => f.endsWith(".pkt"));

test("collaudo di fedelta' su tutti i .pkt di esempio (testo incluso)", { timeout: 300000, skip: !haveLab }, () => {
  const out = execFileSync(process.execPath, ["scripts/fidelity.mjs", "--text"], { encoding: "utf8" });
  assert.match(out, /diversi\/errori: 0/);
  assert.match(out, /config con differenze: 0/);
});

test("ogni esempio .pktmd si genera e il giro pkt -> pktmd -> pkt -> pktmd e' stabile", async () => {
  for (const f of readdirSync("examples/pktmd").filter((f) => f.endsWith(".pktmd"))) {
    const first = await pktToPktmd((await pktmdToPkt(readFileSync(`examples/pktmd/${f}`, "utf8"))).bytes);
    const second = await pktToPktmd((await pktmdToPkt(first.text)).bytes);
    assert.equal(second.text, first.text, f);
  }
});

test("generazione deterministica", async () => {
  const a = await pktmdToPkt(example("01-rete-base")), b = await pktmdToPkt(example("01-rete-base"));
  assert.deepEqual(a.bytes, b.bytes);
});

test("NAT: lati inside/outside e ACL dedotti dalle regole", async () => {
  const cfg = configOf((await pktmdToPkt(example("03-nat"))).xml, "r1");
  assert.ok(cfg.includes("ip nat inside source list 1 interface GigabitEthernet0/1 overload"));
  assert.ok(cfg.includes("access-list 1 permit 192.168.1.0 0.0.0.255"));
  assert.ok(cfg.includes("ip nat inside source static tcp 192.168.1.10 80 8.8.9.1 80"));
  const i0 = cfg.indexOf("interface GigabitEthernet0/0"), i1 = cfg.indexOf("interface GigabitEthernet0/1");
  assert.ok(cfg.slice(i0, i1).includes(" ip nat inside"));
  assert.ok(cfg.slice(i1, i1 + 6).includes(" ip nat outside"));
});

test("VLAN: access e trunk sui collegamenti, sottointerfacce dalle righe di porta", async () => {
  const xml = (await pktmdToPkt(example("02-vlan-router-on-a-stick"))).xml;
  const sw = configOf(xml, "sw1");
  assert.deepEqual(sw.slice(sw.indexOf("interface FastEthernet0/1") + 1, sw.indexOf("interface FastEthernet0/1") + 3), [" switchport access vlan 10", " switchport mode access"]);
  assert.ok(sw.includes(" switchport trunk allowed vlan 10,20"));
  const r = configOf(xml, "r1");
  const i = r.indexOf("interface GigabitEthernet0/0.10");
  assert.deepEqual(r.slice(i, i + 3), ["interface GigabitEthernet0/0.10", " encapsulation dot1Q 10", " ip address 192.168.10.254 255.255.255.0"]);
  assert.match(xml, /<VLAN name="rosso" number="10" rspan="0"\/>/);
  // il padre delle sottointerfacce e' acceso
  const g = r.slice(r.indexOf("interface GigabitEthernet0/0") + 1, r.indexOf("interface GigabitEthernet0/0") + 4);
  assert.ok(!g.includes(" shutdown"));
});

test("RIP automatico: reti classful delle interfacce, passive, v2", async () => {
  const cfg = configOf((await pktmdToPkt(example("05-wan-rip-seriale"))).xml, "r1");
  const i = cfg.indexOf("router rip");
  assert.deepEqual(cfg.slice(i, i + 5), ["router rip", " version 2", " network 10.0.0.0", " network 192.168.1.0", " no auto-summary"]);
  assert.ok(cfg.includes(" passive-interface GigabitEthernet0/0"));
});

test("seriale: il primo estremo e' il DCE", async () => {
  const xml = (await pktmdToPkt(example("05-wan-rip-seriale"))).xml;
  assert.match(xml, /<DCEPORT>Serial0\/0\/0<\/DCEPORT>/);
  const r1 = configOf(xml, "r1");
  assert.ok(r1.includes(" clock rate 2000000")); // r1 e' DCE verso r2
  const r2 = configOf(xml, "r2");
  const i = r2.indexOf("interface Serial0/0/0");
  assert.ok(!r2.slice(i, i + 3).includes(" clock rate 2000000")); // il DTE non ha clock
});

test("servizi: DNS, DHCP, posta, host", async () => {
  const { xml } = await pktmdToPkt(example("04-servizi"));
  assert.match(xml, /<TYPE>A-REC<\/TYPE>\s*<NAME>www\.yellow\.it<\/NAME>\s*<TTL>86400<\/TTL>\s*<IPADDRESS>192\.168\.1\.251<\/IPADDRESS>/);
  assert.match(xml, /<TYPE>CNAME<\/TYPE>\s*<NAME>web\.yellow\.it<\/NAME>/);
  assert.match(xml, /<SMTP_DOMAIN>yellow\.it<\/SMTP_DOMAIN>/);
  assert.match(xml, /<MAIL_ID>alessandro@yellow\.it<\/MAIL_ID>/);
  assert.match(xml, /<START_IP>192\.168\.1\.100<\/START_IP>\s*<END_IP>192\.168\.1\.149<\/END_IP>/);
  assert.match(xml, /<PORT_DHCP_ENABLE>true<\/PORT_DHCP_ENABLE>/);
});

test("senza IP espliciti i device restano ai default di PT", async () => {
  const text = "pc1:\nsrv1:\nr1:\n gi0/0\n gi0/1 10.0.0.1/24\nsw1:\nlinks:\npc1 sw1\n";
  const { network } = await pktToPktmd((await pktmdToPkt(text)).bytes);
  const by = Object.fromEntries(network.devices.map((d) => [d.id, d]));
  assert.deepEqual(by.pc1.ports, []);
  assert.deepEqual(by.srv1.ports, []);
  assert.deepEqual(by.r1.ports.map((p) => [p.name, p.ip]), [["GigabitEthernet0/1", "10.0.0.1"]]);
});

test("porte: intervalli, sottointerfacce e opzioni", () => {
  const { network } = parsePktmd("sw1:\n fa0/5-8 access 99 down\n");
  assert.deepEqual(network.devices[0].ports.map((p) => p.name), ["FastEthernet0/5", "FastEthernet0/6", "FastEthernet0/7", "FastEthernet0/8"]);
  assert.ok(network.devices[0].ports.every((p) => p.access === 99 && p.admin === "down"));
});

test("cli senza indentazione: le sotto-modalita' si deducono", async () => {
  const text = "r1:\n gi0/0 10.0.0.1/24\n```cli\ninterface gi0/0\ndescription lan\nip helper-address 10.0.0.9\nip route 0.0.0.0 0.0.0.0 10.0.0.2\n```\n";
  const cfg = configOf((await pktmdToPkt(text)).xml, "r1");
  const i = cfg.indexOf("interface GigabitEthernet0/0");
  assert.ok(cfg.slice(i, i + 6).includes(" description lan"));
  assert.ok(cfg.slice(i, i + 6).includes(" ip helper-address 10.0.0.9"));
  assert.ok(cfg.includes("ip route 0.0.0.0 0.0.0.0 10.0.0.2"));
});

test("errori utili con numero di riga", async () => {
  assert.throws(() => parsePktmd("pc1:\n ip 1.2.3\n"), /riga 2/);
  assert.throws(() => parsePktmd("pippo:\n"), /non riconosco il tipo/);
  assert.throws(() => parsePktmd("pc1:\n\nlinks:\npc1 sw9\n"), /inesistente/);
  assert.throws(() => parsePktmd("sw1:\n```cli\nvlan 10\n\nr1:\n```cli\nx\n```\n"), /non e' chiuso/);
  assert.throws(() => parsePktmd("srv1: pos 1 2\n"), /sulla riga sotto/);
  await assert.rejects(pktmdToPkt("r1:\n fa0/9 10.0.0.1/24\n"), /non esiste/);
  await assert.rejects(pktmdToPkt("r1:\n```cli\ninterface gi0/7\nno shutdown\n```\n"), /non esiste/);
  await assert.rejects(pktmdToPkt("r1: router 2911\n module serial\nr2: router 2911\n module serial\nlinks:\nr1.se0/0/0 r2.gi0/0\n"), /seriale/);
});

test("un dispositivo puo' chiamarsi come una parola chiave (DNS, DHCP)", () => {
  const { network } = parsePktmd("DNS: server\n ip 1.1.1.1/24\nDHCP: server\n");
  assert.deepEqual(network.devices.map((d) => d.id), ["DNS", "DHCP"]);
});

test("il corpo non indentato e i blocchi di codice con ':' non confondono il parser", () => {
  const { network } = parsePktmd("srv1:\nip 10.0.0.1/8\n```html a.html\n<p>x: y</p>\nciao:\n```\npc1:\nip 10.0.0.2/8\n");
  assert.equal(network.devices.length, 2);
  assert.equal(network.devices[0].files[0].content, "<p>x: y</p>\nciao:");
});

test("il layout non cambia i dispositivi e produce coordinate positive", async () => {
  const { network } = parsePktmd(example("06-edificio"));
  const xml = await toXml(network);
  const xs = [...xml.matchAll(/<LOGICAL>\s*<X>([\d.]+)<\/X>\s*<Y>([\d.]+)<\/Y>/g)].map((m) => [+m[1], +m[2]]);
  assert.equal(xs.length, network.devices.length);
  assert.ok(xs.every(([x, y]) => x >= 0 && y >= 0));
});

// ---- regressione: "file corrotto" in Packet Tracer ---------------------------------------------------------------
// I telai vengono da file diversi, ognuno con una propria vista fisica (citta', edificio, rack...) con identificativi casuali.
// Un dispositivo che cita un nodo inesistente fa dichiarare il file corrotto: i dispositivi generati non vanno collocati.
const TUTTI_I_MODELLI = `
a1: router 2901
a2: router 2911
a3: router 1841
a4: router pt
a5: router empty
b1: switch 2960
b2: switch 2950
b3: switch pt
b4: switch empty
pc1:
pc2: pc gig
srv1:
srv2: server fiber
links:
pc1 b1
pc2 b1
srv1 b2
b1 a1
b2 a2
a3 b3
`;

test("ogni modello genera un file coerente (nessun riferimento orfano, nessun duplicato)", async () => {
  const { xml } = await pktmdToPkt(TUTTI_I_MODELLI);
  assert.deepEqual(validateXml(xml, { generated: true }), []);
  // ogni dispositivo e' collocato nella vista fisica con un proprio nodo (percorso Citta' > ... > armadio/ufficio > nodo)
  const n = (xml.match(/<DEVICE>/g) ?? []).length;
  const paths = [...xml.matchAll(/<PHYSICAL>([^<]+)<\/PHYSICAL>/g)].map((m) => m[1].split(","));
  assert.equal(paths.length, n);
  assert.ok(paths.every((p) => p.length >= 4));
});

test("il validatore trova il difetto che rendeva i file illeggibili", async () => {
  const { xml } = await pktmdToPkt("r1:\nsw1:\nlinks:\nr1 sw1\n");
  const guasto = xml.replace(/<PHYSICAL>[^<]+<\/PHYSICAL>/,"<PHYSICAL>{ab536a45-590c-4c7b-9af8-4977b55b694a},{452a60f0-7c52-435f-8a00-000000000000}</PHYSICAL>");
  assert.match(validateXml(guasto).join("\n"), /vista fisica cita/);
  const doppio = xml.replace(/<SAVE_REF_ID>([^<]+)<\/SAVE_REF_ID>/g, "<SAVE_REF_ID>save-ref-id:1</SAVE_REF_ID>");
  assert.match(validateXml(doppio).join("\n"), /SAVE_REF_ID duplicato/);
});

test("il template non contiene dati personali", async () => {
  const tpl = await getTemplate();
  const testo = serializeXml(tpl.skeleton) + [...tpl.models.values()].map(serializeXml).join("");
  assert.ok(!/\/Users\/|[A-Z]:\Users\|\/home\/|@[\w-]+\.\w+/.test(testo), "percorsi o indirizzi personali nel template");
});
