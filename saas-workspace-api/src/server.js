'use strict';

/**
 * src/server.js
 *
 * HTTP server entry point.
 * - Connects to Redis (if enabled)
 * - Starts the Express app
 * - Handles graceful shutdown on SIGTERM / SIGINT
 */

const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const redis = require('./config/redis');
const prisma = require('./config/database');

let server;

async function start() {
  try {
    // Connect to Redis (no-op if disabled)
    await redis.connect();

    // Verify DB connectivity
    await prisma.$connect();
    logger.info('Database connected');

    server = app.listen(config.server.port, () => {
      logger.info(
        {
          port: config.server.port,
          env: config.env,
          docs: `http://localhost:${config.server.port}/api-docs`,
        },
        ` Server started`
      );
    });
  } catch (err) {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  }
}

// ── Graceful Shutdown ─────────────────────────────────────────

async function shutdown(signal) {
  logger.info({ signal }, 'Shutdown signal received');

  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed');
      try {
        await prisma.$disconnect();
        await redis.disconnect();
        logger.info('All connections closed. Exiting.');
        process.exit(0);
      } catch (cleanupErr) {
        logger.error({ err: cleanupErr }, 'Error during database disconnection');
        process.exit(1);
      }
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      logger.error('Forced exit after timeout');
      process.exit(1);
    }, 10_000);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Catch unhandled promise rejections (shouldn't happen but good to have)
process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled promise rejection');
  process.exit(1);
});

start();
