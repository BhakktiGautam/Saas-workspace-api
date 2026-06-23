'use strict';

/**
 * src/app.js
 *
 * Express application factory. Separated from server.js so that the
 * app can be imported in tests without starting the HTTP server.
 *
 * Middleware order matters in Express:
 *   1. Security headers (helmet)
 *   2. CORS
 *   3. Compression
 *   4. Request parsing
 *   5. Request logging (pino-http)
 *   6. Rate limiting
 *   7. Routes
 *   8. 404 handler
 *   9. Global error handler (must be last)
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const pinoHttp = require('pino-http');
const swaggerUi = require('swagger-ui-express');

const config = require('./config');
const logger = require('./utils/logger');
const swaggerSpec = require('./config/swagger');
const { apiLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');

// Routes
const authRoutes = require('./routes/auth.routes');
const orgRoutes = require('./routes/organization.routes');
const projectRoutes = require('./routes/project.routes');
const invitationRoutes = require('./routes/invitation.routes');

const app = express();

// ── Security Headers ──────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────
app.use(
  cors({
    origin: config.cors.origins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ── Compression ───────────────────────────────────────────────
app.use(compression());

// ── Body Parsing ──────────────────────────────────────────────
// Limit JSON parsing to 1mb globally to reduce the risk of large payload
// DoS and deep parsing attacks for normal API requests.
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── HTTP Request Logging ──────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    // Skip logging health checks to reduce noise
    autoLogging: { ignore: (req) => req.url === '/health' },
    customLogLevel: (_req, res) => {
      if (res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
  })
);

// ── Rate Limiting ─────────────────────────────────────────────
app.use(`/api/${config.server.apiVersion}`, apiLimiter);

// ── Health Check ──────────────────────────────────────────────
// Documented in src/config/swagger.js (not via JSDoc here) because this
// route lives outside the /api/{version} prefix that the Swagger servers
// entry assumes, and needs its own per-operation `servers` override.
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: config.server.apiVersion });
});

// ── API Documentation ─────────────────────────────────────────
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'SaaS Workspace API Docs',
    swaggerOptions: { persistAuthorization: true },
  })
);

// Raw OpenAPI spec endpoint (useful for code generators)
app.get('/api-docs.json', (_req, res) => res.json(swaggerSpec));

// ── API Routes ────────────────────────────────────────────────
const apiRouter = express.Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/organizations', orgRoutes);
apiRouter.use('/organizations', projectRoutes); // nested: /organizations/:orgId/projects
apiRouter.use('/invitations', invitationRoutes);

app.use(`/api/${config.server.apiVersion}`, apiRouter);

// ── 404 Handler ───────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: { message: 'Route not found', code: 'NOT_FOUND' },
  });
});

// ── Global Error Handler (MUST be last) ───────────────────────
app.use(errorHandler);

module.exports = app;
