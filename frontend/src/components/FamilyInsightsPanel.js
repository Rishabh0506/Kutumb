import React, { useState, useEffect, useMemo } from 'react';

const AnimatedCounter = ({ value, duration = 1000 }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (typeof value !== 'number') {
      setCount(value);
      return;
    }
    let start = 0;
    const end = value;
    if (start === end) {
      setCount(end);
      return;
    }
    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutExpo
      const easing = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCount(Math.floor(start + (end - start) * easing));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }, [value, duration]);

  return <>{count}</>;
};

const InsightCard = ({ icon, label, value, tooltip, highlight }) => (
  <div 
    className={`bg-black/40 backdrop-blur-xl border ${highlight ? 'border-rose-500/50 shadow-[0_0_20px_rgba(225,29,72,0.15)]' : 'border-white/10'} rounded-2xl p-5 relative group hover:-translate-y-1.5 hover:shadow-[0_15px_40px_rgba(0,0,0,0.6)] hover:border-white/20 transition-all duration-500`}
    title={tooltip}
  >
    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl" />
    <div className="flex items-center gap-3 mb-2">
      <span className="text-2xl group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-500">{icon}</span>
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 group-hover:text-gray-300 transition-colors duration-300">{label}</span>
    </div>
    <div className={`text-3xl font-black ${highlight ? 'text-rose-400' : 'text-white'} tracking-tight`}>
      <AnimatedCounter value={value} />
    </div>
  </div>
);

const FamilyInsightsPanel = ({ nodes, edges }) => {
  const insights = useMemo(() => {
    if (!nodes.length) return null;

    const totalMembers = nodes.length;
    const totalRelationships = edges.length;

    const places = {};
    let topPlace = 'Unknown';
    let maxCount = 0;
    
    let missingDob = 0;
    let missingBio = 0;
    let missingParents = 0;

    let maxConns = 0;
    let mostConnected = 'No data';
    const allConns = {};
    nodes.forEach(n => allConns[n.id] = 0);
    edges.forEach(e => {
       if (allConns[e.source] !== undefined) allConns[e.source]++;
       if (allConns[e.target] !== undefined) allConns[e.target]++;
    });

    const parentCounts = {};
    nodes.forEach(n => parentCounts[n.id] = 0);
    edges.forEach(e => {
       if (e.data?.relationship_type === 'parent' || e.data?.relationship_type === 'child') {
           parentCounts[e.target]++;
       }
    });

    nodes.forEach(n => {
      const p = n.data?.person || {};
      if (!p.birth_date) missingDob++;
      if (!p.bio || p.bio.length < 10) missingBio++;
      if (parentCounts[n.id] < 2) missingParents++;

      if (p.birth_place) {
        places[p.birth_place] = (places[p.birth_place] || 0) + 1;
        if (places[p.birth_place] > maxCount) {
          maxCount = places[p.birth_place];
          topPlace = p.birth_place;
        }
      }

      if (allConns[n.id] > maxConns) {
        maxConns = allConns[n.id];
        mostConnected = `${p.first_name || 'Unknown'} ${p.last_name || ''}`.trim();
      }
    });

    return { totalMembers, totalRelationships, topPlace: maxCount > 0 ? topPlace : 'Not Recorded', missingDob, missingBio, missingParents, mostConnected };
  }, [nodes, edges]);

  // Prevent render before calculation
  if (!insights) return null;

  const totalIssues = insights.missingDob + insights.missingBio + insights.missingParents;
  const isHealthy = totalIssues === 0 && insights.totalMembers > 0;

  return (
    <div className="space-y-5 animate-in fade-in duration-700">
      
      {/* 1. Animated Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <InsightCard 
          icon="👥" label="Total Members" value={insights.totalMembers} tooltip="Total individuals in this tree" 
        />
        <InsightCard 
          icon="🔗" label="Relationships" value={insights.totalRelationships} tooltip="Total connections mapped" 
        />
        <InsightCard 
          icon="🌍" label="Deep Roots" value={insights.topPlace} tooltip="Most common origin city/place" 
        />
        <InsightCard 
          icon="🌟" label="Most Connected" value={insights.mostConnected} tooltip="Member with the most direct links" highlight
        />
      </div>

      {/* 2. Actionable Growth Opportunities */}
      {totalIssues > 0 && (
        <div className="mt-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5 shadow-[0_4px_24px_rgba(245,158,11,0.05)] transition-all">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-amber-500 text-lg">💡</span>
            <span className="text-amber-400 text-xs font-bold uppercase tracking-widest">Growth Opportunities</span>
          </div>

          <div className="space-y-3">
            {insights.missingDob > 0 && (
              <div className="flex items-center justify-between text-xs bg-amber-500/5 border-l-2 border-l-amber-500 border-y border-r border-white/5 rounded-xl rounded-l-none px-4 py-3 group hover:border-r-white/10 hover:border-y-white/10 hover:bg-amber-500/10 transition-all duration-300 shadow-[0_4px_15px_rgba(245,158,11,0.05)]">
                <div>
                  <span className="text-amber-500/80 block font-bold text-[10px] uppercase tracking-wider mb-0.5">Primary Issue</span>
                  <span className="text-gray-200 block group-hover:text-white transition-colors">Missing Birthdates</span>
                  <span className="text-white font-black text-sm"><AnimatedCounter value={insights.missingDob} /> members</span>
                </div>
              </div>
            )}
            
            {insights.missingBio > 0 && (
              <div className="flex items-center justify-between text-xs bg-black/40 border border-white/5 rounded-xl px-4 py-3 group hover:border-white/15 hover:bg-white/[0.02] hover:-translate-y-0.5 shadow-sm transition-all duration-300">
                <div>
                  <span className="text-gray-400 block group-hover:text-gray-300 transition-colors">Missing Biographies</span>
                  <span className="text-white font-bold"><AnimatedCounter value={insights.missingBio} /> members</span>
                </div>
              </div>
            )}
            
            {insights.missingParents > 0 && (
              <div className="flex items-center justify-between text-xs bg-black/40 border border-white/5 rounded-xl px-4 py-3 group hover:border-white/15 hover:bg-white/[0.02] hover:-translate-y-0.5 shadow-sm transition-all duration-300">
                <div>
                  <span className="text-gray-400 block group-hover:text-gray-300 transition-colors">Incomplete Parent Links</span>
                  <span className="text-white font-bold"><AnimatedCounter value={insights.missingParents} /> members</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Dynamics Messages */}
      <div className="px-2">
        <p className="text-gray-500 text-xs italic opacity-80 transition-opacity hover:opacity-100">
          {isHealthy 
            ? "🌟 Your tree is perfectly maintained and growing beautifully!" 
            : `📈 Your lineage spans ${insights.totalMembers} members. Consider fixing missing gaps to unlock deeper insights.`}
        </p>
      </div>

    </div>
  );
};

export default FamilyInsightsPanel;
