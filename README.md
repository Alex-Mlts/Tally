<p align="center"><img src="public/tally-wordmark-dark.png" alt="Tally" height="64"></p>

# Tally

A self-hosted equipment-loan register for an IT department. Tally records who borrowed what (with serial numbers, department and site), tracks returns, extensions and reservations, and prints a loan slip to be signed.

*Version 1.19.0*

## Features

- **Register**: current loans, overdue loans, returns (item by item), extensions, loan slips, CSV export
- **Inventory**: your equipment with a status dot (green = available, red = on loan, click to toggle); add, edit and delete items; full history for each item
- **Calendar**: monthly view of loans (blue; red when overdue; grey when returned) and reservations (purple). Click a day to create a reservation; reservations can be converted into loans
- **Statistics**: loans per month, per item (article or category) and per borrower (person or department), filterable by period and site
- **Settings** (gear icon): organisation and department names, language, date format, **theme**, default loan length, "due soon" threshold, slip prefix, slip logo, pick lists (sites, departments, categories), slip agreement text, database backup
- **Notifications** (bell): loans due within 2 days, overdue loans and reservations to prepare; the badge counts alerts not yet seen on this browser
- **Multi-item loans**: one slip can cover several items, picked from the inventory or typed in by hand. The server refuses to lend an item that is already out
- **Loan slip**: printable A4, numbered `PR-YYYY-NNNN` (never reused), with a QR code that opens the loan, your logo under the title, an items table, borrower details, agreement text, signature boxes and a return section. The slip is printed in the app language chosen in Settings
- **History**: click a serial number or a borrower to see everything they have had or borrowed
- **Bilingual interface**: French and English. The language is one global setting (Settings → General) and applies to the whole app and the printed slip. Equipment conditions are a fixed list, translated in both languages
- **Date format**: DD/MM/YYYY by default; choose MM/DD/YYYY, YYYY-MM-DD, DD.MM.YYYY or DD-MM-YYYY in Settings. It applies everywhere, including the date fields, slips and CSV export
- **Undo**: deleting a loan, an item or a reservation shows an "Undo" button for a few seconds; the item comes back exactly as it was (same slip number, same history)
- **Themes**: System (follows the device), Light, Dark and nine colour themes (Indigo & coral, Ocean, Forest, Sunset, Mocha, Nord, Graphite, Rose, Mint). Pick one in Settings → General; it applies to everyone
- **About footer**: version number and an expanding GitHub button ("View source") at the bottom of Settings. The repository link is the `repository.url` field in `package.json`
- **Link preview**: sharing the server address in a chat app shows a card with the Tally logo (Open Graph tags; the image is served from `/og-image.png`)
- **What's new**: the Settings footer has a "What's new" link showing the latest entries of `CHANGELOG.md`, and a banner appears once in each browser after an update. The file is read from your own server, so it works offline
- **Installable**: Tally can be installed as an app from the browser (Chrome / Edge: "Install Tally"; iPhone: "Add to Home Screen")

### Reservations

An inventory item can be reserved for a period. The server refuses:

- two overlapping reservations,
- a reservation on equipment that is still on loan (or overdue) on those dates,
- a loan or extension that would run into someone else's reservation.

"Convert to loan" pre-fills the loan form and marks the reservation as converted.

A fresh install starts empty: no organisation name, sites, departments or categories. Fill them in under Settings. (To reset an existing install completely, stop the server and delete `data/registre.db`.)

## Quick start

```bash
npm install
npm start            # http://localhost:3000
```

Requires **Node 22.13 or newer** (Node 24 recommended). Tally uses the built-in `node:sqlite` module, so no native dependency or build tools are needed. Node may print an "SQLite is an experimental feature" warning on start-up; it is harmless.

Stack:

- Backend: Node.js + Express, data in a single SQLite file (`data/registre.db`)
- Frontend: plain HTML / CSS / JS, no framework (`public/`)

## Releasing a new version

1. Pick the next number (no skipping): **Patch** (last number +1) for fixes and minor refinements, **Minor** (middle number +1, patch back to 0) for new backward-compatible features, **Major** (first number +1) for breaking changes. `1.0.0` was the initial release.
2. Add a block at the top of `CHANGELOG.md`: `## 1.18.1 — Patch`, then bullets under `### Added`, `### Improved` or `### Fixed`.
3. Bump `version` in `package.json` and `APP_VERSION` in `public/app.js` (the page and server compare them and warn if they differ).

## Updating

Stop the server, replace the files, run `npm install`, then `npm start`. Your data in `data/` is never touched by an update.

- **From v1.5.0 onwards**: no extra steps. Your saved settings, pick lists and slip text are kept (a French and an English slip text from older versions are merged into the single text for your language).
- **From before v1.5.0** (no inventory yet): on first start, existing loans are converted and every serial number already on loan becomes an inventory item. Back up `data/registre.db` first.

After an update, hard-refresh the browser (Ctrl+F5) so it picks up the new files. If the page shows an "outdated server" banner, the old server process is still running: stop it and start it again.

## Configuration

Environment variables:

| Variable    | Default   | Purpose                                                          |
|-------------|-----------|------------------------------------------------------------------|
| `PORT`      | `3000`    | HTTP port                                                        |
| `DATA_DIR`  | `./data`  | Folder holding `registre.db`                                     |
| `AUTH_USER` | *(empty)* | Enables HTTP Basic authentication when set together with `AUTH_PASS` |
| `AUTH_PASS` | *(empty)* | Basic-auth password                                              |

Without `AUTH_USER` / `AUTH_PASS`, anyone who can reach the port can read and edit the register. Keep it on the internal network, or put it behind a reverse proxy (nginx, Caddy) with HTTPS.

For QR codes on the slip to open on phones, set **Registry address for QR codes** in Settings (for example `http://srv-tally:3000`).

## Docker

```bash
docker build -t tally .
docker run -d --name tally -p 3000:3000 \
  -v tally-data:/data \
  -e AUTH_USER=it -e AUTH_PASS='change-me' \
  --restart unless-stopped tally
```

## Backup

All data lives in `DATA_DIR/registre.db`. Use **Download a backup** in Settings (or `GET /api/backup`) for a consistent copy without stopping the server. From the command line:

```bash
sqlite3 data/registre.db ".backup 'tally-$(date +%F).db'"
```

**Landing page**: `/` shows a landing page with an "Open Tally" button and an EN / FR switch (it sets the app language, the same setting as in Settings); the register is at `/app`. Links such as `/#item:SERIAL` (printed QR codes) are forwarded to the app, so nothing already printed breaks.

**404 page**: unknown addresses show a branded "Page not found" page (`public/404.html`); unknown `/api/…` addresses return JSON.

**Landing gradient**: the animated background uses [ShaderGradient](https://github.com/ruucm/shadergradient) (MIT). It is prebuilt into `public/vendor/shadergradient.js`, with its lighting images in `public/vendor/hdr/`, so nothing is fetched from the internet. To change the colours or motion, edit `tools/gradient/entry.jsx`, run `npm install` and `npm run build` in `tools/gradient`, and the file is rebuilt.

**CSV import** (Settings → Data) adds equipment to the inventory. Recognised columns: name, category, serial number, asset tag, site, notes (English or French headers; `;`, `,` or tab separators). A preview flags new, already-present and invalid rows; serial numbers already in the inventory are skipped. A template can be downloaded from the same panel.

**Integrations** (Settings) lists the planned categories — Inventory, Hardware & Ops, People, Calendar, Notifications — as "Coming soon". The section can be hidden with the eye button.

The CSV export (one row per item, `;` separator, UTF-8 with BOM) also opens cleanly in Excel and works as a readable backup.

## Usage

1. **New loan**: enter the equipment, borrower, department and dates. The slip opens immediately.
2. **Print** the slip in two copies and have it signed.
3. **Return**: enter the return date and the condition of each item.
4. Overdue loans are shown in red. The list refreshes every 30 seconds to show colleagues' changes.

## API

| Method | Route                          | Purpose                                      |
|--------|--------------------------------|----------------------------------------------|
| GET    | `/api/version`                 | Server version                               |
| GET    | `/api/loans`                   | All loans                                    |
| POST   | `/api/loans`                   | Create a loan (assigns the slip number)      |
| PUT    | `/api/loans/:id`               | Edit a loan                                  |
| POST   | `/api/loans/:id/return`        | Record a return                              |
| POST   | `/api/loans/:id/extend`        | Extend (`dueDate`, `reason`)                 |
| DELETE | `/api/loans/:id`               | Delete a loan                                |
| GET    | `/api/equipment`               | Inventory, with the current loan             |
| POST   | `/api/equipment`               | Add an item                                  |
| PUT    | `/api/equipment/:id`           | Edit an item                                 |
| POST   | `/api/equipment/:id/status`    | Available / on loan (`status`)               |
| DELETE | `/api/equipment/:id`           | Delete (refused if on loan or reserved)      |
| GET    | `/api/reservations`            | All reservations                             |
| POST   | `/api/reservations`            | Create (`borrower`, `department`, `startDate`, `endDate`, `items: [{equipmentId}]`) |
| PUT    | `/api/reservations/:id`        | Edit an active reservation                   |
| POST   | `/api/reservations/:id/cancel` | Cancel                                       |
| DELETE | `/api/reservations/:id`        | Delete                                       |
| GET    | `/api/settings`                | Shared settings                              |
| PUT    | `/api/settings`                | Update settings                              |
| GET / PUT / DELETE | `/api/logo`        | Slip logo                                    |
| GET    | `/api/backup`                  | Download a copy of the database (.db)        |

Creating a loan takes `borrower`, `department`, `loanDate`, `dueDate` (format `YYYY-MM-DD`) and `items`, a list of `{equipmentId}` or `{item, serial, category, assetTag, accessories, conditionOut, addToInventory}` objects. A return takes `{returnDate, items: [{id, conditionIn, returnNotes}]}`. To convert a reservation, add `reservationId` when creating the loan.

## Future additions

- **Email reminders (SMTP)**: automatic emails to borrowers before a loan is due and when it is overdue, plus a heads-up for upcoming reservations, sent through the organisation's own SMTP server. (An early version was built and then removed; it will return as an optional, opt-in feature with SMTP settings in the Settings page.)
- **Signature on screen**: sign the loan and return on a touchscreen or with a mouse instead of on paper, with the signature stored with the loan and shown on the printed slip.
