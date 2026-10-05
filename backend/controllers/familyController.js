const familyService = require('../services/familyService');

/**
 * Create a new family
 * @route POST /api/families
 */
const createFamily = async (req, res) => {
  try {
    const { family_name } = req.body;
    // req.user is set by authMiddleware
    const created_by = req.user.id; 

    if (!family_name) {
      return res.status(400).json({ message: 'Family name is required' });
    }

    const newFamily = await familyService.createFamily(family_name, created_by);
    res.status(201).json({ success: true, data: newFamily });
  } catch (error) {
    console.error('Error creating family:', error);
    res.status(500).json({ message: 'Failed to create family' });
  }
};

/**
 * Get all families for the current user
 * @route GET /api/families
 */
const getFamilies = async (req, res) => {
  try {
    const user_id = req.user.id;
    const families = await familyService.getFamiliesByUser(user_id);
    res.status(200).json({ success: true, data: families });
  } catch (error) {
    console.error('Error getting families:', error);
    res.status(500).json({ message: 'Failed to retrieve families' });
  }
};

/**
 * Get a specific family by ID
 * @route GET /api/families/:family_id
 */
const getFamilyById = async (req, res) => {
  try {
    const { family_id } = req.params;
    const family = await familyService.getFamilyById(family_id, req.user.id);
    
    if (!family) {
      return res.status(404).json({ message: 'Family not found' });
    }
    
    res.status(200).json({ success: true, data: family });
  } catch (error) {
    console.error('Error getting family by ID:', error);
    res.status(500).json({ message: 'Failed to retrieve family' });
  }
};

/**
 * Update a family name
 * @route PUT /api/families/:family_id
 */
const updateFamily = async (req, res) => {
  try {
    const { family_id } = req.params;
    const { family_name } = req.body;

    if (!family_name) {
      return res.status(400).json({ message: 'Family name is required' });
    }

    const updatedFamily = await familyService.updateFamily(family_id, family_name, req.user.id);
    
    if (!updatedFamily) {
      return res.status(404).json({ message: 'Family not found' });
    }
    
    res.status(200).json({ success: true, data: updatedFamily });
  } catch (error) {
    console.error('Error updating family:', error);
    res.status(500).json({ message: 'Failed to update family' });
  }
};

/**
 * Delete a family
 * @route DELETE /api/families/:family_id
 */
const deleteFamily = async (req, res) => {
  try {
    const { family_id } = req.params;
    const success = await familyService.deleteFamily(family_id, req.user.id);
    
    if (!success) {
      return res.status(404).json({ message: 'Family not found' });
    }
    
    res.status(200).json({ success: true, message: 'Family deleted successfully' });
  } catch (error) {
    console.error('Error deleting family:', error);
    res.status(500).json({ message: 'Failed to delete family' });
  }
};

module.exports = {
  createFamily,
  getFamilies,
  getFamilyById,
  updateFamily,
  deleteFamily,
};
