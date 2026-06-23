'use strict';

/**
 * src/config/swagger.js
 *
 * OpenAPI 3.0 specification using swagger-jsdoc.
 * JSDoc annotations in route files are picked up automatically.
 */

const swaggerJsdoc = require('swagger-jsdoc');
const config = require('./index');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SaaS Team Workspace API',
      version: '1.0.0',
      description: `
## Overview
Production-style SaaS Team Workspace API demonstrating Authentication,
RBAC, and multi-tenant organization management.

## Authentication
This API uses **JWT Bearer tokens**. Obtain a token via \`POST /auth/login\`
or \`POST /auth/signup\`, then pass it in the \`Authorization\` header:

\`\`\`
Authorization: Bearer <your_access_token>
\`\`\`

## RBAC Roles
| Role   | Permissions                          |
|--------|--------------------------------------|
| OWNER  | Full control over organization       |
| ADMIN  | Manage members and projects          |
| MEMBER | Read-only access to projects         |
      `,
      contact: {
        name: 'API Support',
        email: 'support@example.com',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.server.port}/api/${config.server.apiVersion}`,
        description: 'Local development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT access token obtained from /auth/login',
        },
      },
      schemas: {
        // Reusable error schema
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                message: { type: 'string' },
                code: { type: 'string' },
                details: { type: 'array', items: { type: 'object' } },
              },
            },
          },
        },
        // Reusable user schema
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            avatarUrl: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Organization: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            slug: { type: 'string' },
            description: { type: 'string', nullable: true },
            ownerId: { type: 'string', format: 'uuid' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Project: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string', nullable: true },
            status: { type: 'string', enum: ['ACTIVE', 'ARCHIVED', 'COMPLETED'] },
            isPublic: { type: 'boolean' },
            organizationId: { type: 'string', format: 'uuid' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    tags: [
      { name: 'Health', description: 'Service health and status' },
      { name: 'Auth', description: 'Authentication and user identity' },
      { name: 'Organizations', description: 'Organization CRUD and management' },
      { name: 'Members', description: 'Organization member management' },
      { name: 'Invitations', description: 'User invitation flow' },
      { name: 'Projects', description: 'Project management with RBAC' },
    ],
    // Defined here (rather than via @openapi JSDoc) because /health lives
    // outside the /api/{version} prefix assumed by the `servers` entry
    // above, so it needs its own per-operation server override.
    paths: {
      '/health': {
        get: {
          tags: ['Health'],
          summary: 'Check API health status',
          description: 'Returns the service status. Does not require authentication.',
          security: [],
          servers: [
            {
              url: `http://localhost:${config.server.port}`,
              description: 'Root (unversioned) server',
            },
          ],
          responses: {
            200: {
              description: 'Service is healthy',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'ok' },
                      timestamp: { type: 'string', format: 'date-time' },
                      version: { type: 'string', example: 'v1' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  // Glob for route files that contain @openapi JSDoc comments
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
