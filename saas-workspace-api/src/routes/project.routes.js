'use strict';

/**
 * src/routes/project.routes.js
 *
 * All project routes are nested under /organizations/:orgId/projects
 * so that org context and RBAC are always enforced at the route level.
 *
 * RBAC enforcement:
 *   OWNER / ADMIN → full CRUD
 *   MEMBER        → GET only (list + detail)
 */

const express = require('express');
const router = express.Router({ mergeParams: true }); // mergeParams for :orgId

const projectController = require('../controllers/project.controller');
const authenticate = require('../middleware/authenticate');
const { requireOrgMembership, requireRole } = require('../middleware/rbac');
const validate = require('../middleware/validate');
const {
  createProjectSchema,
  updateProjectSchema,
  paginationSchema,
} = require('../validators/schemas');

// All project routes require auth + org membership
router.use(authenticate, requireOrgMembership);

/**
 * @openapi
 * /organizations/{orgId}/projects:
 *   post:
 *     tags: [Projects]
 *     summary: Create a project (OWNER or ADMIN)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:        { type: string, example: "Website Redesign" }
 *               description: { type: string }
 *               isPublic:    { type: boolean, default: false }
 *     responses:
 *       201:
 *         description: Project created
 *       403:
 *         description: Members cannot create projects
 */
router.post(
  '/',
  requireRole('OWNER', 'ADMIN'),
  validate(createProjectSchema),
  projectController.createProject
);

/**
 * @openapi
 * /organizations/{orgId}/projects:
 *   get:
 *     tags: [Projects]
 *     summary: List projects in an organization (all roles)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *         description: One-based page number.
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *         description: Maximum projects returned per page.
 *     responses:
 *       200:
 *         description: Paginated list of projects
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items: { type: object }
 *                 meta:
 *                   type: object
 *                   properties:
 *                     page: { type: integer, example: 1 }
 *                     limit: { type: integer, example: 10 }
 *                     total: { type: integer, example: 50 }
 *                     totalPages: { type: integer, example: 5 }
 *       422:
 *         description: Invalid pagination query parameters
 */
router.get('/', validate(paginationSchema, 'query'), projectController.listProjects);

/**
 * @openapi
 * /organizations/{orgId}/projects/{projectId}:
 *   get:
 *     tags: [Projects]
 *     summary: Get a single project (all roles)
 *     security:
 *       - bearerAuth: []
 */
router.get('/:projectId', projectController.getProject);

/**
 * @openapi
 * /organizations/{orgId}/projects/{projectId}:
 *   patch:
 *     tags: [Projects]
 *     summary: Update a project (OWNER or ADMIN)
 *     security:
 *       - bearerAuth: []
 */
router.patch(
  '/:projectId',
  requireRole('OWNER', 'ADMIN'),
  validate(updateProjectSchema),
  projectController.updateProject
);

/**
 * @openapi
 * /organizations/{orgId}/projects/{projectId}:
 *   delete:
 *     tags: [Projects]
 *     summary: Delete a project (OWNER or ADMIN)
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:projectId', requireRole('OWNER', 'ADMIN'), projectController.deleteProject);

module.exports = router;
