# Changelog

## [Unreleased]

### Changed
- Production API startup now rejects default security credentials and requires an explicit initial admin password.
- Reorganized monorepo into `apps/api` (Express + Neon) and `apps/web` (React + Vite); root scripts and Render build paths updated accordingly.
- Documented the full local run procedure (Neon `.env`, install, `npm run dev`, troubleshooting) in the README.
- Replaced local SQLite (`better-sqlite3`) with Neon Postgres via `pg` and `DATABASE_URL`.
- Production serves the Vite web build from Express so one hosted URL works on any device.
- Fresh installs seed only the configured initial admin account (no sample assets).

### Added
- Render-oriented root `build` / `start` scripts and Neon + Render setup docs in the README.
