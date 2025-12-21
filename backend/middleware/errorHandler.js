/**
 * Global error handling middleware
 * Catches all errors and returns consistent JSON responses
 */
function errorHandler(err, req, res, next) {
  console.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    user: req.user?.id
  });

  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: err.message,
      details: err.details
    });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired authentication token'
    });
  }

  if (err.code === 'ECONNREFUSED') {
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'Could not connect to external service'
    });
  }

  // PostgreSQL/Supabase errors
  if (err.code?.startsWith('23')) {
    return res.status(409).json({
      error: 'Conflict',
      message: 'A database constraint was violated'
    });
  }

  // Default to 500 Internal Server Error
  res.status(err.status || 500).json({
    error: err.name || 'Internal Server Error',
    message: err.message || 'An unexpected error occurred',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}

/**
 * 404 Not Found handler
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
    availableEndpoints: [
      'GET /api/health',
      'POST /api/auth/login',
      'GET /api/tenants',
      'POST /api/tenants',
      'POST /api/sync/start',
      'GET /api/sync/:id/status'
    ]
  });
}

/**
 * Async route handler wrapper
 * Catches async errors and passes them to error handler
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler
};
