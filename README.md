# El Oued Pesticide Management Platform (Local Prototype)

Local-only prototype for pesticide inventory, treatments, TFI, alerts, reports and oversight in El Oued Province, Algeria. Runs entirely on your computer with JSON file storage.

## Stack
- Frontend: React 19, TypeScript (strict), Vite, Tailwind CSS, React Router 7, React Hook Form + Zod, Recharts, React Leaflet + Leaflet, Lucide React
- Backend: Express 4 (TypeScript, tsx), CORS, Zod
- i18n: English/French/Arabic with RTL support
- Tests: Vitest + React Testing Library (jsdom)
- Exports: CSV, XLSX (write-excel-file), PDF via browser print

## Prerequisites
- Node.js (LTS recommended)
- On Windows PowerShell, use `npm.cmd` if script execution is restricted

## Installation
```bash
npm.cmd install
```

## Development
Run API and web together:
```bash
npm.cmd run dev
```
- API: http://127.0.0.1:4000 (bound to localhost only)
- Web (Vite): http://127.0.0.1:5173 (proxies `/api` to API)

Or run separately:
```bash
npm.cmd run dev:server
npm.cmd run dev:web
```

## Build and Production
Typecheck, build, and run the production server (serves built `dist/` statically):
```bash
npm.cmd run build
npm.cmd start
```
App available at http://127.0.0.1:4000

## Demo Identities (role simulation, not secure auth)
Use the login screen's "Demo access" or header role switcher. All are fictional.

| User ID | Name | Role | Scope |
|---------|------|------|-------|
| U-DSA-001 | Amine Belhadj | DSA Administrator (full access) | All communes |
| U-CHM-001 | Nadia Khelifi | Chamber Admin (read-only) | Guemar, Debila, Robbah |
| U-FRM-001 | Youcef Benali | Farmer (own records only) | Own farmer profile (FRM-001) |

Default season: `SSN-2026`. Demo farmer owns `HLD-001` (Oasis Benali) with plots/crops.

## Data Directory
Runtime data is stored under `data/` (gitignored):
- `data/users.json`, `data/registration-requests.json`
- Domain collections (farmers, holdings, plots, crops, seasons, pesticides, inventory movements, treatments, alerts, audit-log, settings, tfi-config)
- Backups created on reset/import as `pre-reset-<timestamp>.json` or import safety copies
- `data/demo-seed/` contains the initial seed data (copied on first run)

No data is sent externally. All operations are local.

## Backup, Restore, Reset
- **Export backup (API/UI)**: DSA can export a validated JSON backup. Format includes `format: "el-oued-json-backup"`, `version`, `exportedAt`, `data`.
- **Import backup (API/UI)**: Requires confirmation `confirm: "IMPORT_BACKUP"`. A pre-import safety copy is created automatically. Validation is strict (schema/version/checksums). Invalid backups are rejected (422).
- **Demo reset (API/UI)**: Requires confirmation `confirm: "RESET_DEMO"`. Creates a `pre-reset-...json` safety backup and restores from demo seed.

## Manual Copy Instructions
To back up manually:
1. Stop the server
2. Copy the entire `data/` directory to another location (e.g., external drive/backup folder)
3. Restart the server

To restore manually:
1. Stop the server
2. Replace `data/` with your backup copy (ensure file structure matches)
3. Restart the server

## Security Notes (Important)
- **Local only**: Server binds to `127.0.0.1`. No remote access intended.
- **Demo auth**: Authentication is simulated via headers (`x-user-id`, `x-user-role`) for prototyping. It is **not secure** for production use.
- **Permissions**: Enforced server-side and client-side. Chamber is read-only; Farmers are scoped to their own records. Reports/audit/registrations/backup are restricted by role.
- **No external calls**: Map uses OpenStreetMap tiles (requires internet for tiles; table/list remains available offline). Coordinates in demo data are fictional.
- **No conversions**: Stock uses transaction ledger only; no mass↔volume conversions. Negative stock is rejected.
- **TFI**: Uses provisional/demo methodology (`demo-1.0`), labeled as such, with no official thresholds.

## Testing
```bash
npm.cmd run test
```
Covers permissions/scoping, registration approval/admin creation, inventory ledger/unit rules/negative stock, treatments (create/update/reverse), TFI, alerts, JSON init/restart/invalid recovery, backup validation/restore, reports/exports, audit, and i18n/RTL.

## Typecheck and Build
```bash
npm.cmd run typecheck
npm.cmd run build
```

## Limitations
- Local prototype only; not an official government system
- Demo data is fictional; no verified pesticide registrations/doses/PHI/REI are guaranteed
- Authentication/authorization are simulated (not production-grade)
- Map tiles require network connectivity; coordinates are fictional
- Large bundle size warning may appear in build (expected for this prototype)
- Some UI flows may behave differently in different browsers
