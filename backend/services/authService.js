const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');
const passwordResetModel = require('../models/passwordResetModel');
const { sendPasswordResetEmail } = require('../utils/mailer');

/**
 * Registers a new user
 * @param {string} name 
 * @param {string} email 
 * @param {string} password 
 * @returns {Object} The created user
 */
const registerUser = async (name, email, password) => {
  // Check if user already exists
  const existingUser = await userModel.getUserByEmail(email);
  if (existingUser) {
    throw new Error('User already exists');
  }

  // Hash password
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // Create user
  const newUser = await userModel.createUser(name, email, passwordHash);
  return newUser;
};

/**
 * Authenticates a user and returns a JWT token
 * @param {string} email 
 * @param {string} password 
 * @returns {Object} Token and user object
 */
const loginUser = async (email, password) => {
  // Find user
  const user = await userModel.getUserByEmail(email);
  if (!user) {
    throw new Error('Invalid email or password');
  }

  // Verify password
  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    throw new Error('Invalid email or password');
  }

  // Generate token
  const payload = {
    id: user.id,
    email: user.email
  };
  
  if (!process.env.JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET environment variable is not set.');
  }

  const token = jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  // Remove password hash from response
  const userResponse = {
    id: user.id,
    name: user.name,
    email: user.email,
    created_at: user.created_at
  };

  return { token, user: userResponse };
};

/**
 * Requests a password reset — emails a reset link if the address is
 * registered. Deliberately silent (no error, no return value) if the email
 * isn't registered, so the caller can respond identically either way and
 * avoid leaking which emails have accounts.
 * @param {string} email
 */
const requestPasswordReset = async (email) => {
  const user = await userModel.getUserByEmail(email);
  if (!user) return;

  const rawToken = await passwordResetModel.createResetToken(user.id);
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;
  await sendPasswordResetEmail(user.email, resetUrl);
};

/**
 * Resets a user's password given a valid reset token.
 * @param {string} rawToken
 * @param {string} newPassword
 */
const resetPassword = async (rawToken, newPassword) => {
  const tokenRow = await passwordResetModel.getValidToken(rawToken);
  if (!tokenRow) {
    throw new Error('Invalid or expired reset link');
  }

  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(newPassword, saltRounds);
  await userModel.updatePasswordHash(tokenRow.user_id, passwordHash);
  await passwordResetModel.markTokenUsed(tokenRow.id);
};

module.exports = {
  registerUser,
  loginUser,
  requestPasswordReset,
  resetPassword,
};
