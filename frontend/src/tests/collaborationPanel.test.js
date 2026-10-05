import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CollaborationPanel from '../components/CollaborationPanel';
import * as familyService from '../services/familyService';

jest.mock('../services/familyService');

const owner = { user_id: 'owner-1', name: 'Owner Person', email: 'owner@example.com', role: 'owner', isOwner: true };
const viewer = { user_id: 'viewer-1', name: 'Viewer Person', email: 'viewer@example.com', role: 'viewer', isOwner: false };

describe('CollaborationPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    familyService.getCollaborators.mockResolvedValue([owner, viewer]);
  });

  test('loads and renders the real collaborator list', async () => {
    render(<CollaborationPanel familyId="fam-1" isOwner={true} />);

    expect(await screen.findByText('Owner Person')).toBeInTheDocument();
    expect(screen.getByText('Viewer Person')).toBeInTheDocument();
    expect(familyService.getCollaborators).toHaveBeenCalledWith('fam-1');
  });

  test('owners see the invite form; non-owners do not', async () => {
    const { rerender } = render(<CollaborationPanel familyId="fam-1" isOwner={true} />);
    await screen.findByText('Owner Person');
    expect(screen.getByPlaceholderText(/Collaborator's email/i)).toBeInTheDocument();

    rerender(<CollaborationPanel familyId="fam-1" isOwner={false} />);
    await screen.findByText('Owner Person');
    expect(screen.queryByPlaceholderText(/Collaborator's email/i)).not.toBeInTheDocument();
  });

  test('a non-owner sees read-only role badges, not the role select/remove controls', async () => {
    render(<CollaborationPanel familyId="fam-1" isOwner={false} />);
    await screen.findByText('Viewer Person');

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Remove')).not.toBeInTheDocument();
    expect(screen.getByText('viewer')).toBeInTheDocument();
  });

  test('submitting a successful invite calls inviteCollaborator and shows a success message', async () => {
    familyService.inviteCollaborator.mockResolvedValue({ role: 'viewer' });
    render(<CollaborationPanel familyId="fam-1" isOwner={true} />);
    await screen.findByText('Owner Person');

    fireEvent.change(screen.getByPlaceholderText(/Collaborator's email/i), { target: { value: 'new@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Send/i }));

    await waitFor(() => {
      expect(familyService.inviteCollaborator).toHaveBeenCalledWith('fam-1', { email: 'new@example.com', role: 'viewer' });
    });
    expect(await screen.findByText(/now has viewer access/i)).toBeInTheDocument();
  });

  test('a failed invite (e.g. unregistered email) surfaces the real backend error message', async () => {
    familyService.inviteCollaborator.mockRejectedValue({
      response: { data: { message: 'No Kutumb account found with that email — ask them to sign up first.' } },
    });
    render(<CollaborationPanel familyId="fam-1" isOwner={true} />);
    await screen.findByText('Owner Person');

    fireEvent.change(screen.getByPlaceholderText(/Collaborator's email/i), { target: { value: 'ghost@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /Send/i }));

    expect(await screen.findByText(/No Kutumb account found/i)).toBeInTheDocument();
  });

  test('a failed fetch shows a load error instead of crashing', async () => {
    familyService.getCollaborators.mockRejectedValue(new Error('network down'));
    render(<CollaborationPanel familyId="fam-1" isOwner={true} />);

    expect(await screen.findByText(/Failed to load collaborators/i)).toBeInTheDocument();
  });
});
