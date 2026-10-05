// Disegno della rete su canvas: albero a livelli, icone 2D blu, cavi diversi per tipo, etichette che non si sovrappongono.
// Si trascina un nodo (con tutto il suo sottoalbero; Maiusc = solo lui), si sposta lo sfondo, si zooma con la rotella.
import { hierarchyLayout } from "./layout.js";
import { shortPort } from "./model.js";

const THEMES = {
  light: {
    bg: "#ffffff", text: "#16202b", muted: "#5d6b7a", card: "#f3f6fa", cardLine: "#d3dce7",
    icon: "#2f6fb5", iconFill: "#d6e6f7", iconLight: "#f4f9ff", iconDark: "#1d4f87",
    straight: "#4b5a6b", fiber: "#e08a00", serial: "#d33a2c", pill: "#ffffff", pillLine: "#b9c6d4", sel: "#1f6feb", badge: "#e8f0fb",
  },
  dark: {
    bg: "#0f141a", text: "#e6edf5", muted: "#9aa7b6", card: "#18212b", cardLine: "#2b3846",
    icon: "#6aa7ee", iconFill: "#1f3d63", iconLight: "#2a4f7e", iconDark: "#a9cdf6",
    straight: "#8795a6", fiber: "#f0a030", serial: "#ff6b5b", pill: "#16202b", pillLine: "#3a4a5c", sel: "#58a6ff", badge: "#1b2b40",
  },
};

const ICON = 30;                          // mezza dimensione dell'icona
const isHost = (t) => t === "pc" || t === "server" || t === "laptop";

// ---------------------------------------------------------------------------------------------------------------
// icone (centrate in 0,0, spazio -30..30)

function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

function iconPaint(ctx, c, fill, stroke = true) {
  ctx.fillStyle = fill ?? c.iconFill;
  ctx.fill();
  if (stroke) { ctx.lineWidth = 2; ctx.strokeStyle = c.icon; ctx.stroke(); }
}

function arrow(ctx, x1, y1, x2, y2, size = 5) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.moveTo(x2 - size * Math.cos(a - 0.5), y2 - size * Math.sin(a - 0.5));
  ctx.lineTo(x2, y2);
  ctx.lineTo(x2 - size * Math.cos(a + 0.5), y2 - size * Math.sin(a + 0.5));
  ctx.stroke();
}

const DRAW = {
  pc(ctx, c) {
    rr(ctx, -19, -28, 38, 28, 3); iconPaint(ctx, c);                 // monitor
    rr(ctx, -15, -24, 30, 20, 2); iconPaint(ctx, c, c.iconLight, false);
    rr(ctx, -4, 0, 8, 5, 1); iconPaint(ctx, c);                      // piede
    rr(ctx, -20, 5, 40, 9, 2); iconPaint(ctx, c);                    // unita' centrale
    rr(ctx, -22, 17, 44, 8, 2); iconPaint(ctx, c, c.iconLight);      // tastiera
  },
  laptop(ctx, c) {
    rr(ctx, -19, -26, 38, 26, 3); iconPaint(ctx, c);
    rr(ctx, -15, -22, 30, 18, 2); iconPaint(ctx, c, c.iconLight, false);
    ctx.beginPath(); ctx.moveTo(-26, 12); ctx.lineTo(26, 12); ctx.lineTo(20, 2); ctx.lineTo(-20, 2); ctx.closePath(); iconPaint(ctx, c);
    rr(ctx, -26, 12, 52, 5, 2); iconPaint(ctx, c);
  },
  server(ctx, c) {
    rr(ctx, -16, -28, 32, 56, 3); iconPaint(ctx, c);
    ctx.strokeStyle = c.icon; ctx.lineWidth = 1.6;
    for (const y of [-19, -9, 1]) { rr(ctx, -11, y, 22, 6, 1); iconPaint(ctx, c, c.iconLight, true); }
    ctx.beginPath(); ctx.arc(0, 17, 3, 0, 7); ctx.fillStyle = c.icon; ctx.fill();
  },
  switch(ctx, c) {
    rr(ctx, -29, -13, 58, 26, 4); iconPaint(ctx, c);
    ctx.strokeStyle = c.iconDark; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.lineJoin = "round";
    arrow(ctx, -20, -4, 20, -4); arrow(ctx, 20, 4, -20, 4);
    ctx.lineCap = "butt"; ctx.lineJoin = "miter";
  },
  router(ctx, c) {
    ctx.beginPath(); ctx.arc(0, 0, 27, 0, 7); iconPaint(ctx, c);
    ctx.strokeStyle = c.iconDark; ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.lineJoin = "round";
    arrow(ctx, -6, 0, -19, 0, 6); arrow(ctx, 6, 0, 19, 0, 6);        // verso l'esterno
    arrow(ctx, 0, -19, 0, -6, 6); arrow(ctx, 0, 19, 0, 6, 6);        // verso l'interno
    ctx.lineCap = "butt"; ctx.lineJoin = "miter";
  },
};

function drawOther(ctx, c, label) {
  rr(ctx, -30, -22, 60, 44, 8); iconPaint(ctx, c);
  ctx.fillStyle = c.iconDark; ctx.font = "600 11px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const words = String(label).split(/[\s-]+/);
  const lines = words.length > 1 ? [words.slice(0, Math.ceil(words.length / 2)).join(" "), words.slice(Math.ceil(words.length / 2)).join(" ")] : [label];
  lines.forEach((t, i) => ctx.fillText(t.slice(0, 11), 0, (i - (lines.length - 1) / 2) * 13));
}

// ---------------------------------------------------------------------------------------------------------------
// cavi

function strokeLink(ctx, c, kind, a, b, trunk) {
  ctx.save();
  ctx.lineCap = "round";
  if (kind === "fiber") {
    ctx.strokeStyle = c.fiber; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.strokeStyle = c.bg; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  } else if (kind === "serial") {
    // fulmine al centro del cavo
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const half = Math.min(28, len / 2 - 4);
    const p = (t, o) => ({ x: mid.x + ux * t + nx * o, y: mid.y + uy * t + ny * o });
    ctx.strokeStyle = c.serial; ctx.lineWidth = 2.4; ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    const s = p(-half, 0), z = [p(-half * 0.35, 9), p(half * 0.1, -9), p(half, 0)];
    ctx.lineTo(s.x, s.y);
    for (const q of z) ctx.lineTo(q.x, q.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  } else {
    ctx.strokeStyle = c.straight; ctx.lineWidth = trunk ? 3.6 : 2.2;
    if (kind === "cross") ctx.setLineDash([9, 6]);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------------------

const overlaps = (r, s, pad = 2) => r.x < s.x + s.w + pad && r.x + r.w + pad > s.x && r.y < s.y + s.h + pad && r.y + r.h + pad > s.y;

/**
 * @param {HTMLElement} container
 * @param {{theme?: "light"|"dark"|"auto", onMove?: ()=>void}} [opts]
 */
export function createNetworkView(container, opts = {}) {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "display:block;width:100%;height:100%;touch-action:none;cursor:default";
  container.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  let nodes = [];                  // {id,type,label,model,lines[],x,y,moved}
  let links = [];                  // {a,b,pa,pb,kind,trunk,badge}
  let layout = null;
  let view = { x: 0, y: 0, k: 1 };
  let size = { w: 300, h: 300, dpr: 1 };
  let hover = null;
  let drag = null;
  let showLegend = false;
  let userView = false;            // l'utente ha spostato/zoomato: niente piu' centraggio automatico

  // chiaro di default; "dark" lo scurisce, "auto" segue il sistema
  const dark = () => opts.theme === "dark" || (opts.theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);

  function resize() {
    const r = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    size = { w: Math.max(50, r.width), h: Math.max(50, r.height), dpr };
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    if (opts.autoFit && !userView && nodes.length) api.fit(); else draw();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  const toWorld = (px, py) => ({ x: (px - size.w / 2 - view.x) / view.k, y: (py - size.h / 2 - view.y) / view.k });
  const byId = () => new Map(nodes.map((n) => [n.id, n]));
  const nodeAt = (wx, wy) => [...nodes].reverse().find((n) => Math.abs(n.x - wx) <= ICON && Math.abs(n.y - wy) <= ICON);

  // ---- disposizione delle etichette -------------------------------------------------------------------------------
  function measure(text, font) { ctx.font = font; return ctx.measureText(text).width; }

  function computeBoxes() {
    const map = byId();
    const placed = [];
    const nameBoxes = new Map(), cards = new Map();
    const hasKids = (n) => (layout?.children.get(n.id)?.length ?? 0) > 0 || links.filter((l) => l.a === n.id || l.b === n.id).length > 1;
    for (const n of nodes) {
      const icon = { x: n.x - ICON, y: n.y - ICON, w: ICON * 2, h: ICON * 2 };
      placed.push(icon);
      const nameW = Math.max(measure(n.label, "600 13px system-ui, sans-serif"), measure(n.model ?? "", "10.5px system-ui, sans-serif")) + 12;
      const nameH = n.model ? 31 : 19;
      const cardW = n.lines.length ? Math.max(...n.lines.map((l) => measure(l, "11px ui-monospace, Consolas, monospace"))) + 14 : 0;
      const cardH = n.lines.length ? n.lines.length * 14 + 8 : 0;
      const side = !isHost(n.type) && hasKids(n);       // infrastruttura con figli: testo a destra, i fili restano liberi
      let nb, cb;
      if (side) {
        nb = { x: n.x + ICON + 8, y: n.y - ICON + 2, w: nameW, h: nameH };
        cb = n.lines.length ? { x: n.x + ICON + 8, y: nb.y + nameH + 3, w: cardW, h: cardH } : null;
      } else {
        nb = { x: n.x - nameW / 2, y: n.y + ICON + 4, w: nameW, h: nameH };
        cb = n.lines.length ? { x: n.x - cardW / 2, y: nb.y + nameH + 3, w: cardW, h: cardH } : null;
      }
      nameBoxes.set(n.id, nb); placed.push(nb);
      if (cb) { cards.set(n.id, cb); placed.push(cb); }
    }
    // badge vlan/trunk al centro dei cavi
    const badges = [];
    for (const l of links) {
      if (!l.badge) continue;
      const A = map.get(l.a), B = map.get(l.b);
      if (!A || !B) continue;
      const w = measure(l.badge, "600 10.5px system-ui, sans-serif") + 10;
      const r = { x: (A.x + B.x) / 2 - w / 2, y: (A.y + B.y) / 2 - 8, w, h: 16, text: l.badge };
      badges.push(r);
      placed.push(r);
    }
    // nomi di porta: lungo il cavo, piu' lontano finche' non coprono altro
    const pills = [];
    for (const l of links) {
      const A = map.get(l.a), B = map.get(l.b);
      if (!A || !B) continue;
      for (const [n, o, port] of [[A, B, l.pa], [B, A, l.pb]]) {
        if (!port) continue;
        const text = shortPort(port);
        const w = measure(text, "10.5px ui-monospace, Consolas, monospace") + 9, h = 15;
        const dx = o.x - n.x, dy = o.y - n.y, d = Math.hypot(dx, dy) || 1;
        const ux = dx / d, uy = dy / d;
        const start = ICON + 4 + Math.abs(ux) * w / 2 + Math.abs(uy) * h / 2;
        let best = null;
        for (let k = 0; k < 9; k++) {
          const t = start + k * 13;
          if (t > d - ICON - 6) break;
          const r = { x: n.x + ux * t - w / 2, y: n.y + uy * t - h / 2, w, h, text };
          const own = placed.filter((s) => s !== nameBoxes.get(n.id) || true);
          const hit = own.some((s) => overlaps(r, s));
          if (!best) best = r;
          if (!hit) { best = r; break; }
        }
        if (best) { pills.push(best); placed.push(best); }
      }
    }
    return { nameBoxes, cards, badges, pills };
  }

  // ---- disegno -----------------------------------------------------------------------------------------------------
  function draw() {
    const c = THEMES[dark() ? "dark" : "light"];
    const { w, h, dpr } = size;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = c.bg;
    ctx.fillRect(0, 0, w, h);
    const map = byId();
    const boxes = computeBoxes();
    const detail = view.k > (opts.compact ? 0.4 : 0.5);

    ctx.save();
    ctx.translate(w / 2 + view.x, h / 2 + view.y);
    ctx.scale(view.k, view.k);

    // cavi (prima quelli normali, poi i trunk sopra)
    for (const l of links) {
      const A = map.get(l.a), B = map.get(l.b);
      if (!A || !B) continue;
      strokeLink(ctx, c, l.kind, A, B, l.trunk);
    }

    // nodi
    for (const n of nodes) {
      ctx.save();
      ctx.translate(n.x, n.y);
      if (n === hover || n === drag?.node) {
        ctx.beginPath(); ctx.arc(0, 0, ICON + 6, 0, 7); ctx.strokeStyle = c.sel; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]);
      }
      // sfondo del colore della pagina sotto l'icona, cosi' i cavi non la attraversano
      if (DRAW[n.type]) DRAW[n.type](ctx, c); else drawOther(ctx, c, n.model ?? n.type);
      ctx.restore();

      const nb = boxes.nameBoxes.get(n.id);
      const left = nb.x > n.x;               // testo a destra del nodo
      ctx.textBaseline = "top";
      ctx.textAlign = left ? "left" : "center";
      const tx = left ? nb.x + 2 : nb.x + nb.w / 2;
      ctx.fillStyle = c.bg; ctx.globalAlpha = 0.85; ctx.fillRect(nb.x, nb.y, nb.w, nb.h); ctx.globalAlpha = 1;
      ctx.fillStyle = c.text; ctx.font = "600 13px system-ui, sans-serif";
      ctx.fillText(n.label, tx, nb.y + 2);
      if (n.model) { ctx.fillStyle = c.muted; ctx.font = "10.5px system-ui, sans-serif"; ctx.fillText(n.model, tx, nb.y + 18); }
      const cb = boxes.cards.get(n.id);
      if (cb && detail) {
        rr(ctx, cb.x, cb.y, cb.w, cb.h, 5); ctx.fillStyle = c.card; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = c.cardLine; ctx.stroke();
        ctx.fillStyle = c.text; ctx.font = "11px ui-monospace, Consolas, monospace"; ctx.textAlign = "left";
        n.lines.forEach((t, i) => ctx.fillText(t, cb.x + 7, cb.y + 5 + i * 14));
      }
    }

    // badge e nomi delle porte sopra tutto
    if (detail) {
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      for (const b of boxes.badges) {
        rr(ctx, b.x, b.y, b.w, b.h, 8); ctx.fillStyle = c.badge; ctx.fill(); ctx.strokeStyle = c.icon; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = c.iconDark; ctx.font = "600 10.5px system-ui, sans-serif"; ctx.fillText(b.text, b.x + b.w / 2, b.y + b.h / 2 + 0.5);
      }
      for (const p of boxes.pills) {
        rr(ctx, p.x, p.y, p.w, p.h, 4); ctx.fillStyle = c.pill; ctx.fill(); ctx.strokeStyle = c.pillLine; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = c.muted; ctx.font = "10.5px ui-monospace, Consolas, monospace"; ctx.fillText(p.text, p.x + p.w / 2, p.y + p.h / 2 + 0.5);
      }
    }
    ctx.restore();

    if (showLegend) drawLegend(c);
  }

  function drawLegend(c) {
    const items = [["straight", "rame dritto"], ["cross", "rame incrociato"], ["fiber", "fibra"], ["serial", "seriale"], ["trunk", "trunk"]];
    const x0 = 14, y0 = size.h - 14 - items.length * 20;
    ctx.save();
    ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    rr(ctx, x0 - 8, y0 - 8, 148, items.length * 20 + 10, 8); ctx.fillStyle = c.card; ctx.globalAlpha = 0.92; ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = c.cardLine; ctx.lineWidth = 1; ctx.stroke();
    items.forEach(([kind, label], i) => {
      const y = y0 + i * 20 + 6;
      strokeLink(ctx, c, kind === "trunk" ? "straight" : kind, { x: x0, y }, { x: x0 + 42, y }, kind === "trunk");
      ctx.fillStyle = c.muted; ctx.font = "11.5px system-ui, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
      ctx.fillText(label, x0 + 52, y);
    });
    ctx.restore();
  }

  // ---- input -------------------------------------------------------------------------------------------------------
  const pt = (ev) => { const r = canvas.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; };
  const subtree = (id) => {
    const out = [id];
    for (const k of layout?.children.get(id) ?? []) out.push(...subtree(k));
    return out;
  };

  canvas.addEventListener("pointerdown", (ev) => {
    const p = pt(ev), w = toWorld(p.x, p.y);
    const n = nodeAt(w.x, w.y);
    canvas.setPointerCapture(ev.pointerId);
    if (n) {
      const ids = ev.shiftKey || isHost(n.type) ? [n.id] : subtree(n.id);
      const map = byId();
      drag = { node: n, ids, start: { x: w.x, y: w.y }, origin: new Map(ids.map((i) => [i, { x: map.get(i).x, y: map.get(i).y }])) };
      canvas.style.cursor = "grabbing";
    } else {
      drag = { pan: true, sx: p.x, sy: p.y, vx: view.x, vy: view.y };
      canvas.style.cursor = "grabbing";
    }
  });
  canvas.addEventListener("pointermove", (ev) => {
    const p = pt(ev), w = toWorld(p.x, p.y);
    if (drag?.node) {
      const map = byId();
      for (const id of drag.ids) {
        const o = drag.origin.get(id), n = map.get(id);
        n.x = o.x + (w.x - drag.start.x); n.y = o.y + (w.y - drag.start.y); n.moved = true;
      }
      opts.onMove?.();
      draw();
    } else if (drag?.pan) {
      userView = true;
      view.x = drag.vx + p.x - drag.sx; view.y = drag.vy + p.y - drag.sy; draw();
    } else {
      const n = nodeAt(w.x, w.y) ?? null;
      if (n !== hover) { hover = n; canvas.style.cursor = n ? "grab" : "default"; draw(); }
    }
  });
  const end = () => { drag = null; canvas.style.cursor = hover ? "grab" : "default"; draw(); };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("wheel", (ev) => {
    // nelle pagine di testo la rotella serve a scorrere: si zooma solo con Ctrl
    if (opts.wheel === "ctrl" && !ev.ctrlKey && !ev.metaKey) return;
    ev.preventDefault();
    userView = true;
    const p = pt(ev);
    const before = toWorld(p.x, p.y);
    view.k = Math.min(3, Math.max(0.2, view.k * Math.exp(-ev.deltaY * 0.0015)));
    view.x = p.x - size.w / 2 - before.x * view.k;
    view.y = p.y - size.h / 2 - before.y * view.k;
    draw();
  }, { passive: false });
  canvas.addEventListener("dblclick", () => api.fit());

  // ---- API ----------------------------------------------------------------------------------------------------------
  const api = {
    /**
     * @param net        modello (dispositivi con porte/IP)
     * @param described  { links: [{a:{dev,port},b:{dev,port},kind,opts}], models: Map }  (da describeNetwork)
     */
    setNetwork(net, described) {
      const old = byId();
      const rl = described?.links ?? net.links;
      layout = hierarchyLayout({ devices: net.devices, links: rl }, opts.compact ? { hostW: 140, infraW: 205, vGap: 175 } : { hostW: 170, infraW: 250, vGap: 230 });
      nodes = net.devices.map((d) => {
        const lines = [];
        for (const p of d.ports) {
          if (!p.ip && !p.dhcp) continue;
          const label = p.name === null ? "" : p.name.startsWith("Vlan") ? p.name.toLowerCase() : shortPort(p.name) + (p.vlan !== undefined && !/\./.test(p.name) ? "." + p.vlan : "");
          lines.push(`${label ? label + " " : ""}${p.ip ? p.ip + "/" + p.prefix : "dhcp"}`);
        }
        const prev = old.get(d.id);
        const at = layout.pos.get(d.id);
        const node = prev?.moved ? prev : { x: at.x, y: at.y, moved: false };
        return Object.assign(node, { id: d.id, type: d.type, label: d.id, model: described?.models?.get(d.id) ?? null, lines });
      });
      links = rl.map((l) => ({
        a: l.a.dev, b: l.b.dev, pa: l.a.port, pb: l.b.port, kind: l.kind ?? "straight",
        trunk: !!l.opts?.trunk,
        badge: l.opts?.trunk ? "trunk" + (l.opts.trunk.allowed ? " " + l.opts.trunk.allowed : "") : l.opts?.vlan !== undefined ? "vlan " + l.opts.vlan : null,
      }));
      draw();
    },
    /** rimette tutto dove lo metterebbe il layout automatico */
    relayout() {
      for (const n of nodes) { const at = layout.pos.get(n.id); if (at) { n.x = at.x; n.y = at.y; n.moved = false; } }
      draw();
    },
    /** posizioni correnti (coordinate del disegno) */
    getPositions() { return new Map(nodes.map((n) => [n.id, { x: n.x, y: n.y }])); },
    fit() {
      if (!nodes.length) { view = { x: 0, y: 0, k: 1 }; draw(); return; }
      // ingombro reale: icone, nomi e riquadri degli indirizzi
      const boxes = computeBoxes();
      const rects = nodes.map((n) => ({ x: n.x - ICON, y: n.y - ICON, w: ICON * 2, h: ICON * 2 }));
      for (const m of [boxes.nameBoxes, boxes.cards]) rects.push(...m.values());
      const pad = 22;
      const minX = Math.min(...rects.map((r) => r.x)) - pad, maxX = Math.max(...rects.map((r) => r.x + r.w)) + pad;
      const minY = Math.min(...rects.map((r) => r.y)) - pad, maxY = Math.max(...rects.map((r) => r.y + r.h)) + pad;
      view.k = Math.min(1.25, Math.max(0.2, Math.min(size.w / (maxX - minX), size.h / (maxY - minY))));
      view.x = -((minX + maxX) / 2) * view.k;
      view.y = -((minY + maxY) / 2) * view.k;
      draw();
    },
    toggleLegend() { showLegend = !showLegend; draw(); },
    setTheme(t) { opts.theme = t; draw(); },
    /** dopo fit() esplicito si torna al centraggio automatico */
    resetView() { userView = false; api.fit(); },
    redraw: draw,
    destroy() { ro.disconnect(); canvas.remove(); },
  };
  return api;
}
