const pool = require('../config/db');
const { readableFamilyIdsSubquery, writableFamilyIdsSubquery } = require('./collaboratorModel');

/**
 * Creates a new person in a family the given user owns or has editor access to
 * @param {Object} personData - The person's data
 * @param {string} user_id - The ID of the requesting user
 * @returns {Object|null} The created person object, or null if the family isn't writable by user_id
 */
const createPerson = async (personData, user_id) => {
  const {
    family_id,
    first_name,
    last_name,
    gender,
    birth_date,
    death_date,
    birth_place,
    occupation,
    bio,
    photo_url
  } = personData;

  const query = `
    INSERT INTO persons (
      family_id, first_name, last_name, gender, birth_date,
      death_date, birth_place, occupation, bio, photo_url
    )
    SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
    WHERE $1 IN ${writableFamilyIdsSubquery(11)}
    RETURNING *;
  `;

  const values = [
    family_id, first_name, last_name, gender, birth_date,
    death_date, birth_place, occupation, bio, photo_url, user_id
  ];

  const { rows } = await pool.query(query, values);
  return rows[0] || null;
};

/**
 * Retrieves all persons belonging to a family the user can read (owner or collaborator)
 * @param {string} family_id - The ID of the family
 * @param {string} user_id - The ID of the requesting user
 * @returns {Array} List of persons in the family
 */
const getPersonsByFamily = async (family_id, user_id) => {
  const query = `
    SELECT p.* FROM persons p
    WHERE p.family_id = $1 AND p.family_id IN ${readableFamilyIdsSubquery(2)}
    ORDER BY p.birth_date ASC NULLS LAST;
  `;
  const { rows } = await pool.query(query, [family_id, user_id]);
  return rows;
};

/**
 * Retrieves a person by their ID, scoped to families the user can read
 * @param {string} person_id - The ID of the person
 * @param {string} user_id - The ID of the requesting user
 * @returns {Object|null} The person object or null if not found/not accessible
 */
const getPersonById = async (person_id, user_id) => {
  const query = `
    SELECT p.* FROM persons p
    WHERE p.id = $1 AND p.family_id IN ${readableFamilyIdsSubquery(2)};
  `;
  const { rows } = await pool.query(query, [person_id, user_id]);
  return rows[0] || null;
};

/**
 * Updates a person's details, scoped to families the user owns or edits
 * @param {string} person_id - The ID of the person to update
 * @param {Object} updatedData - The person's updatable fields
 * @param {string} user_id - The ID of the requesting user
 * @returns {Object|null} The updated person object
 */
const updatePerson = async (person_id, updatedData, user_id) => {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(updatedData)) {
    if (value !== undefined) {
      fields.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  if (fields.length === 0) return null;

  values.push(person_id, user_id);
  const query = `
    UPDATE persons
    SET ${fields.join(', ')}
    WHERE id = $${paramIndex}
      AND family_id IN ${writableFamilyIdsSubquery(paramIndex + 1)}
    RETURNING *;
  `;

  const { rows } = await pool.query(query, values);
  return rows[0] || null;
};

/**
 * Deletes a person from the database, scoped to families the user owns or edits
 * @param {string} person_id - The ID of the person to delete
 * @param {string} user_id - The ID of the requesting user
 * @returns {boolean} True if deleted, false if not found/not accessible
 */
const deletePerson = async (person_id, user_id) => {
  const query = `
    DELETE FROM persons
    WHERE id = $1
      AND family_id IN ${writableFamilyIdsSubquery(2)}
    RETURNING id;
  `;
  const { rows } = await pool.query(query, [person_id, user_id]);
  return rows.length > 0;
};

/**
 * Searches persons by name, scoped to families the user can read
 * @param {string} query - Search string
 * @param {string} user_id - The ID of the requesting user
 * @returns {Array} Matching persons (max 20)
 */
const searchPersons = async (query, user_id) => {
  const term = `%${query}%`;
  const sql = `
    SELECT p.id, p.first_name, p.last_name, p.birth_place, p.gender, p.photo_url, p.family_id
    FROM persons p
    WHERE p.family_id IN ${readableFamilyIdsSubquery(2)}
      AND (
        p.first_name ILIKE $1
        OR p.last_name ILIKE $1
        OR CONCAT(p.first_name, ' ', p.last_name) ILIKE $1
      )
    ORDER BY p.first_name, p.last_name
    LIMIT 20;
  `;
  const { rows } = await pool.query(sql, [term, user_id]);
  return rows;
};

module.exports = {
  createPerson,
  getPersonsByFamily,
  getPersonById,
  updatePerson,
  deletePerson,
  searchPersons,
};
