'use strict';

/**
 * src/config/index.js
 *
 * Central configuration module. Reads environment variables, validates
 * required values at startup, and exports a typed config object.
 * All application code imports from here — never from process.env directly.
 */

require('dotenv').config();

// ─── Helpers ─────────────────────────────────────────────────

function required(key) {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

function optional(key, defaultValue) {
  return process.env[key] ?? defaultValue;
}

function optionalInt(key, defaultValue) {
  const val = process.env[key];
  return val ? parseInt(val, 10) : defaultValue;
}

function optionalBool(key, defaultValue) {
  const val = process.env[key];
  if (val === undefined) return defaultValue;
  return val === 'true' || val === '1';
}

// ─── Config Object ────────────────────────────────────────────

const config = {
  env: optional('NODE_ENV', 'development'),
  isProduction: optional('NODE_ENV', 'development') === 'production',
  isDevelopment: optional('NODE_ENV', 'development') === 'development',

  server: {
    port: optionalInt('PORT', 3000),
    apiVersion: optional('API_VERSION', 'v1'),
  },

  database: {
    url: required('DATABASE_URL'),
  },

  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET'),
    refreshSecret: required('JWT_REFRESH_SECRET'),
    accessExpiresIn: optional('JWT_ACCESS_EXPIRES_IN', '15m'),
    refreshExpiresIn: optional('JWT_REFRESH_EXPIRES_IN', '7d'),
  },

  bcrypt: {
    rounds: optionalInt('BCRYPT_ROUNDS', 12),
  },

  redis: {
    url: optional('REDIS_URL', 'redis://localhost:6379'),
    enabled: optionalBool('REDIS_ENABLED', false),
  },

  rateLimit: {
    windowMs: optionalInt('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000), // 15 min
    maxRequests: optionalInt('RATE_LIMIT_MAX_REQUESTS', 100),
    authWindowMs: optionalInt('AUTH_RATE_LIMIT_WINDOW_MS', 5 * 60 * 1000), // 5 min
    authMaxRequests: optionalInt('AUTH_RATE_LIMIT_MAX', 5),
  },

  cors: {
    origins: optional('CORS_ORIGINS', 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim()),
  },

  invitation: {
    expiresInDays: optionalInt('INVITATION_EXPIRES_IN_DAYS', 7),
  },

  logging: {
    level: optional('LOG_LEVEL', 'info'),
    pretty: optionalBool('LOG_PRETTY', true),
  },
};

module.exports = config;
