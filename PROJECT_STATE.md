# Project State & Context Log

## 1. High-Level Architecture & Stack
- **Framework/Tech:** Monorepo with Express 5 API (`apps/api`) backed by Postgres/Neon via `pg`, and React 19 + Vite web app (`apps/web`) styled with Tailwind CSS/Radix UI.
- **Key Patterns:** JWT bearer auth stored client-side in session storage; API route handlers in `apps/api/src/index.js`; configurable category field metadata persisted in Postgres and cached by `apps/api/src/categoryConfig.js`; web import flow maps spreadsheet headers to dynamic category fields before posting rows to `/api/assets/import`.

## 2. Core File Map
- `/apps/api/src/index.js` - Express routes for auth, users, category settings, assets, imports, reports, static production serving, and startup.
- `/apps/api/src/db.js` - Postgres pool setup, transaction helper, schema initialization, default admin seeding, and category config cache initialization.
- `/apps/api/src/auth.js` - JWT signing and auth/role middleware.
- `/apps/api/src/categoryConfig.js` - Category field defaults, validation, import normalization, report row generation, and cached settings persistence.
- `/apps/api/src/validation.js` - Asset payload normalization/validation and blank required-field detection.
- `/apps/web/src/components/import/ImportWizard.jsx` - Multi-step spreadsheet import UI, stored mapping merge logic, preview, and import submission.
- `/apps/web/src/lib/importMapping.js` - Spreadsheet parsing, header scoring, template generation, value normalization, and row mapping helpers.
- `/CHANGELOG.md` - Human-facing change log for the active branch.

## 3. Recently Implemented (Log)
- **[2026-08-09]:** Fixed saved import mappings so stale local mappings cannot duplicate a destination field already chosen by auto-map or target fields that no longer exist; updated `apps/web/src/components/import/ImportWizard.jsx` and `CHANGELOG.md`.

## 4. Current Working State & Pending Tasks
- [x] Critical bug scan identified a high-impact import mapping corruption path not already tracked in persistent memory.
- [x] Implemented a narrow web import mapping fix and documentation updates.
- [ ] Run verification after committing/pushing the initial fix branch state.
