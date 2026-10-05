import React, { useEffect, useRef } from 'react';

const ACTION_ICONS = {
  added_person: '👤',
  added_relationship: '🔗',
  imported_gedcom: '📂',
  deleted_person: '🗑️',
  deleted_relationship: '✂️',
  viewed_profile: '👁️',
  default: '⚡',
};

const timeAgo = (ts) => {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const ActivityItem = ({ item, index }) => {
  const ref = useRef();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // slide-in from right
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
    requestAnimationFrame(() => {
      el.style.transition = `opacity 0.35s ease ${index * 0.04}s, transform 0.35s ease ${index * 0.04}s`;
      el.style.opacity = '1';
      el.style.transform = 'translateX(0)';
    });
  }, [index]);

  const icon = ACTION_ICONS[item.type] || ACTION_ICONS.default;

  return (
    <div ref={ref} className="flex items-start gap-3 group">
      <div className="w-7 h-7 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-sm flex-shrink-0 group-hover:border-rose-500/30 transition-all">
        {icon}
      </div>
      <div className="flex-1 min-w-0 border-b border-white/5 pb-3">
        <p className="text-white text-sm font-medium leading-snug">{item.message}</p>
        <p className="text-gray-600 text-[10px] mt-0.5 font-mono">{timeAgo(item.timestamp)}</p>
      </div>
    </div>
  );
};

/**
 * ActivityFeed — receives an `activities` array and optional `onClear` callback.
 * Parent manages the feed; this component just renders it.
 */
const ActivityFeed = ({ activities = [], onClear }) => {
  const bottomRef = useRef();

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activities.length]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs text-gray-500 uppercase tracking-widest font-bold">Live Feed</span>
        </div>
        {activities.length > 0 && onClear && (
          <button
            onClick={onClear}
            className="text-[10px] text-gray-600 hover:text-rose-400 transition-colors uppercase tracking-widest"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-4xl mb-3 opacity-30">🌱</div>
            <p className="text-gray-500 text-sm font-medium">No activity yet</p>
            <p className="text-gray-700 text-xs mt-1">Start building your tree to see actions here</p>
          </div>
        ) : (
          activities.slice().reverse().map((item, i) => (
            <ActivityItem key={item.id} item={item} index={i} />
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default ActivityFeed;
