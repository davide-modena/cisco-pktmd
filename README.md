# pktmd

Converte i file di **Cisco Packet Tracer** (`.pkt`) in un testo semplice (`.pktmd`) e viceversa, e li disegna come schema di rete.
Nessun file intermedio: solo `.pkt` e `.pktmd`. Il linguaggio semplifica VLAN, trunk, NAT, RIP/OSPF, DHCP, DNS, posta, ACL e sicurezza; il blocco `cli` per i comandi IOS grezzi e' l'ultima risorsa.

```bash
node web/serve.mjs                      # convertitore + schema su http://localhost:5173
node bin/pktmd.js rete.pkt              # -> rete.pktmd
node bin/pktmd.js rete.pktmd            # -> rete.pkt   (Packet Tracer 9.0)
node --test                             # test (include la prova su tutti i .pkt di esempio)
node scripts/fidelity.mjs --text        # solo la prova sui .pkt: leggi -> testo -> rigenera -> confronta
npm run build                           # ricostruisce dist/ (libreria) e docs/guida.html (guida)
```

Senza dipendenze a runtime (Node >= 20, browser moderno); `esbuild` e `marked` servono solo per `npm run build`.

**Guida con esempi vivi: [`docs/guida.html`](docs/guida.html)** — si apre con doppio clic. Parte dalle basi e accanto a ogni esempio mostra lo schema disegnato (e, dove serve, la configurazione IOS generata); gli esempi sono modificabili. Il sorgente e' in Markdown: [`docs/guida.md`](docs/guida.md). Riferimento compatto: [`docs/SINTASSI.md`](docs/SINTASSI.md).

## Come libreria

`dist/pktmd.min.js` e' uno script classico (anche da `file://`), `dist/pktmd.esm.js` un modulo ES. Disegnare una rete in una pagina:

```html
<script src="dist/pktmd.min.js"></script>
<div id="rete" style="height: 320px"></div>
<script>
  pktmd.mountNetwork(document.getElementById("rete"), `
r1:
  gi0/0 192.168.1.254/24
pc1:
  ip 192.168.1.10/24
  gw 192.168.1.254
sw1:
links:
  pc1 sw1
  sw1 r1
`);
</script>
```

| Funzione | Cosa fa |
|---|---|
| `mountNetwork(el, testo, opzioni?)` | disegna la rete; ritorna `{ view, setText, ready, destroy }` |
| `checkPktmd(testo)` | controlla tutto senza produrre file: `{ ok, error, line, warnings }` |
| `previewConfig(testo)` | la configurazione IOS generata: `Map` nome → righe |
| `pktmdToPkt(testo)` / `pktToPktmd(bytes)` | le due conversioni |
| `parsePktmd(testo)`, `describeNetwork(modello)` | modello e collegamenti risolti |

In Node: `import { pktmdToPkt } from "pktmd"` (vedi `package.json`, campo `exports`).

## Un assaggio

```
sw1:
  vlan 10 rosso
  vlan 20 blu
  fa0/10-24 access 99 down             // porte non usate: in una VLAN "buco nero", spente

pc1:
  ip 192.168.10.1/24
  gw 192.168.10.254
pc2:
  ip 192.168.20.1/24
  gw 192.168.20.254

r1:
  gi0/0 vlan 10 192.168.10.254/24      // sottointerfaccia gi0/0.10 con dot1Q 10
  gi0/0 vlan 20 192.168.20.254/24
  gi0/1 8.8.9.1/24
  route default via 8.8.9.254
  nat overload 192.168.10.0/24 192.168.20.0/24     // PAT: inside/outside e ACL si deducono

links:
  pc1 sw1 vlan 10                      // porta access in VLAN 10
  pc2 sw1 vlan 20
  sw1 r1 trunk 10,20                   // porta trunk
```

Sono 23 righe di testo; la configurazione IOS generata (tre dispositivi, interfacce incluse) ne conta 135. Il riferimento completo e' in **[docs/SINTASSI.md](docs/SINTASSI.md)**; esempi pronti in `examples/pktmd/`.

## Come funziona

| File | Compito |
|---|---|
| `src/twofish.js`, `src/pkt.js` | codec `.pkt` (Twofish-EAX + zlib, formato >= 6.x); verificato su file 6.2, 8.x e 9.0 |
| `src/xml.js` | parser XML senza perdite (parse → serialize e' identico byte per byte) |
| `src/pktmd.js`, `src/pktmd-write.js` | testo `.pktmd` ⇄ modello |
| `src/implied.js` | il "non detto": lati NAT, ACL automatiche, reti RIP, stato delle porte, VLAN usate (`compile`) e il suo inverso (`simplify`) |
| `src/ios.js`, `src/ios-lower.js`, `src/cli.js` | modello ⇄ running-config IOS; il blocco `cli` |
| `src/hosts.js` | PC e server: IP, DNS, DHCP, posta, record DNS, pagine web |
| `src/hw.js`, `src/catalog.js` | modelli, moduli, nomi delle porte, tipo di cavo |
| `src/pt.js` | modello ⇄ XML di Packet Tracer; usa i telai in `src/template-data.js` |
| `src/layout.js`, `src/renderer.js` | disposizione ad albero e disegno su canvas |
| `scripts/build-templates.mjs` | ricostruisce `src/template-data.js` dai `.pkt` reali in `samples/` e `examples/` |

I telai dei dispositivi (rumore: decine di KB di impostazioni per dispositivo) arrivano da **file `.pkt` veri**, azzerati ai default di Packet Tracer; MAC, seriali e identificatori derivano dal nome del dispositivo, quindi la generazione e' **deterministica**.
L'analisi dei 85 file di laboratorio e' in [docs/ANALISI.md](docs/ANALISI.md). Quei `.pkt` non sono nel repository: il collaudo di fedelta' e `build-templates` li usano se li metti in `examples/` e `samples/`, altrimenti i test relativi si saltano e il template gia' pronto (`src/template-data.js`) basta per tutto il resto.

## Limiti attuali

- **Generazione**: PC, server, router (2901, 2911, 1841, Router-PT, Router-PT-Empty), switch (2960, 2950, Switch-PT, Switch-PT-Empty). Non ci sono ancora laptop, access point, tablet/smartphone, telefoni IP, cloud, celle, ne' dispositivi IoT: si leggono come "non supportato" e si saltano. Per aggiungerne uno basta un `.pkt` che lo contenga.
- **Vista fisica**: i dispositivi generati non sono collocati nella vista fisica di Packet Tracer (citta' > edificio > rack): e' lo stato che Packet Tracer stesso scrive per un dispositivo non collocato, ed evita il difetto che faceva dichiarare "file corrotto" (riferimenti a nodi fisici inesistenti). Si possono trascinare nel rack a mano.
- **Non e' un round-trip fedele al byte**: nel `.pktmd` finisce solo cio' che la sintassi sa dire (il resto delle impostazioni, le caselle di posta gia' scritte, la cronologia dei comandi... si perdono). La configurazione IOS invece non si perde: cio' che non e' riconosciuto passa nel blocco `cli`.
- **Non verificato in Packet Tracer reale**: i file generati sono coerenti con quelli veri (stessa struttura, stessa config) ma io non posso aprirli. Se qualcosa non si apre o non si comporta come previsto, e' l'informazione piu' utile da mandarmi.
- `enable secret` scritto in chiaro e' accettato da IOS; Packet Tracer lo cifra all'apertura (non verificato).
