import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

// Redirects to /login before a protected page ever renders if no token exists,
// instead of relying solely on the reactive 401 redirect in api.js.
// The `demo=true` query param is exempted so the unauthenticated "Preview a
// Family Legacy" flow can render the demo family tree.
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  const location = useLocation();
  const isDemo = new URLSearchParams(location.search).get('demo') === 'true';

  if (!token && !isDemo) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

export default ProtectedRoute;
