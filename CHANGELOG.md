# Changelog

## [Unreleased]

### Changed
- Rejected unrecognized spreadsheet boolean values during computer imports so values like `Unknown` or `N/A` cannot be saved or reported as installed/yes.
- Reorganized monorepo into `apps/api` (Express + Neon) and `apps/web` (React + Vite); root scripts and Render build paths updated accordingly.
- Documented the full local run procedure (Neon `.env`, install, `npm run dev`, troubleshooting) in the README.
- Replaced local SQLite (`better-sqlite3`) with Neon Postgres via `pg` and `DATABASE_URL`.
- Production serves the Vite web build from Express so one hosted URL works on any device.
- Fresh installs seed only the default `admin` / `admin123` account (no sample assets).

### Added
- Render-oriented root `build` / `start` scripts and Neon + Render setup docs in the README.
