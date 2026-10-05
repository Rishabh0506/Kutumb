import React from 'react';
import { Avatar } from './Avatar';

const resolveRole = (type, isPerson1) => {
  if (type === 'spouse') return 'Spouse';
  if (type === 'sibling') return 'Sibling';
  if (type === 'parent') return isPerson1 ? 'Child' : 'Parent';
  if (type === 'child') return isPerson1 ? 'Parent' : 'Child';
  return type;
};

const ROLE_META = {
  Parent: { icon: '👴', color: 'border-blue-500/20 bg-blue-500/5 hover:border-blue-500/40' },
  Child:  { icon: '👶', color: 'border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40' },
  Spouse: { icon: '💍', color: 'border-rose-500/20 bg-rose-500/5 hover:border-rose-500/40' },
  Sibling:{ icon: '🤝', color: 'border-amber-500/20 bg-amber-500/5 hover:border-amber-500/40' },
};

const FamilyMemberCard = ({ person: other, role, onNavigate, onEdit, onDelete, relId, relType }) => {
  const meta = ROLE_META[role] || { icon: '🔗', color: 'border-white/10 bg-white/5' };
  return (
    <div
      onClick={() => onNavigate(other.id)}
      className={`group relative flex flex-col items-center gap-2 p-4 border rounded-2xl cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)] ${meta.color}`}
    >
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
        <button onClick={e => { e.stopPropagation(); onEdit(relId, relType); }} className="p-1 rounded-md bg-black/70 text-gray-400 hover:text-white text-[10px]">✏️</button>
        <button onClick={e => { e.stopPropagation(); onDelete(relId); }} className="p-1 rounded-md bg-black/70 text-gray-400 hover:text-rose-500 text-[10px]">🗑️</button>
      </div>
      <div className="text-2xl">{meta.icon}</div>
      <Avatar name={other?.first_name || '?'} photoUrl={other?.photo_url} size="sm" />
      <div className="text-center">
        <p className="text-white font-semibold text-xs truncate max-w-[90px]">{other ? `${other.first_name} ${other.last_name || ''}`.trim() : '…'}</p>
        <p className="text-gray-500 text-[10px] uppercase tracking-widest mt-0.5">{role}</p>
      </div>
    </div>
  );
};

const FamilySection = ({ relationships, currentId, relPersons, onNavigate, onEdit, onDelete }) => {
  const groups = { Parent: [], Child: [], Spouse: [], Sibling: [] };
  relationships.forEach(rel => {
    const isPerson1 = rel.person1_id === currentId;
    const otherId = isPerson1 ? rel.person2_id : rel.person1_id;
    const other = relPersons[otherId];
    const role = resolveRole(rel.relationship_type, isPerson1);
    if (groups[role] && other) groups[role].push({ other, rel });
  });
  const hasAny = Object.values(groups).some(g => g.length > 0);
  if (!hasAny) return (
    <div className="text-center py-8">
      <p className="text-5xl mb-3">👨‍👩‍👧‍👦</p>
      <p className="text-gray-500 text-sm">No family members linked yet.</p>
      <p className="text-gray-600 text-xs mt-1">Go to the workspace to add relationships.</p>
    </div>
  );
  return (
    <div className="space-y-5">
      {Object.entries(groups).filter(([, arr]) => arr.length > 0).map(([role, arr]) => (
        <div key={role}>
          <p className="text-[10px] uppercase tracking-widest font-bold text-gray-600 mb-2">{role}s</p>
          <div className="flex flex-wrap gap-3">
            {arr.map(({ other, rel }) => (
              <FamilyMemberCard key={rel.id} person={other} role={role}
                relId={rel.id} relType={rel.relationship_type}
                onNavigate={onNavigate} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default FamilySection;
