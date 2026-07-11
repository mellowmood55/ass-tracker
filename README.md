# ICT Asset Tracker (MVP)

Cloud-ready asset tracker for ICT teams with:
- Local account login (JWT)
- Mobile-first tabbed UI (Dashboard, Entry, Import, Assets)
- Category-driven input forms
- Category-specific statuses and validation
- Asset CRUD with search/filter
- Excel and PDF report exports
- Stepped CSV/XLS/XLSX import with column mapping memory
- Priority risk alerts (antivirus + outdated OS)
- Neon Postgres persistence (shared across devices)
- Basic audit trail

## Tech Stack
- Backend: Node.js + Express + Neon Postgres (`pg`)
- Frontend: React + Vite (served by Express in production)

## Default Login
- Username: admin
- Password: admin123

Change this account password immediately for production use.

## Neon setup (required)

1. Create a project at [Neon](https://neon.tech).
2. Copy the connection string (prefer the **pooled** URL).
3. In `server/.env` (copy from `server/.env.example`):

```env
PORT=4000
JWT_SECRET=replace-with-a-long-random-secret
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB?sslmode=require
```

On first start the server creates tables and seeds `admin` / `admin123` if that user is missing. Existing SQLite files are not used or migrated.

## Local development

From the repo root:

```bash
npm run install:all
npm install
npm run dev
```

- Frontend: http://localhost:5173  
- Backend: http://localhost:4000  

Both use the same Neon database from `server/.env`, so data stays in sync across machines that share that `DATABASE_URL`.

### Optional LAN UI (API still uses Neon)

1. Find your PC LAN IP (`ipconfig` → IPv4).
2. In `client/.env` set `VITE_API_BASE=http://YOUR_LAN_IP:4000`.
3. Run `npm run dev:lan` and open `http://YOUR_LAN_IP:5173` on a phone on the same Wi‑Fi.

## Deploy on Render (multi-device access)

1. Push this repo to GitHub.
2. Create a **Web Service** on [Render](https://render.com) from the repo.
3. Settings:
   - **Build command:** `npm run build`
   - **Start command:** `npm start`
   - **Environment:**
     - `NODE_ENV=production`
     - `DATABASE_URL` — Neon connection string
     - `JWT_SECRET` — strong random secret
4. Deploy, open the Render URL, and log in as `admin` / `admin123`.

In production the API and UI share the same origin (`VITE_API_BASE` is empty), so any device can use the hosted URL.

## Run separately

**Backend**

```bash
cd server
npm install
npm run dev
```

**Frontend**

```bash
cd client
npm install
npm run dev
```

## Environment
Backend example: `server/.env.example`

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon Postgres connection string (required) |
| `JWT_SECRET` | JWT signing secret |
| `PORT` | API port (default `4000`) |
| `NODE_ENV` | Set `production` on Render to serve the built UI |

Optional frontend override for local/LAN: `VITE_API_BASE=http://localhost:4000`

## App tabs

| Tab | Route | Purpose |
|-----|-------|---------|
| Dashboard | `/` | Smart insights, priority alerts, import shortcut |
| Entry | `/entry` | Create or edit a single asset |
| Import | `/import` | Stepped bulk upload wizard |
| Assets | `/assets` | Browse, filter, export; risk action lists |

Alerts and insight cards open Assets with a risk filter (`?risk=…`). Edits return to that list and refresh counts via a shared data-refresh signal. The Dashboard tab shows a badge when computers need attention.

## Risk priority (computers)

1. Antivirus Expired  
2. Missing Antivirus  
3. Expiring Soon (≤30 days)  
4. Outdated OS (Windows 7 / 8 / 8.1)

## Implemented Categories and Fields
1. Computer:
- Location, Office, Model, Asset No, Serial No, Status
- Location is dropdown: 9th Floor Wing A, 9th floor wing B, 10th floor
- Computer Type dropdown: Desktop or Laptop
- OS Installed dropdown: Windows 7, Windows 8, Windows 8.1, Windows 10, Windows 11
- OS Installed, Office Installed, Antivirus Installed, Wireless Connection Capability
- If Antivirus Installed = true, additional fields appear:
   - Antivirus Type
   - Remaining Subscription Days

2. Software:
- Description, Function, Status

3. UPS:
- Office, Model, Serial No, Status

4. Network Infrastructure:
- Location, Item, Model, Serial No, Status

5. Other Assets:
- Office, Item, Model, Asset No, Serial No, Status

6. Mobile Devices:
- Office, Model, Asset No, Status

7. Printer:
- Location, Office, Model, Asset No, Serial No, Status

## Current Scope
- Manual entry plus file import workflows
- ICT-only access via local accounts
- Category-specific status sets
- Asset No and Serial No enforced unique across all categories
- Smart insights with prioritized alerts and auto-refresh after edits/imports/deletes

## Import Data
- Open the **Import** tab (or the Dashboard import widget).
- Steps: Category → Upload → Mapping → Preview → Result.
- Supported file types: .csv, .xlsx, .xls.
- Column mappings are remembered per category in the browser.
- After import, download a CSV of skipped/blank “needs attention” rows from the Result step.
- Duplicate Asset No / Serial No rows are skipped with warnings; blank required fields are allowed and flagged for follow-up in Assets.
