const authService = require('../services/authService');

/**
 * Register a new user
 * @route POST /api/auth/register
 */
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    const newUser = await authService.registerUser(name, email, password);
    res.status(201).json({ message: 'User registered successfully', user: newUser });
  } catch (err) {
    console.error("REGISTER ERROR:", err.message);

    if (err.message === 'User already exists') {
      return res.status(400).json({ message: err.message });
    }

    res.status(500).json({ message: 'Registration failed. Please try again.' });
  }
};

/**
 * Log in a user
 * @route POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const { token, user } = await authService.loginUser(email, password);
    res.status(200).json({ message: 'Login successful', token, user });
  } catch (error) {
    if (error.message === 'Invalid email or password') {
      return res.status(401).json({ message: error.message });
    }
    console.error('Error in login controller:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

/**
 * Request a password reset link
 * @route POST /api/auth/forgot-password
 */
const forgotPassword = async (req, res) => {
  // Always return the same generic message, success or failure, so this
  // endpoint can never be used to enumerate which emails have accounts.
  const genericResponse = { message: "If that email is registered, we've sent a password reset link." };
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    await authService.requestPasswordReset(email);
    res.status(200).json(genericResponse);
  } catch (error) {
    console.error('Error in forgotPassword controller:', error);
    res.status(200).json(genericResponse);
  }
};

/**
 * Reset a password using a valid reset token
 * @route POST /api/auth/reset-password
 */
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }

    await authService.resetPassword(token, password);
    res.status(200).json({ message: 'Password has been reset. You can now log in.' });
  } catch (error) {
    if (error.message === 'Invalid or expired reset link') {
      return res.status(400).json({ message: error.message });
    }
    console.error('Error in resetPassword controller:', error);
    res.status(500).json({ message: 'Failed to reset password. Please try again.' });
  }
};

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword
};
