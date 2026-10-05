const pool = require('../config/db');
const { readableFamilyIdsSubquery, writableFamilyIdsSubquery } = require('./collaboratorModel');

/**
 * Creates a legacy message for a person, scoped to families the user owns or edits
 * @param {string} person_id
 * @param {Object} data - { title, message, emotion_tag }
 * @param {string} user_id
 * @returns {Object|null} The created message, or null if the person isn't in a writable family
 */
const createLegacyMessage = async (person_id, { title, message, emotion_tag }, user_id) => {
  const query = `
    INSERT INTO legacy_messages (person_id, title, message, emotion_tag)
    SELECT $1, $2, $3, $4
    WHERE EXISTS (
      SELECT 1 FROM persons p WHERE p.id = $1 AND p.family_id IN ${writableFamilyIdsSubquery(5)}
    )
    RETURNING *;
  `;
  const { rows } = await pool.query(query, [person_id, title, message, emotion_tag, user_id]);
  return rows[0] || null;
};

/**
 * Retrieves legacy messages for a person, scoped to families the user can read
 * @param {string} person_id
 * @param {string} user_id
 * @returns {Array}
 */
const getLegacyMessages = async (person_id, user_id) => {
  const query = `
    SELECT * FROM legacy_messages
    WHERE person_id = $1
      AND EXISTS (
        SELECT 1 FROM persons p WHERE p.id = $1 AND p.family_id IN ${readableFamilyIdsSubquery(2)}
      )
    ORDER BY created_at DESC;
  `;
  const { rows } = await pool.query(query, [person_id, user_id]);
  return rows;
};

module.exports = {
  createLegacyMessage,
  getLegacyMessages,
};
