# Changelog

## [Unreleased]

### Fixed
- Import duplicate autofill now skips cross-category identifier collisions instead of filling missing fields on an unrelated asset record.
- Import no longer fails the whole job when a row has a blank Status (`assets.status` is NOT NULL); blank status is stored as empty and flagged for attention, and other rows continue.
- Import normalizes mismatched status values (e.g. `not working` → `Non-funct`) instead of rejecting fixed-list mismatches; select mismatches soft-clear on import.

### Added
- Edit Category Fields preview: click a field header (e.g. Asset No) to jump to that field’s edit form.
- Move Asset tab: relocate assets by location / office / department / assigned to; save updates the asset list via cascade rules.
- Assets condition filters: cascading Category → Field → Value dropdowns over the union of all fields in all categories (e.g. Office = HR); boolean fields use Yes/No.
- Edit Category Fields WhatsApp-style floating toolkit (expand on click, icons only with aria-labels, edit toggle on toolkit).
- Maintenance fixed left asset panel: moving assets, location, assigned to, asset number, field number, plus model/category/office/status.
- Import progress jobs with Importing / Completed / Failed status, progress percent, and duplicate auto-fill of missing fields (autofill takes precedence over skip).
- Assets select mode: bulk delete and bulk edit of common field values (Asset No / Serial No stay unique).
- Computer fields: Assigned room, Department, and RAM; department/location moves clear assignees that would span two departments.
- Maintenance tab with quarterly Q1–Q4 checklists, “maintenance managed” status, PDF reports, and Settings checklist editor.
- Settings → Add category for dynamic codes (e.g. VoIP / IP phones).

### Changed
- Maintenance change-request PDF: Hardware Problem and Software Problem sections always appear (blank when no issues), ensuring consistent layout regardless of data.
- Maintenance tab: clicking a machine row opens the form directly (row click = open form); Form button preserved as fallback. Machine list scrolls independently (max-height container like Move Assets) instead of scrolling the whole page. Keyboard accessible with Enter/Space.
- Maintenance tab: Quarterly and Monthly are separate views with switch buttons (not stacked); shared search filters the active list; checklist settings use the same cadence switch.
- Maintenance reworked into **Quarterly** and **Monthly** sections (Q1–Q4 / M1–M12); status is **complete** (migrated from `managed`); forms capture hardware/software issues, solution, and Done by; PDF is a PAD/IT change-request form (checklists stay in-app only).
- Settings → Maintenance checklists: Quarterly | Monthly × Computer | Printer templates.
- Computer Microsoft Office group: removed locked **Office Installed**; kept **Office Type** and **Office Status** only (forced via config patch for existing DBs).

### Previously added
- Operator vs admin roles: operators can create/import/read; only admins edit/delete assets and manage settings.
- Settings hub: Account (change password), Appearance (light/dark/system), Users (admin registration), Category Fields.
- Dark theme CSS tokens matching the warm parchment + forest-green light brand.
- User management APIs (`/api/users`) and change-password endpoint.
- Concurrent duplicate handling: structured `409 DUPLICATE_ASSET` with field conflicts; import savepoints so unique races skip a row instead of aborting the batch.
- Office LAN deploy scripts (`build-office.cmd`, `start-office.cmd`) and README guide for production hosting on one ICT PC.

### Changed
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
