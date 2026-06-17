/**
 * inMemoryBlacklist.js
 *
 * A lightweight in-process token blacklist used when REDIS_ENABLED=false.
 *
 * How it works:
 *   - Stores { jti -> expiresAtMs } in a plain Map.
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

const blacklist = new Map(); // Map<jti: string, expiresAtMs: number>

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Run cleanup every 5 minutes

/**
 * Add a JTI (JWT ID) to the blacklist.
 * @param {string} jti   - The JWT's jti claim (unique token identifier)
 * @param {number} ttlMs - Time-to-live in milliseconds (remaining token lifetime)
 */
function add(jti, ttlMs) {
  const expiresAtMs = Date.now() + ttlMs;
  blacklist.set(jti, expiresAtMs);
}

/**
 * Check if a JTI is currently blacklisted.
 * Expired entries are treated as not blacklisted (the token is naturally
 * expired anyway, so the JWT verification step will reject it first).
 * @param {string} jti
 * @returns {boolean}
 */
function has(jti) {
  const expiresAtMs = blacklist.get(jti);

  if (expiresAtMs === undefined) {
    return false;
  }

  if (Date.now() > expiresAtMs) {
    blacklist.delete(jti); // Lazy cleanup on read
    return false;
  }

  return true;
}

/**
 * Remove all expired entries from the Map.
 * Called automatically every CLEANUP_INTERVAL_MS.
 */
function cleanup() {
  const now = Date.now();

  for (const [jti, expiresAtMs] of blacklist.entries()) {
    if (now > expiresAtMs) {
      blacklist.delete(jti);
    }
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
}

module.exports = {
  add,
  has,
  destroy,
};