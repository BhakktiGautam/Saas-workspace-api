'use strict';

/**
 * src/middleware/rateLimiter.js
 *
 * Two rate limiters:
 *   - `apiLimiter`  : General limiter applied to all routes
 *   - `authLimiter` : Stricter limiter for auth endpoints to slow brute-force
 *
 * Uses in-memory store by default. For multi-instance deployments,
 * swap to redis store: npm install rate-limit-redis
 */

const rateLimit = require('express-rate-limit');
const config = require('../config');

const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,  // Return `RateLimit-*` headers
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Too many requests, please try again later',
      code: 'RATE_LIMITED',
    },
  },
});

const authLimiter = rateLimit({
  windowMs: config.rateLimit.authWindowMs,
  max: config.rateLimit.authMaxRequests, // Much stricter for auth
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Too many authentication attempts, please try again later',
      code: 'RATE_LIMITED',
    },
  },
  skipSuccessfulRequests: true, // Only count failed auth attempts
});

module.exports = { apiLimiter, authLimiter };
