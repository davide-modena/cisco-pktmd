# Guida alla sintassi di pktmd

`pktmd` descrive una rete di **Cisco Packet Tracer** in poche righe di testo: dispositivi, indirizzi, VLAN, NAT, routing, servizi e collegamenti. Da quel testo si ottiene il file `.pkt` (e viceversa), e lo schema della rete che vedi accanto a ogni esempio.

> **Come usare questa pagina.** Ogni riquadro con il codice è un **esempio vivo**: modifica il testo e lo schema si aggiorna subito. Trascina un nodo per spostarlo (porta con sé quello che ha sotto; **Maiusc** = solo lui), **Ctrl + rotella** per zoomare, doppio clic per ricentrare. Dove c'è il pulsante **IOS generato** vedi la configurazione Cisco che ne esce, cioè quello che avresti dovuto digitare a mano.

Quello che non scrivi resta ai **default di Packet Tracer**. L'obiettivo del linguaggio è che tu non debba quasi mai scrivere comandi IOS: per i casi rari esiste il blocco [`cli`](#12-il-blocco-cli), ma è l'ultima risorsa.

---

## 1. Le basi

### 1.1 Un dispositivo

Una riga che finisce con `:` apre un **dispositivo**. Le righe sotto, fino al prossimo dispositivo, ne descrivono le proprietà, una per riga.

```pktmd h=210
pc1:
  ip 192.168.1.10/24
  gw 192.168.1.254
```

- `ip 192.168.1.10/24` dà l'indirizzo, con il prefisso dopo la barra (si può scrivere anche `ip 192.168.1.10 255.255.255.0`).
- `gw` è il default gateway.
- L'**indentazione è solo estetica**: puoi scrivere le proprietà anche a filo col margine, il convertitore capisce dove finisce un dispositivo e dove comincia il prossimo.

### 1.2 Il tipo si capisce dal nome

Se il nome è una di queste parole **seguita da cifre**, il tipo si deduce da solo:

| Nome | Tipo |
|---|---|
| `pc1`, `PC0` | PC |
| `srv1`, `server2` | server |
| `sw1`, `switch3` | switch |
| `r1`, `router2` | router |

```pktmd h=210
pc1:
sw1:
r1:
srv1:
```

Se il nome è libero, scrivi il tipo dopo i due punti: `paolo: router`, `web: server`, `core: switch`.

```pktmd h=210
paolo: router
web: server
core: switch
```

### 1.3 Collegare i dispositivi

I collegamenti stanno in fondo, sotto `links:`, una riga per cavo con i nomi dei due dispositivi.

```pktmd h=330
pc1:
  ip 192.168.1.10/24
  gw 192.168.1.254

sw1:

r1:
  gi0/0 192.168.1.254/24

links:
  pc1 sw1
  sw1 r1
```

Per collegare piu' dispositivi allo stesso apparato puoi scrivere un elenco separato da virgole: `pc1,pc2 sw1` equivale a `pc1 sw1` e `pc2 sw1` (le opzioni, come `vlan 10`, valgono per tutti).

Non hai scelto nessuna porta e nessun cavo: il convertitore prende **la prima porta libera** di ciascun dispositivo (le sigle `fa0/1`, `gi0/0` che vedi nello schema) e sceglie il **tipo di cavo** giusto (dritto, incrociato, fibra, seriale).

Il router ha ricevuto un indirizzo con `gi0/0 192.168.1.254/24`: una riga che **comincia col nome di una porta** configura quella porta. Ne parliamo nel [capitolo 3](#3-le-porte).

### 1.4 La prima rete completa

Due PC su uno switch, un server su un altro, un router in mezzo, e una pagina web. Con `rip` il router annuncia da solo le sue reti.

````pktmd h=400 ios=r1
r1:
  gi0/0 192.168.1.254/24
  gi0/1 192.168.2.254/24
  rip

pc1:
  ip 192.168.1.1/24
  gw 192.168.1.254

pc2:
  ip 192.168.1.2/24
  gw 192.168.1.254

sw1:
sw2:

srv1:
  ip 192.168.2.1/24
  gw 192.168.2.254

  ```html index.html
  <html>
  <h1>Ciao! Benvenuto</h1>
  </html>
  ```

links:
  pc1 sw1
  pc2 sw1
  srv1 sw2
  sw1 r1
  sw2 r1
````

Apri **IOS generato** per vedere la configurazione che nasce dalle due righe `gi0/0 ...` e `rip`.

### 1.5 Commenti, righe vuote, maiuscole

- `// commento` vale da solo su una riga o in fondo a una riga.
- Le righe vuote si ignorano.
- Le parole chiave (`ip`, `vlan`, `nat`...) non distinguono maiuscole e minuscole; i **nomi dei dispositivi** sì.
- I nomi possono contenere lettere, cifre, `_` e `-`.

---

## 2. Indirizzi

| Scrivi | Significato |
|---|---|
| `ip 192.168.1.10/24` | indirizzo e prefisso |
| `ip 192.168.1.10 255.255.255.0` | lo stesso, con la maschera |
| `ip 192.168.1.10` | senza maschera: quella della classe (qui /24) |
| `ip dhcp` | prende l'indirizzo da un server DHCP |
| `gw 192.168.1.254` | default gateway |
| `dns 192.168.1.250` | server DNS |

Su un **PC o un server** `ip` riguarda l'unica scheda di rete. Su un **router** riguarda la prima porta; su uno **switch** è l'indirizzo di gestione (vedi [4.6](#46-gestire-lo-switch)). Per configurare porte precise si usano le righe di porta.

```pktmd h=300
pc1:
  ip 192.168.1.10 255.255.255.0
  gw 192.168.1.254
  dns 8.8.8.8

pc2:
  ip dhcp

sw1:

links:
  pc1 sw1
  pc2 sw1
```

---

## 3. Le porte

### 3.1 Come si chiamano

Si scrivono in forma breve: `fa` (FastEthernet), `gi` (GigabitEthernet), `se` (Serial). Quelle di ogni modello:

| Modello | Porte |
|---|---|
| PC, server | `fa0` (con scheda `gig`/`fiber`: `gi0`) |
| switch 2960 | `fa0/1`–`fa0/24`, `gi0/1`–`gi0/2` |
| switch 2950 | `fa0/1`–`fa0/24` |
| router 2901 | `gi0/0`, `gi0/1` (+ moduli) |
| router 2911 | `gi0/0`, `gi0/1`, `gi0/2` (+ moduli) |
| router 1841 | `fa0/0`, `fa0/1` (+ moduli) |
| Router-PT | `fa0/0`, `fa1/0`, `se2/0`, `se3/0`, `fa4/0`, `fa5/0` |
| Switch-PT | `fa0/1`, `fa1/1`, `fa2/1`, `fa3/1`, `fa4/1`, `fa5/1` |

Se scrivi una porta che non esiste ricevi un errore che elenca quelle valide.

### 3.2 Configurare una porta

Una riga che **comincia col nome della porta** la configura. Dopo il nome vanno le opzioni, in qualsiasi ordine.

```pktmd h=330 ios=r1
r1:
  gi0/0 192.168.1.254/24 desc LAN uffici
  gi0/1 10.0.0.1/30 down

sw1:

links:
  r1 sw1
```

Le opzioni più comuni:

| Opzione | Effetto |
|---|---|
| `192.168.1.1/24` | indirizzo IP |
| `dhcp` | indirizzo da DHCP |
| `down` / `up` | spenta / accesa |
| `desc testo` | descrizione (sempre ultima: prende il resto della riga) |
| `helper 10.0.0.250` | inoltro delle richieste DHCP |
| `acl NOME in` | applica un'[ACL](#9-acl-e-sicurezza) in ingresso (`out` in uscita) |
| `vlan 10`, `access 10`, `trunk` | VLAN (capitolo 4) |
| `inside`, `outside` | lato [NAT](#6-nat) (di solito si deduce) |
| `clock 64000` | velocità del clock sulle porte seriali |

Un router **accende da solo** le porte che hanno un indirizzo (e quelle che ospitano sottointerfacce); le altre restano spente, come in Packet Tracer. `up` e `down` forzano.

### 3.3 Intervalli

Per più porte uguali si scrive un intervallo: `fa0/5-24`, oppure una lista: `fa0/1,fa0/3,gi0/1-2`.

```pktmd h=260 ios=sw1
sw1:
  fa0/5-12 down
```

### 3.4 Scegliere la porta di un collegamento

Nei collegamenti si può indicare la porta dopo un punto: `r1.gi0/1`.

```pktmd h=300
r1:
  gi0/0 192.168.1.254/24
  gi0/1 10.0.0.1/30

r2:
  gi0/0 10.0.0.2/30

links:
  r1.gi0/1 r2.gi0/0
```

**Quale porta prende un collegamento se non la scrivi?** Per prime le porte **prenotate**: quelle con un indirizzo, con una sottointerfaccia o dichiarate "nude" (una riga come `gi0/1`), nell'ordine in cui le hai scritte; poi le altre, nell'ordine dell'hardware. Per questo scrivere la porta è il modo sicuro quando conta.

---

## 4. Switch e VLAN

Il problema di sempre: configurare una VLAN in IOS richiede di dichiararla, poi entrare in ogni porta, impostare la modalità, poi il numero di VLAN, poi il trunk con la lista delle VLAN consentite. In `pktmd` la VLAN si scrive **dove si collega il cavo**.

### 4.1 Dichiarare le VLAN

```pktmd-code
vlan 10 rosso
vlan 20 blu
```

Il nome è facoltativo. Le VLAN usate da una porta si creano comunque da sole (con il nome standard `VLAN0010`): dichiarale solo se vuoi il nome.

### 4.2 Porte access

`vlan N` in fondo a un collegamento mette la porta **dello switch** in modalità access in quella VLAN.

```pktmd h=330 ios=sw1
sw1:
  vlan 10 rosso
  vlan 20 blu

pc1:
  ip 192.168.10.1/24
pc2:
  ip 192.168.20.1/24

links:
  pc1 sw1 vlan 10
  pc2 sw1 vlan 20
```

Confronta con l'IOS generato: due righe di collegamento al posto di due blocchi `interface` con `switchport mode access` e `switchport access vlan`.

### 4.3 Porte non usate

Una riga di porta con un intervallo mette in VLAN e spegne tutte le porte inutilizzate, come si fa per sicurezza.

```pktmd h=260 ios=sw1
sw1:
  vlan 99 buco_nero
  fa0/10-24 access 99 down
```

### 4.4 Trunk

`trunk` in fondo a un collegamento fa un trunk. Con una lista, solo quelle VLAN sono consentite; `native N` imposta la VLAN nativa.

```pktmd h=420 ios=sw1
sw1:
sw2:

pc1:
  ip 192.168.10.1/24
pc2:
  ip 192.168.10.2/24
pc3:
  ip 192.168.20.1/24

links:
  pc1 sw1 vlan 10
  pc3 sw1 vlan 20
  pc2 sw2 vlan 10
  sw1 sw2 trunk 10,20
```

Un `trunk` fra due switch configura **entrambe** le estremità. Il badge sullo schema mostra le VLAN consentite.

### 4.5 Router-on-a-stick

Per far parlare due VLAN serve un router. Ogni VLAN è una **sottointerfaccia** della porta collegata allo switch: si scrive come una riga di porta con `vlan N`.

```pktmd h=430 ios=r1
sw1:
  vlan 10 rosso
  vlan 20 blu

pc1:
  ip 192.168.10.1/24
  gw 192.168.10.254
pc2:
  ip 192.168.20.1/24
  gw 192.168.20.254

r1:
  gi0/0 vlan 10 192.168.10.254/24
  gi0/0 vlan 20 192.168.20.254/24

links:
  pc1 sw1 vlan 10
  pc2 sw1 vlan 20
  sw1 r1 trunk 10,20
```

`gi0/0 vlan 10 192.168.10.254/24` crea `gi0/0.10`, imposta `encapsulation dot1Q 10`, assegna l'indirizzo e accende la porta fisica. (Si può anche scrivere `gi0/0.10 192.168.10.254/24`.) Il primo collegamento del router va sulla porta prenotata `gi0/0`.

### 4.6 Gestire lo switch

Su uno switch `ip` è l'indirizzo di gestione sulla VLAN 1; con `vlan N` è su un'altra VLAN. `gw` imposta il default gateway.

```pktmd h=300 ios=sw1
sw1:
  vlan 99 gestione
  ip 10.0.99.2/24 vlan 99
  gw 10.0.99.1
```

---

## 5. Routing

### 5.1 Rotte statiche

```pktmd-code
route 192.168.2.0/24 via 10.0.0.2
route default via 8.8.9.254
route 10.0.0.0/8 via gi0/1 ad 5
```

`default` è la rotta `0.0.0.0/0`; `via` accetta un indirizzo o una porta; `ad` è la distanza amministrativa.

```pktmd h=360 ios=r1
r1:
  gi0/0 192.168.1.254/24
  gi0/1 10.0.0.1/30
  route 192.168.2.0/24 via 10.0.0.2

r2:
  gi0/0 10.0.0.2/30
  gi0/1 192.168.2.254/24
  route 192.168.1.0/24 via 10.0.0.1

links:
  r1.gi0/1 r2.gi0/0
```

### 5.2 RIP

Un `rip` da solo attiva **RIPv2** annunciando le reti di tutte le interfacce con indirizzo, con `no auto-summary`: sono quattro-cinque righe IOS.

```pktmd h=380 ios=r1
r1:
  gi0/0 192.168.1.254/24
  gi0/1 10.0.0.1/30
  rip passive gi0/0

r2:
  gi0/0 10.0.0.2/30
  gi0/1 192.168.2.254/24
  rip passive gi0/1

links:
  r1.gi0/1 r2.gi0/0
```

| Riga | Significato |
|---|---|
| `rip` | RIPv2, reti automatiche |
| `rip passive gi0/0 gi0/1` | non annunciare da queste porte |
| `rip 10.0.0.0 192.168.1.0` | elenco preciso di reti, al posto di quelle automatiche |
| `rip none` | attivo ma senza reti |
| `rip default` | `default-information originate` |
| `rip static` | `redistribute static` |
| `rip v1`, `rip autosum` | RIPv1, oppure v2 con auto-summary |

### 5.3 OSPF

```pktmd h=360 ios=r1
r1:
  gi0/0 192.168.1.254/24
  gi0/1 10.0.0.1/30
  ospf 192.168.1.0/24 area 0
  ospf 10.0.0.0/30 area 0
  ospf passive gi0/0

r2:
  gi0/0 10.0.0.2/30
  gi0/1 192.168.2.254/24
  ospf 10.0.0.0/30 area 0
  ospf 192.168.2.0/24 area 0
  ospf passive gi0/1

links:
  r1.gi0/1 r2.gi0/0
```

Una riga per rete, con la maschera normale (la *wildcard* la calcola lui). `ospf id 5` cambia il numero di processo, `ospf default` annuncia la rotta di default.

---

## 6. NAT

In IOS il NAT richiede una ACL, la regola, e poi `ip nat inside` / `ip nat outside` su ogni interfaccia. Qui basta dire **quale rete traduci**: i lati e l'ACL si **deducono**.

### 6.1 PAT (tutta la LAN con un solo indirizzo)

```pktmd h=420 ios=r1
r1:
  gi0/0 192.168.1.254/24
  gi0/1 8.8.9.1/24
  route default via 8.8.9.254
  nat overload 192.168.1.0/24

pc1:
  ip 192.168.1.1/24
  gw 192.168.1.254

sw1:

isp: router
  gi0/0 8.8.9.254/24

links:
  pc1 sw1
  sw1 r1
  r1.gi0/1 isp
```

`nat overload <reti>` traduce quelle reti con l'indirizzo dell'interfaccia di uscita. Sono "inside" le interfacce la cui rete è tra quelle indicate, "outside" quella di uscita. Se le uscite possibili sono più d'una, indica la porta: `nat overload 192.168.1.0/24 via gi0/1`.

### 6.2 NAT statico e port forwarding

```pktmd-code
nat static 192.168.1.10 8.8.9.102
nat static tcp 192.168.1.10:80 8.8.9.1:80
nat static udp 192.168.1.11:53 8.8.9.1:53
```

La prima riga è il NAT 1:1; le altre pubblicano una singola porta (`tcp` o `udp`).

### 6.3 Pool (NAT dinamico)

```pktmd-code
nat pool 8.8.9.10-8.8.9.20 /24 for 192.168.1.0/24
nat pool 8.8.9.10-8.8.9.20 /24 for 192.168.1.0/24 overload name pubblico
```

### 6.4 Quando serve scrivere i lati

Di solito mai. Se un'interfaccia deve essere inside/outside contro la deduzione, scrivilo sulla riga di porta: `inside`, `outside`; per togliere il NAT da una porta, `nat off`.

Se hai già una ACL tua, usa `nat overload acl NOME` (vedi [capitolo 9](#9-acl-e-sicurezza)).

---

## 7. DHCP

### 7.1 Su un server

Il server accende il DHCP da solo se c'è un pool.

```pktmd h=330
dhcp: server
  ip 192.168.1.250/24
  gw 192.168.1.254
  dhcp 192.168.1.0/24 gw 192.168.1.254 dns 192.168.1.250 from 192.168.1.100 max 50

pc1:
  ip dhcp
pc2:
  ip dhcp

sw1:

links:
  dhcp sw1
  pc1 sw1
  pc2 sw1
```

`from` è il primo indirizzo assegnato e `max` quanti ne può dare. Senza `from`/`max`: dal primo utilizzabile della rete, 50 indirizzi.

### 7.2 Su un router

```pktmd h=300 ios=r1
r1:
  gi0/0 10.0.0.1/24
  dhcp 10.0.0.0/24 gw 10.0.0.1 dns 8.8.8.8 name uffici
  dhcp exclude 10.0.0.1-10.0.0.20
```

### 7.3 Relay (`helper`)

Se il server DHCP sta su un'altra rete, la porta che serve i client inoltra le richieste con `helper`.

```pktmd h=360 ios=r1
r1:
  gi0/0 192.168.1.254/24 helper 192.168.5.100
  gi0/1 192.168.5.254/24

pc1:
  ip dhcp

dhcp: server
  ip 192.168.5.100/24
  gw 192.168.5.254
  dhcp 192.168.1.0/24 gw 192.168.1.254

links:
  pc1 r1.gi0/0
  dhcp r1.gi0/1
```

---

## 8. Server: web, DNS e posta

### 8.1 Pagine web

Le pagine sono **blocchi** con il nome del file. Puoi scriverne quanti vuoi e incollare HTML complesso: dentro il blocco non viene interpretato niente.

````pktmd-code
web: server
  ip 192.168.1.10/24

  ```html index.html
  <html>
  <h1>Ciao</h1>
  <a href="altra.html">un'altra pagina</a>
  </html>
  ```

  ```html altra.html
  <html><p>Seconda pagina</p></html>
  ```
````

Senza `index.html` resta la pagina di fabbrica di Packet Tracer.

### 8.2 DNS

Ogni riga è un record. Il servizio si accende da solo.

```pktmd h=330
dns: server
  ip 192.168.1.250/24
  a www.yellow.it 192.168.1.251
  a dns.yellow.it 192.168.1.250
  cname web.yellow.it www.yellow.it
  ns . dns.yellow.it

www: server
  ip 192.168.1.251/24

pc1:
  ip 192.168.1.1/24
  dns 192.168.1.250

sw1:

links:
  dns sw1
  www sw1
  pc1 sw1
```

| Riga | Record |
|---|---|
| `a nome indirizzo` | A |
| `cname alias nome` | CNAME |
| `ns zona server` | NS (la radice si scrive `.`) |

### 8.3 Posta

Sul server il dominio e gli utenti; sul PC la casella.

```pktmd h=330
mail: server
  ip 192.168.1.252/24
  mail pippo.it
  user alessandro 123
  user marco 123

pc1:
  ip 192.168.1.1/24
  mail alessandro@pippo.it 123

pc2:
  ip 192.168.1.2/24
  mail marco@pippo.it 123

sw1:

links:
  mail sw1
  pc1 sw1
  pc2 sw1
```

Sul PC i server di posta sono `pop3.pippo.it` e `smtp.pippo.it`, a meno che tu non scriva `pop3 nome` / `smtp nome`.

### 8.4 Accendere e spegnere i servizi

Tutti i servizi del server sono accesi di default; per spegnerli:

```pktmd-code
srv1:
  http off
  https off
  ntp off
  ftp off
  tftp off
  syslog off
  dns off      // oppure "dns on" per accenderlo vuoto
  dhcp off
  mail off
```

---

## 9. ACL e sicurezza

### 9.1 ACL

Una regola per riga: `acl NOME permit|deny ...`. Il nome può essere un numero. Una regola **senza protocollo** (solo sorgente) è *standard*; con il protocollo (`ip`, `tcp`, `udp`, `icmp`) è *estesa*. Non si possono mescolare nella stessa ACL.

```pktmd h=340 ios=r1
r1:
  gi0/0 10.0.0.1/24 acl BLOCCA in
  gi0/1 192.168.5.1/24

  acl BLOCCA deny tcp 10.0.0.0/24 any eq 23
  acl BLOCCA permit ip any any
  acl 10 permit 192.168.5.0/24

sw1:

links:
  r1.gi0/0 sw1
```

- Indirizzi: `any`, `host 1.2.3.4`, oppure `rete/prefisso` (la wildcard la calcola lui).
- Porte: `eq 80`, `gt 1023`, `lt 100`, `neq 25`, `range 20 21`; poi `established`, `log`.
- Si applicano con `acl NOME in|out` sulla riga della porta.

### 9.2 Accesso al dispositivo

```pktmd h=260 ios=r1
r1:
  name R1
  enable secret cisco
  user admin pass123
  vty ssh
  console password cisco
  domain lab.local
  ssh 2
```

| Riga | Effetto |
|---|---|
| `name R1` | hostname |
| `enable secret x` / `enable password x` | password di enable |
| `user nome password [priv 15]` | utente locale |
| `vty password x` | password sulle linee vty (con la password, `login` è implicito) |
| `vty ssh` | login locale e solo SSH |
| `vty login local transport telnet` | forma estesa |
| `console password x` | password di console |
| `ssh 2` | versione di SSH |
| `domain x.it` | `ip domain-name` |
| `dns 8.8.8.8` | `ip name-server` |

---

## 10. Hardware

### 10.1 Modelli

Dopo il tipo si scrive il modello.

| | |
|---|---|
| `router` | `2901` (predefinito), `2911`, `1841`, `pt` (Router-PT), `empty` (Router-PT-Empty) |
| `switch` | `2960` (predefinito, 2960-24TT), `2950`, `pt` (Switch-PT), `empty` (Switch-PT-Empty) |
| `pc` | scheda `gig` |
| `server` | scheda `gig` o `fiber` (`fiber1` = nello slot 1) |

```pktmd h=250
r1: router 2911
sw1: switch 2950
web: server fiber
```

### 10.2 Moduli

I router ISR hanno slot per schede aggiuntive. `module serial` mette una HWIC-2T (due porte seriali) nel primo slot libero; `module sfp` una HWIC-1GE-SFP in fibra.

```pktmd-code
r1: router 2911
  module serial          // porte se0/0/0 e se0/0/1
  module serial          // porte se0/1/0 e se0/1/1
  module sfp
  module serial slot 3   // in uno slot preciso
  module slot 3 none     // toglie un modulo
```

Per i Router-PT e Switch-PT i moduli hanno nomi come `r-fe`, `r-ge`, `r-fiber`, `r-fiber-sm`, `r-serial`, `s-fe`, `s-ge`, `s-fiber`; in alternativa puoi scrivere il nome vero (`PT-ROUTER-NM-1FGE`).

### 10.3 Collegamenti seriali

Servono una scheda seriale per parte. **Il primo nome del collegamento è il lato DCE**, quello che dà il clock; con `clock N` scegli la velocità.

```pktmd h=330 ios=r1
r1: router 2911
  module serial
  se0/0/0 10.0.0.1/30

r2: router 2911
  module serial
  se0/0/0 10.0.0.2/30

links:
  r1.se0/0/0 r2.se0/0/0 clock 64000
```

### 10.4 Fibra

Un collegamento fra porte in fibra usa il cavo in fibra (monomodale per i moduli `-SM` e per l'SFP).

```pktmd h=300
a: router empty
  module r-fiber
  gi0/0 10.0.0.1/30

b: router empty
  module r-fiber
  gi0/0 10.0.0.2/30

links:
  a b
```

Il tipo di cavo si sceglie da solo: **rame dritto** (host–switch, switch–router), **incrociato** (switch–switch, router–router, host–router, host–host), **fibra** (porte in fibra), **seriale** (porte seriali). Se i due capi non sono compatibili (per esempio fibra con rame) ricevi un errore.

---

## 11. Posizioni e disegno

Senza istruzioni, i dispositivi si dispongono **ad albero**: il router (o il dispositivo più collegato) in alto, poi gli switch di core, distribuzione e piano, e infine i PC e i server in fila sotto il loro switch. Lo stesso ordine finisce nel file di Packet Tracer.

Per fissare un dispositivo scrivi `pos x y` (coordinate del workspace):

```pktmd-code
r1:
  pos 400 100
```

Nella pagina del convertitore il pulsante **Fissa posizioni** scrive le `pos` di tutti i dispositivi, dopo che li hai spostati a mano.

I **cavi** si vedono così: <span class="cab straight"></span> rame dritto, <span class="cab cross"></span> rame incrociato, <span class="cab fiber"></span> fibra, <span class="cab serial"></span> seriale; un collegamento `trunk` è più spesso e porta il badge delle VLAN.

Un esempio completo: un edificio a sei piani.

```pktmd h=520
router: router 2911
  gi0/0 vlan 10 172.16.10.254/24
  gi0/0 vlan 20 172.16.20.254/24
  gi0/0 vlan 30 172.16.30.254/24

SW_core: switch
distribution1: switch
distribution2: switch
piano_terra: switch
primo_piano: switch
secondo_piano: switch
terzo_piano: switch

PC0:
  ip 172.16.10.1/24
  gw 172.16.10.254
PC1:
  ip 172.16.10.2/24
  gw 172.16.10.254
PC2:
  ip 172.16.20.1/24
  gw 172.16.20.254
PC3:
  ip 172.16.20.2/24
  gw 172.16.20.254
PC4:
  ip 172.16.30.1/24
  gw 172.16.30.254
PC5:
  ip 172.16.30.2/24
  gw 172.16.30.254

links:
  router SW_core trunk
  SW_core distribution1 trunk
  SW_core distribution2 trunk
  distribution1 piano_terra trunk 10,20
  distribution1 primo_piano trunk 20,30
  distribution2 secondo_piano trunk 30
  distribution2 terzo_piano trunk 10
  PC0 piano_terra vlan 10
  PC1 piano_terra vlan 10
  PC2 primo_piano vlan 20
  PC3 primo_piano vlan 20
  PC4 secondo_piano vlan 30
  PC5 secondo_piano vlan 30
```

---

## 12. Il blocco `cli`

Per tutto ciò che la sintassi non copre (EtherChannel, QoS, STP, banner...). **È l'ultima risorsa**: prima controlla se esiste una riga più semplice.

Si scrive **come al terminale**, già in modalità di configurazione globale: niente `enable`, `configure terminal`, `end`. I comandi vanno per intero (si possono abbreviare solo i nomi delle porte). Non serve indentare: `interface`, `vlan N`, `router ...`, `line ...`, `ip dhcp pool ...` e `ip access-list ...` aprono una sotto-modalità e i comandi che le appartengono finiscono lì; qualsiasi altro comando è globale (oppure scrivi `exit`).

````pktmd h=290 ios=r1
r1:
  gi0/0 10.0.0.1/24

  ```cli
  interface gi0/0
  description verso la LAN
  ip ospf cost 5
  ip route 0.0.0.0 0.0.0.0 10.0.0.2
  banner motd #Solo personale autorizzato#
  ```
````

Quando **leggi un `.pkt`**, i comandi che il modello non sa esprimere (password cifrate, ACL particolari, comandi sconosciuti) finiscono da soli in un blocco `cli`: la configurazione IOS non si perde mai.

---

## 13. Da e verso Packet Tracer

```bash
node bin/pktmd.js rete.pkt        # -> rete.pktmd
node bin/pktmd.js rete.pktmd      # -> rete.pkt   (Packet Tracer 9.0)
node web/serve.mjs                # pagina web: incolla, trascina file, scarica
```

Il file `.pkt` si apre con Packet Tracer 9.0. Quando leggi un `.pkt` si ricostruisce solo quello che la sintassi sa dire: restano fuori le caselle di posta già scritte, la cronologia dei comandi, le impostazioni di simulazione e i dispositivi che non sono ancora supportati (laptop, access point, tablet e smartphone, telefoni, IoT, celle); questi ultimi vengono segnalati e saltati.

### Errori comuni

Ogni errore indica la riga del problema.

| Messaggio | Causa | Rimedio |
|---|---|---|
| `non riconosco il tipo di "paolo"` | il nome non è `pc1`/`sw1`/`r1`/`srv1` | scrivi `paolo: router` |
| `la porta fa0/9 non esiste (porte: ...)` | quel modello non ha quella porta | usa una delle porte elencate |
| `dispositivo "sw9" inesistente` | un collegamento cita un nome non dichiarato | dichiaralo sopra |
| `nessuna porta libera` | hai più collegamenti che porte | aggiungi un modulo o un altro switch |
| `non si puo' collegare una porta in fibra con una in rame` | cavo incompatibile | cambia porta o modulo |
| `il blocco aperto qui non e' chiuso` | manca la riga ```` ``` ```` finale | chiudi il blocco |
| `nat overload: non capisco su quale interfaccia uscire` | le uscite possibili sono più d'una | aggiungi `via gi0/1` |
| `un router non ha "gw"` | il default gateway dei router è una rotta | `route default via ...` |

---

## 14. Riferimento rapido

| Cosa | Scrivi |
|---|---|
| Indirizzo | `ip 10.0.0.1/24` · `ip dhcp` · `gw ...` · `dns ...` |
| Porta | `gi0/0 10.0.0.1/24` · `fa0/5-24 access 99 down` · `gi0/0 vlan 10 192.168.10.254/24` |
| VLAN | `vlan 10 nome` · `pc1 sw1 vlan 10` · `sw1 r1 trunk 10,20` |
| Gestione switch | `ip 10.0.99.2/24 vlan 99` · `gw 10.0.99.1` |
| Rotte | `route 10.0.0.0/8 via 1.1.1.1` · `route default via 1.1.1.1` |
| RIP | `rip` · `rip passive gi0/0` · `rip default` |
| OSPF | `ospf 10.0.0.0/24 area 0` · `ospf passive gi0/0` |
| NAT | `nat overload 192.168.1.0/24` · `nat static 1.1.1.1 2.2.2.2` · `nat static tcp 1.1.1.1:80 2.2.2.2:80` · `nat pool A-B /24 for rete` |
| DHCP | `dhcp 10.0.0.0/24 gw ... dns ...` · `dhcp exclude A-B` · `helper A` |
| ACL | `acl NOME permit\|deny [proto] sorgente [destinazione] [eq porta]` · `acl NOME in` |
| Sicurezza | `enable secret x` · `user n p` · `vty ssh` · `console password x` · `ssh 2` · `domain x` |
| Web | blocco `` ```html index.html `` |
| DNS | `a nome ip` · `cname alias nome` · `ns zona server` |
| Posta | server: `mail dominio` + `user n p` — PC: `mail utente@dominio pass` |
| Servizi | `http off` · `https off` · `ntp off` · `ftp off` · `dns on\|off` · `dhcp on\|off` · `mail off` |
| Modelli | `router 2911` · `switch 2950` · `pc gig` · `server fiber` |
| Moduli | `module serial` · `module sfp` · `module slot 2 none` |
| Collegamenti | `a b` · `a.gi0/1 b.fa0/2` · `a b vlan 10` · `a b trunk 10,20 native 99` · `a.se0/0/0 b.se0/0/0 clock 64000` |
| Posizione | `pos 120 80` |
| Altro | `name R1` · blocco `` ```cli `` |

---

## 15. Usare pktmd come libreria

Questa stessa pagina usa la libreria: tutto il codice che legge il testo, genera il file e disegna lo schema è in `dist/`, senza dipendenze.

### In una pagina web

```html
<script src="dist/pktmd.min.js"></script>   <!-- funziona anche aprendo il file con doppio clic -->
<div id="rete" style="height: 320px"></div>
<script>
  const testo = `
r1:
  gi0/0 192.168.1.254/24
pc1:
  ip 192.168.1.10/24
  gw 192.168.1.254
sw1:
links:
  pc1 sw1
  sw1 r1
`;
  const m = pktmd.mountNetwork(document.getElementById("rete"), testo);   // disegna
  m.ready.then(() => console.log("pronto"));
  // più tardi:  await m.setText(altroTesto);
</script>
```

Con i moduli ES: `import { mountNetwork } from "./dist/pktmd.esm.js"`.

### Le funzioni principali

| Funzione | Cosa fa |
|---|---|
| `mountNetwork(elemento, testo, opzioni?)` | disegna la rete; ritorna `{ view, setText, ready, destroy }` |
| `checkPktmd(testo)` | controlla tutto senza produrre file: `{ ok, error, line, warnings }` |
| `previewConfig(testo)` | la configurazione IOS generata: `Map` nome → righe |
| `pktmdToPkt(testo)` | `{ bytes, xml, network, warnings }`: il file `.pkt` |
| `pktToPktmd(bytes)` | `{ text, network, warnings }`: da `.pkt` a testo |
| `parsePktmd(testo)` | il modello, senza generare niente |
| `describeNetwork(modello)` | collegamenti risolti con il tipo di cavo (per disegnare) |

Opzioni di `mountNetwork`: `theme` (`"light"` predefinito, `"dark"`, `"auto"` segue il sistema), `wheel` (`"ctrl"` per zoomare solo con Ctrl, `"always"`), `autoFit`, `compact` (disposizione più stretta, predefinita).

### In Node

```js
import { pktmdToPkt, pktToPktmd, checkPktmd } from "pktmd";
import { readFileSync, writeFileSync } from "node:fs";

const { bytes } = await pktmdToPkt(readFileSync("rete.pktmd", "utf8"));
writeFileSync("rete.pkt", bytes);
```

La libreria si ricostruisce con `npm run build:lib`; questa guida con `npm run build:guide`.
