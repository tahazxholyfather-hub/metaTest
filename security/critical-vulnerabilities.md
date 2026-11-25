# Critical vulnerabilities

These are the items that can take the server, the admin panel, or the student database before any other work. Detail and PR #55 mapping are in `security-report.md` and `ledger/findings.json`. Line numbers are `main` at `0ac668a`.

## SEC-007 — `.php` upload on this cPanel account (CONFIRMED, exploited)

`server.js` lines 68–71 save `path.extname(file.originalname)` under `public/avatars`. Apache SSL logs show that path was used: `public_html/avatars/avatar-1793964090912-103811333.php` ran `?cmd=` from 6 Nov 2026 through 18–19 Nov 2026. See `incident-2026-11.md`. The owner’s new `avatars/.htaccess` deny is containment, not a code fix.

PR #55 blocks non-image extensions and checks magic bytes. It still stores files in `public/` and does not disable the PHP handler. Not sufficient. The `.htaccess` in `infrastructure-audit.md` is required even after that PR merges.

## SEC-001 — Secrets in the public git history (CONFIRMED)

`.env` files on `main` contain the GapGPT key, JWT secrets, SMS password, Zarinpal merchant id, payment HMAC, internal service key, and the app token that SEC-006 treats as admin. Masked list is in the 2026-11-25 code audit on PR #55 (`SECURITY_AUDIT.md` on that branch). Do not copy the values into this file. Removing the files does not rotate them.

## SEC-002 — Database dump (CONFIRMED)

`quiz_app(full_Database).txt` is a MariaDB dump with phones, plaintext OTPs, admin password hashes, payments, AI chats, and notes. PR #55 deletes it from the tree. History still serves it.

## SEC-003 — Admin passwords `Admin@1` … `Admin@20` (CONFIRMED)

`adminController.js` `handleAdminLogin`, the password is ``Admin@${adminId}`` for ids 1 through 20. `admin_login` is public. The `tam24_admins` table is not consulted.

## SEC-004 — Admin cookie is unsigned (CONFIRMED)

Same file, `getAdminIdFromRequest` (lines 14–23) accepts `ADMIN-<id>-<timestamp>`.

## SEC-005 — Admin actions do not require that cookie (CONFIRMED)

`Admin_get_question_for_edit` returns answer keys. `Admin_save_curriculum_item` writes the curriculum. `Admin_save_pdf` writes the public PDF directory. `Admin_parse_questions_docx` parses an upload. Any caller who passes `requireToken` can use them.

## SEC-006 — Session forgery (CONFIRMED)

`auth.js` lines 84–101. A base64 JSON object with an `id` becomes that user. The committed `APP_TOKEN` becomes user 1, role `admin`. Together with SEC-007, an anonymous caller can upload `.php`.

PR #55 covers SEC-003, SEC-004, SEC-005, and SEC-006 in code, and deletes the files for SEC-001 and SEC-002. It does not rotate keys, purge history, or add the cPanel PHP deny. Those stay with the owner after Gate 1.
