# Dependency audit

Agent: dependency-security.
Date: 2026-11-23.
Command: `npm audit --json --omit=dev` in `metatest/`.
Exit code: 1.
No package was upgraded or installed.

## Tools

| Tool | Result |
| --- | --- |
| npm audit | Ran against `metatest/package-lock.json` |
| OSV-Scanner | Not installed. Not installed, pending approval |
| Trivy | Not installed |
| OWASP Dependency-Check | Not installed |
| Semgrep / Gitleaks | Not installed. Secret detection was a manual key-name scan, not a full history scan |

Other lockfiles exist and were not all audited in this pass: repository root `cellapp`, `web-game`, `gleam`, `luma`, `drift`, `chemball`, `ai-character`, `metatest/src/backend`, `metatest/realtime-lobby-service`. The quiz app is the production dependency set. Audit those lockfiles in the same way before a blanket upgrade.

## Scanner totals (`metatest`, production dependencies)

| Severity | Count |
| --- | --- |
| Critical | 2 |
| High | 11 |
| Moderate | 3 |
| Low | 0 |
| Total | 16 |

## Direct dependencies called out by npm

Installed versions are from `metatest/package-lock.json`.

| Package | Installed | Audit range | Severity | npm fix available | Compatibility note |
| --- | --- | --- | --- | --- | --- |
| axios | 1.13.5 | 1.0.0–1.19.0 | high | yes | Review call sites before bumping. Advisories cited include a `NO_PROXY` bypass and prototype-pollution in `validateStatus`. Do not treat this as proven SSRF in this app. |
| multer | 2.1.1 | <=2.4.0 | high | yes | DoS via nested fields and aborted uploads. Avatar and AI uploads both use multer. Upgrade with the upload tests. |
| mysql2 | 3.20.0 | <=3.23.0 | high | yes | Auth-plugin downgrade and zlib bomb advisories. Confirm the server still speaks the auth plugin you use. |
| sharp | 0.34.5 | <=0.35.5-rc.1 | high | 0.35.5 (npm marks semver-major) | libvips / libheif CVEs. The avatar fix should use `sharp`, so land the upgrade in the same tested change or immediately after. |
| nanoid | 5.1.9 | 4.0.0–5.1.15 | high | yes | Predictable/overflow issues in the non-crypto generator. Search for `nanoid` call sites before bumping. |
| react-router-dom | 7.14.2 | 7.0.0-pre.0–7.14.2 | high | yes | DoS and open-redirect advisories in the router. Run the client route tests after upgrade. |

## Transitive issues worth naming

| Package | Severity | Note |
| --- | --- | --- |
| protobufjs <=7.6.4 (installed 7.5.4) | critical | Code injection in generated code and a prototype-pollution advisory. Pulled in by Firebase/gRPC, not by application `eval`. |
| websocket-driver <=0.7.4 | critical | Compression and length-header bugs. Transitive. |
| ws 8.18.3 | high | Memory disclosure / exhaustion. Comes in with Socket.IO. |
| @grpc/grpc-js | high | Malformed message DoS. Transitive via Firebase. |
| form-data 4.0.0–4.0.5 | high | CRLF in multipart names. Transitive. |
| socket.io-parser 4.0.0–4.2.6 | high | Unbounded binary attachments. |
| follow-redirects | moderate | Cross-domain header leak. Transitive of axios. |

`fixAvailable: true` means npm believes a non-major or compatible fix exists. That was not verified by installing it.

## Supply chain outside the audit JSON

- SEC-001: secrets in git. Higher priority than CVE bumps.
- SUP-001: 543 tracked files in `metatest/src/backend/node_modules`. A clean install should own that tree, not git.
- `metatest/public/mathjax` is a vendored browser bundle. It contains its own `new Function` usage. Do not feed it untrusted configuration from students. It is not an upload execution path.
- Lockfile integrity: npm audit read the lockfile successfully. A full `npm ci` reproducibility check was not run.

## Recommendation

Do not run `npm audit fix` as part of the security-documentation change.

When an upgrade is approved:

1. Bump one group at a time: `mysql2` and `multer`, then `axios`, then `sharp`, then router/nanoid, then the Firebase transitive tree.
2. Re-run `npm audit` and the backend tests.
3. Re-test avatar upload, AI image upload, login, and a payment sandbox call.
4. Record the before/after counts in `remediation-log.md`.

`sharp` 0.34 to 0.35 can change native binaries. Build it on the same Node version the host uses (this workspace is Node 22). cPanel's Node may differ.
