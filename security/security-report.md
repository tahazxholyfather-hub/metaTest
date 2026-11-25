# Security report — Gate 1

Date: 2026-11-25. Commit reviewed: `0ac668a` (`main`). This branch adds documents only. PR #55 is open and was not changed.

The earlier code audit is reused here. Each of its findings was re-read on `main` and given an id. New work is the upload/RCE verdict for shared cPanel, and the ledger.

## Executive summary

metatest.app is a Vite student app and an Express API on shared cPanel at Pars Web Server, with PHP enabled and Node probably under Passenger. There is no staging site.

The most urgent code defect is the profile upload: it stores the caller’s file extension under `public/avatars`. On this host that is a likely PHP shell, not a theoretical one, and not a false positive. It is not proven, because the document root is not in the repository and production was not probed (SEC-007).

Independently, the public git history contains live API keys, the SMS password, JWT secrets, and a database dump of student phones, one-time codes, payments, and AI chats (SEC-001, SEC-002). Admin login is `Admin@1` through `Admin@20` with an unsigned cookie, and several admin actions never check that cookie (SEC-003, SEC-004, SEC-005). A base64 blob is accepted as a session (SEC-006). Those four make SEC-007 reachable without an account.

PR #55 fixes the authentication and authorization bugs in code and deletes the secret files from the tree. It does not rotate anything, does not purge history, and does not meet the upload design. The cPanel `.htaccess` files in `infrastructure-audit.md` are still required.

Do not start Phase 7 until a staging cPanel host exists. There is not one today.

## RCE investigation

**Verdict: LIKELY remote code execution. Not confirmed. Not a false positive.**

Evidence, all static:

- `metatest/src/backend/server.js` lines 57–71 and 75–78. Multer disk storage, no `fileFilter`. The stored name is `avatar-<time>-<rand>` plus `path.extname(file.originalname)`. A body part named `photo.php` is written as `avatar-….php`.
- The directory is `path.resolve(__dirname, '../../public/avatars')` → `metatest/public/avatars`.
- `express.static('public')` (line 93) serves files. Node does not execute PHP. There is no `child_process`, no `eval`, and no PHP file in the repo.
- Owner, this program: shared cPanel, Apache or LiteSpeed, PHP handlers on, Node via “Setup Node.js App” / Passenger. On that stack the web server handles `.php` itself when the file sits in the document root.
- The document-root mapping is not in git. If `public/` is that root, or is under `public_html`, the file runs. That is the normal cPanel layout for this app. It was not observed.

Stored XSS via `.html` or `.svg` in the same function is confirmed and does not need PHP (same finding).

PR #55 adds an image allow-list and magic-byte check. It still writes into `public/avatars`, does not re-encode with `sharp`, does not move storage outside the web root, and does not disable PHP. Rejecting `.php` in Node is necessary and not sufficient: a missed extension (`php5`, `phtml`, `phar`) or a later upload path still runs if the handler is on. Put the upload `.htaccess` from `infrastructure-audit.md` in place even if PR #55 merges.

## Confirmed

Critical: SEC-001 secrets, SEC-002 dump, SEC-003 admin passwords, SEC-004 forgeable admin cookie, SEC-005 admin actions without an admin check, SEC-006 forged session.

High: SEC-008 body `user_id` overrides the session, SEC-009 quiz result without membership, SEC-010 OTP and SMS pumping, SEC-011 no security headers on the live document, SEC-012 HTTP 500 instead of HTTPS redirect, SEC-013 question HTML injected into the page, SEC-014 session cookie readable by script, SEC-015 internal routes fail open when the key is empty and also accept that key on `x-app-token`, SEC-025 known-vulnerable dependencies (npm audit).

Medium: SEC-016 session check fails open, SEC-017 30-day JWT, SEC-018 50 MB body and no global rate limit, SEC-019 AI files under `public/uploads`, SEC-020 payment callback does not bind `Authority`, SEC-021 coupon count race, SEC-022 paid AI coins ignore plan expiry, SEC-023 unbounded manual task progress, SEC-024 client-supplied practice stats, SEC-026 tracked `node_modules`, SEC-028 lobby JWT default is a public string, SEC-034 `DEV_MODE` skips auth, SEC-036 PDF bytes are not checked (extension is forced to `.pdf`, so this is not the PHP bug).

Low: SEC-027 SQL errors returned to the client, SEC-029 password compare not constant-time, SEC-030 some cookies lack `Secure` / `SameSite`.

Informational: SEC-031 CORS is localhost unless configured, SEC-033 `guest_login` is not in the public action list so the client call fails closed.

## Suspected

SEC-007, above. The write is confirmed. Execution is likely and not observed.

SEC-035. `ORDER BY FIELD(q.id, ${ids})` interpolates a JSON list. The only writer found stores ids the server selected. Attacker control of that string was not shown.

## False positives

SEC-901. “This is a Next.js middleware / RSC bug.” The app is Vite. `next-themes` is not Next.js.

SEC-902. “Redis `pipeline.exec()` is a shell.” It is the Redis client.

SEC-903. “The PDF upload is PHP RCE.” The name is forced to `.pdf`. A polyglot is not executed as PHP. The missing magic check is SEC-036, not SEC-007.

SEC-904. “Curriculum SQL is injection.” The table name comes from a fixed map, not from the client string. The authorization hole is SEC-005.

## PR #55, change by finding

Approve or reject each row. The PR is not merged.

| ID | What PR #55 does | Enough? |
| --- | --- | --- |
| SEC-001 | Deletes tracked `.env` files, adds examples and `.gitignore` | No. Rotate and purge history |
| SEC-002 | Deletes the SQL dump from the tree | No. Purge history |
| SEC-003 | Admin password only from the environment | Yes, after new passwords are set. Breaking: `Admin@N` stops working |
| SEC-004 | HMAC admin cookie | Yes. Breaking: current admin cookies die |
| SEC-005 | `requireAdmin` on the admin handlers that lacked it | Yes, once SEC-004 is in |
| SEC-006 | JWT only. Guest login issues a JWT | Yes. Breaking: old base64 guest tokens die |
| SEC-007 | Image extension and magic bytes | **No.** See the upload document |
| SEC-008 | Session id, not body `user_id` | Yes for the handlers it edits |
| SEC-009 | Both users must be quiz members | Yes. Members can still open each other’s result |
| SEC-010 | Rate limit. Still 4 digits | Partial |
| SEC-011 | Headers on Express responses only | **No.** cPanel `.htaccess` for the document |
| SEC-012 | Nothing | No |
| SEC-013 | Nothing | No |
| SEC-014 | `SameSite` and `Secure` on some writers. Cookie stays readable | Partial |
| SEC-015 | Internal key required, only on `x-internal-service-key` | Yes, after the key is rotated |
| SEC-016 | Nothing | No |
| SEC-017 | Nothing | No |
| SEC-018 | Nothing | No |
| SEC-019 | Nothing | No |
| SEC-020 | Authority must match. Removes the hardcoded payment-secret fallback | Yes. Breaking if the secret is unset: result pages error |
| SEC-021 | Nothing | No |
| SEC-022 | Nothing | No |
| SEC-023 | Nothing | No |
| SEC-024 | Nothing | No |
| SEC-025 | `npm audit fix` without `--force` | Partial |
| SEC-026 | Stops tracking `node_modules` | Yes |
| SEC-027 | Generic error strings | Yes |
| SEC-028 | `JWT_SECRET` required, length at least 32 | Yes. Breaking if unset: lobby will not boot |
| SEC-029 | `timingSafeEqual` | Yes |
| SEC-030 | Cookie flags on the writers that lacked them | Yes for those writers |
| SEC-031 | `CORS_ORIGINS`, default unchanged | Yes |
| SEC-033 | Nothing | n/a |
| SEC-034 | `DEV_MODE` only from localhost | Yes |
| SEC-035 | Integers only in the `FIELD()` list | Yes as hardening |
| SEC-036 | Rejects PDF bytes that do not start with `%PDF-` | Yes for that path |
| SEC-901–904 | Nothing | Correct to leave |

Breaking changes if #55 merges: every student must sign in again after the JWT secret is rotated; admins must use new passwords; the lobby refuses to start without `JWT_SECRET`; payment result tokens fail if `PAYMENT_RESULT_SECRET` and `JWT_SECRET` are both empty. Set the new values in the cPanel Node.js App screen before the deploy. Do not paste the old values from git.

## Required hosting changes

cPanel on Pars Web Server. No VPS config.

Full text, including both `.htaccess` files, is `infrastructure-audit.md`. Short form:

1. Fix the port-80 500 using the cPanel error log, then one HTTPS redirect (panel “Force HTTPS” **or** the rewrite, not both).
2. Document-root `.htaccess`: HSTS, nosniff, frame denial, referrer policy, permissions policy, a CSP you have tried in report-only mode, `Options -Indexes`.
3. A second `.htaccess` in `public/avatars`, `public/uploads`, and `public/files/pdfs` that denies `.php`, `.phtml`, `.phar`, and the other script extensions, turns the PHP engine off for Apache and LiteSpeed, and sets nosniff.
4. Put secrets in the Node.js App environment. `NODE_ENV=production`.
5. Create a staging subdomain that is not `metatest.app` before any retest. Do not restore the leaked dump there.

If the Pingora front door drops these headers, repeat the header list there. The PHP deny has to be on the cPanel origin or it does nothing.

## Regression tests (Phase 7, staging only)

Authz matrix, one row per role (anonymous, student, other student, admin):

- `POST /api/flow` `admin_login` with `Admin@1` must fail after SEC-003.
- `Admin_get_question_for_edit` as a student must fail.
- `Admin_save_pdf` as a student must fail.
- A base64 JSON `x-app-token` must be 401.
- Practice `checkAnswer` with someone else’s `user_id` must store the session user.
- Quiz result for a quiz the caller is not in must be 403. A member opening another member must still work.
- OTP: a sixth send inside the window must fail. Eight bad codes must invalidate the code.

Upload fixtures, staging only, never production:

- JPEG, PNG, WebP succeed with a server-chosen name.
- A file named `x.php` whose body is the text `FIXTURE` and no PHP tags is rejected by the app, or, if it was written before the app check, the web server returns 403. A 200 that prints `FIXTURE` means PHP handled the file.
- The same test for `.phtml` and `.phar`.
- After a real image upload, the stored file is a re-encoded image. This fails on PR #55 today and should stay a failing test until the full SEC-007 design exists.

## Roadmap

Now, before any deploy: rotate every secret in SEC-001, set new admin passwords, add the upload `.htaccess`, take the SQL dump and `.env` blobs out of git history. Effort: small for the `.htaccess` and the password, operationally careful for rotation and history.

Within 7 days, after Gate 1 approval: merge the PR #55 rows marked “Yes”, create the staging subdomain, confirm in File Manager whether `public/avatars` is inside the document root. Effort: one deploy plus a cPanel check. Do not call that Phase 7.

Within 30 days: finish SEC-007 (re-encode, outside the web root), CSP in enforcing mode, six-digit OTP, HttpOnly session design, plan-expiry check on AI coins, coupon conditional update, cap task progress. Effort: these touch login, payments, and uploads. They need staging.

Backlog: shorten JWT life, fail closed on the session-replacement check, global rate limit, move AI files off the public disk, dependency majors (Firebase, sharp, shadcn), delete the duplicate tree at the repo root.

## Effort

The cPanel files are a short change with a high chance of locking PHP out of the wrong directory if they are pasted into the document root instead of the upload folders. Read `infrastructure-audit.md` before pasting. History purge and key rotation are the long pole, not the diff size. No person-week estimate is honest until the owner confirms the document root in File Manager.
