# Contributing to Tally

Thanks for helping. Bug reports, ideas and pull requests are welcome.

## Setup

1. Install Node.js 22.13 or newer.
2. `npm install`
3. `npm start`, then open http://localhost:3000 (data is stored in `data/`; set `DATA_DIR` to use another folder).

The server caches `public/app.html`, `landing.html` and `404.html` at start, so restart it after editing them.

The landing gradient is built separately: edit `tools/gradient/entry.jsx`, then run `npm install && npm run build` inside `tools/gradient`.

## Guidelines

- Keep it simple: Express, built-in `node:sqlite`, vanilla JS. Avoid adding dependencies.
- Every user-facing text goes in `public/i18n.js` in both French and English; server errors use `HttpError(status, fr, en)`.
- Keep the interface accessible: labels on fields, keyboard operation, visible focus, sufficient contrast. Avoid reusing global class names such as `.sw` or `.badge`.
- Test on a phone-width screen and in at least one dark theme.

## Versioning and changelog

Versions are `MAJOR.MINOR.PATCH` with no skipped numbers: patch for fixes, minor for backward-compatible features, major for breaking changes. Add a `## x.y.z — Tag` block at the top of `CHANGELOG.md`, bump `version` in `package.json` / `package-lock.json` and `APP_VERSION` in `public/app.js`, and update the README badge.

## Pull request checklist

- [ ] The app starts and the feature works in the browser, without console errors
- [ ] French and English texts added
- [ ] CHANGELOG and version updated
- [ ] No unrelated changes
