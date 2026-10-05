import React, { useState, useRef, useCallback } from 'react';
import api from '../api/api';

const GedcomImport = ({ familyId, onImportSuccess }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const processFile = (f) => {
    if (!f) return;
    if (!f.name.endsWith('.ged')) {
      setError('Please upload a valid .ged GEDCOM file.');
      return;
    }
    setFile(f);
    setMessage('');
    setError('');
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    processFile(dropped);
  }, []);

  const handleDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const handleDragLeave = () => setDragging(false);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) { setError('Please select or drop a GEDCOM file.'); return; }
    if (!familyId) { setError('No family context selected.'); return; }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('family_id', familyId);

    try {
      setUploading(true);
      setError('');
      setMessage('');
      setProgress(10);

      const response = await api.post('/gedcom/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (evt) => {
          if (evt.total) setProgress(Math.round((evt.loaded / evt.total) * 80));
        },
      });

      setProgress(100);
      setMessage('GEDCOM imported successfully! Tree has been updated.');
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      if (onImportSuccess) onImportSuccess(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Import failed. Please check your GEDCOM file.');
      setProgress(0);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
      <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
        📂 Import GEDCOM
        <span className="flex-1 h-px bg-gradient-to-r from-rose-500/40 to-transparent ml-3" />
      </h3>

      <form onSubmit={handleUpload}>
        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !file && inputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl 
            py-10 px-6 cursor-pointer transition-all duration-300 text-center
            ${dragging
              ? 'border-rose-500 bg-rose-500/10 scale-[1.01] shadow-[0_0_30px_rgba(225,29,72,0.2)]'
              : file
                ? 'border-emerald-500/50 bg-emerald-500/5'
                : 'border-white/15 bg-white/[0.02] hover:border-rose-500/40 hover:bg-white/5'
            }`}
        >
          <input
            ref={inputRef}
            id="gedcom-upload"
            type="file"
            accept=".ged"
            className="hidden"
            onChange={(e) => processFile(e.target.files?.[0])}
          />

          {file ? (
            <>
              <div className="text-4xl">📄</div>
              <p className="text-emerald-400 font-bold text-sm">{file.name}</p>
              <p className="text-gray-500 text-xs">{(file.size / 1024).toFixed(1)} KB — Ready to import</p>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setFile(null); setProgress(0); setMessage(''); }}
                className="text-xs text-gray-500 hover:text-rose-400 transition-colors mt-1"
              >✕ Remove</button>
            </>
          ) : (
            <>
              <div className="text-4xl opacity-40">⬆️</div>
              <p className="text-white font-semibold text-sm">
                {dragging ? 'Drop it here!' : 'Drag & drop GEDCOM file or click to upload'}
              </p>
              <p className="text-gray-600 text-xs">Accepts .ged files</p>
            </>
          )}
        </div>

        {/* Progress bar */}
        {uploading && (
          <div className="mt-4 w-full h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-rose-500 to-rose-400 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Messages */}
        {message && (
          <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm rounded-xl flex items-center gap-2">
            ✅ {message}
          </div>
        )}
        {error && (
          <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl flex items-center gap-2">
            ⚠️ {error}
          </div>
        )}

        <button
          type="submit"
          disabled={uploading || !file || !familyId}
          className="mt-4 w-full py-3 bg-white/5 border border-white/15 text-white font-bold uppercase tracking-widest text-xs rounded-xl
            hover:bg-rose-500/20 hover:border-rose-500/40 hover:text-rose-300 transition-all duration-300
            disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {uploading ? `Importing… ${progress}%` : '⬆️ Import GEDCOM'}
        </button>
      </form>
    </div>
  );
};

export default GedcomImport;
