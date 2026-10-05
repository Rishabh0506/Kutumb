import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';

/**
 * GlobalSearchBar
 * - Queries GET /api/persons/search?q=... (debounced, 300ms)
 * - Shows a live dropdown of results
 * - Clicking a result navigates to /person/:id
 * - Works on every page that renders it
 */
const GlobalSearchBar = ({ placeholder = 'Search any family member…', className = '' }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const doSearch = useCallback(async (q) => {
    if (!q || q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get(`/persons/search?q=${encodeURIComponent(q.trim())}`);
      setResults(res.data || []);
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  };

  const handleSelect = (person) => {
    setQuery('');
    setResults([]);
    setOpen(false);
    navigate(`/person/${person.id}`);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { setOpen(false); setQuery(''); }
    if (e.key === 'Enter' && results.length > 0) handleSelect(results[0]);
  };

  const initial = (p) => `${p.first_name?.[0] || ''}${p.last_name?.[0] || ''}`.toUpperCase();
  const fullName = (p) => `${p.first_name || ''} ${p.last_name || ''}`.trim();

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      {/* Input */}
      <div className="relative flex items-center">
        <span className="absolute left-3 text-gray-500 pointer-events-none">
          {loading
            ? <span className="w-3.5 h-3.5 border border-gray-500 border-t-rose-400 rounded-full animate-spin inline-block" />
            : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          }
        </span>
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="pl-9 pr-4 py-2 rounded-xl bg-white/5 text-white placeholder-gray-500 font-medium text-sm
            focus:outline-none focus:ring-2 focus:ring-rose-500 w-64 border border-white/10
            transition-all duration-200 focus:w-80 focus:bg-white/10"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults([]); setOpen(false); }}
            className="absolute right-2.5 text-gray-500 hover:text-gray-300 text-xs font-bold"
          >✕</button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full mt-2 left-0 w-80 bg-[#111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 backdrop-blur-xl">
          {results.length === 0 ? (
            <div className="px-4 py-5 text-center text-gray-500 text-sm">
              No members found for "{query}"
            </div>
          ) : (
            <>
              <div className="px-4 py-2 border-b border-white/5">
                <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                  {results.length} result{results.length !== 1 ? 's' : ''}
                </span>
              </div>
              <ul className="max-h-72 overflow-y-auto">
                {results.map((person) => (
                  <li key={person.id}>
                    <button
                      onClick={() => handleSelect(person)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left group"
                    >
                      {/* Avatar */}
                      <div className={`w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center text-xs font-black
                        bg-rose-500/20 text-rose-400 border border-rose-500/30 group-hover:border-rose-500/60 transition-all`}>
                        {initial(person) || '?'}
                      </div>
                      {/* Name + meta */}
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm truncate">{fullName(person)}</p>
                        <p className="text-gray-500 text-xs truncate flex items-center gap-1">
                          {person.gender && <span>{person.gender}</span>}
                          {person.gender && person.birth_place && <span>·</span>}
                          {person.birth_place && <span>📍 {person.birth_place}</span>}
                        </p>
                      </div>
                      <span className="text-gray-600 text-xs group-hover:text-rose-400 transition-colors flex-shrink-0">→</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default GlobalSearchBar;
