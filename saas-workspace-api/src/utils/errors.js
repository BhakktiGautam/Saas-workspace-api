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

// ✅ NEW: Token-specific error classes for refresh token rotation

/**
 * TokenError - Base class for token-related errors
 */
class TokenError extends AppError {
  constructor(message = 'Token operation failed', code = 'TOKEN_ERROR') {
    super(message, 401, code);
  }
}

/**
 * TokenExpiredError - Thrown when a token has expired
 */
class TokenExpiredError extends TokenError {
  constructor(message = 'Token has expired. Please refresh your tokens.', code = 'TOKEN_EXPIRED') {
    super(message, 401, code);
  }
}

/**
 * TokenInvalidError - Thrown when a token is invalid
 */
class TokenInvalidError extends TokenError {
  constructor(message = 'Invalid token provided.', code = 'TOKEN_INVALID') {
    super(message, 401, code);
  }
}

/**
 * TokenRevokedError - Thrown when a token has been revoked
 */
class TokenRevokedError extends TokenError {
  constructor(message = 'Token has been revoked. Please log in again.', code = 'TOKEN_REVOKED') {
    super(message, 401, code);
  }
}

/**
 * TokenMissingError - Thrown when a token is required but not provided
 */
class TokenMissingError extends TokenError {
  constructor(message = 'Token is required.', code = 'TOKEN_MISSING') {
    super(message, 401, code);
  }
}

/**
 * RefreshTokenError - Thrown specifically for refresh token issues
 */
class RefreshTokenError extends AppError {
  constructor(
    message = 'Refresh token operation failed. Please log in again.',
    code = 'REFRESH_TOKEN_ERROR',
    statusCode = 401
  ) {
    super(message, statusCode, code);
  }
}

/**
 * AccountDeactivatedError - Thrown when user account is deactivated
 */
class AccountDeactivatedError extends AppError {
  constructor(message = 'Your account has been deactivated. Please contact support.', code = 'ACCOUNT_DEACTIVATED') {
    super(message, 403, code);
  }
}

/**
 * EmailNotVerifiedError - Thrown when email is not verified
 */
class EmailNotVerifiedError extends AppError {
  constructor(
    message = 'Please verify your email address before proceeding.',
    code = 'EMAIL_NOT_VERIFIED',
    statusCode = 403
  ) {
    super(message, statusCode, code);
  }
}

/**
 * TokenTheftDetectedError - Thrown when token theft is suspected
 */
class TokenTheftDetectedError extends AppError {
  constructor(
    message = 'Security alert: Possible token theft detected. All sessions have been revoked.',
    code = 'TOKEN_THEFT_DETECTED',
    statusCode = 401
  ) {
    super(message, statusCode, code);
  }
}

/**
 * BadRequestError - Thrown for general bad requests
 */
class BadRequestError extends AppError {
  constructor(message = 'Invalid request. Please check your input.', code = 'BAD_REQUEST', details = null) {
    super(message, 400, code, details);
  }
}

module.exports = {
  // Base error
  AppError,

  // General errors
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  BadRequestError,

  // Token errors
  TokenError,
  TokenExpiredError,
  TokenInvalidError,
  TokenRevokedError,
  TokenMissingError,
  RefreshTokenError,

  // Account errors
  AccountDeactivatedError,
  EmailNotVerifiedError,

  // Security errors
  TokenTheftDetectedError,
};