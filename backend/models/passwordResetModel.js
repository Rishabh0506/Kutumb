const crypto = require('crypto');
const pool = require('../config/db');

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

const hashToken = (rawToken) => crypto.createHash('sha256').update(rawToken).digest('hex');

/**
 * Creates a new password-reset token for a user, invalidating any of their
 * existing unused tokens first (only one valid reset link at a time).
 * @param {string} user_id
 * @returns {string} the raw (unhashed) token — never stored, only returned
 *   here so the caller can email it immediately
 */
const createResetToken = async (user_id) => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1 AND used_at IS NULL', [user_id]);
  await pool.query(
    'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [user_id, tokenHash, expiresAt]
  );

  return rawToken;
};

/**
 * Looks up a valid (unused, unexpired) token by its raw value.
 * @param {string} rawToken
 * @returns {{id: string, user_id: string}|null}
 */
const getValidToken = async (rawToken) => {
  const tokenHash = hashToken(rawToken);
  const { rows } = await pool.query(
    `SELECT id, user_id FROM password_reset_tokens
     WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW();`,
    [tokenHash]
  );
  return rows[0] || null;
};

/**
 * Marks a token as used so it can't be replayed.
 * @param {string} id
 */
const markTokenUsed = async (id) => {
  await pool.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1;', [id]);
};

module.exports = {
  createResetToken,
  getValidToken,
  markTokenUsed,
};
