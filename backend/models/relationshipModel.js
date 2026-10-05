const pool = require('../config/db');
const { readableFamilyIdsSubquery, writableFamilyIdsSubquery } = require('./collaboratorModel');

/**
 * Creates a relationship between two persons, both of which must belong to
 * a family the user owns or has editor access to
 * @param {string} person1_id - ID of the first person
 * @param {string} person2_id - ID of the second person
 * @param {string} relationship_type - Type of relationship (e.g., 'parent', 'child', 'spouse')
 * @param {string} user_id - The ID of the requesting user
 * @returns {Object|null} The created relationship object, or null if not writable
 */
const createRelationship = async (person1_id, person2_id, relationship_type, user_id) => {
  const query = `
    INSERT INTO relationships (person1_id, person2_id, relationship_type)
    SELECT $1, $2, $3
    WHERE EXISTS (
      SELECT 1 FROM persons p WHERE p.id = $1 AND p.family_id IN ${writableFamilyIdsSubquery(4)}
    ) AND EXISTS (
      SELECT 1 FROM persons p WHERE p.id = $2 AND p.family_id IN ${writableFamilyIdsSubquery(4)}
    )
    RETURNING *;
  `;
  const values = [person1_id, person2_id, relationship_type, user_id];
  const { rows } = await pool.query(query, values);
  return rows[0] || null;
};

/**
 * Retrieves all relationships for a specific person, scoped to families the user can read
 * @param {string} person_id - The ID of the person
 * @param {string} user_id - The ID of the requesting user
 * @returns {Array} List of relationships connected to the person
 */
const getRelationshipsByPerson = async (person_id, user_id) => {
  const query = `
    SELECT r.* FROM relationships r
    WHERE (r.person1_id = $1 OR r.person2_id = $1)
      AND EXISTS (
        SELECT 1 FROM persons p WHERE p.id = $1 AND p.family_id IN ${readableFamilyIdsSubquery(2)}
      )
    ORDER BY r.created_at DESC;
  `;
  const { rows } = await pool.query(query, [person_id, user_id]);
  return rows;
};

/**
 * Deletes a relationship, scoped to families the user owns or edits
 * @param {string} relationship_id - The ID of the relationship to delete
 * @param {string} user_id - The ID of the requesting user
 * @returns {boolean} True if deleted, false if not found/not writable
 */
const deleteRelationship = async (relationship_id, user_id) => {
  const query = `
    DELETE FROM relationships
    WHERE id = $1
      AND EXISTS (
        SELECT 1 FROM persons p
        WHERE p.id = relationships.person1_id AND p.family_id IN ${writableFamilyIdsSubquery(2)}
      )
    RETURNING id;
  `;
  const { rows } = await pool.query(query, [relationship_id, user_id]);
  return rows.length > 0;
};

/**
 * Updates a relationship type, scoped to families the user owns or edits
 * @param {string} relationship_id - The ID of the relationship
 * @param {string} relationship_type - The new relationship type
 * @param {string} user_id - The ID of the requesting user
 * @returns {Object|null} The updated relationship object
 */
const updateRelationship = async (relationship_id, relationship_type, user_id) => {
  const query = `
    UPDATE relationships
    SET relationship_type = $1
    WHERE id = $2
      AND EXISTS (
        SELECT 1 FROM persons p
        WHERE p.id = relationships.person1_id AND p.family_id IN ${writableFamilyIdsSubquery(3)}
      )
    RETURNING *;
  `;
  const { rows } = await pool.query(query, [relationship_type, relationship_id, user_id]);
  return rows[0] || null;
};

module.exports = {
  createRelationship,
  getRelationshipsByPerson,
  deleteRelationship,
  updateRelationship,
};
