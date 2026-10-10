# Changelog

All notable changes to Tally. Newest first. The app reads this file: the "What's new" link in Settings shows the latest entries, and a banner appears once after an update.

## Versioning

Versions are `MAJOR.MINOR.PATCH`, counted one step at a time with no skipped numbers. `1.0.0` is the initial release.

- **Patch** (last number +1): fixes and minor refinements.
- **Minor** (middle number +1, patch back to 0): new backward-compatible features.
- **Major** (first number +1, others back to 0): breaking changes.

To add a release: put a new `## version — Tag` block at the top (tag is `Patch`, `Minor` or `Major`), group bullets under `### Added`, `### Improved` or `### Fixed`, and bump `version` in `package.json` and `APP_VERSION` in `public/app.js`.

## 1.19.0 — Minor

### Added
- The landing page has a short description under the title and an animated gradient background (ShaderGradient): a slow, dark purple wave. It loads after the page appears, falls back to a plain gradient without WebGL or with reduced motion, and works offline. The landing page always uses the dark Indigo & coral palette so the text stays readable on it
- A language switch (EN / FR) on the landing page, fully translated. Choosing a language there sets the language of the whole app; after that it is changed in Settings as before
- A custom 404 page for addresses that do not exist, with buttons back to Tally and the home page. Unknown API addresses now answer with a JSON "not found" instead of a web page

### Improved
- The tally-mark animation is now only on the 404 page; the landing page keeps just the gradient

## 1.18.0 — Minor

### Added
- A landing page at the root address, with the Tally logo, a GitHub "View source" button, an "Open Tally" button and an animated row of tally marks along the bottom. It follows the chosen theme and language
- The register itself now lives at /app. Old links and printed QR codes (/#item:…) still work: they are forwarded to the app automatically

## 1.17.0 — Minor

### Added
- CSV import in Settings → Data: add equipment to the inventory from a CSV file, with a preview that flags new, already-present and invalid rows (a template is available to download)
- An Integrations section in Settings with Inventory, Hardware & Ops, People, Calendar and Notifications. They are marked "Coming soon" for now, and an eye button hides or shows the section

## 1.16.1 — Patch

### Improved
- The Tally logo and version in the Settings footer are now the same height as the GitHub button and aligned with it

## 1.16.0 — Minor

### Added
- "What's new" in the Settings footer, with the full changelog
- A one-time banner after an update that links to the changelog

## 1.15.1 — Patch

### Improved
- "Handed over by is required" is now a proper on/off switch with a short explanation

## 1.15.0 — Minor

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

## 1.14.0 — Minor

### Added
- Themes: System, Light, Dark and five colour themes, chosen in Settings → General
- About footer in Settings with an expanding GitHub "View source" button and the version number
- Link preview image and tags, so shared links show the Tally logo

### Improved
- Dropdowns now match the height and style of the other fields

## 1.13.0 — Minor

### Added
- Language switch inside the slip window, so a slip can be printed in French or English

## 1.12.0 — Minor

### Added
- Tally wordmark in the header (light and dark versions) and a full set of app icons
- Install as an app from the browser (web manifest, maskable icon)

## 1.11.0 — Minor

### Added
- The app is now called Tally, with its logo, favicon and name on the page, slip and README

## 1.10.1 — Patch

### Fixed
- Email reminders removed completely, including any stored SMTP settings

## 1.10.0 — Minor

### Added
- Reservations with conflict checks, a calendar tab and a one-click "Convert to loan"

## 1.9.1 — Patch

### Improved
- No QR code per item on the slip
- The "due in 3 days" tile was removed from the register

## 1.9.0 — Minor

### Added
- Logo upload for the slip, printed under the title

## 1.8.0 — Minor

### Added
- History per item and per borrower

## 1.7.0 — Minor

### Added
- Loan extensions
- A QR code on the slip that opens the loan

## 1.6.0 — Minor

### Added
- Several items on one loan slip

## 1.5.0 — Minor

### Added
- Equipment inventory with clickable green and red status dots

## 1.4.1 — Patch

### Fixed
- "HTTP 404" when saving settings after an update; the page now warns when the server is older than the page

## 1.4.0 — Minor

### Added
- French and English interface

## 1.3.0 — Minor

### Added
- Statistics with charts by month, item and borrower

## 1.2.0 — Minor

### Added
- Settings page with pick lists for sites, departments and categories

## 1.1.0 — Minor

### Added
- Notifications bell for loans due soon and overdue

## 1.0.0 — Initial release

### Added
- First release: a shared register of equipment loans with serial numbers, departments and a printable loan slip
