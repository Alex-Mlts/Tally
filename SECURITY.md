# Security Policy

## Supported versions

Only the latest release of Tally receives security fixes. Please update before reporting.

## Reporting a vulnerability

Please do **not** open a public issue for security problems. Use GitHub's private "Report a vulnerability" option (Security tab of the repository), or contact the maintainer by email through the address on the GitHub profile. Include the version, steps to reproduce and the impact. You can expect an acknowledgement within a few days and a fix or a plan as soon as practical.

## Deploying safely

- Tally has no user accounts. Set `AUTH_USER` and `AUTH_PASS` to enable HTTP Basic authentication, and always serve it over HTTPS (for example behind a reverse proxy), since Basic credentials are otherwise sent in clear text.
- Do not expose Tally directly to the internet without authentication.
- Backup files (.db) contain every loan, borrower name and signature. Store them as carefully as the live database, and delete copies you no longer need (including `before-restore-*.db` safety copies in the data folder).
- Keep Node.js up to date (≥ 22.13).
