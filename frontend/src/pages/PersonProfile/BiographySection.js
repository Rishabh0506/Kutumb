import React, { useState } from 'react';
import api from '../../api/api';
import InlineEditField from './InlineEditField';

// FEATURE 5: BIOGRAPHY SECTION (enhanced)
const BiographySection = ({ person, relationships, memories, relPersons, onBioUpdate }) => {
  const [generating, setGenerating] = useState(false);

  const hasEnoughData = person?.birth_date || relationships.length > 0 || memories.length > 0;

  const handleGenerate = async () => {
    setGenerating(true);
    let bio;
    try {
      const res = await api.post('/ai/generate-biography', { person_id: person.id });
      bio = res.data.biography || res.data.bio || '';
    } catch {
      // Build a local heuristic bio if the request fails
      const rels = relationships.slice(0, 3).map(r => {
        const oid = r.person1_id === person.id ? r.person2_id : r.person1_id;
        const op = relPersons[oid];
        return op ? `${r.relationship_type} of ${op.first_name}` : null;
      }).filter(Boolean).join(', ');

      bio = [
        `${person.first_name} ${person.last_name || ''} was born${person.birth_date ? ` on ${new Date(person.birth_date).toLocaleDateString('en-IN', { year:'numeric', month:'long', day:'numeric' })}` : ''}${person.birth_place ? ` in ${person.birth_place}` : ''}.`,
        rels ? `Known relationships include: ${rels}.` : '',
        memories.length > 0 ? `${person.first_name}'s life story includes ${memories.length} recorded ${memories.length === 1 ? 'memory' : 'memories'}.` : '',
        person.occupation ? `${person.first_name} worked as ${person.occupation}.` : '',
      ].filter(Boolean).join(' ') || 'No biography available yet.';
    }

    try {
      await onBioUpdate(bio);
    } catch {
      // onBioUpdate already surfaces a page-level "Save failed." error.
    } finally {
      setGenerating(false);
    }
  };

  return (
    <section className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-xl">
      <div className="flex justify-between items-center mb-4 pb-4 border-b border-white/10">
        <h2 className="font-bold text-white flex items-center gap-2">📝 Biography</h2>
        <button onClick={handleGenerate} disabled={generating}
          className="text-[10px] px-3 py-1.5 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg font-bold uppercase tracking-wider hover:bg-rose-500 hover:text-white transition-all disabled:opacity-40 flex items-center gap-1.5">
          {generating ? (
            <><span className="w-3 h-3 border border-rose-400 border-t-transparent rounded-full animate-spin" /> Generating…</>
          ) : '✨ Auto-Generate'}
        </button>
      </div>
      {generating ? (
        <div className="space-y-2">
          {[80, 95, 65, 85].map((w, i) => (
            <div key={i} className="h-3 bg-white/5 rounded animate-pulse" style={{ width: `${w}%` }} />
          ))}
        </div>
      ) : (
        <div>
          {!hasEnoughData && !person?.bio && (
            <p className="text-amber-400/70 text-xs italic mb-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
              💡 Add more life events or relationships to generate a richer biography
            </p>
          )}
          <InlineEditField
            value={person?.bio}
            placeholder="No biography yet — click Auto-Generate or click here to write one."
            multiline
            onSave={onBioUpdate}
            className="text-gray-300 text-sm leading-relaxed block w-full"
          />
        </div>
      )}
    </section>
  );
};

export default BiographySection;
