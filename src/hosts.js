// PC e server: campi strutturati dell'XML  <->  modello.
import {
  child, childrenOf, textOf, setChildText, setText, el, path, unescapeXml, walkNodes,
} from "./xml.js";
import {
  isIPv4, maskToPrefix, prefixToMask, classfulPrefix, networkAddress, ipToInt, intToIp, PktmdError,
} from "./model.js";

const blank = (nd, tag) => {
  const c = child(nd, tag);
  if (c) { c.children = []; c.text = null; c.selfClosing = true; }
};
const setOrBlank = (nd, tag, v) => (v ? setChildText(nd, tag, v) : blank(nd, tag));
const validIp = (s) => isIPv4(s) && s !== "0.0.0.0";

/** servizi on/off: nome -> [tag, figlio, valore predefinito] */
export const SERVICE_TOGGLES = {
  http: ["HTTP_SERVER", "ENABLED", true],
  https: ["HTTPS_SERVER", "HTTPSENABLED", true],
  ntp: ["NTP_SERVER", "ENABLED", true],
  ftp: ["FTP_SERVER", "ENABLED", true],
  tftp: ["TFTP_SERVER", "ENABLED", true],
  syslog: ["SYSLOG_SERVER", "ENABLED", true],
};
const flag = (v) => v === "1" || v === "true";

// ---- file HTTP -----------------------------------------------------------------------------------------------------
const DEFAULT_FILES = ["copyrights.html", "cscoptlogo177x111.jpg", "helloworld.html", "image.html"];

// la pagina di fabbrica di Packet Tracer (letta da 225 server su 312 nei file di esempio)
export const DEFAULT_INDEX = `<html>
<center><font size='+2' color='blue'>Cisco Packet Tracer</font></center>
<hr>Welcome to Cisco Packet Tracer. Opening doors to new opportunities. Mind Wide Open.
<p>Quick Links:
<br><a href='helloworld.html'>A small page</a>
<br><a href='copyrights.html'>Copyrights</a>
<br><a href='image.html'>Image page</a>
<br><a href='cscoptlogo177x111.jpg'>Image</a>
</html>`;

function httpDir(engine) {
  const fm = child(engine, "FILE_MANAGER");
  const root = fm && child(fm, "FILE");
  const fs = root && child(root, "FILES");
  return fs && childrenOf(fs, "FILE").find((f) => textOf(f, "NAME") === "http:");
}

export function httpFiles(engine) {
  const dir = httpDir(engine);
  const out = new Map();
  if (!dir) return out;
  for (const f of childrenOf(child(dir, "FILES"), "FILE")) {
    const t = path(f, "FILE_CONTENT/TEXT");
    if (t) out.set(textOf(f, "NAME"), unescapeXml(t.text ?? ""));
  }
  return out;
}

export function setHttpFile(engine, name, content) {
  const dir = httpDir(engine);
  const files = child(dir, "FILES");
  const existing = childrenOf(files, "FILE").find((f) => textOf(f, "NAME") === name);
  if (existing) { setChildText(path(existing, "FILE_CONTENT"), "TEXT", content); return; }
  const num = (+textOf(dir, "FILE_COUNTER") || 0) + 1;
  if (child(dir, "FILE_COUNTER")) setText(child(dir, "FILE_COUNTER"), num);
  const f = el("FILE", "", [["class", "CFile"]]);
  f.text = null;
  const content_ = el("FILE_CONTENT", "", [["class", "CHttpPage"]]);
  content_.text = null;
  content_.children.push(el("TEXT", content));
  f.children.push(el("FILE_NUMBER", String(num)), el("NAME", name), el("DATE_TIME", "0"), el("PERMISSION", "6"), content_);
  files.children.push(f);
}

// ---------------------------------------------------------------------------------------------------------------
// LIFT

/**
 * @param engine  elemento ENGINE
 * @param inv     inventario delle porte (la prima e' la principale)
 */
export function liftHost(engine, type, inv) {
  const patch = { ports: [], dns: [] };
  const pn = inv[0]?.node;
  if (pn) {
    const dhcp = flag(textOf(pn, "PORT_DHCP_ENABLE"));
    const ip = textOf(pn, "IP"), mask = textOf(pn, "SUBNET");
    if (dhcp) patch.ports.push({ name: null, dhcp: true });
    else if (validIp(ip)) patch.ports.push({ name: null, ip, prefix: maskToPrefix(mask) ?? classfulPrefix(ip) });
  }
  // altre porte del host con IP (rare): si esportano per nome
  inv.slice(1).forEach((p) => {
    const ip = textOf(p.node, "IP"), mask = textOf(p.node, "SUBNET");
    if (validIp(ip)) patch.ports.push({ name: p.name, ip, prefix: maskToPrefix(mask) ?? classfulPrefix(ip) });
  });
  const gw = textOf(engine, "GATEWAY");
  if (validIp(gw)) patch.gw = gw;
  const dns = textOf(child(engine, "DNS_CLIENT"), "SERVER_IP");
  if (validIp(dns)) patch.dns.push(dns);

  const mc = child(engine, "EMAIL_CLIENT");
  if (type === "pc" || type === "server") {
    if (mc && textOf(mc, "MAIL_ID")) {
      const address = textOf(mc, "MAIL_ID");
      const domain = address.split("@")[1] ?? "";
      const m = { address, pass: textOf(mc, "PASSWORD") };
      const user = textOf(mc, "USER");
      if (user && user !== address.split("@")[0]) m.user = user;
      const pop3 = textOf(mc, "POP3_SERVER"), smtp = textOf(mc, "SMTP_SERVER");
      if (pop3 !== `pop3.${domain}`) m.pop3 = pop3;
      if (smtp !== `smtp.${domain}`) m.smtp = smtp;
      const name = textOf(mc, "NAME");
      if (name && name !== address.split("@")[0]) m.name = name;
      patch.mail = m;
    }
  }

  if (type === "server") {
    const svc = {};
    for (const [k, [tag, sub, def]] of Object.entries(SERVICE_TOGGLES)) {
      const n = child(engine, tag);
      if (!n) continue;
      const v = flag(textOf(n, sub));
      if (v !== def) svc[k] = v;
    }
    patch.services = svc;

    // DNS
    const dn = child(engine, "DNS_SERVER");
    if (dn) {
      const recs = [];
      for (const r of childrenOf(child(dn, "NAMESERVER-DATABASE"), "RESOURCE-RECORD")) {
        const t = textOf(r, "TYPE");
        if (t === "A-REC") recs.push({ type: "a", name: textOf(r, "NAME"), value: textOf(r, "IPADDRESS") });
        else if (t === "CNAME") recs.push({ type: "cname", name: textOf(r, "NAME"), value: textOf(r, "HOSTNAME") });
        else if (t === "NS") recs.push({ type: "ns", name: textOf(r, "NAME"), value: textOf(r, "SERVER-NAME") });
      }
      patch.dnsRecords = recs;
      const on = flag(textOf(dn, "ENABLED"));
      if (on && !recs.length) svc.dns = true;
      if (!on && recs.length) svc.dns = false;
    }

    // DHCP
    const ds = path(engine, "DHCP_SERVERS/ASSOCIATED_PORTS/ASSOCIATED_PORT/DHCP_SERVER");
    if (ds) {
      const pools = [];
      for (const p of childrenOf(child(ds, "POOLS"), "POOL")) {
        const net = textOf(p, "NETWORK"), mask = textOf(p, "MASK"), start = textOf(p, "START_IP");
        if (!validIp(net) || !validIp(start)) continue;
        const pool = { net, prefix: maskToPrefix(mask) ?? classfulPrefix(net), from: start, max: +textOf(p, "MAX_USERS") || 0 };
        // il pool "di fabbrica" (spento, rete = quella dell'IP, 512 utenti, niente gateway/DNS) non e' una scelta dell'utente
        if (!flag(textOf(ds, "ENABLED")) && start === net && pool.max === 512 && !validIp(textOf(p, "DEFAULT_ROUTER")) && !validIp(textOf(p, "DNS_SERVER"))) continue;
        const name = textOf(p, "NAME");
        if (name !== "serverPool") pool.name = name;
        const gw2 = textOf(p, "DEFAULT_ROUTER"), dns2 = textOf(p, "DNS_SERVER"), dom = textOf(p, "DOMAIN_NAME");
        if (validIp(gw2)) pool.gw = gw2;
        if (validIp(dns2)) pool.dns = [dns2];
        if (dom) pool.domain = dom;
        pools.push(pool);
      }
      patch.dhcpPools = pools;
      const on = flag(textOf(ds, "ENABLED"));
      if (!on && pools.length) svc.dhcp = false;
      if (on && !pools.length) svc.dhcp = true;
    }

    // posta
    const es = child(engine, "EMAIL_SERVER");
    if (es) {
      const domain = textOf(es, "SMTP_DOMAIN");
      const users = [];
      const n = +textOf(es, "NO_OF_USERS") || 0;
      for (let i = 0; i < n; i++) users.push({ name: textOf(es, `USER${i}`), pass: textOf(es, `PASSWORD${i}`) });
      if (domain) patch.mailDomain = domain;
      patch.mailUsers = users;
      if (!flag(textOf(es, "SMTP_ENABLED")) && !flag(textOf(es, "POP3_ENABLED"))) svc.mail = false;
    }

    // file HTTP dell'utente
    patch.files = [];
    for (const [name, content] of httpFiles(engine)) {
      if (name === "index.html" ? content === DEFAULT_INDEX : DEFAULT_FILES.includes(name)) continue;
      patch.files.push({ name, content });
    }
  }
  return patch;
}

// ---------------------------------------------------------------------------------------------------------------
// APPLY

export function applyHost(engine, dev, type, inv) {
  const pn = inv[0]?.node;
  const primary = inv[0]?.name;
  const allowed = new Set(inv.map((p) => p.name));
  for (const p of dev.ports) {
    const name = p.name ?? primary;
    if (!allowed.has(name)) throw new PktmdError(`${dev.id}: la porta ${name} non esiste (porte: ${inv.map((x) => x.name).join(", ")})`, p.line);
    const node = inv.find((x) => x.name === name).node;
    if (p.dhcp) {
      setChildText(node, "PORT_DHCP_ENABLE", "true");
      const map = path(engine, "DHCP_CLIENT/PORT_DATA_MAP");
      if (map) {
        map.selfClosing = false;
        const entry = el("PORT_DATA_ENTRY", "");
        entry.text = null;
        entry.children.push(el("PORT", name));
        map.children.push(entry);
        map.text = null;
      }
    } else if (p.ip) {
      setChildText(node, "IP", p.ip);
      setChildText(node, "SUBNET", prefixToMask(p.prefix));
    }
  }
  if (dev.gw && pn) {
    setChildText(engine, "GATEWAY", dev.gw);
    setChildText(pn, "PORT_GATEWAY", dev.gw);
  }
  if (dev.dns?.length && pn) {
    setChildText(child(engine, "DNS_CLIENT"), "SERVER_IP", dev.dns[0]);
    setChildText(pn, "PORT_DNS", dev.dns[0]);
  }

  if (dev.mail) {
    const mc = child(engine, "EMAIL_CLIENT");
    const [user, domain] = dev.mail.address.split("@");
    setChildText(mc, "ENABLED", "1");
    setChildText(mc, "NAME", dev.mail.name ?? user);
    setChildText(mc, "MAIL_ID", dev.mail.address);
    setChildText(mc, "POP3_SERVER", dev.mail.pop3 ?? `pop3.${domain}`);
    setChildText(mc, "SMTP_SERVER", dev.mail.smtp ?? `smtp.${domain}`);
    setChildText(mc, "USER", dev.mail.user ?? user);
    setChildText(mc, "PASSWORD", dev.mail.pass);
  }
  if (type !== "server") return;

  const svc = dev.services ?? {};
  for (const [k, v] of Object.entries(svc)) {
    const t = SERVICE_TOGGLES[k];
    if (t) setChildText(child(engine, t[0]), t[1], v ? "1" : "0");
  }

  // DNS
  if (dev.dnsRecords?.length || svc.dns !== undefined) {
    const dn = child(engine, "DNS_SERVER");
    setChildText(dn, "ENABLED", svc.dns === false ? "0" : "1");
    const db = child(dn, "NAMESERVER-DATABASE");
    db.children = [];
    db.selfClosing = false;
    db.text = null;
    for (const r of dev.dnsRecords ?? []) {
      const rec = el("RESOURCE-RECORD", "");
      rec.text = null;
      const [type_, valueTag] = r.type === "a" ? ["A-REC", "IPADDRESS"] : r.type === "cname" ? ["CNAME", "HOSTNAME"] : ["NS", "SERVER-NAME"];
      rec.children.push(el("TYPE", type_), el("NAME", r.name), el("TTL", "86400"), el(valueTag, r.value));
      db.children.push(rec);
    }
  }

  // DHCP
  if (dev.dhcpPools?.length || svc.dhcp !== undefined) {
    const ds = path(engine, "DHCP_SERVERS/ASSOCIATED_PORTS/ASSOCIATED_PORT/DHCP_SERVER");
    setChildText(ds, "ENABLED", svc.dhcp === false ? "0" : "1");
    const pools = child(ds, "POOLS");
    const tpl = child(pools, "POOL");
    pools.children = [];
    (dev.dhcpPools ?? []).forEach((p, i) => {
      const pool = JSON.parse(JSON.stringify(tpl));
      const max = p.max || 50;
      const from = p.from ?? intToIp(ipToInt(networkAddress(p.net, p.prefix)) + 1);
      setChildText(pool, "NAME", p.name ?? (i === 0 ? "serverPool" : `serverPool${i + 1}`));
      setChildText(pool, "NETWORK", networkAddress(p.net, p.prefix));
      setChildText(pool, "MASK", prefixToMask(p.prefix));
      setChildText(pool, "DEFAULT_ROUTER", p.gw ?? "0.0.0.0");
      setChildText(pool, "START_IP", from);
      setChildText(pool, "END_IP", intToIp(ipToInt(from) + max - 1));
      setChildText(pool, "DNS_SERVER", p.dns?.[0] ?? "0.0.0.0");
      setChildText(pool, "MAX_USERS", String(max));
      if (p.domain) setChildText(pool, "DOMAIN_NAME", p.domain);
      pools.children.push(pool);
    });
  }

  // posta
  if (dev.mailDomain || dev.mailUsers?.length || svc.mail !== undefined) {
    const es = child(engine, "EMAIL_SERVER");
    const on = svc.mail === false ? "0" : "1";
    setChildText(es, "SMTP_ENABLED", on);
    setChildText(es, "POP3_ENABLED", on);
    setChildText(es, "SMTP_DOMAIN", dev.mailDomain ?? "");
    es.children = es.children.filter((c) => !/^(USER|PASSWORD|NO_OF_MAILS)\d+$/.test(c.tag));
    setChildText(es, "NO_OF_USERS", String(dev.mailUsers?.length ?? 0));
    (dev.mailUsers ?? []).forEach((u, i) => {
      es.children.push(el(`USER${i}`, u.name), el(`PASSWORD${i}`, u.pass), el(`NO_OF_MAILS${i}`, "0"));
    });
  }

  setHttpFile(engine, "index.html", DEFAULT_INDEX);
  for (const f of dev.files ?? []) setHttpFile(engine, f.name, f.content);
}
