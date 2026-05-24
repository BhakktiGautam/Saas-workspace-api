# Contributing to SaaS Workspace API

First of all, **thank you for contributing!** 🎉  
This project is part of **GirlScript Summer of Code (GSSoC)** and welcomes contributors of all experience levels — especially beginners.

Don't worry if this is your first open source contribution. This guide will walk you through everything step by step.

---

## Table of Contents

1. [What is this project?](#what-is-this-project)
2. [Before You Start](#before-you-start)
3. [Setting Up the Project Locally](#setting-up-the-project-locally)
4. [How to Contribute](#how-to-contribute)
5. [Making Your First Pull Request](#making-your-first-pull-request)
6. [Code Style Guidelines](#code-style-guidelines)
7. [Good First Issues](#good-first-issues)
8. [Need Help?](#need-help)

---

## What is this project?

This is a **production-style backend API** built with Node.js, Express, PostgreSQL, Prisma, and Redis.  
It demonstrates real-world patterns like JWT authentication, Role-Based Access Control (RBAC), and multi-tenant architecture.

It is designed to be a **learning resource** — every major decision in the code has a comment explaining *why*, not just *what*.

---

## Before You Start

Make sure you have the following installed on your computer:

- [Node.js](https://nodejs.org/) (version 18 or higher)
- [Git](https://git-scm.com/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) ← easiest way to run the project

> **Not sure if you have these?**  
> Open your terminal and run `node -v` and `git --version`. If you see a version number, you're good.

---

## Setting Up the Project Locally

Follow these steps carefully. Take it one step at a time.

### Step 1 — Fork the repository

Click the **Fork** button at the top right of this page.  
This creates your own copy of the project under your GitHub account.

### Step 2 — Clone your fork

```bash
git clone https://github.com/YOUR-USERNAME/Saas-workspace-api.git
cd Saas-workspace-api
```

> Replace `YOUR-USERNAME` with your actual GitHub username.

### Step 3 — Set up environment variables

```bash
cp .env.example .env
```

Open the `.env` file and fill in the following at minimum:

```
JWT_ACCESS_SECRET=any_long_random_string_here
JWT_REFRESH_SECRET=a_different_long_random_string_here
```

You can use any random string for local development.

### Step 4 — Start the project with Docker

```bash
docker compose up -d
```

This will start the API, PostgreSQL database, and Redis all at once.

### Step 5 — Run database migrations

```bash
docker compose exec api npx prisma migrate deploy
```

### Step 6 — (Optional) Add demo data

```bash
docker compose exec api node prisma/seed.js
```

### Step 7 — Check it's working

Open your browser and go to:  
👉 **http://localhost:3000/api-docs**

You should see the Swagger documentation. If you do, everything is working! 

---

## How to Contribute

### Step 1 — Find an issue to work on

- Go to the [Issues tab](../../issues)
- Look for issues labeled **`good first issue`** — these are beginner friendly
- Leave a comment like *"I'd like to work on this"* and wait for it to be assigned to you
- **Do not start working without being assigned** — this avoids two people doing the same work

### Step 2 — Create a new branch

Always create a new branch for your work. Never work directly on `main`.

```bash
git checkout -b your-branch-name
```

Name your branch something descriptive, for example:
- `feature/email-verification`
- `fix/login-error-message`
- `docs/update-readme`

### Step 3 — Make your changes

Write your code. Test it locally to make sure it works.

### Step 4 — Commit your changes

```bash
git add .
git commit -m "feat: add email verification on signup"
```

**Commit message format:**

| Prefix | When to use |
|--------|-------------|
| `feat:` | Adding a new feature |
| `fix:` | Fixing a bug |
| `docs:` | Updating documentation |
| `refactor:` | Improving code without changing behaviour |
| `test:` | Adding or updating tests |

### Step 5 — Push your branch

```bash
git push origin your-branch-name
```

### Step 6 — Open a Pull Request

- Go to your forked repo on GitHub
- Click **"Compare & pull request"**
- Write a clear title and description of what you changed and why
- Link the issue you worked on by writing `Closes #issue-number` in the description
- Submit the PR and wait for review

---

## Making Your First Pull Request

If this is your very first PR ever, here's what to expect:

- The maintainer may leave review comments asking for changes — **this is normal and not personal**
- Make the requested changes, commit them, and push — the PR updates automatically
- Once approved, your code gets merged 🎉

---

## Code Style Guidelines

- Use **camelCase** for variable and function names
- Always use `const` or `let`, never `var`
- Keep functions small and focused on one thing
- Add a comment when doing something non-obvious
- Follow the existing folder structure — routes → controllers → services

---

## Good First Issues

Not sure where to start? Here are some ideas that are beginner friendly:

-  Add email verification after signup
-  Add pagination to list endpoints
-  Add search/filter to projects list
- Write tests for auth endpoints
-  Improve error messages to be more descriptive
-  Add TypeScript types gradually

Check the [Issues tab](../../issues) for the full list with `good first issue` label.

---

## Need Help?

Stuck on something? Don't hesitate to:

- Leave a comment on the issue you're working on
- Open a [Discussion](../../discussions) with your question
- Tag the maintainer in your PR if you're unsure about something

**Everyone was a beginner once. There are no stupid questions here.** 

---

Made with ❤️ for new contributors
