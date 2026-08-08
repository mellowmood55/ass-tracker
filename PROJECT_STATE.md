# Project State & Context Log

## 1. High-Level Architecture & Stack
- **Framework/Tech:** Monorepo with Express 5 API (`apps/api`) backed by Neon/Postgres via `pg`, and React 19 + Vite 8 web UI (`apps/web`) using Tailwind/Radix UI components.
- **Key Patterns:** JWT bearer auth, admin/operator role checks, Express REST endpoints, category-driven asset field configuration, React context for auth/theme/data refresh, client-side import mapping with server-side validation.

## 2. Core File Map
- `/apps/api/src/index.js` - Main Express application, auth routes, user-management routes, asset CRUD/import/report endpoints, production static serving.
- `/apps/api/src/auth.js` - JWT signing and middleware role checks.
- `/apps/api/src/db.js` - Postgres connection pool, schema initialization, default admin seed, transaction helper.
- `/apps/api/src/categoryConfig.js` - Dynamic category field defaults, validation, import normalization, settings persistence.
- `/apps/api/src/validation.js` - Asset payload normalization and category-aware validation.
- `/apps/web/src/App.jsx` - Protected routes and admin-only settings route declarations.
- `/apps/web/src/lib/api.js` - Fetch wrapper, report download helper, structured API error handling.
- `/apps/web/src/lib/assetColumns.js` - Asset list/form helpers and payload construction.
- `/apps/web/src/components/import/ImportWizard.jsx` - Spreadsheet import workflow and API submission.
- `/CHANGELOG.md` - Unreleased change notes.

## 3. Recently Implemented (Log)
- **[2026-08-08]:** Fixed user-management self role/status mutation in `/apps/api/src/index.js`; admins can no longer PATCH their own `role` or `isActive`, preventing stale admin tokens from self-reactivating or self-promoting after demotion/deactivation. Updated `/CHANGELOG.md`.

## 4. Current Working State & Pending Tasks
- [x] Block self role/active-status changes in the user-management API.
- [x] Validate backend syntax and available project checks for the authorization fix.
