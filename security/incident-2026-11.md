# Incident 2026-11 — webshell on metatest.app

Source: the owner's Apache SSL access logs. Times are UTC+0330. This note does not repeat command output or any secret value. No new request was sent to the site for this write-up.

Status: the upload bug is SEC-007, now CONFIRMED and exploited. The secrets that were read are SEC-001, now confirmed exfiltrated from the live server as well as from git. The public reverse proxy is SEC-037.

## What happened

On 6 November 2026 an attacker uploaded PHP through `POST /api/upload_avatar`. The file landed at `public_html/avatars/avatar-1793964090912-103811333.php`. Apache (or LiteSpeed) executed it. About 480 requests with `?cmd=` hit that file from about 15 addresses, continuing through 18–19 November 2026.

The application code that allowed the upload is `metatest/src/backend/server.js` lines 68–71: the stored name keeps the client's extension and the directory is the public avatar folder. Node did not run the file. The cPanel PHP handler did.

## Timeline

| When (UTC+0330) | What the logs show |
| --- | --- |
| 6 Nov 2026 | `POST /api/upload_avatar`. Webshell written at `public_html/avatars/avatar-1793964090912-103811333.php`. `backend/.env` read the same day. |
| 6–19 Nov 2026 | About 480 `?cmd=` requests from about 15 source addresses. |
| 6, 13, 15, 16, 17 Nov | `backend/.env` read again on each of these days. Also `app/.env`, `www/.env`, and `football/.env`. |
| 7 Nov 2026 | `public.zip` and `backend.zip` downloaded. About 400 MB to `168.222.78.23`. |
| During the window | `.bash_history`, `.htpasswds`, SSH client config, `utils/password.js`, and `utils/hash.js` read. MySQL login attempted with the database user. `sql.php` downloaded from `cv.ariyanovingroup.ir` and saved as `public_html/favicon-1024x1024.php`. `public_html/shell.php` written. Several reverse shells attempted toward `168.222.78.23`. An upload renamed to `avatars/.htaccess` and a `.l33t` handler used. Two student voice files copied from `uploads/ai/audio`. `error_log` cleared more than once. |

The other source addresses were not listed in the note given to this review. Do not treat `168.222.78.23` as the only address.

## What the owner has already done

`avatars/.htaccess` was replaced with the PHP-deny block. That stops new PHP execution in that one directory. It does not delete the shells, rotate passwords, or close SEC-037.

## Files to remove

Check File Manager and remove anything the logs named, plus look for siblings:

- `public_html/avatars/avatar-1793964090912-103811333.php`
- `public_html/favicon-1024x1024.php` (the copy of `sql.php`)
- `public_html/shell.php`
- Any `avatars/.htaccess` that is not the PHP-deny file the owner just installed. Keep the deny file.
- A `.l33t` handler or AddHandler line pointing at it, in the account `.htaccess` files.
- `public.zip` and `backend.zip` if they are still on disk.
- Any new file under `public_html` or the home directory dated 6–19 Nov 2026 that the owner did not place.

Do not open those PHP files in a browser on the live site.

## Containment checklist

1. **cPanel password.** Change it in the client area, not by editing a file. Sign out every other cPanel session. Turn on two-factor authentication if the panel offers it.
2. **Database.** In cPanel → MySQL Databases, set a new password for the account user. Update only the cPanel Node.js App environment. Do not commit it. The webshell attempted a login as that user, so assume the attempt should be treated as a credential in attacker hands even if the log line does not prove success.
3. **SSH and panel keys.** If SSH was enabled, replace keys, remove unknown `authorized_keys` lines, and change the shell password. The logs show SSH config was read.
4. **Application secrets.** Rotate the GapGPT key, SMS panel password, JWT secret, socket JWT secret, internal service key, payment HMAC, and Zarinpal credentials. Every student session signed with the old JWT secret must die. Admin passwords must not go back to `Admin@1` through `Admin@20`.
5. **Other `.env` files that were read.** `app/.env`, `www/.env`, and `football/.env` are other sites or apps on the same account. Rotate those too. They are outside this git repo.
6. **SEC-037.** Edit `public_html/.htaccess` and remove the proxy from `/api/internal/` to `127.0.0.1:3000`, or limit it so the public internet cannot open it. The internal quiz routes on port 3000 trust a key that was in `backend/.env`.
7. **PHP deny on every upload directory**, not only `avatars/`. Same block for `public_html/uploads` (including `ai/audio`) and `public_html/files`. Text is in `infrastructure-audit.md`.
8. **Cron and malware.** In cPanel → Cron Jobs, delete any job added after 5 Nov 2026 that the owner does not recognize. Search the home directory for `*.php` outside the application the owner expects. Check `.bashrc` and `.bash_profile` for a new line. Pars Web support can run the host malware scan if the panel does not expose one.
9. **Error log.** It was cleared by the attacker. Do not trust a gap in `error_log` as evidence that nothing else happened. Keep a copy of the SSL access log offline, with the secret-looking query strings redacted before anyone else sees it.
10. **Voice files.** Two student recordings under `uploads/ai/audio` were copied. Treat those recordings as disclosed. They are a child's voice.

## Breach notification

The users are school students. Data the attacker could read includes phone numbers, password hashes, AI chats, payment rows, and at least two voice recordings. Iranian privacy duties and any school contract are for the owner and counsel, not for this repository. Practical minimum:

- Assume the database and the `.env` files were readable, because `backend.zip` (hundreds of megabytes) left the server and `backend/.env` was opened on five days.
- Do not put student names or phone numbers in a public commit, a GitHub issue, or this file.
- Tell the school or the parents in the channel the product already uses, once counsel agrees on the wording. Say that an unauthorized program ran on the server between 6 and 19 November 2026, that account passwords and API keys are being changed, and that they should treat SMS codes they did not request as suspicious.
- Keep the access log, the list of deleted filenames, and the date of each password change. That is the record if someone asks later.

## What this repo will not do

No cleanup script is being committed. No one should upload a test shell to production to see if the new `.htaccess` works. That check belongs on a staging subdomain after Gate 1.
