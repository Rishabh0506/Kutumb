import React from 'react';

// FEATURE 7: MINI TREE PREVIEW (SVG-based, no lib needed)
const MiniTreePreview = ({ person, relationships, relPersons, onNodeClick }) => {
  const id = person?.id;
  if (!id) return null;

  const parents = relationships
    .filter(r => {
      const t = r.relationship_type;
      return (t === 'parent' && r.person2_id === id) || (t === 'child' && r.person1_id === id);
    })
    .map(r => {
      const pid = r.person1_id === id ? r.person2_id : r.person1_id;
      return { id: pid, ...relPersons[pid] };
    }).slice(0, 3);

  const children = relationships
    .filter(r => {
      const t = r.relationship_type;
      return (t === 'child' && r.person2_id === id) || (t === 'parent' && r.person1_id === id);
    })
    .map(r => {
      const cid = r.person1_id === id ? r.person2_id : r.person1_id;
      return { id: cid, ...relPersons[cid] };
    }).slice(0, 3);

  const spouses = relationships
    .filter(r => r.relationship_type === 'spouse')
    .map(r => {
      const sid = r.person1_id === id ? r.person2_id : r.person1_id;
      return { id: sid, ...relPersons[sid] };
    }).slice(0, 2);

  const NodeCircle = ({ p, x, y, isCenter = false }) => {
    const name = p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : '?';
    const initial = name[0]?.toUpperCase() || '?';
    return (
      <g
        onClick={() => p?.id && p.id !== id && onNodeClick(p.id)}
        style={{ cursor: p?.id && p.id !== id ? 'pointer' : 'default' }}
      >
        <circle cx={x} cy={y} r={isCenter ? 28 : 22}
          fill={isCenter ? 'rgba(225,29,72,0.2)' : 'rgba(255,255,255,0.05)'}
          stroke={isCenter ? '#f43f5e' : 'rgba(255,255,255,0.15)'}
          strokeWidth={isCenter ? 2.5 : 1.5}
        />
        {isCenter && (
          <circle cx={x} cy={y} r={34} fill="none" stroke="rgba(225,29,72,0.15)" strokeWidth={1} strokeDasharray="4 3" />
        )}
        <text x={x} y={y + 5} textAnchor="middle" fontSize={isCenter ? 14 : 11}
          fill={isCenter ? '#f43f5e' : '#9ca3af'} fontWeight="bold" fontFamily="sans-serif">
          {initial}
        </text>
        {name.length > 1 && (
          <text x={x} y={y + (isCenter ? 50 : 40)} textAnchor="middle" fontSize="9"
            fill="#6b7280" fontFamily="sans-serif">
            {name.length > 12 ? name.substring(0, 12) + '…' : name}
          </text>
        )}
      </g>
    );
  };

  const W = 460, H = 260;
  const cx = W / 2, cy = H / 2;
  const parentY = 45, childY = 215;

  // Positions for up to 3 parents and 3 children
  const spread = (count, y) => Array.from({ length: count }, (_, i) => ({
    x: cx + (i - (count - 1) / 2) * 130,
    y,
  }));

  const parentPos = spread(parents.length, parentY);
  const childPos = spread(children.length, childY);
  const spousePos = [{ x: cx + 140, y: cy }, { x: cx - 140, y: cy }];

  return (
    <div className="w-full overflow-x-auto">
      <svg
        width="100%" viewBox={`0 0 ${W} ${H}`}
        className="rounded-2xl bg-black/30 border border-white/10"
        style={{ minWidth: 300 }}
      >
        {/* Lines to parents */}
        {parentPos.map((p, i) => (
          <line key={`pl-${i}`} x1={cx} y1={cy - 28} x2={p.x} y2={p.y + 22}
            stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeDasharray="4 3" />
        ))}
        {/* Lines to children */}
        {childPos.map((c, i) => (
          <line key={`cl-${i}`} x1={cx} y1={cy + 28} x2={c.x} y2={c.y - 22}
            stroke="#6b7280" strokeWidth="1.5" />
        ))}
        {/* Lines to spouses */}
        {spouses.map((_, i) => (
          <line key={`sl-${i}`} x1={cx + (i === 0 ? 28 : -28)} y1={cy} x2={spousePos[i].x + (i === 0 ? -22 : 22)} y2={spousePos[i].y}
            stroke="#f43f5e" strokeWidth="1" strokeDasharray="5 3" />
        ))}

        {/* Parent nodes */}
        {parents.map((p, i) => (
          <NodeCircle key={`p-${i}`} p={p} x={parentPos[i].x} y={parentPos[i].y} />
        ))}
        {/* Children nodes */}
        {children.map((c, i) => (
          <NodeCircle key={`c-${i}`} p={c} x={childPos[i].x} y={childPos[i].y} />
        ))}
        {/* Spouse nodes */}
        {spouses.map((s, i) => (
          <NodeCircle key={`s-${i}`} p={s} x={spousePos[i].x} y={spousePos[i].y} />
        ))}

        {/* Center (current person) */}
        <NodeCircle p={person} x={cx} y={cy} isCenter />

        {/* Labels */}
        {parents.length > 0 && (
          <text x={10} y={18} fontSize="8" fill="rgba(255,255,255,0.2)" fontFamily="sans-serif" fontWeight="bold" textDecoration="uppercase">PARENTS</text>
        )}
        {children.length > 0 && (
          <text x={10} y={H - 6} fontSize="8" fill="rgba(255,255,255,0.2)" fontFamily="sans-serif" fontWeight="bold">CHILDREN</text>
        )}
      </svg>
    </div>
  );
};

export default MiniTreePreview;
