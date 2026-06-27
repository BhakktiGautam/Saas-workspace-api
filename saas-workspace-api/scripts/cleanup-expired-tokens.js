#!/usr/bin/env node

/**
 * scripts/cleanup-expired-tokens.js
 *
 * Cleanup script for expired refresh tokens.
 * Can be run manually or as a cron job to keep the database clean.
 *
 * Usage:
 *   npm run token:cleanup              # Normal cleanup
 *   npm run token:cleanup:dry          # Dry run (preview only)
 *
 * Cron example (runs daily at 2 AM):
 *   0 2 * * * cd /path/to/project && npm run token:cleanup >> logs/cleanup.log 2>&1
 */

const { PrismaClient } = require('@prisma/client');
const logger = require('../src/utils/logger');

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run') || args.includes('-d');

const prisma = new PrismaClient();

/**
 * Cleanup expired tokens
 */
async function cleanupExpiredTokens() {
  try {
    logger.info('🧹 Starting token cleanup...');
    
    const now = new Date();

    // ✅ 1. Count expired tokens before deletion
    const expiredCount = await prisma.refreshToken.count({
      where: {
        expiresAt: {
          lt: now,
        },
      },
    });

    logger.info(`📊 Found ${expiredCount} expired tokens`);

    if (expiredCount === 0) {
      logger.info('✨ No expired tokens to clean up');
      return;
    }

    // ✅ 2. If dry run, show preview and exit
    if (isDryRun) {
      logger.info('🔍 DRY RUN - Would delete expired tokens:');
      
      const expiredTokens = await prisma.refreshToken.findMany({
        where: {
          expiresAt: {
            lt: now,
          },
        },
        take: 10, // Show first 10 for preview
        select: {
          id: true,
          userId: true,
          expiresAt: true,
          revokedAt: true,
          createdAt: true,
        },
        orderBy: {
          expiresAt: 'asc',
        },
      });

      console.table(expiredTokens);
      logger.info(`📊 Total expired tokens: ${expiredCount}`);
      logger.info('✅ DRY RUN completed - No changes made');
      return;
    }

    // ✅ 3. Delete expired tokens (only if they're already revoked)
    const result = await prisma.refreshToken.deleteMany({
      where: {
        expiresAt: {
          lt: now,
        },
        // ✅ Only delete tokens that are already revoked
        // This keeps revoked tokens for audit purposes
        revokedAt: {
          not: null,
        },
      },
    });

    logger.info(`🗑️ Deleted ${result.count} expired and revoked tokens`);

    // ✅ 4. Log summary
    const remainingExpired = await prisma.refreshToken.count({
      where: {
        expiresAt: {
          lt: now,
        },
        revokedAt: null, // Still valid but expired
      },
    });

    if (remainingExpired > 0) {
      logger.warn(
        `⚠️ ${remainingExpired} expired but valid tokens still exist ` +
        `(they will be cleaned up when revoked)`
      );
    }

    logger.info('✅ Token cleanup completed successfully');
    return result.count;

  } catch (error) {
    logger.error('❌ Error during token cleanup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Main execution
 */
if (require.main === module) {
  cleanupExpiredTokens()
    .then((count) => {
      if (!isDryRun) {
        console.log(`✅ Successfully cleaned up ${count || 0} expired tokens`);
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Cleanup failed:', error.message);
      process.exit(1);
    });
}

module.exports = { cleanupExpiredTokens };