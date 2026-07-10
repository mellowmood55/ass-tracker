# ICT Asset Tracker (MVP)

LAN-ready asset tracker for ICT teams with:
- Local account login
- Mobile-first tabbed UI (Dashboard, Entry, Import, Assets)
- Category-driven input forms
- Category-specific statuses and validation
- Asset CRUD with search/filter
- Excel and PDF report exports
- Stepped CSV/XLS/XLSX import with column mapping memory
- Priority risk alerts (antivirus + outdated OS)
- SQLite persistence
- Basic audit trail

## Tech Stack
- Backend: Node.js + Express + SQLite (better-sqlite3)
- Frontend: React + Vite

## Default Login
- Username: admin
- Password: admin123

Change this account password immediately for production use.

## Quick start (both apps)

From the repo root:

```bash
npm run install:all
npm install
npm run dev
```

- Frontend: http://localhost:5173  
- Backend: http://localhost:4000  

### Run on a phone (same Wi‑Fi)

1. Find your PC LAN IP (e.g. `ipconfig` → IPv4, such as `192.168.100.37`).
2. In `client/.env` set:
   ```env
   VITE_API_BASE=http://YOUR_LAN_IP:4000
   ```
3. From the repo root:
   ```bash
   npm run dev:lan
   ```
4. On the phone browser open `http://YOUR_LAN_IP:5173`.

Allow Node/Vite through Windows Firewall for ports **4000** and **5173** if prompted.

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
Backend example env file:
- `server/.env.example`

Optional frontend API override:
- `VITE_API_BASE=http://localhost:4000` (use your LAN IP when testing on a phone)

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
