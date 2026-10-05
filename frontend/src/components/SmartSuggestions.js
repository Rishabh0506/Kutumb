import React, { useMemo, useState } from 'react';

/**
 * SmartSuggestions
 * Analyzes current treeData and generates contextual, dismissable suggestions.
 * Props:
 *   nodes   – ReactFlow nodes (each has data.person)
 *   edges   – ReactFlow edges (each has data.relationship_type)
 *   onAction – optional callback(actionType, payload)
 */
const SmartSuggestions = ({ nodes = [], edges = [], onAction }) => {
  const [dismissed, setDismissed] = useState([]);

  const persons = nodes.filter(n => n.data?.person).map(n => n.data.person);

  const suggestions = useMemo(() => {
    const list = [];

    if (persons.length === 0) {
      list.push({ id: 'empty_tree', icon: '🌱', message: 'Your tree is empty — add the first family member to begin.', action: 'add_member', actionLabel: '+ Add Member' });
      return list;
    }

    // Build relationship maps
    const hasParent = new Set();
    const hasChild = new Set();
    const hasSpouse = new Set();
    edges.forEach(e => {
      const t = e.data?.relationship_type;
      if (t === 'parent') { hasChild.add(e.source); hasParent.add(e.target); }
      if (t === 'child')  { hasParent.add(e.source); hasChild.add(e.target); }
      if (t === 'spouse') { hasSpouse.add(e.source); hasSpouse.add(e.target); }
    });

    // Missing birth dates
    const noBirth = persons.filter(p => !p.birth_date);
    if (noBirth.length > 0) {
      list.push({
        id: 'no_birth_date',
        icon: '🎂',
        message: `${noBirth.length} member${noBirth.length > 1 ? 's' : ''} ${noBirth.length > 1 ? 'have' : 'has'} no birth date — add dates for better timeline insights.`,
        action: null,
      });
    }

    // Children without two parents
    persons.forEach(p => {
      if (hasChild.has(p.id)) {
        const parentEdges = edges.filter(e =>
          (e.data?.relationship_type === 'parent' && e.target === p.id) ||
          (e.data?.relationship_type === 'child' && e.source === p.id)
        );
        if (parentEdges.length < 2) {
          list.push({
            id: `missing_parent_${p.id}`,
            icon: '👪',
            message: `"${p.first_name} ${p.last_name || ''}" has only one parent linked — consider adding the second parent.`,
            action: null,
          });
        }
      }
    });

    // People with no relationships at all
    const noRels = persons.filter(p => {
      return !edges.some(e => e.source === p.id || e.target === p.id);
    });
    if (noRels.length > 0) {
      list.push({
        id: 'isolated_nodes',
        icon: '🔗',
        message: `${noRels.length} member${noRels.length > 1 ? 's are' : ' is'} not connected to anyone — forge a relationship link.`,
        action: null,
      });
    }

    // No spouses in tree
    if (hasSpouse.size === 0 && persons.length >= 2) {
      list.push({
        id: 'no_spouses',
        icon: '💍',
        message: 'No spouse relationships found — add marriages for a more complete family picture.',
        action: null,
      });
    }

    // Missing bio
    const noBio = persons.filter(p => !p.bio);
    if (noBio.length > 0) {
      list.push({
        id: 'no_bio',
        icon: '📝',
        message: `${noBio.length} member${noBio.length > 1 ? 's' : ''} ${noBio.length > 1 ? 'have' : 'has'} no biography — open their profile to auto-generate one.`,
        action: null,
      });
    }

    return list.slice(0, 5); // cap at 5
  }, [persons, edges]);

  const visible = suggestions.filter(s => !dismissed.includes(s.id));

  return (
    <div>
      {visible.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-3xl mb-2">✅</div>
          <p className="text-gray-500 text-sm">Your tree looks complete — no suggestions right now!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(s => (
            <div
              key={s.id}
              className="group flex items-start gap-3 p-4 bg-white/5 hover:bg-white/[0.07] border border-white/10 hover:border-amber-500/20 rounded-2xl transition-all duration-200"
              style={{ animation: 'fadeInUp 0.3s ease both' }}
            >
              <span className="text-2xl flex-shrink-0 mt-0.5">{s.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-gray-300 text-sm leading-relaxed">{s.message}</p>
                {s.action && s.actionLabel && onAction && (
                  <button
                    onClick={() => onAction(s.action, s)}
                    className="mt-2 text-xs text-rose-400 font-bold hover:text-rose-300 transition-colors"
                  >
                    {s.actionLabel} →
                  </button>
                )}
              </div>
              <button
                onClick={() => setDismissed(d => [...d, s.id])}
                title="Dismiss"
                className="text-gray-700 hover:text-gray-400 transition-colors text-xs flex-shrink-0 mt-0.5"
              >✕</button>
            </div>
          ))}
        </div>
      )}
      <style>{`@keyframes fadeInUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }`}</style>
    </div>
  );
};

export default SmartSuggestions;
