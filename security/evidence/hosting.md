# Hosting evidence (redacted, no new production requests)

Recorded 2026-11-25. No request was sent to metatest.app for this update.

## Owner statements

- The site is hosted at Pars Web Server (پارس وب سرور).
- The plan is shared cPanel hosting.
- The web server is likely Apache or LiteSpeed, with PHP handlers enabled.
- The Node process is probably started by cPanel “Setup Node.js App” (Phusion Passenger).
- There is no staging environment.

## Earlier observation (already done, not repeated)

A previous check of the live HTTPS response, before this program, reported:

- A Pingora proxy in front of the static SPA.
- No Strict-Transport-Security, Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, or Permissions-Policy.
- `http://metatest.app` returned 500 rather than a redirect to HTTPS.
- `/.env` and `/.git/HEAD` returned 403.
- The TLS certificate was a valid Let’s Encrypt certificate.

How Pingora is wired to the cPanel origin is not in this repository. UNKNOWN. Headers and the HTTP redirect are still missing on the response that was observed, so they have to be set where that response is generated. On this plan that place is cPanel (Apache/LiteSpeed `.htaccess`), not a VPS nginx file.

## What is not in the repo

No Dockerfile, no `docker-compose`, no `.github/workflows`, no `.htaccess`, no Caddy/nginx/Pingora config, no `next.config`. Staging hostname: none.
