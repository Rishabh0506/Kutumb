const pool = require('../config/db');

/**
 * Creates a new user in the database
 * @param {string} name - The user's name
 * @param {string} email - The user's email address
 * @param {string} password_hash - The hashed password
 * @returns {Object} The created user object
 */
const createUser = async (name, email, password_hash) => {
  const query = `
    INSERT INTO users (name, email, password_hash)
    VALUES ($1, $2, $3)
    RETURNING id, name, email, created_at;
  `;
  const values = [name, email, password_hash];
  const { rows } = await pool.query(query, values);
  return rows[0];
};

/**
 * Retrieves a user by their email address
 * @param {string} email - The user's email address
 * @returns {Object|null} The user object or null if not found
 */
const getUserByEmail = async (email) => {
  const query = `
    SELECT id, name, email, password_hash, created_at
    FROM users
    WHERE email = $1;
  `;
  const { rows } = await pool.query(query, [email]);
  return rows[0] || null;
};

/**
 * Retrieves a user by their ID
 * @param {string} id - The user's ID
 * @returns {Object|null} The user object or null if not found
 */
const getUserById = async (id) => {
  const query = `
    SELECT id, name, email, created_at
    FROM users
    WHERE id = $1;
  `;
  const { rows } = await pool.query(query, [id]);
  return rows[0] || null;
};

/**
 * Updates a user's password hash
 * @param {string} id - The user's ID
 * @param {string} password_hash - The new hashed password
 * @returns {Object|null} The updated user (id, email) or null if not found
 */
const updatePasswordHash = async (id, password_hash) => {
  const query = `
    UPDATE users SET password_hash = $1
    WHERE id = $2
    RETURNING id, email;
  `;
  const { rows } = await pool.query(query, [password_hash, id]);
  return rows[0] || null;
};

module.exports = {
  createUser,
  getUserByEmail,
  getUserById,
  updatePasswordHash,
};
