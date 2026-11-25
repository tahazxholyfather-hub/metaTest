# Security audit — MetaTest (`metatest.app`)

Audit date: 2026-11-25. Scope is this public Git repository (the Vite/React app and Node API under `metatest/`, plus unpacked copies at the repo root) and the live HTTPS response of `https://metatest.app`.

The runnable application is `metatest/` (`package.json`, Vite, `src/backend/server.js`, `realtime-lobby-service/`). The repo root also contains an unpacked duplicate of parts of the same tree (`src/`, `views/`, `admin/`, `api/`). Both copies were public.

**Anything listed below as committed is already world-readable.** Deleting it in this pull request does not remove it from git history. Treat every secret and every row in the database dump as compromised. Rotating a key, resetting a password, or purging history is manual work this PR cannot do.

Secrets are masked. None of the values below are complete.

## Counts

| Severity | Open before fixes | Fixed in this PR | Still needs the owner |
| --- | --- | --- | --- |
| Critical | 6 | 6 (code/tree) | Rotate secrets, purge history, set new admin passwords, notify affected users |
| High | 7 | 4 | Security headers and HTTP→HTTPS on Pingora; HttpOnly session cookie; stored HTML |
| Medium | 9 | 5 | Fail-open sessions, body size, dependency majors, duplicate tree |
| Low | 4 | 2 | OTP length, general API rate limit |

`npm audit` before the lockfile update: app **3 critical, 32 high, 12 moderate, 3 low**; lobby service **1 critical, 11 high, 6 moderate**. After semver-compatible `npm audit fix` (no `--force`): app production tree **5 high, 0 critical**; full app tree **7 high, 6 moderate**; lobby **2 moderate**. `npm run build` and the lobby `tsc --noEmit` both succeed. Breaking upgrades (Firebase 9, a `sharp` major, shadcn 4) were not applied.

## What must be rotated

Do this before or while deploying this branch. Putting the old values back into the server environment leaves the public copies valid.

| Secret | Where it was | Masked value | Action |
| --- | --- | --- | --- |
| GapGPT / OpenAI-compatible API key | `src/backend/.env`, `metatest/src/backend/.env` (`OPENAI_API_KEY`), `src/backend/ai-teacher/.env` (`AI_API_KEY`) | `sk-HnfM…Prel` | Revoke in the GapGPT panel and issue a new key |
| Student JWT signing key | both backend `.env` files and `metatest/realtime-lobby-service/.env` (`JWT_SECRET`) | `big_poppa_…` | New random secret, 32+ characters. Every existing session dies, which is intended |
| Socket JWT key | backend `.env` (`SOCKET_JWT_SECRET`) | `2pac_makaveli_…` | New random secret |
| Internal service key | backend `.env` and lobby `.env` (`INTERNAL_SERVICE_KEY` / `MAIN_BACKEND_INTERNAL_KEY`) | `cedai…nwo` | New random secret on both the API and the lobby service |
| Payment-result HMAC | backend `.env` (`PAYMENT_RESULT_SECRET`) | `cjow…hbsj` | New random secret |
| Zarinpal merchant id and access token | backend `.env` | merchant `a4e9d3bb-…3300d`, access token was the literal `zarinpal-panel` | Confirm whether that access token is real; rotate the merchant credential in the Zarinpal panel if it is |
| SMS panel | backend `.env` | username `989120…8911`, password `aa9c68dd-…7e72` | Reset the payamak-panel password |
| App token that signed in as admin user 1 | backend `.env` (`APP_TOKEN`) | `iMRe…Me` | Discard. The code no longer treats it as an admin session |
| Legacy client token | `api/quizApi.ts`, `src/api/quizApi.ts`, `metatest/src/api/quizApi.ts` | `TAM24_TOKEN_…0223` | If `tam24.ir` still trusts this header, rotate it there. It is no longer hardcoded |
| Admin panel passwords | source, not only env | `Admin@` + the admin number, for `admin1` through `admin20` | These passwords are public. Set new `ADMIN_<id>_PASSWORD` values. Do not reuse `Admin@1` |
| Admin password hashes in the SQL dump | `tam24_admins` (20 hashes) | not reproduced | Reset those accounts even though the login code ignored the table |
| OTP codes in the dump | `tam24_otps` (plaintext, tied to phone numbers) | not reproduced | Short-lived, but the phone numbers are now public |
| Student phone number, payment rows, AI chats, notes, memory | `quiz_app(full_Database).txt` | not reproduced | See finding C2. Notify affected users if required |

History rewrite (the only way to stop GitHub from serving the old blobs): on a fresh clone, use `git filter-repo` or BFG to delete every `.env`, `quiz_app(full_Database).txt`, and `**/node_modules`, then force-push and ask GitHub Support to clear cached views and forks. Assume anyone who cloned the repo already has the files. **Rotation is the control that matters.** This PR does not rewrite history.

---

## Critical

### C1. Live secrets committed to a public repository

**Files:** `src/backend/.env`, `metatest/src/backend/.env`, `src/backend/ai-teacher/.env`, `metatest/realtime-lobby-service/.env`. Present on `main` and in history (`git log` shows them across the `unzipgit` commits, including `2cc0586`).

`.gitignore` did not ignore `.env`. `NODE_ENV=development` and `ZARINPAL_SANDBOX=true` were in the same files. If production was started from this checkout, the process was in development mode (admin cookies without `Secure`) and Zarinpal was pointed at the sandbox.

**Fix in this PR:** those files are removed from the tree. `.gitignore` ignores `.env` and database dumps. Placeholders are in `metatest/src/backend/.env.example` and `metatest/realtime-lobby-service/.env.example`.

**Owner:** put **new** values in the host environment (systemd, the process manager, or a file that is not in git) before deploying. Deploying this branch with no environment will refuse admin login and payment-result tokens, and the lobby service will not boot without `JWT_SECRET`.

### C2. Production database dump in the repository

**File:** `quiz_app(full_Database).txt` (about 26 MB, phpMyAdmin dump of `quiz_app`, generated 2026-09-13). Removed from the tree in this PR. Still in history.

The dump includes live rows, not just schema:

- `tam24_users` — phone number (password hash on that row was null)
- `tam24_admins` — 20 password hashes
- `tam24_otps` — plaintext one-time codes next to phone numbers
- `payments` — amounts, gateway authority values, client IPs
- `tam24_ai_messages` — private tutor conversations (about 68 messages)
- `tam24_ai_student_memory`, `notes_tam24` — student notes and memory
- `questions_tam24` — about 12,600 questions, plus answer keys in `options_tam24`

**Owner:** purge history (see above) and treat the phone numbers, chats, and payment records as disclosed. The OTP codes are expired; the phone numbers are not.

### C3. Admin passwords are `Admin@1` … `Admin@20`

**File:** `metatest/src/backend/controllers/adminController.js`, `handleAdminLogin` (previously around line 304).

Any username `adminN` for N in 1..20 accepted the password `Admin@N`. Login does not read `tam24_admins`. The action `admin_login` is on the public list in `middleware/auth.js`, so no student session was required.

**Fix in this PR:** the password comes only from `ADMIN_<id>_PASSWORD` or a JSON `ADMIN_PASSWORDS` map. If it is unset, login fails. Comparison is constant-time. There is no default.

**Owner:** choose new passwords and set them on the server. The old ones will never work again after this deploy, which is the point.

### C4. Admin session cookie was forgeable, and many admin actions never checked it

**File:** `metatest/src/backend/controllers/adminController.js`.

The cookie was `ADMIN-<id>-<timestamp>` (previously around line 315). `getAdminIdFromRequest` (around line 14) trusted any cookie with that shape. Knowing the format was enough to act as admin 1: edit questions, delete curriculum, upload files.

Separately, these actions sat behind `requireToken` only. Any logged-in student (or anyone using C5) could call them, because they never read the admin cookie:

- `handleGetQuestionForEdit` — returns `is_correct` (the answer key)
- `handleAdminSaveCurriculumItem` — insert/update subjects, grades, topics
- `handleAdminSavePdf` — writes a file under the public PDF directory
- `handleAdminParseQuestionsDocx`, `handleAdminGetCurriculum`, `getQuestionsByFilters`, and the admin list endpoints

`/api/flow` is the single POST router in `metatest/src/backend/server.js` (around line 157).

**Fix in this PR:** the cookie is an HMAC (`ADMIN_SESSION_SECRET`, falling back to `JWT_SECRET`) with an expiry. Unsigned `ADMIN-<id>-…` cookies are rejected. Every admin handler above now requires that cookie. HTTP status stays 200 with `success: false` when the cookie is missing, so the student client does not clear its own session on a 401.

**Owner:** existing admin cookies stop working; sign in again after the new passwords are set. Set `ADMIN_SESSION_SECRET` to a new value distinct from the student JWT secret.

### C5. Any caller could mint a session

**File:** `metatest/src/backend/middleware/auth.js`, previously lines 84–101.

Two independent bypasses, both reached from the `x-app-token` / `Authorization` header:

1. If the token contained no `.`, it was decoded as base64 JSON. Any object with an `id` became that user, with whatever `role` the attacker put in the JSON. No signature, no database check. `{"id":1,"role":"admin"}` was enough.
2. If the token equalled `APP_TOKEN` from the environment, the request became user id 1, role `admin`. That token was in the public `.env` (finding C1).

Guest login issued the same unsigned base64 tokens (`userController.js`, previously around line 229), which is why the fallback existed.

`DEV_MODE=true` (around line 41) skipped authentication entirely and set `role: 'developer'`. The committed env had it `false`, but the flag was not limited to localhost, and `NODE_ENV` in that file was `development`.

**Fix in this PR:** only a verified JWT is accepted. Guest login now issues a normal JWT via `issueSessionToken`. `DEV_MODE` is honored only for loopback, and only when `NODE_ENV` is not `production`.

**Owner:** rotate `JWT_SECRET`. Old base64 guest tokens and the app token stop working at deploy.

### C6. Internal service authentication could be skipped, and accepted the user header

**File:** `metatest/src/backend/server.js`, `requireInternalService` (previously lines 23–49).

`/internal/quizzes/:quizId/grade`, `finish`, `members`, and `/internal/results` grade quizzes and write results. If `INTERNAL_SERVICE_KEY` was empty and `NODE_ENV` was not `production`, the middleware called `next()`. The committed env set `NODE_ENV=development`. The same middleware also accepted the key in `x-app-token`, so a leaked key could be sent as a normal app header.

The lobby client already sends `x-internal-service-key` (`realtime-lobby-service/src/services/main-backend.service.ts`).

**Fix in this PR:** the key is required on every request, compared in constant time, and read only from `x-internal-service-key`.

**Owner:** rotate the key and set the new value on both processes.

---

## High

### H1. Client-supplied `user_id` overrode the session

**Files:**

- `metatest/src/backend/controllers/quizController.js` — `handleGetPracticeQuestion` (~483), `handleCheckAnswer` (~672), `handleFinishQuiz` (~929). The body id was preferred: `Number(req.body.user_id) || req.user.id`.
- `metatest/src/backend/controllers/rewardController.js` — the same pattern in three handlers (~345, ~397, ~584).
- `metatest/src/backend/controllers/userController.js` — `saveUserActivity` (~860) wrote `tam24_user_activities` for `req.body.user_id`.

A logged-in student could record answers, rewards, and study time as someone else. Progress queries used the session first, so those were less exposed; they now ignore the body id as well.

**Fix in this PR:** those writes use `req.user.id` only. The UI already sends the signed-in user, so normal practice is unchanged.

### H2. Quiz results could be read without being in the quiz

**File:** `metatest/src/backend/controllers/quizWorldController.js`, `handleGetQuizResultByUserAndQuiz` (~2493). `userId` came from the body. The result screen does load another member's result when their avatar is clicked (`QuizResultView.tsx`), so locking this to "only yourself" would remove that feature.

**Fix in this PR:** both the caller and the target must be rows in `quiz_members` for that quiz. Members can still open each other's result. Everyone else gets 403. `check_user_member` now uses the session id, not a body id.

`ORDER BY FIELD(q.id, ${questionIds.join(',')})` (~1101) interpolated ids that originated in the database. They are coerced to positive integers before they are concatenated.

### H3. One-time passwords could be guessed and the SMS panel could be flooded

**File:** `metatest/src/backend/controllers/userController.js`, `handleSendOtp` / `handleVerifyOtp` (~284–359).

The code is four digits (`generateOtp`, 1000–9999), stored in plaintext, valid for five minutes, with no send limit and no attempt limit. `send_otp` and `verify_otp` are public actions. The SMS password is the one in C1, so the cost of a flood was the owner's panel.

**Fix in this PR:** 5 sends per phone and 20 per IP each 15 minutes; 8 verify attempts per phone each 15 minutes, then the code is deleted. The code must be four digits.

**Still open:** four digits is too short. Move to six digits when the SMS template and the four-box UI in `metatest/src/views/AuthView.tsx` can change together. That UI change was left out so login screens stay as they are.

### H4. Live site sends no security headers, and HTTP returns 500

Checked against `https://metatest.app` (static SPA, about 2 KB, in front of Pingora). The TLS certificate is a valid Let's Encrypt cert. `/.env` and `/.git/HEAD` return 403, which is what we want.

The document response has none of: `Strict-Transport-Security`, `Content-Security-Policy`, `X-Frame-Options` / `frame-ancestors`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`. `http://metatest.app` returns **500** instead of redirecting to HTTPS.

**This repository does not contain the proxy config.** There is no nginx, Caddy, Pingora, `_headers`, or `vercel.json`. `metatest/vite.config.ts` only proxies `/api` in development. Vite cannot attach response headers to the file Pingora serves.

The Node API now sets `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and `Strict-Transport-Security` when `X-Forwarded-Proto` is `https` (`metatest/src/backend/server.js`). That covers `/api/*` only if Pingora forwards upstream headers. It does **not** cover `GET /`.

**Owner, on the Pingora (or whatever) listener for `metatest.app`:**

1. Port 80 must not proxy to an origin that 500s. Answer it on the proxy:

```nginx
server {
    listen 80;
    server_name metatest.app www.metatest.app;
    return 301 https://metatest.app$request_uri;
}
```

2. On the HTTPS server that serves the SPA, add headers to every response, including `index.html` and the hashed assets:

```nginx
add_header Strict-Transport-Security "max-age=15552000; includeSubDomains" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(self), geolocation=()" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; media-src 'self' blob:; worker-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'" always;
```

`microphone=(self)` is there because the tutor records audio in the page. `style-src 'unsafe-inline'` is a stand-in: MathJax and the CSS-in-JS runtime may need it. Load the site with the policy in report-only mode first (`Content-Security-Policy-Report-Only`) and tighten whatever the console rejects. Do not add `script-src 'unsafe-inline'`.

If the proxy is Pingora rather than nginx, set the same fields in the proxy's response filter and make the HTTP listener return 301. Do not add HSTS `preload` until every subdomain is HTTPS.

### H5. Avatar upload trusted the client filename

**File:** `metatest/src/backend/server.js`, multer `filename` (previously ~69). The extension came from `path.extname(file.originalname)` with no type check. Files are stored under `public/avatars` and `express.static('public')` serves them. An `.html` or `.svg` upload on the same origin is stored XSS, and the session cookie is readable from JavaScript (H6).

**Fix in this PR:** only `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, and the file's first bytes must match that type. Anything else is deleted and rejected. The profile picker already uses `accept="image/*"`.

### H6. The student session cookie is readable by script

**Files:** `metatest/src/lib/authApi.ts` (`setAuthCookie`, ~58), `metatest/src/lib/cookies.ts`, `metatest/src/views/AuthView.tsx` (~66), and the duplicate `views/AuthView.tsx`.

The API never reads the cookie. The browser copies `auth_token` into `x-app-token`. That design cannot be `HttpOnly` without teaching the server to read the cookie itself. Combined with H5 or the unsanitized question HTML (M1), a script can take the 30-day JWT.

`authApi` already set `Secure` and `SameSite=Strict`. The other setters did not. They now set `SameSite=Lax` and `Secure` on HTTPS, and stay usable on `http://localhost`.

**Owner:** when you can change the client and the server together, verify the JWT from the cookie inside `requireToken` and stop copying it into a header the page can read. Until then, the CSP in H4 is what limits script injection.

### H7. Question and note HTML is inserted as HTML

**Files:** `metatest/src/views/NotesView.tsx` (~204, ~290, ~330, ~357), `metatest/src/views/ReportsView.tsx` (~217), `metatest/src/views/QuizView.tsx` (`innerHTML`, ~100), `metatest/src/views/testworld/QuizPage.tsx` (~172).

Question text is stored HTML (math). There is no sanitizer. That is safe only if every writer is trusted. Before C3–C5, any caller could become that writer. After this PR, writers still need an admin session, but a compromised admin account, or a question that already contains a script, still runs in every student's browser.

**Not changed here.** A sanitizer that strips the tags MathJax needs would change how questions render. Add DOMPurify with an allow-list (`sup`, `sub`, `span`, `img` with same-origin `src`, MathML) and keep the CSP from H4.

---

## Medium

### M1. Session revocation fails open

**File:** `metatest/src/backend/middleware/auth.js`, `isSessionReplaced` (~24–27). A database error while checking `last_login` returns `false`, so a token that should have been replaced by a newer login is accepted. Left as-is: failing closed would sign everyone out during a database blip. Log it and alert instead, or fail closed only for `role === 'admin'`.

### M2. JWTs last 30 days

**File:** `userController.js`, `issueSessionToken` (`expiresIn: '30d'`). There is no refresh rotation. Theft of one token (H6) is a month of access, bounded only by the single-device `loginAt` check. Shorten the lifetime when you move the token into an HttpOnly cookie.

### M3. Request body limit is 50 MB, with no global rate limit

**File:** `server.js`, `express.json({ limit: '50mb' })`. The comment says admin PDF uploads need it. That is also an unauthenticated memory DoS on every route, including `send_otp`. The AI routes have their own limiter. The lobby service uses `express-rate-limit` and Helmet; the main API does not.

Do not drop the limit until PDF upload moves to multipart with a tighter cap. Add a small global limiter in front of `/api/flow` that still allows a normal quiz session.

### M4. Uploaded AI files live on the public web root

**File:** `metatest/src/backend/ai-teacher/services/fileStorage.js`. Names are random and magic bytes are checked for images and PDFs. URLs under `/uploads/ai/` are still world-readable if someone learns the name. Audio trusts the declared MIME. Serve those paths only through a handler that checks `user_id`.

### M5. Payment callback did not bind the authority

**File:** `paymentController.js`, `handleZarinpalCallback`. Amount verification with Zarinpal is done server-side, which is right. The callback accepted a different `Authority` than the one stored on the payment row. It now rejects a mismatch. The result token no longer falls back to the literal `change-me-payment-result-secret` if both env vars are missing.

### M6. Dependencies `npm audit` would not fix without a breaking change

Not upgraded, because the suggested fix is a major or a downgrade:

| Package | Where | Why it was left |
| --- | --- | --- |
| `firebase` → `@grpc/grpc-js` | app, high | Fix npm offers is Firebase 9 |
| `sharp` | app, high (libvips / libheif / librsvg) | Fix npm offers is `sharp@0.35.5`, flagged as breaking from `^0.34.5` |
| `zod` under `shadcn` | app, high (DoS on huge schemas) | Fix is shadcn 4; dev tooling, not the request path |
| `minimatch` / `glob` via `vite-plugin-pwa`, typescript-eslint, nodemon | app moderate, lobby moderate | Fix is a major downgrade of the plugin or nodemon |

Semver-compatible updates are in the lockfiles. Rebuild after any later `npm audit fix --force`.

### M7. Committed `node_modules` and a second copy of the source

`metatest/src/backend/node_modules` (543 tracked files, including axios) is removed from git and ignored. The backend `package.json` does not declare `express`, `mysql2`, `jsonwebtoken`, `multer`, `dotenv`, or `cookie-parser`, even though `server.js` requires them. They are declared on the Vite package instead. Install from `metatest/` and run the API with that `node_modules` on `NODE_PATH`, or add the real dependencies to the backend package.

The root `src/`, `views/`, `admin/`, and `api/` trees are not what `npm run build` compiles. They had their own `.env` and the same hardcoded legacy token. Secrets were removed there too. Delete or stop publishing the duplicate so the next audit has one tree.

### M8. SQL errors were returned to the client

**File:** `adminController.js`, the admin list handlers (`message: error.message`). Those responses are now generic. The error stays in the server log.

### M9. Lobby JWT defaulted to a public string

**File:** `realtime-lobby-service/src/config/env.ts`. `JWT_SECRET` defaulted to `super-secret-change-me`. It is now required and must be at least 32 characters. The service will not start until the environment is set.

---

## Low

### L1. Password check was not constant-time

**File:** `userController.js`, `comparePassword`. It used `===` on the scrypt hash. It now uses `crypto.timingSafeEqual`. Admin password comparison does too.

### L2. CORS allow-list is localhost unless configured

**File:** `server.js`. The previous origin was hard-coded to `http://localhost:5173`. Same-origin calls from `https://metatest.app` do not need CORS. The allow-list is now `CORS_ORIGINS` (comma-separated), defaulting to that same localhost origin so a deploy does not suddenly trust extra sites. Set `CORS_ORIGINS=https://metatest.app` only if the API host is different from the page.

### L3. `guest_login` is not a public action

**File:** `auth.js`, `publicActions`. The client calls `guest_login` with no token (`authApi.ts`). The middleware will reject it. That is pre-existing. It was not added to the public list here, because that would open unlimited guest-account creation. Guest tokens, if the action is reached, are now JWTs.

### L4. Build still pulls `lottie-web`, which uses `eval`

Vite printed this during `npm run build`. It is a dependency, not application code. Prefer a build of lottie that does not call `eval` if you lock down `script-src`.

---

## What this PR changes, and what it deliberately does not

Changed, with the same behavior for a normal student session:

- Secrets and the SQL dump are no longer in the tree. Examples replace them.
- Admin login requires an environment password and a signed cookie. Admin routes check that cookie.
- API authentication is JWT only.
- Answer, reward, and activity writes use the session user.
- Quiz-result detail requires membership. Question id lists used in `ORDER BY` are integers.
- OTP send/verify is rate limited. Avatars and admin PDFs are type-checked.
- API responses from Express carry the headers listed in H4. Cookies that were missing flags get `SameSite` and `Secure` on HTTPS.
- Lockfiles updated with `npm audit fix` and no `--force`.

Not changed, on purpose:

- Question HTML rendering (H7).
- Making the session cookie HttpOnly (H6). That needs a coordinated client change.
- Pingora headers and the HTTP 500 (H4). There is nowhere in this repo to put them.
- OTP length, the 50 MB body limit, and the breaking dependency upgrades.
- Git history. The old commits still contain the secrets and the dump.

## Deploy checklist

1. Revoke the GapGPT key, SMS password, JWT secrets, internal key, and payment secret. Set the new values on the API host and the lobby host. Do not copy them from git.
2. Set `ADMIN_1_PASSWORD` (and any other `ADMIN_<id>_PASSWORD` you still use) to a new password. Set `ADMIN_SESSION_SECRET`.
3. Set `NODE_ENV=production` and `ZARINPAL_SANDBOX=false` on the real server.
4. Confirm `JWT_SECRET` is identical on the API and the lobby service, and that it is the new value.
5. Add the H4 headers and the port-80 redirect on Pingora. Check with `curl -sI https://metatest.app` and `curl -sI http://metatest.app`.
6. Purge `quiz_app(full_Database).txt` and the `.env` blobs from history, then tell GitHub Support. Plan on the data already being copied.
7. After deploy, sign in as a student (OTP and password), open a quiz, and sign in to the admin panel with the new password. Old admin cookies and old `Admin@N` passwords will not work.

## Phase 5 (Gate 1 approved for critical and high only)

Branch `cursor/phase5-critical-high-a3a9`. Not deployed. Production was already breached; see `security/incident-2026-11.md`.

| ID | Status | What changed |
| --- | --- | --- |
| SEC-001 | Remediated in the tree, rotation still required | Secrets stay in environment variables only. The November shell read the live files, so rotation is mandatory. |
| SEC-002 | Removed from the tree | History purge is still the owner's job. |
| SEC-003 | Remediated | Admin passwords come from `ADMIN_<id>_PASSWORD` or `ADMIN_PASSWORDS`. |
| SEC-004 | Remediated | Admin cookie is an HMAC. |
| SEC-005 | Remediated | Admin actions check that cookie. |
| SEC-006 | Remediated | Only a verified JWT is a session. |
| SEC-007 | Remediated in code, host file still to copy | Avatar, PDF, and AI audio names come from magic bytes and `crypto.randomBytes`. Client filename and MIME are ignored. Templates in `deploy/cpanel/` are not installed automatically. |
| SEC-008 | Remediated | Answers and activity use the session id. |
| SEC-009 | Remediated | Quiz results require membership. |
| SEC-010 | Partial | OTP sends and checks are rate limited. Codes are still four digits because the login screen has four boxes. |
| SEC-011 | Template only | `deploy/cpanel/public_html.htaccess` sets the security headers. |
| SEC-012 | Template only | The same file redirects HTTP to HTTPS. |
| SEC-013 | Remediated | Question HTML is stripped of scripts and event handlers before display. |
| SEC-014 | Remediated | The long-lived session cookie is HttpOnly. The lobby asks `/api/realtime-token` for a 15-minute token. |
| SEC-015 | Remediated | Internal routes require `INTERNAL_SERVICE_KEY` (at least 16 characters). |
| SEC-025 | Partial | Non-breaking `npm audit fix` is on the parent branch. Breaking upgrades were not applied. |
| SEC-037 | Remediated in code, proxy still on the server | `/internal` and `/api/internal` accept only a loopback connection plus the env key. Delete or lock the public rewrite in `public_html/.htaccess`. |

### Follow-ups (medium and low, not in this pass)

SEC-016 fail-open session check, SEC-017 30-day JWT, SEC-018 50 MB body, SEC-019 AI files on the public disk, SEC-020 payment authority binding is already on the parent branch, SEC-021 coupon race, SEC-022 plan expiry ignored for AI coins, SEC-023 unbounded task progress, SEC-024 client-supplied practice stats, SEC-026 tracked `node_modules` is already removed on the parent, SEC-027 generic SQL errors are already on the parent, SEC-028 lobby JWT default is already removed on the parent, SEC-029 constant-time compare is already on the parent, SEC-030 cookie flags, SEC-031 CORS list, SEC-033 guest login not public, SEC-034 DEV_MODE localhost-only is already on the parent, SEC-035 integer `ORDER BY` is already on the parent, SEC-036 PDF magic check is already on the parent. Six-digit OTP remains with SEC-010.

### Environment variables to set in cPanel → Setup Node.js App

Placeholders only. Generate new values. Do not reuse anything read by the webshell or committed in git.

`JWT_SECRET`, `SOCKET_JWT_SECRET` (same JWT secret on the lobby app), `ADMIN_SESSION_SECRET`, `ADMIN_1_PASSWORD` (and any other admin id you still use), `INTERNAL_SERVICE_KEY` (at least 16 characters, use 32), `PAYMENT_RESULT_SECRET`, `OPENAI_API_KEY` or `AI_API_KEY`, `SMS_USERNAME`, `SMS_PASSWORD`, `SMS_SENDER_LINE`, `ZARINPAL_MERCHANT_ID`, `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `NODE_ENV=production`.

### Breaking changes

- Old JWTs stop working when `JWT_SECRET` changes. Students sign in again.
- `Admin@1` through `Admin@20` stop working. Set `ADMIN_1_PASSWORD` first.
- Existing admin cookies stop working.
- Unsigned guest tokens stop working.
- Internal calls fail unless they come from 127.0.0.1 (or `::1`) and send `x-internal-service-key`. The lobby's call through the local proxy still looks like loopback. A call from another machine directly to port 3000 will be refused.
- A key shorter than 16 characters is refused.
- Avatar and PDF stored names change. Old avatar URLs keep working until the user uploads again.
- Voice notes whose bytes do not match wav, ogg, webm, mp3, or m4a are rejected.
- The browser no longer keeps the long-lived token in `document.cookie`.

### cPanel deploy steps (do this yourself, not from this agent)

1. In File Manager, delete `public_html/avatars/avatar-1793964090912-103811333.php`, `public_html/shell.php`, and `public_html/favicon-1024x1024.php` if they are still there. Keep the PHP-deny `.htaccess` you already put in `avatars/`.
2. Copy the files from `deploy/cpanel/public_html/` into the matching folders. Copy `deploy/cpanel/public_html.htaccess` onto `public_html/.htaccess` only after you read the current file. Remove the `/api/internal/` proxy to `127.0.0.1:3000`, or leave it only if you accept that the env key is the lock. If "Force HTTPS" is already enabled, delete the rewrite block in the template so the site does not loop. If port 80 still returns 500, open the error log before expecting the redirect to run.
3. Paste the new secrets into Setup Node.js App. Restart the app from that screen.
4. Do not test a `.php` upload on the live site. Use a staging subdomain when you have one.
