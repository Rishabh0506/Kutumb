const pool = require('../config/db');
const { readableFamilyIdsSubquery, writableFamilyIdsSubquery } = require('./collaboratorModel');

/**
 * Creates a new memory in a family the user owns or has editor access to
 * @param {Object} memoryData - The memory data
 * @param {string} user_id - The ID of the requesting user
 * @returns {Object|null} The created memory, or null if the family isn't writable by user_id
 */
const createMemory = async (memoryData, user_id) => {
  const {
    family_id,
    person_id,
    title,
    description,
    media_url,
    media_type,
    event_date,
    tags,
    emotion,
    people_involved
  } = memoryData;

  const query = `
    INSERT INTO memories (
      family_id, person_id, title, description,
      media_url, media_type, event_date, tags, emotion, people_involved
    )
    SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
    WHERE $1 IN ${writableFamilyIdsSubquery(11)}
    RETURNING *;
  `;

  const values = [
    family_id, person_id, title, description,
    media_url, media_type, event_date,
    tags || [], emotion || null, people_involved || null,
    user_id
  ];

  const { rows } = await pool.query(query, values);
  return rows[0] || null;
};

/**
 * Retrieves all memories for a family the user can read (owner or collaborator)
 * @param {string} family_id - The ID of the family
 * @param {string} user_id - The ID of the requesting user
 * @returns {Array} List of memories
 */
const getMemoriesByFamily = async (family_id, user_id) => {
  const query = `
    SELECT * FROM memories
    WHERE family_id = $1 AND family_id IN ${readableFamilyIdsSubquery(2)}
    ORDER BY event_date DESC NULLS LAST, created_at DESC;
  `;
  const { rows } = await pool.query(query, [family_id, user_id]);
  return rows;
};

/**
 * Retrieves all memories linked to a specific person, scoped to families the user can read
 * @param {string} person_id - The ID of the person
 * @param {string} user_id - The ID of the requesting user
 * @returns {Array} List of memories
 */
const getMemoriesByPerson = async (person_id, user_id) => {
  const query = `
    SELECT * FROM memories
    WHERE person_id = $1 AND family_id IN ${readableFamilyIdsSubquery(2)}
    ORDER BY event_date DESC NULLS LAST, created_at DESC;
  `;
  const { rows } = await pool.query(query, [person_id, user_id]);
  return rows;
};

/**
 * Deletes a memory, scoped to families the user owns or edits
 * @param {string} memory_id - The ID of the memory to delete
 * @param {string} user_id - The ID of the requesting user
 * @returns {boolean} True if deleted, false if not found/not accessible
 */
const deleteMemory = async (memory_id, user_id) => {
  const query = `
    DELETE FROM memories
    WHERE id = $1 AND family_id IN ${writableFamilyIdsSubquery(2)}
    RETURNING id;
  `;
  const { rows } = await pool.query(query, [memory_id, user_id]);
  return rows.length > 0;
};

module.exports = {
  createMemory,
  getMemoriesByFamily,
  getMemoriesByPerson,
  deleteMemory,
};
