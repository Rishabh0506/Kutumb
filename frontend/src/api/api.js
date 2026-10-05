import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5001/api',
});

// Attach JWT to every outgoing request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle expired / invalid tokens and network errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Standardize error structure for the frontend
    const standardizedError = {
      ...error,
      response: {
        ...error.response,
        data: {
          message: 'An unexpected error occurred. Please try again.',
          ...(error.response?.data || {})
        }
      }
    };

    if (!error.response) {
      // Network errors or CORS
      standardizedError.response.data.message = 'Unable to connect to the lineage archive. Please check your network connection.';
    }

    if (error.response?.status === 401) {
      const hadToken = Boolean(localStorage.getItem('token'));
      localStorage.removeItem('token');
      localStorage.removeItem('selectedFamily');
      // Only force a hard redirect for an expired/invalidated session. A
      // guest who never had a token (e.g. browsing the unauthenticated demo
      // preview) can legitimately hit a protected endpoint — that 401 should
      // stay a local error, not nuke the page they're previewing.
      if (hadToken && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    
    // Pass the standardized error down to the catch blocks
    return Promise.reject(standardizedError);
  }
);

export default api;
