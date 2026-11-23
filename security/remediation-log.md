# Remediation log

Date: 2026-11-23.

| Change | Status |
| --- | --- |
| Application source (`metatest/src/**`) | Not modified |
| Dependencies | Not upgraded |
| Git history and secret files | Not rewritten. They are still tracked. Rotation has not been performed from this workspace |
| Hosting / LiteSpeed / cPanel | Not modified |
| Tests | Not added. The plan is in `file-upload-security.md` |
| Documentation, Cursor agents, and rules | Added on `cursor/security-audit-aaa7` |

## Why code was not changed

The assessment instructions require a human approval after the initial report, before fixes. Several proposed fixes change login, guest sessions, payment callbacks, or production secrets. Those are breaking or operational.

## Proposed changes waiting for approval

1. Rotate credentials listed under SEC-001. Remove `metatest/src/backend/.env` and `ai-teacher/sql/004_iranian_teachers.sql` from the index and from history. Remove the database dumps after a backup exists outside git.
2. Delete the base64 and `APP_TOKEN` branches in `middleware/auth.js`. Issue real JWTs from guest login.
3. Re-encode avatar uploads. Allow JPEG, PNG, WebP only. Random filenames. Keep authentication.
4. Ignore `req.body.user_id` in `handleCheckAnswer`. Authorize quiz-result reads.
5. Stop returning `sqlMessage`. Rate-limit OTP.
6. Upgrade vulnerable direct packages in a separate commit, with tests. Do not use `npm audit fix` blindly. `sharp` 0.35.5 is a semver-major jump from 0.34.5.

## Breaking changes to expect

- Old guest tokens and any client using `APP_TOKEN` as a user session will receive 401.
- Secret rotation logs every environment out and stops SMS, payments, and the model provider until the server env is updated.
- `httpOnly` cookies (AUTH-004) require the server to read the cookie. The browser can no longer copy it into `x-app-token`.
- Answer-key and cross-user result restrictions change practice mode and the avatar-click result UI.
- Avatar URLs for new uploads may change extension (`.jpg` to `.webp`) if WebP is chosen. Existing URLs stay valid.

## Explicitly not a remediation

Rejecting only the suffix `.php` while the original bytes and other extensions are still stored.
