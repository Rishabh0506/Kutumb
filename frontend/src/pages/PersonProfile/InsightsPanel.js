import React from 'react';
import { calcAge } from './utils';
import { useCountUp } from './useCountUp';

const StatCard = ({ icon, label, numericVal, displayVal, color, tooltip }) => {
  const counted = useCountUp(numericVal);
  return (
    <div className="relative group bg-white/5 hover:bg-white/[0.08] border border-white/10 hover:border-rose-500/20 rounded-2xl p-4 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)] cursor-default">
      <div className="text-2xl mb-1 group-hover:scale-110 transition-transform duration-300">{icon}</div>
      <div className={`text-2xl font-black ${color}`}>
        {numericVal !== null ? (typeof numericVal === 'number' ? counted : displayVal) : displayVal}
      </div>
      <div className="text-xs text-gray-500 uppercase tracking-widest mt-0.5">{label}</div>
      {tooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-36 px-2 py-1.5 bg-black border border-white/10 text-gray-300 text-[10px] rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-20 text-center">
          {tooltip}
        </div>
      )}
    </div>
  );
};

const InsightsPanel = ({ memories, relationships, person }) => {
  const age = calcAge(person?.birth_date, person?.death_date);
  const stats = [
    { icon: '📖', label: 'Memories', numericVal: memories.length, displayVal: memories.length, color: 'text-blue-400', tooltip: 'Total recorded life memories' },
    { icon: '🔗', label: 'Connections', numericVal: relationships.length, displayVal: relationships.length, color: 'text-rose-400', tooltip: 'Linked family members' },
    { icon: '⏳', label: person?.death_date ? 'Lived' : 'Age', numericVal: age, displayVal: age !== null ? `${age} yrs` : '—', color: 'text-amber-400', tooltip: 'Calculated from date of birth' },
    { icon: '📅', label: 'Decade', numericVal: null, displayVal: person?.birth_date ? `${Math.floor(new Date(person.birth_date).getFullYear() / 10) * 10}s` : '—', color: 'text-emerald-400', tooltip: 'Birth era / decade' },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map(s => <StatCard key={s.label} {...s} />)}
    </div>
  );
};

export default InsightsPanel;
