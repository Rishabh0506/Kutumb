import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import bgImage from '../assets/hero-bg.png';
import api from '../api/api';
import { useToast } from '../context/ToastContext';
import CanvasNetwork from '../components/CanvasNetwork';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const navigate = useNavigate();
  const { addToast } = useToast();

  useEffect(() => {
    const handleMouseMove = (e) => {
      setMousePos({
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100,
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      localStorage.setItem("token", res.data.token);
      navigate("/dashboard");
    } catch (err) {
      if (err.response?.status === 401) {
        addToast('Invalid credentials. Please verify your identity.', 'error');
      } else {
        addToast(err.response?.data?.message || 'Failed to access the lineage archive. Please try again.', 'error');
      }
      setLoading(false);
    }
  };

  return (
    <>
      <style>
        {`
          @keyframes verySlowPulse {
            0%, 100% { opacity: 0.15; transform: scale(1); }
            50% { opacity: 0.25; transform: scale(1.05); }
          }
          .animate-slow-pulse {
            animation: verySlowPulse 12s ease-in-out infinite;
          }
        `}
      </style>
      
      <div className="flex flex-col md:flex-row min-h-screen bg-black text-white overflow-hidden relative selection:bg-rose-500/30">
        
        {/* --- Background Micro-Animation (Extremely Slow) --- */}
        <div 
          className="pointer-events-none absolute inset-0 z-0 animate-slow-pulse"
          style={{
            background: `radial-gradient(circle at ${mousePos.x}% ${mousePos.y}%, rgba(225, 29, 72, 0.4), transparent 50%)`
          }}
        />

        {/* --- LEFT SIDE: Brand Experience --- */}
        <div className="relative w-full md:w-3/5 lg:w-2/3 h-64 md:h-screen flex flex-col justify-end p-10 md:p-20 z-10 overflow-hidden group">
          {/* Background Network Image */}
          <div 
            className="absolute inset-0 z-[-2] bg-cover bg-center transition-transform duration-[30s] ease-out group-hover:scale-110"
            style={{ backgroundImage: `url(${bgImage})` }}
          />
          <CanvasNetwork mousePos={mousePos} />
          <div className="absolute inset-0 z-[-1] bg-gradient-to-t from-black via-black/80 to-transparent opacity-95 pointer-events-none" />
          <div className="absolute inset-0 z-[-1] bg-gradient-to-r from-black/80 via-black/40 to-transparent pointer-events-none" />
          
          <div className="relative animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter mb-8 text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-100 to-gray-400 drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]">
              KUTUMB
            </h1>
            <p className="text-xl md:text-2xl font-medium text-white tracking-[0.15em] uppercase mb-12 border-l-2 border-rose-500 pl-5 drop-shadow-md">
              Every Family Has a Story. <br className="hidden md:block" />
              <span className="font-black text-rose-100">Preserve Yours.</span>
            </p>

            <div className="max-w-xl backdrop-blur-md bg-black/40 p-8 rounded-3xl border border-white/5 shadow-[0_10px_40px_rgba(0,0,0,0.5)] transition-all duration-500 hover:bg-black/50 hover:border-rose-500/20 hover:-translate-y-1 hover:shadow-[0_15px_40px_rgba(225,29,72,0.1)]">
              <h3 className="text-sm font-black text-rose-500 tracking-[0.2em] mb-4 uppercase flex items-center gap-2 drop-shadow-sm">
                <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(225,29,72,0.8)]"></span>
                Why Kutumb?
              </h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="mt-1 flex-shrink-0 text-rose-400">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </span>
                  <span className="text-gray-200 font-medium text-sm md:text-base drop-shadow-md">Living, breathing family archive</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 flex-shrink-0 text-rose-400">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                  </span>
                  <span className="text-gray-200 font-medium text-sm md:text-base drop-shadow-md">Interactive lineage visualization</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 flex-shrink-0 text-rose-400">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </span>
                  <span className="text-gray-200 font-medium text-sm md:text-base drop-shadow-md">Preserve memories across generations</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* --- RIGHT SIDE: Premium Glassmorphic Auth Form --- */}
        <div className="relative w-full md:w-2/5 lg:w-1/3 flex items-center justify-center p-8 md:p-12 z-10 bg-black/60 backdrop-blur-md border-l border-white/5 shadow-[-15px_0_40px_rgba(0,0,0,0.6),-2px_0_20px_rgba(225,29,72,0.05)]">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-transparent pointer-events-none" />
          
          <div className="w-full max-w-sm space-y-8 relative animate-in fade-in slide-in-from-right-4 duration-500 delay-150 fill-mode-both">
            
            <div className="text-center">
              <h2 className="text-3xl font-black tracking-tight text-white mb-2 drop-shadow-md">Step back into your lineage</h2>
              <p className="text-sm text-gray-400 font-medium">Continue your family's story where you left off.</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6 mt-8">
              <div className="space-y-1.5 group relative">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest group-focus-within:text-rose-400 transition-colors duration-300 block">Email Address</label>
                <div className="relative flex items-center transform transition-all duration-300 group-focus-within:-translate-y-0.5 group-focus-within:scale-[1.01] group-focus-within:shadow-[0_10px_30px_rgba(225,29,72,0.15)] rounded-xl">
                  <span className="absolute left-4 text-gray-500 group-focus-within:text-rose-400 group-focus-within:drop-shadow-[0_0_8px_rgba(225,29,72,0.8)] transition-all duration-300 pointer-events-none">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 hover:border-white/20 pl-12 pr-4 py-3.5 text-white placeholder-gray-600 focus:outline-none focus:border-rose-500/80 focus:bg-white/10 transition-all duration-300 rounded-xl focus:shadow-[inset_0_2px_10px_rgba(225,29,72,0.05),0_0_15px_rgba(225,29,72,0.25)]"
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5 group relative">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest group-focus-within:text-rose-400 transition-colors duration-300 block">Password</label>
                <div className="relative flex items-center transform transition-all duration-300 group-focus-within:-translate-y-0.5 group-focus-within:scale-[1.01] group-focus-within:shadow-[0_10px_30px_rgba(225,29,72,0.15)] rounded-xl">
                  <span className="absolute left-4 text-gray-500 group-focus-within:text-rose-400 group-focus-within:drop-shadow-[0_0_8px_rgba(225,29,72,0.8)] transition-all duration-300 pointer-events-none">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                  </span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 hover:border-white/20 pl-12 pr-4 py-3.5 text-white placeholder-gray-600 focus:outline-none focus:border-rose-500/80 focus:bg-white/10 transition-all duration-300 rounded-xl focus:shadow-[inset_0_2px_10px_rgba(225,29,72,0.05),0_0_15px_rgba(225,29,72,0.25)]"
                    placeholder="••••••••"
                    required
                  />
                </div>
                <div className="flex justify-end pt-2">
                  <button type="button" onClick={() => navigate('/forgot-password')} className="text-[11px] text-gray-500 hover:text-rose-400 font-medium transition-colors duration-300">Forgot Password?</button>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-4 mt-8 bg-gradient-to-r from-rose-600 to-rose-500 border border-rose-400/30 text-white font-black tracking-[0.2em] uppercase text-xs rounded-xl shadow-[0_5px_15px_rgba(225,29,72,0.3)] hover:shadow-[0_15px_40px_rgba(225,29,72,0.6)] hover:from-rose-500 hover:to-orange-500 hover:scale-[1.03] active:scale-[0.97] transition-all duration-500 ease-out relative overflow-hidden group disabled:opacity-50"
              >
                <div className="absolute inset-0 bg-white/20 blur-md opacity-0 group-hover:opacity-100 group-hover:animate-pulse transition-opacity duration-300" />
                <span className="relative z-10 flex items-center justify-center gap-2 drop-shadow-md">
                  {loading ? <span className="animate-pulse">Authenticating...</span> : <>Continue Your Story <span className="text-rose-200 transition-transform duration-500 group-hover:translate-x-1.5">→</span></>}
                </span>
              </button>

              <button 
                type="button"
                onClick={() => navigate('/story-transition')}
                className="w-full py-3 mt-4 bg-transparent border border-white/20 text-gray-300 rounded-xl hover:bg-white/5 hover:border-rose-400/50 hover:shadow-[0_0_25px_rgba(225,29,72,0.15)] hover:scale-[1.03] active:scale-[0.98] transition-all duration-500 ease-out flex flex-col items-center justify-center gap-0.5 group"
              >
                <div className="flex items-center gap-2 font-bold tracking-widest uppercase text-[11px] group-hover:text-white transition-colors duration-300">
                  <svg className="w-4 h-4 text-gray-400 group-hover:text-rose-400 transition-colors duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Preview a Family Legacy
                </div>
                <span className="text-[9px] font-medium text-gray-500 group-hover:text-rose-300/80 transition-colors duration-300 tracking-wide">Step into a preserved lineage</span>
              </button>
            </form>

            <div className="pt-8 border-t border-white/5 text-center space-y-4">
              <p className="text-sm font-medium text-gray-400 tracking-wide">
                Don't have an origin yet? <Link to="/register" className="text-rose-500 hover:text-rose-400 font-bold underline decoration-rose-500/30 hover:decoration-rose-400 underline-offset-4 transition-all duration-300 ml-1 drop-shadow-sm">Begin here.</Link>
              </p>
              <p className="text-xs text-gray-500/90 italic font-medium drop-shadow-sm tracking-wide">
                "Your story matters. Keep it alive."
              </p>
            </div>

          </div>
        </div>
        
      </div>
    </>
  );
};

export default Login;
