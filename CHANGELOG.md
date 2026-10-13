# Changelog

All notable changes to Tally. Newest first. The app reads this file: the "What's new" link in Settings shows the latest entries, and a banner appears once after an update.

## Versioning

Versions are MAJOR.MINOR.PATCH, counted one step at a time with no skipped numbers. 1.0.0 is the initial release.

- **Patch** (last number +1): fixes and minor refinements.
- **Minor** (middle number +1, patch back to 0): new backward-compatible features.
- **Major** (first number +1, others back to 0): breaking changes.

To add a release: put a new ## version — Tag block at the top (tag is Patch, Minor or Major), group bullets under ### Added, ### Improved or ### Fixed, and bump version in package.json and APP_VERSION in public/app.js.

## 1.10.0 — Minor

### Added
- The Tally helper: a small cube mascot in the bottom-right corner, drawn in vector so it stays sharp and clean on every theme. It peeks over the edge while idle, pops up and waves when you point at it, and after a while on its own it naps, puts on sunglasses or gets to work on a laptop. It blinks, and its eyes follow the pointer
- Click it (or press H) to open a chat panel with quick actions: new loan, what's overdue, what's due soon, find an item or a person by serial number, asset tag or name, today's summary, upcoming reservations, the archive, CSV export, backup and keyboard shortcuts. It also answers common questions (returns, slips, extensions, signatures, archive, backup, reservations, colours, CSV import) and suggests a next step after each answer
- Each answer comes with its own pose and prop: a clipboard for due dates, a magnifier for searches, a chart for the summary, a warning sign for overdue loans, confetti when nothing is late
- The greeting says straight away if loans are overdue, and a counter on the mascot shows how many
- It reacts when a new loan is saved or equipment comes back
- Smart warnings in the new loan form: a "Tally noticed" box points out an item reserved by someone else during the loan or right after it, a borrower who already has an overdue loan, a due date on a weekend, and open notes about one of the items
- Notes in the helper: a wide Notes button at the top of its menu, showing how many notes are open, opens a shared list where you can jot things down, tick them off, edit or delete them, with a clear "Back to chat" button (or Esc) to return. You can also type "note: order HDMI cables" in the chat. Notes are saved on the server, so the whole team sees them, and they are included in backups
- Pinned notes stay at the top of the list, and notes can have a reminder date: on that day they appear in the bell and the helper mentions them
- An Assistant section in Settings, under General, turns the helper on or off. The helper stays out of the way on the Settings page
- A new step in the first-run setup introduces the helper, with a switch to turn it on or off, while the mascot walks in carrying a parcel

### Improved
- The landing page has a new line under the title, "Track who borrowed what, and when it’s coming back.", followed by small icons that take turns: a loop, a box, a checklist and a clock
- English addresses for the tabs: /app#register, #inventory, #calendar and #statistics. The older French ones (#registre, #inventaire, #calendrier) still work and switch to the English address
- The database file is now called tally.db. An existing registre.db is renamed automatically on the first start
- The French subtitle reads "Registre de prêt de matériel" everywhere
- Downloaded files carry the Tally name: the CSV export is tally-YYYY-MM-DD.csv and backups are tally-backup-….db
- Settings → Data is tidier: the notes about backups, CSV import and restoring now sit in an info popup next to the title, and the restore button reads "Restore from a backup (.db)"

### Fixed
- On phones the page no longer scrolls sideways because of hidden table header text

## 1.9.1 — Patch

### Fixed
- The screen loader was replaced with a new, calmer one: a row of bars that rise and fall like a wave. It now covers the whole screen and fades out cleanly, and it stays up just long enough to be seen
- The first animation of the first-run setup now plays in full: the loan slip slides out of the printer and fills in one line at a time. It was being cut short (the slip appeared at once), and it now starts only once the screen loader is gone

## 1.9.0 — Minor

### Added
- Signature on screen: an optional switch in Settings lets borrowers sign the loan and the return on a touchscreen or with a mouse; signatures are stored with the loan and printed on the slip
- Restore from backup in Settings → Data: upload a backup (.db) and Tally merges it in, after saving a safety copy of the current database
- Archive section in Settings: turn archiving on, choose after how many months returned loans are archived, view the archive, download it as a .txt, delete selected archived loans or empty the archive. Archived loans no longer appear in the register, history, statistics or calendar
- Settings navigation: inside Settings the main tabs give way to a Back button (to the Register), a side rail that shows which section you are in as you scroll, and a back-to-top button
- SECURITY.md and CONTRIBUTING.md for the public repository
- An Accessibility section in Settings: text size, higher contrast, reduce motion and a stronger focus outline (saved per browser)
- A screen loader shown while the app loads

### Improved
- The loan slip says Lender instead of IT department, Handed over by is left blank for you to fill in, and the two signature lines now line up when printed
- The Handed over by field no longer says (IT staff) and is no longer pre-filled
- The note about backup files sits beneath the Data buttons
- Accessibility: skip link, keyboard focus kept inside open dialogs and returned afterwards, labelled fields and table headers, screen-reader announcements for messages, and better colour contrast in all themes

### Fixed
- The Register, Inventory, Calendar and Statistics tabs no longer show a stray scrollbar

## 1.8.1 — Patch

### Improved
- The first-run setup card has a different animation on each step: a loan slip printing out (language), a small app window that wears the theme you pick, an organisation badge with a loan-length ring that follows what you type, and a tick that pops in with ripples when everything is ready
- The animations also play when the system has "reduce motion" turned on (only the drifting background and the slide between steps are switched off)

### Fixed
- A tall slip logo no longer spills outside its preview box in Settings: it is now scaled to fit inside it

## 1.8.0 — Minor

### Added
- First-run setup: on a fresh install, an animated card walks through language, theme, organisation name, slip prefix and default loan length. Existing installs skip it
- Sortable columns in the register and the inventory: click a header to sort ascending, again for descending, again to go back to the default order
- An MIT LICENSE file

### Improved
- Messages returned by the server (errors such as "already on loan") now follow the language setting instead of always being in French, and their dates use the chosen date format

## 1.7.0 — Minor

### Added
- Keyboard shortcuts: N for a new loan, item or reservation, / to search, 1 to 4 to switch tabs, comma for Settings, ? for help, arrow keys and T in the calendar, Ctrl/⌘ + Enter to save the open form, Esc to close. They are ignored while you type in a field
- A Help button next to the GitHub button in the Settings footer. It expands to "Help" on hover and opens a window that lists the shortcuts, over an animated gradient
- The landing page has a short description under the title and an animated gradient background (ShaderGradient): a slow, dark purple wave. It loads after the page appears, falls back to a plain gradient without WebGL or with reduced motion, and works offline. The landing page always uses the dark Indigo & coral palette so the text stays readable on it
- A language switch (EN / FR) on the landing page, fully translated. Choosing a language there sets the language of the whole app; after that it is changed in Settings as before
- A custom 404 page for addresses that do not exist, with buttons back to Tally and the home page. Unknown API addresses now answer with a JSON "not found" instead of a web page
- A landing page at the root address, with the Tally logo, a GitHub "View source" button, an "Open Tally" button and an animated row of tally marks along the bottom. It follows the chosen theme and language
- The register itself now lives at /app. Old links and printed QR codes (/#item:…) still work: they are forwarded to the app automatically
- CSV import in Settings → Data: add equipment to the inventory from a CSV file, with a preview that flags new, already-present and invalid rows (a template is available to download)
- An Integrations section in Settings with Inventory, Hardware & Ops, People, Calendar and Notifications. They are marked "Coming soon" for now, and an eye button hides or shows the section

### Improved
- The Help window has a new gradient: a deep purple sphere
- Calmer register rows: one main button (Return, or Slip for returned loans) and a "⋯" menu for the other actions
- The three summary cards in the register are now filters: click "Overdue" to see only the overdue loans
- The tally-mark animation is now only on the 404 page; the landing page keeps just the gradient

## 1.6.1 — Patch

### Improved
- The Tally logo and version in the Settings footer are now the same height as the GitHub button and aligned with it

## 1.6.0 — Minor

### Added
- "What's new" in the Settings footer, with the full changelog
- A one-time banner after an update that links to the changelog

## 1.5.1 — Patch

### Improved
- "Handed over by is required" is now a proper on/off switch with a short explanation

## 1.5.0 — Minor

### Added
- Undo after deleting a loan, an item or a reservation (restored with the same slip number and history)
- Date format setting: DD/MM/YYYY (default), MM/DD/YYYY, YYYY-MM-DD, DD.MM.YYYY or DD-MM-YYYY, applied everywhere including slips and CSV
- Date fields you type in the chosen format, with auto-formatting and a calendar button
- Four more themes: Nord, Graphite, Rose and Mint

### Improved
- Language is now one global setting; the FR / EN buttons are gone from the header and the slip window
- General settings regrouped: language and date format side by side, QR address on its own row with an info icon
- One agreement text for the loan slip instead of separate French and English boxes; the standard text no longer names an organisation
- A fresh install starts empty (no organisation, sites, departments or categories)
- The department is optional while the departments list is empty

## 1.4.0 — Minor

### Added
- Themes: System, Light, Dark and five colour themes, chosen in Settings → General
- About footer in Settings with an expanding GitHub "View source" button and the version number
- Link preview image and tags, so shared links show the Tally logo
- Language switch inside the slip window, so a slip can be printed in French or English
- Tally wordmark in the header (light and dark versions) and a full set of app icons
- Install as an app from the browser (web manifest, maskable icon)
- The app is now called Tally, with its logo, favicon and name on the page, slip and README

### Improved
- Dropdowns now match the height and style of the other fields

## 1.3.1 — Patch

### Fixed
- Email reminders removed completely, including any stored SMTP settings

## 1.3.0 — Minor

### Added
- Reservations with conflict checks, a calendar tab and a one-click "Convert to loan"

## 1.2.0 — Minor

### Added
- Logo upload for the slip, printed under the title
- History per item and per borrower
- Loan extensions
- A QR code on the slip that opens the loan
- Several items on one loan slip
- Equipment inventory with clickable green and red status dots

### Improved
- No QR code per item on the slip
- The "due in 3 days" tile was removed from the register

## 1.1.0 — Minor

### Added
- French and English interface
- Statistics with charts by month, item and borrower
- Settings page with pick lists for sites, departments and categories
- Notifications bell for loans due soon and overdue

### Fixed
- "HTTP 404" when saving settings after an update; the page now warns when the server is older than the page

## 1.0.0 — Initial release

### Added
- First release: a shared register of equipment loans with serial numbers, departments and a printable loan slip
