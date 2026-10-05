import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ToastProvider } from '../context/ToastContext';
import Login from '../pages/Login';
import Register from '../pages/Register';
import Dashboard from '../pages/Dashboard';
import * as familyService from '../services/familyService';

jest.mock('../services/familyService');

const renderWithProviders = (ui) =>
  render(
    <ToastProvider>
      <BrowserRouter>{ui}</BrowserRouter>
    </ToastProvider>
  );

describe('Frontend Component Tests', () => {

  test('renders Login form correctly', () => {
    renderWithProviders(<Login />);
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
  });

  test('renders Register form correctly', () => {
    renderWithProviders(<Register />);
    expect(screen.getByPlaceholderText('Priya Sharma')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
  });

  test('renders Dashboard initial text with no lineages', async () => {
    familyService.getFamilies.mockResolvedValue([]);
    renderWithProviders(<Dashboard />);

    expect(screen.getByText(/Where Your Story Continues/i)).toBeInTheDocument();
    expect(await screen.findByText(/No Lineages Found/i)).toBeInTheDocument();
    expect(screen.getByText(/Begin this Story/i)).toBeInTheDocument();
  });

  test('hides rename/delete controls for a family the user does not own', async () => {
    familyService.getFamilies.mockResolvedValue([
      {
        id: 'shared-fam-1',
        family_name: 'Shared Lineage',
        member_count: 2,
        my_role: 'viewer',
        updated_at: new Date().toISOString(),
      },
    ]);
    renderWithProviders(<Dashboard />);

    expect(await screen.findByText(/Shared Lineage/i)).toBeInTheDocument();
    expect(screen.queryByTitle('Rename')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Delete')).not.toBeInTheDocument();
  });

});
