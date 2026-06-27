'use strict';

/**
 * src/utils/response.js
 *
 * Standardised API response envelope helpers.
 * All controllers use these to ensure a consistent response shape:
 *
 *   Success: { success: true, data: {...}, meta?: {...} }
 *   Error:   { success: false, error: { message, code, details? } }
 */

/**
 * Send a successful JSON response.
 * @param {Response} res  - Express response object
 * @param {*}        data - Payload to send under the `data` key
 * @param {number}   [statusCode=200] - HTTP status code
 * @param {object}   [meta] - Optional pagination/metadata
 * @param {string}   [message] - Optional success message
 */
function sendSuccess(res, data, statusCode = 200, meta = null, message = null) {
  const body = { success: true };
  
  if (message) {
    body.message = message;
  }
  
  body.data = data;
  
  if (meta) {
    body.meta = meta;
  }
  
  return res.status(statusCode).json(body);
}

/**
 * Send an error JSON response.
 * @param {Response} res - Express response object
 * @param {Error} error - Error object
 * @param {number} [statusCode] - Override status code
 */
function sendError(res, error, statusCode = null) {
  const status = statusCode || error.statusCode || 500;
  const code = error.code || 'INTERNAL_ERROR';
  const message = error.message || 'An unexpected error occurred';
  const details = error.details || null;

  const body = {
    success: false,
    error: {
      message,
      code,
    },
  };

  if (details) {
    body.error.details = details;
  }

  return res.status(status).json(body);
}

/**
 * Build a pagination meta object for list endpoints.
 * @param {Object} params - Pagination parameters
 * @param {number} params.page - Current page number
 * @param {number} params.limit - Items per page
 * @param {number} params.total - Total number of items
 * @param {number} [params.totalPages] - Total pages (calculated if not provided)
 */
function paginationMeta({ page, limit, total, totalPages = null }) {
  return {
    page: Number(page),
    limit: Number(limit),
    total: Number(total),
    totalPages: totalPages || Math.ceil(total / limit),
    hasNextPage: page < Math.ceil(total / limit),
    hasPreviousPage: page > 1,
  };
}

/**
 * ✅ NEW: Send a success response with tokens (for auth responses)
 * @param {Response} res - Express response object
 * @param {Object} data - Response data
 * @param {string} data.accessToken - JWT access token
 * @param {string} data.refreshToken - JWT refresh token
 * @param {Object} data.user - User object
 * @param {string} message - Success message
 * @param {number} [statusCode=200] - HTTP status code
 */
function sendTokenSuccess(res, { accessToken, refreshToken, user }, message = 'Success', statusCode = 200) {
  return sendSuccess(res, {
    accessToken,
    refreshToken,
    user,
  }, statusCode, null, message);
}

/**
 * ✅ NEW: Send a success response with token rotation notice
 * @param {Response} res - Express response object
 * @param {Object} data - Response data
 * @param {string} data.accessToken - New access token
 * @param {string} data.refreshToken - New refresh token
 * @param {Object} data.user - User object
 */
function sendRotatedTokens(res, { accessToken, refreshToken, user }) {
  return sendTokenSuccess(
    res,
    { accessToken, refreshToken, user },
    'Tokens refreshed successfully. Old refresh token has been revoked.',
    200
  );
}

/**
 * ✅ NEW: Send a logout success response
 * @param {Response} res - Express response object
 */
function sendLogoutSuccess(res) {
  return sendSuccess(
    res,
    { message: 'Logged out successfully. Tokens have been revoked.' },
    200,
    null,
    'Logout successful'
  );
}

/**
 * ✅ NEW: Send a "created" response
 * @param {Response} res - Express response object
 * @param {*} data - Created resource data
 * @param {string} [message='Resource created successfully']
 */
function sendCreated(res, data, message = 'Resource created successfully') {
  return sendSuccess(res, data, 201, null, message);
}

/**
 * ✅ NEW: Send a "no content" response
 * @param {Response} res - Express response object
 */
function sendNoContent(res) {
  return res.status(204).send();
}

module.exports = {
  sendSuccess,
  sendError,
  paginationMeta,
  sendTokenSuccess,
  sendRotatedTokens,
  sendLogoutSuccess,
  sendCreated,
  sendNoContent,
};