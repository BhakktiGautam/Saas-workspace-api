'use strict';

/**
 * src/services/auth.service.js
 *
 * Authentication service. Contains all business logic for:
 * - User signup
 * - User login
 * - Token refresh (with rotation)
 * - Logout (token revocation)
 *
 * Controllers are thin — they delegate here. Services interact with
 * the database directly via Prisma.
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../config/database');
const redis = require('../config/redis');
const inMemoryBlacklist = require('../utils/inMemoryBlacklist');
const config = require('../config');
const { 
  signAccessToken, 
  signRefreshToken, 
  verifyRefreshToken,
  verifyAccessToken 
} = require('../utils/jwt');
const { 
  ConflictError, 
  AuthenticationError, 
  NotFoundError,
  TokenExpiredError,
  TokenInvalidError,
  TokenRevokedError,
  TokenTheftDetectedError,
  RefreshTokenError,
  AccountDeactivatedError,
  EmailNotVerifiedError,
  BadRequestError
} = require('../utils/errors');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const { sendVerificationEmail } = require('../utils/email');

// Parse e.g. "7d" → milliseconds
function parseDurationToMs(duration) {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const [, value, unit] = match;
  const units = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return parseInt(value, 10) * (units[unit] || 86400000);
}

// ─── Signup ───────────────────────────────────────────────────

async function signup({ firstName, lastName, email, password }) {
  // Normalize email
  const normalizedEmail = email.toLowerCase().trim();

  // Check for existing user
  const existing = await prisma.user.findUnique({ 
    where: { email: normalizedEmail } 
  });
  
  if (existing) {
    throw new ConflictError('An account with this email already exists');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, config.bcrypt.rounds);
  
  // Generate a verification token and set its expiry
  const verificationToken = uuidv4();
  const tokenExpiry = new Date(Date.now() + config.email.verificationTokenExpiryHours * 3600000);

  const user = await prisma.user.create({
    data: { 
      firstName: firstName.trim(), 
      lastName: lastName.trim(), 
      email: normalizedEmail, 
      passwordHash,
      isEmailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpiry: tokenExpiry,
    },
    select: { 
      id: true, 
      email: true, 
      firstName: true, 
      lastName: true, 
      createdAt: true,
      isEmailVerified: true,
    },
  });

  logger.info({ userId: user.id, email: user.email }, 'User signed up');

  // Send verification email (fire-and-forget — don't block signup if email fails)
  sendVerificationEmail(email, verificationToken).catch((err) =>
    logger.error({ err, email }, 'Failed to send verification email')
  );

  // ✅ Generate token pair for new user
  const tokens = await generateTokenPair(user);
  
  return { user, ...tokens };
}

// ─── Login ────────────────────────────────────────────────────

async function login({ email, password }) {
  // Normalize email
  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({ 
    where: { email: normalizedEmail } 
  });

  // Use constant-time comparison to prevent user enumeration
  const dummyHash = '$2a$12$e.Knxl.tUMOxrRlh.hxK1OBgm80k4PrGPeseF0pauqeRIcyy9eovy';
  const passwordValid = await bcrypt.compare(
    password,
    user ? user.passwordHash : dummyHash
  );

  if (!user || !passwordValid) {
    throw new AuthenticationError('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  if (!user.isActive) {
    throw new AccountDeactivatedError();
  }

  if (!user.isEmailVerified) {
    throw new EmailNotVerifiedError();
  }

  logger.info({ userId: user.id }, 'User logged in');

  const safeUser = {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
  };

  const tokens = await generateTokenPair(safeUser);
  
  return { user: safeUser, ...tokens };
}

// ─── Refresh Tokens (with rotation) ──────────────────────────

async function refreshTokens(rawRefreshToken) {
  try {
    // ✅ 1. Verify JWT signature first (cheap check before DB hit)
    let decoded;
    try {
      decoded = verifyRefreshToken(rawRefreshToken);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new TokenExpiredError('Refresh token has expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new TokenInvalidError('Invalid refresh token');
      }
      throw error;
    }

    if (!decoded || !decoded.sub) {
      throw new TokenInvalidError('Invalid refresh token payload');
    }

    const userId = decoded.sub;

    // ✅ 2. Load the stored token record from database
    const stored = await prisma.refreshToken.findFirst({
      where: {
        token: rawRefreshToken,
        userId: userId,
        revokedAt: null, // ✅ Only valid if not revoked
        expiresAt: {
          gt: new Date(), // ✅ Not expired
        },
      },
      include: {
        user: {
          select: { 
            id: true, 
            email: true, 
            firstName: true, 
            lastName: true, 
            isActive: true,
            isEmailVerified: true,
          },
        },
      },
    });

    // ✅ 3. If token not found or already revoked
    if (!stored) {
      // ✅ Token theft detection: Attempting to use a revoked token
      // Check if there's a revoked token for this user with same ID
      const revokedToken = await prisma.refreshToken.findFirst({
        where: {
          userId: userId,
          token: rawRefreshToken,
          revokedAt: { not: null },
        },
      });

      if (revokedToken) {
        // ✅ Token theft detected! Revoke ALL tokens for this user
        await revokeAllUserTokens(userId);
        logger.warn(
          { userId, tokenId: revokedToken.id },
          '🚨 TOKEN THEFT DETECTED: Attempted to use revoked refresh token. All sessions revoked.'
        );
        throw new TokenTheftDetectedError();
      }

      // Token doesn't exist at all
      throw new RefreshTokenError('Refresh token not found');
    }

    // ✅ 4. Validate user is active
    if (!stored.user.isActive) {
      throw new AccountDeactivatedError();
    }

    // ✅ 5. Optional: Check email verification if required
    if (!stored.user.isEmailVerified) {
      throw new EmailNotVerifiedError();
    }

    // ✅ 6. REVOKE the old token (THIS IS THE ROTATION)
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    logger.info(
      { 
        userId: stored.userId, 
        oldTokenId: stored.id,
        timestamp: new Date().toISOString() 
      },
      'Refresh token rotated successfully'
    );

    // ✅ 7. Generate NEW token pair
    const safeUser = {
      id: stored.user.id,
      email: stored.user.email,
      firstName: stored.user.firstName,
      lastName: stored.user.lastName,
    };

    const tokens = await generateTokenPair(safeUser);
    
    return { 
      user: safeUser, 
      ...tokens,
      // ✅ Add metadata about rotation
      rotationInfo: {
        oldTokenRevoked: true,
        newTokenIssued: true,
        timestamp: new Date().toISOString(),
      }
    };

  } catch (error) {
    // ✅ If token theft is suspected, log it
    if (error.code === 'TOKEN_THEFT_DETECTED') {
      logger.error({ error, refreshToken: rawRefreshToken }, 'Token theft detected during refresh');
    }
    throw error;
  }
}

// ─── Revoke all user tokens (used during token theft) ─────────

async function revokeAllUserTokens(userId) {
  await prisma.refreshToken.updateMany({
    where: {
      userId: userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
  
  logger.info({ userId }, 'All user tokens revoked due to security incident');
}

// ─── Logout ───────────────────────────────────────────────────

async function logout(refreshToken, userId) {
  try {
    // ✅ 1. Revoke refresh token if provided
    if (refreshToken) {
      const result = await prisma.refreshToken.updateMany({
        where: {
          token: refreshToken,
          userId: userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      if (result.count === 0) {
        logger.warn({ userId }, 'Logout attempted with invalid or already revoked token');
      } else {
        logger.info({ userId }, 'Refresh token revoked during logout');
      }
    }

    // ✅ 2. Note: Access token blacklisting is handled in the authenticate middleware
    // The access token will be blacklisted via Redis or in-memory blacklist
    
    return { success: true, message: 'Logged out successfully' };
    
  } catch (error) {
    logger.error({ error, userId }, 'Error during logout');
    throw error;
  }
}

// ─── Verify Email ─────────────────────────────────────────────

async function verifyEmail(token) {
  // Find the user who has this verification token
  const user = await prisma.user.findUnique({
    where: { emailVerificationToken: token },
  });

  if (!user) {
    throw new NotFoundError('Invalid verification token');
  }

  if (user.emailVerificationExpiry < new Date()) {
    throw new TokenExpiredError('Verification token has expired');
  }

  if (user.isEmailVerified) {
    return { message: 'Email is already verified' };
  }

  // Mark as verified and clear the token (so it can't be used again)
  await prisma.user.update({
    where: { id: user.id },
    data: {
      isEmailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpiry: null,
    },
  });

  logger.info({ userId: user.id }, 'Email verified successfully');
  return { message: 'Email verified successfully' };
}

// ─── Get Me ───────────────────────────────────────────────────

async function getMe(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
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
      _count: { select: { memberships: true } },
    },
  });

  if (!user) throw new NotFoundError('User');
  
  return user;
}

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Generate a new token pair (access + refresh)
 * The refresh token is persisted in the database
 */
async function generateTokenPair(user) {
  // ✅ Generate access token
  const accessToken = signAccessToken(user);
  
  // ✅ Generate refresh token using crypto for better security
  const rawRefreshToken = crypto.randomBytes(64).toString('hex');
  
  // ✅ Calculate expiry
  const refreshExpiryMs = parseDurationToMs(config.jwt.refreshExpiresIn);
  const expiresAt = new Date(Date.now() + refreshExpiryMs);

  // ✅ Persist refresh token in database
  await prisma.refreshToken.create({
    data: {
      token: rawRefreshToken,
      userId: user.id,
      expiresAt: expiresAt,
    },
  });

  logger.debug({ userId: user.id }, 'New token pair generated');

  return { accessToken, refreshToken: rawRefreshToken };
}

// ─── Cleanup expired tokens (can be run as a cron job) ──────

async function cleanupExpiredTokens() {
  try {
    const deleted = await prisma.refreshToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
        // ✅ Only delete expired tokens that are already revoked
        // Keep revoked tokens for audit if they haven't expired
        revokedAt: {
          not: null,
        },
      },
    });
    
    logger.info(`🧹 Cleaned up ${deleted.count} expired and revoked refresh tokens`);
    return deleted.count;
  } catch (error) {
    logger.error('Error cleaning up expired tokens:', error);
    throw error;
  }
}

module.exports = { 
  signup, 
  login, 
  refreshTokens, 
  logout, 
  getMe, 
  verifyEmail,
  revokeAllUserTokens,
  cleanupExpiredTokens,
};