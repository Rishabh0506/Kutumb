const collaboratorModel = require('../models/collaboratorModel');
const userModel = require('../models/userModel');

const VALID_ROLES = ['viewer', 'editor'];

/**
 * Invite a registered user to a family as a viewer or editor.
 * @route POST /api/families/:family_id/collaborators
 */
const addCollaborator = async (req, res) => {
  try {
    const { family_id } = req.params;
    const { email, role } = req.body;

    if (!email || !VALID_ROLES.includes(role)) {
      return res.status(400).json({ message: 'A valid email and role (viewer or editor) are required.' });
    }

    const myRole = await collaboratorModel.getFamilyRole(family_id, req.user.id);
    if (myRole !== 'owner') {
      return res.status(403).json({ message: 'Only the family owner can manage collaborators.' });
    }

    const targetUser = await userModel.getUserByEmail(email.trim().toLowerCase());
    if (!targetUser) {
      return res.status(404).json({ message: 'No Kutumb account found with that email — ask them to sign up first.' });
    }

    if (targetUser.id === req.user.id) {
      return res.status(400).json({ message: "You're already the owner of this family." });
    }

    const existing = await collaboratorModel.getCollaborator(family_id, targetUser.id);
    if (existing) {
      return res.status(409).json({ message: 'This user is already a collaborator on this family.' });
    }

    const created = await collaboratorModel.addCollaborator(family_id, targetUser.id, role, req.user.id);
    res.status(201).json({
      success: true,
      data: { id: created.id, user_id: targetUser.id, name: targetUser.name, email: targetUser.email, role: created.role, created_at: created.created_at },
    });
  } catch (error) {
    console.error('Error adding collaborator:', error);
    res.status(500).json({ message: 'Failed to add collaborator' });
  }
};

/**
 * List everyone with access to a family (owner + collaborators).
 * @route GET /api/families/:family_id/collaborators
 */
const listCollaborators = async (req, res) => {
  try {
    const { family_id } = req.params;

    const myRole = await collaboratorModel.getFamilyRole(family_id, req.user.id);
    if (!myRole) {
      return res.status(404).json({ message: 'Family not found' });
    }

    const collaborators = await collaboratorModel.listCollaborators(family_id);
    res.status(200).json({ success: true, data: collaborators });
  } catch (error) {
    console.error('Error listing collaborators:', error);
    res.status(500).json({ message: 'Failed to list collaborators' });
  }
};

/**
 * Change a collaborator's role.
 * @route PUT /api/families/:family_id/collaborators/:user_id
 */
const updateCollaboratorRole = async (req, res) => {
  try {
    const { family_id, user_id } = req.params;
    const { role } = req.body;

    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ message: 'A valid role (viewer or editor) is required.' });
    }

    const myRole = await collaboratorModel.getFamilyRole(family_id, req.user.id);
    if (myRole !== 'owner') {
      return res.status(403).json({ message: 'Only the family owner can manage collaborators.' });
    }

    const updated = await collaboratorModel.updateCollaboratorRole(family_id, user_id, role);
    if (!updated) {
      return res.status(404).json({ message: 'Collaborator not found' });
    }

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating collaborator role:', error);
    res.status(500).json({ message: 'Failed to update collaborator role' });
  }
};

/**
 * Remove a collaborator's access. The owner can remove anyone; a collaborator
 * can always remove themselves (leave the family).
 * @route DELETE /api/families/:family_id/collaborators/:user_id
 */
const removeCollaborator = async (req, res) => {
  try {
    const { family_id, user_id } = req.params;

    const isSelf = req.user.id === user_id;
    if (!isSelf) {
      const myRole = await collaboratorModel.getFamilyRole(family_id, req.user.id);
      if (myRole !== 'owner') {
        return res.status(403).json({ message: 'Only the family owner can manage collaborators.' });
      }
    }

    const removed = await collaboratorModel.removeCollaborator(family_id, user_id);
    if (!removed) {
      return res.status(404).json({ message: 'Collaborator not found' });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error removing collaborator:', error);
    res.status(500).json({ message: 'Failed to remove collaborator' });
  }
};

module.exports = {
  addCollaborator,
  listCollaborators,
  updateCollaboratorRole,
  removeCollaborator,
};
