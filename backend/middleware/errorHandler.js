const logger = require('../utils/logger');

/**
 * Global Error Handler Middleware
 * Catches all unhandled errors in the application
 */
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  // Full detail (including stack) always goes to the server-side log,
  // regardless of environment — only the HTTP response itself is gated on
  // NODE_ENV, so a production deploy never leaks a stack trace to a client
  // but still has one to look at when something breaks.
  (req.log || logger).error({ err, statusCode }, err.message || 'Unhandled error');

  const showStack = process.env.NODE_ENV === 'development';

  res.status(statusCode).json({
    error: true,
    message: err.message || 'Something went wrong',
    ...(showStack && { stack: err.stack }),
  });
};

module.exports = errorHandler;
