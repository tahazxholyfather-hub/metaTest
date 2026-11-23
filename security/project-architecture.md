# Project architecture

Status: initial read-only discovery on branch `beforMain` (documented on `cursor/security-audit-aaa7`).
Date: 2026-11-23.
No application code was changed for this document.

## What this repository actually is

The assessment brief assumed Next.js. The source tree does not contain `next.config.js`, `next.config.ts`, an App Router, a Pages Router, or Next.js Route Handlers.

The product that handles accounts, payments, quizzes, and uploads is a Vite + React client talking to an Express server.

| Surface | Path | Stack |
| --- | --- | --- |
| Main quiz application | `metatest/` | Vite 7, React 19, React Router 7, TypeScript. Package name `quiz-app` 1.3.6 |
| API and domain logic | `metatest/src/backend/` | Node.js, Express, CommonJS, `mysql2`, `multer`, `sharp`, `jsonwebtoken` |
| Realtime lobbies | `metatest/realtime-lobby-service/` | TypeScript, Socket.IO, Redis |
| Marketing / dental / games inside the client | `metatest/src/views/`, `metatest/src/games/` | Same Vite app |
| Small root client | `/` (`cellapp`) | Vite 8, React 19. Separate from the quiz API |
| Other frontends | `web-game/`, `gleam/`, `luma/`, `drift/`, `chemball/`, `ai-character/` | Independent Vite apps |
| Static landing | `landing-static/` | Static files, also mounted by Express |

Node used for this audit: v22.23.4. The repository does not pin a production Node version in an engine field that this audit verified on the host.

## Request path

```
Browser
  → LiteSpeed / Apache (inferred from code comments and .htaccess; vhost is not in git)
      → /api/* proxied to the Express process (comment in server.js)
      → /app/* SPA files from public_html (metatest/public/.htaccess)
  → Express (metatest/src/backend/server.js, default port 3000)
      → MySQL / MariaDB pool (metatest/src/backend/db.js)
      → filesystem under the web root for uploads
  → realtime lobby on its own port (default 4000) with a shared JWT secret
```

Production origin strings in `runtimeMode.js` are `https://metatest.app` and `https://socket.metatest.app`. This audit did not connect to those hosts.

## Hosting model that the code expects

`metatest/src/backend/runtimeMode.js` chooses the web root:

- Local development (`LOCALHOST` not set to false, and `metatest/public` exists): `metatest/public`, avatars in `metatest/public/avatars`.
- Otherwise: cPanel `WEB_ROOT` or `DOCUMENT_ROOT`, falling back to `/home/<account>/public_html`.

Tests in `runtimeMode.test.js` expect avatar directories at `/home/meta/public_html/avatars` and `/home/tamapp/public_html/avatars`.

`server.js` comments refer to a public LiteSpeed `/api` proxy. `metatest/public/.htaccess` is an Apache/LiteSpeed rewrite for the SPA under `/app/`. It does not configure PHP.

There is no Dockerfile, docker-compose file, Nginx config, Apache vhost, or PM2 file in the repository. `.github/workflows/build.yml` builds `web-game` only.

Database dumps were produced by phpMyAdmin:

- `quiz_app (full database).sql` — MariaDB 10.4.32, PHP 8.2.12, host `127.0.0.1` (consistent with a local XAMPP-style stack).
- `tamapp_db .sql` — MariaDB 10.6.28, PHP 8.4.27, host `localhost:3306` (consistent with cPanel).

Those headers show PHP exists on the machines that exported the databases. They do not prove that `public_html/avatars/*.php` is executed. See `file-upload-security.md`.

## Authentication boundaries

| Actor | Mechanism | Code |
| --- | --- | --- |
| Student | JWT in `Authorization` or `x-app-token` | `middleware/auth.js` |
| Student browser | Cookie `auth_token` written by JavaScript (`secure`, `samesite=strict`, not `httpOnly`) | `src/lib/authApi.ts` |
| Legacy browser | Cookie `token` without `Secure`, `HttpOnly`, or `SameSite` | `src/views/AuthView.tsx` |
| Guest / legacy | Unsigned base64 JSON `{id, role}` accepted when JWT verification fails | `middleware/auth.js` |
| Static app token | `APP_TOKEN` header value becomes user id 1, role `admin` | `middleware/auth.js` |
| Developer switch | `DEV_MODE=true` skips auth and sets user 999 | `middleware/auth.js` |
| Admin panel | Separate `admin_token` cookie: `httpOnly`, `secure` in production, `sameSite=lax` | `middleware/adminAuth.js` |
| Lobby → API | `INTERNAL_SERVICE_KEY`. If the key is unset and `NODE_ENV` is not `production`, the check is skipped | `server.js` |

`POST /api/flow` is a single endpoint that dispatches on `body.action`. Public actions (`send_otp`, `verify_otp`, `password_login`, admin login/logout/verify) skip the student token.

## Data stores

- Primary database: MySQL/MariaDB through `mysql2/promise` pool. Variables: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`. No SSL option is set on the pool.
- User passwords for students: Node `scrypt` (`userController.js`).
- Admin passwords: scrypt, with legacy MD5 and a predictable `Admin@{n}` scheme still accepted (`utils/password.js`).
- OTP codes: stored and compared in plaintext (`userController.js`).
- Redis: lobby locks and presence only. No MySQL in the lobby service.
- Uploaded bytes: directories under the web root (`avatars`, `uploads/ai`, `blog-media`, `images/questions`, `files/pdfs`).

## File upload entry points

| Endpoint | Auth | Validator | Storage |
| --- | --- | --- | --- |
| `POST /api/upload_avatar` | `requireToken` | Size 5 MB only. Extension copied from the client filename | `{webRoot}/avatars`, served at `/avatars` |
| `POST /api/ai-teacher/...` image, audio, PDF | `requireToken` + rate limit | MIME allowlist. Magic bytes for images and PDF. Optional `sharp` re-encode | `{webRoot}/uploads/ai/...`, served by the root static mount |
| `POST /api/admin/blog/media` | Admin session + blog section | MIME allowlist only | `{webRoot}/blog-media` |
| Admin question save | Admin session | Data-URL allowlist + magic bytes. Original bytes written | `{webRoot}/images/questions` |
| Admin PDF library | Admin session + section | Filename forced to `.pdf`. No `%PDF-` check | `{webRoot}/files/pdfs` |

Details and line numbers: `file-upload-security.md`.

## Sensitive assets

- Tracked environment file: `metatest/src/backend/.env` (still in git even though `metatest/.gitignore` lists `.env`).
- Misnamed secret file: `metatest/src/backend/ai-teacher/sql/004_iranian_teachers.sql` (dotenv assignments, not SQL).
- Full phpMyAdmin dumps at the repository root and `metatest/quiz_app(full_Database).txt`.
- 543 tracked files under `metatest/src/backend/node_modules`.

Key names present in the tracked env files (values are intentionally omitted): `DB_PASSWORD`, `JWT_SECRET`, `SOCKET_JWT_SECRET`, `APP_TOKEN`, `INTERNAL_SERVICE_KEY`, `ZARINPAL_MERCHANT_ID`, `ZARINPAL_ACCESS_TOKEN`, `PAYMENT_RESULT_SECRET`, `OPENAI_API_KEY`, `SMS_USERNAME`, `SMS_PASSWORD`, `SMS_SENDER_LINE`.

The tracked backend env has `DEV_MODE=false` and `NODE_ENV=development`. The misnamed SQL file has `DEV_MODE=false` and `NODE_ENV=production`.

## Trust boundaries

1. Browser to Express. The client can set any header, including a forged base64 token.
2. LiteSpeed document root to Node. Files written into `public_html` are also visible to the web server, which may apply its own handlers.
3. Express to MySQL. Most queries are parameterized. One `ORDER BY FIELD` interpolates stored JSON.
4. Lobby service to `/internal/*`. Trust depends entirely on `INTERNAL_SERVICE_KEY`.
5. Express to payment, SMS, and model providers. Credentials for those providers are in git.
6. Any visitor to `express.static(profile.webRoot)`. Uploaded objects are not authorized per request.

## Out of scope for this pass

- Live requests to `metatest.app` or the SMS, payment, and model providers.
- Reading row data inside the SQL dumps.
- Printing secret values.
- Changing application code, dependencies, or hosting.
