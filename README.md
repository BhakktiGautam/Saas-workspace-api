# SaaS Team Workspace API

A production-style backend demonstrating **Authentication**, **JWT token management**, and **Role-Based Access Control (RBAC)**  patterns used in real team collaboration platforms like Notion, Linear, and Vercel.

Built with Node.js, Express, PostgreSQL, Prisma, Redis, and documented with Swagger/OpenAPI.

---
##  Contributing

Contributions are welcome! Whether you're fixing a bug, adding a feature, or improving the docs, we'd love your help.

Please read our [CONTRIBUTING.md](./CONTRIBUTING.md) to get started.

This project is part of **GirlScript Summer of Code (GSSoC)** 

---
## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Folder Structure](#3-folder-structure)
4. [Quick Start](#4-quick-start)
5. [Environment Variables](#5-environment-variables)
6. [Database Schema](#6-database-schema)
7. [RBAC System](#7-rbac-system)
8. [API Reference](#8-api-reference)
9. [Example Requests](#9-example-requests)
10. [Docker Setup](#10-docker-setup)
11. [Design Decisions](#11-design-decisions)
12. [Contributors](#12-contributors)


---

## 1. Project Overview

This API models the backend of a **multi-tenant SaaS workspace tool**. Users can:

- Create accounts and authenticate with JWT
- Create and manage **organizations** (tenants)
- Invite colleagues via email
- Be assigned one of three roles: **Owner, Admin, or Member**
- Create and manage **projects** inside organizations, with permissions enforced per role

The codebase is intentionally structured as a learning reference: every non-trivial decision has an inline comment explaining *why*, not just *what*.

---

## 2. Architecture

### Request Lifecycle

```
Client
  │
  │  HTTP Request + Bearer Token
  ▼
Express App (app.js)
  │
  ├── Helmet  (security headers)
  ├── CORS
  ├── Rate Limiter
  ├── pino-http (request logging)
  │
  ▼
Routes (auth / organizations / projects / invitations)
  │
  ├── validate()         ← Joi schema validation, rejects malformed input early
  ├── authenticate()     ← Verifies JWT, checks Redis blacklist, loads req.user
  ├── requireOrgMembership() ← Loads membership from DB, populates req.membership
  ├── requireRole()      ← Gates route to specific roles
  │
  ▼
Controller (thin HTTP layer)
  │
  ▼
Service (all business logic lives here)
  │
  ▼
Prisma ORM
  │
  ▼
PostgreSQL
```

### Why JWT?

JWT (JSON Web Token) is stateless — the server can verify a token without a database lookup on every request. The payload includes the user's ID and basic profile, so protected routes don't need an extra `SELECT users` round-trip.

**Trade-off**: Tokens cannot be immediately invalidated before expiry. We mitigate this with:
- **Short-lived access tokens** (15 minutes): limits the damage window if a token is stolen
- **Redis blacklist**: on logout, the access token's JTI (or the token itself) is stored in Redis with a TTL matching the token's remaining lifetime. The `authenticate` middleware checks this blacklist on every request.
- **Refresh token rotation**: when a refresh token is used, it's immediately revoked and a new one is issued. Replay attacks using a stolen refresh token are detected because the old token no longer exists.

### How RBAC Is Enforced

Roles are **per-organization** (stored in `organization_members.role`), not global. This means a user can be ADMIN in one organization and MEMBER in another.

The enforcement chain for a sensitive route like "delete a project":

```
DELETE /api/v1/organizations/:orgId/projects/:projectId

1. authenticate()
   → Verifies JWT, loads req.user from DB

2. requireOrgMembership()
   → Queries organization_members WHERE org_id = :orgId AND user_id = req.user.id
   → Attaches the membership to req.membership
   → 403 if not a member

3. requireRole('OWNER', 'ADMIN')
   → Checks req.membership.role is in the allowed list
   → 403 if MEMBER

4. projectController.deleteProject()
   → Delegates to projectService.deleteProject()
   → Additional fine-grained checks in service layer if needed
```

This layered approach means RBAC is enforced at the **route level** (cannot even reach the controller) AND can be double-checked in the service layer for nuanced cases (e.g., "Admins can't remove other Admins").

---

## 3. Folder Structure

```
saas-workspace-api/
│
├── prisma/
│   ├── schema.prisma        # Database schema and relations
│   ├── seed.js              # Demo data seeder
│   └── migrations/          # Auto-generated SQL migrations
│
├── src/
│   ├── server.js            # Entry point — starts HTTP server, handles graceful shutdown
│   ├── app.js               # Express app factory — middleware stack + route mounting
│   │
│   ├── config/
│   │   ├── index.js         # Reads + validates all env vars
│   │   ├── database.js      # Prisma singleton
│   │   ├── redis.js         # Redis client (optional)
│   │   └── swagger.js       # OpenAPI spec definition
│   │
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── organization.routes.js
│   │   ├── project.routes.js
│   │   └── invitation.routes.js
│   │
│   ├── controllers/         # HTTP layer — parse req, call service, format res
│   │   ├── auth.controller.js
│   │   ├── organization.controller.js
│   │   └── project.controller.js
│   │
│   ├── services/            # Business logic — all DB interaction lives here
│   │   ├── auth.service.js
│   │   ├── organization.service.js
│   │   └── project.service.js
│   │
│   ├── middleware/
│   │   ├── authenticate.js  # JWT verification + Redis blacklist check
│   │   ├── rbac.js          # requireOrgMembership + requireRole factory
│   │   ├── validate.js      # Joi schema validation middleware factory
│   │   ├── rateLimiter.js   # General + auth-specific rate limits
│   │   └── errorHandler.js  # Global error handler (must be last middleware)
│   │
│   ├── validators/
│   │   └── schemas.js       # All Joi schemas in one place
│   │
│   └── utils/
│       ├── logger.js        # Pino structured logger singleton
│       ├── jwt.js           # Sign / verify JWT helpers
│       ├── errors.js        # AppError class hierarchy
│       ├── response.js      # Standardised success response helpers
│       └── slug.js          # URL slug generator
│
├── Dockerfile
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
├── package.json
└── README.md
```

**Separation of concerns** — why this structure matters:

| Layer | Responsibility | What it does NOT do |
|---|---|---|
| Route | Wire URL → middleware chain → controller | Business logic |
| Controller | Parse HTTP request, call service, format HTTP response | DB queries |
| Service | Business logic, transactions, domain rules | Know about HTTP (req/res) |
| Middleware | Cross-cutting concerns (auth, validation, logging) | Business logic |

---

## 4. Quick Start

### Prerequisites

- Node.js 18+
- Docker and Docker Compose

### Option A — Docker (recommended)

```bash
# 1. Clone and enter the project
git clone <repo-url>
cd saas-workspace-api

# 2. Copy and configure environment
cp .env.example .env
# Edit .env — at minimum set strong JWT secrets:
#   JWT_ACCESS_SECRET=<random 64-char string>
#   JWT_REFRESH_SECRET=<different random 64-char string>

# 3. Start all services (API + PostgreSQL + Redis)
docker compose up -d

# 4. Run database migrations
docker compose exec api npx prisma migrate deploy

# 5. (Optional) Seed with demo data
docker compose exec api node prisma/seed.js

# API is now live at http://localhost:3000
# Swagger docs at  http://localhost:3000/api-docs
```

### Option B — Local development

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env
# Edit .env with your local PostgreSQL and Redis credentials

# 3. Generate Prisma client
npm run db:generate

# 4. Run migrations
npm run db:migrate

# 5. (Optional) Seed demo data
npm run db:seed

# 6. Start with hot-reload
npm run dev
```

---

## 5. Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | ✅ | — | Secret for signing access tokens. Use a long random string. |
| `JWT_REFRESH_SECRET` | ✅ | — | Secret for signing refresh tokens. Must differ from access secret. |
| `JWT_ACCESS_EXPIRES_IN` | | `15m` | Access token lifetime |
| `JWT_REFRESH_EXPIRES_IN` | | `7d` | Refresh token lifetime |
| `BCRYPT_ROUNDS` | | `12` | bcrypt work factor. Higher = slower hashing. 12 is safe for 2024. |
| `REDIS_URL` | | `redis://localhost:6379` | Redis connection string |
| `REDIS_ENABLED` | | `false` | Set `true` to enable token blacklisting |
| `RATE_LIMIT_WINDOW_MS` | | `900000` | Rate limit window (ms). Default: 15 minutes. |
| `RATE_LIMIT_MAX_REQUESTS` | | `100` | Max requests per window (general) |
| `AUTH_RATE_LIMIT_MAX` | | `10` | Max requests per window (auth routes) |
| `CORS_ORIGINS` | | `http://localhost:3000` | Comma-separated list of allowed CORS origins |
| `INVITATION_EXPIRES_IN_DAYS` | | `7` | Days before an invitation link expires |
| `LOG_LEVEL` | | `info` | Pino log level: `trace`, `debug`, `info`, `warn`, `error`, `fatal` |
| `LOG_PRETTY` | | `true` | Human-readable logs in dev (`false` in production for JSON output) |
| `PORT` | | `3000` | HTTP server port |

---

## 6. Database Schema

### Entity Relationship Diagram

```
┌─────────────┐         ┌──────────────────────┐         ┌──────────────────┐
│    users    │         │  organization_members │         │  organizations   │
├─────────────┤    1:N  ├──────────────────────┤  N:1    ├──────────────────┤
│ id (PK)     │◄────────│ id (PK)              │────────►│ id (PK)          │
│ email       │         │ organization_id (FK) │         │ name             │
│  password_hash  │
│ first_name  │         │ role (ENUM)          │         │ description      │
│ last_name   │         │ joined_at            │         │ owner_id (FK)    │
│ is_active   │         └──────────────────────┘         │ is_active        │
│ created_at  │                                          └──────────────────┘
└─────────────┘                                                   │ 1:N
      │ 1:N                                                       ▼
      │                                              ┌──────────────────────┐
      ▼                                              │       projects       │
┌─────────────────┐                                 ├──────────────────────┤
│ refresh_tokens  │                                 │ id (PK)              │
├─────────────────┤                                 │ organization_id (FK) │
│ id (PK)         │                                 │ created_by_user_id   │
│ token (UNIQUE)  │                                 │ name                 │
│ user_id (FK)    │                                 │ description          │
│ expires_at      │                                 │ status (ENUM)        │
│ revoked_at      │                                 │ is_public            │
└─────────────────┘                                 └──────────────────────┘

┌──────────────────────────────┐
│         invitations          │
├──────────────────────────────┤
│ id (PK)                      │
│ organization_id (FK)         │
│ invited_by_user_id (FK)      │
│ invited_user_id (FK, null)   │
│ email                        │
│ role (ENUM)                  │
│ token (UNIQUE UUID)          │
│ status (ENUM)                │
│ expires_at                   │
└──────────────────────────────┘
```

### Schema Notes

- **`organization_members`** has a composite unique constraint `(organization_id, user_id)` — a user can only have one role per org.
- **`invitations.invited_user_id`** is nullable because the invited user may not have an account yet. It's populated when the invitation is accepted.
- **`organizations.is_active`** uses soft-delete so data isn't immediately destroyed and audit trails are preserved.
- **`refresh_tokens.revoked_at`** enables token rotation — when a refresh token is used, its `revoked_at` is set and a new one is issued.
- All primary keys are UUIDs, not sequential integers, to prevent enumeration attacks.

---

## 7. RBAC System

### Roles

| Role | Description | Who assigns it |
|---|---|---|
| **OWNER** | Full control. Can delete the org, manage all members. | Set automatically on org creation. Cannot be changed via API (ownership transfer not in scope). |
| **ADMIN** | Can invite/remove members (except other admins), create/update/delete projects. Cannot promote to OWNER. | OWNER |
| **MEMBER** | Read-only access to projects. Cannot modify anything. | OWNER or ADMIN |

### Permissions Matrix

| Action | OWNER | ADMIN | MEMBER |
|---|---|---|---|
| View organization | ✅ | ✅ | ✅ |
| Update organization | ✅ | ✅ | ❌ |
| Delete organization | ✅ | ❌ | ❌ |
| List members | ✅ | ✅ | ✅ |
| Invite member | ✅ | ✅ | ❌ |
| Remove member | ✅ | ✅* | ❌ |
| Change member role | ✅ | ✅* | ❌ |
| Create project | ✅ | ✅ | ❌ |
| View projects | ✅ | ✅ | ✅ |
| Update project | ✅ | ✅ | ❌ |
| Delete project | ✅ | ✅ | ❌ |

*ADMINs cannot remove or change the role of other ADMINs or OWNERs.

### Middleware Implementation

```javascript
// Route definition showing the full middleware chain:
router.delete(
  '/:orgId/members/:userId',
  authenticate,            // Step 1: Who are you?
  requireOrgMembership,    // Step 2: Are you in this org?
  requireRole('OWNER', 'ADMIN'), // Step 3: Do you have permission?
  orgController.removeMember     // Step 4: Execute
);
```

`requireRole` is a **factory function** — it returns a configured middleware closure. This is more flexible than hard-coding roles inside middleware.

---

## 8. API Reference

Interactive docs are available at **`http://localhost:3000/api-docs`** when the server is running.

### Base URL
```
http://localhost:3000/api/v1
```

### Authentication Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/signup` | ❌ | Register new user |
| POST | `/auth/login` | ❌ | Login, receive token pair |
| POST | `/auth/refresh` | ❌ | Refresh access token |
| POST | `/auth/logout` | ✅ | Revoke tokens |
| GET | `/auth/me` | ✅ | Get current user profile |

### Organization Endpoints

| Method | Path | Role Required | Description |
|---|---|---|---|
| POST | `/organizations` | (any authenticated) | Create organization |
| GET | `/organizations` | (any authenticated) | List my organizations |
| GET | `/organizations/:orgId` | MEMBER+ | Get org details |
| PATCH | `/organizations/:orgId` | ADMIN+ | Update org |
| DELETE | `/organizations/:orgId` | OWNER | Delete org |

### Member Endpoints

| Method | Path | Role Required | Description |
|---|---|---|---|
| GET | `/organizations/:orgId/members` | MEMBER+ | List members |
| PATCH | `/organizations/:orgId/members/:userId/role` | ADMIN+ | Change role |
| DELETE | `/organizations/:orgId/members/:userId` | ADMIN+ | Remove member |

### Invitation Endpoints

| Method | Path | Role Required | Description |
|---|---|---|---|
| POST | `/organizations/:orgId/invitations` | ADMIN+ | Invite user |
| POST | `/invitations/:token/accept` | (authenticated) | Accept invitation |

### Project Endpoints

| Method | Path | Role Required | Description |
|---|---|---|---|
| POST | `/organizations/:orgId/projects` | ADMIN+ | Create project |
| GET | `/organizations/:orgId/projects` | MEMBER+ | List projects |
| GET | `/organizations/:orgId/projects/:projectId` | MEMBER+ | Get project |
| PATCH | `/organizations/:orgId/projects/:projectId` | ADMIN+ | Update project |
| DELETE | `/organizations/:orgId/projects/:projectId` | ADMIN+ | Delete project |

### Standard Response Envelope

**Success:**
```json
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "limit": 20, "total": 45, "totalPages": 3 }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "message": "Human-readable message",
    "code": "MACHINE_READABLE_CODE",
    "details": [{ "field": "email", "message": "must be a valid email" }]
  }
}
```

---

## 9. Example Requests

### Signup
```bash
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jane",
    "lastName": "Doe",
    "email": "jane@example.com",
    "password": "SecurePass1"
  }'
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "a1b2c3d4-...",
      "email": "jane@example.com",
      "firstName": "Jane",
      "lastName": "Doe"
    },
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci..."
  }
}
```

### Login
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{ "email": "jane@example.com", "password": "SecurePass1" }'
```

### Create Organization
```bash
curl -X POST http://localhost:3000/api/v1/organizations \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Acme Corp", "description": "Building the future" }'
```

### Invite a User (ADMIN or OWNER only)
```bash
curl -X POST http://localhost:3000/api/v1/organizations/<orgId>/invitations \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{ "email": "bob@example.com", "role": "ADMIN" }'
```

### Accept Invitation
```bash
# The invitee logs in first, then accepts with their token
curl -X POST http://localhost:3000/api/v1/invitations/<token>/accept \
  -H "Authorization: Bearer <invitees_access_token>"
```

### Create a Project (ADMIN or OWNER only)
```bash
curl -X POST http://localhost:3000/api/v1/organizations/<orgId>/projects \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{ "name": "Website Redesign", "description": "Q2 initiative" }'
```

### Refresh Tokens
```bash
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{ "refreshToken": "<refresh_token>" }'
```

### 403 Example (MEMBER trying to create a project)
```bash
curl -X POST http://localhost:3000/api/v1/organizations/<orgId>/projects \
  -H "Authorization: Bearer <member_access_token>" \
  -d '{ "name": "Sneaky Project" }'
```
```json
{
  "success": false,
  "error": {
    "message": "This action requires one of the following roles: OWNER, ADMIN",
    "code": "FORBIDDEN"
  }
}
```

---

## 10. Docker Setup

### Production
```bash
# Build and start all services
docker compose up -d --build

# View logs
docker compose logs -f api

# Stop
docker compose down
```

### Development (with hot-reload)
```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

### Useful Commands
```bash
# Run migrations inside container
docker compose exec api npx prisma migrate deploy

# Open Prisma Studio
docker compose exec api npx prisma studio

# Seed the database
docker compose exec api node prisma/seed.js

# Open a shell
docker compose exec api sh

# Reset everything (⚠️ destroys data)
docker compose down -v
```

---

## 11. Design Decisions

### Why Prisma over raw SQL or Sequelize?

Prisma provides a type-safe query builder that catches mistakes at the IDE level rather than at runtime. The schema-first approach (`schema.prisma`) also serves as living documentation of the data model. Sequelize was considered but its verbose model definitions and weaker TypeScript support make it less suitable for a codebase intended as a learning reference.

### Why UUIDs instead of auto-increment IDs?

Sequential integer IDs are predictable — an attacker can enumerate `GET /organizations/1`, `/organizations/2`, etc. UUIDs (v4) are random 128-bit values, making enumeration impractical. They also allow IDs to be generated on the client without a round-trip to the database.

### Why soft-delete for organizations?

Hard deletion is irreversible and cascades through all related data (members, projects, invitations). Soft-delete (`is_active: false`) preserves the audit trail and allows accidental deletions to be reversed by an admin. A background job can permanently purge soft-deleted records after a retention period.

### Why pino over Winston?

Pino is significantly faster than Winston and produces JSON output by default — the right format for log aggregators in production. Winston requires extra configuration to achieve the same output quality. Pino's `pino-pretty` transport provides human-readable output in development.

### Why rate limiting on auth routes specifically?

Brute-force and credential-stuffing attacks target login endpoints. The general rate limiter (100 req/15min) is permissive enough for normal API usage. The auth-specific limiter (10 req/15min) significantly slows down automated attacks while being invisible to legitimate users who log in once.

---


## Seed Credentials

After running `npm run db:seed`:

| Role | Email | Password |
|---|---|---|
| OWNER | alice@example.com | Password1 |
| ADMIN | bob@example.com | Password1 |
| MEMBER | carol@example.com | Password1 |

---
## Built for Learning:
>  This codebase is intentionally written as a learning resource.
> Every non-trivial decision has an inline comment explaining **why**, not just **what**.
> Great for developers learning JWT auth, RBAC, and production backend patterns.

---

## 12. Contributors

Thanks to all contributors ❤️

[![Contributors](https://contrib.rocks/image?repo=riya-kaurav/Saas-workspace-api)](https://github.com/riya-kaurav/Saas-workspace-api/graphs/contributors)