import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const StoryTransition = () => {
  const navigate = useNavigate();
  const [stage, setStage] = useState(0);

  useEffect(() => {
    // Stage 1: First text fades in
    const t1 = setTimeout(() => setStage(1), 300);
    // Stage 2: Second text fades in
    const t2 = setTimeout(() => setStage(2), 2000);
    // Stage 3: Fade out entire screen
    const t3 = setTimeout(() => setStage(3), 4500);
    // Navigate to Demo Lineage
    const t4 = setTimeout(() => navigate('/family-tree?demo=true'), 5500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [navigate]);

  return (
    <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-black transition-opacity duration-1000 ${stage === 3 ? 'opacity-0' : 'opacity-100'}`}>
      
      {/* Subtle background glow to add to the dark aesthetic */}
      <div className="absolute inset-0 z-0 opacity-30 animate-pulse pointer-events-none" style={{ background: 'radial-gradient(circle at center, rgba(225,29,72,0.15) 0%, transparent 60%)' }} />

      <div className="relative z-10 max-w-2xl text-center px-6 space-y-8">
        <p className={`text-xl md:text-3xl font-light text-gray-200 tracking-wide transition-all duration-[1500ms] transform ${stage >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          "This is a story preserved across generations."
        </p>
        <p className={`text-lg md:text-2xl font-medium text-rose-400 tracking-widest transition-all duration-[1500ms] transform ${stage >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          Every node is a life. Every connection, a memory.
        </p>
      </div>
    </div>
  );
};

export default StoryTransition;
