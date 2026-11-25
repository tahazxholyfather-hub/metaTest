# Scanner notes

Run on 2026-11-25 against commit `0ac668a` (current `main`). No exploit was run. No dependency was upgraded.

| Tool | Result |
| --- | --- |
| `npm audit --package-lock-only` in `metatest/` | 3 critical, 32 high, 12 moderate, 3 low (50) |
| `npm audit --package-lock-only` in `metatest/realtime-lobby-service/` | 1 critical, 11 high, 6 moderate (18) |
| semgrep | Not installed. Not run. |
| gitleaks | Not installed. Not run. Secrets were found by reading tracked `.env` files and the SQL dump. Values are not copied here. |
| trufflehog | Not installed. Not run. |
| osv-scanner | Not installed. Not run. |
| trivy | Not installed. Not run. |

Scanner output would have been leads only. The findings in `ledger/findings.json` were confirmed or rejected by reading the code.
