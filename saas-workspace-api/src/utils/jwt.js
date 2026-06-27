'use strict';

/**
 * src/utils/jwt.js
 *
 * JWT helpers for signing and verifying access and refresh tokens.
 * Access tokens are short-lived (15 min) and carry the user identity.
 * Refresh tokens are long-lived (7 days) and are stored in the database
 * so they can be explicitly revoked on logout.
 */

const jwt = require('jsonwebtoken');
const config = require('../config');
const { 
  AuthenticationError, 
  TokenExpiredError, 
  TokenInvalidError,
  TokenMissingError
} = require('./errors');
const logger = require('./logger');

/**
 * Sign a new JWT access token.
 * @param {{ id, email, firstName, lastName }} user - User object
 * @returns {string} signed JWT
 */
function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      type: 'access', // ✅ Add token type for identification
      iat: Math.floor(Date.now() / 1000), // Issued at
    },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessExpiresIn }
  );
}

/**
 * Sign a new JWT refresh token.
 * Note: Refresh tokens are now generated using crypto.randomBytes()
 * in the auth service, but this function is kept for backward compatibility.
 * @param {{ id }} user - User object
 * @returns {string} signed JWT
 */
function signRefreshToken(user) {
  return jwt.sign(
    { 
      sub: user.id,
      type: 'refresh', // ✅ Add token type for identification
      iat: Math.floor(Date.now() / 1000),
    }, 
    config.jwt.refreshSecret, 
    {
      expiresIn: config.jwt.refreshExpiresIn,
    }
  );
}

/**
 * Verify and decode an access token.
 * Throws specific errors on failure.
 * @param {string} token - JWT access token
 * @returns {object} decoded payload
 * @throws {TokenMissingError} - If token is missing
 * @throws {TokenExpiredError} - If token has expired
 * @throws {TokenInvalidError} - If token is invalid
 */
function verifyAccessToken(token) {
  if (!token) {
    throw new TokenMissingError('Access token is required');
  }

  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret);
    
    // ✅ Verify token type
    if (decoded.type && decoded.type !== 'access') {
      throw new TokenInvalidError('Invalid token type');
    }
    
    return decoded;
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new TokenExpiredError('Access token has expired');
    }
    if (err.name === 'JsonWebTokenError') {
      throw new TokenInvalidError('Invalid access token');
    }
    // Re-throw if it's our custom error
    if (err instanceof AuthenticationError) {
      throw err;
    }
    throw new TokenInvalidError('Failed to verify access token');
  }
}

/**
 * Verify and decode a refresh token.
 * Throws specific errors on failure.
 * @param {string} token - JWT refresh token
 * @returns {object} decoded payload
 * @throws {TokenMissingError} - If token is missing
 * @throws {TokenExpiredError} - If token has expired
 * @throws {TokenInvalidError} - If token is invalid
 */
function verifyRefreshToken(token) {
  if (!token) {
    throw new TokenMissingError('Refresh token is required');
  }

  try {
    const decoded = jwt.verify(token, config.jwt.refreshSecret);
    
    // ✅ Verify token type
    if (decoded.type && decoded.type !== 'refresh') {
      throw new TokenInvalidError('Invalid token type');
    }
    
    return decoded;
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new TokenExpiredError('Refresh token has expired');
    }
    if (err.name === 'JsonWebTokenError') {
      throw new TokenInvalidError('Invalid refresh token');
    }
    // Re-throw if it's our custom error
    if (err instanceof AuthenticationError) {
      throw err;
    }
    throw new TokenInvalidError('Failed to verify refresh token');
  }
}

/**
 * Extract a Bearer token from an Authorization header value.
 * @param {string} headerValue - e.g. "Bearer eyJhbGci..."
 * @returns {string|null} - The extracted token or null
 */
function extractBearerToken(headerValue) {
  if (!headerValue || typeof headerValue !== 'string') {
    return null;
  }
  
  const trimmed = headerValue.trim();
  if (!trimmed.startsWith('Bearer ')) {
    return null;
  }
  
  const token = trimmed.slice(7).trim();
  return token || null;
}

/**
 * ✅ NEW: Decode a JWT token without verification
 * @param {string} token - JWT token
 * @returns {object|null} - Decoded payload or null
 */
function decodeToken(token) {
  try {
    return jwt.decode(token);
  } catch (err) {
    logger.debug({ err }, 'Failed to decode token');
    return null;
  }
}

/**
 * ✅ NEW: Check if a token is expired
 * @param {string} token - JWT token
 * @returns {boolean} - True if token is expired
 */
function isTokenExpired(token) {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) {
    return true;
  }
  return decoded.exp * 1000 < Date.now();
}

/**
 * ✅ NEW: Get remaining time on a token in seconds
 * @param {string} token - JWT token
 * @returns {number} - Remaining time in seconds (0 if expired)
 */
function getTokenRemainingTime(token) {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) {
    return 0;
  }
  const remaining = decoded.exp * 1000 - Date.now();
  return Math.max(0, Math.floor(remaining / 1000));
}

/**
 * ✅ NEW: Generate a secure random token (for refresh tokens)
 * @param {number} bytes - Number of bytes to generate
 * @returns {string} - Hex string
 */
function generateSecureToken(bytes = 64) {
  const crypto = require('crypto');
  return crypto.randomBytes(bytes).toString('hex');
}

module.exports = { 
  signAccessToken, 
  signRefreshToken, 
  verifyAccessToken, 
  verifyRefreshToken, 
  extractBearerToken,
  decodeToken,           // ✅ NEW
  isTokenExpired,        // ✅ NEW
  getTokenRemainingTime, // ✅ NEW
  generateSecureToken,   // ✅ NEW
};