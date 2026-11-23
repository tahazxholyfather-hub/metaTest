# Infrastructure audit

Agent: infrastructure-security.
Scope: repository and this workspace only. The cPanel account, LiteSpeed vhost, and firewall were not accessible. Nothing on a server was changed.

## What the code says about hosting

| Question | Answer from the repo |
| --- | --- |
| Web server | LiteSpeed is named in `server.js` (the `/api` proxy comment). Apache-style `.htaccess` is in `metatest/public/.htaccess` and only rewrites `/app/` to the SPA. No Nginx config is checked in. |
| Can we edit Nginx/Apache from git? | Only by shipping another `.htaccess` with the app, and only if the account's `AllowOverride` (or LiteSpeed equivalent) reads it. The vhost is not in git. |
| Can we change the Node process from git? | Environment variables and the Express code, yes, on the next deploy. systemd/Passenger/LiteSpeed Node app settings are not in git. |
| Can uploads live outside the web root? | Not by current default. `ensureAvatarDir` tries the web root, then `public_html/avatars`, then a folder beside the backend, then `os.tmpdir()`. The first writable web-root directory wins. |
| Object storage | Not configured. |
| Docker | No Dockerfile and no compose file for metatest. |
| TLS | Production origins are `https://metatest.app`. Certificate, HSTS, and cipher settings are not in the repo. This audit did not open the site. |
| Process user | Unknown. No `USER` directive because there is no image. Assume the cPanel account user, not root, until a person checks. |
| Node version on the host | Unknown. This workspace is Node v22.23.4. |
| Security tools on the host | Unknown. This workspace does not have Semgrep, Gitleaks, Trivy, OSV-Scanner, or ZAP. |
| CI | `.github/workflows/build.yml` builds `web-game` only. It does not deploy metatest and does not run `npm audit`. |

## File serving

```116:119:metatest/src/backend/server.js
app.use('/avatars', express.static(uploadDir));
app.use(express.static(profile.webRoot));
app.use('/app', express.static(path.resolve(__dirname, '../../public')));
app.use(express.static(path.resolve(__dirname, '../../../landing-static')));
```

`profile.webRoot` in production is the cPanel document root. That mount publishes every upload tree: `avatars`, `uploads/ai`, `blog-media`, `images/questions`, `files/pdfs`.

`express.static` does not execute PHP, Node, or shell. It does execute nothing; it sends bytes with a MIME type based on the extension. `.html` is therefore active content in the browser.

If LiteSpeed serves `public_html` itself and only proxies `/api`, then LiteSpeed's MIME and PHP handlers apply to `/avatars/*` before Node sees the request. That split is consistent with the comment on line 148 and is **not confirmed** against a live vhost. Finding UP-002.

## Permissions and script execution

- No `chmod` of upload directories was found in `ensureAvatarDir`. The directory is created with the process umask. The audit did not stat a production directory.
- Nothing marks the avatar directory `noexec`. On Linux, `noexec` would not stop a web server from interpreting PHP anyway. The relevant control is the PHP handler, not the executable bit.
- Uploaded names cannot include a path separator via `path.extname`, so the avatar handler does not overwrite files outside its directory. It can create `.htaccess` inside it (`x.htaccess`).

## Headers, cookies, logging

- No Helmet and no CSP on the main app (HDR-001). The lobby app sets Helmet.
- Admin cookie: `httpOnly`, `secure` in production, `sameSite=lax`.
- Student cookies: set in the browser. See AUTH-004.
- Errors append to `metatest/src/backend/error.log` and to stderr (`reportError.js`). The log is outside the web root in the normal layout. If the backend directory is ever placed inside `public_html`, that log and `.env` become downloadable. The intended layout is `backend` beside `public_html`, not inside it (`runtimeMode.js` comments).
- VAPID private keys are written to `metatest/src/backend/data/vapid.json`, which is gitignored and outside the web root. Good, as long as the backend directory stays private.

## Production versus local

`LOCALHOST` defaults to true when the variable is missing (`runtimeMode.js` lines 6–8). A production process that does not set `LOCALHOST=false` and that happens to see a `public` directory will use the development web root and development CORS origins. The cPanel path is used when `LOCALHOST` is false or the repo `public` directory is absent.

The tracked `.env` sets `NODE_ENV=development` and does not set `LOCALHOST` in the key list that was scanned. Treat a copy of that file on a server as a misconfiguration even after the secrets are rotated.

## Logging and monitoring

No application security monitor (failed-login dashboard, upload reject log, integrity alert) was found beyond `console.error` and `error.log`. Rate limits exist for AI routes and some admin/contact routes, not for OTP.

## Changes this audit refuses to make

- No panel edits.
- No new site-wide Apache config.
- No claim that PHP runs, and no claim that it does not.
