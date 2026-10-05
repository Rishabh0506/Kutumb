import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/api';
import { useToast } from '../context/ToastContext';
import bgImage from '../assets/hero-bg.png';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const navigate = useNavigate();
  const { addToast } = useToast();

  // Track mouse for the interactive spotlight effect
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

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/register', { name, email, password });
      addToast('Legacy initiated. You may now login.', 'success');
      setTimeout(() => navigate('/login'), 2000);
    } catch (error) {
      if (error.response?.status === 400 && error.response?.data?.message?.includes('already exists')) {
        addToast('This email is already preserving a legacy.', 'error');
      } else {
        addToast(error.response?.data?.message || 'Registration failed. Please try again.', 'error');
      }
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-black text-white overflow-hidden relative selection:bg-rose-500/30">
      
      {/* --- Dynamic Global Spotlight Effect --- */}
      <div 
        className="pointer-events-none absolute inset-0 z-0 opacity-40 transition-opacity duration-500"
        style={{
          background: `radial-gradient(circle at ${mousePos.x}% ${mousePos.y}%, rgba(225, 29, 72, 0.15), transparent 40%)`
        }}
      />

      {/* --- LEFT SIDE: Brand & Aesthetic --- */}
      <div className="relative w-full md:w-3/5 lg:w-2/3 h-64 md:h-screen flex flex-col justify-end p-10 md:p-20 z-10 overflow-hidden group">
        <div 
          className="absolute inset-0 z-[-1] bg-cover bg-center transition-transform duration-[10s] group-hover:scale-105"
          style={{ backgroundImage: `url(${bgImage})` }}
        />
        <div className="absolute inset-0 z-[-1] bg-gradient-to-t from-black via-black/80 to-transparent opacity-90" />
        <div className="absolute inset-0 z-[-1] bg-gradient-to-r from-black/60 to-transparent" />

        <div className="relative animate-fade-in-up">
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter mb-4 text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500 drop-shadow-2xl">
            KUTUMB
          </h1>
          <p className="text-xl md:text-2xl font-light text-rose-100/80 tracking-widest uppercase mb-8 border-l-2 border-rose-500 pl-4">
            Acknowledge Your Origins.
          </p>

          <div className="max-w-xl backdrop-blur-sm bg-black/20 p-6 rounded-2xl border border-white/5 shadow-2xl">
            <h3 className="text-sm font-bold text-rose-500 tracking-[0.2em] mb-2 uppercase">Your Genesis</h3>
            <p className="text-gray-300 font-light leading-relaxed text-sm md:text-base">
              Starting a family tree is monumental. Here, you plot the anchor node of your lineage. From this single registration, generations of history, memories, and bloodlines will dynamically unfold. <span className="text-white font-medium">Begin mapping history today.</span>
            </p>
          </div>
        </div>
      </div>

      {/* --- RIGHT SIDE: Glassmorphic Auth Form --- */}
      <div className="relative w-full md:w-2/5 lg:w-1/3 flex items-center justify-center p-8 z-10 bg-black/40 backdrop-blur-xl border-l border-white/10 shadow-[-20px_0_50px_rgba(0,0,0,0.5)]">
        <div className="w-full max-w-sm space-y-8 animate-fade-in">
          
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white mb-2">Initiate Lineage</h2>
            <p className="text-sm text-gray-400">Register to anchor your family tree.</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-6 mt-8">
            <div className="space-y-1 group">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest group-focus-within:text-rose-500 transition-colors">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white/5 border-b-2 border-white/10 px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-rose-500 focus:bg-white/10 transition-all rounded-t-md"
                placeholder="Priya Sharma"
                required
              />
            </div>

            <div className="space-y-1 group">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest group-focus-within:text-rose-500 transition-colors">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border-b-2 border-white/10 px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-rose-500 focus:bg-white/10 transition-all rounded-t-md"
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="space-y-1 group">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest group-focus-within:text-rose-500 transition-colors">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border-b-2 border-white/10 px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-rose-500 focus:bg-white/10 transition-all rounded-t-md"
                placeholder="••••••••"
                required
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-4 mt-4 bg-white text-black font-bold tracking-widest uppercase text-sm rounded-none hover:bg-rose-500 hover:text-white transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(225,29,72,0.4)] disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {loading ? <span className="animate-pulse">Forging...</span> : 'Establish Anchor'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-8">
            Already mapped your history? <Link to="/login" className="text-white hover:text-rose-400 font-semibold underline decoration-white/30 underline-offset-4 transition-colors">Return here.</Link>
          </p>
        </div>
      </div>
      
    </div>
  );
};

export default Register;
