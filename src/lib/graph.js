import { extractWikiLinks } from "./wikilinks";

// Builds a graph where notes are nodes and edges come from two sources:
// notes that share a #tag, and notes that reference each other with a
// [[Wiki Link]]. Multiple shared tags/links between the same pair of notes
// collapse into one edge (with both "kinds" recorded, so the renderer can
// draw link edges more strongly than tag edges).
export function buildGraph(notes) {
  const nodes = notes.map((n) => ({ id: n.id, label: n.title || "Untitled", tags: n.tags || [] }));
  const edgeMap = new Map();

  const addEdge = (a, b, kind) => {
    if (a === b) return;
    const key = [a, b].sort().join("|");
    if (!edgeMap.has(key)) edgeMap.set(key, { source: a, target: b, kinds: new Set() });
    edgeMap.get(key).kinds.add(kind);
  };

  const byTag = new Map();
  notes.forEach((n) => {
    (n.tags || []).forEach((t) => {
      if (!byTag.has(t)) byTag.set(t, []);
      byTag.get(t).push(n.id);
    });
  });
  byTag.forEach((ids) => {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) addEdge(ids[i], ids[j], "tag");
    }
  });

  const idByTitle = new Map(notes.map((n) => [(n.title || "").trim().toLowerCase(), n.id]));
  notes.forEach((n) => {
    extractWikiLinks(n.body).forEach((title) => {
      const targetId = idByTitle.get(title.trim().toLowerCase());
      if (targetId) addEdge(n.id, targetId, "link");
    });
  });

  const edges = [...edgeMap.values()].map((e) => ({ ...e, kinds: [...e.kinds] }));
  return { nodes, edges };
}

// A minimal force-directed layout: nodes repel each other, edges pull their
// endpoints together like springs, everything is gently pulled back toward
// center so the graph doesn't drift off-canvas. No physics/graph library --
// this is the "basic positioning logic" the feature calls for, sized for the
// tens-to-low-hundreds of notes a personal vault realistically has.
export function computeLayout(nodes, edges, { width = 600, height = 600, iterations = 140 } = {}) {
  const cx = width / 2;
  const cy = height / 2;
  if (nodes.length === 0) return [];

  const positions = new Map();
  nodes.forEach((n, i) => {
    const angle = (i / nodes.length) * Math.PI * 2;
    const r = Math.min(width, height) * 0.3;
    positions.set(n.id, { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
  });
  const velocities = new Map(nodes.map((n) => [n.id, { x: 0, y: 0 }]));

  const REPULSION = 6000;
  const SPRING_LENGTH = 110;
  const SPRING_STRENGTH = 0.02;
  const CENTER_PULL = 0.001;
  const DAMPING = 0.85;

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = positions.get(nodes[i].id);
        const b = positions.get(nodes[j].id);
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        const distSq = dx * dx + dy * dy || 0.01;
        const dist = Math.sqrt(distSq);
        const force = REPULSION / distSq;
        dx = (dx / dist) * force;
        dy = (dy / dist) * force;
        const va = velocities.get(nodes[i].id);
        const vb = velocities.get(nodes[j].id);
        va.x += dx;
        va.y += dy;
        vb.x -= dx;
        vb.y -= dy;
      }
    }

    edges.forEach((e) => {
      const a = positions.get(e.source);
      const b = positions.get(e.target);
      if (!a || !b) return;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const force = (dist - SPRING_LENGTH) * SPRING_STRENGTH;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      const va = velocities.get(e.source);
      const vb = velocities.get(e.target);
      va.x += fx;
      va.y += fy;
      vb.x -= fx;
      vb.y -= fy;
    });

    nodes.forEach((n) => {
      const p = positions.get(n.id);
      const v = velocities.get(n.id);
      v.x = (v.x + (cx - p.x) * CENTER_PULL) * DAMPING;
      v.y = (v.y + (cy - p.y) * CENTER_PULL) * DAMPING;
      p.x += v.x;
      p.y += v.y;
    });
  }

  return nodes.map((n) => ({ ...n, ...positions.get(n.id) }));
}
