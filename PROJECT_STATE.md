# Project State & Context Log

## 1. High-Level Architecture & Stack
- **Framework/Tech:** Monorepo with Express 5 API (`apps/api`) backed by Neon/Postgres via `pg`, and React 19 + Vite 8 web UI (`apps/web`) styled with Tailwind and local component primitives.
- **Key Patterns:** JWT bearer auth in `apps/api/src/auth.js`; asset/category metadata APIs in `apps/api/src/index.js`; configurable category field definitions cached by `apps/api/src/categoryConfig.js`; React context for auth/theme/data refresh; asset forms serialize fixed shared fields to asset columns and configurable custom shared/detail fields to `details_json`.

## 2. Core File Map
- `/apps/api/src/index.js` - Express routes for auth, users, categories, assets, imports, reports, production static serving, and audit logging.
- `/apps/api/src/db.js` - Postgres pool setup, schema initialization, default admin seeding, and transaction helper.
- `/apps/api/src/auth.js` - JWT signing and role-based middleware.
- `/apps/api/src/categoryConfig.js` - Default/stored category field configuration, import normalization, settings save, cache refresh, and report row generation.
- `/apps/api/src/validation.js` - Asset payload validation using active category field configuration.
- `/apps/web/src/lib/assetColumns.js` - Asset form state hydration/serialization and risk helpers.
- `/apps/web/src/lib/fieldConfig.js` - Category field preview/list column helpers.
- `/apps/web/src/lib/assetColumns.test.js` - Vitest coverage for custom shared-field form serialization.
- `/apps/web/src/components/assets/AssetForm.jsx` - Dynamic asset create/edit form.
- `/apps/web/src/pages/settings/EditCategoryFieldsPage.jsx` - Admin UI for configurable category fields.
- `/CHANGELOG.md` - User-visible change log.

## 3. Recently Implemented (Log)
- **2026-08-05:** Fixed configurable custom shared category fields so they persist via `details_json` across form hydration/submission, API validation, imports, list/report display, and same-category asset edits without silently dropping older dynamic detail keys. Added Vitest for focused web unit coverage. Files touched: `apps/web/src/lib/assetColumns.js`, `apps/web/src/lib/fieldConfig.js`, `apps/web/src/lib/assetColumns.test.js`, `apps/web/package.json`, `apps/web/package-lock.json`, `apps/api/src/validation.js`, `apps/api/src/categoryConfig.js`, `apps/api/src/index.js`, `CHANGELOG.md`, `PROJECT_STATE.md`.

## 4. Current Working State & Pending Tasks
- [x] Critical bug fix for custom shared category field persistence implemented.
- [x] Verification run after commit/push: `npm test --prefix apps/web`, targeted changed-file ESLint, `npm run build --prefix apps/web`, and API `node --check` passed.
- [ ] Repo-wide `npm run lint --prefix apps/web` is still blocked by unrelated existing lint errors in `AssetTable.jsx`, `Sidebar.jsx`, `DataRefreshContext.jsx`, `useCategoryFieldSettings.js`, `importMapping.js`, `AssetsPage.jsx`, and `UsersSettingsPage.jsx`.
