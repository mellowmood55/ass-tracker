# Project State & Context Log

## 1. High-Level Architecture & Stack
- **Framework/Tech:** Monorepo with Express 5 API (`apps/api`) and React + Vite web app (`apps/web`); Neon/Postgres via `pg`; JWT auth; Excel import via `exceljs`.
- **Key Patterns:** API routes live in `apps/api/src/index.js`; database helpers and schema initialization in `apps/api/src/db.js`; asset input validation in `apps/api/src/validation.js`; React pages/components consume `apps/web/src/lib/api.js`.

## 2. Core File Map
- `/apps/api/src/index.js` - Express routes for auth, assets, imports, audit logs, settings, and production static serving.
- `/apps/api/src/db.js` - Postgres connection, schema initialization, seed data, and transaction helpers.
- `/apps/api/src/auth.js` - JWT signing and request authentication/authorization helpers.
- `/apps/api/src/validation.js` - Asset payload normalization and validation.
- `/apps/api/src/duplicateConflict.js` - Structured duplicate-conflict helpers for asset identifiers.
- `/apps/web/src/pages/EntryPage.jsx` - Asset create/edit entry page and category selection wiring.
- `/apps/web/src/components/assets/AssetForm.jsx` - Asset form submission logic for create/update flows.
- `/CHANGELOG.md` - User-facing change log for unreleased fixes and features.

## 3. Recently Implemented (Log)
- **2026-08-02:** Fixed login credential oracle for inactive accounts and prevented failed import rows from polluting in-batch duplicate tracking. Files touched: `/apps/api/src/index.js`, `/CHANGELOG.md`, `/PROJECT_STATE.md`.

## 4. Current Working State & Pending Tasks
- [x] Reviewed recent main commits for high-severity bugs not already tracked in automation memory.
- [x] Fixed inactive-account login response to avoid confirming correct passwords.
- [x] Fixed import duplicate tracking so only committed rows reserve Asset No / Serial No values.
- [x] Ran available validation (`node --check apps/api/src/index.js`, `npm test --prefix apps/api`, `npm run build`).
- [ ] Open a PR for review.
