#   Architecture

## Overview

SaaS Workspace API is a production-ready backend built using modern SaaS architecture patterns.

### Features

*   JWT Authentication & Authorization
*   Refresh Token Rotation
*   Redis Caching & Token Blacklisting
*   Role-Based Access Control (RBAC)
*   Multi-Tenant Organization Management
*   Service Layer Architecture
*   PostgreSQL with Prisma ORM

### Architecture Flow

```text
Client → Routes → Middleware → Controllers → Services → Prisma → PostgreSQL
```

The application follows a layered architecture that promotes scalability, maintainability, and separation of concerns.

---

# High-Level System Architecture

```mermaid
flowchart TB

    %% ===== Client Layer =====
    Client["Client Application"]

    %% ===== Backend =====
    subgraph Backend["Express Backend"]
        direction TB

        Express["Express Server"]

        subgraph API["API Layer"]
            direction LR
            Middleware["Middleware"]
            Routes["Routes"]
            Controllers["Controllers"]
        end

        subgraph Business["Business Logic"]
            Services["Services"]
        end

        subgraph Data["Data Layer"]
            direction LR
            Prisma["Prisma ORM"]
            PostgreSQL[("PostgreSQL")]
            Redis[("Redis Cache")]
        end
    end

    %% ===== Request Flow =====
    Client ==> Express
    Express ==> Middleware
    Middleware ==> Routes
    Routes ==> Controllers
    Controllers ==> Services
    Services ==> Prisma
    Prisma ==> PostgreSQL

    %% ===== Cache Flow =====
    Middleware -. Read / Write Cache .-> Redis
    Services -. Optional Cache Access .-> Redis

    %% ===== Styling =====
    classDef client fill:#2563eb,color:#ffffff,stroke:#1d4ed8,stroke-width:3px;
    classDef server fill:#0f172a,color:#ffffff,stroke:#38bdf8,stroke-width:2px;
    classDef logic fill:#14532d,color:#ffffff,stroke:#4ade80,stroke-width:2px;
    classDef database fill:#581c87,color:#ffffff,stroke:#c084fc,stroke-width:2px;
    classDef cache fill:#9a3412,color:#ffffff,stroke:#fb923c,stroke-width:2px;

    class Client client;
    class Express,Middleware,Routes,Controllers server;
    class Services logic;
    class Prisma,PostgreSQL database;
    class Redis cache;

    %% ===== Container Styling =====
    style Backend fill:#0b1120,stroke:#38bdf8,stroke-width:2px,color:#ffffff
    style API fill:#111827,stroke:#60a5fa,stroke-width:2px,color:#ffffff
    style Business fill:#052e16,stroke:#4ade80,stroke-width:2px,color:#ffffff
    style Data fill:#2e1065,stroke:#a78bfa,stroke-width:2px,color:#ffffff
```

---

# Request Lifecycle

```mermaid
sequenceDiagram
    autonumber

    participant Client as Client
    participant Route as Route
    participant Middleware as Middleware
    participant Controller as Controller
    participant Service as Service
    participant Database as PostgreSQL

    Client->>Route: HTTP Request
    Route->>Middleware: Validate & Authenticate
    Middleware->>Controller: Forward Request
    Controller->>Service: Execute Business Logic
    Service->>Database: Query / Transaction

    Database-->>Service: Result Set
    Service-->>Controller: Processed Data
    Controller-->>Client: JSON Response (200 OK)
```

---

# Application Layers

## Routes Layer

Responsibilities:

* Define API endpoints
* Apply middleware
* Forward requests to controllers

Example:

```text
/auth
/organizations
/projects
/invitations
```

---

## Middleware Layer

Handles security, validation, and request processing.

###  Authentication

* JWT verification
* User identification
* Token blacklist checks

###  Authorization

* Role validation
* Permission checks
* Organization access control

###  Validation

* Joi schema validation
* Input sanitization
* Request validation

###  Security

* Rate limiting
* Helmet headers
* CORS protection

###  Performance

* Redis caching
* Optimized request handling

###  Monitoring

* Request logging
* Error tracking

---

##  Controllers Layer

Controllers serve as the API entry point, handling HTTP requests and responses.

**Responsibilities**

* Extract request data
* Invoke service methods
* Return standardized responses
* Handle HTTP status codes

> Controllers remain thin and contain no business logic.

---

##  Services Layer

Services encapsulate the application's core business logic.

**Responsibilities**

* Execute business rules
* Manage database operations
* Handle transactions
* Enforce permissions and access control

**Core Services**

* Auth Service
* Organization Service
* Project Service

> Services act as the bridge between controllers and the database.

---

##  Database Layer

All database interactions are managed through Prisma ORM.

**Responsibilities**

* Data persistence
* Query execution
* Relationship management
* Schema migrations

**Database Engine**

```text
PostgreSQL
```

**ORM**

```text
Prisma
```

> Controllers → Services → Prisma → PostgreSQL

---

# Authentication Architecture

```mermaid
flowchart LR

User --> Login
Login --> AccessToken
Login --> RefreshToken

AccessToken --> ProtectedRoutes

RefreshToken --> TokenRotation

Logout --> RedisBlacklist
```

## Authentication Flow

1. User logs in.
2. Server validates credentials.
3. Access token is generated.
4. Refresh token is generated.
5. Access token is used for API requests.
6. Refresh token rotates when refreshed.
7. Logout blacklists tokens using Redis.

---

# RBAC Architecture

Roles are organization-specific.

A user can be:

* OWNER
* ADMIN
* MEMBER

inside one organization while having different permissions in another.

```mermaid
flowchart TD

Request --> Authenticate
Authenticate --> MembershipCheck
MembershipCheck --> RoleCheck
RoleCheck --> Controller
```

---

# Permission Matrix

| Action              | OWNER | ADMIN | MEMBER |
| ------------------- | ----- | ----- | ------ |
| View Organization   | ✅     | ✅     | ✅      |
| Update Organization | ✅     | ✅     | ❌      |
| Delete Organization | ✅     | ❌     | ❌      |
| Invite Members      | ✅     | ✅     | ❌      |
| Create Projects     | ✅     | ✅     | ❌      |
| Update Projects     | ✅     | ✅     | ❌      |
| Delete Projects     | ✅     | ✅     | ❌      |

---

# Database Architecture

```mermaid
erDiagram

USERS ||--o{ ORGANIZATION_MEMBERS : belongs_to
ORGANIZATIONS ||--o{ ORGANIZATION_MEMBERS : contains
ORGANIZATIONS ||--o{ PROJECTS : owns
USERS ||--o{ REFRESH_TOKENS : owns
ORGANIZATIONS ||--o{ INVITATIONS : contains
```

Core entities:

* Users
* Organizations
* Organization Members
* Projects
* Invitations
* Refresh Tokens

---

# Folder Structure

```text
src/
├── config/
├── controllers/
├── middleware/
├── routes/
├── services/
├── validators/
├── utils/
├── app.js
└── server.js
```

### Responsibilities

| Folder      | Responsibility              |
| ----------- | --------------------------- |
| routes      | Endpoint definitions        |
| controllers | HTTP handling               |
| services    | Business logic              |
| middleware  | Authentication & validation |
| validators  | Joi schemas                 |
| config      | Application configuration   |
| utils       | Shared utilities            |

---

# Design Principles

## Separation of Concerns

Each layer has a single responsibility.

## Stateless Authentication

JWT reduces database lookups and improves scalability.

## Multi-Tenant Design

Organizations act as tenants while sharing infrastructure.

## Defense in Depth

Security is enforced through:

* JWT validation
* RBAC
* Rate limiting
* Input validation
* Redis token blacklisting

## Scalability

The architecture supports:

* Horizontal API scaling
* Independent service growth
* Database optimization
* Distributed authentication

---

# Technology Stack

| Component        | Technology      |
| ---------------- | --------------- |
| Runtime          | Node.js         |
| Framework        | Express.js      |
| Database         | PostgreSQL      |
| ORM              | Prisma          |
| Cache            | Redis           |
| Authentication   | JWT             |
| Validation       | Joi             |
| Documentation    | Swagger/OpenAPI |
| Containerization | Docker          |

---
