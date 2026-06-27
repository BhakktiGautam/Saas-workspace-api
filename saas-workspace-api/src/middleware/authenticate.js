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
const config = require('../config');

async function authenticate(req, _res, next) {
  try {
    // 1. Extract token from Authorization header
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      throw new AuthenticationError('No token provided', 'TOKEN_MISSING');
    }

    // 2. Verify signature / expiry
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new AuthenticationError('Access token expired', 'TOKEN_EXPIRED');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new AuthenticationError('Invalid access token', 'TOKEN_INVALID');
      }
      throw error;
    }

    // 3. Check Redis blacklist (populated on logout)
    if (config.redis.enabled) {
      const isBlacklisted = await redis.exists(`blacklist:${token}`);
      if (isBlacklisted) {
        throw new AuthenticationError('Token has been revoked', 'TOKEN_REVOKED');
      }
    }

    // 4. Fallback blacklist when Redis is disabled
    if (inMemoryBlacklist.has(token)) {
      throw new AuthenticationError('Token has been revoked', 'TOKEN_REVOKED');
    }

    // 5. Load user from DB — ensures deactivated accounts can't use old tokens
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        isActive: true,
        isEmailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // 6. Validate user exists and is active
    if (!user) {
      throw new NotFoundError('User');
    }

    if (!user.isActive) {
      throw new AuthenticationError('Account is deactivated', 'ACCOUNT_DEACTIVATED');
    }

    // ✅ 7. Optional: Check if email is verified (if required)
    // if (!user.isEmailVerified) {
    //   throw new AuthenticationError('Please verify your email first', 'EMAIL_NOT_VERIFIED');
    // }

    // 8. Attach user and token to request
    req.user = user;
    req.userId = user.id;
    req.token = token; // needed for logout blacklisting

    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = authenticate;