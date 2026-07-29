# Project State & Context Log

## 1. High-Level Architecture & Stack
- **Framework/Tech:** Monorepo with Express 5 API (`apps/api`), React + Vite web app (`apps/web`), Postgres via `pg`, JWT auth, Excel/PDF import-export helpers.
- **Key Patterns:** Express route handlers with Zod request validation; Postgres schema bootstrap in `apps/api/src/db.js`; role-gated admin/operator workflows; category-specific asset field configuration cached by the API.

## 2. Core File Map
- `/apps/api/src/db.js` - Postgres pool, schema/bootstrap migrations, default admin seeding, and shared transaction/query helpers.
- `/apps/api/src/index.js` - Express application routes for auth, users, assets, imports, reports, and settings.
- `/apps/api/src/auth.js` - JWT signing and auth/role middleware.
- `/apps/api/src/categoryConfig.js` - Category field defaults, persistence, normalization, and report/import helpers.
- `/apps/api/test/db.test.js` - Node test coverage for database bootstrap invariants.
- `/apps/api/package.json` - API scripts and dependencies.
- `/CHANGELOG.md` - Unreleased change log.

## 3. Recently Implemented (Log)
- **[2026-07-29]:** Added database-enforced case-insensitive username uniqueness in `apps/api/src/db.js`, including startup duplicate detection, case-insensitive default-admin lookup/reset, API bootstrap tests in `apps/api/test/db.test.js`, and updated the API test script.

## 4. Current Working State & Pending Tasks
- [x] Fixed username case-variant race that could create ambiguous login matches.
- [x] Added focused API tests for the username uniqueness bootstrap invariant.
