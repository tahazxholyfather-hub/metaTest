# Central security report

Date: 2026-11-23.
Branch audited: `beforMain`.
Report branch: `cursor/security-audit-aaa7`.
Lead: consolidated the specialist passes and re-read every item marked confirmed.
Application code: not modified.
Secret values: not included.

Scanners actually run: `npm audit` in `metatest/` (exit 1, 2 critical, 11 high, 3 moderate).
Not installed and not installed for this pass: Semgrep, Gitleaks, Trivy, OSV-Scanner, OWASP Dependency-Check, OWASP ZAP.
Dynamic testing against `metatest.app` was not performed.

## Confirmed vulnerabilities

### SEC-001 — Live credentials are committed to git

- Finding ID: SEC-001
- Vulnerability name: Secrets committed in tracked env files
- Severity: CRITICAL
- Confidence: confirmed
- Affected file: `metatest/src/backend/.env` (entire file, 1292 bytes) and `metatest/src/backend/ai-teacher/sql/004_iranian_teachers.sql` lines 1–18 (dotenv text stored under a `.sql` name)
- Technical explanation: `git ls-files` tracks both paths. `metatest/.gitignore` lists `.env`, but a tracked file stays in the repository. The Lead listed key names only. Both files assign `DB_PASSWORD`, `JWT_SECRET`, `SOCKET_JWT_SECRET`, `APP_TOKEN`, `INTERNAL_SERVICE_KEY`, `SMS_USERNAME`, `SMS_PASSWORD`, and `SMS_SENDER_LINE`. The backend `.env` also assigns `ZARINPAL_MERCHANT_ID`, `ZARINPAL_ACCESS_TOKEN`, `PAYMENT_RESULT_SECRET`, and `OPENAI_API_KEY`. `DEV_MODE` is `false` in both. `NODE_ENV` is `development` in `.env` and `production` in the SQL file.
- Potential impact: Anyone who can read the repository or its history can authenticate as the database user, forge JWTs, call internal routes, send SMS, and use the payment and model credentials.
- Evidence: `git ls-files` output and a key-name scan that discarded values. `git check-ignore` does not ignore the tracked `.env`.
- Recommended remediation: Rotate every listed credential at the provider and on the server. Remove both files from the index and from history. Keep only `.env.example` with empty placeholders. Do not paste the old values into chat or into this report.
- Verification method: `git ls-files` no longer lists either path; a fresh clone has no secret assignments; the old values are rejected by MySQL, JWT verification, Zarinpal, the SMS panel, and the model provider.
- Responsible agent: security-auditor, mysql-security
- Current status: open, awaiting approval. History rewrite is high impact.

### AUTH-001 — Unsigned base64 JSON is accepted as a session

- Finding ID: AUTH-001
- Vulnerability name: Authentication bypass via forged base64 token
- Severity: CRITICAL
- Confidence: confirmed
- Affected file: `metatest/src/backend/middleware/auth.js` lines 90–101
- Technical explanation: After `jwt.verify` fails, if the token contains no `.` the middleware base64-decodes it, `JSON.parse`s it, and if `id` is present sets `req.user` to that id and role. There is no signature, expiry, or database lookup.
- Potential impact: A caller can send `x-app-token` set to the base64 of `{"id":<any user id>}` and pass `requireToken` on `/api/flow`, dashboard, payments, AI routes, and avatar upload.
- Evidence: Re-read of `auth.js` lines 94–101. Guest login is the historical issuer; the verifier does not check the issuer.
- Recommended remediation: Delete the base64 fallback. Issue signed JWTs for guests. Reject tokens that fail `jwt.verify`.
- Verification method: A unit test sends `Buffer.from(JSON.stringify({id:1})).toString('base64')` and expects 401. A valid JWT still authenticates.
- Responsible agent: api-security
- Current status: open, awaiting approval. Removing it logs out any client that still stores a legacy guest token.

### AUTH-002 — A static `APP_TOKEN` becomes user 1 with role admin

- Finding ID: AUTH-002
- Vulnerability name: Shared secret impersonates the first user
- Severity: CRITICAL
- Confidence: confirmed
- Affected file: `metatest/src/backend/middleware/auth.js` lines 107–110
- Technical explanation: If the presented token string equals `process.env.APP_TOKEN`, the middleware sets `req.user = { id: 1, role: 'admin' }` without a JWT. The value is present in the tracked files from SEC-001. This report does not repeat it.
- Potential impact: Repository readers can call student and admin-role checks that trust `req.user.role` as user 1.
- Evidence: Re-read of lines 107–110. Key name `APP_TOKEN` confirmed in the tracked env files.
- Recommended remediation: Remove this fallback. Use a separate internal credential that does not map onto a user row. Rotate `APP_TOKEN` even if the code path is deleted, because it may be reused elsewhere.
- Verification method: The old token value returns 401. Internal routes still require `INTERNAL_SERVICE_KEY` only.
- Responsible agent: api-security
- Current status: open, awaiting approval.

### DATA-001 — Full database dumps are in the repository

- Finding ID: DATA-001
- Vulnerability name: Production-style database dumps committed
- Severity: HIGH
- Confidence: confirmed
- Affected file: `quiz_app (full database).sql` (29,525,666 bytes), `tamapp_db .sql` (34,193,335 bytes), `metatest/quiz_app(full_Database).txt`, `tamapp_worldcup_predictor.sql` (smaller)
- Technical explanation: Headers are phpMyAdmin dumps with `INSERT` data, not schema-only migrations. The audit did not read row contents.
- Potential impact: Account, quiz, payment, and phone data may be in git history, including password hashes.
- Evidence: File sizes, phpMyAdmin header lines, `git ls-files`.
- Recommended remediation: Remove the dumps from the tree and from history after a copy is stored in an approved backup location outside git. Add `*.sql` dumps to `.gitignore`, with an exception for the small migration files under `metatest/src/backend/sql/` and `ai-teacher/sql/` once SEC-001's misnamed file is gone.
- Verification method: `git log --all -- '*quiz_app*'` and the tamapp dump path return nothing after the history rewrite. Schema migrations remain.
- Responsible agent: mysql-security
- Current status: open, awaiting approval. Do not delete the only backup if it is not stored elsewhere.

### UP-001 — Avatar upload keeps the client extension and is publicly served

- Finding ID: UP-001
- Vulnerability name: Unrestricted profile-image upload to the web root
- Severity: HIGH
- Confidence: confirmed
- Affected file: `metatest/src/backend/server.js` lines 84–94 and 116; `userController.js` lines 980–1009
- Technical explanation: Multer disk storage appends `path.extname(file.originalname)`. There is no allowlist, no magic-byte check, and no re-encode. `shell.php` is stored as `.php`, `x.htaccess` as `.htaccess`, `foo.html` as `.html`. The directory is `public_html/avatars` in the production layout and is mounted with `express.static`.
- Potential impact: Stored XSS via HTML or SVG on this origin. Public hosting of arbitrary files. This is the precondition for UP-002. It is not, by itself, proof of RCE. Node does not execute the saved file.
- Evidence: Re-read of `server.js` and a local `path.extname` check. Full write-up in `file-upload-security.md`. The profile UI crops to JPEG; the server does not.
- Recommended remediation: Allow JPEG, PNG, and WebP only. Sniff magic bytes, re-encode with `sharp`, and store `crypto.randomBytes` names. Never use the client filename.
- Verification method: Regression tests in `file-upload-security.md`. A text file named `.php` is rejected and is absent from the avatar directory.
- Responsible agent: web-security
- Current status: open, awaiting approval.

### IDOR-001 — `checkAnswer` writes progress for a client-supplied user id

- Finding ID: IDOR-001
- Vulnerability name: Broken object-level authorization on answer checking
- Severity: HIGH
- Confidence: confirmed
- Affected file: `metatest/src/backend/controllers/quizController.js` line 707, with writes to `tam24_user_answers` and `tam24_users` later in `handleCheckAnswer` (trophy and XP updates around lines 833–863)
- Technical explanation: `userId` is `Number(req.body.user_id)` when that value is non-zero, otherwise `req.user.id`. The SQL parameters are bound, so this is not SQL injection. The authorization decision uses the attacker's chosen id.
- Potential impact: Any caller who passes `requireToken` can add or change another user's answers, trophies, and XP.
- Evidence: Re-read of line 707.
- Recommended remediation: Ignore `req.body.user_id`. Use `req.user.id` only.
- Verification method: Authenticated request with a different `user_id` does not change the victim row.
- Responsible agent: api-security
- Current status: open, awaiting approval.

### IDOR-002 — Quiz result lookup accepts any user id

- Finding ID: IDOR-002
- Vulnerability name: Cross-user quiz result disclosure
- Severity: HIGH
- Confidence: confirmed
- Affected file: `metatest/src/backend/controllers/quizWorldController.js` lines 2983–3023
- Technical explanation: `handleGetQuizResultByUserAndQuiz` reads `userId` and `quizId` from the body and selects `summary_json` and `result_data_json` for that pair. It does not compare `targetUserId` with `req.user.id`.
- Potential impact: Any authenticated caller can read another user's quiz result, score, and stored answer payload.
- Evidence: Re-read of the handler. The comment says it is used when clicking avatars, which explains the missing check and does not authorize it.
- Recommended remediation: Require the target user to be the caller, or require a public quiz plus an explicit visibility rule.
- Verification method: User A requesting user B's result receives 403.
- Responsible agent: api-security
- Current status: open, awaiting approval. The avatar click feature needs a product decision.

### IDOR-003 — Question-bank answer key is available to any token

- Finding ID: IDOR-003
- Vulnerability name: Missing entitlement check on answer keys
- Severity: HIGH
- Confidence: confirmed
- Affected file: `metatest/src/backend/controllers/quizWorldController.js` lines 622–656
- Technical explanation: `handleGetBankQuestionAnswer` loads `is_correct`, `correct_option_id`, and `descriptive_answer` for any positive `question_id`. The route sits behind `requireToken` on `/api/flow` and does not check a quiz attempt or a subscription.
- Potential impact: The bank of correct answers can be enumerated. AUTH-001 makes the token requirement easy to satisfy.
- Evidence: Re-read of the response JSON at lines 649–656.
- Recommended remediation: Return the key only after a submitted attempt, or to an entitled role. Rate-limit the action.
- Verification method: A normal student token without an attempt does not receive `correct_option_id`.
- Responsible agent: api-security, mysql-security
- Current status: open, awaiting approval. This can change the practice-mode UX.

### AUTH-004 — Student session cookie is readable by script

- Finding ID: AUTH-004
- Vulnerability name: JWT stored in a non-HttpOnly cookie
- Severity: HIGH
- Confidence: confirmed
- Affected file: `metatest/src/lib/authApi.ts` lines 58–59; legacy cookie in `metatest/src/views/AuthView.tsx` line 66
- Technical explanation: `setAuthCookie` sets `auth_token` from JavaScript with `secure` and `samesite=strict` and without `httpOnly`. `AuthView` also sets `token` for one year with no `Secure`, `HttpOnly`, or `SameSite`. The API then expects the script to copy the cookie into `x-app-token`.
- Potential impact: Any XSS reads the JWT and replays it. The legacy cookie is also sent on insecure HTTP if a non-HTTPS origin is used.
- Evidence: Re-read of both assignments. Admin cookies in `adminAuth.js` are `httpOnly`, which shows the safer pattern already exists in the project.
- Recommended remediation: Set the session cookie from the server with `httpOnly`, `secure`, and `sameSite=strict` or `lax`, and read it in `requireToken`. Stop writing tokens from `document.cookie`. This is a cross-cutting auth change.
- Verification method: `document.cookie` does not contain the token; API calls still authenticate via the cookie.
- Responsible agent: web-security
- Current status: open, awaiting approval. Breaking change for every client that copies the cookie into a header.

### AUTH-005 — `DEV_MODE=true` disables authentication

- Finding ID: AUTH-005
- Vulnerability name: Developer mode authentication bypass
- Severity: HIGH
- Confidence: confirmed as a code path. Not enabled in the tracked env (`DEV_MODE=false`).
- Affected file: `metatest/src/backend/middleware/auth.js` lines 49–53
- Technical explanation: The string `true` sets `req.user` to `{ id: 999, role: 'developer' }` and returns before token checks.
- Potential impact: A production process started with that variable accepts every request as user 999.
- Evidence: Re-read of lines 49–53. Tracked env value is `false`.
- Recommended remediation: Refuse to boot when `DEV_MODE=true` and `NODE_ENV=production`. Prefer deleting the bypass.
- Verification method: Startup throws in that combination. A request without a token returns 401.
- Responsible agent: api-security
- Current status: open.

### AUTH-006 — Legacy admin passwords and a default bootstrap password

- Finding ID: AUTH-006
- Vulnerability name: MD5 and predictable admin passwords still verify
- Severity: HIGH
- Confidence: confirmed in code. Whether a legacy row still exists was not checked, because production data was not queried.
- Affected file: `metatest/src/backend/utils/password.js` lines 39–77; `metatest/src/backend/middleware/adminAuth.js` lines 304–319
- Technical explanation: `verifyAdminPassword` accepts scrypt, 32-hex MD5, and the password `Admin@` plus the numeric suffix of username `adminN`. `ensureSuperAdmin` inserts a super admin with `ADMIN_BOOTSTRAP_PASSWORD` or the literal `Admin@1` when id 1 is missing.
- Potential impact: Predictable admin access on databases that still have legacy rows, and on a fresh database that was seeded with the default.
- Evidence: Re-read of both functions. The seed logs a warning to change the password. It does not force a change.
- Recommended remediation: Accept only scrypt. Remove the MD5 and `Admin@n` branches after a controlled reset. Require `ADMIN_BOOTSTRAP_PASSWORD` when seeding, and force a password change on first login.
- Verification method: `Admin@1` fails against a scrypt-only row. A missing env var does not seed a known password.
- Responsible agent: mysql-security
- Current status: open, awaiting approval.

### RATE-001 — OTP and password login are not rate limited

- Finding ID: RATE-001
- Vulnerability name: Missing rate limit on authentication actions
- Severity: HIGH
- Confidence: confirmed
- Affected file: `metatest/src/backend/middleware/auth.js` lines 37–39 (public actions) and `userController.js` OTP insert path (plaintext code stored around the `tam24_otps` insert)
- Technical explanation: `send_otp`, `verify_otp`, and `password_login` skip `requireToken` and no limiter was found in front of them. Admin login has a separate limiter. AI routes have their own limiters. `/api/flow` as a whole does not.
- Potential impact: SMS cost abuse, OTP guessing, and password spraying.
- Evidence: Public-action list re-read. Specialist pass found no throttle in `handleSendOtp`.
- Recommended remediation: Per-phone and per-IP limits with a short lockout. Hash OTP codes at rest. Keep the existing TTL.
- Verification method: The N+1 request for the same phone in a minute returns 429. A database read of `tam24_otps.code` is not the raw code.
- Responsible agent: api-security
- Current status: open.

### XSS-001 — Quiz and note views render stored HTML

- Finding ID: XSS-001
- Vulnerability name: Stored HTML rendered without sanitization
- Severity: HIGH
- Confidence: confirmed
- Affected file: `metatest/src/views/ReportsView.tsx` (dangerouslySetInnerHTML around lines 211 and 260); `metatest/src/views/NotesView.tsx` (around lines 204, 290, 330, 357)
- Technical explanation: Question and note HTML from the API is inserted as HTML. No sanitizer was found on those paths. Blog HTML has a partial `safeHtml` strip (`BlogPostPage.tsx` / `blog.ts`) which is not a full sanitizer. Met chat replies go through a text/markdown renderer (`RichText.tsx`) and are not in this finding.
- Potential impact: Script in question HTML runs in every student's browser and can read `auth_token` because of AUTH-004.
- Evidence: Specialist pass with line citations, accepted by the Lead as consistent with the file names and the known `dangerouslySetInnerHTML` usage. Treat content as stored HTML, not as a confirmed malicious row (rows were not read).
- Recommended remediation: Sanitize on write and on render with a maintained allowlist, or render through the existing MathJax text path without raw HTML.
- Verification method: A question whose text contains a script tag does not execute in Reports and Notes.
- Responsible agent: web-security
- Current status: open. Sanitizing may affect legitimate question markup. Needs a content review.

### ERR-001 — SQL errors are returned to API clients

- Finding ID: ERR-001
- Vulnerability name: Database error disclosure
- Severity: MEDIUM
- Confidence: confirmed
- Affected file: `metatest/src/backend/reportError.js` lines 8–27; `metatest/src/backend/server.js` lines 539–547; `metatest/src/backend/routes/adminRoutes.js` around lines 187–191
- Technical explanation: `reportError` prefers `error.sqlMessage` and returns the first 300 characters. The `/api/flow` catch block sends that string as `detail`. The admin router also interpolates `sqlMessage` into the JSON message.
- Potential impact: Schema and query details leak to callers.
- Evidence: Re-read of `reportError.js` and the flow catch block.
- Recommended remediation: Log the SQL text on the server. Return a generic message when `NODE_ENV=production`.
- Verification method: A forced SQL error response has no `sqlMessage` substring.
- Responsible agent: mysql-security
- Current status: open.

### SQL-001 — `ORDER BY FIELD` interpolates stored question ids

- Finding ID: SQL-001
- Vulnerability name: Second-order SQL interpolation
- Severity: MEDIUM
- Confidence: confirmed for the query shape. Exploitability depends on a non-numeric value already stored in `quizzes.question_ids`.
- Affected file: `metatest/src/backend/controllers/quizWorldController.js` lines 1414–1436
- Technical explanation: `question_ids` is JSON from the row, then joined into `ORDER BY FIELD(q.id, ${questionIds.join(',')})`. The `IN (?)` list is parameterized. The same file has `parseQuestionIds()` and does not use it here.
- Potential impact: If an attacker can store a non-numeric token in that column, the next read executes it as SQL.
- Evidence: Re-read of line 1435.
- Recommended remediation: Map ids through `parseQuestionIds()` and reject the row otherwise. Or sort in JavaScript.
- Verification method: A fixture value `1);select 1;--` does not change the SQL text. The query uses only integers.
- Responsible agent: mysql-security
- Current status: open.

### UP-003 — Blog uploads trust the client MIME type

- Finding ID: UP-003
- Vulnerability name: Admin media upload without content sniffing
- Severity: MEDIUM
- Confidence: confirmed
- Affected file: `metatest/src/backend/blog/upload.js` lines 9–40
- Technical explanation: The extension is chosen from `file.mimetype`. Bytes are not sniffed. Files land in `{webRoot}/blog-media` and are served statically. The route requires an admin session and the blog section.
- Potential impact: An admin session, or an attacker who stole one, can store polyglot content on the origin.
- Evidence: Re-read of `TYPES` and `fileFilter`.
- Recommended remediation: Sniff images the same way as `questionImages.js`. Keep video types on an allowlist and do not derive the extension from the client MIME alone.
- Verification method: `image/png` with a text body is rejected.
- Responsible agent: web-security
- Current status: open.

### UP-004 — AI uploads are public once the URL is known

- Finding ID: UP-004
- Vulnerability name: Missing authorization on AI file downloads
- Severity: MEDIUM
- Confidence: confirmed
- Affected file: `metatest/src/backend/ai-teacher/services/fileStorage.js` lines 22–27 and 99–101; `server.js` line 117
- Technical explanation: Uploads require a user token and, for images and PDF, magic bytes. Download is `express.static` on the whole web root. Audio is accepted on MIME type only. If `sharp` fails, original image bytes are kept.
- Potential impact: A leaked URL exposes another user's image, voice note, or PDF. Audio content type is spoofable within the audio extension map.
- Evidence: Re-read of `saveBuffer`, `assertContent`, and the static mount.
- Recommended remediation: Stream files through a handler that checks `tam24_ai_files.user_id`. Sniff audio. Do not persist bytes that `sharp` cannot decode.
- Verification method: User B receives 404 for user A's file id and for the raw path.
- Responsible agent: web-security, api-security
- Current status: open.

### UP-006 — Admin PDF bytes are not checked

- Finding ID: UP-006
- Vulnerability name: PDF library accepts any base64 payload
- Severity: MEDIUM
- Confidence: confirmed
- Affected file: `metatest/src/backend/controllers/adminController.js` PDF save (filename forced to `.pdf`, directory `{webRoot}/files/pdfs`)
- Technical explanation: The AI uploader checks for `%PDF-`. The admin PDF library path does not. The object is then statically served.
- Potential impact: Non-PDF content is hosted with a `.pdf` name. Admin-only.
- Evidence: Comparison of `fileStorage.js` `sniff` with the admin save path reviewed in the infrastructure pass and spot-checked by the Lead via the upload inventory.
- Recommended remediation: Require a `%PDF-` prefix and a size cap before `writeFile`.
- Verification method: Base64 of the ASCII word `hello` is rejected.
- Responsible agent: web-security
- Current status: open.

### INT-001 — Internal routes are open when the key is unset outside production

- Finding ID: INT-001
- Vulnerability name: Internal API fail-open
- Severity: MEDIUM
- Confidence: confirmed
- Affected file: `metatest/src/backend/server.js` lines 46–53
- Technical explanation: If `INTERNAL_SERVICE_KEY` is empty and `NODE_ENV !== 'production'`, `requireInternalService` calls `next()`. The tracked `.env` sets `NODE_ENV=development`. The duplicate secret file sets `production` and does set the key. A host that copies the tracked `.env` and then clears the key would expose grade and member routes.
- Potential impact: Unauthenticated grading and result writes on any process that is not exactly `NODE_ENV=production`.
- Evidence: Re-read of lines 49–53.
- Recommended remediation: Always require the key. Use a separate local stub only in tests.
- Verification method: Unset key returns 401 in development and production.
- Responsible agent: api-security
- Current status: open.

### HDR-001 — Main Express app sets no security headers

- Finding ID: HDR-001
- Vulnerability name: Missing Helmet, CSP, and frame protections
- Severity: MEDIUM
- Confidence: confirmed
- Affected file: `metatest/src/backend/server.js` (no `helmet` import and no `X-Frame-Options` / CSP `setHeader`)
- Technical explanation: The lobby service sets Helmet. The main API does not. CORS allows the configured origins plus any request with no `Origin` (lines 99–104), with credentials.
- Potential impact: Clickjacking of cookie-authenticated pages. XSS impact is higher without a CSP. Missing `Origin` is normal for non-browser clients and is not itself a browser CORS bypass.
- Evidence: Read of the middleware section of `server.js`. Lobby Helmet noted by the infrastructure pass.
- Recommended remediation: Add Helmet with a CSP that still allows the MathJax and Vite asset hosts you actually use. Keep credentialed CORS on an explicit origin list.
- Verification method: Response includes `X-Content-Type-Options: nosniff` and a CSP. A foreign browser origin is not reflected.
- Responsible agent: infrastructure-security
- Current status: open. CSP can break MathJax if copied from a default template. Needs a staged check.

### PAY-001 — Payment result token reveals a wide profile

- Finding ID: PAY-001
- Vulnerability name: Payment receipt over-disclosure
- Severity: MEDIUM
- Confidence: confirmed by the API pass; Lead confirmed the signing fallback and the route class, and accepts the field list from the specialist read of `paymentController.js` lines 895–1038
- Affected file: `metatest/src/backend/controllers/paymentController.js`
- Technical explanation: The result endpoint is authorized by an HMAC of the payment id, with fallback secret `JWT_SECRET` or the literal `change-me-payment-result-secret` (`paymentController.js` near lines 114–116, and `utils/sandboxCheckout.js`). The handler returns phone, email, last login, and last login IP along with payment metadata. A failed Zarinpal callback can cancel a pending payment by id (`paymentController.js` near lines 725–766) without a matching authority.
- Potential impact: Link holders see PII. A guessable id can cancel a pending checkout. A default HMAC secret forges result links if the env secret is missing.
- Evidence: API specialist citations plus the known default-secret pattern. Lead did not dump a live payment row.
- Recommended remediation: Minimum receipt fields, one-time token bound to the user, mandatory `PAYMENT_RESULT_SECRET`, and cancellation only with the provider authority.
- Verification method: Anonymous result JSON has no phone or IP. A cancel without `Authority` does not change status.
- Responsible agent: api-security
- Current status: open. Payment flow changes need a careful regression test.

### DEP-001 — Known vulnerable direct dependencies

- Finding ID: DEP-001
- Vulnerability name: npm audit findings in the quiz app
- Severity: HIGH for the highest direct advisories (multer, mysql2, axios, sharp, react-router-dom, nanoid). Two critical advisories are transitive (`protobufjs`, `websocket-driver`).
- Confidence: confirmed as scanner output. Exploitability on this app was not proven.
- Affected file: `metatest/package.json` and `metatest/package-lock.json`
- Technical explanation: `npm audit --omit=dev` on 2026-11-23 reported 16 issues. Installed versions include axios 1.13.5, multer 2.1.1, mysql2 3.20.0, sharp 0.34.5, nanoid 5.1.9, react-router-dom 7.14.2. Details and compatibility notes are in `dependency-audit.md`.
- Potential impact: DoS in multer and mysql2, credential leakage via a mysql auth-plugin downgrade, axios SSRF/header issues depending on how axios is called, image-library bugs in sharp.
- Evidence: `/tmp` audit JSON summarized in `dependency-audit.md`. No packages were upgraded.
- Recommended remediation: Upgrade in a dedicated change after tests. `sharp` wants 0.35.5, which npm marks as a semver-major bump from 0.34.
- Verification method: `npm audit` counts drop for the direct packages, and avatar/AI image tests still pass.
- Responsible agent: dependency-security
- Current status: open. Not approved for automatic upgrade.

### SUP-001 — Backend `node_modules` is partly committed

- Finding ID: SUP-001
- Vulnerability name: Vendored dependency tree in git
- Severity: LOW
- Confidence: confirmed
- Affected file: `metatest/src/backend/node_modules` (543 tracked files)
- Technical explanation: The backend package directory has its own `package.json` and a large tracked `node_modules`. The root and `metatest` gitignores ignore `node_modules`, but tracked files remain.
- Potential impact: Stale or unexpected code is what the server loads if Node resolves this folder first. Reviews miss transitive changes.
- Evidence: `git ls-files metatest/src/backend/node_modules | wc -l` = 543.
- Recommended remediation: Remove the directory from the index after confirming production installs dependencies at deploy time. Do not delete the live server's modules as part of a git change.
- Verification method: `git ls-files` count is 0 and `npm ci` in a clean checkout still runs the server.
- Responsible agent: dependency-security
- Current status: open.

## Suspected vulnerabilities

### UP-002 — Uploaded `.php` may be executed by LiteSpeed

- Finding ID: UP-002
- Vulnerability name: Conditional remote code execution via avatar upload
- Severity: CRITICAL if the hosting condition is true
- Confidence: suspected
- Affected file: same as UP-001; hosting config is not in the repository
- Technical explanation: The application writes `.php` into `public_html/avatars` and LiteSpeed is the documented public server. PHP 8.2 and 8.4 appear in dump headers from the machines that exported the databases. The repo has no PHP handler configuration, and `express.static` will not execute PHP. An uploaded `.htaccess` could change handlers only when overrides are enabled.
- Potential impact: Code execution as the hosting account user, then database credentials from the local env file.
- Evidence: `runtimeMode.js`, `server.js` LiteSpeed comment, `.htaccess` scope limited to `/app/`, phpMyAdmin headers. No live request was sent.
- Recommended remediation: On the server, confirm a harmless `.txt` file renamed in a private check is not executed. Disable script handlers on upload directories. Apply the UP-001 re-encode regardless.
- Verification method: A file whose body is the text `not-php` and whose name ends in `.php` is either rejected by the app or returned as `text/plain` / download by the web server, never as a PHP result.
- Responsible agent: infrastructure-security
- Current status: suspected. Needs a human with panel access. Do not upload a webshell to check.

### CSRF-001 — Admin cookie `SameSite=Lax` on cookie-authenticated actions

- Finding ID: CSRF-001
- Vulnerability name: Possible cross-site use of the admin cookie
- Severity: MEDIUM
- Confidence: suspected
- Affected file: `metatest/src/backend/middleware/adminAuth.js` cookie options around lines 40–46; CORS `credentials: true` in `server.js` lines 99–109
- Technical explanation: The admin cookie is `httpOnly` and `sameSite=lax`. Lax cookies are sent on cross-site top-level GET navigations. State-changing GET handlers were not fully enumerated. POST actions that require a custom header are not CSRF-able from another origin. Student APIs use a header token, which blocks classic CSRF.
- Potential impact: A cross-site GET could trigger an admin action if one exists and relies only on the cookie.
- Evidence: Cookie flags re-read by the infrastructure pass. No concrete state-changing GET was confirmed by the Lead.
- Recommended remediation: `SameSite=Strict` for the admin cookie, and a CSRF token for any cookie-authenticated POST.
- Verification method: Inventory of admin routes shows no state change on GET, or each POST requires a CSRF token.
- Responsible agent: api-security
- Current status: suspected.

### RBAC-001 — Unmapped `Admin_*` flow actions default to allowed

- Finding ID: RBAC-001
- Vulnerability name: Default-allow for unknown admin flow actions
- Severity: MEDIUM
- Confidence: confirmed code; impact depends on which actions omit a section map
- Affected file: `metatest/src/backend/admin/access.js` lines 124–127
- Technical explanation: `isActionAllowed` returns true when `sectionsForAction` has no entry. A section-restricted admin can call an unmapped `Admin_*` action through `/api/flow`.
- Potential impact: Privilege expansion inside the admin panel.
- Evidence: API specialist citation of lines 124–127. Lead did not diff every action against the map, so the practical exposure of a specific action stays qualified.
- Recommended remediation: Default deny. Register every action.
- Verification method: An unknown `Admin_not_a_real_action` returns 403 for a limited admin.
- Responsible agent: api-security
- Current status: open.

## Informational

### INFO-001 — Next.js is not the architecture

No `next.config.*`, no App Router, no Server Actions. The Next.js checklist was applied to the Express and Vite code instead. See `nextjs-security-audit.md`.

### INFO-002 — Avatar UI cookie name

`ProfileView.tsx` line 472 reads cookie `token`, which `AuthView.tsx` sets. The newer client sets `auth_token`. Both can exist. This is a functional inconsistency, not a second auth bypass.

### INFO-003 — Positive controls already present

- Student and admin password hashing can use scrypt.
- AI image and PDF uploads check magic bytes and generate random names.
- Question images check magic bytes and reject path-like names via `safeImageName`.
- Admin session cookie is `httpOnly`.
- Most SQL uses `?` placeholders.
- `password_hash` is stripped before the profile JSON in `userController.js`.
- Lobby JWT verification does not implement the base64 fallback.

### UP-005 — Question images are not re-encoded

- Severity: LOW
- Confidence: confirmed
- File: `questionImages.js` lines 156–164
- Impact: polyglot image bytes under an image extension, admin-only.
- Remediation: re-encode with `sharp` the same way as avatars.
- Status: open, lower priority than UP-001.

## Duplicate findings removed

- The answer-key issue is IDOR-003 only (API and MySQL passes both reported it).
- The base64 token is AUTH-001 only.
- `APP_TOKEN` is AUTH-002 only.
- SQL error text is ERR-001 only.
- Internal fail-open is INT-001 only.
- Avatar RCE is split into confirmed UP-001 and suspected UP-002 so the hosting condition is not described as a proven exploit.

## Approval gate

No application file was changed. The proposed fix order and the breaking changes are in `critical-vulnerabilities.md` and `remediation-log.md`.
