# Contributing to SaaS Workspace API

First of all, **thank you for contributing!** 🎉

We’re excited to have you here. Every contribution—whether it’s fixing a bug, improving documentation, suggesting a feature, or writing code—helps make this project better for everyone.

This project is part of **GirlScript Summer of Code (GSSoC)** and welcomes contributors of all experience levels, from first-time open source contributors to experienced developers.

Don't worry if this is your first open source contribution. We believe open source should be accessible to everyone, and this guide is designed to walk you through the contribution process step by step. We're here to support your learning journey and help you make meaningful contributions with confidence. 🚀

---

## Table of Contents

| Section                                                                | Description            |
| ---------------------------------------------------------------------- | ---------------------- |
| 1. [Project Overview](#what-is-this-project)                           | About the project.     |
| 2. [Prerequisites](#before-you-start)                                  | Requirements to begin. |
| 3. [Local Development Setup](#setting-up-the-project-locally)          | Setup instructions.    |
| 4. [Contribution Workflow](#how-to-contribute)                         | How to contribute.     |
| 5. [Creating Your First Pull Request](#making-your-first-pull-request) | Submit your changes.   |
| 6. [Coding Standards & Best Practices](#code-style-guidelines)         | Coding guidelines.     |
| 7. [Beginner-Friendly Issues](#good-first-issues)                      | Starter issues.        |
| 8. [Getting Help & Support](#need-help)                                | Support resources.     |

---

## What is this project?

This project is a **production-ready backend API** built using **Node.js, Express, PostgreSQL, Prisma, and Redis**. It showcases industry-standard practices such as **JWT authentication**, **Role-Based Access Control (RBAC)**, and **multi-tenant architecture**.

Beyond being a functional application, it serves as a **learning resource** for developers. The codebase emphasizes clarity and maintainability, with detailed comments explaining not only *what* the code does, but also *why* specific design decisions were made.

---

## Before You Start

Before setting up the project, ensure the following tools are installed:

| Tool           | Required Version      |
| -------------- | --------------------- |
| Node.js        | 18 or higher          |
| Git            | Latest stable version |
| Docker Desktop | Recommended           |

Docker Desktop is the easiest way to run the project's services locally.

> **Verify your installation**
>
> Open a terminal and run:
>
> ```bash
> node -v
> git --version
> ```
>
> If both commands return version numbers, you're ready to proceed.

---

## Setting Up the Project Locally

Follow the steps below to set up the project on your local machine.

| Step | Action                          |
| ---- | ------------------------------- |
| 1    | Fork the repository             |
| 2    | Clone your fork                 |
| 3    | Configure environment variables |
| 4    | Start services with Docker      |
| 5    | Run database migrations         |
| 6    | Seed demo data (optional)       |
| 7    | Verify the setup                |

### Step 1 — Fork the Repository

Click the **Fork** button at the top-right corner of the repository page. This creates a copy of the project under your GitHub account.

### Step 2 — Clone Your Fork

```bash
git clone https://github.com/YOUR-USERNAME/Saas-workspace-api.git
cd Saas-workspace-api
```

> Replace `YOUR-USERNAME` with your GitHub username.

### Step 3 — Configure Environment Variables

```bash
cp .env.example .env
```

Open `.env` and update the following values:

```env
JWT_ACCESS_SECRET=any_long_random_string_here
JWT_REFRESH_SECRET=a_different_long_random_string_here
```

For local development, any sufficiently long random strings will work.

### Step 4 — Start Services with Docker

```bash
docker compose up -d
```

This command starts the API, PostgreSQL database, and Redis containers.

### Step 5 — Run Database Migrations

```bash
docker compose exec api npx prisma migrate deploy
```

### Step 6 — Seed Demo Data (Optional)

```bash
docker compose exec api node prisma/seed.js
```

### Step 7 — Verify the Setup

Open the following URL in your browser:

```text
http://localhost:3000/api-docs
```

If the Swagger documentation loads successfully, the setup is complete.

---

## How to Contribute

### Contribution Workflow

| Step | Action              |
| ---- | ------------------- |
| 1    | Choose an issue     |
| 2    | Create a branch     |
| 3    | Make your changes   |
| 4    | Commit your work    |
| 5    | Push your branch    |
| 6    | Open a Pull Request |

### Step 1 — Choose an Issue

* Browse the [Issues](../../issues) tab.
* Start with issues labeled **`good first issue`** if you're new to the project.
* Comment on the issue and wait for it to be assigned before starting work.

### Step 2 — Create a Branch

Create a dedicated branch for your changes.

```bash
git checkout -b your-branch-name
```

Examples:

* `feature/email-verification`
* `fix/login-error-message`
* `docs/update-readme`

### Step 3 — Make Your Changes

Implement the requested changes and verify that everything works correctly.

### Step 4 — Commit Your Work

```bash
git add .
git commit -m "feat: add email verification on signup"
```

#### Commit Message Convention

| Prefix      | Description               |
| ----------- | ------------------------- |
| `feat:`     | New feature               |
| `fix:`      | Bug fix                   |
| `docs:`     | Documentation changes     |
| `refactor:` | Code improvements         |
| `test:`     | Test additions or updates |

### Step 5 — Push Your Branch

```bash
git push origin your-branch-name
```

### Step 6 — Open a Pull Request

* Open a Pull Request from your fork.
* Provide a clear title and description.
* Link the related issue using `Closes #issue-number`.
* Submit the PR for review.

---

## Making Your First Pull Request

If this is your first contribution:

* Review feedback is part of the process.
* Make requested changes and push updates to the same branch.
* Once approved, your Pull Request will be merged.

---

## Code Style Guidelines

* Use `camelCase` for variables and functions.
* Prefer `const` and `let` over `var`.
* Keep functions focused and reusable.
* Add comments when necessary.
* Follow the existing project structure.

---

## Good First Issues

New contributors may find these tasks approachable:

* Email verification
* Pagination support
* Search and filtering
* Authentication tests
* Error message improvements
* TypeScript type enhancements

See the [Issues](../../issues) tab for the latest beginner-friendly tasks.

---

## Need Help?

If you need assistance:

* Comment on the issue.
* Open a [Discussion](../../discussions).
* Ask questions in your Pull Request.

We welcome contributors of all experience levels and are happy to help you get started.

---

Built for learning, collaboration, and open-source contributions.
