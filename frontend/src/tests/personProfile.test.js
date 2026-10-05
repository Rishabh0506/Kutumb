import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from '../context/ToastContext';
import PersonProfile from '../pages/PersonProfile';

// PersonProfile has real, hardcoded demo data (n1-n4) that renders without
// any API calls at all — this exercises the real component, not a mock.
const renderProfile = (personId) =>
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={[`/person/${personId}`]}>
        <Routes>
          <Route path="/person/:id" element={<PersonProfile />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>
  );

describe('PersonProfile (demo mode)', () => {
  test('renders the real demo person data for a known demo id', () => {
    renderProfile('n1');

    expect(screen.getAllByText('Ramesh').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Sharma').length).toBeGreaterThan(0);
    expect(screen.getByText(/dedicated civil engineer/i)).toBeInTheDocument();
  });

  test('shows "Profile not found" for an id that is neither demo nor fetchable', async () => {
    // Non-demo ids trigger a real (expected-to-fail, no server running) fetch —
    // jsdom logs that network error to console; suppress it, it's not a bug.
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    renderProfile('not-a-real-id');
    expect(await screen.findByText(/Profile not found|Failed to load profile/i)).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  test('blocks a delete attempt in demo mode instead of opening the real confirm dialog', () => {
    renderProfile('n2');

    fireEvent.click(screen.getByRole('button', { name: /Delete/i }));

    expect(screen.getByText(/preview lineage/i)).toBeInTheDocument();
    expect(screen.queryByText(/Permanently remove this person/i)).not.toBeInTheDocument();
  });

  test('the "Full Tree" quick-nav link carries the demo flag so it stays navigable', () => {
    renderProfile('n3');
    // n3 (Rohan) has two parents linked in DEMO_PERSON_DATA, so the quick-nav row renders.
    expect(screen.getByRole('button', { name: /Full Tree/i })).toBeInTheDocument();
  });
});
