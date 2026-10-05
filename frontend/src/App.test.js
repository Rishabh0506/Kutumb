import { render, screen } from '@testing-library/react';
import App from './App';

// App already wraps its own BrowserRouter/ToastProvider, and its catch-all
// route redirects any unmatched/unauthenticated path to /login (pages are
// lazy-loaded, hence the async find).
test('redirects an unauthenticated visitor to the login page', async () => {
  render(<App />);
  expect(await screen.findByPlaceholderText(/you@example.com/i)).toBeInTheDocument();
});
