'use strict';

/**
 * src/utils/errors.js
 *
 * Centralized error types. All intentional errors thrown in the application
 * should use one of these classes, which carry an HTTP status code. The
 * global error handler in middleware/errorHandler.js reads these to build
 * the appropriate API response.
 */

class AppError extends Error {
  constructor(message, statusCode, code = null, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code; // machine-readable error code e.g. "TOKEN_EXPIRED"
    this.details = details;
    this.isOperational = true; // distinguishes from programming errors
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Request validation failed. Check the highlighted fields and try again.', details = null) {
    super(message, 422, 'VALIDATION_ERROR', details);
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Please sign in to continue.', code = 'UNAUTHENTICATED') {
    super(message, 401, code);
  }
}

class AuthorizationError extends AppError {
  constructor(
    message = 'You do not have permission to perform this action. Contact an organization owner if you think this is a mistake.'
  ) {
    super(message, 403, 'FORBIDDEN');
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`The requested ${resource.toLowerCase()} could not be found.`, 404, 'NOT_FOUND');
  }
}

class ConflictError extends AppError {
  constructor(message = 'This request conflicts with an existing record. Please refresh and try again.') {
    super(message, 409, 'CONFLICT');
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Too many requests. Please wait a moment and try again.') {
    super(message, 429, 'RATE_LIMITED');
  }
}

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
};
