import React, { useState } from 'react';

const TAGS = ['Childhood', 'Career', 'Family', 'Education'];
const EMOTIONS = ['😊', '😢', '🎉', '😔'];

const MemoryForm = ({ onSubmit, loading }) => {
  const blank = { title: '', description: '', event_date: '', media_url: '', tags: [], emotion: '', people_involved: '' };
  const [form, setForm] = useState(blank);
  const toggleTag = tag => setForm(f => ({ ...f, tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag] }));
  const handleSubmit = e => { e.preventDefault(); onSubmit(form); setForm(blank); };
  const cls = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-rose-500 focus:bg-white/8 transition-all text-sm";
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input required placeholder="Memory title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className={cls} />
      <textarea rows={3} placeholder="Describe this memory…" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={cls} />
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Tags</p>
        <div className="flex flex-wrap gap-2">
          {TAGS.map(tag => (
            <button key={tag} type="button" onClick={() => toggleTag(tag)}
              className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${form.tags.includes(tag) ? 'bg-rose-500 border-rose-500 text-white' : 'bg-white/5 border-white/10 text-gray-400 hover:border-rose-500/40'}`}>{tag}</button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Mood</p>
        <div className="flex gap-3">
          {EMOTIONS.map(em => (
            <button key={em} type="button" onClick={() => setForm({ ...form, emotion: form.emotion === em ? '' : em })}
              className={`text-2xl w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${form.emotion === em ? 'bg-rose-500/20 border-rose-500 scale-110 shadow-[0_0_12px_rgba(225,29,72,0.4)]' : 'bg-white/5 border-white/10'}`}>{em}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input type="date" value={form.event_date} onChange={e => setForm({ ...form, event_date: e.target.value })} className={cls} />
        <input placeholder="People involved" value={form.people_involved} onChange={e => setForm({ ...form, people_involved: e.target.value })} className={cls} />
      </div>
      <input type="url" placeholder="Image URL (optional)" value={form.media_url} onChange={e => setForm({ ...form, media_url: e.target.value })} className={cls} />
      <button type="submit" disabled={loading}
        className="w-full py-3.5 bg-white text-black font-bold uppercase tracking-widest text-sm rounded-xl hover:bg-rose-500 hover:text-white transition-all duration-300 disabled:opacity-50">
        {loading ? 'Saving…' : '+ Add Memory'}
      </button>
    </form>
  );
};

export default MemoryForm;
