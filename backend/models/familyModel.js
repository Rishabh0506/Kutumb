const pool = require('../config/db');

/**
 * Creates a new family
 * @param {string} family_name - Name of the family
 * @param {string} created_by - User ID who created the family
 * @returns {Object} The created family object
 */
const createFamily = async (family_name, created_by) => {
  const query = `
    INSERT INTO families (family_name, created_by)
    VALUES ($1, $2)
    RETURNING id, family_name, created_by, created_at;
  `;
  const values = [family_name, created_by];
  const { rows } = await pool.query(query, values);
  return rows[0];
};

/**
 * Retrieves all families a user owns or has been added to as a collaborator
 * @param {string} user_id - The ID of the user
 * @returns {Array} List of families, each with a my_role field ('owner'|'editor'|'viewer')
 */
const getFamiliesByUser = async (user_id) => {
  const query = `
    SELECT
      f.id, f.family_name, f.created_by, f.created_at,
      COUNT(DISTINCT p.id)::int AS member_count,
      COUNT(DISTINCT r.id)::int AS relationship_count,
      COUNT(DISTINCT m.id)::int AS memory_count,
      CASE WHEN f.created_by = $1 THEN 'owner' ELSE fc.role END AS my_role
    FROM families f
    LEFT JOIN family_collaborators fc ON fc.family_id = f.id AND fc.user_id = $1
    LEFT JOIN persons p ON f.id = p.family_id
    LEFT JOIN relationships r ON r.person1_id = p.id
    LEFT JOIN memories m ON f.id = m.family_id
    WHERE f.created_by = $1 OR fc.user_id = $1
    GROUP BY f.id, fc.role
    ORDER BY f.created_at DESC;
  `;
  const { rows } = await pool.query(query, [user_id]);
  return rows;
};

/**
 * Retrieves a family by its ID, if the user owns it or has collaborator access
 * @param {string} family_id - The ID of the family
 * @param {string} user_id - The ID of the requesting user
 * @returns {Object|null} The family object (with my_role) or null if not found/not accessible
 */
const getFamilyById = async (family_id, user_id) => {
  const query = `
    SELECT
      f.id, f.family_name, f.created_by, f.created_at,
      COUNT(DISTINCT p.id)::int AS member_count,
      COUNT(DISTINCT r.id)::int AS relationship_count,
      COUNT(DISTINCT m.id)::int AS memory_count,
      CASE WHEN f.created_by = $2 THEN 'owner' ELSE fc.role END AS my_role
    FROM families f
    LEFT JOIN family_collaborators fc ON fc.family_id = f.id AND fc.user_id = $2
    LEFT JOIN persons p ON f.id = p.family_id
    LEFT JOIN relationships r ON r.person1_id = p.id
    LEFT JOIN memories m ON f.id = m.family_id
    WHERE f.id = $1 AND (f.created_by = $2 OR fc.user_id = $2)
    GROUP BY f.id, fc.role;
  `;
  const { rows } = await pool.query(query, [family_id, user_id]);
  return rows[0] || null;
};

/**
 * Updates a family name by its ID
 * @param {string} family_id - The ID of the family
 * @param {string} family_name - The new family name
 * @returns {Object|null} The updated family object
 */
const updateFamily = async (family_id, family_name, user_id) => {
  const query = `
    UPDATE families 
    SET family_name = $1 
    WHERE id = $2 AND created_by = $3
    RETURNING id, family_name, created_by, created_at;
  `;
  const { rows } = await pool.query(query, [family_name, family_id, user_id]);
  return rows[0] || null;
};

/**
 * Deletes a family by its ID
 * @param {string} family_id - The ID of the family
 * @returns {boolean} True if deleted, false if not found
 */
const deleteFamily = async (family_id, user_id) => {
  const query = `
    DELETE FROM families 
    WHERE id = $1 AND created_by = $2
    RETURNING id;
  `;
  const { rows } = await pool.query(query, [family_id, user_id]);
  return rows.length > 0;
};

module.exports = {
  createFamily,
  getFamiliesByUser,
  getFamilyById,
  updateFamily,
  deleteFamily,
};
