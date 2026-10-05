import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createPerson,
  createRelationship,
  getFamilyTree
} from '../services/familyService';
import FamilyTree from '../components/FamilyTree';
import GlobalSearchBar from '../components/SearchBar';
import CollaborationPanel from '../components/CollaborationPanel';
import ActivityFeed from '../components/ActivityFeed';
import SmartSuggestions from '../components/SmartSuggestions';
import GedcomImport from '../components/GedcomImport';
import UpcomingReminders from '../components/UpcomingReminders';
import FamilyInsightsPanel from '../components/FamilyInsightsPanel';
import bgImage from '../assets/hero-bg.png';

// ─────────────────────────────────────────────
// DESIGN HELPERS
// ─────────────────────────────────────────────
const Card = ({ children, className = '', accent = false }) => (
  <div className={`bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl relative overflow-hidden hover:border-white/15 transition-all duration-300 ${className}`}>
    {accent && <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-rose-500/50 to-transparent" />}
    {children}
  </div>
);

const CardHeader = ({ icon, title, sub }) => (
  <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/10">
    <span className="text-xl">{icon}</span>
    <div>
      <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
      {sub && <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">{sub}</p>}
    </div>
  </div>
);

const ViewerLockNotice = () => (
  <p className="mb-4 text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
    👁️ You have view-only access to this lineage.
  </p>
);

// ─────────────────────────────────────────────
// WORKSPACE SUMMARY
// ─────────────────────────────────────────────
const WorkspaceSummary = ({ nodes, edges }) => {
  const totalMembers = nodes.filter(n => n.data?.person).length;
  const totalRelationships = edges.length;

  const depth = useMemo(() => {
    if (!nodes.length) return 0;
    
    // Map child -> array of parents
    const parentsOf = {};
    nodes.forEach(n => { parentsOf[n.id] = []; });
    
    edges.forEach(e => {
      const t = e.data?.relationship_type?.toLowerCase();
      if ((t === 'parent' || t === 'child') && parentsOf[e.target]) {
        parentsOf[e.target].push(e.source);
      }
    });

    const depths = {};
    const getDepth = (id, visited = new Set()) => {
      if (depths[id]) return depths[id];
      if (visited.has(id)) return 1; // cycle breaker
      visited.add(id);
      
      const parents = parentsOf[id] || [];
      if (parents.length === 0) {
        depths[id] = 1;
        return 1;
      }
      
      const maxP = Math.max(...parents.map(pid => getDepth(pid, new Set(visited))));
      depths[id] = maxP + 1;
      return depths[id];
    };

    let maxDepth = 1;
    nodes.forEach(n => {
      const d = getDepth(n.id);
      if (d > maxDepth) maxDepth = d;
    });
    return maxDepth;
  }, [nodes, edges]);

  const stats = [
    { icon: '👤', label: 'Members', value: totalMembers, color: 'text-blue-400', tip: 'Total people in this tree' },
    { icon: '🔗', label: 'Relationships', value: totalRelationships, color: 'text-rose-400', tip: 'Total linked connections' },
    { icon: '🌳', label: 'Generations', value: depth, color: 'text-emerald-400', tip: 'Estimated tree depth' },
    { icon: '⏱️', label: 'Session', value: 'Live', color: 'text-amber-400', tip: 'Workspace is active' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
      {stats.map(s => (
        <div key={s.label} className="group relative bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-5 text-center hover:border-rose-500/20 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] transition-all duration-300 cursor-default">
          <div className="text-2xl mb-1 group-hover:scale-110 transition-transform duration-300">{s.icon}</div>
          <div className={`text-3xl font-black ${s.color}`}>{s.value}</div>
          <div className="text-xs text-gray-500 uppercase tracking-widest mt-1">{s.label}</div>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black border border-white/10 text-gray-300 text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-20">{s.tip}</div>
        </div>
      ))}
    </div>
  );
};


// ─────────────────────────────────────────────
// SMART MEMBER FORM
// ─────────────────────────────────────────────
const SmartMemberForm = ({ onSubmit, existingNodes }) => {
  const [form, setForm] = useState({ first_name: '', last_name: '', gender: '', birth_place: '' });
  const [submitting, setSubmitting] = useState(false);

  const duplicate = useMemo(() => {
    if (!form.first_name) return null;
    return existingNodes.find(n => {
      const p = n.data?.person;
      if (!p) return false;
      return `${p.first_name}`.toLowerCase().includes(form.first_name.toLowerCase());
    });
  }, [form.first_name, existingNodes]);

  const initial = (f, l) => `${f?.[0] || ''}${l?.[0] || ''}`.toUpperCase() || '?';
  const genderIcon = g => g?.toLowerCase() === 'male' ? '👨' : g?.toLowerCase() === 'female' ? '👩' : '👤';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    await onSubmit(form);
    setForm({ first_name: '', last_name: '', gender: '', birth_place: '' });
    setSubmitting(false);
  };

  const inputCls = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-rose-500 focus:bg-white/8 transition-all text-sm";

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-start">
      <div className="md:col-span-3 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="First Name *" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} className={inputCls} required />
          <input placeholder="Last Name" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })} className={`${inputCls} cursor-pointer`}>
            <option value="">Gender</option>
            <option value="Male">👨 Male</option>
            <option value="Female">👩 Female</option>
            <option value="Other">⚧ Other</option>
          </select>
          <input placeholder="Birth Place" value={form.birth_place} onChange={e => setForm({ ...form, birth_place: e.target.value })} className={inputCls} />
        </div>
        {duplicate && (
          <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 text-xs font-medium">
            ⚠️ Possible duplicate: <span className="font-bold">{duplicate.data.person.first_name} {duplicate.data.person.last_name}</span> already exists
          </div>
        )}
        <button type="button" onClick={handleSubmit} disabled={submitting || !form.first_name}
          className="w-full py-3.5 bg-white text-black font-bold uppercase tracking-widest text-sm rounded-xl hover:bg-rose-500 hover:text-white active:scale-95 transition-all duration-300 disabled:opacity-40 disabled:active:scale-100 hover:shadow-[0_0_25px_rgba(225,29,72,0.4)]">
          {submitting ? 'Adding…' : '+ Add to Tree'}
        </button>
      </div>

      <div className="md:col-span-2">
        <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-2 font-bold">Live Preview</p>
        <div className={`bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col items-center gap-3 text-center transition-all duration-500 ${form.first_name ? 'scale-[1.02] border-rose-500/50 bg-rose-900/20 shadow-[0_0_40px_rgba(225,29,72,0.25)]' : 'hover:border-white/20'}`}>
          <div className={`w-16 h-16 rounded-2xl border-2 flex items-center justify-center text-2xl font-black shadow-[0_0_20px_rgba(225,29,72,0.2)] transition-colors duration-500 ${form.gender === 'Female' ? 'bg-pink-500/20 border-pink-500/40 text-pink-400' : form.gender === 'Male' ? 'bg-blue-500/20 border-blue-500/40 text-blue-400' : 'bg-rose-500/20 border-rose-500/40 text-rose-400'}`}>
            {form.first_name ? initial(form.first_name, form.last_name) : genderIcon(form.gender)}
          </div>
          <div>
            <p className="text-white font-bold text-base transition-all">{form.first_name || 'First'} <span className="text-gray-400">{form.last_name || 'Last'}</span></p>
            {form.gender && <p className="text-xs text-gray-400 mt-0.5 font-medium">{genderIcon(form.gender)} {form.gender}</p>}
            {form.birth_place && <p className="text-xs text-gray-400 mt-0.5 font-medium">📍 {form.birth_place}</p>}
          </div>
          {!form.first_name && <p className="text-gray-500 text-xs italic animate-pulse tracking-wide">Start typing to preview this member</p>}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// RELATIONSHIP BUILDER
// ─────────────────────────────────────────────
const REL_LABELS = {
  parent: { label: 'Parent', icon: '👴', desc: 'is the parent of' },
  child:  { label: 'Child',  icon: '👶', desc: 'is the child of' },
  spouse: { label: 'Spouse', icon: '💍', desc: 'is married to' },
  sibling:{ label: 'Sibling',icon: '🤝', desc: 'is the sibling of' },
};

const RelationshipBuilder = ({ nodes, onSubmit }) => {
  const [rel, setRel] = useState({ person1_id: '', person2_id: '', relationship_type: '' });
  const [submitting, setSubmitting] = useState(false);

  const persons = nodes.filter(n => n.data?.person).map(n => n.data.person);
  const p1 = persons.find(p => p.id === rel.person1_id);
  const p2 = persons.find(p => p.id === rel.person2_id);
  const relMeta = REL_LABELS[rel.relationship_type];
  const ready = rel.person1_id && rel.person2_id && rel.relationship_type && rel.person1_id !== rel.person2_id;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    await onSubmit(rel);
    setRel({ person1_id: '', person2_id: '', relationship_type: '' });
    setSubmitting(false);
  };

  const selectCls = "bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-rose-500 text-sm transition-all cursor-pointer w-full";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm font-medium min-h-[60px] py-4">
          <span className={`px-4 py-2 rounded-xl border-2 font-black transition-all shadow-sm ${p1 ? 'bg-blue-900/30 border-blue-500 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.3)] scale-[1.02]' : 'bg-white/5 border-white/10 text-gray-600'}`}>
            {p1 ? `${p1.first_name} ${p1.last_name || ''}`.trim() : 'Person A'}
          </span>
          <div className="flex-1 flex flex-col items-center justify-center w-full min-w-[100px] relative px-4">
            <div className={`w-full h-0.5 hidden sm:block absolute top-[50%] -translate-y-1/2 transition-colors duration-500 ${ready ? 'bg-rose-500' : 'bg-white/10'}`} />
            {ready && <div className="hidden sm:block absolute top-[50%] -translate-y-1/2 right-4 w-2 h-2 border-t-2 border-r-2 border-rose-500 rotate-45 transform" />}
            <span className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest z-10 transition-colors ${ready ? 'bg-rose-500 text-white shadow-lg' : 'bg-black text-gray-600 border border-white/10'}`}>
              {relMeta ? relMeta.label : 'Link'}
            </span>
          </div>
          <span className={`px-4 py-2 rounded-xl border-2 font-black transition-all shadow-sm ${p2 ? 'bg-rose-900/30 border-rose-500 text-rose-300 shadow-[0_0_15px_rgba(225,29,72,0.3)] scale-[1.02]' : 'bg-white/5 border-white/10 text-gray-600'}`}>
            {p2 ? `${p2.first_name} ${p2.last_name || ''}`.trim() : 'Person B'}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select value={rel.person1_id} onChange={e => setRel({ ...rel, person1_id: e.target.value })} className={selectCls} required>
            <option value="">👤 Person A</option>
            {persons.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name || ''}</option>)}
          </select>
          <select value={rel.relationship_type} onChange={e => setRel({ ...rel, relationship_type: e.target.value })} className={`${selectCls} text-center font-bold`} required>
            <option value="">— Role —</option>
            {Object.entries(REL_LABELS).map(([v, m]) => <option key={v} value={v}>{m.icon} {m.label}</option>)}
          </select>
          <select value={rel.person2_id} onChange={e => setRel({ ...rel, person2_id: e.target.value })} className={selectCls} required>
            <option value="">👤 Person B</option>
            {persons.filter(p => p.id !== rel.person1_id).map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name || ''}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(REL_LABELS).map(([val, meta]) => (
            <button key={val} type="button" onClick={() => setRel({ ...rel, relationship_type: val })}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all ${rel.relationship_type === val ? 'bg-rose-500 border-rose-500 text-white shadow-[0_0_15px_rgba(225,29,72,0.4)]' : 'bg-white/5 border-white/10 text-gray-400 hover:border-rose-500/40'}`}>
              {meta.icon} {meta.label}
            </button>
          ))}
        </div>
      </div>
      <button type="submit" disabled={!ready || submitting}
        className="w-full py-4 bg-gradient-to-r from-rose-600 to-rose-500 text-white font-bold uppercase tracking-widest text-sm rounded-xl hover:shadow-[0_0_35px_rgba(225,29,72,0.5)] transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.99]">
        {submitting ? 'Forging link…' : '⚡ Establish Connection'}
      </button>
    </form>
  );
};

// ─────────────────────────────────────────────
// ISOLATED BACKGROUND
// ─────────────────────────────────────────────
// Prevents global re-renders on mouse movement
const InteractiveBackground = memo(() => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  
  useEffect(() => {
    let ticking = false;
    const mm = (e) => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setMousePos({ x: (e.clientX / window.innerWidth) * 100, y: (e.clientY / window.innerHeight) * 100 });
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('mousemove', mm, { passive: true });
    return () => window.removeEventListener('mousemove', mm);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 opacity-40" style={{ background: `radial-gradient(circle at ${mousePos.x}% ${mousePos.y}%, rgba(225,29,72,0.12), transparent 45%)` }} />
  );
});
InteractiveBackground.displayName = 'InteractiveBackground';

// ─────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────
const FamilyTreePage = () => {
  const navigate = useNavigate();
  const [selectedFamily, setSelectedFamily] = useState('');
  const [treeData, setTreeData] = useState({ nodes: [], edges: [] });
  const [error, setError] = useState('');
  const [isDemo, setIsDemo] = useState(false);
  const [myRole, setMyRole] = useState('owner');
  const isViewer = myRole === 'viewer';


  const [activities, setActivities] = useState([]);
  const activityIdRef = useRef(0);

  const pushActivity = useCallback((type, message) => {
    const id = ++activityIdRef.current;
    setActivities(prev => [{ id, type, message, timestamp: Date.now() }, ...prev]);
  }, []);

  useEffect(() => {
    const demo = new URLSearchParams(window.location.search).get('demo') === 'true';
    const familyId = localStorage.getItem('selectedFamily') || (demo ? 'demo-family-123' : null);
    if (!familyId) { navigate('/dashboard'); return; }
    setSelectedFamily(familyId);
    setIsDemo(demo);

    if (demo) {
      setTreeData({
        nodes: [
          { id: 'n1', position: { x: 0, y: 0 }, data: { person: { id: 'n1', first_name: 'Ramesh', last_name: 'Sharma', gender: 'Male', birth_place: 'Jaipur' } } },
          { id: 'n2', position: { x: 250, y: 0 }, data: { person: { id: 'n2', first_name: 'Sunita', last_name: 'Sharma', gender: 'Female' } } },
          { id: 'n3', position: { x: 125, y: 150 }, data: { person: { id: 'n3', first_name: 'Rohan', last_name: 'Sharma', gender: 'Male' } } },
          { id: 'n4', position: { x: 375, y: 150 }, data: { person: { id: 'n4', first_name: 'Meena', last_name: 'Kapoor', gender: 'Female' } } },
        ],
        edges: [
          { id: 'e1', source: 'n1', target: 'n2', data: { relationship_type: 'spouse' } },
          { id: 'e2', source: 'n1', target: 'n3', data: { relationship_type: 'parent' } },
          { id: 'e3', source: 'n2', target: 'n3', data: { relationship_type: 'parent' } },
          { id: 'e4', source: 'n4', target: 'n2', data: { relationship_type: 'sibling' } },
        ]
      });
    } else {
      fetchTree(familyId);
    }
  }, [navigate]);

  const fetchTree = async (familyId) => {
    try {
      const data = await getFamilyTree(familyId);
      setTreeData({ nodes: data.nodes || [], edges: data.edges || [] });
      if (data.my_role) setMyRole(data.my_role);
    } catch { setError('Failed to fetch family tree.'); }
  };

  // Adds the newly-created person straight into local state instead of
  // re-fetching the whole tree over the network for a single new node.
  const addPersonNode = useCallback((person) => {
    setTreeData(prev => ({
      ...prev,
      nodes: [...prev.nodes, { id: person.id, position: { x: 0, y: 0 }, data: { person } }],
    }));
  }, []);

  // Same idea for relationships — append the new edge locally.
  const addRelationshipEdge = useCallback((relationship) => {
    setTreeData(prev => ({
      ...prev,
      edges: [...prev.edges, {
        id: relationship.id,
        source: relationship.person1_id,
        target: relationship.person2_id,
        data: { relationship_type: relationship.relationship_type },
      }],
    }));
  }, []);

  // demo-family-123 isn't a real DB row, so any write against it would just
  // fail unauthenticated — short-circuit with a clear notice instead.
  const blockIfDemo = useCallback(() => {
    if (!isDemo) return false;
    setError('This is a preview lineage — sign up to build your own.');
    setTimeout(() => setError(''), 3000);
    return true;
  }, [isDemo]);

  const handleCreatePerson = async (formData) => {
    if (!selectedFamily || blockIfDemo()) return;
    try {
      const person = await createPerson({ ...formData, family_id: selectedFamily });
      addPersonNode(person);
      pushActivity('added_person', `Added ${formData.first_name} ${formData.last_name || ''}`.trim());
    } catch { setError('Failed to create person.'); }
  };

  // Used by QuickAddForm inside graph — must return the new person object
  const handleAddPersonFromGraph = useCallback(async (formData) => {
    if (!selectedFamily || blockIfDemo()) return null;
    try {
      const person = await createPerson({ ...formData, family_id: selectedFamily });
      addPersonNode(person);
      pushActivity('added_person', `Added ${formData.first_name} from graph`);
      return person;
    } catch { setError('Failed to create person.'); return null; }
  }, [selectedFamily, pushActivity, addPersonNode, blockIfDemo]);

  const handleCreateRelationship = async (relData) => {
    if (!selectedFamily || blockIfDemo()) return;
    try {
      const relationship = await createRelationship(relData);
      const p1 = treeData.nodes.find(n => n.data?.person?.id === relData.person1_id)?.data?.person;
      const p2 = treeData.nodes.find(n => n.data?.person?.id === relData.person2_id)?.data?.person;
      pushActivity('added_relationship', `Linked ${p1?.first_name || '?'} as ${relData.relationship_type} of ${p2?.first_name || '?'}`);
      addRelationshipEdge(relationship);
    } catch { setError('Failed to link family members.'); }
  };

  const handleNodeClick = useCallback((personId) => {
    navigate(isDemo ? `/person/${personId}?demo=true` : `/person/${personId}`);
  }, [navigate, isDemo]);


  return (
    <div className="min-h-screen bg-black text-white relative overflow-x-hidden font-sans selection:bg-rose-500/30">
      <InteractiveBackground />
      <div className="fixed inset-0 z-[-1] bg-cover bg-center opacity-20 brightness-50" style={{ backgroundImage: `url(${bgImage})` }} />
      <div className="fixed inset-0 z-[-1] bg-gradient-to-b from-black/70 via-transparent to-black/90" />

      <div className="relative z-10 p-6 md:p-10 max-w-[1600px] mx-auto">

        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 pb-6 border-b border-white/10 gap-6 animate-in fade-in slide-in-from-top-4 duration-1000 fill-mode-both">
          <div>
            <div className="flex items-center gap-4">
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500 drop-shadow-md">KUTUMB WORKSPACE</h1>
              {isDemo && (
                <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/40 text-amber-500 text-[10px] font-black uppercase tracking-widest rounded-lg shadow-[0_0_15px_rgba(245,158,11,0.2)]">Demo Lineage</span>
              )}
            </div>
            <p className="text-gray-400 text-sm mt-1 mb-1 font-medium tracking-wide">Build, preserve and explore your family legacy.</p>
            <p className="text-xs font-bold text-rose-500 tracking-[0.3em] uppercase mt-2">KUTUMB ORIGIN ID · {selectedFamily.substring(0, 8)}</p>
          </div>
          <div className="flex gap-3 items-center flex-wrap relative z-50">
            <div className="bg-white/5 backdrop-blur-md rounded-xl p-1 border border-white/10 relative z-50 shadow-xl"><GlobalSearchBar /></div>
            <button onClick={() => navigate('/dashboard')} className="px-5 py-2.5 border border-white/20 bg-white/5 backdrop-blur-md rounded-xl text-white font-bold tracking-widest uppercase text-xs hover:bg-white hover:text-black active:scale-95 transition-all duration-300">Exit Workspace</button>
            <button
              onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('selectedFamily'); navigate('/login'); }}
              title="Log out"
              className="px-5 py-2.5 border border-white/10 bg-white/5 backdrop-blur-md rounded-xl text-gray-400 font-bold tracking-widest uppercase text-xs hover:bg-rose-500 hover:text-white hover:border-rose-400/50 active:scale-95 transition-all duration-300"
            >
              Logout
            </button>
          </div>
        </header>

        {/* WORKSPACE SUMMARY & INSIGHTS */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-150 fill-mode-both">
          <div className="xl:col-span-1">
            <WorkspaceSummary nodes={treeData.nodes} edges={treeData.edges} />
          </div>
          <div className="xl:col-span-2">
            <Card className="h-full">
              <CardHeader icon="🧠" title="Smart Insights" sub="Automated tree analytics" />
              <FamilyInsightsPanel nodes={treeData.nodes} edges={treeData.edges} />
            </Card>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/40 border border-red-500/50 rounded-xl text-red-200 text-sm font-medium flex items-center gap-3">⚠️ {error}</div>
        )}

        {/* TOP TOOLS ROW: Collaborate + GEDCOM */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300 fill-mode-both">
          <Card className="p-6">
            <CardHeader icon="🤝" title="Collaborate" sub="Manage team access" />
            <CollaborationPanel familyId={isDemo ? null : selectedFamily} isOwner={myRole === 'owner'} onActivity={(msg) => pushActivity('default', msg)} />
          </Card>
          <Card className="p-6">
            {isViewer && <ViewerLockNotice />}
            <div className={isViewer ? 'opacity-40 pointer-events-none select-none' : ''}>
              <GedcomImport
                familyId={isDemo ? null : selectedFamily}
                onImportSuccess={(data) => {
                  setTreeData(data);
                  pushActivity('imported_gedcom', 'Imported a GEDCOM file');
                }}
              />
            </div>
          </Card>
        </div>

        {/* MEMBER + RELATIONSHIP */}
        <div id="add-member-section" className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-500 fill-mode-both">
          <Card className="p-8" accent>
            <CardHeader icon="👤" title="Add Member" sub="Spawn a new node" />
            {isViewer && <ViewerLockNotice />}
            <div className={isViewer ? 'opacity-40 pointer-events-none select-none' : ''}>
              <SmartMemberForm onSubmit={handleCreatePerson} existingNodes={treeData.nodes} />
            </div>
          </Card>
          <Card className="p-8" accent>
            <CardHeader icon="⚡" title="Build Relationship" sub="Forge a family link" />
            {isViewer && <ViewerLockNotice />}
            <div className={isViewer ? 'opacity-40 pointer-events-none select-none' : ''}>
              <RelationshipBuilder nodes={treeData.nodes} onSubmit={handleCreateRelationship} />
            </div>
          </Card>
        </div>

        {/* SMART SUGGESTIONS */}
        <Card className="p-6 mb-6 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-700 fill-mode-both">
          <CardHeader icon="🧠" title="Smart Suggestions" sub="Automated tree insights" />
          <SmartSuggestions
            nodes={treeData.nodes}
            edges={treeData.edges}
            onAction={(actionType) => {
              if (actionType === 'add_member') {
                document.getElementById('add-member-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }}
          />
        </Card>

        {/* LINEAGE MAP + SIDE PANELS */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-1000 fill-mode-both">
          {/* Map (2/3 width) */}
          <section className="xl:col-span-2 bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl flex flex-col">
            <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center">
              <h3 className="text-base font-bold text-white flex items-center gap-2">🌳 Lineage Map</h3>
              <span className="text-xs text-gray-600">{treeData.nodes.filter(n => n.data?.person).length} members</span>
            </div>
            <div className="relative w-full" style={{ height: '720px' }}>
              <FamilyTree
                nodes={treeData.nodes}
                edges={treeData.edges}
                onNodeClick={handleNodeClick}
                onAddPerson={handleAddPersonFromGraph}
                onAddRelationship={async (relData) => {
                  await handleCreateRelationship(relData);
                }}
              />
            </div>
          </section>

          {/* Right column: Activity feed + Upcoming events */}
          <div className="space-y-6">
            <Card className="p-6 h-[400px] flex flex-col">
              <CardHeader icon="📡" title="Activity Feed" sub="Real-time workspace log" />
              <div className="flex-1 overflow-hidden">
                <ActivityFeed activities={activities} onClear={() => setActivities([])} />
              </div>
            </Card>

            <Card className="p-6">
              <CardHeader icon="📅" title="Upcoming Events" sub="Ancestral reminders" />
              <UpcomingReminders familyId={isDemo ? null : selectedFamily} />
            </Card>
          </div>
        </div>

      </div>
    </div>
  );
};

export default FamilyTreePage;
