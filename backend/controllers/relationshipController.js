const relationshipService = require('../services/relationshipService');

/**
 * Create a new relationship
 * @route POST /api/relationships
 */
const createRelationship = async (req, res) => {
  try {
    const { person1_id, person2_id, relationship_type } = req.body;

    const newRelationship = await relationshipService.createRelationship(person1_id, person2_id, relationship_type, req.user.id);

    if (!newRelationship) {
      return res.status(404).json({ message: 'One or both persons not found' });
    }

    res.status(201).json(newRelationship);
  } catch (error) {
    console.error('Error creating relationship:', error);
    if (error.message.includes('required') || error.message.includes('same person')) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Failed to create relationship' });
  }
};

/**
 * Get all relationships for a specific person
 * @route GET /api/relationships/:person_id
 */
const getRelationshipsByPerson = async (req, res) => {
  try {
    const { person_id } = req.params;
    const relationships = await relationshipService.getRelationshipsByPerson(person_id, req.user.id);
    res.status(200).json(relationships);
  } catch (error) {
    console.error('Error getting relationships:', error);
    res.status(500).json({ message: 'Failed to retrieve relationships' });
  }
};

/**
 * Delete a relationship
 * @route DELETE /api/relationships/:relationship_id
 */
const deleteRelationship = async (req, res) => {
  try {
    const { relationship_id } = req.params;
    const success = await relationshipService.deleteRelationship(relationship_id, req.user.id);

    if (!success) {
      return res.status(404).json({ message: 'Relationship not found' });
    }

    res.status(200).json({ message: 'Relationship deleted successfully' });
  } catch (error) {
    console.error('Error deleting relationship:', error);
    res.status(500).json({ message: 'Failed to delete relationship' });
  }
};

/**
 * Update a relationship
 * @route PUT /api/relationships/:relationship_id
 */
const updateRelationship = async (req, res) => {
  try {
    const { relationship_id } = req.params;
    const { relationship_type } = req.body;

    if (!relationship_type) {
      return res.status(400).json({ message: 'Relationship type is required' });
    }

    const updated = await relationshipService.updateRelationship(relationship_id, relationship_type, req.user.id);

    if (!updated) {
      return res.status(404).json({ message: 'Relationship not found' });
    }

    res.status(200).json(updated);
  } catch (error) {
    console.error('Error updating relationship:', error);
    res.status(500).json({ message: 'Failed to update relationship' });
  }
};

module.exports = {
  createRelationship,
  getRelationshipsByPerson,
  deleteRelationship,
  updateRelationship,
};
