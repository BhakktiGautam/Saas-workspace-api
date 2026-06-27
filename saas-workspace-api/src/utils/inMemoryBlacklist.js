/**
 * inMemoryBlacklist.js
 *
 * A lightweight in-process token blacklist used when REDIS_ENABLED=false.
 *
 * How it works:
 *   - Stores { token -> expiresAtMs } in a plain Map.
 *   - A periodic cleanup timer (every 5 minutes) removes entries whose
 *     TTL has already elapsed, keeping memory bounded.
 *
 * Limitations (documented intentionally — this is a learning codebase):
 *   - NOT safe for multi-instance / clustered deployments: each process
 *     has its own Map, so a token blacklisted on instance A is still valid
 *     on instance B. Enable Redis for production multi-instance setups.
 *   - Data is lost on process restart: blacklisted tokens become valid again
 *     after a server restart (within their original expiry window). This is
 *     acceptable for development and single-instance staging environments.
 *
 * For production, set REDIS_ENABLED=true and provide REDIS_URL.
 */

const blacklist = new Map(); // Map<token: string, expiresAtMs: number>
const logger = require('./logger');

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Run cleanup every 5 minutes
const MAX_ENTRIES_WARNING = 10000; // Warn if blacklist grows too large

// ✅ TRACK: Stats for monitoring
let totalEntriesAdded = 0;
let totalEntriesCleaned = 0;

/**
 * Add a token to the blacklist.
 * @param {string} token  - The JWT token (or its jti claim)
 * @param {number} ttlMs - Time-to-live in milliseconds (remaining token lifetime)
 */
function add(token, ttlMs) {
  const expiresAtMs = Date.now() + ttlMs;
  blacklist.set(token, expiresAtMs);
  totalEntriesAdded++;

  // ✅ Warn if blacklist grows too large
  if (blacklist.size > MAX_ENTRIES_WARNING) {
    logger.warn(
      { 
        size: blacklist.size, 
        maxWarning: MAX_ENTRIES_WARNING 
      },
      'In-memory blacklist is growing large. Consider enabling Redis.'
    );
  }

  logger.debug(
    { 
      token: token.substring(0, 10) + '...', 
      ttlMs, 
      expiresAt: new Date(expiresAtMs).toISOString(),
      totalEntries: blacklist.size 
    },
    'Token added to in-memory blacklist'
  );
}

/**
 * Check if a token is currently blacklisted.
 * Expired entries are treated as not blacklisted (the token is naturally
 * expired anyway, so the JWT verification step will reject it first).
 * @param {string} token
 * @returns {boolean}
 */
function has(token) {
  const expiresAtMs = blacklist.get(token);

  if (expiresAtMs === undefined) {
    return false;
  }

  if (Date.now() > expiresAtMs) {
    blacklist.delete(token); // Lazy cleanup on read
    totalEntriesCleaned++;
    return false;
  }

  return true;
}

/**
 * ✅ NEW: Remove a specific token from the blacklist
 * @param {string} token
 * @returns {boolean} - True if token was removed
 */
function remove(token) {
  const deleted = blacklist.delete(token);
  if (deleted) {
    logger.debug(
      { token: token.substring(0, 10) + '...' },
      'Token manually removed from blacklist'
    );
  }
  return deleted;
}

/**
 * ✅ NEW: Get the size of the blacklist
 * @returns {number} - Number of entries in the blacklist
 */
function size() {
  return blacklist.size;
}

/**
 * ✅ NEW: Clear all entries from the blacklist (for testing)
 */
function clear() {
  const count = blacklist.size;
  blacklist.clear();
  logger.debug({ count }, 'Blacklist cleared');
  return count;
}

/**
 * ✅ NEW: Get blacklist statistics
 * @returns {Object} - Statistics about the blacklist
 */
function getStats() {
  return {
    size: blacklist.size,
    totalEntriesAdded,
    totalEntriesCleaned,
    activeEntries: blacklist.size,
    cleanupIntervalMs: CLEANUP_INTERVAL_MS,
  };
}

/**
 * Remove all expired entries from the Map.
 * Called automatically every CLEANUP_INTERVAL_MS.
 */
function cleanup() {
  const now = Date.now();
  let cleaned = 0;

  for (const [token, expiresAtMs] of blacklist.entries()) {
    if (now > expiresAtMs) {
      blacklist.delete(token);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    totalEntriesCleaned += cleaned;
    logger.debug(
      { 
        cleaned, 
        remaining: blacklist.size,
        totalCleaned: totalEntriesCleaned 
      },
      'Blacklist cleanup completed'
    );
  }
}

// Start the periodic cleanup timer.
// unref() prevents this timer from keeping the Node.js process alive
// when all other async work is done (important for test environments).
const cleanupTimer = setInterval(cleanup, CLEANUP_INTERVAL_MS);

if (typeof cleanupTimer.unref === 'function') {
  cleanupTimer.unref();
}

/**
 * Stop the cleanup timer.
 * Used in tests to prevent open handle warnings.
 */
function destroy() {
  clearInterval(cleanupTimer);
  logger.info('Blacklist cleanup timer destroyed');
}

// ✅ Graceful shutdown handler
process.on('SIGTERM', () => {
  logger.info('Cleaning up blacklist before shutdown...');
  destroy();
});

process.on('SIGINT', () => {
  logger.info('Cleaning up blacklist before shutdown...');
  destroy();
});

module.exports = {
  add,
  has,
  remove,      // ✅ NEW
  size,        // ✅ NEW
  clear,       // ✅ NEW
  getStats,    // ✅ NEW
  cleanup,     // Exported for manual cleanup if needed
  destroy,
};