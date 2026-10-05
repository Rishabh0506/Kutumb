const pool = require('../config/db');

/**
 * SQL fragment: family ids the user can read — families they own, plus
 * families they've been added to as a collaborator (any role).
 * @param {number} userParamIndex - the $N bind position of user_id in the caller's query
 */
const readableFamilyIdsSubquery = (userParamIndex) => `(
    SELECT f.id FROM families f WHERE f.created_by = $${userParamIndex}
    UNION
    SELECT fc.family_id FROM family_collaborators fc WHERE fc.user_id = $${userParamIndex}
  )`;

/**
 * SQL fragment: family ids the user can write to — families they own, plus
 * families they've been added to as an 'editor' collaborator.
 * @param {number} userParamIndex - the $N bind position of user_id in the caller's query
 */
const writableFamilyIdsSubquery = (userParamIndex) => `(
    SELECT f.id FROM families f WHERE f.created_by = $${userParamIndex}
    UNION
    SELECT fc.family_id FROM family_collaborators fc
    WHERE fc.user_id = $${userParamIndex} AND fc.role = 'editor'
  )`;

/**
 * Resolves a user's access level on a family.
 * @param {string} family_id
 * @param {string} user_id
 * @returns {'owner'|'editor'|'viewer'|null}
 */
const getFamilyRole = async (family_id, user_id) => {
  const query = `
    SELECT
      CASE
        WHEN f.created_by = $2 THEN 'owner'
        ELSE fc.role
      END AS role
    FROM families f
    LEFT JOIN family_collaborators fc ON fc.family_id = f.id AND fc.user_id = $2
    WHERE f.id = $1 AND (f.created_by = $2 OR fc.user_id = $2);
  `;
  const { rows } = await pool.query(query, [family_id, user_id]);
  return rows[0]?.role || null;
};

/**
 * Lists everyone with access to a family: the owner (synthesized first),
 * then collaborators ordered by when they were added.
 * @param {string} family_id
 */
const listCollaborators = async (family_id) => {
  const query = `
    SELECT u.id AS user_id, u.name, u.email, 'owner' AS role, true AS "isOwner", f.created_at
    FROM families f
    JOIN users u ON u.id = f.created_by
    WHERE f.id = $1

    UNION ALL

    SELECT u.id AS user_id, u.name, u.email, fc.role, false AS "isOwner", fc.created_at
    FROM family_collaborators fc
    JOIN users u ON u.id = fc.user_id
    WHERE fc.family_id = $1
    ORDER BY "isOwner" DESC, created_at ASC;
  `;
  const { rows } = await pool.query(query, [family_id]);
  return rows;
};

/**
 * Grants a user access to a family.
 * @param {string} family_id
 * @param {string} user_id
 * @param {'viewer'|'editor'} role
 * @param {string} invited_by - id of the owner granting access
 */
const addCollaborator = async (family_id, user_id, role, invited_by) => {
  const query = `
    INSERT INTO family_collaborators (family_id, user_id, role, invited_by)
    VALUES ($1, $2, $3, $4)
    RETURNING id, family_id, user_id, role, created_at;
  `;
  const { rows } = await pool.query(query, [family_id, user_id, role, invited_by]);
  return rows[0];
};

/**
 * Checks whether a user is already a collaborator on a family.
 * @param {string} family_id
 * @param {string} user_id
 */
const getCollaborator = async (family_id, user_id) => {
  const query = `
    SELECT id, family_id, user_id, role, created_at
    FROM family_collaborators
    WHERE family_id = $1 AND user_id = $2;
  `;
  const { rows } = await pool.query(query, [family_id, user_id]);
  return rows[0] || null;
};

/**
 * Updates a collaborator's role.
 * @param {string} family_id
 * @param {string} user_id
 * @param {'viewer'|'editor'} role
 */
const updateCollaboratorRole = async (family_id, user_id, role) => {
  const query = `
    UPDATE family_collaborators
    SET role = $3
    WHERE family_id = $1 AND user_id = $2
    RETURNING id, family_id, user_id, role, created_at;
  `;
  const { rows } = await pool.query(query, [family_id, user_id, role]);
  return rows[0] || null;
};

/**
 * Revokes a collaborator's access to a family.
 * @param {string} family_id
 * @param {string} user_id
 * @returns {boolean} true if a row was removed
 */
const removeCollaborator = async (family_id, user_id) => {
  const query = `
    DELETE FROM family_collaborators
    WHERE family_id = $1 AND user_id = $2
    RETURNING id;
  `;
  const { rows } = await pool.query(query, [family_id, user_id]);
  return rows.length > 0;
};

module.exports = {
  readableFamilyIdsSubquery,
  writableFamilyIdsSubquery,
  getFamilyRole,
  listCollaborators,
  addCollaborator,
  getCollaborator,
  updateCollaboratorRole,
  removeCollaborator,
};
