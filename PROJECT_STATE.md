# Project State & Context Log

## 1. High-Level Architecture & Stack
- **Framework/Tech:** Node monorepo — `apps/api` (Express + Neon Postgres), `apps/web` (React/Vite)
- **Key Patterns:** REST API + JWT auth; category field configs in DB; maintenance records with cadence-scoped checklist templates

## 2. Core File Map
- `/apps/api/src/db.js` — Postgres init, migrations (incl. maintenance cadence/issue columns)
- `/apps/api/src/maintenance.js` — Quarterly/monthly templates, records, report payload
- `/apps/api/src/index.js` — Routes + PAD/IT change-request PDF generation
- `/apps/web/src/pages/MaintenancePage.jsx` — Quarterly + Monthly list sections + form
- `/apps/web/src/pages/settings/MaintenanceChecklistsPage.jsx` — Cadence × category checklist editor
- `/apps/web/src/components/maintenance/MaintenanceAssetPanel.jsx` — Left asset identity panel
- `/apps/web/src/pages/MoveAssetPage.jsx` — Move asset by location/office/assignedRoom
- `/apps/api/src/assetCascade.js` — Office/assigned-room cascade rules
- `/apps/api/src/assetCascade.test.js` — Node unit coverage for office/location reassignment cascade behavior

## 3. Recently Implemented (Log)
- **2026-08-12:** Fixed asset reassignment cascade so legacy department values migrate to office, stale assignees clear on office/location moves, and bulk edit reuses cascade + validation (`apps/api/src/assetCascade.js`, `apps/api/src/index.js`, `apps/api/src/assetCascade.test.js`).
- **2026-07-29:** PDF always renders Hardware Problem + Software Problem sections (blank when empty) for consistent layout.
- **2026-07-29:** Maintenance row click opens form directly; list-only scroll (max-h-[28rem]); keyboard a11y (Enter/Space). Form button kept as fallback.
- **2026-07-29:** Maintenance Quarterly/Monthly as separate views with switch buttons + search; checklist settings use the same cadence switch.
- **2026-07-28:** Maintenance quarterly/monthly restructure: cadence + month schema; issue fields; complete status; PAD PDF without checklists; dual list sections; settings cadence tabs.
- **2026-07-28:** Asset filtering simplified to category/status/search; Move Asset tab; department UI removed; office cascade.

## 4. Current Working State & Pending Tasks
- [x] Maintenance view switch (quarterly/monthly) + search bar
- [x] Maintenance quarterly/monthly + issue report (schema, API, UI, PDF, settings)
- [x] Transfer notes + push `feat/asset-enhancements` (not main)
- [x] Fix asset move/bulk-edit cascade data integrity bug
- [ ] Open PR into `main` when ready
