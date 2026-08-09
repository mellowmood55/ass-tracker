# Changelog

## [Unreleased]

### Added
- Operator vs admin roles: operators can create/import/read; only admins edit/delete assets and manage settings.
- Settings hub: Account (change password), Appearance (light/dark/system), Users (admin registration), Category Fields.
- Dark theme CSS tokens matching the warm parchment + forest-green light brand.
- User management APIs (`/api/users`) and change-password endpoint.
- Concurrent duplicate handling: structured `409 DUPLICATE_ASSET` with field conflicts; import savepoints so unique races skip a row instead of aborting the batch.
- Office LAN deploy scripts (`build-office.cmd`, `start-office.cmd`) and README guide for production hosting on one ICT PC.

### Changed
- Startup category-field migrations now preserve saved antivirus field requirements and locks.
- Saved spreadsheet import mappings now clear competing auto-mapped columns and ignore removed fields before import.
- Asset No / Serial No (and shared text fields) are trimmed on validate before persistence.
- Entry form surfaces duplicate conflicts with an admin “Open existing” action.
- Production API binds to `0.0.0.0` by default so LAN devices can reach the host PC.
- Reorganized monorepo into `apps/api` (Express + Neon) and `apps/web` (React + Vite); root scripts and Render build paths updated accordingly.
- Documented the full local run procedure (Neon `.env`, install, `npm run dev`, troubleshooting) in the README.
- Replaced local SQLite (`better-sqlite3`) with Neon Postgres via `pg` and `DATABASE_URL`.
- Production serves the Vite web build from Express so one hosted URL works on any device.
- Fresh installs seed only the default `admin` / `admin123` account (no sample assets).

### Previously added
- Render-oriented root `build` / `start` scripts and Neon + Render setup docs in the README.
