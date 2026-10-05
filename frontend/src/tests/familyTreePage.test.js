import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import FamilyTreePage from '../pages/FamilyTreePage';

// FamilyTreePage reads window.location.search directly rather than via a
// router hook, so it needs a real browser-style location (BrowserRouter +
// history.pushState), not MemoryRouter, to pick up ?demo=true at all.
// The demo tree itself is fully local, hardcoded data — no API calls happen
// anywhere in this render, so no mocking is needed to exercise it for real.
const renderDemoTree = () => {
  window.history.pushState({}, '', '/family-tree?demo=true');
  return render(
    <BrowserRouter>
      <Routes>
        <Route path="/family-tree" element={<FamilyTreePage />} />
      </Routes>
    </BrowserRouter>
  );
};

describe('FamilyTreePage (demo mode)', () => {
  test('renders the demo lineage badge and the real demo family members', async () => {
    renderDemoTree();

    expect(await screen.findByText(/Demo Lineage/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Ramesh/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Sunita/i).length).toBeGreaterThan(0);
  });

  test('the Collaborate panel receives no family id in demo mode (nothing to fetch)', async () => {
    renderDemoTree();
    await screen.findByText(/Demo Lineage/i);
    // With familyId=null, CollaborationPanel short-circuits to an empty list
    // instead of calling the API — it should never get stuck on "Loading…".
    expect(screen.queryByText(/Loading collaborators/i)).not.toBeInTheDocument();
  });
});
