# Dependency audit

`npm audit --package-lock-only` on commit `0ac668a` (`main`), 2026-11-25. No upgrade was run on this branch. osv-scanner and trivy were not installed (`evidence/scanners.md`).

| Tree | Critical | High | Moderate | Low |
| --- | --- | --- | --- | --- |
| `metatest/` | 3 | 32 | 12 | 3 |
| `metatest/realtime-lobby-service/` | 1 | 11 | 6 | 0 |

PR #55 runs `npm audit fix` without `--force` and leaves the breaking upgrades. After that fix, the earlier run reported the app production tree at 5 high and 0 critical, and the lobby tree at 2 moderate. Those numbers are on the unmerged PR, not on `main`. This branch does not change lockfiles.

## Packages that need a decision, not a blind upgrade

| Package | Severity on `main` | Why it was not force-fixed | Finding |
| --- | --- | --- | --- |
| `protobufjs`, `proxy-addr`, `websocket-driver` and many transitive highs | critical / high | A non-breaking `npm audit fix` clears a large set. That is PR #55 | SEC-025 |
| `firebase` → `@grpc/grpc-js` | high | The fix npm offers is Firebase 9, a breaking downgrade | SEC-025 |
| `sharp` `^0.34.5` | high (libvips, libheif, librsvg) | The fix npm offers is `sharp@0.35.x`, flagged breaking | SEC-025, and the upload re-encode in SEC-007 |
| `zod` inside `shadcn` | high (memory DoS on huge schemas) | Fix is shadcn 4. Dev tooling, not the request path | SEC-025 |
| `minimatch` / `glob` via `vite-plugin-pwa` and nodemon | moderate | The suggested fix downgrades the plugin or nodemon | SEC-025 |

`firebase` is a dependency. No Firebase config with an API key was found in source. If the client never initializes it, it is still shipped if imported. Confirm before removing it.

## Supply chain

`metatest/src/backend/node_modules` is tracked (543 files, including axios). That is SEC-026. PR #55 stops tracking it and ignores `node_modules`. Committed `node_modules` can lag the lockfile and hide a second copy of a vulnerable package.

## CI

There is no GitHub Actions workflow to fail on `npm audit`. UNKNOWN whether cPanel deploys with `npm ci` or by uploading `node_modules`. Prefer `npm ci` from the lockfile after Gate 1, on staging.
