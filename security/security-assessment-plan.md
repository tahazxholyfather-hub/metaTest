# Security assessment plan

Date: 2026-11-23.
Phase: initial assessment complete. Remediation has not started.

## Objective

Build a repeatable security process for this repository and investigate the reported issue first:

> Users can upload profile images with arbitrary extensions, including `.php`, leading to remote code execution.

The runtime is Node.js + Express behind a cPanel/LiteSpeed-style layout. PHP execution is a hosting property, not an application property. It is not assumed.

## Team and what each pass covered

| Agent | Scope in this pass | Output |
| --- | --- | --- |
| Lead | Architecture, evidence check, deduplication, severity | This plan and `security-report.md` |
| security-auditor | Secrets, auth bypass, unsafe file handling | Findings SEC-001, AUTH-001, AUTH-002, UP-001 |
| web-security | Every upload path, XSS sinks, execution sinks | `file-upload-security.md` |
| api-security | Routes, IDOR, CSRF, rate limits, CORS | API findings in `security-report.md` |
| mysql-security | `mysql2` usage, dumps, password storage | `mysql-security.md` |
| infrastructure-security | Web root, static mounts, headers, what hosting we cannot see | `infrastructure-audit.md` |
| dependency-security | `npm audit` on `metatest/` | `dependency-audit.md` |
| security-verifier | No fixes exist yet. Records what was independently re-read | `verification-report.md` |

The Lead re-read the code for every finding marked confirmed. Findings that depend on the live vhost stay suspected.

## Rules for this assessment

- Read-only against the git tree.
- No production database access.
- No exploit payloads and no execution of uploaded content.
- No package installs. `npm audit` uses the npm that is already installed.
- Semgrep, Gitleaks, Trivy, OSV-Scanner, OWASP Dependency-Check, and OWASP ZAP are not installed here. They were not installed, because the start instructions require approval before new packages.
- ZAP is not pointed at production. No staging URL was authorized.
- Secret values are not copied into these documents.

## Phases

| Phase | State | Notes |
| --- | --- | --- |
| 1. Discovery | Done | `project-architecture.md` |
| 2. Upload / RCE investigation | Done | Confirmed unrestricted upload. RCE not confirmed |
| 3. Full audit | Done | Auth, IDOR, SQL, XSS, headers, dependencies, secrets |
| 4. Consolidated report | Done | `security-report.md` |
| 5. Human approval | Waiting | No application edits until Amir approves a fix set |
| 6. Remediation | Not started | Proposed in `critical-vulnerabilities.md` |
| 7. Regression tests | Not started | Plan in `file-upload-security.md` |
| 8. Independent verification | Not started | `verification-report.md` is a pre-fix record |
| 9. Final assessment | Not started | After fixes and a second scan |

## Priority order proposed for approval

1. Rotate every credential named in SEC-001 and remove the tracked secret files and database dumps from git history. This is operational, not only a code change.
2. Remove the unsigned base64 session and the `APP_TOKEN` user impersonation (AUTH-001, AUTH-002).
3. Harden avatar upload: content allowlist, re-encode, random names, no client extension (UP-001). Add a non-executable storage control that this hosting can actually apply (UP-002).
4. Stop trusting client `user_id` and stop returning other users' quiz results and the raw answer key (IDOR-001, IDOR-002, IDOR-003).
5. Stop returning SQL error text. Rate-limit OTP and login.
6. Dependency updates as a separate, tested change. Do not combine them with the auth fix.

## Explicitly deferred until approval

- Editing `server.js`, controllers, or frontend auth cookies.
- Adding or upgrading npm packages (`helmet`, `sharp` major, `multer`, `mysql2`, `axios`).
- Deleting or rewriting git history.
- Writing `.htaccess` into a live `public_html`.
- Scanning `https://metatest.app`.
