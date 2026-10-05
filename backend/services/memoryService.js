const memoryModel = require('../models/memoryModel');

/**
 * Creates a new memory attached to a family and person
 * @param {Object} memoryData
 * @param {string} user_id
 * @returns {Object} Created memory
 */
const createMemory = async (memoryData, user_id) => {
  if (!memoryData.family_id || !memoryData.title) {
    throw new Error('Family ID and title are required for a memory');
  }
  return await memoryModel.createMemory(memoryData, user_id);
};

/**
 * Gets all memories for a family
 * @param {string} family_id
 * @param {string} user_id
 * @returns {Array} List of memories
 */
const getMemoriesByFamily = async (family_id, user_id) => {
  if (!family_id) {
    throw new Error('Family ID is required');
  }
  return await memoryModel.getMemoriesByFamily(family_id, user_id);
};

/**
 * Gets all memories for a specific person
 * @param {string} person_id
 * @param {string} user_id
 * @returns {Array} List of memories
 */
const getMemoriesByPerson = async (person_id, user_id) => {
  if (!person_id) {
    throw new Error('Person ID is required');
  }
  return await memoryModel.getMemoriesByPerson(person_id, user_id);
};

/**
 * Deletes a memory
 * @param {string} memory_id
 * @param {string} user_id
 * @returns {boolean} Success status
 */
const deleteMemory = async (memory_id, user_id) => {
  if (!memory_id) {
    throw new Error('Memory ID is required');
  }
  return await memoryModel.deleteMemory(memory_id, user_id);
};

module.exports = {
  createMemory,
  getMemoriesByFamily,
  getMemoriesByPerson,
  deleteMemory
};
