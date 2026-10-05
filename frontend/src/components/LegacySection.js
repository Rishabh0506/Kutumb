import React, { useState } from 'react';
import api from '../api/api';
import { useToast } from '../context/ToastContext';

const EMOTIONS = [
  { emoji: '😊', label: 'Joy' },
  { emoji: '❤️', label: 'Love' },
  { emoji: '🕊️', label: 'Peace' },
  { emoji: '💭', label: 'Reflection' },
  { emoji: '🌟', label: 'Inspiration' },
  { emoji: '😢', label: 'Sorrow' }
];

const LegacyCard = ({ message }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-5 hover:border-rose-500/40 transition-all duration-300 group">
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-white font-bold text-lg group-hover:text-rose-400 transition-colors">
          {message.emotion_tag} {message.title}
        </h3>
        <span className="text-xs text-gray-500 font-mono">
          {new Date(message.created_at).toLocaleDateString()}
        </span>
      </div>
      
      <div className={`text-gray-300 text-sm leading-relaxed transition-all duration-300 ${expanded ? '' : 'line-clamp-3'}`}>
        {message.message}
      </div>
      
      {message.message.length > 150 && (
        <button 
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-[10px] font-bold uppercase tracking-widest text-rose-500 hover:text-rose-400 transition-colors"
        >
          {expanded ? 'Read Less' : 'Read Full Message ⬇️'}
        </button>
      )}
    </div>
  );
};

const LegacySection = ({ personId, messages, onMessageAdded }) => {
  const [isComposing, setIsComposing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ title: '', message: '', emotion_tag: '❤️' });
  const { addToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.message.trim()) return;

    setLoading(true);
    try {
      const res = await api.post(`/legacy/${personId}`, form);
      onMessageAdded(res.data);
      setForm({ title: '', message: '', emotion_tag: '❤️' });
      setIsComposing(false);
    } catch (err) {
      addToast(err.response?.data?.message || err.response?.data?.error || 'Failed to save your legacy message.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const baseInput = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-rose-500 focus:bg-white/8 transition-all text-sm";

  return (
    <section className="bg-gradient-to-br from-indigo-900/10 to-rose-900/10 backdrop-blur-xl border border-rose-500/20 rounded-3xl p-8 shadow-[0_0_40px_rgba(225,29,72,0.05)] relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-rose-500/50 to-transparent" />
      
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-rose-500/10">
        <div>
          <h2 className="font-black text-white text-xl flex items-center gap-2 tracking-tight">
            🕊️ Legacy Messages
          </h2>
          <p className="text-xs text-gray-500 mt-1">Preserve thoughts, wisdom, and emotional memories for future generations.</p>
        </div>
        {!isComposing && (
          <button 
            onClick={() => setIsComposing(true)}
            className="px-4 py-2 bg-rose-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-rose-600 hover:shadow-[0_0_20px_rgba(225,29,72,0.4)] transition-all"
          >
            + Preserve Legacy
          </button>
        )}
      </div>

      {isComposing && (
        <form onSubmit={handleSubmit} className="mb-8 p-5 bg-black/40 border border-white/10 rounded-2xl relative">
          <button type="button" onClick={() => setIsComposing(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white text-lg">✕</button>
          <h3 className="text-white font-bold mb-4">Draft a Message for the Future</h3>
          
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Emotion / Tone</p>
              <div className="flex gap-2 flex-wrap">
                {EMOTIONS.map(({ emoji, label }) => (
                  <button 
                    key={label} type="button" 
                    onClick={() => setForm(f => ({ ...f, emotion_tag: emoji }))}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-all border ${form.emotion_tag === emoji ? 'bg-rose-500/20 border-rose-500 shadow-[0_0_10px_rgba(225,29,72,0.3)]' : 'bg-white/5 border-white/10 grayscale hover:grayscale-0'}`}
                    title={label}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            
            <input 
              required 
              placeholder="Title (e.g., 'A letter to my grandchildren')" 
              value={form.title} 
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))} 
              className={baseInput} 
            />
            
            <textarea 
              required 
              rows={5} 
              placeholder="Share your wisdom, a meaningful story, or an emotional message..." 
              value={form.message} 
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))} 
              className={baseInput} 
            />
            
            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-3 bg-white text-black font-bold uppercase tracking-widest text-sm rounded-xl hover:bg-rose-500 hover:text-white transition-all disabled:opacity-50"
            >
              {loading ? 'Securing Legacy...' : 'Seal Message'}
            </button>
          </div>
        </form>
      )}

      {messages.length === 0 && !isComposing ? (
        <div className="text-center py-10">
          <div className="text-5xl mb-4 opacity-50">📜</div>
          <p className="text-gray-400 text-sm font-medium">No legacy messages yet.</p>
          <p className="text-gray-600 text-xs mt-1">Leave a timeless message, story, or piece of wisdom for future generations.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {messages.map(msg => <LegacyCard key={msg.id} message={msg} />)}
        </div>
      )}
    </section>
  );
};

export default LegacySection;
