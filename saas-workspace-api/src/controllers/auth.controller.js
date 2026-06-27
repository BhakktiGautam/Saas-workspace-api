'use strict';

/**
 * src/controllers/auth.controller.js
 *
 * Thin HTTP layer for auth routes. Delegates all logic to auth.service.js.
 * Responsibilities here: parse req, call service, format res.
 */

const authService = require('../services/auth.service');
const { sendSuccess } = require('../utils/response');
const { AppError } = require('../utils/errors');

async function signup(req, res, next) {
  try {
    const result = await authService.signup(req.body);
    return sendSuccess(res, result, 201);
  } catch (err) {
    return next(err);
  }
}

async function login(req, res, next) {
  try {
    const result = await authService.login(req.body);
    return sendSuccess(res, result);
  } catch (err) {
    return next(err);
  }
}

/**
 * Refresh tokens with rotation
 * - Validates the old refresh token
 * - Revokes the old refresh token
 * - Issues a new pair of access and refresh tokens
 */
async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;

    // ✅ Validate refresh token presence
    if (!refreshToken) {
      throw new AppError('Refresh token is required', 400, 'REFRESH_TOKEN_REQUIRED');
    }

    // ✅ Call service with token rotation logic
    const result = await authService.refreshTokens(refreshToken);
    
    return sendSuccess(res, result, 200, 'Tokens refreshed successfully');
  } catch (err) {
    return next(err);
  }
}

/**
 * Logout - revokes refresh token
 * - Revokes the refresh token in database
 * - Optionally blacklists access token in Redis
 */
async function logout(req, res, next) {
  try {
    const { refreshToken } = req.body;

    // ✅ Validate refresh token presence
    if (!refreshToken) {
      throw new AppError('Refresh token required for logout', 400, 'REFRESH_TOKEN_REQUIRED');
    }

    // ✅ Call service to revoke token
    await authService.logout(refreshToken, req.user?.id);

    return sendSuccess(res, { message: 'Logged out successfully' });
  } catch (err) {
    return next(err);
  }
}

async function getMe(req, res, next) {
  try {
    const user = await authService.getMe(req.user.id);
    return sendSuccess(res, user);
  } catch (err) {
    return next(err);
  }
}

async function verifyEmail(req, res, next) {
  try {
    const result = await authService.verifyEmail(req.params.token);
    return sendSuccess(res, result);
  } catch (err) {
    return next(err);
  }
}

module.exports = { 
  signup, 
  login, 
  refresh, 
  logout, 
  getMe, 
  verifyEmail 
};