# Changelog

## [Unreleased]

### Changed
- Replaced local SQLite (`better-sqlite3`) with Neon Postgres via `pg` and `DATABASE_URL`.
- Production serves the Vite client build from Express so one hosted URL works on any device.
- Fresh installs seed only the default `admin` / `admin123` account (no sample assets).

### Added
- Render-oriented root `build` / `start` scripts and Neon + Render setup docs in the README.
