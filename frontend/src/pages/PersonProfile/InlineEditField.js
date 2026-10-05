import React, { useState, useEffect, useRef } from 'react';

const InlineEditField = ({ value, onSave, placeholder = 'Click to edit…', multiline = false, className = '' }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const [failed, setFailed] = useState(false);
  const ref = useRef();

  const commit = async () => {
    if (draft === value) { setEditing(false); return; }
    const pendingDraft = draft;
    setEditing(false);
    try {
      await onSave(pendingDraft);
      setFailed(false);
    } catch {
      // Save failed — revert and flash a field-level indicator so this
      // doesn't read as "my edit just vanished" with no explanation.
      setDraft(value || '');
      setFailed(true);
      setTimeout(() => setFailed(false), 3000);
    }
  };

  useEffect(() => {
    if (editing && ref.current) ref.current.focus();
  }, [editing]);

  const baseInput = "bg-transparent border-0 border-b border-rose-500 outline-none text-white w-full resize-none py-0.5";

  return (
    <span className={`group relative cursor-text ${className}`} onClick={() => !editing && setEditing(true)}>
      {editing ? (
        multiline ? (
          <textarea
            ref={ref}
            value={draft}
            rows={4}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => e.key === 'Escape' && setEditing(false)}
            className={`${baseInput} block w-full text-sm leading-relaxed`}
          />
        ) : (
          <input
            ref={ref}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
            className={`${baseInput} inline`}
          />
        )
      ) : (
        <span className={`border-b transition-colors ${failed ? 'border-red-500/60' : 'border-transparent group-hover:border-white/30'} ${!value ? 'text-gray-600 italic text-sm' : ''}`}>
          {value || placeholder}
          {failed ? (
            <span className="ml-1.5 text-[10px] text-red-400 font-bold">⚠️ save failed</span>
          ) : (
            <span className="ml-1.5 text-[10px] text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">✏️</span>
          )}
        </span>
      )}
    </span>
  );
};

export default InlineEditField;
