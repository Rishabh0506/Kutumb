import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '../api/api';
import { useToast } from '../context/ToastContext';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      addToast('Passwords do not match.', 'error');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      addToast('Password reset. You can now log in.', 'success');
      navigate('/login');
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to reset password. The link may have expired.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="max-w-sm text-center space-y-4">
          <p className="text-rose-400 font-bold">This reset link is missing or malformed.</p>
          <Link to="/forgot-password" className="text-rose-500 hover:text-rose-400 font-bold text-sm">Request a new one →</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 selection:bg-rose-500/30">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-black tracking-tight text-white mb-2">Set a new password</h1>
          <p className="text-sm text-gray-400">Choose a new password for your account.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 hover:border-white/20 px-4 py-3.5 text-white placeholder-gray-600 focus:outline-none focus:border-rose-500/80 focus:bg-white/10 transition-all duration-300 rounded-xl"
              placeholder="••••••••"
              minLength={6}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 hover:border-white/20 px-4 py-3.5 text-white placeholder-gray-600 focus:outline-none focus:border-rose-500/80 focus:bg-white/10 transition-all duration-300 rounded-xl"
              placeholder="••••••••"
              minLength={6}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-rose-600 to-rose-500 border border-rose-400/30 text-white font-black tracking-[0.2em] uppercase text-xs rounded-xl shadow-[0_5px_15px_rgba(225,29,72,0.3)] hover:shadow-[0_15px_40px_rgba(225,29,72,0.6)] transition-all duration-500 disabled:opacity-50"
          >
            {loading ? 'Resetting…' : 'Reset Password'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500">
          <Link to="/login" className="text-rose-500 hover:text-rose-400 font-bold transition-colors">← Back to login</Link>
        </p>
      </div>
    </div>
  );
};

export default ResetPassword;
