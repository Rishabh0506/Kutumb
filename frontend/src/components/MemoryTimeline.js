import React, { useEffect, useRef } from 'react';

const TAG_COLORS = {
  Childhood: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  Career: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  Family: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  Education: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
};

// ── Animated entry card ──────────────────────────────
const TimelineCard = ({ mem, index }) => {
  const ref = useRef();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.style.opacity = 1; el.style.transform = 'translateY(0)'; } },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="relative pl-10 pb-10 last:pb-0"
      style={{ opacity: 0, transform: 'translateY(20px)', transition: `opacity 0.5s ease ${index * 0.08}s, transform 0.5s ease ${index * 0.08}s` }}
    >
      <div className="absolute left-3 top-0 bottom-0 w-px bg-gradient-to-b from-rose-500/60 via-white/10 to-transparent" />
      <div className="absolute left-0 top-1 w-7 h-7 rounded-full bg-black border-2 border-rose-500 flex items-center justify-center text-sm shadow-[0_0_12px_rgba(225,29,72,0.5)]">
        {mem.emotion || '📌'}
      </div>
      <div className="group bg-white/5 hover:bg-white/[0.08] border border-white/10 hover:border-rose-500/30 rounded-2xl p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
        <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
          <h3 className="text-white font-bold text-base">{mem.title}</h3>
          {mem.event_date && (
            <time className="text-xs text-gray-500 font-medium tracking-widest uppercase flex-shrink-0">
              {new Date(mem.event_date).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
            </time>
          )}
        </div>
        {Array.isArray(mem.tags) && mem.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {mem.tags.map(tag => (
              <span key={tag} className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${TAG_COLORS[tag] || 'bg-white/10 text-white/60 border-white/20'}`}>{tag}</span>
            ))}
          </div>
        )}
        {mem.description && <p className="text-gray-400 text-sm leading-relaxed">{mem.description}</p>}
        {mem.media_url && <img src={mem.media_url} alt={mem.title} className="mt-3 rounded-xl max-w-sm w-full object-cover border border-white/10" />}
        {mem.people_involved && <p className="mt-2 text-xs text-gray-500">👥 {mem.people_involved}</p>}
      </div>
    </div>
  );
};

// ── Smart empty state with placeholder events ────────
const SmartEmptyState = ({ name, onAddClick }) => {
  const placeholders = [
    { icon: '📍', text: `Born${name ? ` — ${name}'s story begins` : ''}`, ghost: true },
    { icon: '🎓', text: 'Education years', ghost: true },
    { icon: '💼', text: 'Career highlights', ghost: true },
  ];
  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <p className="text-gray-500 text-sm">
          {name ? `${name}'s` : 'This'} life story hasn't been written yet.
        </p>
        <p className="text-gray-600 text-xs mt-1">Add the first memory to bring this timeline to life.</p>
      </div>
      {placeholders.map((p, i) => (
        <div
          key={i}
          className="relative pl-10 pb-6 last:pb-0"
          style={{ animation: `fadeInUp 0.4s ease ${i * 0.1}s both`, opacity: 0.4 }}
        >
          <div className="absolute left-3 top-0 bottom-0 w-px bg-gradient-to-b from-white/10 to-transparent" />
          <div className="absolute left-0 top-1 w-7 h-7 rounded-full bg-black border border-white/10 flex items-center justify-center text-sm">{p.icon}</div>
          <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 border-dashed">
            <p className="text-gray-600 text-sm italic">{p.text}</p>
          </div>
        </div>
      ))}
      <div className="text-center pt-4">
        <button
          onClick={onAddClick}
          className="px-5 py-2.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-sm font-bold hover:bg-rose-500 hover:text-white transition-all duration-300 hover:shadow-[0_0_20px_rgba(225,29,72,0.3)]"
        >
          + Add First Life Event
        </button>
      </div>
    </div>
  );
};

const MemoryTimeline = ({ memories = [], personName, onAddClick }) => {
  if (!memories.length) {
    return (
      <>
        <style>{`@keyframes fadeInUp { from { opacity:0; transform:translateY(12px); } to { opacity:0.4; transform:translateY(0); } }`}</style>
        <SmartEmptyState name={personName} onAddClick={onAddClick} />
      </>
    );
  }

  const sorted = [...memories].sort((a, b) => {
    if (!a.event_date) return 1;
    if (!b.event_date) return -1;
    return new Date(a.event_date) - new Date(b.event_date);
  });

  return (
    <div className="relative">
      {sorted.map((mem, i) => <TimelineCard key={mem.id || i} mem={mem} index={i} />)}
    </div>
  );
};

export default MemoryTimeline;
