// Il blocco ```cli: comandi IOS scritti "come al terminale" (senza indentazione obbligatoria),
// uniti alla configurazione generata.
import { normalizePort, shortPort, PktmdError } from "./model.js";

/** comandi che aprono una sotto-modalita' */
const MODE_OPEN = [
  [/^interface\s+/i, "if"],
  [/^vlan\s+\d/i, "vlan"],
  [/^router\s+\S+/i, "router"],
  [/^line\s+/i, "line"],
  [/^ip\s+dhcp\s+pool\s+/i, "dhcp"],
  [/^ip\s+access-list\s+/i, "acl"],
];

/** comandi che, scritti sotto un comando di apertura, appartengono alla sua sotto-modalita' */
const MODE_CMDS = {
  if: /^(no\s+)?((ip|ipv6)\s+(address|nat|access-group|helper-address|ospf|rip|proxy-arp|summary-address|verify|flow|pim|igmp|unnumbered|mtu|redirects|unreachables|directed-broadcast|route-cache|authentication|dhcp\s+(snooping|relay))|(shutdown|description|duplex|speed|switchport|encapsulation|clock|bandwidth|mtu|spanning-tree|channel-group|standby|vrrp|cdp|lldp|power|mls|storm-control|load-interval|keepalive|ppp|frame-relay|mac|media-type|negotiation|delay|fair-queue|service-policy|snmp|autostate|trunk))(?![\w-])/i,
  vlan: /^(no\s+)?(name|state|shutdown|mtu|remote-span|private-vlan)(?![\w-])/i,
  router: /^(no\s+)?(network|version|auto-summary|passive-interface|default-information|redistribute|neighbor|router-id|distance|maximum-paths|summary-address|timers|metric|offset-list|default-metric|area|log-adjacency-changes|bgp|address-family|eigrp)(?![\w-])/i,
  line: /^(no\s+)?(password|login|transport|exec-timeout|logging|access-class|privilege|exec|history|escape-character|length|width|stopbits|speed|flowcontrol|modem|session-timeout|authorization|accounting)(?![\w-])/i,
  dhcp: /^(no\s+)?(network|default-router|dns-server|domain-name|lease|option|netbios-name-server|next-server|client-identifier|host|import|bootfile)(?![\w-])/i,
  acl: /^(permit|deny|remark|\d+\s+(permit|deny))(?![\w-])/i,
};

function normalizeHead(l) {
  const m = /^interface\s+(\S+?)\s*$/i.exec(l);
  if (m) { const p = normalizePort(m[1]); if (p) return `interface ${p}`; }
  return l;
}

/** testo cli -> blocchi {head, body[]} (body: una riga per comando, con 1 spazio di indentazione) */
export function parseCli(cli) {
  const blocks = [];
  let cur = null;
  for (const raw of cli.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    const t = line.trim();
    if (!t || t === "!") continue;
    if (t === "end") { cur = null; continue; }
    if (t === "exit") { cur = null; continue; }
    if (/^\s/.test(line) && cur) { cur.body.push(" " + t); continue; }
    const open = MODE_OPEN.find(([re]) => re.test(t));
    if (open) { cur = { head: normalizeHead(t), body: [], mode: open[1] }; blocks.push(cur); continue; }
    if (cur && MODE_CMDS[cur.mode].test(t)) { cur.body.push(" " + t); continue; }
    cur = null;
    blocks.push({ head: normalizeHead(t), body: [] });
  }
  return blocks;
}

// ---------------------------------------------------------------------------------------------------------------

const SINGLETON = ["duplex", "speed", "description", "ip address", "clock rate", "switchport mode", "switchport access vlan", "encapsulation", "ip default-gateway", "switchport trunk native vlan", "switchport trunk allowed vlan", "password", "transport input"];
const childKey = (l) => SINGLETON.find((k) => l.trim().startsWith(k + " ") || l.trim() === k);

function blockRange(lines, head) {
  const i = lines.indexOf(head);
  if (i < 0) return undefined;
  let j = i + 1;
  while (j < lines.length && /^\s/.test(lines[j])) j++;
  return [i, j];
}

function insertBlock(lines, block) {
  let at = lines.findIndex((l) => /^(ip classless|ip flow-export|line con|line aux|line vty|end)/.test(l));
  if (at < 0) at = lines.length;
  lines.splice(at, 0, ...block, "!");
}

/**
 * Applica il blocco cli alle righe di config generate.
 * @param ctx { dev, known:Set<string> }  `known`: porte fisiche del dispositivo (per segnalare porte inesistenti)
 */
export function applyCli(lines, cli, ctx) {
  const out = [...lines];
  for (const b of parseCli(cli)) {
    const head = b.head;
    const im = /^interface\s+(\S+?)(?:\.\d+)?$/i.exec(head);
    if (im && normalizePort(im[1]) && !/^Vlan/i.test(im[1]) && !ctx.known.has(normalizePort(im[1]))) {
      throw new PktmdError(`${ctx.dev.id}: nel blocco cli, "${head}" usa la porta ${shortPort(normalizePort(im[1]))} che non esiste (porte: ${[...ctx.known].map(shortPort).join(", ")})`, ctx.dev.line);
    }
    // comandi a riga singola
    if (!b.body.length) {
      if (/^hostname /.test(head)) {
        const i = out.findIndex((l) => l.startsWith("hostname "));
        if (i >= 0) { out[i] = head; continue; }
      }
      // `service x` annulla il `no service x` di base
      if (!head.startsWith("no ")) {
        const i = out.indexOf("no " + head);
        if (i >= 0) { out.splice(i, 1); out.splice(i, 0, head); continue; }
      } else {
        const i = out.indexOf(head.slice(3));
        if (i >= 0) { out.splice(i, 1, head); continue; }
      }
    }
    const r = blockRange(out, head);
    if (!r) {
      insertBlock(out, [head, ...b.body]);
      continue;
    }
    let [start, end] = r;
    for (const line of b.body) {
      if (line.trim().startsWith("no ")) {
        const target = " " + line.trim().slice(3);
        const k = out.slice(start + 1, end).findIndex((l) => l === target || (childKey(target) && childKey(l) === childKey(target)));
        if (k >= 0) { out.splice(start + 1 + k, 1); end--; }
        continue;
      }
      const key = childKey(line);
      const existing = out.slice(start + 1, end).findIndex((l) => l === line || (key && childKey(l) === key));
      if (existing >= 0) out[start + 1 + existing] = line;
      else { out.splice(end, 0, line); end++; }
    }
  }
  return out;
}
