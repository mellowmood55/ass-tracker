# Project State & Context Log

## 1. High-Level Architecture & Stack
- **Framework/Tech:** Monorepo with Express 5 API (`apps/api`) backed by Neon/Postgres via `pg`, and React 19 + Vite web app (`apps/web`) styled with Tailwind/Radix UI primitives.
- **Key Patterns:** REST API with JWT bearer auth, role-based admin/operator authorization, Postgres bootstrap/migration in `initDb()`, category field configuration cache, React context for auth/theme state, and mobile-first settings/assets workflows.

## 2. Core File Map
- `/apps/api/src/index.js` - Express app, auth/user/asset/category routes, report generation, audit-log writes, import flow, and production static serving.
- `/apps/api/src/auth.js` - JWT signing/verification and admin/operator role helpers.
- `/apps/api/src/db.js` - Postgres pool, transaction helper, schema bootstrap, default admin seeding, and category config initialization.
- `/apps/api/src/categoryConfig.js` - Category field defaults, validation, import normalization, settings persistence, and config cache.
- `/apps/api/src/validation.js` - Asset payload normalization and validation against configured category fields.
- `/apps/api/src/duplicateConflict.js` - Structured asset identity duplicate conflict detection/responses.
- `/apps/web/src/pages/settings/UsersSettingsPage.jsx` - Admin user management UI, registration, role/active toggles, password resets, and deletion.
- `/apps/web/src/pages/settings/AccountSettingsPage.jsx` - Self-service current-password-verified password change UI.
- `/apps/web/src/lib/api.js` - Fetch wrapper, API error model, asset query builder, and report downloads.
- `/apps/web/src/lib/roles.js` - Client-side role normalization and capability helpers.
- `/CHANGELOG.md` - Human-readable release notes for unreleased changes.

## 3. Recently Implemented (Log)
- **2026-08-04:** Fixed admin self password reset bypass by rejecting self-targeted `/api/users/:id/reset-password` requests in `apps/api/src/index.js`, disabling/guarding the self reset action in `apps/web/src/pages/settings/UsersSettingsPage.jsx`, and documenting the security fix in `CHANGELOG.md`.

## 4. Current Working State & Pending Tasks
- [x] Fixed admin self password reset bypass so own-password changes must use current-password verification in Account settings.
- [ ] Run verification after committing and pushing the fix branch, per cloud workflow.
