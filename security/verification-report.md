# Verification report

Date of the first pass: 2026-11-23.
Claim re-checked: 2026-11-24. A report that the RCE issue was fixed was compared with the tree on `cursor/security-audit-aaa7` at `f5a82b9c` and with `origin/beforMain` at `b26d0e95`.

Phase: the claimed fix is not in this repository. Nothing is marked Verified Fixed.

Verifier stance: the Lead re-opened the cited lines for the confirmed items below. Specialist reports were not accepted on citation alone when the finding is critical.

## Classification

| ID | Class | Why |
| --- | --- | --- |
| SEC-001 | Not Fixed | `git ls-files` still lists `metatest/src/backend/.env` and `004_iranian_teachers.sql`. Values were not printed. Key names were checked. |
| AUTH-001 | Not Fixed | `auth.js` lines 94–101 still accept unsigned base64 JSON with an `id`. |
| AUTH-002 | Not Fixed | `auth.js` lines 107–110 still map `APP_TOKEN` to user 1. |
| DATA-001 | Not Fixed | Dump files are still in the tree. Row data was not opened. |
| UP-001 | Not Fixed | `server.js` lines 84–94 still append `path.extname(file.originalname)` and set no `fileFilter`. Local check: `path.extname('shell.php') === '.php'`. |
| UP-002 | Unable to Verify | Needs the live LiteSpeed/PHP handler. Not tested, on purpose. |
| IDOR-001 | Not Fixed | `quizController.js` line 707 still prefers `req.body.user_id`. |
| IDOR-002 | Not Fixed | `handleGetQuizResultByUserAndQuiz` still queries the body `userId` with no owner check (lines 2987–3023). |
| IDOR-003 | Not Fixed | `handleGetBankQuestionAnswer` still returns `correct_option_id` (lines 649–656). |
| AUTH-004 | Not Fixed | `authApi.ts` line 59 still sets `auth_token` from JavaScript without `httpOnly`. |
| AUTH-006 | Not Fixed | `password.js` lines 69–77 still accept MD5 and `Admin@{n}`. |
| ERR-001 | Not Fixed | `reportError.js` lines 10–11 still prefer `sqlMessage`, and `server.js` line 546 still sends it. |
| SQL-001 | Not Fixed | `quizWorldController.js` line 1435 still interpolates `questionIds.join(',')`. |
| DEP-001 | Not Fixed | `npm audit` still reports 2 critical and 11 high. No upgrade was applied. |
| UP-003, UP-004, UP-006, HDR-001, INT-001, RATE-001 | Not Fixed | Code matches the report. No patch. |
| CSRF-001 | Unable to Verify | No state-changing admin GET was proven. |
| XSS-001 | Not Fixed | `dangerouslySetInnerHTML` remains. A malicious question row was not planted. |

## Scanner re-run

Not applicable. Scanners will be re-run after a fix exists.

This pass ran `npm audit` once. Semgrep, Gitleaks, Trivy, OSV-Scanner, Dependency-Check, and ZAP did not run because they are not installed and were not approved for install. ZAP was not aimed at production.

## Functionality

No runtime regression test was executed against the quiz UI. The application was not modified, so existing behavior is unchanged and also unproven by a fresh test run in this workspace.

## Claim received on 2026-11-24: the RCE issue is fixed

Independent check of the upload path. No webshell was uploaded and production was not contacted.

| Check | Result |
| --- | --- |
| `metatest/src/backend/server.js` lines 80–94 | Still `diskStorage`. The stored name is `avatar-` + time + `Math.random` + `path.extname(file.originalname)`. Comment on line 86 still says the original extension is kept. |
| `fileFilter`, magic bytes, or `sharp` on `POST /api/upload_avatar` | Absent. `grep` of `server.js` has no `fileFilter`. |
| `express.static` on `/avatars` | Still line 116. Saved files stay on the public web root. |
| `.htaccess` denying PHP | Only `metatest/public/.htaccess`, which rewrites `/app/` to the SPA. No rule for `avatars/`. |
| New commits on `beforMain` or `main` after the audit | None. `origin/beforMain` is still `b26d0e95`. `server.js` history on GitHub does not contain an upload-hardening commit. |
| Handler passes the saved path to `child_process` or `eval` | Still no. Node itself still does not execute the file. |

Classification:

- UP-001: **Not Fixed.** A client can still choose `.php`, `.phtml`, `.html`, `.svg`, or `.htaccess`.
- UP-002: **Unable to Verify.** This tree cannot show whether LiteSpeed executes PHP in `public_html/avatars`. A hosting change outside git would not appear here. The application still writes the dangerous file, so the reported condition is still present in code.

Rejecting names that end in `.php` would also fail this check. That rejection is not in the code either.

## Remaining attack surface after a future UP-001 patch

Even with re-encoded avatars, these stay open until their own fixes land:

- AUTH-001 and AUTH-002
- Public AI and blog files
- IDOR on quiz results and answer keys
- Committed secrets and dumps
- PHP handlers on old files already stored in `avatars/`, if any exist on the server. This audit did not list the production directory.
