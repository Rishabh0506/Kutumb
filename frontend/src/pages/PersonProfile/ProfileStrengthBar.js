import React from 'react';

const ProfileStrengthBar = ({ person, memories, relationships }) => {
  const checks = [
    { label: 'Photo', done: !!person?.photo_url },
    { label: 'Bio', done: !!person?.bio },
    { label: 'Birth date', done: !!person?.birth_date },
    { label: 'Origin', done: !!person?.birth_place },
    { label: 'Occupation', done: !!person?.occupation },
    { label: '1 Memory', done: memories.length > 0 },
    { label: '3+ Memories', done: memories.length >= 3 },
    { label: 'Family linked', done: relationships.length > 0 },
  ];
  const pct = Math.round((checks.filter(c => c.done).length / checks.length) * 100);
  const missing = checks.filter(c => !c.done).map(c => c.label);
  const barColor = pct < 40 ? '#f43f5e' : pct < 70 ? '#f59e0b' : '#10b981';
  return (
    <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-5 shadow-xl">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">📊 Profile Strength</h3>
        <span className="text-lg font-black" style={{ color: barColor }}>{pct}%</span>
      </div>
      <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden mb-3">
        <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${pct}%`, backgroundColor: barColor }} />
      </div>
      {missing.length > 0 && (
        <p className="text-gray-600 text-xs">💡 Add {missing.slice(0, 2).join(', ')} to strengthen this profile</p>
      )}
    </div>
  );
};

export default ProfileStrengthBar;
