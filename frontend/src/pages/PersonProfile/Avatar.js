import React, { useState, useRef } from 'react';
import { useToast } from '../../context/ToastContext';

export const Avatar = ({ photoUrl, name, size = 'md', glow = false, onClick }) => {
  const sizes = {
    xs: 'w-8 h-8 text-xs rounded-xl',
    sm: 'w-10 h-10 text-sm rounded-xl',
    md: 'w-14 h-14 text-lg rounded-2xl',
    lg: 'w-36 h-36 text-5xl rounded-3xl',
  };
  return (
    <div
      onClick={onClick}
      className={`${sizes[size]} flex-shrink-0 flex items-center justify-center font-black select-none
        bg-white/5 border border-white/10 overflow-hidden transition-all duration-300
        ${glow ? 'shadow-[0_0_40px_rgba(225,29,72,0.3)]' : ''}
        ${onClick ? 'cursor-pointer hover:border-rose-500/50 hover:scale-105' : ''}`}
    >
      {photoUrl ? (
        <img src={photoUrl} alt={`${name} avatar`} className="w-full h-full object-cover" loading="lazy" decoding="async" />
      ) : (
        <span className="text-rose-400">{name?.[0]?.toUpperCase() || '?'}</span>
      )}
    </div>
  );
};

// Uploadable version — shows camera overlay on hover
export const UploadableAvatar = ({ photoUrl, name, size = 'lg', glow = false, personId, onUploaded, editable = false }) => {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview]     = useState(null);
  const fileRef = useRef();
  const { addToast } = useToast();

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Local preview immediately
    const objUrl = URL.createObjectURL(file);
    setPreview(objUrl);
    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      const fd = new FormData();
      fd.append('photo', file);
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';
      const res = await fetch(`${apiUrl}/persons/${personId}/photo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      // The upload route itself returns { error }, but a request that never
      // reaches it (auth failure, rate limit) returns { message } instead —
      // check both so a real reason surfaces rather than a generic fallback.
      if (data.photo_url) onUploaded?.(data.photo_url);
      else throw new Error(data.error || data.message || 'Upload failed');
    } catch (err) {
      addToast(err.message || 'Failed to upload photo.', 'error');
      setPreview(null); // revert on error
    } finally {
      setUploading(false);
    }
  };

  const displayUrl = preview || photoUrl;
  const sizes = {
    md: 'w-14 h-14 text-lg rounded-2xl',
    lg: 'w-36 h-36 text-5xl rounded-3xl',
  };

  return (
    <div className={`relative flex-shrink-0 group ${editable ? 'cursor-pointer' : ''}`}
      onClick={() => editable && fileRef.current?.click()}>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <div
        className={`${sizes[size] || sizes.lg} flex items-center justify-center font-black select-none
          bg-white/5 border border-white/10 overflow-hidden transition-all duration-300
          ${glow ? 'shadow-[0_0_40px_rgba(225,29,72,0.3)]' : ''}
          ${editable ? 'group-hover:border-rose-500/50' : ''}`}
      >
        {displayUrl ? (
          <img src={displayUrl} alt={`${name} avatar`} className="w-full h-full object-cover" loading="lazy" decoding="async" />
        ) : (
          <span className="text-rose-400">{name?.[0]?.toUpperCase() || '?'}</span>
        )}
      </div>
      {/* Camera overlay */}
      {editable && (
        <div className={`absolute inset-0 ${sizes[size] || sizes.lg} flex flex-col items-center justify-center
          bg-black/60 opacity-0 group-hover:opacity-100 transition-all duration-200
          ${uploading ? 'opacity-100' : ''}`}>
          {uploading ? (
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <span className="text-2xl">📸</span>
              <span className="text-white text-[9px] font-bold mt-1 uppercase tracking-wider">Change Photo</span>
            </>
          )}
        </div>
      )}
    </div>
  );
};
