/**
 * ArchitectsMirror.jsx
 * Local-only system-mapping app. React + Canvas. MIT.
 * Paste plain text → Generate → Drag nodes → Export PNG/JSON.
 */

import React, { useEffect, useRef, useState } from "react";

/* -------- parsing -------- */

const normalize = (s) =>
  s
    .toLowerCase()
    .replace(/[^\w\s->:,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const KINDS = [
  { key: "ui", match: /(ui|frontend|client|app|dashboard)/ },
  { key: "api", match: /(api|gateway|service|svc|backend)/ },
  { key: "db", match: /(db|database|store|storage|postgres|mysql|mongo)/ },
  { key: "auth", match: /(auth|oauth|identity|login)/ },
  { key: "queue", match: /(queue|event|kafka|bus|pubsub)/ },
  { key: "cache", match: /(cache|redis|memcached)/ },
  { key: "ai", match: /(ai|model|ml|inference|embedding)/ },
];

const COLORS = {
  ui: "#2563eb",
  api: "#0ea5e9",
  db: "#059669",
  auth: "#f59e0b",
  queue: "#a855f7",
  cache: "#ef4444",
  ai: "#14b8a6",
  default: "#64748b",
};

function kindOf(name) {
  const n = name.toLowerCase();
  const k = KINDS.find((k) => k.match.test(n));
  return k ? k.key : "default";
}

function titleCase(s) {
  return s
    .split(/[\s_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function parseText(text) {
  // Accept lines like:
  // "frontend ui connects to api gateway"
  // "api -> auth, database"
  // "queue publishes to api"
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const nodes = new Map(); // name -> node
  const edges = [];

  const ensure = (name) => {
    const key = name.trim();
    if (!key) return null;
    if (!nodes.has(key)) {
      nodes.set(key, {
        id: key,
        label: titleCase(key),
        kind: kindOf(key),
        x: 0,
        y: 0,
      });
    }
    return nodes.get(key);
  };

  lines.forEach((raw) => {
    const l = raw.replace(/[,]/g, " , ").replace(/\s+/g, " ").trim();
    // normalize arrows
    const arrow = /->|→|to/;
    if (arrow.test(l)) {
      const parts = l.split(/->|→| to /i).map((p) => p.trim());
      if (parts.length >= 2) {
        const left = parts[0]
          .replace(/(connects?|talks?|calls?|publishes?|reads|writes)\s*$/i, "")
          .trim();
        const rights = parts
          .slice(1)
          .join(" to ")
          .split(/,| and /i)
          .map((r) => r.trim())
          .filter(Boolean);
        const src = ensure(left);
        rights.forEach((r) => {
          const dst = ensure(r);
          if (src && dst) edges.push({ from: src.id, to: dst.id, label: "" });
        });
        return;
      }
    }
    // natural language patterns
    const m = l.match(
      /(.*?)(connects?|talks?|calls?|publishes?|sends|reads|writes)\s+to\s+(.*)/i
    );
    if (m) {
      const left = m[1].trim();
      const rights = m[3]
        .split(/,| and /i)
        .map((r) => r.trim())
        .filter(Boolean);
      const src = ensure(left);
      rights.forEach((r) => {
        const dst = ensure(r);
        if (src && dst) edges.push({ from: src.id, to: dst.id, label: "" });
      });
      return;
    }
    // orphan node line
    ensure(l);
  });

  // simple dedupe edges
  const seen = new Set();
  const dedup = [];
  for (const e of edges) {
    const k = `${e.from}->${e.to}`;
    if (!seen.has(k) && e.from !== e.to) {
      seen.add(k);
      dedup.push(e);
    }
  }

  return { nodes: Array.from(nodes.values()), edges: dedup };
}

/* -------- layout -------- */

function circleLayout(nodes, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.35;
  const n = nodes.length || 1;
  nodes.forEach((node, i) => {
    const a = (2 * Math.PI * i) / n - Math.PI / 2;
    node.x = cx + r * Math.cos(a);
    node.y = cy + r * Math.sin(a);
  });
}

function nudgeLayout(nodes, edges, w, h) {
  // light force: pull connected nodes closer
  const idTo = Object.fromEntries(nodes.map((n, i) => [n.id, i]));
  for (let t = 0; t < 80; t++) {
    edges.forEach((e) => {
      const a = nodes[idTo[e.from]];
      const b = nodes[idTo[e.to]];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      const target = 140;
      const k = 0.02 * (d - target);
      const nx = (dx / d) * k;
      const ny = (dy / d) * k;
      a.x += nx;
      a.y += ny;
      b.x -= nx;
      b.y -= ny;
    });
    nodes.forEach((n) => {
      // weak centering
      n.x += (w / 2 - n.x) * 0.001;
      n.y += (h / 2 - n.y) * 0.001;
    });
  }
}

/* -------- rendering -------- */

function draw(ctx, nodes, edges, options) {
  const { w, h } = options;
  ctx.clearRect(0, 0, w, h);

  // edges
  ctx.lineWidth = 1.5;
  ctx.font = "11px ui-sans-serif, system-ui, -apple-system, Segoe UI";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  edges.forEach((e) => {
    const a = nodes.find((n) => n.id === e.from);
    const b = nodes.find((n) => n.id === e.to);
    if (!a || !b) return;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d;
    const uy = dy / d;
    const start = 32; // node radius
    const end = 32;

    const x1 = a.x + ux * start;
    const y1 = a.y + uy * start;
    const x2 = b.x - ux * end;
    const y2 = b.y - uy * end;

    ctx.strokeStyle = "#94a3b8";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // arrow head
    const ah = 7;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - ux * ah - uy * ah, y2 - uy * ah + ux * ah);
    ctx.lineTo(x2 - ux * ah + uy * ah, y2 - uy * ah - ux * ah);
    ctx.closePath();
    ctx.fillStyle = "#94a3b8";
    ctx.fill();
  });

  // nodes
  nodes.forEach((n) => {
    const r = 28;
    ctx.beginPath();
    ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
    ctx.fillStyle = COLORS[n.kind] || COLORS.default;
    ctx.fill();

    // label background
    const label = n.label;
    const padX = 8;
    const padY = 4;
    const textW = ctx.measureText(label).width;
    const bgW = Math.max(textW + padX * 2, 36);
    const bgH = 18;

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    roundRect(ctx, n.x - bgW / 2, n.y - r - 10 - bgH, bgW, bgH, 6);
    ctx.fill();

    ctx.fillStyle = "#0f172a";
    ctx.fillText(label, n.x, n.y - r - 10 - bgH / 2);
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* -------- component -------- */

export default function ArchitectsMirror() {
  const [input, setInput] = useState(
    [
      "frontend ui connects to api gateway",
      "api gateway -> auth service, database, cache",
      "auth service talks to database",
      "queue publishes to api gateway",
      "ai inference service -> api gateway",
      "database stores user data",
    ].join("\n")
  );
  const [model, setModel] = useState({ nodes: [], edges: [] });
  const [dragId, setDragId] = useState(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const canvasRef = useRef(null);
  const sizeRef = useRef({ w: 900, h: 560 });

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const { w, h } = sizeRef.current;
    c.width = w;
    c.height = h;
    render();
    // eslint-disable-next-line
  }, [model]);

  function generate() {
    const parsed = parseText(input);
    const { w, h } = sizeRef.current;
    circleLayout(parsed.nodes, w, h);
    nudgeLayout(parsed.nodes, parsed.edges, w, h);
    setModel(parsed);
  }

  function render() {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    draw(ctx, model.nodes, model.edges, sizeRef.current);
  }

  function pickNode(mx, my) {
    for (let i = model.nodes.length - 1; i >= 0; i--) {
      const n = model.nodes[i];
      const d = Math.hypot(mx - n.x, my - n.y);
      if (d <= 30) return n.id;
    }
    return null;
  }

  function onDown(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const id = pickNode(mx, my);
    if (!id) return;
    setDragId(id);
    const n = model.nodes.find((n) => n.id === id);
    setOffset({ x: mx - n.x, y: my - n.y });
  }

  function onMove(e) {
    if (!dragId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setModel((m) => {
      const copy = { ...m, nodes: m.nodes.map((n) => ({ ...n })) };
      const n = copy.nodes.find((n) => n.id === dragId);
      n.x = mx - offset.x;
      n.y = my - offset.y;
      return copy;
    });
  }

  function onUp() {
    setDragId(null);
  }

  function exportPNG() {
    const c = canvasRef.current;
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = "architects-mirror.png";
    a.click();
  }

  function exportJSON() {
    const payload = JSON.stringify(model, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "architects-mirror.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto font-sans">
      <header className="mb-4">
        <h1 className="text-3xl font-bold">Architect’s Mirror</h1>
        <p className="text-sm text-slate-600">
          Turn text into an interactive system map. No backend.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-1">
          <textarea
            className="w-full h-56 p-3 rounded-xl border text-sm"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe your system. Example:
frontend ui connects to api gateway
api gateway -> auth service, database"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={generate}
              className="px-3 py-2 rounded-xl bg-slate-900 text-white text-sm"
            >
              Generate Map
            </button>
            <button
              onClick={exportPNG}
              className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm"
            >
              Export PNG
            </button>
            <button
              onClick={exportJSON}
              className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-sm"
            >
              Export JSON
            </button>
          </div>

          <div className="mt-4 text-xs text-slate-500">
            Tips:
            <ul className="list-disc ml-4 mt-1 space-y-1">
              <li>Use “A -> B, C” for quick arrows.</li>
              <li>Keywords colorize nodes: UI, API, DB, Auth, Queue, Cache, AI.</li>
              <li>Drag nodes to tidy layout.</li>
            </ul>
          </div>
        </div>

        <div className="md:col-span-2">
          <canvas
            ref={canvasRef}
            width={900}
            height={560}
            className={`w-full rounded-2xl border bg-white ${dragId ? "cursor-grabbing":"cursor-grab"}`}
            onMouseDown={onDown}
            onMouseMove={onMove}
            onMouseUp={onUp}
            onMouseLeave={onUp}
          />
        </div>
      </section>

      <footer className="mt-5 text-[11px] text-slate-500">
        Deterministic demo. Replace parser with your DSL or API if needed. MIT.
      </footer>
    </div>
  );
}

