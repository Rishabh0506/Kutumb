const personModel = require('../models/personModel');

/**
 * Adds a new person to a family owned by user_id
 * @param {Object} personData
 * @param {string} user_id
 * @returns {Object|null} Created person, or null if family isn't owned by user_id
 */
const addPerson = async (personData, user_id) => {
  if (!personData.family_id || !personData.first_name) {
    throw new Error('Family ID and first name are required');
  }
  return await personModel.createPerson(personData, user_id);
};

/**
 * Gets all persons in a specific family owned by user_id
 * @param {string} family_id
 * @param {string} user_id
 * @returns {Array} List of persons
 */
const getPersonsByFamily = async (family_id, user_id) => {
  if (!family_id) {
    throw new Error('Family ID is required');
  }
  return await personModel.getPersonsByFamily(family_id, user_id);
};

/**
 * Gets a person by their ID, scoped to families owned by user_id
 * @param {string} person_id
 * @param {string} user_id
 * @returns {Object|null} Person object
 */
const getPersonById = async (person_id, user_id) => {
  if (!person_id) {
    throw new Error('Person ID is required');
  }
  return await personModel.getPersonById(person_id, user_id);
};

/**
 * Updates a person's information, scoped to families owned by user_id
 * @param {string} person_id
 * @param {Object} updatedData
 * @param {string} user_id
 * @returns {Object|null} Updated person
 */
const updatePerson = async (person_id, updatedData, user_id) => {
  if (!person_id) {
    throw new Error('Person ID is required');
  }
  // Prevent updating ID or family_id
  const { id, family_id, ...dataToUpdate } = updatedData;
  return await personModel.updatePerson(person_id, dataToUpdate, user_id);
};

/**
 * Deletes a person, scoped to families owned by user_id
 * @param {string} person_id
 * @param {string} user_id
 * @returns {boolean} Success status
 */
const deletePerson = async (person_id, user_id) => {
  if (!person_id) {
    throw new Error('Person ID is required');
  }
  return await personModel.deletePerson(person_id, user_id);
};

const searchPersons = async (query, user_id) => {
  if (!query || query.trim().length < 2) throw new Error('Search query too short');
  return await personModel.searchPersons(query.trim(), user_id);
};

module.exports = {
  addPerson,
  getPersonsByFamily,
  getPersonById,
  updatePerson,
  deletePerson,
  searchPersons,
};
