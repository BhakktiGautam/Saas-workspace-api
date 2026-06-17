'use strict';

/**
 * src/services/auth.service.js
 *
 * Authentication service. Contains all business logic for:
 * - User signup
 * - User login
 * - Token refresh
 * - Logout (token revocation)
 *
 * Controllers are thin — they delegate here. Services interact with
 * the database directly via Prisma.
 */

const bcrypt = require('bcryptjs');
const prisma = require('../config/database');
const redis = require('../config/redis');
const inMemoryBlacklist = require('../utils/inMemoryBlacklist');
const config = require('../config');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { ConflictError, AuthenticationError, NotFoundError } = require('../utils/errors');
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
  // Check for existing user
  const existing = await prisma.user.findUnique({ where: { email } });
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
      firstName, 
      lastName, 
      email, 
      passwordHash,
      isEmailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpiry: tokenExpiry,
    },
    select: { id: true, email: true, firstName: true, lastName: true, createdAt: true },
  });

  logger.info({ userId: user.id, email: user.email }, 'User signed up');

  // Send verification email (fire-and-forget — don't block signup if email fails)
  sendVerificationEmail(email, verificationToken).catch((err) =>
    logger.error({ err, email }, 'Failed to send verification email')
  );


  const tokens = await generateTokenPair(user);
  return { user, ...tokens };
}

// ─── Login ────────────────────────────────────────────────────

async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });

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
    throw new AuthenticationError('Account is deactivated', 'ACCOUNT_DEACTIVATED');
  }
  if (!user.isEmailVerified) {
    throw new AuthenticationError(
      'Please verify your email before logging in',
      'EMAIL_NOT_VERIFIED'
    );
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

// ─── Refresh Tokens ───────────────────────────────────────────

async function refreshTokens(rawRefreshToken) {
  // Verify JWT signature first (cheap check before DB hit)
  const decoded = verifyRefreshToken(rawRefreshToken);

  // Load the stored token record
  const stored = await prisma.refreshToken.findUnique({
    where: { token: rawRefreshToken },
    include: {
      user: {
        select: { id: true, email: true, firstName: true, lastName: true, isActive: true },
      },
    },
  });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw new AuthenticationError('Refresh token is invalid or expired', 'REFRESH_TOKEN_INVALID');
  }

  if (!stored.user.isActive) {
    throw new AuthenticationError('Account is deactivated', 'ACCOUNT_DEACTIVATED');
  }

  // Rotate: revoke old token and issue a fresh pair
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const tokens = await generateTokenPair(stored.user);
  logger.info({ userId: stored.userId }, 'Tokens refreshed');
  return { user: stored.user, ...tokens };
}

// ─── Logout ───────────────────────────────────────────────────

async function logout(accessToken, refreshToken, userId) {
  // Blacklist access token
  const accessTtlMs = parseDurationToMs(config.jwt.accessExpiresIn);

  if (config.redis.enabled) {
    await redis.set(
      `blacklist:${accessToken}`,
      '1',
      Math.ceil(accessTtlMs / 1000)
    );
  } else {
    inMemoryBlacklist.add(accessToken, accessTtlMs);
  }

  // Revoke refresh token
  if (refreshToken) {
    await prisma.refreshToken.updateMany({
      where: {
        token: refreshToken,
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  logger.info({ userId }, 'User logged out');
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
    throw new AuthenticationError('Verification token has expired', 'TOKEN_EXPIRED');
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

  logger.info({ userId: user.id }, 'Email verified');
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
      createdAt: true,
      _count: { select: { memberships: true } },
    },
  });

  if (!user) throw new NotFoundError('User');
  return user;
}

// ─── Helpers ─────────────────────────────────────────────────

async function generateTokenPair(user) {
  const accessToken = signAccessToken(user);
  const rawRefreshToken = signRefreshToken(user);

  const refreshExpiryMs = parseDurationToMs(config.jwt.refreshExpiresIn);

  // Persist refresh token
  await prisma.refreshToken.create({
    data: {
      token: rawRefreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + refreshExpiryMs),
    },
  });

  return { accessToken, refreshToken: rawRefreshToken };
}

module.exports = { signup, login, refreshTokens, logout, getMe, verifyEmail };
