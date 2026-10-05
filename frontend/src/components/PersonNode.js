import React, { useState, memo } from 'react';
import { Handle, Position } from 'reactflow';

// Generation-based color palettes
const GEN_COLORS = [
  { bar: 'from-violet-500 to-purple-600',  ring: '#7c3aed', badge: 'bg-violet-500/20 text-violet-300 border-violet-500/30' },
  { bar: 'from-blue-500 to-indigo-600',    ring: '#3b82f6', badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  { bar: 'from-rose-500 to-pink-600',      ring: '#f43f5e', badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
  { bar: 'from-amber-500 to-orange-500',   ring: '#f59e0b', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  { bar: 'from-emerald-500 to-teal-500',   ring: '#10b981', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  { bar: 'from-cyan-500 to-sky-500',       ring: '#06b6d4', badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
];

const genderAvatar = (gender) =>
  gender?.toLowerCase() === 'female' ? 'bg-gradient-to-br from-pink-400 to-rose-500'
  : gender?.toLowerCase() === 'male'  ? 'bg-gradient-to-br from-blue-400 to-indigo-500'
  : 'bg-gradient-to-br from-emerald-400 to-teal-500';

const PersonNode = memo(({ data }) => {
  const {
    person = {},
    generation = 0,
    isSelected = false,
    isFaded = false,
    isHighlighted = false,  // path-highlighted
    showPhotos = true,
    onSelect,
    onAddRelative,
  } = data;

  const [hovered, setHovered] = useState(false);

  const { first_name, last_name, gender, birth_date, death_date, photo_url, occupation, birth_place } = person;

  const birthYear = birth_date ? new Date(birth_date).getFullYear() : null;
  const deathYear = death_date ? new Date(death_date).getFullYear() : null;
  const lifespan  = deathYear ? `${birthYear ?? '?'} – ${deathYear}` : birthYear ? `b. ${birthYear}` : null;

  const genIdx   = Math.abs(generation) % GEN_COLORS.length;
  const genColor = GEN_COLORS[genIdx];
  const avatarCls = genderAvatar(gender);

  // Visual state precedence: selected > highlighted > normal > faded
  let containerCls = '';
  let glowStyle    = {};
  if (isSelected) {
    containerCls = 'border-2 scale-105 z-50';
    glowStyle    = { borderColor: genColor.ring, boxShadow: `0 0 0 3px ${genColor.ring}40, 0 0 30px ${genColor.ring}60` };
  } else if (isHighlighted) {
    containerCls = 'border-2';
    glowStyle    = { borderColor: genColor.ring, boxShadow: `0 0 20px ${genColor.ring}50` };
  } else if (isFaded) {
    containerCls = 'border border-white/5 opacity-25 scale-95';
  } else if (hovered) {
    containerCls = 'border border-white/40 scale-[1.02]';
    glowStyle    = { boxShadow: `0 0 25px ${genColor.ring}40, 0 10px 30px rgba(0,0,0,0.5)` };
  } else {
    containerCls = 'border border-white/10 hover:border-white/30';
    glowStyle    = { boxShadow: `0 0 40px ${genColor.ring}15` };
  }

  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setMounted(true), 450);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className={`group relative flex flex-col items-center bg-black/85 backdrop-blur-xl rounded-2xl p-5 w-56 text-center transition-all duration-300 overflow-visible cursor-pointer ${containerCls}`}
      style={{ ...glowStyle, animation: mounted ? 'none' : 'nodeIn 0.4s ease both' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onSelect?.(person)}
    >
      <style>{`
        @keyframes nodeIn { from { opacity:0; transform:scale(0.85); } to { opacity:1; transform:scale(1); } }
      `}</style>

      {/* Generation color bar */}
      <div className={`absolute top-0 left-0 w-full h-1.5 rounded-t-2xl bg-gradient-to-r ${genColor.bar}`} />

      <Handle type="target" position={Position.Top}    className="!w-2.5 !h-2.5 !border-2 !border-white/30 !bg-black" />
      <Handle type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !border-2 !border-white/30 !bg-black" />

      {/* Avatar */}
      <div className={`w-14 h-14 rounded-2xl mb-3 flex items-center justify-center text-xl font-black text-white border-2 border-white/20 shadow-[0_4px_14px_rgba(0,0,0,0.6)] overflow-hidden ${!(photo_url && showPhotos) ? avatarCls : 'bg-black/50'}`}>
        {photo_url && showPhotos ? (
          <img src={photo_url} alt={`${first_name} avatar`} className="w-full h-full object-cover" loading="lazy" decoding="async" />
        ) : (
          first_name?.[0]?.toUpperCase() || '?'
        )}
      </div>

      {/* Name */}
      <div className="font-extrabold text-white text-[15px] tracking-tight leading-tight">
        {first_name} <span className="text-gray-400 font-medium">{last_name}</span>
      </div>

      {/* Lifespan */}
      {lifespan && (
        <div className="text-[10px] text-gray-500 font-mono uppercase tracking-widest mt-1">{lifespan}</div>
      )}

      {/* Meta chips */}
      <div className="flex flex-wrap justify-center gap-1 mt-2">
        {gender && (
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${genColor.badge}`}>
            {gender}
          </span>
        )}
        {occupation && (
          <span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-400 truncate max-w-[100px]">
            💼 {occupation}
          </span>
        )}
        {birth_place && (
          <span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-400 truncate max-w-[100px]">
            📍 {birth_place}
          </span>
        )}
      </div>

      {/* Hover: action buttons */}
      {(hovered || isSelected) && onAddRelative && (
        <div
          className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex gap-1 z-50"
          style={{ animation: 'nodeIn 0.2s ease both' }}
          onClick={e => e.stopPropagation()}
        >
          {[
            { label: '+ Parent', type: 'parent', color: 'bg-blue-500/20 border-blue-500/40 text-blue-300 hover:bg-blue-500' },
            { label: '+ Child',  type: 'child',  color: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500' },
            { label: '+ Spouse', type: 'spouse', color: 'bg-rose-500/20 border-rose-500/40 text-rose-300 hover:bg-rose-500' },
          ].map(a => (
            <button
              key={a.type}
              onClick={() => onAddRelative?.(person, a.type)}
              className={`text-[9px] font-bold px-2 py-1 rounded-lg border transition-all duration-150 hover:text-white whitespace-nowrap ${a.color}`}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}

      {/* Hover: quick tooltip */}
      {hovered && !isSelected && (
        <div
          className="absolute -top-9 left-1/2 -translate-x-1/2 bg-black/90 border border-white/10 rounded-xl px-3 py-1.5 z-50 whitespace-nowrap pointer-events-none"
          style={{ animation: 'nodeIn 0.15s ease both' }}
        >
          <p className="text-white text-[11px] font-bold">{first_name} {last_name}</p>
          {birthYear && <p className="text-gray-500 text-[9px]">Born {birthYear}{birth_place ? ` · ${birth_place}` : ''}</p>}
        </div>
      )}
    </div>
  );
});

PersonNode.displayName = 'PersonNode';
export default PersonNode;
