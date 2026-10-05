const relationshipModel = require('../models/relationshipModel');

/**
 * Creates a new relationship between two persons
 * @param {string} person1_id 
 * @param {string} person2_id 
 * @param {string} relationship_type 
 * @returns {Object} The created relationship
 */
const createRelationship = async (person1_id, person2_id, relationship_type, user_id) => {
  if (!person1_id || !person2_id || !relationship_type) {
    throw new Error('Both person IDs and relationship type are required');
  }

  if (person1_id === person2_id) {
    throw new Error('Cannot create a relationship with the same person');
  }

  return await relationshipModel.createRelationship(person1_id, person2_id, relationship_type, user_id);
};

/**
 * Gets all relationships for a person
 * @param {string} person_id
 * @param {string} user_id
 * @returns {Array} List of relationships
 */
const getRelationshipsByPerson = async (person_id, user_id) => {
  if (!person_id) {
    throw new Error('Person ID is required');
  }
  return await relationshipModel.getRelationshipsByPerson(person_id, user_id);
};

/**
 * Deletes a relationship
 * @param {string} relationship_id
 * @param {string} user_id
 * @returns {boolean} Success status
 */
const deleteRelationship = async (relationship_id, user_id) => {
  if (!relationship_id) {
    throw new Error('Relationship ID is required');
  }
  return await relationshipModel.deleteRelationship(relationship_id, user_id);
};

/**
 * Updates a relationship type
 * @param {string} relationship_id
 * @param {string} relationship_type
 * @param {string} user_id
 * @returns {Object|null}
 */
const updateRelationship = async (relationship_id, relationship_type, user_id) => {
  if (!relationship_id || !relationship_type) {
    throw new Error('Relationship ID and new type are required');
  }
  return await relationshipModel.updateRelationship(relationship_id, relationship_type, user_id);
};

module.exports = {
  createRelationship,
  getRelationshipsByPerson,
  deleteRelationship,
  updateRelationship,
};
