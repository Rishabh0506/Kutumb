import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getFamilies, createFamily, deleteFamily, updateFamily } from "../services/familyService";
import bgImage from "../assets/hero-bg.png";
import CanvasNetwork from "../components/CanvasNetwork";
import Modal from "../components/Modal";
import GettingStartedChecklist from "../components/GettingStartedChecklist";
import { useToast } from "../context/ToastContext";

// ─────────────────────────────────────────────
// MINI LINEAGE CANVAS — renders inside each card on hover
// ─────────────────────────────────────────────
const CardLineageCanvas = ({ active }) => {
  const canvasRef = useRef(null);
  const animRef   = useRef(null);
  const nodesRef  = useRef([]);
  // Read via ref inside the rAF loop so hovering doesn't tear down and
  // restart the whole loop (and its canvas/context setup) on every toggle.
  const activeRef = useRef(active);
  useEffect(() => { activeRef.current = active; }, [active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    // Resizing the canvas backing store is expensive (implicitly clears
    // and reallocates it) — do it only when the element's actual displayed
    // size changes, never on every animation frame.
    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    // Fixed seed nodes so they don't re-randomise every render
    if (nodesRef.current.length === 0) {
      for (let i = 0; i < 10; i++) {
        nodesRef.current.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          r: Math.random() * 1.8 + 1,
          glow: Math.random(),
          glowDir: Math.random() > 0.5 ? 0.025 : -0.025,
        });
      }
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const alpha = activeRef.current ? 1 : 0.3;

      nodesRef.current.forEach(n => {
        n.glow += n.glowDir;
        if (n.glow > 1 || n.glow < 0) n.glowDir *= -1;

        ctx.beginPath();
        ctx.arc(n.x * (canvas.width / 320), n.y * (canvas.height / 200), n.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(225, 29, 72, ${n.glow * 0.8 * alpha})`;
        ctx.shadowBlur = activeRef.current ? 10 : 4;
        ctx.shadowColor = "rgba(225,29,72,0.6)";
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      const ns = nodesRef.current;
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const ax = ns[i].x * (canvas.width / 320);
          const ay = ns[i].y * (canvas.height / 200);
          const bx = ns[j].x * (canvas.width / 320);
          const by = ns[j].y * (canvas.height / 200);
          const dist = Math.hypot(ax - bx, ay - by);
          if (dist < 90) {
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.strokeStyle = `rgba(225, 29, 72, ${(0.18 - dist / 500) * alpha})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animRef.current);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none rounded-2xl"
      style={{ opacity: active ? 1 : 0.25, transition: "opacity 0.4s ease" }}
    />
  );
};

// ─────────────────────────────────────────────
// LINEAGE CARD
// ─────────────────────────────────────────────
const LineageCard = ({ fam, isLastOpened, onSelect, onUpdate, onDelete, formatDate, transitioning }) => {
  const [hovered, setHovered] = useState(false);
  const isOwner = fam.my_role ? fam.my_role === 'owner' : true;

  return (
    <div
      onClick={() => onSelect(fam.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`
        group cursor-pointer p-6 rounded-2xl
        bg-gradient-to-br from-black/60 to-black/40
        border transition-all duration-500 ease-out
        shadow-[0_10px_20px_rgba(0,0,0,0.5)]
        flex flex-col h-56 backdrop-blur-2xl relative overflow-hidden
        ${transitioning ? "scale-105 opacity-0" : "scale-100 opacity-100"}
        ${hovered ? "-translate-y-2 shadow-[0_25px_50px_rgba(225,29,72,0.2)]" : ""}
        ${isLastOpened
          ? "border-rose-500/40 shadow-[0_0_20px_rgba(225,29,72,0.12)]"
          : "border-white/5 hover:border-rose-500/30"}
      `}
      style={{ transition: transitioning ? "transform 0.45s ease, opacity 0.45s ease" : "all 0.5s ease" }}
    >
      {/* Living mini-canvas background */}
      <CardLineageCanvas active={hovered} />

      {/* Dark overlay so text stays crisp */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/30 to-black/70 pointer-events-none rounded-2xl z-[1]" />

      {/* Hover gradient wash */}
      <div className={`absolute inset-0 bg-gradient-to-br from-rose-500/8 to-transparent pointer-events-none rounded-2xl z-[1] transition-opacity duration-400 ${hovered ? "opacity-100" : "opacity-0"}`} />

      {/* Large letter watermark */}
      <div className="absolute top-0 right-0 p-4 pointer-events-none z-[1]">
        <span className={`text-8xl font-black text-rose-500 mix-blend-screen transition-opacity duration-400 ${hovered ? "opacity-15" : "opacity-5"}`}>
          {fam.family_name[0].toUpperCase()}
        </span>
      </div>

      {/* Card content */}
      <div className="z-[5] flex justify-between items-start w-full gap-2 relative">
        <div className="flex-1">
          <div className="flex flex-wrap gap-2 mb-3">
            {isLastOpened && (
              <span className="inline-block px-2 py-0.5 bg-rose-500/10 border border-rose-500/30 rounded-md text-[10px] font-black tracking-widest text-rose-400 uppercase">
                Last Opened
              </span>
            )}
            {!isOwner && (
              <span className="inline-block px-2 py-0.5 bg-blue-500/10 border border-blue-500/30 rounded-md text-[10px] font-black tracking-widest text-blue-400 uppercase">
                Shared · {fam.my_role}
              </span>
            )}
          </div>
          <h4 className={`text-2xl font-bold mb-1 tracking-tight truncate pr-2 transition-colors duration-300 ${hovered ? "text-white" : "text-gray-100"}`}>
            {fam.family_name}
          </h4>
          <p className="text-xs text-gray-400 font-medium tracking-wide leading-relaxed">
            {fam.member_count || 0} family members recorded<br />
            Last chapter added {formatDate(fam.updated_at)}
          </p>
        </div>

        {isOwner && (
          <div className={`flex gap-2 transition-opacity duration-300 bg-black/60 p-1.5 rounded-lg border border-white/5 backdrop-blur-md shadow-lg shrink-0 ${hovered ? "opacity-100" : "opacity-0"}`}>
            <button onClick={(e) => onUpdate(e, fam.id, fam.family_name)} className="text-gray-400 hover:text-white transition-colors p-1" title="Rename">✏️</button>
            <button onClick={(e) => onDelete(e, fam.id)} className="text-gray-400 hover:text-rose-500 transition-colors p-1" title="Delete">🗑️</button>
          </div>
        )}
      </div>

      <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest z-[5] mb-auto mt-4 mix-blend-screen relative">
        ID: {fam.id.substring(0, 8)}
      </p>

      <div className="z-[5] flex items-center justify-between w-full mt-4 pt-4 border-t border-white/5 relative">
        <span className={`text-sm font-bold transition-all duration-300 drop-shadow-sm underline-offset-4 ${hovered ? "text-rose-300 underline decoration-rose-500/30" : "text-gray-400"}`}>
          Enter this story
        </span>
        <span className={`w-8 h-8 rounded-full border flex items-center justify-center text-white font-black transition-all duration-400 shadow-inner ${hovered ? "bg-rose-500 border-rose-400 translate-x-1.5 shadow-[0_0_15px_rgba(225,29,72,0.6)]" : "bg-white/5 border-white/5"}`}>
          →
        </span>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────
const Dashboard = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [families, setFamilies]       = useState([]);
  const [newFamilyName, setNewFamilyName] = useState("");
  const [loading, setLoading]         = useState(false);
  const [mousePos, setMousePos]       = useState({ x: 0, y: 0 });
  const [transitioningId, setTransitioningId] = useState(null);

  // Modal States
  const [deleteModalState, setDeleteModalState] = useState({ isOpen: false, familyId: null, isDeleting: false });
  const [renameModalState, setRenameModalState] = useState({ isOpen: false, familyId: null, currentName: '', newName: '', isSaving: false });

  const fetchFamilies = useCallback(async () => {
    try {
      const response = await getFamilies();
      const familyList = response?.data || response || [];
      familyList.sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0));
      setFamilies(familyList);
    } catch (err) {
      addToast("Failed to fetch lineages.", "error");
    }
  }, [addToast]);

  useEffect(() => {
    fetchFamilies();
    const handleMouseMove = (e) =>
      setMousePos({ x: (e.clientX / window.innerWidth) * 100, y: (e.clientY / window.innerHeight) * 100 });
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [fetchFamilies]);

  // Smooth zoom-fade transition before navigating
  const handleFamilySelect = useCallback((familyId) => {
    if (!familyId) return;
    setTransitioningId(familyId);
    localStorage.setItem("selectedFamily", familyId);
    setTimeout(() => navigate("/family-tree"), 450);
  }, [navigate]);

  const handleDeleteFamily = (e, familyId) => {
    e.stopPropagation();
    setDeleteModalState({ isOpen: true, familyId, isDeleting: false });
  };

  const confirmDeleteFamily = async () => {
    const { familyId } = deleteModalState;
    if (!familyId) return;
    
    setDeleteModalState(prev => ({ ...prev, isDeleting: true }));
    try {
      await deleteFamily(familyId);
      if (localStorage.getItem("selectedFamily") === familyId) localStorage.removeItem("selectedFamily");
      addToast("Lineage successfully eradicated.", "success");
      fetchFamilies();
    } catch { 
      addToast("Failed to delete lineage.", "error"); 
    } finally {
      setDeleteModalState({ isOpen: false, familyId: null, isDeleting: false });
    }
  };

  const handleUpdateFamily = (e, familyId, currentName) => {
    e.stopPropagation();
    setRenameModalState({ isOpen: true, familyId, currentName, newName: currentName, isSaving: false });
  };

  const confirmUpdateFamily = async () => {
    const { familyId, currentName, newName } = renameModalState;
    if (!newName || newName.trim() === currentName) {
      setRenameModalState({ isOpen: false, familyId: null, currentName: '', newName: '', isSaving: false });
      return;
    }
    
    setRenameModalState(prev => ({ ...prev, isSaving: true }));
    try {
      await updateFamily(familyId, { family_name: newName.trim() });
      addToast("Lineage renamed successfully.", "success");
      fetchFamilies();
    } catch { 
      addToast("Failed to rename lineage.", "error"); 
    } finally {
      setRenameModalState({ isOpen: false, familyId: null, currentName: '', newName: '', isSaving: false });
    }
  };

  const handleCreateFamily = async (e) => {
    e.preventDefault();
    if (!newFamilyName.trim()) { addToast("Lineage name cannot be empty.", "error"); return; }
    setLoading(true);
    try {
      const response = await createFamily({ family_name: newFamilyName.trim() });
      const created = response?.data || response;
      if (!created?.id) throw new Error("Invalid family response");
      localStorage.setItem("selectedFamily", created.id);
      addToast("Lineage forged successfully.", "success");
      navigate("/family-tree");
    } catch { 
      addToast("Failed to forge new lineage.", "error"); 
    } finally { 
      setLoading(false); 
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Recently";
    return new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const scrollToCreateForm = () => {
    document.getElementById("establish-origin")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("selectedFamily");
    navigate("/login");
  };

  const lastOpenedId = useMemo(() => {
    const selected = localStorage.getItem("selectedFamily");
    if (selected && families.some(f => f.id === selected)) return selected;
    return families.length > 0 ? families[0].id : null;
  }, [families]);

  return (
    <>
      <style>{`
        @keyframes statusPulse {
          0%, 100% { transform: scale(1); opacity: 0.8; box-shadow: 0 0 5px rgba(52,211,153,0.4); }
          50% { transform: scale(1.15); opacity: 1; box-shadow: 0 0 16px rgba(52,211,153,0.9); }
        }
        .animate-status-dot { animation: statusPulse 2.5s ease-in-out infinite; }
      `}</style>

      <div className="min-h-screen bg-black text-white relative overflow-hidden selection:bg-rose-500/30 font-sans flex flex-col items-center">

        {/* Mouse-tracking spotlight */}
        <div
          className="pointer-events-none fixed inset-0 z-0 opacity-30 transition-opacity duration-500"
          style={{ background: `radial-gradient(circle at ${mousePos.x}% ${mousePos.y}%, rgba(225,29,72,0.22), transparent 45%)` }}
        />

        {/* Background image */}
        <div
          className="fixed inset-0 z-[-2] bg-cover bg-center opacity-40 brightness-50"
          style={{ backgroundImage: `url(${bgImage})` }}
        />
        {/* Global canvas network */}
        <CanvasNetwork mousePos={mousePos} />
        <div className="fixed inset-0 z-[-1] bg-gradient-to-b from-black/80 via-black/50 to-black/90 pointer-events-none" />

        {/* Main content */}
        <div className="z-10 w-full max-w-7xl p-6 md:p-12 mb-20">

          {/* ── HEADER ── */}
          <header className="mb-14 border-b border-white/10 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 animate-in fade-in slide-in-from-top-4 duration-700 fill-mode-both">
            <div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-300 to-gray-500 drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                Where Your Story Continues.
              </h1>
              <p className="text-sm md:text-base text-gray-400 mt-3 font-medium tracking-wide">
                Choose a lineage to explore or begin a new chapter.
              </p>
            </div>

            <div className="flex items-start gap-4">
              {/* Emotional stats block */}
              <div className="flex gap-4 md:gap-8 bg-black/40 backdrop-blur-xl border border-white/5 px-6 py-4 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                <div className="flex flex-col">
                  <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Active Stories</span>
                  <span className="text-2xl font-black text-white drop-shadow-md">{families.length}</span>
                </div>
                <div className="w-px bg-white/10" />
                <div className="flex flex-col">
                  <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">Legacy Status</span>
                  <span className="text-sm font-bold text-emerald-400 flex items-center gap-2 mt-1 tracking-wide">
                    <span className="relative w-2.5 h-2.5">
                      <span className="absolute inset-0 rounded-full bg-emerald-400 animate-status-dot" />
                      <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-20" />
                    </span>
                    Preserving your legacy
                  </span>
                </div>
              </div>

              <button
                onClick={handleLogout}
                title="Log out"
                className="px-5 py-2.5 h-full border border-white/10 bg-black/40 backdrop-blur-xl rounded-xl text-gray-400 font-bold tracking-widest uppercase text-xs hover:bg-rose-500 hover:text-white hover:border-rose-400/50 active:scale-95 transition-all duration-300"
              >
                Logout
              </button>
            </div>
          </header>

          {/* ── GETTING STARTED ── */}
          <GettingStartedChecklist
            families={families}
            onCreateLineage={scrollToCreateForm}
            onGoToTree={() => handleFamilySelect(lastOpenedId)}
          />

          {/* ── GRID ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">

            {/* Left: Lineage cards */}
            <section className="lg:col-span-2 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150 fill-mode-both">
              <h3 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3 drop-shadow-md">
                Your Ancestral Horizons
                <span className="h-px bg-gradient-to-r from-rose-500 to-transparent flex-1 ml-4 opacity-30" />
              </h3>

              {families.length === 0 ? (
                <div className="bg-black/40 border border-white/5 p-10 rounded-2xl flex flex-col items-center justify-center text-center backdrop-blur-2xl shadow-xl">
                  <div className="text-5xl mb-4 opacity-40">🧭</div>
                  <h4 className="text-xl font-bold text-gray-200 mb-2">No Lineages Found</h4>
                  <p className="text-gray-400 text-sm max-w-sm">You haven't established any family trees yet. Begin a new chapter on the right.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {families.map((fam) => (
                      <LineageCard
                        key={fam.id}
                        fam={fam}
                        isLastOpened={fam.id === lastOpenedId}
                        onSelect={handleFamilySelect}
                        onUpdate={handleUpdateFamily}
                        onDelete={handleDeleteFamily}
                        formatDate={formatDate}
                        transitioning={transitioningId === fam.id}
                      />
                    ))}
                  </div>

                  {/* Continue lineage prompt */}
                  <div className="mt-10 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Keep Going</h4>
                    <div
                      onClick={() => handleFamilySelect(lastOpenedId)}
                      className="p-4 bg-black/40 border border-white/5 rounded-xl hover:bg-white/5 hover:border-rose-500/30 transition-all duration-300 cursor-pointer flex items-center gap-3 group shadow-lg backdrop-blur-md"
                    >
                      <span className="text-xl group-hover:scale-110 transition-transform origin-left">🌳</span>
                      <p className="text-xs font-medium text-gray-300 group-hover:text-white transition-colors">Continue building your lineage — add people, connect relationships, and record memories</p>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Right: Create lineage */}
            <section id="establish-origin" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 fill-mode-both">
              <h3 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3 drop-shadow-md">
                Begin a New Chapter
                <span className="h-px bg-gradient-to-r from-rose-500 to-transparent flex-1 ml-4 opacity-30" />
              </h3>

              <div className="bg-black/40 border border-white/5 p-8 rounded-2xl backdrop-blur-2xl shadow-[-15px_0_40px_rgba(0,0,0,0.6)] relative overflow-hidden group transition-all duration-500 hover:shadow-[0_0_50px_rgba(225,29,72,0.18)] hover:border-rose-500/30">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-rose-600 via-rose-500 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />

                <div className="mb-8 relative z-10">
                  <p className="text-sm text-gray-300 leading-relaxed font-medium">
                    Start a new lineage and preserve stories for generations to come.
                  </p>
                  <p className="text-[10px] text-rose-500/80 font-black uppercase tracking-widest mt-4 group-hover:text-rose-400 transition-colors">
                    Preserve Your Legacy
                  </p>
                </div>

                <form onSubmit={handleCreateFamily} className="space-y-6 relative z-10">
                  <div className="space-y-1.5 group/input">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest group-focus-within/input:text-rose-400 transition-colors duration-300">
                      Lineage Name
                    </label>
                    <input
                      placeholder="e.g. The Sharma Family"
                      value={newFamilyName}
                      onChange={(e) => setNewFamilyName(e.target.value)}
                      required
                      className="w-full bg-white/5 border border-white/10 hover:border-white/20 px-4 py-3.5 text-white placeholder-gray-600 focus:outline-none focus:border-rose-500/80 focus:bg-white/10 transition-all duration-300 rounded-xl focus:shadow-[inset_0_2px_10px_rgba(225,29,72,0.05),0_0_15px_rgba(225,29,72,0.25)]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 mt-2 bg-gradient-to-r from-rose-600 to-rose-500 border border-rose-400/30 text-white font-black tracking-[0.2em] uppercase text-xs rounded-xl shadow-[0_5px_15px_rgba(225,29,72,0.3)] hover:shadow-[0_15px_40px_rgba(225,29,72,0.55)] hover:from-rose-500 hover:to-orange-500 hover:scale-[1.02] active:scale-[0.97] transition-all duration-500 disabled:opacity-50 flex items-center justify-center gap-3 relative overflow-hidden group/btn"
                  >
                    {loading ? (
                      <span className="animate-pulse">Forging...</span>
                    ) : (
                      <>
                        <div className="absolute inset-0 bg-white/20 blur-md opacity-0 group-hover/btn:opacity-100 group-hover/btn:animate-pulse transition-opacity duration-300" />
                        <span className="relative z-10 flex items-center gap-2">Begin this Story <span className="text-xl leading-none -mt-0.5">+</span></span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </section>

          </div>
        </div>
      </div>

      {/* ── DELETE MODAL ── */}
      {deleteModalState.isOpen && (
        <Modal
          accent="red"
          center
          closeDisabled={deleteModalState.isDeleting}
          onClose={() => setDeleteModalState({ isOpen: false, familyId: null, isDeleting: false })}
        >
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-black text-white mb-2">Obliterate Lineage?</h2>
          <p className="text-gray-400 text-sm mb-8">This action is permanent and irreversible. All descendants, memories, and connections will be lost forever.</p>
          <div className="flex gap-3">
            <button
              onClick={() => setDeleteModalState({ isOpen: false, familyId: null, isDeleting: false })}
              disabled={deleteModalState.isDeleting}
              className="flex-1 py-3 px-5 bg-white/5 border border-white/10 text-gray-300 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white/10 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={confirmDeleteFamily}
              disabled={deleteModalState.isDeleting}
              className="flex-1 py-3 px-5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {deleteModalState.isDeleting ? <span className="animate-pulse">Deleting...</span> : 'Yes, Delete'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── RENAME MODAL ── */}
      {renameModalState.isOpen && (
        <Modal
          closeDisabled={renameModalState.isSaving}
          onClose={() => setRenameModalState({ isOpen: false, familyId: null, currentName: '', newName: '', isSaving: false })}
        >
          <h2 className="text-2xl font-black text-white mb-2">Rename Lineage</h2>
          <p className="text-gray-400 text-sm mb-6">Enter a new name for your family tree.</p>

          <input
            autoFocus
            type="text"
            value={renameModalState.newName}
            onChange={(e) => setRenameModalState(prev => ({ ...prev, newName: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmUpdateFamily();
              if (e.key === 'Escape') setRenameModalState({ isOpen: false, familyId: null, currentName: '', newName: '', isSaving: false });
            }}
            className="w-full bg-white/5 border border-white/10 hover:border-white/20 px-4 py-3.5 text-white placeholder-gray-600 focus:outline-none focus:border-rose-500/80 focus:bg-white/10 transition-all duration-300 rounded-xl mb-8"
            placeholder="Lineage Name"
          />

          <div className="flex gap-3">
            <button
              onClick={() => setRenameModalState({ isOpen: false, familyId: null, currentName: '', newName: '', isSaving: false })}
              disabled={renameModalState.isSaving}
              className="flex-1 py-3 px-5 bg-white/5 border border-white/10 text-gray-300 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white/10 transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={confirmUpdateFamily}
              disabled={renameModalState.isSaving || !renameModalState.newName.trim() || renameModalState.newName === renameModalState.currentName}
              className="flex-1 py-3 px-5 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {renameModalState.isSaving ? <span className="animate-pulse">Saving...</span> : 'Save Name'}
            </button>
          </div>
        </Modal>
      )}

    </>
  );
};

export default Dashboard;