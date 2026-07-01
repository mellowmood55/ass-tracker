# ICT Asset Tracker (MVP)

LAN-ready asset tracker for ICT teams with:
- Local account login
- Category-driven input forms
- Category-specific statuses and validation
- Asset CRUD with search/filter
- Excel and PDF report exports
- Dynamic category-aware CSV/XLS/XLSX import
- SQLite persistence
- Basic audit trail

## Tech Stack
- Backend: Node.js + Express + SQLite (better-sqlite3)
- Frontend: React + Vite

## Default Login
- Username: admin
- Password: admin123

Change this account password immediately for production use.

## Run Backend
1. Open terminal in `server`
2. Install dependencies:
   npm install
3. Start API:
   npm run dev

Backend runs on: http://localhost:4000

## Run Frontend
1. Open terminal in `client`
2. Install dependencies:
   npm install
3. Start app:
   npm run dev

Frontend runs on: http://localhost:5173

## Environment
Backend example env file:
- `server/.env.example`

Optional frontend API override:
- VITE_API_BASE=http://localhost:4000

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
- Smart insights dashboard flags outdated Windows versions and antivirus subscriptions due within 30 days
- Smart insights dashboard now separates Missing Antivirus, Antivirus Expired, and Antivirus Expiring Soon

## Import Data
- Use the Import Data button beside the asset form.
- Supported file types: .csv, .xlsx, .xls.
- The modal shows required headers for the selected category.
- Header mismatch blocks upload with clear error feedback.
- Bulk import is transactional: if one row fails (for example duplicate Asset No or Serial No), the whole batch is rolled back.
