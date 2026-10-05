import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import { ToastProvider, useToast } from './context/ToastContext';
import './App.css';

// Lazy loaded pages
const Register = lazy(() => import('./pages/Register'));
const Login = lazy(() => import('./pages/Login'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const FamilyTreePage = lazy(() => import('./pages/FamilyTreePage'));
const PersonProfile = lazy(() => import('./pages/PersonProfile'));
const StoryTransition = lazy(() => import('./pages/StoryTransition'));

// Network offline resilience
const NetworkListener = () => {
  const { addToast } = useToast();

  useEffect(() => {
    const handleOffline = () => addToast('You are offline. Some features may be unavailable.', 'error');
    const handleOnline = () => addToast('You are back online.', 'success');

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [addToast]);

  return null;
};

// Global fallback loader
const PageLoader = () => (
  <div className="flex-1 flex items-center justify-center min-h-screen bg-black">
    <div className="w-10 h-10 border-4 border-rose-500/20 border-t-rose-500 rounded-full animate-spin"></div>
  </div>
);

function App() {
  return (
    <ToastProvider>
      <NetworkListener />
      <BrowserRouter>
        <div className="App bg-black min-h-screen flex flex-col">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/register" element={<Register />} />
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/story-transition" element={<StoryTransition />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/family-tree" element={<ProtectedRoute><FamilyTreePage /></ProtectedRoute>} />
              <Route path="/person/:id" element={<ProtectedRoute><PersonProfile /></ProtectedRoute>} />

              {/* Default fallback route redirecting to login */}
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Suspense>
          <Footer />
        </div>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
