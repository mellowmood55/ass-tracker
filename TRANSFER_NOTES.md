# Ass Tracker — Transfer & Continue Notes

**Date:** 2026-08-03  
**Branch to use:** `feat/asset-enhancements` (not `main`)  
**Remote:** https://github.com/mellowmood55/ass-tracker.git

This file summarizes the Cursor agent chat work on this branch so you can move the project to another machine and keep going.

---

## 1. What this branch contains (high level)

Stack: Node monorepo — `apps/api` (Express + Neon Postgres) + `apps/web` (React/Vite).

Major work delivered on this branch:

### Assets & import
- Import progress jobs (Importing / Completed / Failed)
- Duplicate autofill of missing fields (autofill over reject)
- Bulk delete / bulk edit
- Soft-fail blank status and select mismatches on import
- Status aliases (e.g. `not working` → `Non-funct`)

### Filters, move, settings UX
- Assets filters simplified to Category + Status + Search
- Move Asset tab (`/move-asset`): location, office, assigned to
- Department removed from new UI flows; office is the department-like source
- Edit Category Fields: floating toolkit + click preview header to jump to field
- Computer: Office Installed removed; Office Type / Office Status kept

### Maintenance (main focus of later chat turns)
- Quarterly + Monthly cadences (Q1–Q4 / M1–M12)
- Templates: quarterly|monthly × computer|printer
- Status: `complete` (migrated from `managed`)
- Form: checklist + hardware/software issues + solution + Done by
- PAD/IT change-request PDF (checklists not printed)
- PDF always shows Hardware + Software sections (blank if empty)
- Separate views with Quarterly | Monthly switch + search
- Row click opens maintenance form; Form button kept as fallback
- List-only scroll (`max-h-[28rem]`) like Move Assets
- Settings checklist editor mirrors cadence switch

### Key files
| Path | Role |
|------|------|
| `apps/api/src/db.js` | Schema + migrations |
| `apps/api/src/maintenance.js` | Templates, records, report payload |
| `apps/api/src/index.js` | Routes + PDF |
| `apps/api/src/importJobs.js` | Import jobs |
| `apps/api/src/assetCascade.js` | Office / assignee cascade |
| `apps/web/src/pages/MaintenancePage.jsx` | List + form |
| `apps/web/src/pages/settings/MaintenanceChecklistsPage.jsx` | Checklist settings |
| `apps/web/src/pages/MoveAssetPage.jsx` | Move asset |
| `PROJECT_STATE.md` | Agent context log (keep updated) |
| `CHANGELOG.md` | User-facing change log |

---

## 2. Clone this branch on another machine

### Option A — Clone only this branch (fast)

```bash
git clone -b feat/asset-enhancements --single-branch https://github.com/mellowmood55/ass-tracker.git
cd ass-tracker
```

### Option B — Full clone, then switch

```bash
git clone https://github.com/mellowmood55/ass-tracker.git
cd ass-tracker
git fetch origin
git checkout feat/asset-enhancements
```

### Option C — You already have the repo elsewhere

```bash
cd ass-tracker
git fetch origin
git checkout feat/asset-enhancements
git pull origin feat/asset-enhancements
```

---

## 3. Run locally after clone

1. **Node:** v20+  
2. **Install:**

```bash
npm run install:all
```

3. **API env:** create `apps/api/.env` (do **not** commit secrets):

```env
DATABASE_URL=postgresql://...your-neon-connection...
JWT_SECRET=change-me
DEFAULT_ADMIN_PASSWORD=admin123
```

Copy from an existing machine’s `apps/api/.env` or Neon dashboard. See `apps/api/.env.example` if present.

4. **Dev:**

```bash
npm run dev
```

- Web: usually Vite on `http://localhost:5173`  
- API: Express (check `apps/api` for port; often `3001` or via proxy)

5. **Default login:** `admin` / value of `DEFAULT_ADMIN_PASSWORD` (default `admin123` unless changed).

6. **Build check:**

```bash
npm run build --prefix apps/web
```

---

## 4. Continue work safely

1. Stay on `feat/asset-enhancements` until you open a PR into `main`.
2. Before coding on a new machine: `git pull origin feat/asset-enhancements`.
3. Keep `PROJECT_STATE.md` updated so agents/humans know current state.
4. Update `CHANGELOG.md` under `[Unreleased]` for user-facing changes.
5. Do **not** commit: `.env`, `node_modules/`, `apps/web/dist/`, local DB files, or accidental `src/` / `tests/` .NET `obj`/`bin` junk if present.
6. When ready to merge: push branch → open PR on GitHub → review → merge to `main` (do not push feature work straight to `main`).

### Push from this machine (already done if transfer succeeded)

```bash
git push -u origin feat/asset-enhancements
```

### Open a PR later

```bash
gh pr create --base main --head feat/asset-enhancements --title "feat: asset enhancements + maintenance quarterly/monthly" --body "See TRANSFER_NOTES.md and CHANGELOG.md"
```

---

## 5. Agent chat summary (what was asked / done)

1. **Maintenance quarterly/monthly + issue report** — schema cadence/month/issue fields; API; UI; PAD PDF; settings templates; `managed` → `complete`.
2. **Separate Quarterly/Monthly views + search** — switch buttons; one cadence at a time; client search; same switch on checklist settings.
3. **UI behavior** — row click opens form; Form button fallback; list-only scroll; checklist refresh after settings save (already wired via `ensureRecord` + template reload); computer/printer template isolation.
4. **PDF consistency** — always print Hardware Problem and Software Problem sections (leave blank if empty).
5. **This transfer** — `TRANSFER_NOTES.md`, commit, push branch (not `main`).

---

## 6. Known follow-ups

- [ ] Open PR from `feat/asset-enhancements` → `main` when ready
- [ ] Confirm Neon `DATABASE_URL` on the new machine
- [ ] Smoke-test Maintenance form → complete → PDF download
- [ ] Smoke-test Settings → Maintenance checklists save → new form shows new items

For deeper architecture context, read `PROJECT_STATE.md` first, then `CHANGELOG.md`.
