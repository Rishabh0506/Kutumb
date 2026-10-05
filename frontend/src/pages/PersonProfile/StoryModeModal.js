import React, { useState, useEffect, useCallback } from 'react';
import api from '../../api/api';
import Modal from '../../components/Modal';

const StoryModeModal = ({ person, memories, relationships, relPersons, onClose, onSave }) => {
  const [story, setStory] = useState('');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const buildStory = useCallback(async () => {
    setLoading(true);
    setSaved(false);
    try {
      const res = await api.post('/ai/generate-biography', { person_id: person.id });
      setStory(res.data.biography || res.data.bio || '');
    } catch {
      const name = `${person.first_name} ${person.last_name || ''}`.trim();
      const origin = person.birth_place ? ` in ${person.birth_place}` : '';
      const born = person.birth_date ? ` on ${new Date(person.birth_date).toLocaleDateString('en-IN', { year:'numeric', month:'long', day:'numeric' })}` : '';
      const relDesc = Object.values(relPersons).slice(0, 2).map(p => `${p.first_name} ${p.last_name || ''}`.trim()).join(' and ');
      const memDesc = memories.length > 0 ? ` Their story holds ${memories.length} recorded chapter${memories.length > 1 ? 's' : ''} of life.` : '';
      setStory(`${name} was born${born}${origin}. ${relDesc ? `Connected to ${relDesc}, they are a cherished member of the family.` : 'They are a cherished member of the family.'}${memDesc} ${person.occupation ? `${name} dedicated their life to ${person.occupation}.` : ''}`);
    } finally { setLoading(false); }
  }, [person, relPersons, memories]);

  useEffect(() => { buildStory(); }, [buildStory]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave?.(story);
      setSaved(true);
    } catch {
      // onSave already surfaces a page-level "Save failed." error.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal maxWidth="max-w-xl" onClose={onClose}>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-black text-white">📖 Life Story</h2>
          <p className="text-gray-500 text-xs mt-1">A preview, generated from {person.first_name}'s profile — not saved unless you choose to.</p>
        </div>
        <button onClick={onClose} className="text-gray-600 hover:text-white transition-colors text-lg">✕</button>
      </div>
      {loading ? (
        <div className="space-y-3">
          {[90, 75, 85, 60, 80].map((w, i) => (
            <div key={i} className="h-3.5 bg-white/5 rounded animate-pulse" style={{ width: `${w}%` }} />
          ))}
        </div>
      ) : (
        <p className="text-gray-300 text-base leading-8 whitespace-pre-wrap">{story}</p>
      )}
      <div className="flex gap-3 mt-6">
        <button onClick={buildStory} disabled={loading} className="flex-1 py-2.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all disabled:opacity-40">
          🔄 Regenerate
        </button>
        {onSave && (
          <button onClick={handleSave} disabled={loading || saving || saved} className="flex-1 py-2.5 bg-white text-black rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all disabled:opacity-40">
            {saved ? '✅ Saved to Profile' : saving ? 'Saving…' : '💾 Save to Profile'}
          </button>
        )}
        <button onClick={onClose} className="py-2.5 px-5 bg-white/5 border border-white/10 text-gray-400 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white/10 transition-all">
          Close
        </button>
      </div>
    </Modal>
  );
};

export default StoryModeModal;
