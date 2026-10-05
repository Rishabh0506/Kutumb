import React, { useCallback, useMemo, useRef, useEffect, useState, memo } from 'react';
import ReactFlow, {
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  MarkerType,
  ReactFlowProvider,
  useReactFlow,
  EdgeLabelRenderer,
  BaseEdge,
  getStraightPath,
  getBezierPath,
  getNodesBounds,
  getViewportForBounds,
} from 'reactflow';
import { toPng } from 'html-to-image';
import 'reactflow/dist/style.css';
import PersonNode from './PersonNode';
import Modal from './Modal';

// ══════════════════════════════════════════════════════════════
//  LAYOUT CONSTANTS
// ══════════════════════════════════════════════════════════════
const NODE_W     = 240;
const NODE_H     = 160;
const H_SPACING  = 300;   // minimum centre-to-centre horizontal gap
const V_SPACING  = 220;   // vertical gap between generations

// ══════════════════════════════════════════════════════════════
//  STEP 1 — Build adjacency lists from edges
// ══════════════════════════════════════════════════════════════
function buildAdjacency(nodes, edges) {
  const ids = new Set(nodes.map(n => n.id));
  const parentOf = {};   // parentOf[id] = set of id's CHILDREN
  const childOf  = {};   // childOf[id]  = set of id's PARENTS
  const sameGen  = {};   // For spouse / sibling (generation assignment only)
  const spouseOf = {};   // Spouse-only — used to keep couples visually adjacent

  nodes.forEach(n => {
    parentOf[n.id] = new Set();
    childOf[n.id]  = new Set();
    sameGen[n.id]  = new Set();
    spouseOf[n.id] = new Set();
  });

  edges.forEach(e => {
    const type = e.data?.relationship_type?.toLowerCase();
    const { source: src, target: tgt } = e;
    if (!ids.has(src) || !ids.has(tgt)) return;

    if (type === 'parent' || type === 'child') {
      // The backend (treeBuilder.js) already flips 'child' edges so that src=parent, tgt=child.
      // Therefore, both 'parent' and 'child' types mean src IS PARENT of tgt.
      parentOf[src].add(tgt);
      childOf[tgt].add(src);
    } else if (type === 'spouse' || type === 'sibling') {
      sameGen[src].add(tgt);
      sameGen[tgt].add(src);
      if (type === 'spouse') {
        spouseOf[src].add(tgt);
        spouseOf[tgt].add(src);
      }
    }
  });

  return { parentOf, childOf, sameGen, spouseOf };
}

// ══════════════════════════════════════════════════════════════
//  STEP 2 — BFS generation assignment
// ══════════════════════════════════════════════════════════════
function assignGenerations(nodes, childOf, sameGen, parentOf) {
  const genMap = {};
  const visits = {}; // ← Cycle prevention tracker
  nodes.forEach(n => { genMap[n.id] = null; visits[n.id] = 0; });

  // Root = nodes that have no parents
  const hasParent = new Set(
    nodes.filter(n => childOf[n.id].size > 0).map(n => n.id)
  );
  let roots = nodes.map(n => n.id).filter(id => !hasParent.has(id));
  if (roots.length === 0 && nodes.length > 0) roots = [nodes[0].id];

  const queue = roots.map(r => ({ id: r, gen: 0 }));

  while (queue.length > 0) {
    const { id, gen } = queue.shift();

    // Prevent infinite loops from cyclic or conflicting relationships
    if (visits[id] > 50) continue;
    visits[id]++;

    if (genMap[id] !== null) {
      // Resolve conflicts — a node should sit at the DEEPEST level implied
      if (gen > genMap[id]) {
        genMap[id] = gen;
        // Re-propagate ALL neighbours so spouse/sibling nodes follow the correction
        parentOf[id].forEach(cid => queue.push({ id: cid, gen: gen + 1 }));
        sameGen[id].forEach(sid => queue.push({ id: sid, gen }));      // ← spouse/sibling fix
        childOf[id].forEach(pid => queue.push({ id: pid, gen: gen - 1 }));
      }
      continue;
    }

    genMap[id] = gen;
    // Push unconditionally to ensure spouse/sibling nodes dragged from root get the conflict update
    parentOf[id].forEach(cid => queue.push({ id: cid, gen: gen + 1 }));
    sameGen[id].forEach(sid => queue.push({ id: sid, gen }));
    childOf[id].forEach(pid => queue.push({ id: pid, gen: gen - 1 }));
  }

  // Fill disconnected nodes
  nodes.forEach(n => { if (genMap[n.id] === null) genMap[n.id] = 0; });

  // Normalise: min generation → 0
  const minGen = Math.min(...Object.values(genMap));
  nodes.forEach(n => { genMap[n.id] -= minGen; });

  return genMap;
}

// ══════════════════════════════════════════════════════════════
//  STEP 3 — Group nodes by generation
// ══════════════════════════════════════════════════════════════
function groupByGeneration(nodes, genMap) {
  const levels = {};
  nodes.forEach(n => {
    const g = genMap[n.id];
    if (!levels[g]) levels[g] = [];
    levels[g].push(n.id);
  });
  return levels;
}

// ══════════════════════════════════════════════════════════════
//  STEP 4 — Initial equidistant X positions per row
// ══════════════════════════════════════════════════════════════
function initialXPositions(levels) {
  const xPos = {};
  Object.entries(levels).forEach(([, members]) => {
    const half = ((members.length - 1) * H_SPACING) / 2;
    members.forEach((id, i) => {
      xPos[id] = i * H_SPACING - half;
    });
  });
  return xPos;
}

// ══════════════════════════════════════════════════════════════
//  STEP 4b — Pull spouse pairs adjacent within a row
//  The parent-alignment sort alone has no notion of "couple" — a
//  sibling with no shared parent-average can end up wedged between
//  two spouses purely by coincidence. This walks the row left-to-
//  right and, the first time it meets a node with an as-yet-unplaced
//  spouse also in this row, moves that spouse to sit right next to it.
// ══════════════════════════════════════════════════════════════
function groupSpousesAdjacent(order, spouseOf) {
  const inRow = new Set(order);
  const placed = new Set();
  const result = [];
  order.forEach(id => {
    if (placed.has(id)) return;
    result.push(id);
    placed.add(id);
    const partner = [...spouseOf[id]].find(sid => inRow.has(sid) && !placed.has(sid));
    if (partner) {
      result.push(partner);
      placed.add(partner);
    }
  });
  return result;
}

// ══════════════════════════════════════════════════════════════
//  STEP 5 — Collision resolution within a row
//  Pushes overlapping nodes apart, then re-centres the row
// ══════════════════════════════════════════════════════════════
function resolveCollisions(ids, xPos, minGap) {
  if (ids.length <= 1) return;

  // Symmetric relaxation: push overlapping nodes apart equally from their shared midpoint
  for (let pass = 0; pass < 15; pass++) {
    const sorted = [...ids].sort((a, b) => xPos[a] - xPos[b]);
    let moved = false;

    for (let i = 0; i < sorted.length - 1; i++) {
      const left = sorted[i];
      const right = sorted[i + 1];
      const dist = xPos[right] - xPos[left];
      
      if (dist < minGap) {
        const overlap = minGap - dist;
        xPos[left] -= overlap / 2;
        xPos[right] += overlap / 2;
        moved = true;
      }
    }
    
    if (!moved) break;
  }
}

// ══════════════════════════════════════════════════════════════
//  STEP 6 — Iterative centering + collision loop
// ══════════════════════════════════════════════════════════════
function iterativeLayout(levels, xPos, genMap, parentOf, childOf) {
  const maxLevel = Math.max(...Object.keys(levels).map(Number));

  // Run physics relaxation to find equilibrium (spring forces vs collision forces)
  for (let pass = 0; pass < 10; pass++) {
    // ── Top-down: gently pull each child towards the midpoint of its parents
    for (let g = 1; g <= maxLevel; g++) {
      if (!levels[g]) continue;
      levels[g].forEach(id => {
        const parents = [...childOf[id]].filter(pid => xPos[pid] !== undefined);
        if (parents.length > 0) {
          const xs  = parents.map(p => xPos[p]);
          const targetX = (Math.min(...xs) + Math.max(...xs)) / 2;
          // Apply 50% spring force so siblings retain their initial spread
          xPos[id] += (targetX - xPos[id]) * 0.5;
        }
      });
      resolveCollisions(levels[g], xPos, H_SPACING);
    }

    // ── Bottom-up: gently pull parents towards their children's midpoint
    for (let g = maxLevel - 1; g >= 0; g--) {
      if (!levels[g]) continue;
      levels[g].forEach(id => {
        const children = [...parentOf[id]].filter(cid => xPos[cid] !== undefined);
        if (children.length > 0) {
          const xs  = children.map(c => xPos[c]);
          const targetX = (Math.min(...xs) + Math.max(...xs)) / 2;
          // Apply 50% spring force so spouses retain their initial spacing
          xPos[id] += (targetX - xPos[id]) * 0.5;
        }
      });
      resolveCollisions(levels[g], xPos, H_SPACING);
    }
  }
}

// ══════════════════════════════════════════════════════════════
//  MASTER LAYOUT FUNCTION
// ══════════════════════════════════════════════════════════════
function computeLayout(nodes, edges) {
  if (!nodes.length) return { positions: {}, genMap: {} };

  const { parentOf, childOf, sameGen, spouseOf } = buildAdjacency(nodes, edges);
  const genMap  = assignGenerations(nodes, childOf, sameGen, parentOf);
  const levels  = groupByGeneration(nodes, genMap);
  const xPos    = initialXPositions(levels);

  const maxLevel = Math.max(...Object.keys(levels).map(Number));

  // Pre-sort every generation horizontally so children align beautifully with their parents
  // This physically untangles the database-insertion-order spaghetti before physics kicks in!
  for (let g = 1; g <= maxLevel; g++) {
    if (!levels[g]) continue;
    levels[g].sort((a, b) => {
      const pA = [...childOf[a]].map(p => xPos[p] || 0);
      const pB = [...childOf[b]].map(p => xPos[p] || 0);
      const avgA = pA.length ? pA.reduce((s, x) => s + x, 0) / pA.length : 0;
      const avgB = pB.length ? pB.reduce((s, x) => s + x, 0) / pB.length : 0;
      return avgA - avgB;
    });
    // Keep spouse pairs visually adjacent — parent-alignment alone doesn't
    // know about couples, so a sibling can otherwise land between them.
    levels[g] = groupSpousesAdjacent(levels[g], spouseOf);
    // Re-pack cleanly left-to-right using the untangled family order
    const half = ((levels[g].length - 1) * H_SPACING) / 2;
    levels[g].forEach((id, i) => { xPos[id] = i * H_SPACING - half; });
  }

  // Spouses can also appear in generation 0 (the tree's root couple) — the
  // loop above only covers g >= 1, so apply the same adjacency fix there.
  if (levels[0]) {
    levels[0] = groupSpousesAdjacent(levels[0], spouseOf);
    const half = ((levels[0].length - 1) * H_SPACING) / 2;
    levels[0].forEach((id, i) => { xPos[id] = i * H_SPACING - half; });
  }

  iterativeLayout(levels, xPos, genMap, parentOf, childOf);

  // Final overlap scan across all levels
  Object.values(levels).forEach(members => resolveCollisions(members, xPos, H_SPACING));

  const positions = {};
  nodes.forEach(n => {
    positions[n.id] = {
      x: (xPos[n.id] ?? 0) - NODE_W / 2,
      y: (genMap[n.id] ?? 0) * V_SPACING,
    };
  });

  return { positions, genMap };
}

// ══════════════════════════════════════════════════════════════
//  CUSTOM EDGE — hover tooltip
// ══════════════════════════════════════════════════════════════
const REL_LABELS = {
  parent: 'Parent of', child: 'Child of',
  spouse: 'Spouse of', sibling: 'Sibling of',
};

const CustomEdge = memo(({ id, sourceX, sourceY, targetX, targetY, data, style, markerEnd }) => {
  const [hovered, setHovered] = useState(false);
  const type = data?.relationship_type?.toLowerCase();
  const isHoriz = type === 'spouse' || type === 'sibling';
  const [edgePath, labelX, labelY] = isHoriz
    ? getStraightPath({ sourceX, sourceY, targetX, targetY })
    : getBezierPath({ sourceX, sourceY, targetX, targetY });
  const relLabel = REL_LABELS[type] || '';

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      <path d={edgePath} fill="none" stroke="transparent" strokeWidth={18}
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
        style={{ cursor: 'default', pointerEvents: 'stroke' }} />
      {hovered && relLabel && (
        <EdgeLabelRenderer>
          <div style={{ position: 'absolute', transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`, pointerEvents: 'none', zIndex: 1000 }}
            className="bg-black/90 border border-white/15 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-xl whitespace-nowrap">
            {relLabel}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});
CustomEdge.displayName = 'CustomEdge';

// ══════════════════════════════════════════════════════════════
//  NODE SIDE PANEL
// ══════════════════════════════════════════════════════════════
const NodeSidePanel = memo(({ person, onViewProfile, onClose, onAddRelative }) => {
  if (!person) return null;
  const name = `${person.first_name} ${person.last_name || ''}`.trim();
  const birthYear = person.birth_date ? new Date(person.birth_date).getFullYear() : null;

  return (
    <div className="absolute top-4 right-4 z-40 w-72 bg-black/95 backdrop-blur-2xl border border-white/15 rounded-3xl shadow-2xl overflow-hidden"
      style={{ animation: 'slideInRight 0.25s ease' }}>
      <style>{`@keyframes slideInRight { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:none; } }`}</style>
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-rose-500/70 to-transparent" />
      <div className="p-6">
        <div className="flex justify-between items-start mb-5">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border-2 border-rose-500/40 flex items-center justify-center text-rose-400 text-2xl font-black">
              {name[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <h3 className="text-white font-black text-base leading-tight">{name}</h3>
              {person.gender && <p className="text-gray-500 text-xs mt-0.5">{person.gender}</p>}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-white transition-colors">✕</button>
        </div>
        <div className="space-y-1.5 mb-5">
          {birthYear && <div className="flex items-center gap-2 text-xs text-gray-400"><span>🎂</span><span>Born {birthYear}</span></div>}
          {person.birth_place && <div className="flex items-center gap-2 text-xs text-gray-400"><span>📍</span><span>{person.birth_place}</span></div>}
          {person.occupation && <div className="flex items-center gap-2 text-xs text-gray-400"><span>💼</span><span>{person.occupation}</span></div>}
        </div>
        <button onClick={() => onViewProfile(person.id)}
          className="w-full py-2.5 bg-white text-black font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-rose-500 hover:text-white transition-all duration-200 mb-3">
          View Full Profile →
        </button>
        <div className="flex gap-2">
          {[{ label: '+ Parent', type: 'parent' }, { label: '+ Child', type: 'child' }, { label: '+ Spouse', type: 'spouse' }].map(a => (
            <button key={a.type} onClick={() => onAddRelative(person, a.type)}
              className="flex-1 py-2 text-[11px] font-bold rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white transition-all">{a.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
});
NodeSidePanel.displayName = 'NodeSidePanel';

// ══════════════════════════════════════════════════════════════
//  GRAPH CONTROLS
// ══════════════════════════════════════════════════════════════
const GraphControls = memo(({ onZoomIn, onZoomOut, onFitView, onExport, focusMode, onToggleFocus, showPhotos, onTogglePhotos }) => (
  <div className="absolute top-4 left-4 z-30 flex flex-col gap-1.5">
    {[
      { label: '＋', title: 'Zoom In',   fn: onZoomIn },
      { label: '－', title: 'Zoom Out',  fn: onZoomOut },
      { label: '⊡',  title: 'Fit All',  fn: onFitView },
      { label: '📸', title: 'Export PNG', fn: onExport },
    ].map(b => (
      <button key={b.label} onClick={b.fn} title={b.title}
        className="w-9 h-9 flex items-center justify-center bg-black/70 backdrop-blur-md border border-white/15 text-white rounded-xl hover:bg-rose-500/20 hover:border-rose-500/40 transition-all text-sm font-bold shadow-lg">
        {b.label}
      </button>
    ))}
    <button onClick={onToggleFocus} title="Focus Mode"
      className={`w-9 h-9 flex items-center justify-center backdrop-blur-md border rounded-xl transition-all text-xs font-black shadow-lg ${focusMode ? 'bg-rose-500 border-rose-500 text-white' : 'bg-black/70 border-white/15 text-gray-400 hover:bg-rose-500/20'}`}>
      🎯
    </button>
    <button onClick={onTogglePhotos} title="Toggle Photos"
      className={`w-9 h-9 flex items-center justify-center backdrop-blur-md border rounded-xl transition-all text-xs font-black shadow-lg mt-2 ${showPhotos ? 'bg-rose-500 border-rose-500 text-white' : 'bg-black/70 border-white/15 text-gray-400 hover:bg-rose-500/20'}`}>
      🖼️
    </button>
  </div>
));
GraphControls.displayName = 'GraphControls';

// ══════════════════════════════════════════════════════════════
//  GRAPH SEARCH
// ══════════════════════════════════════════════════════════════
const GraphSearch = memo(({ rawNodes, onHighlight }) => {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    if (!q || q.length < 2) return [];
    return rawNodes.filter(n => {
      const p = n.data?.person;
      return p && `${p.first_name} ${p.last_name || ''}`.toLowerCase().includes(q.toLowerCase());
    }).slice(0, 6);
  }, [q, rawNodes]);

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 w-72">
      <div className="flex items-center bg-black/80 backdrop-blur-xl border border-white/15 rounded-2xl px-3 py-2 gap-2 shadow-xl">
        <span className="text-gray-500 text-sm">🔍</span>
        <input value={q} onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)} placeholder="Find person…"
          className="bg-transparent text-white text-sm placeholder-gray-500 outline-none flex-1" />
        {q && <button onClick={() => { setQ(''); setOpen(false); onHighlight(null); }} className="text-gray-600 hover:text-white text-xs">✕</button>}
      </div>
      {open && matches.length > 0 && (
        <div className="mt-1 bg-black/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          {matches.map(n => {
            const p = n.data.person;
            return (
              <button key={n.id}
                onClick={() => { onHighlight(p.id); setOpen(false); setQ(`${p.first_name} ${p.last_name || ''}`.trim()); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 text-left transition-colors">
                <div className="w-7 h-7 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 text-xs font-black flex-shrink-0">
                  {p.first_name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">{p.first_name} {p.last_name || ''}</p>
                  {p.birth_place && <p className="text-gray-600 text-xs">📍 {p.birth_place}</p>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
});
GraphSearch.displayName = 'GraphSearch';

// ══════════════════════════════════════════════════════════════
//  FIT-VIEW AFTER LAYOUT SETTLES
// ══════════════════════════════════════════════════════════════
const LayoutUpdater = ({ nodesCount }) => {
  const { fitView } = useReactFlow();
  const prev = useRef(0);
  useEffect(() => {
    if (nodesCount > 0 && nodesCount !== prev.current) {
      prev.current = nodesCount;
      const t = setTimeout(() => fitView({ duration: 600, padding: 0.18, maxZoom: 1 }), 200);
      return () => clearTimeout(t);
    }
  }, [nodesCount, fitView]);
  return null;
};

// ══════════════════════════════════════════════════════════════
//  QUICK ADD FORM
// ══════════════════════════════════════════════════════════════
const QuickAddForm = ({ source, relType, onConfirm, onClose }) => {
  const [name, setName] = useState('');
  return (
    <Modal maxWidth="max-w-sm" onClose={onClose}>
      <h3 className="text-white font-black text-lg mb-4">
        Add {relType} {relType === 'parent' ? 'of' : relType === 'child' ? 'to' : 'for'} <span className="text-rose-400">{source?.first_name}</span>
      </h3>
      <input autoFocus placeholder="First name…" value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && name.trim()) onConfirm(name.trim()); }}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-rose-500 mb-4" />
      <div className="flex gap-3">
        <button onClick={() => name.trim() && onConfirm(name.trim())}
          className="flex-1 py-2.5 bg-rose-500 text-white font-bold text-sm rounded-xl hover:bg-rose-600 transition-all">Add</button>
        <button onClick={onClose}
          className="py-2.5 px-4 bg-white/5 border border-white/10 text-gray-400 font-bold text-sm rounded-xl hover:bg-white/10">Cancel</button>
      </div>
    </Modal>
  );
};

// ══════════════════════════════════════════════════════════════
//  MAIN INNER GRAPH
// ══════════════════════════════════════════════════════════════
const FamilyTreeInner = ({ nodes: incomingNodes = [], edges: incomingEdges = [], onNodeClick, onAddPerson, onAddRelationship }) => {
  const { fitView, zoomIn, zoomOut, setCenter, getNodes } = useReactFlow();
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState([]);

  // All interaction state — never derived from rfNodes/rfEdges (no infinite loops)
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [hoveredId, setHoveredId]           = useState(null);
  const [focusMode, setFocusMode]           = useState(false);
  const [showPhotos, setShowPhotos]         = useState(true);
  const [searchHL, setSearchHL]             = useState(null);
  const [quickAdd, setQuickAdd]             = useState(null);
  const wrapperRef = useRef(null);
  const genMapRef  = useRef({});
  // Positions a user has manually dragged, keyed by node id — the formatting
  // effect below re-runs on every hover (to update fade/highlight styling),
  // so it must not blindly re-derive position from the static layout or it
  // would snap a just-dragged node back the instant the mouse moves.
  const draggedPositionsRef = useRef({});

  const handleNodeDragStop = useCallback((_, node) => {
    draggedPositionsRef.current[node.id] = node.position;
  }, []);

  // Connection helpers operate on incomingEdges to avoid update loops
  const getConnected = useCallback((nodeId) => {
    const s = new Set([nodeId]);
    incomingEdges.forEach(e => {
      if (e.source === nodeId || e.target === nodeId) { s.add(e.source); s.add(e.target); }
    });
    return s;
  }, [incomingEdges]);

  const getPathIds = useCallback((nodeId) => {
    const s = new Set([nodeId]);
    incomingEdges.forEach(e => {
      const t = e.data?.relationship_type;
      if ((t === 'parent' || t === 'child') && (e.source === nodeId || e.target === nodeId)) {
        s.add(e.source); s.add(e.target);
      }
    });
    return s;
  }, [incomingEdges]);

  // ── 1. Layout Memoization ──────────────────────────────────
  // ONLY runs when underlying data (nodes/edges) changes, NOT on hover!
  const layout = useMemo(() => {
    if (!incomingNodes || incomingNodes.length === 0) {
      return { positions: {}, genMap: {} };
    }
    const result = computeLayout(incomingNodes, incomingEdges);
    genMapRef.current = result.genMap;
    return result;
  }, [incomingNodes, incomingEdges]);

  // ── 2. Node/Edge Formatting Effect ─────────────────────────
  // Runs fast, only updates visual styling without recalculating layout
  useEffect(() => {
    if (!incomingNodes || incomingNodes.length === 0) {
      setRfNodes([]); setRfEdges([]); return;
    }

    const { positions, genMap } = layout;

    const focusConn = focusMode && selectedPerson ? getConnected(selectedPerson.id) : null;
    const pathIds   = selectedPerson ? getPathIds(selectedPerson.id) : null;
    const hoverConn = hoveredId ? getConnected(hoveredId) : null;

    const formatted = incomingNodes.map(node => {
      const pid        = node.data?.person?.id || node.id;
      const isSelected = selectedPerson?.id === pid;
      const isPath     = !isSelected && !!pathIds?.has(pid) && !!selectedPerson;
      const isFaded    = (!!focusConn && !focusConn.has(pid)) ||
                         (!!hoverConn && !hoverConn.has(pid) && !isSelected);

      return {
        ...node,
        type: 'personNode',
        position: draggedPositionsRef.current[node.id] || positions[node.id] || { x: 0, y: 0 },
        data: {
          ...node.data,
          generation:    genMap[node.id] ?? 0,
          isSelected,
          isHighlighted: !isSelected && (isPath || searchHL === pid),
          isFaded,
          showPhotos,
          onSelect:      (person) => setSelectedPerson(prev => prev?.id === person.id ? null : person),
          onAddRelative: (person, relType) => setQuickAdd({ source: person, relType }),
        },
      };
    });

    const formattedEdges = incomingEdges.map(edge => {
      const type = edge.data?.relationship_type?.toLowerCase();
      const isHoriz = type === 'spouse' || type === 'sibling';
      const isPath  = !!(pathIds?.has(edge.source) && pathIds?.has(edge.target));
      const dimmed  = (!!focusConn && !(focusConn.has(edge.source) && focusConn.has(edge.target))) ||
                      (!!hoverConn && !(hoverConn.has(edge.source) && hoverConn.has(edge.target)));

      return {
        ...edge,
        type: 'customEdge',
        animated: !isHoriz && !isPath,
        style: {
          stroke: isPath ? '#f43f5e' : isHoriz ? '#f43f5e' : '#374151',
          strokeWidth: isPath ? 2.5 : 1.5,
          strokeDasharray: isHoriz ? '6,4' : '0',
          opacity: dimmed ? 0.06 : 1,
          transition: 'stroke 0.3s, opacity 0.3s',
        },
        markerEnd: isHoriz ? undefined : {
          type: MarkerType.ArrowClosed,
          width: 10, height: 10,
          color: isPath ? '#f43f5e' : '#374151',
        },
      };
    });

    setRfNodes(formatted);
    setRfEdges(formattedEdges);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingNodes, incomingEdges, layout, selectedPerson, hoveredId, focusMode, searchHL, showPhotos]);

  // ── Search + centre-on-match ──
  const handleSearchHL = useCallback((personId) => {
    setSearchHL(personId);
    if (!personId) return;
    const node = incomingNodes.find(n => n.data?.person?.id === personId);
    if (node) {
      // Use the memoized positions
      const pos = layout.positions[node.id];
      if (pos) setCenter(pos.x + NODE_W / 2, pos.y + NODE_H / 2, { zoom: 1.2, duration: 700 });
    }
  }, [incomingNodes, layout, setCenter]);

  const handleExport = useCallback(() => {
    const nodesBounds = getNodesBounds(getNodes());
    const imageWidth = nodesBounds.width + 200;
    const imageHeight = nodesBounds.height + 200;
    const viewport = getViewportForBounds(nodesBounds, imageWidth, imageHeight, 0.1, 2);

    const viewportEl = document.querySelector('.react-flow__viewport');
    if (!viewportEl) return;

    // Apply the computed perfect-fit viewport before capturing
    toPng(viewportEl, {
      backgroundColor: '#050505',
      width: imageWidth,
      height: imageHeight,
      style: {
        width: imageWidth,
        height: imageHeight,
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
      },
      filter: (node) => {
        // Exclude UI controls from the image
        if (node?.classList?.contains('react-flow__panel') || node?.classList?.contains('react-flow__controls')) return false;
        return true;
      }
    })
      .then(url => {
        const a = document.createElement('a');
        a.download = 'Kutumb-Lineage.png';
        a.href = url;
        a.click();
      })
      .catch(console.error);
  }, [getNodes]);

  const handleQuickAddConfirm = useCallback(async (firstName) => {
    if (!quickAdd) return;
    const { source, relType } = quickAdd;
    setQuickAdd(null);
    try {
      const newPerson = await onAddPerson?.({ first_name: firstName });
      if (newPerson?.id) await onAddRelationship?.({ person1_id: source.id, person2_id: newPerson.id, relationship_type: relType });
    } catch (e) { console.error('QuickAdd error:', e); }
  }, [quickAdd, onAddPerson, onAddRelationship]);

  const nodeTypes = useMemo(() => ({ personNode: PersonNode }), []);
  const edgeTypes = useMemo(() => ({ customEdge: CustomEdge }), []);

  return (
    <div className="relative w-full h-full border border-white/10 rounded-2xl bg-black/70 backdrop-blur-xl overflow-hidden" ref={wrapperRef}>

      <GraphControls
        onZoomIn={() => zoomIn({ duration: 300 })}
        onZoomOut={() => zoomOut({ duration: 300 })}
        onFitView={() => fitView({ duration: 500, padding: 0.2 })}
        onExport={handleExport}
        focusMode={focusMode}
        onToggleFocus={() => setFocusMode(f => !f)}
        showPhotos={showPhotos}
        onTogglePhotos={() => setShowPhotos(p => !p)}
      />

      {selectedPerson && (
        <NodeSidePanel
          person={selectedPerson}
          onViewProfile={(id) => { if (onNodeClick) onNodeClick(id); }}
          onClose={() => setSelectedPerson(null)}
          onAddRelative={(person, type) => setQuickAdd({ source: person, relType: type })}
        />
      )}

      {focusMode && !selectedPerson && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold px-3 py-1.5 rounded-full pointer-events-none">
          🎯 Focus Mode — click a node to isolate
        </div>
      )}

      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeMouseEnter={(_, node) => setHoveredId(node.data?.person?.id || node.id)}
        onNodeMouseLeave={() => setHoveredId(null)}
        onNodeDragStop={handleNodeDragStop}
        fitView
        fitViewOptions={{ padding: 0.18, maxZoom: 1 }}
        nodesDraggable
        zoomOnScroll
        panOnDrag
        minZoom={0.04}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
      >
        <LayoutUpdater nodesCount={rfNodes.length} />
        <MiniMap
          nodeColor={n => {
            const gen = genMapRef.current?.[n.id] ?? 0;
            return ['#7c3aed','#3b82f6','#f43f5e','#f59e0b','#10b981','#06b6d4'][gen % 6];
          }}
          maskColor="rgba(0,0,0,0.75)"
          className="!bg-black/80 !border !border-white/10 !rounded-xl"
          style={{ right: 16, bottom: 60 }}
        />
        <Background color="#f43f5e" gap={24} size={1} className="opacity-[0.05]" />
      </ReactFlow>

      <GraphSearch rawNodes={incomingNodes} onHighlight={handleSearchHL} />

      {quickAdd && (
        <QuickAddForm
          source={quickAdd.source}
          relType={quickAdd.relType}
          onConfirm={handleQuickAddConfirm}
          onClose={() => setQuickAdd(null)}
        />
      )}
    </div>
  );
};

const FamilyTree = (props) => (
  <ReactFlowProvider>
    <FamilyTreeInner {...props} />
  </ReactFlowProvider>
);

// Exported for direct unit testing of the layout algorithm without needing
// to render ReactFlow at all — see src/tests/familyTreeLayout.test.js
export { computeLayout };
export default FamilyTree;
