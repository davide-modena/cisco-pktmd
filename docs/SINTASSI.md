# Sintassi `.pktmd`

Un `.pktmd` descrive una rete di Packet Tracer in poche righe di testo: dispositivi, indirizzi, VLAN, NAT, routing, servizi e collegamenti.
Il convertitore ne ricava il `.pkt` (e viceversa). Il blocco `cli` per i comandi IOS grezzi resta come ultima risorsa.

```
nome:            <- un dispositivo (il tipo si capisce dal nome: pc1, sw2, r1, srv1)
  proprieta'     <- una per riga; l'indentazione e' solo estetica
links:           <- da qui in poi, i collegamenti
  a b
```

- `// commento` vale anche a fine riga.
- Una riga che finisce con `:` (o `nome: tipo`) apre un dispositivo: il suo corpo arriva fino al prossimo.
- Dentro i blocchi ```` ``` ```` il parser non guarda niente.
- Tutto quello che non scrivi resta ai **default di Packet Tracer**.

## Prima e dopo

| Compito | In IOS | In pktmd |
|---|---|---|
| VLAN con porta access | `vlan 10` / ` name rosso` / `interface fa0/1` / ` switchport mode access` / ` switchport access vlan 10` | `vlan 10 rosso` + `pc1 sw1 vlan 10` |
| Trunk | `interface gi0/1` / ` switchport mode trunk` / ` switchport trunk allowed vlan 10,20` | `sw1 r1 trunk 10,20` |
| Router-on-a-stick | `interface gi0/0.10` / ` encapsulation dot1Q 10` / ` ip address 192.168.10.254 255.255.255.0` / `interface gi0/0` / ` no shutdown` | `gi0/0 vlan 10 192.168.10.254/24` |
| Porte spente | 20 righe `interface ...` / ` shutdown` | `fa0/5-24 access 99 down` |
| PAT | `access-list 1 permit 192.168.1.0 0.0.0.255` / `ip nat inside source list 1 interface gi0/1 overload` / `ip nat inside` e `ip nat outside` su ogni interfaccia | `nat overload 192.168.1.0/24` |
| NAT statico con porta | `ip nat inside source static tcp 192.168.1.10 80 8.8.9.1 80` (+ inside/outside) | `nat static tcp 192.168.1.10:80 8.8.9.1:80` |
| RIP v2 | `router rip` / ` version 2` / ` network ...` per ogni rete / ` no auto-summary` / ` passive-interface ...` | `rip passive gi0/0` |
| DHCP su router | `ip dhcp excluded-address ...` / `ip dhcp pool x` / ` network ...` / ` default-router ...` / ` dns-server ...` | `dhcp 10.0.0.0/24 gw 10.0.0.1 dns 8.8.8.8` + `dhcp exclude 10.0.0.1-10.0.0.20` |
| SSH sui vty | `ip domain-name` / `username` / `line vty 0 4` / ` login local` / ` transport input ssh` / `ip ssh version 2` | `user admin pass` + `vty ssh` + `ssh 2` |
| Server DNS | GUI, record uno per uno | `a www.x.it 1.2.3.4` / `cname web.x.it www.x.it` |
| Posta | GUI su server e su ogni PC | `mail x.it` + `user ale 123` / `mail ale@x.it 123` |

## Dispositivi

```
nome:                      tipo dedotto dal nome
nome: tipo [modello]       tipo esplicito
```

Il tipo si deduce se il nome e' una di queste parole seguita da cifre (maiuscole indifferenti):
`pc`, `server`/`srv`, `switch`/`sw`, `router`/`r`. Un nome come `paolo` richiede `paolo: router`.

| Tipo | Modelli (dopo il tipo) | Predefinito |
|---|---|---|
| `router` | `2901`, `2911`, `1841`, `pt` (Router-PT), `empty` (Router-PT-Empty) | 2901 |
| `switch` | `2960` (2960-24TT), `2950`, `pt` (Switch-PT), `empty` (Switch-PT-Empty) | 2960 |
| `pc` | scheda `gig` | PC-PT, Fast Ethernet |
| `server` | scheda `gig`, `fiber` (`fiber1` = nello slot 1) | Server-PT, Fast Ethernet |

Esempi: `r1: router 2911`, `sw1: switch 2950`, `web: server fiber`, `isp: router pt`.

### Moduli (router e switch)

```
module serial              prima porta libera: HWIC-2T (2 porte seriali)
module sfp                 HWIC-1GE-SFP (fibra)
module HWIC-2T slot 2      in uno slot preciso
module slot 3 none         toglie un modulo
```
Nomi brevi: `serial`, `sfp`; per Router-PT/Switch-PT: `r-fe r-ge r-fiber r-fiber-sm r-fiber-fe r-serial s-fe s-ge s-fiber s-fiber-fe`. Si puo' scrivere anche il nome vero del modulo.

## Porte (router e switch)

Una riga che comincia con il nome di una porta (`fa0/1`, `gi0/0`, `se0/0/0`, `vlan10`) la configura.
Si scrive `fa`, `gi`, `se`; si possono usare **intervalli** (`fa0/5-24`) e **liste** (`fa0/1,gi0/1-2`).

```
gi0/0 192.168.1.254/24                 indirizzo (anche  192.168.1.254 255.255.255.0)
gi0/1 dhcp                             indirizzo da DHCP
gi0/0 vlan 10 192.168.10.254/24        sottointerfaccia gi0/0.10 con dot1Q 10
gi0/0.10 192.168.10.254/24             stessa cosa (il numero dopo il punto e' la VLAN)
fa0/1-12 access 10                     porte access in VLAN 10
fa0/24 trunk 10,20 native 99           trunk: lista di VLAN consentite e VLAN nativa
fa0/13-24 access 99 down               spente
gi0/1 inside / outside / nat off       lato NAT (di solito si deduce)
gi0/0 helper 10.0.0.250                ip helper-address (DHCP relay)
gi0/0 acl FILTRO in                    applica un'ACL (in|out)
se0/0/0 10.0.0.1/30 clock 64000        velocita' del clock (lato DCE)
gi0/0 192.168.1.1/24 desc LAN uffici   descrizione (sempre ultima: prende il resto della riga)
```

Altre opzioni: `up` (porta accesa anche senza IP), `unnumbered <porta>`.

**Stato delle porte.** Un router accende da solo le porte che hanno un IP e quelle che ospitano sottointerfacce; le altre restano spente (come in Packet Tracer). `up` e `down` forzano.

**Porta principale.** `ip 10.0.0.1/24` da solo (su un router) vale per la prima porta; su uno switch e' l'indirizzo di gestione (`Vlan1`), oppure `ip 10.0.99.2/24 vlan 99`.

## Host: PC e server

```
ip 192.168.1.1/24          (o  ip dhcp )
gw 192.168.1.254
dns 192.168.1.250
```

### PC
```
mail alessandro@pippo.it 123              casella di posta
mail alessandro@pippo.it 123 pop3 mx.pippo.it smtp mx.pippo.it name Alessandro
```
`pop3`/`smtp` valgono `pop3.<dominio>` e `smtp.<dominio>` se omessi.

### Server
```
http off | https off | ntp off | ftp off | tftp off | syslog off      servizi (tutti accesi di default)
a www.x.it 1.2.3.4                    record DNS (il DNS si accende da solo; "dns off" per spegnerlo, "dns on" per accenderlo vuoto)
cname web.x.it www.x.it
ns . dnsroot
dhcp 192.168.1.0/24 gw 192.168.1.254 dns 192.168.1.250 from 192.168.1.100 max 50   pool (si accende da solo; "dhcp off")
mail pippo.it                          dominio di posta (accende SMTP e POP3; "mail off")
user alessandro 123                    utente di posta (uno per riga)
```
Le pagine web si scrivono come blocchi:
````
```html index.html
<html>...</html>
```
````
Ne puoi mettere quanti ne vuoi (`about.html`, ...). Senza `index.html` resta la pagina di Packet Tracer.

## Switch

```
vlan 10 rosso              dichiara una VLAN (il nome e' facoltativo)
```
Le VLAN usate da una porta si creano da sole (con il nome standard `VLAN0010`).
Le porte si configurano con le righe di porta (sopra) o direttamente sui collegamenti (sotto).

## Router: routing, NAT, DHCP, sicurezza

```
route 8.8.8.0/24 via 8.8.9.254          rotta statica
route default via 8.8.9.254             rotta di default
route 10.0.0.0/8 via gi0/1 ad 5         verso un'interfaccia, con distanza amministrativa
```

### RIP
```
rip                       RIPv2, no auto-summary, annuncia le reti (classful) di tutte le interfacce con IP
rip 10.0.0.0 192.168.1.0  oppure un elenco preciso
rip none                  attivo ma senza reti
rip v1 | rip autosum      varianti
rip passive gi0/0 gi0/1   non annunciare da queste porte
rip default | rip static  default-information originate / redistribute static
```

### OSPF
```
ospf 10.0.0.0/24 area 0       una riga per rete (la maschera si converte da sola in wildcard)
ospf id 5                     process id (default 1)
ospf passive gi0/0
ospf default
```

### NAT
Le interfacce `inside`/`outside` e le ACL si **deducono**: sono "inside" le interfacce la cui rete e' nella sorgente, "outside" quella di uscita.
```
nat overload 192.168.1.0/24 [10.0.0.0/8 ...] [via gi0/1]       PAT; senza via = l'unica interfaccia con IP non interna
nat pool 8.8.9.10-8.8.9.20 /24 for 192.168.1.0/24 [overload] [name pubblico]      NAT dinamico
nat static 192.168.1.10 8.8.9.102                              NAT statico 1:1
nat static tcp 192.168.1.10:80 8.8.9.101:80                    port forwarding (tcp|udp)
nat overload acl LISTA                                         usa una tua ACL
```

### DHCP del router
```
dhcp 10.0.0.0/24 gw 10.0.0.1 dns 8.8.8.8 [domain x.it] [name uffici]
dhcp exclude 10.0.0.1-10.0.0.20
```

### ACL
Standard (solo sorgente) o estese (con protocollo); il nome puo' essere un numero.
```
acl BLOCCA deny tcp 10.0.0.0/24 any eq 23
acl BLOCCA permit ip any any
acl 10 permit 192.168.5.0/24
```
Indirizzi: `any`, `host 1.2.3.4`, `rete/n`. Porte: `eq 80`, `gt 1023`, `range 20 21`. Poi `established`, `log`.
Si applicano con `acl NOME in|out` sulla riga della porta.

### Sicurezza
```
name R1                          hostname (il nome del dispositivo nello schema resta quello del header)
enable secret cisco              (oppure  enable password cisco)
user admin pass123 [priv 15]
vty password cisco               password sui vty (con la password, `login` e' implicito)
vty ssh                          login locale + solo SSH
vty login local transport telnet
console password cisco
ssh 2                            ip ssh version 2
domain lab.local                 ip domain-name
dns 8.8.8.8                      ip name-server
```

## Collegamenti

```
links:
  pc1 sw1                       prima porta libera di ciascuno
  pc1 sw1 vlan 10               + porta access in VLAN 10 sullo switch
  sw1 r1 trunk                  + trunk (tutte le VLAN)
  sw1 sw2 trunk 10,20 native 99
  r1.gi0/1 isp.gi0/0            porte scelte
  r1.se0/0/0 r2.se0/0/0 clock 64000    seriale: il PRIMO nome e' il lato DCE (da' il clock)
```
Il tipo di cavo si sceglie da solo: rame dritto (host-switch, switch-router), incrociato (switch-switch, router-router, host-router, host-host), fibra (porte in fibra; monomodale per i moduli `-SM` e `HWIC-1GE-SFP`), seriale (porte seriali).

**Quale porta prende un collegamento.** Si guardano per prime le porte *prenotate* del dispositivo — quelle con un IP, con una sottointerfaccia o dichiarate "nude" (`gi0/0`) — nell'ordine in cui sono scritte, poi le altre nell'ordine dell'hardware. Quindi `gi0/0 vlan 10 ...` fa si' che il primo collegamento del router vada su `gi0/0`. Per essere sicuri, si scrive la porta: `r1.gi0/1`.

## Posizioni

`pos 120 80` fissa un dispositivo; senza, i dispositivi si dispongono ad albero (router in alto, poi core, distribuzione, piani e host). Dalla pagina web il pulsante "Fissa posizioni" scrive le `pos` per te.

## Il blocco `cli`

Per tutto cio' che la sintassi non copre (EtherChannel, QoS, STP, banner, ...).
Si scrive **come al terminale**, gia' in modalita' global config: niente `enable`, `conf t`, `end`.
I comandi vanno per intero (si possono abbreviare solo i nomi delle porte). Non serve indentare:
`interface`, `vlan N`, `router ...`, `line ...`, `ip dhcp pool ...` e `ip access-list ...` aprono una sotto-modalita' e i comandi che le appartengono finiscono li'; qualsiasi altro comando e' globale (oppure `exit`).

````
r1:
  gi0/0 10.0.0.1/24
  ```cli
  interface gi0/0
  ip ospf cost 5
  ip route 0.0.0.0 0.0.0.0 10.0.0.2
  banner motd #Solo personale autorizzato#
  ```
````

Leggendo un `.pkt`, quello che il modello non sa esprimere (comandi non riconosciuti, password cifrate, ACL particolari...) finisce automaticamente in un blocco `cli`: niente va perso.

## Vista fisica di Packet Tracer

I dispositivi generati non vengono collocati nella vista fisica (città, edificio, rack): Packet Tracer li accetta come "non collocati", esattamente come quando ne crei uno e non lo sistemi. Ogni file ha identificativi casuali per quella struttura; copiare un dispositivo da un altro file senza riscrivere questi riferimenti faceva dichiarare il file corrotto.

## Cosa non viene conservato

Leggendo un `.pkt` si ricostruisce solo cio' che e' nella sintassi. Non si conservano: caselle di posta gia' scritte, file diversi dalle pagine HTTP, cronologia dei comandi, posizioni sul livello fisico, impostazioni di simulazione, dispositivi non supportati (IoT, wireless, telefoni, celle...). I dispositivi non supportati vengono segnalati e saltati.
