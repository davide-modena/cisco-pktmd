# Analisi dei 85 file `.pkt`

> I 85 `.pkt` analizzati sono materiale di laboratorio e **non sono nel repository** (`/examples/*.pkt` e `/samples/` sono in `.gitignore`); restano i `.pktmd` e i `.pkt` generati in `examples/pktmd/`. Per rifare l'analisi metti i tuoi `.pkt` in `examples/` e lancia `node scripts/fidelity.mjs --text`.

Tutti i file della cartella `examples/` sono stati decodificati e confrontati. Questo documento riassume cosa contengono e come Packet Tracer li memorizza, perche' e' da qui che nasce il linguaggio.

## Il campione

| | |
|---|---|
| File | 85 `.pkt` (versioni 6.2, 8.0, 8.1, 8.2, 9.0) |
| Dispositivi | ~1.700 |
| Collegamenti | ~1.450 (917 rame, 384 fibra, 54 seriali, 71 IoT, 13 USB, 11 coassiali) |

Modelli piu' frequenti: PC-PT 391, Server-PT 312, 2901 177, 2960-24TT 162, Router-PT 103, Router-PT-Empty 103, Switch-PT-Empty 51, 2911 25, MCU/SBC (IoT) 50, TabletPC/Smartphone/Cell-Tower/HomeRouter 60.

Tre famiglie di laboratori:
1. **Reti classiche** (inoltro, routing, VLAN, NAT, DNS, posta): PC, server, 2901/2911, 2960. E' il grosso dei file ed e' interamente coperto dal linguaggio.
2. **Reti ISP** (Router-PT-Empty/Switch-PT-Empty con moduli in fibra, NAT/PAT, MAN/WAN): coperte, con i moduli `PT-ROUTER-NM-*` e `PT-SWITCH-NM-*`.
3. **IoT, wireless, cellulare** (MCU, SBC, sensori, access point, tablet, smartphone, celle): non supportati (vengono segnalati e saltati).

## Come Packet Tracer memorizza le cose

| Cosa | Dove sta nel `.pkt` |
|---|---|
| IP, gateway, DNS, DHCP di un **PC/server** | campi strutturati (`PORT/IP`, `GATEWAY`, `DNS_CLIENT`, `PORT_DHCP_ENABLE`) |
| Servizi dei **server** (DNS, DHCP, posta, HTTP, NTP...) | elementi strutturati (`DNS_SERVER`, `DHCP_SERVERS`, `EMAIL_SERVER`, `HTTP_SERVER`...); le pagine web nel `FILE_MANAGER` |
| Configurazione di **router e switch** (interfacce, RIP, NAT, ACL, rotte, DHCP, vty...) | **solo come testo** nella `RUNNINGCONFIG` (non esiste nessun elemento strutturato per il routing: Packet Tracer la riesegue all'apertura) |
| **VLAN** (numero e nome) | elemento strutturato `VLANS` dello switch; `switchport` e trunk sono testo |
| IP delle interfacce fisiche | doppio: `PORT/IP` e testo di config (vanno tenuti coerenti) |
| Sottointerfacce e SVI | solo testo |
| Collegamenti | `LINKS/LINK/CABLE`: dispositivi per `SAVE_REF_ID` (per indice nei file 6.x), porte per nome, tipo di cavo; i seriali dichiarano `DCEDEV`/`DCEPORT` |
| Hardware | albero `MODULE/SLOT/MODULE/PORT`: i nomi delle porte IOS si ricavano dalla struttura (verificato su 632 router/switch) |

Conseguenze per il progetto:
- Per router e switch basta **generare la config testuale**: per questo NAT, RIP, ACL, VLAN... si possono esprimere in modo semplice e produrre IOS esatto.
- Le VLAN vanno scritte in **due posti** (database `VLANS` e `switchport` nel testo).
- I nomi delle porte seguono regole per famiglia: ISR (`Gi0/0`, `Gi0/<slot>/<n>`), Router-PT (`<tipo><slot>/0`), Switch-PT (`<tipo><slot>/1`), 2960 (`Fa0/1-24`, `Gi0/1-2`), host (`<tipo><slot>`).

## Cosa si usa davvero (numero di file)

| Funzione | File |
|---|---|
| Indirizzi, interfacce spente/accese | 75 |
| RIP (v2, passive-interface, redistribute static) | 36 |
| NAT (statico, pool, PAT con `overload`) + ACL standard/estese | 24 |
| Rotte statiche | 20 |
| Sottointerfacce dot1Q (router-on-a-stick) | 18 |
| `switchport access/trunk` | 21 |
| Seriali con `clock rate` | 18 |
| DHCP su router, `ip helper-address` | 8 / 5 |
| `ip name-server`, `ip domain-name`, SSH, `username`, password sui vty | 6 / 2 |
| Server: DNS (48 varianti), file HTTP (39), DHCP (14), posta (10) | molti |

I laboratori sono da corso CCNA: niente EIGRP, BGP, STP o EtherChannel — e' per questo che il linguaggio copre bene il necessario e lascia al `cli` il resto.

## Scelte che ne derivano

- **Default dai dati.** I valori "di fabbrica" dei template (servizi del server, pagina `index.html`, scheda di rete...) sono quelli piu' frequenti nei 85 file, non valori inventati. La vera pagina predefinita del server, per esempio, e' quella di 225 server su 312.
- **Il non detto si deduce**: lati `inside/outside` del NAT, ACL del NAT, reti di RIP, stato acceso/spento delle porte, VLAN usate, tipo di cavo, sottointerfacce.
- **Niente va perso in lettura**: tutto cio' che il modello non riconosce passa nel blocco `cli`.
- **VLAN e trunk sui collegamenti**: nei laboratori ogni porta access e' un collegamento; scriverlo li' elimina quasi tutte le righe di porta.

## Collaudo

`node scripts/fidelity.mjs --text` legge ognuno dei 85 file, ne ricava il `.pktmd`, lo rilegge, genera un nuovo `.pkt`, lo rilegge e confronta:
- il modello (dispositivi, porte, VLAN, NAT, RIP, rotte, ACL, DHCP, servizi, collegamenti) deve essere identico;
- ogni riga di configurazione IOS originale deve ritrovarsi nella config rigenerata (a parte forme equivalenti: spazi finali, numerazione delle ACL del NAT, `username ... privilege 1 password 0`).

Esito: 85/85. Resta non verificabile da qui il comportamento reale di Packet Tracer all'apertura dei file generati.
