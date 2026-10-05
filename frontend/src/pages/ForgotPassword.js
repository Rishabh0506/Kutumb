import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api';
import { useToast } from '../context/ToastContext';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { addToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      // Backend always returns the same generic message regardless of
      // whether the email is registered, so this UI can't leak that either.
      setSent(true);
    } catch (err) {
      addToast(err.response?.data?.message || 'Something went wrong. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 selection:bg-rose-500/30">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-black tracking-tight text-white mb-2">Reset your password</h1>
          <p className="text-sm text-gray-400">
            Enter the email on your account and we'll send you a link to reset your password.
          </p>
        </div>

        {sent ? (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 text-center space-y-2">
            <p className="text-emerald-300 font-bold">✅ Check your inbox</p>
            <p className="text-gray-400 text-sm">
              If <span className="text-white font-medium">{email}</span> is registered, a reset link is on its way. It expires in 1 hour.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 hover:border-white/20 px-4 py-3.5 text-white placeholder-gray-600 focus:outline-none focus:border-rose-500/80 focus:bg-white/10 transition-all duration-300 rounded-xl"
                placeholder="you@example.com"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-rose-600 to-rose-500 border border-rose-400/30 text-white font-black tracking-[0.2em] uppercase text-xs rounded-xl shadow-[0_5px_15px_rgba(225,29,72,0.3)] hover:shadow-[0_15px_40px_rgba(225,29,72,0.6)] transition-all duration-500 disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Send Reset Link'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-gray-500">
          <Link to="/login" className="text-rose-500 hover:text-rose-400 font-bold transition-colors">← Back to login</Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;
