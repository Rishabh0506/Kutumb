import React, { useEffect, useState } from 'react';

const STORAGE_KEY = 'onboardingChecklistDismissed';

// Guides a brand-new user through the app's core workflow on their first
// visits to the Dashboard: lineage -> members -> relationships -> memories.
// Progress is derived from real counts returned with each family, and the
// card permanently hides itself once every step is complete (or dismissed).
const GettingStartedChecklist = ({ families, onCreateLineage, onGoToTree }) => {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true');

  const hasLineage = families.length > 0;
  const hasMember = families.some(f => f.member_count > 0);
  const hasRelationship = families.some(f => f.relationship_count > 0);
  const hasMemory = families.some(f => f.memory_count > 0);

  const steps = [
    {
      id: 'lineage',
      icon: '🌱',
      label: 'Create your first lineage',
      hint: 'Give your family tree a name to begin.',
      done: hasLineage,
      disabled: false,
      action: onCreateLineage,
    },
    {
      id: 'member',
      icon: '👤',
      label: 'Add your first family member',
      hint: 'Open your lineage and add someone to it.',
      done: hasMember,
      disabled: !hasLineage,
      action: onGoToTree,
    },
    {
      id: 'relationship',
      icon: '🔗',
      label: 'Link a relationship',
      hint: 'Connect two people as parent, spouse, sibling, or child.',
      done: hasRelationship,
      disabled: !hasMember,
      action: onGoToTree,
    },
    {
      id: 'memory',
      icon: '📸',
      label: 'Add a memory',
      hint: "Open a family member's profile and add their first story.",
      done: hasMemory,
      disabled: !hasMember,
      action: onGoToTree,
    },
  ];

  const doneCount = steps.filter(s => s.done).length;
  const allDone = doneCount === steps.length;

  useEffect(() => {
    if (allDone) localStorage.setItem(STORAGE_KEY, 'true');
  }, [allDone]);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setDismissed(true);
  };

  if (dismissed || allDone) return null;

  return (
    <section className="mb-12 bg-black/40 border border-white/5 rounded-2xl backdrop-blur-2xl shadow-xl relative overflow-hidden animate-in fade-in slide-in-from-top-4 duration-700 fill-mode-both">
      <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-rose-600 via-rose-500 to-orange-500 opacity-60" />

      <div className="p-6 md:p-8">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight">Getting Started</h3>
            <p className="text-sm text-gray-400 mt-1">A quick walkthrough of how Kutumb works — {doneCount}/{steps.length} done.</p>
          </div>
          <button
            onClick={dismiss}
            title="Dismiss"
            className="text-gray-500 hover:text-white transition-colors text-lg leading-none px-1"
          >
            ✕
          </button>
        </div>

        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-6">
          <div
            className="h-full bg-gradient-to-r from-rose-600 to-orange-500 transition-all duration-500"
            style={{ width: `${(doneCount / steps.length) * 100}%` }}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((step) => (
            <button
              key={step.id}
              onClick={() => { if (!step.disabled && !step.done) step.action?.(); }}
              disabled={step.disabled}
              className={`text-left p-4 rounded-xl border transition-all duration-300 flex flex-col gap-2 group
                ${step.done
                  ? 'bg-emerald-500/5 border-emerald-500/20'
                  : step.disabled
                    ? 'bg-white/[0.02] border-white/5 opacity-40 cursor-not-allowed'
                    : 'bg-white/5 border-white/10 hover:border-rose-500/30 hover:bg-white/[0.07] cursor-pointer'}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xl">{step.done ? '✅' : step.icon}</span>
                {step.done && <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Done</span>}
              </div>
              <p className={`text-xs font-bold ${step.done ? 'text-emerald-300' : 'text-gray-200'}`}>{step.label}</p>
              <p className="text-[11px] text-gray-500 leading-relaxed">{step.hint}</p>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default GettingStartedChecklist;
