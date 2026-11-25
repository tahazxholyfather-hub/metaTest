# Security assessment plan

Program for metatest.app. This branch is Gate 1 only. No application code is changed here. PR #55 stays open and unmerged. The owner approves or rejects each finding, and each PR #55 change, before anyone remediates.

## Standards

Primary: OWASP ASVS 5.0. Also OWASP Top 10, API Security Top 10 2023, WSTG, Cheat Sheets, CWE Top 25, Node.js security guidance. Next.js guidance was applied and the app is not Next.js (see `nextjs-security-audit.md`). CIS Docker: no containers in the repo. NIST SSDF: this plan is the risk identification step. Fixes are not implemented on this branch.

## Phases

| Phase | What | State |
| --- | --- | --- |
| 1 Discovery | What the system is, where it is hosted, where files go | Done in this pack |
| 2 Upload / RCE claim | Every upload sink, then a yes/no on PHP execution | Done. Verdict in `file-upload-security.md` and SEC-007 |
| 3 Full review | Auth, authz, injection, XSS, CSRF, SSRF, data, exams, privacy, dependencies | Done. Ledger is `ledger/findings.json` |
| 4 Triage | Re-read every critical and high. Separate confirmed, suspected, false positive | Done. `security-report.md` |
| Gate 1 | Owner reads this pack and approves findings and PR #55 per id | **Stop here** |
| Later remediation | Code and cPanel changes | Not started |
| Phase 7 retest | Prove the fixes | **Blocked.** There is no staging environment |

## Rules that were followed

No requests to production for this program. The header and HTTP-500 notes are the earlier observation, not a new probe. No SMS, no payment, no upload, no exploit. Secrets are not copied into these files. Scanners that were not installed were skipped and recorded.

## Out of scope until the owner says otherwise

- Rewriting git history (recommended, not done).
- Creating the staging subdomain.
- Editing `.htaccess` on the server.
- Merging PR #55.

## Exit of Gate 1

The owner marks each id in `ledger/tasks.json` approved or rejected. Approved items can be remediated on a later branch. Rejected items stay open with a reason. Phase 7 does not start until a non-production cPanel host exists.
