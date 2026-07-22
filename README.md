# ICT Asset Tracker (MVP)

Cloud-ready asset tracker for ICT teams with:
- Local account login (JWT)
- Admin and operator roles (operators create/import/read; admins edit/delete/settings)
- Account password change and admin user registration
- Light / dark / system appearance matching the warm forest brand
- Mobile-first tabbed UI (Dashboard, Entry, Import, Assets, Settings)
- Category-driven input forms
- Category-specific statuses and validation
- Asset CRUD with search/filter
- Excel and PDF report exports
- Stepped CSV/XLS/XLSX import with column mapping memory
- Priority risk alerts (antivirus + outdated OS)
- Neon Postgres persistence (shared across devices)
- Admin category field settings (grouped headers, aliases, fixed select values)
- Basic audit trail

## Tech Stack
- Backend: Node.js + Express + Neon Postgres (`pg`) — `apps/api`
- Frontend: React + Vite (served by Express in production) — `apps/web`

## Project structure

```text
ass-tracker/
  apps/
    api/          Express API + Neon Postgres
    web/          React + Vite UI
  package.json    Root scripts (dev, build, start)
  render.yaml     Render deploy config
```

## Default Login
- Username: admin
- Password: admin123

Change this account password immediately for production use (Settings → Account). Register operators under Settings → Users.

### Roles

| Role | Capabilities |
|------|----------------|
| **admin** | Full access: edit/delete assets, category fields, register users |
| **operator** | Create assets, import, view assets/reports/insights/audit; cannot edit or delete |

### Concurrent entry and duplicates

- **First write wins** for the same non-blank Asset No or Serial No (enforced by Postgres unique indexes).
- A later Entry submitter receives a clear **409** toast (e.g. “This Asset No already exists.”). Admins also get an **Open existing** shortcut.
- Import soft-skips duplicate rows (including races with another user’s create) and continues the rest of the batch.
- Identity values are trimmed before save so surrounding spaces do not create false “unique” tags.

## How to run (new setup)

### 1. Neon env (required)

1. Create a project at [Neon](https://neon.tech).
2. Copy the **pooled** connection string from the Neon dashboard.
3. Create `apps/api/.env` (copy from `apps/api/.env.example`):

```env
PORT=4000
JWT_SECRET=replace-with-a-long-random-secret
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB?sslmode=require
```

Without `DATABASE_URL`, the API will refuse to start. On first start the API creates tables and seeds `admin` / `admin123` if that user is missing. Existing SQLite files are not used or migrated.

### 2. Install and start (from repo root)

```powershell
npm run install:all
npm install
npm run dev
```

Then open:
- UI: http://localhost:5173
- API: http://localhost:4000

Login: **admin** / **admin123** (empty inventory on first start).

Both apps use the same Neon database from `apps/api/.env`, so data stays in sync across machines that share that `DATABASE_URL`.

### 3. If something fails

| Symptom | Fix |
|--------|-----|
| `DATABASE_URL is required` | Add `apps/api/.env` with a real Neon URL |
| Connection / SSL errors | Use Neon’s pooled URL and keep `?sslmode=require` |
| Old `server/` or `client/` paths | Use `apps/api` and `apps/web` only |
| Port in use | Stop the old process or change `PORT` in `.env` |
| `Cannot find module '@rolldown/binding-…'` / Vite native binding error | Delete `apps/web/node_modules`, run `npm install --prefix apps/web`, then `npm run dev` again. If it persists, also delete `apps/web/package-lock.json` and reinstall. |
| Default `admin` / `admin123` login fails | The Neon `admin` password was changed. From repo root run `npm run reset-admin --prefix apps/api`, or set `RESET_DEFAULT_ADMIN_PASSWORD=true` in `apps/api/.env`, restart the API once, then remove that line. |
| Entry/Import fields look outdated after editing settings | Save in **Settings**, then refresh Entry or Import. Category config is loaded from the API on each page load. |

### Category field settings

Admins can open **Settings** (gear beside the signed-in user, or the Settings tab on mobile) to edit fields per category:

- Add/remove custom fields and groups (locked system fields cannot be removed)
- Mark fields as required
- Set fixed values for select fields
- Add import aliases for spreadsheet column matching

Computer imports and templates support **two-row grouped headers** (group row + subheader row), for example `Operating System` above `Operating System Version` and `Wi-Fi Drivers`.

## Office LAN deploy (recommended for ICT office)

Use this when staff on the same Wi‑Fi / Ethernet should open the app in a browser **without** running `npm run dev`. One host PC runs a single production server (API + built UI on port **4000**). The database still uses Neon, so that PC needs internet.

### 1. Prepare the host PC

1. Choose a desktop that stays on during office hours.
2. Install [Node.js 20+](https://nodejs.org/) if needed.
3. Clone or pull this repo (e.g. `C:\Users\mello\projects\ass-tracker`).
4. Ensure `apps/api/.env` has:

```env
PORT=4000
NODE_ENV=production
JWT_SECRET=replace-with-a-long-random-secret
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB?sslmode=require
```

5. Note the PC’s LAN IPv4 (`ipconfig`). Reserve that address in the router DHCP so it does not change.
6. Change the default admin password (Settings → Account) and register operators (Settings → Users).

### 2. Build once (and after every `git pull`)

Double-click **`build-office.cmd`**, or from the repo root:

```powershell
npm run install:all
npm run build
```

### 3. Start the office server

Double-click **`start-office.cmd`**, or:

```powershell
$env:NODE_ENV="production"
$env:HOST="0.0.0.0"
npm start
```

Leave that window open (or use Task Scheduler below).

### 4. Allow LAN access (Windows Firewall)

On the **host PC**, in an elevated PowerShell:

```powershell
New-NetFirewallRule -DisplayName "ICT Asset Tracker" -Direction Inbound -Protocol TCP -LocalPort 4000 -Action Allow
```

### 5. What staff do

On any office device, open:

`http://HOST-LAN-IP:4000`

Example: `http://192.168.1.50:4000`

Bookmark that URL or add a desktop shortcut. No Node install is required on staff machines.

### 6. Auto-start after reboot (Task Scheduler)

1. Create a task that runs at logon (or startup).
2. Action: start `C:\Users\mello\projects\ass-tracker\start-office.cmd`
3. Optionally set “Start in” to the repo folder.

For a always-on Windows **service**, use [NSSM](https://nssm.cc/) pointing at `node` with `apps\api\src\index.js`, working directory `apps\api`, and the same env vars as `.env` / `NODE_ENV=production` / `HOST=0.0.0.0`.

### 7. After code updates

On the host PC only:

```powershell
git pull origin main
build-office.cmd
```

Then restart `start-office.cmd` (or the scheduled task / service).

### Dev-only LAN preview (not for daily office use)

For quick testing with hot reload:

1. Find your PC LAN IP (`ipconfig` → IPv4).
2. In `apps/web/.env` set `VITE_API_BASE=http://YOUR_LAN_IP:4000`.
3. Run `npm run dev:lan` and open `http://YOUR_LAN_IP:5173`.

Prefer **`build-office.cmd` + `start-office.cmd`** for real office use.

## Deploy on Render (internet / multi-site access)

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

**API**

```bash
cd apps/api
npm install
npm run dev
```

**Web**

```bash
cd apps/web
npm install
npm run dev
```

## Environment
Backend example: `apps/api/.env.example`

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon Postgres connection string (required) |
| `JWT_SECRET` | JWT signing secret |
| `PORT` | API port (default `4000`) |
| `HOST` | Bind address (default `0.0.0.0` in production for LAN) |
| `NODE_ENV` | Set `production` to serve the built UI from Express |

Optional frontend override for local/LAN **dev** only: `VITE_API_BASE=http://localhost:4000`

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
