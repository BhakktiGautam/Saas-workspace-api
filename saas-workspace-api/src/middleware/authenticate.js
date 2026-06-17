'use strict';

/**
 * src/middleware/authenticate.js
 *
 * Verifies the JWT access token on every protected route.
 *
 * Flow:
 *   1. Extract Bearer token from Authorization header
 *   2. Verify signature and expiry
 *   3. Check if token has been blacklisted in Redis (post-logout)
 *   4. Load the user record from DB to ensure they still exist / are active
 *   5. Attach the user to req.user
 */

const prisma = require('../config/database');
const redis = require('../config/redis');
const inMemoryBlacklist = require('../utils/inMemoryBlacklist');
const { verifyAccessToken, extractBearerToken } = require('../utils/jwt');
const { AuthenticationError, NotFoundError } = require('../utils/errors');

async function authenticate(req, _res, next) {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      throw new AuthenticationError('No token provided');
    }

    // Verify signature / expiry
    const decoded = verifyAccessToken(token);

    // Check Redis blacklist (populated on logout)
    // Check Redis blacklist (populated on logout)
    const isBlacklisted = await redis.exists(`blacklist:${token}`);

    if (isBlacklisted) {
      throw new AuthenticationError('Token has been revoked', 'TOKEN_REVOKED');
    }

    // Fallback blacklist when Redis is disabled
    if (inMemoryBlacklist.has(token)) {
      throw new AuthenticationError('Token has been revoked', 'TOKEN_REVOKED');
    }

    // Load user from DB — ensures deactivated accounts can't use old tokens
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        isActive: true,
      },
    });

    if (!user) throw new NotFoundError('User');
    if (!user.isActive) {
      throw new AuthenticationError('Account is deactivated', 'ACCOUNT_DEACTIVATED');
    }

    req.user = user;
    req.token = token; // needed for logout blacklisting
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = authenticate;
