import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/api';
import MemoryTimeline from '../../components/MemoryTimeline';
import LegacySection from '../../components/LegacySection';
import Modal from '../../components/Modal';
import {
  deletePerson,
  updatePerson,
  deleteRelationship,
  updateRelationship,
} from '../../services/familyService';

import { calcAge } from './utils';
import { UploadableAvatar } from './Avatar';
import Chip from './Chip';
import BreadcrumbNav from './BreadcrumbNav';
import InlineEditField from './InlineEditField';
import InsightsPanel from './InsightsPanel';
import ProfileStrengthBar from './ProfileStrengthBar';
import StoryModeModal from './StoryModeModal';
import MiniTreePreview from './MiniTreePreview';
import PrivacyControls from './PrivacyControls';
import FamilySection from './FamilySection';
import MemoryForm from './MemoryForm';
import BiographySection from './BiographySection';

// Demo-mode profile data for the unauthenticated "Preview a Family Legacy"
// flow — mirrors the demo nodes rendered by FamilyTreePage for demo=true.
const DEMO_PERSON_DATA = {
  n1: {
    person: { id: 'n1', first_name: 'Ramesh', last_name: 'Sharma', gender: 'Male', birth_place: 'Jaipur', bio: 'A dedicated civil engineer who spent over three decades building bridges and highways, and even more time building memories with his family.' },
    memories: [{ id: 'm1', title: 'Building Our First Home', description: 'Ramesh and Sunita spent one whole summer building their first family home together, room by room.', event_date: '1978-06-15', tags: ['Family'] }],
    relationships: [
      { id: 'r1', person1_id: 'n1', person2_id: 'n2', relationship_type: 'spouse' },
      { id: 'r2', person1_id: 'n1', person2_id: 'n3', relationship_type: 'parent' }
    ]
  },
  n2: {
    person: { id: 'n2', first_name: 'Sunita', last_name: 'Sharma', gender: 'Female', bio: 'A devoted schoolteacher who spent forty years shaping young minds, and an even longer time shaping this family.' },
    memories: [],
    relationships: [
      { id: 'r1', person1_id: 'n1', person2_id: 'n2', relationship_type: 'spouse' },
      { id: 'r3', person1_id: 'n2', person2_id: 'n3', relationship_type: 'parent' },
      { id: 'r4', person1_id: 'n4', person2_id: 'n2', relationship_type: 'sibling' }
    ]
  },
  n3: {
    person: { id: 'n3', first_name: 'Rohan', last_name: 'Sharma', gender: 'Male', bio: 'The curious middle child who grew up to become a family doctor, always eager to learn something new.' },
    memories: [],
    relationships: [
      { id: 'r2', person1_id: 'n1', person2_id: 'n3', relationship_type: 'parent' },
      { id: 'r3', person1_id: 'n2', person2_id: 'n3', relationship_type: 'parent' }
    ]
  },
  n4: {
    person: { id: 'n4', first_name: 'Meena', last_name: 'Kapoor', gender: 'Female', bio: 'The free spirit of the family, known for her love of travel and her infectious laugh at every reunion.' },
    memories: [],
    relationships: [
      { id: 'r4', person1_id: 'n4', person2_id: 'n2', relationship_type: 'sibling' }
    ]
  }
};

// ─────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────
const PersonProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isDemo = Boolean(DEMO_PERSON_DATA[id]);
  // Demo person ids stay navigable for logged-out visitors only if the
  // `demo=true` param survives — ProtectedRoute checks for it.
  const demoPath = useCallback((path) => (isDemo ? `${path}?demo=true` : path), [isDemo]);

  const [person, setPerson] = useState(null);
  const [memories, setMemories] = useState([]);
  const [legacyMessages, setLegacyMessages] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [relPersons, setRelPersons] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingMemory, setSavingMemory] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [showStory, setShowStory] = useState(false);
  const [confirmState, setConfirmState] = useState({ open: false, message: '', onConfirm: null });
  const [editRelState, setEditRelState] = useState({ open: false, relId: null, value: '' });
  const memoryFormRef = useRef();

  const [editForm, setEditForm] = useState({});

  const fetchProfileData = useCallback(async () => {
    try {
      setLoading(true);

      if (DEMO_PERSON_DATA[id]) {
        const data = DEMO_PERSON_DATA[id];
        setPerson(data.person);
        setEditForm(data.person);
        setMemories(data.memories);
        setLegacyMessages([]);
        setRelationships(data.relationships);

        const otherIds = [...new Set(data.relationships.map(r => r.person1_id === id ? r.person2_id : r.person1_id))];
        const pm = {};
        otherIds.forEach(oid => {
           if (DEMO_PERSON_DATA[oid]) pm[oid] = DEMO_PERSON_DATA[oid].person;
        });
        setRelPersons(pm);
        setLoading(false);
        return;
      }

      const [personRes, memoriesRes, relsRes, legacyRes] = await Promise.all([
        api.get(`/persons/${id}`),
        api.get(`/memories/person/${id}`),
        api.get(`/relationships/${id}`),
        api.get(`/legacy/${id}`).catch(() => ({ data: [] }))
      ]);
      setPerson(personRes.data);
      setEditForm(personRes.data);
      setMemories(memoriesRes.data || []);
      setLegacyMessages(legacyRes.data || []);
      const rels = relsRes.data || [];
      setRelationships(rels);

      const otherIds = [...new Set(rels.map(r => r.person1_id === id ? r.person2_id : r.person1_id))];
      const personResults = await Promise.allSettled(
        otherIds.map(pid => api.get(`/persons/${pid}`).then(r => ({ id: pid, data: r.data })))
      );
      const pm = {};
      personResults.forEach(res => { if (res.status === 'fulfilled') pm[res.value.id] = res.value.data; });
      setRelPersons(pm);
    } catch (err) {
      setError('Failed to load profile.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchProfileData(); }, [fetchProfileData]);

  // Demo persons aren't real DB rows, so any mutation would just fail
  // against the API with a confusing 401 — short-circuit with a clear notice.
  const blockIfDemo = () => {
    if (!isDemo) return false;
    setError('This is a preview lineage — sign up to build and edit your own.');
    setTimeout(() => setError(''), 3000);
    return true;
  };

  const handleAddMemory = async (formData) => {
    if (!person || blockIfDemo()) return;
    setSavingMemory(true);
    try {
      const res = await api.post('/memories', { ...formData, person_id: id, family_id: person.family_id });
      setMemories(prev => [...prev, res.data]);
    } catch { setError('Failed to add memory.'); setTimeout(() => setError(''), 3000); }
    finally { setSavingMemory(false); }
  };

  const handleLegacyAdded = (msg) => {
    setLegacyMessages(prev => [msg, ...prev]);
  };

  const handleInlineSave = async (field, value) => {
    if (blockIfDemo()) throw new Error('Blocked in demo mode');
    try {
      const updated = { ...person, [field]: value };
      await updatePerson(id, { [field]: value });
      setPerson(updated);
    } catch {
      setError('Save failed.');
      throw new Error('Save failed.'); // let the caller (e.g. InlineEditField) know not to treat this as a success
    }
  };

  const handleSaveEditForm = async () => {
    if (blockIfDemo()) { setEditing(false); return; }
    try {
      await updatePerson(id, editForm);
      setPerson({ ...person, ...editForm });
      setEditing(false);
    } catch { setError('Update failed.'); }
  };

  const handleDeletePerson = () => {
    if (blockIfDemo()) return;
    setConfirmState({
      open: true,
      message: 'Permanently remove this person from the lineage?',
      onConfirm: async () => {
        setConfirmState({ open: false, message: '', onConfirm: null });
        try { await deletePerson(id); navigate('/family-tree'); }
        catch { setError('Delete failed.'); }
      },
    });
  };

  const handleDeleteRelationship = (relId) => {
    if (blockIfDemo()) return;
    setConfirmState({
      open: true,
      message: 'Remove this relationship?',
      onConfirm: async () => {
        setConfirmState({ open: false, message: '', onConfirm: null });
        try { await deleteRelationship(relId); fetchProfileData(); }
        catch { setError('Failed to remove.'); }
      },
    });
  };

  const handleEditRelationship = (relId, current) => {
    if (blockIfDemo()) return;
    setEditRelState({ open: true, relId, value: current });
  };

  const confirmEditRelationship = async () => {
    const { relId, value } = editRelState;
    setEditRelState({ open: false, relId: null, value: '' });
    if (!value.trim()) return;
    try { await updateRelationship(relId, { relationship_type: value.trim().toLowerCase() }); fetchProfileData(); }
    catch { setError('Update failed.'); }
  };

  // Quick nav helpers
  const parentIds = relationships
    .filter(r => (r.relationship_type === 'parent' && r.person2_id === id) || (r.relationship_type === 'child' && r.person1_id === id))
    .map(r => r.person1_id === id ? r.person2_id : r.person1_id);
  const childIds = relationships
    .filter(r => (r.relationship_type === 'child' && r.person2_id === id) || (r.relationship_type === 'parent' && r.person1_id === id))
    .map(r => r.person1_id === id ? r.person2_id : r.person1_id);

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-400 text-sm uppercase tracking-widest animate-pulse">Loading profile…</p>
      </div>
    </div>
  );

  if (!person) return (
    <div className="min-h-screen bg-black flex items-center justify-center text-rose-400 text-xl font-bold">
      {error || 'Profile not found'}
    </div>
  );

  const fullName = `${person.first_name} ${person.last_name || ''}`.trim();

  return (
    <div className="min-h-screen bg-[#080808] text-white font-sans selection:bg-rose-500/30">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[900px] h-[400px] bg-rose-900/8 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative max-w-5xl mx-auto px-5 md:px-10 py-8 space-y-7">

        {/* ── TOP BAR ── */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <BreadcrumbNav personName={fullName} isDemo={isDemo} />

          <div className="flex flex-wrap items-center gap-2">
            <PrivacyControls personId={id} personName={fullName} />
            <button onClick={() => setEditing(e => !e)}
              className="px-3 py-1.5 border border-white/15 bg-white/5 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-white hover:text-black transition-all">
              {editing ? '✕ Cancel' : '✏️ Edit'}
            </button>
            <button onClick={handleDeletePerson}
              className="px-3 py-1.5 border border-rose-500/40 bg-rose-500/10 text-rose-400 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-rose-600 hover:text-white transition-all">
              🗑️ Delete
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-900/40 border border-red-500/40 rounded-xl text-red-300 text-sm font-medium">⚠️ {error}</div>
        )}

        {/* ── QUICK NAV ── */}
        {(parentIds.length > 0 || childIds.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {parentIds.slice(0, 2).map(pid => (
              <button key={pid} onClick={() => navigate(demoPath(`/person/${pid}`))}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:border-white/20 transition-all">
                ↑ {relPersons[pid]?.first_name || 'Parent'}
              </button>
            ))}
            <button onClick={() => navigate(demoPath('/family-tree'))}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-500 hover:text-white transition-all">
              🌳 Full Tree
            </button>
            {childIds.slice(0, 2).map(cid => (
              <button key={cid} onClick={() => navigate(demoPath(`/person/${cid}`))}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:border-white/20 transition-all">
                ↓ {relPersons[cid]?.first_name || 'Child'}
              </button>
            ))}
          </div>
        )}

        {/* ── PROFILE HEADER ── */}
        <div className="bg-black/50 backdrop-blur-xl border border-white/10 rounded-3xl p-7 flex flex-col sm:flex-row gap-7 items-center sm:items-start relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-rose-500/40 to-transparent" />

          <UploadableAvatar
            photoUrl={person.photo_url}
            name={person.first_name}
            size="lg"
            glow
            editable={!isDemo}
            personId={person.id}
            onUploaded={(url) => setPerson(prev => ({ ...prev, photo_url: url }))}
          />

          {editing ? (
            <div className="flex-1 space-y-4 w-full">
              <div className="grid grid-cols-2 gap-3">
                {[['first_name','First Name'],['last_name','Last Name'],['gender','Gender'],['birth_place','Birth Place'],['occupation','Occupation']].map(([k,l]) => (
                  <div key={k} className="space-y-1">
                    <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">{l}</label>
                    <input value={editForm[k] || ''} onChange={e => setEditForm({...editForm,[k]:e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-500 transition-all" />
                  </div>
                ))}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Date of Birth</label>
                  <input type="date" value={editForm.birth_date ? editForm.birth_date.split('T')[0] : ''}
                    onChange={e => setEditForm({...editForm, birth_date: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-500 transition-all" />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={handleSaveEditForm} className="flex-1 py-2.5 bg-white text-black font-bold uppercase tracking-widest text-xs rounded-xl hover:bg-rose-500 hover:text-white transition-all">Save Changes</button>
                <button onClick={() => setEditing(false)} className="flex-1 py-2.5 bg-white/5 border border-white/10 text-gray-400 font-bold uppercase tracking-widest text-xs rounded-xl hover:bg-white/10 transition-all">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex-1 text-center sm:text-left space-y-4">
              <div>
                <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white leading-tight">
                  <InlineEditField value={person.first_name} onSave={v => handleInlineSave('first_name', v)} className="mr-2" />
                  <span className="text-gray-400">
                    <InlineEditField value={person.last_name} placeholder="Last name" onSave={v => handleInlineSave('last_name', v)} />
                  </span>
                </h1>
                <p className="text-rose-400 font-medium mt-1 text-sm">
                  <InlineEditField value={person.occupation} placeholder="Occupation…" onSave={v => handleInlineSave('occupation', v)} />
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                <Chip icon="🚻" label="Gender" value={person.gender} />
                <Chip icon="📍" label="Origin" value={person.birth_place} />
                <Chip icon="🎂" label="Born"
                  value={person.birth_date ? new Date(person.birth_date).toLocaleDateString('en-IN', { year:'numeric', month:'long', day:'numeric' }) : 'Unknown'} />
                {person.death_date && <Chip icon="🕊️" label="Passed" value={new Date(person.death_date).toLocaleDateString('en-IN', { year:'numeric', month:'long', day:'numeric' })} />}
                {calcAge(person.birth_date, person.death_date) !== null && (
                  <Chip icon="⏳" value={`${calcAge(person.birth_date, person.death_date)} yrs`} color="bg-amber-500/10 border border-amber-500/20 text-amber-300" />
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── PERSONAL GREETING ── */}
        <div className="flex items-center justify-between">
          <p className="text-gray-500 text-sm italic">✨ This is <span className="text-white font-semibold">{person.first_name}</span>'s story — build their legacy together.</p>
          <button
            onClick={() => setShowStory(true)}
            className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all duration-300 hover:shadow-[0_0_20px_rgba(225,29,72,0.3)] flex-shrink-0">
            📖 Generate Life Story
          </button>
        </div>

        {/* ── INSIGHTS PANEL ── */}
        <InsightsPanel memories={memories} relationships={relationships} person={person} />

        {/* ── PROFILE STRENGTH ── */}
        <ProfileStrengthBar person={person} memories={memories} relationships={relationships} />

        {/* ── MAIN GRID ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-7">

          {/* LEFT COL */}
          <div className="space-y-6">

            {/* Biography */}
            <BiographySection
              person={person}
              relationships={relationships}
              memories={memories}
              relPersons={relPersons}
              onBioUpdate={v => handleInlineSave('bio', v)}
            />

            {/* Mini Tree */}
            <section className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-xl">
              <h2 className="font-bold text-white flex items-center gap-2 mb-4 pb-4 border-b border-white/10">
                🌳 Position in Tree
              </h2>
              <MiniTreePreview
                person={person}
                relationships={relationships}
                relPersons={relPersons}
                onNodeClick={pid => navigate(demoPath(`/person/${pid}`))}
              />
            </section>

            {/* Family Members — grouped by role */}
            <section className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-xl">
              <h2 className="font-bold text-white flex items-center gap-2 mb-4 pb-4 border-b border-white/10">
                👨‍👩‍👧‍👦 Family Members
              </h2>
              <FamilySection
                relationships={relationships}
                currentId={id}
                relPersons={relPersons}
                personName={person.first_name}
                onNavigate={pid => navigate(demoPath(`/person/${pid}`))}
                onEdit={handleEditRelationship}
                onDelete={handleDeleteRelationship}
              />
            </section>
          </div>

          {/* RIGHT COL */}
          <div className="lg:col-span-2 space-y-7">

            {/* Legacy Mode Section */}
            <LegacySection
              personId={id}
              messages={legacyMessages}
              onMessageAdded={handleLegacyAdded}
            />

            {/* Life Story / Timeline */}
            <section className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-xl">
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/10">
                <h2 className="font-bold text-white text-xl flex items-center gap-2">📅 Life Story</h2>
                <span className="text-xs text-gray-600">{memories.length} event{memories.length !== 1 ? 's' : ''}</span>
              </div>
              <MemoryTimeline
                memories={memories}
                personName={person.first_name}
                onAddClick={() => memoryFormRef.current?.scrollIntoView({ behavior: 'smooth' })}
              />
            </section>

            {/* Add Memory */}
            <section ref={memoryFormRef} className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-rose-500/40 to-transparent" />
              <h2 className="font-bold text-white text-xl flex items-center gap-2 mb-6 pb-4 border-b border-white/10">
                ✍️ Add Memory
              </h2>
              <MemoryForm onSubmit={handleAddMemory} loading={savingMemory} />
            </section>
          </div>
        </div>
      </div>

      {/* Story Mode Modal */}
      {showStory && (
        <StoryModeModal
          person={person}
          memories={memories}
          relationships={relationships}
          relPersons={relPersons}
          onClose={() => setShowStory(false)}
          onSave={v => handleInlineSave('bio', v)}
        />
      )}

      {/* Confirm Dialog (delete person / delete relationship) */}
      {confirmState.open && (
        <Modal
          accent="red"
          center
          maxWidth="max-w-sm"
          onClose={() => setConfirmState({ open: false, message: '', onConfirm: null })}
        >
          <p className="text-gray-200 text-sm mb-6">{confirmState.message}</p>
          <div className="flex gap-3">
            <button
              onClick={() => setConfirmState({ open: false, message: '', onConfirm: null })}
              className="flex-1 py-2.5 px-5 bg-white/5 border border-white/10 text-gray-300 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white/10 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={confirmState.onConfirm}
              className="flex-1 py-2.5 px-5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all"
            >
              Confirm
            </button>
          </div>
        </Modal>
      )}

      {/* Edit Relationship Dialog */}
      {editRelState.open && (
        <Modal
          maxWidth="max-w-sm"
          onClose={() => setEditRelState({ open: false, relId: null, value: '' })}
        >
          <h3 className="text-white font-black text-lg mb-4">Edit Relationship Type</h3>
          <input
            autoFocus
            type="text"
            value={editRelState.value}
            onChange={(e) => setEditRelState(prev => ({ ...prev, value: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmEditRelationship();
              if (e.key === 'Escape') setEditRelState({ open: false, relId: null, value: '' });
            }}
            placeholder="parent / child / spouse / sibling"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-rose-500 mb-4"
          />
          <div className="flex gap-3">
            <button
              onClick={() => setEditRelState({ open: false, relId: null, value: '' })}
              className="flex-1 py-2.5 px-5 bg-white/5 border border-white/10 text-gray-300 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white/10 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={confirmEditRelationship}
              disabled={!editRelState.value.trim()}
              className="flex-1 py-2.5 px-5 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default PersonProfile;
