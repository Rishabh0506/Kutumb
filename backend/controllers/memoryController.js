const memoryService = require('../services/memoryService');

/**
 * Create a new memory
 * @route POST /api/memories
 */
const createMemory = async (req, res) => {
  try {
    const memoryData = req.body;
    const newMemory = await memoryService.createMemory(memoryData, req.user.id);

    if (!newMemory) {
      return res.status(404).json({ message: 'Family not found' });
    }

    res.status(201).json(newMemory);
  } catch (error) {
    console.error('Error creating memory:', error);
    if (error.message.includes('required')) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Failed to create memory' });
  }
};

/**
 * Get all memories for a specific family
 * @route GET /api/memories/family/:family_id
 */
const getMemoriesByFamily = async (req, res) => {
  try {
    const { family_id } = req.params;
    const memories = await memoryService.getMemoriesByFamily(family_id, req.user.id);
    res.status(200).json(memories);
  } catch (error) {
    console.error('Error getting memories by family:', error);
    res.status(500).json({ message: 'Failed to retrieve memories' });
  }
};

/**
 * Get all memories for a specific person
 * @route GET /api/memories/person/:person_id
 */
const getMemoriesByPerson = async (req, res) => {
  try {
    const { person_id } = req.params;
    const memories = await memoryService.getMemoriesByPerson(person_id, req.user.id);
    res.status(200).json(memories);
  } catch (error) {
    console.error('Error getting memories by person:', error);
    res.status(500).json({ message: 'Failed to retrieve memories' });
  }
};

/**
 * Delete a memory
 * @route DELETE /api/memories/:memory_id
 */
const deleteMemory = async (req, res) => {
  try {
    const { memory_id } = req.params;
    const success = await memoryService.deleteMemory(memory_id, req.user.id);

    if (!success) {
      return res.status(404).json({ message: 'Memory not found' });
    }

    res.status(200).json({ message: 'Memory deleted successfully' });
  } catch (error) {
    console.error('Error deleting memory:', error);
    res.status(500).json({ message: 'Failed to delete memory' });
  }
};

module.exports = {
  createMemory,
  getMemoriesByFamily,
  getMemoriesByPerson,
  deleteMemory
};
