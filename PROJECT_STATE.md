# Project State & Context Log

## 1. High-Level Architecture & Stack
- **Framework/Tech:** Monorepo with Express 5 API (`apps/api`) backed by Postgres/Neon via `pg`, React 19 + Vite web app (`apps/web`), Tailwind-style utility CSS, JWT bearer auth, bcrypt password hashing.
- **Key Patterns:** Express REST endpoints with Zod request validation, Postgres schema initialization in `apps/api/src/db.js`, JWT auth middleware in `apps/api/src/auth.js`, React context for browser auth state, settings pages under `apps/web/src/pages/settings/`.

## 2. Core File Map
- `/apps/api/src/index.js` - Express API routes for auth, users, category settings, assets, imports, reports, and audit logs.
- `/apps/api/src/auth.js` - JWT signing, role normalization, auth/admin middleware, and per-user session version enforcement.
- `/apps/api/src/db.js` - Postgres pool, transaction helper, schema initialization, and default admin bootstrap.
- `/apps/api/src/auth.test.js` - Node test coverage for auth middleware session-version acceptance/rejection.
- `/apps/web/src/context/AuthContext.jsx` - Browser session storage and auth state provider.
- `/apps/web/src/pages/settings/AccountSettingsPage.jsx` - Signed-in user password change UI.
- `/apps/web/src/pages/settings/UsersSettingsPage.jsx` - Admin user management and password reset UI.
- `/CHANGELOG.md` - Unreleased change log.

## 3. Recently Implemented (Log)
- **2026-08-01:** Fixed password-change/reset session invalidation by adding `users.session_version`, signing it into JWTs, rejecting stale token versions in auth middleware, rotating versions transactionally with password audit logs, refreshing self-reset tokens in settings UI, and adding focused API auth tests.

## 4. Current Working State & Pending Tasks
- [x] Confirmed prior remembered bug PRs #1-#8, #10, and #13-#17 remain open and should not be duplicated.
- [x] Implemented critical security fix for stale bearer tokens after password changes/resets.
- [x] Verification: `npm test --prefix apps/api` passed; `npm run build --prefix apps/web` passed.
- [x] Verification note: `npm run lint --prefix apps/web` currently fails on pre-existing lint violations in AssetTable, DynamicField, Sidebar, DataRefreshContext, useCategoryFieldSettings, importMapping, AssetsPage, and UsersSettingsPage.
- [ ] Open PR and record the new bug in automation memory after validation.
