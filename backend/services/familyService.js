const familyModel = require('../models/familyModel');

/**
 * Creates a new family
 * @param {string} family_name 
 * @param {string} created_by - User ID
 * @returns {Object} Created family
 */
const createFamily = async (family_name, created_by) => {
  if (!family_name || !created_by) {
    throw new Error('Family name and creator ID are required');
  }
  return await familyModel.createFamily(family_name, created_by);
};

/**
 * Retrieves families created by a specific user
 * @param {string} user_id 
 * @returns {Array} List of families
 */
const getFamiliesByUser = async (user_id) => {
  if (!user_id) {
    throw new Error('User ID is required');
  }
  return await familyModel.getFamiliesByUser(user_id);
};

/**
 * Retrieves a family by its ID
 * @param {string} family_id 
 * @returns {Object|null} The family object
 */
const getFamilyById = async (family_id, user_id) => {
  if (!family_id || !user_id) {
    throw new Error('Family ID and User ID are required');
  }
  return await familyModel.getFamilyById(family_id, user_id);
};

/**
 * Updates a family name
 * @param {string} family_id 
 * @param {string} family_name 
 * @returns {Object|null}
 */
const updateFamily = async (family_id, family_name, user_id) => {
  if (!family_id || !family_name || !user_id) {
    throw new Error('Family ID, new name, and User ID are required');
  }
  return await familyModel.updateFamily(family_id, family_name, user_id);
};

/**
 * Deletes a family
 * @param {string} family_id 
 * @returns {boolean}
 */
const deleteFamily = async (family_id, user_id) => {
  if (!family_id || !user_id) {
    throw new Error('Family ID and User ID are required');
  }
  return await familyModel.deleteFamily(family_id, user_id);
};

module.exports = {
  createFamily,
  getFamiliesByUser,
  getFamilyById,
  updateFamily,
  deleteFamily,
};
