# Set up a staging site on shared cPanel

Phase 7 (a red-team test of the live site) stays blocked. There is no staging host, and the live site must not be used as one. This is the setup to do in the Pars Web Server panel before any later test.

Do this as a second site. Do not point it at the production database and do not copy the leaked dump onto a public address.

## 1. Subdomain

In cPanel → Domains → Create a new domain, or Subdomains. Use a name that is not the live site, for example `staging.metatest.app`. Turn on the free SSL certificate for that name (Let’s Encrypt / AutoSSL) after the DNS record exists.

## 2. Database

In cPanel → MySQL Databases:

1. Create a new database, for example `user_metatest_staging`.
2. Create a new database user with a new password. Do not reuse the production password.
3. Add the user to that database with all privileges on that database only.

If you need a copy of the shape of the data, export the production schema (tables without rows) from phpMyAdmin and import it into the staging database. Add a few fake students yourself: made-up phone numbers, no real children, no real payment rows, no real voice files. Do not import `quiz_app(full_Database).txt`.

## 3. Files

Copy the application into a folder that belongs to the subdomain, not into the live `public_html`. cPanel usually creates a document root such as `staging.metatest.app` or `public_html/staging`.

Copy the `.htaccess` files from `deploy/cpanel/` into the staging upload folders the same way as production. Do this before you try any upload.

## 4. Node app

cPanel → Setup Node.js App → Create Application.

- Node version: 22 if the panel offers it.
- Application root: the staging folder.
- Application URL: the staging domain.
- Application startup file: the same file production uses (`src/backend/server.js` relative to the app, or whatever the live app’s startup file is).
- Environment variables: new values, not the production ones. At minimum `NODE_ENV=production`, `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` for the staging database, `JWT_SECRET`, `ADMIN_SESSION_SECRET`, `ADMIN_1_PASSWORD`, `INTERNAL_SERVICE_KEY` (at least 16 characters), `PAYMENT_RESULT_SECRET`. Leave the AI and SMS keys empty on staging unless you are testing those features with a separate test account.
- Click Restart after saving.

## 5. Check

Open the staging URL in a browser. Sign in with a fake user. Upload a normal JPEG. It should appear. Do not upload a PHP file to production. On staging, a file whose name ends in `.php` and whose body is the word `FIXTURE` with no PHP tags must be rejected or return 403, and must not print `FIXTURE` as a PHP page.

When that works, Phase 7 can be planned against this host only.
