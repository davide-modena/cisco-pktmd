// Disposizione dei dispositivi.
//
//   hierarchyLayout(net)  albero a livelli: router in alto, poi switch di core/distribuzione/piano, poi i PC e i server
//   autoLayout(net)       come sopra ma in coordinate del workspace di Packet Tracer (per il .pkt)
//
// Resta anche una piccola simulazione a forze (simulationStep) per chi la vuole usare.

// ---------------------------------------------------------------------------------------------------------------
// layout gerarchico

const isHost = (d) => d.type === "pc" || d.type === "server" || d.type === "laptop";

/**
 * @param {{devices: {id:string,type:string,pos?:{x:number,y:number}}[], links: {a:{dev:string}, b:{dev:string}}[]}} net
 * @param {{vGap?:number, hostW?:number, infraW?:number, gap?:number, widthOf?:(d)=>number}} [opts]
 * @returns {{pos: Map<string,{x:number,y:number}>, depth: Map<string,number>, parent: Map<string,string|null>, children: Map<string,string[]>, roots: string[]}}
 */
export function hierarchyLayout(net, opts = {}) {
  const { vGap = 210, hostW = 150, infraW = 190, gap = 28 } = opts;
  const widthOf = opts.widthOf ?? ((d) => (isHost(d) ? hostW : infraW));
  const byId = new Map(net.devices.map((d) => [d.id, d]));
  const order = new Map(net.devices.map((d, i) => [d.id, i]));
  const adj = new Map(net.devices.map((d) => [d.id, []]));
  for (const l of net.links) {
    const a = l.a.dev, b = l.b.dev;
    if (!adj.has(a) || !adj.has(b) || a === b) continue;
    if (!adj.get(a).includes(b)) adj.get(a).push(b);
    if (!adj.get(b).includes(a)) adj.get(b).push(a);
  }

  // radice di ogni componente: il router piu' connesso (o, senza router, il dispositivo piu' connesso)
  const rank = (d) => (d.type === "router" ? 1000 : d.type === "switch" ? 100 : 0) + adj.get(d.id).length;
  const candidates = [...net.devices].sort((x, y) => rank(y) - rank(x) || order.get(x.id) - order.get(y.id));

  const depth = new Map(), parent = new Map(), children = new Map(net.devices.map((d) => [d.id, []]));
  const roots = [];
  for (const c of candidates) {
    if (depth.has(c.id)) continue;
    roots.push(c.id);
    depth.set(c.id, 0);
    parent.set(c.id, null);
    const queue = [c.id];
    for (let qi = 0; qi < queue.length; qi++) {
      const u = queue[qi];
      // i vicini infrastrutturali prima, gli host dopo; a parita' l'ordine di scrittura
      const next = adj.get(u).filter((v) => !depth.has(v)).sort((x, y) => (isHost(byId.get(x)) - isHost(byId.get(y))) || order.get(x) - order.get(y));
      for (const v of next) {
        // un host raggiunto da due switch resta sotto il primo; un router/switch collegato a un pari-livello non scende
        depth.set(v, depth.get(u) + 1);
        parent.set(v, u);
        children.get(u).push(v);
        queue.push(v);
      }
    }
  }

  // larghezza dei sottoalberi e posizioni orizzontali
  const width = new Map();
  const measure = (id) => {
    const own = widthOf(byId.get(id));
    const kids = children.get(id);
    if (!kids.length) { width.set(id, own); return own; }
    const sum = kids.reduce((s, k) => s + measure(k), 0) + gap * (kids.length - 1);
    width.set(id, Math.max(own, sum));
    return width.get(id);
  };
  const pos = new Map();
  const place = (id, left) => {
    const w = width.get(id);
    const kids = children.get(id);
    const sum = kids.reduce((s, k) => s + width.get(k), 0) + gap * Math.max(0, kids.length - 1);
    let x = left + (w - sum) / 2;
    for (const k of kids) { place(k, x); x += width.get(k) + gap; }
    // il padre sta al centro dei figli (non dell'intero riquadro)
    const first = kids.length ? pos.get(kids[0]).x : left + w / 2;
    const last = kids.length ? pos.get(kids[kids.length - 1]).x : left + w / 2;
    pos.set(id, { x: (first + last) / 2, y: depth.get(id) * vGap });
  };
  let cursor = 0;
  for (const r of roots) {
    measure(r);
    place(r, cursor);
    cursor += width.get(r) + gap * 3;
  }
  // posizioni scelte dall'utente (`pos x y`) vincono
  for (const d of net.devices) if (d.pos) pos.set(d.id, { x: d.pos.x, y: d.pos.y });
  return { pos, depth, parent, children, roots };
}

/** posizioni (Map id -> {x,y}) -> coordinate del workspace di PT (positive, con un margine) */
export function toPtCoords(positions, { scale = 1, margin = 100 } = {}) {
  const pts = [...positions.values()];
  if (!pts.length) return new Map();
  const minX = Math.min(...pts.map((p) => p.x)), minY = Math.min(...pts.map((p) => p.y));
  return new Map([...positions].map(([id, p]) => [id, { x: Math.round((p.x - minX) * scale + margin), y: Math.round((p.y - minY) * scale + margin) }]));
}

/**
 * Posizioni per il .pkt. I dispositivi con `pos` esplicito restano dove sono, gli altri vengono disposti ad albero.
 */
export function autoLayout(net, { scale = 0.75, margin = 100 } = {}) {
  const { pos } = hierarchyLayout(net, { hostW: 110, infraW: 150, vGap: 190 });
  const free = new Map([...pos].filter(([id]) => !net.devices.find((d) => d.id === id)?.pos));
  const scaled = toPtCoords(free, { scale, margin });
  const out = new Map();
  for (const d of net.devices) out.set(d.id, d.pos ? { x: d.pos.x, y: d.pos.y } : scaled.get(d.id));
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// simulazione a forze (facoltativa)

export const DEFAULT_PHYSICS = {
  repulsion: 16000,
  springStrength: 0.05,
  springLength: 150,
  gravity: 0.03,
  damping: 0.85,
  minEnergy: 0.05,
};

/** un passo di simulazione; ritorna l'energia cinetica totale */
export function simulationStep(nodes, edges, ph = DEFAULT_PHYSICS, center = { x: 0, y: 0 }) {
  const n = nodes.length;
  if (!n) return 0;
  const byId = new Map(nodes.map((nd) => [nd.id, nd]));
  for (let i = 0; i < n; i++) {
    const a = nodes[i];
    for (let j = i + 1; j < n; j++) {
      const b = nodes[j];
      let dx = a.x - b.x, dy = a.y - b.y;
      let d2 = dx * dx + dy * dy;
      if (d2 < 0.01) { dx = i - j || 1; dy = 1; d2 = dx * dx + dy * dy; }
      const d = Math.sqrt(d2);
      const f = ph.repulsion / d2;
      const fx = (dx / d) * f, fy = (dy / d) * f;
      a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
    }
  }
  for (const e of edges) {
    const a = byId.get(e.source), b = byId.get(e.target);
    if (!a || !b) continue;
    const dx = b.x - a.x, dy = b.y - a.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
    const f = ph.springStrength * (d - ph.springLength);
    const fx = (dx / d) * f, fy = (dy / d) * f;
    a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
  }
  let energy = 0;
  for (const nd of nodes) {
    if (nd.fixed) { nd.vx = nd.vy = 0; continue; }
    nd.vx += (center.x - nd.x) * ph.gravity;
    nd.vy += (center.y - nd.y) * ph.gravity;
    nd.vx *= ph.damping; nd.vy *= ph.damping;
    nd.x += nd.vx; nd.y += nd.vy;
    energy += nd.vx * nd.vx + nd.vy * nd.vy;
  }
  return energy;
}

export function seedPositions(nodes, radius = 120) {
  const n = nodes.length;
  nodes.forEach((nd, i) => {
    const a = (2 * Math.PI * i) / Math.max(n, 1) + 0.3;
    const r = radius * (1 + 0.15 * (i % 3));
    nd.x = Math.cos(a) * r; nd.y = Math.sin(a) * r; nd.vx = 0; nd.vy = 0;
  });
}
