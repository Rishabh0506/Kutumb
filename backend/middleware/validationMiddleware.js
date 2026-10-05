const { validationResult } = require('express-validator');

/**
 * Middleware to check for validation errors
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: true, message: 'Validation failed', errors: errors.array() });
  }
  next();
};

module.exports = { validateRequest };
