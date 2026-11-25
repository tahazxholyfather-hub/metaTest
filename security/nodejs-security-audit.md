# Node.js security audit

The API is CommonJS Express in `metatest/src/backend/server.js`. The lobby service is TypeScript Express plus Socket.IO. cPanel runs the process through Passenger (“Setup Node.js App”). The Node version on the server is UNKNOWN. This review VM has Node v22.23.4, which is not evidence of production.

## Dangerous APIs

| Check | Result |
| --- | --- |
| `child_process`, `exec`, `spawn` | Not used in application code. `pipeline.exec()` in the lobby Redis store is the Redis client |
| `eval`, `new Function` | Not in application code. `lottie-web` uses `eval` inside the dependency (SEC-025, low, build warning) |
| Dynamic `require` of a user path | Not found. Uploads are not loaded as modules |
| Prototype pollution | No `Object.assign` of raw query objects into a prototype sink was found. JSON bodies are read field by field. Not a confirmed bug |
| Unsafe deserialization | No `node-serialize` / `js-yaml` load of user YAML. `JSON.parse` is used on database JSON (`question_ids`, settings). That is not remote code execution |
| Path traversal | Avatar and PDF names do not use the client path. AI deletes use `path.basename`. SEC-035 is a different bug (SQL `ORDER BY` string) |
| `NODE_ENV` | The committed `.env` sets `development`. If Passenger loaded that file, cookies that key off `NODE_ENV` were not `Secure`, and the internal-route empty-key bypass was armed (SEC-015) |

## Process and accounts

- One Express process handles students, admins, payments, and internal quiz grading (`server.js`).
- Body limit is 50 MB (`server.js` lines 90–91) so an admin can post a base64 PDF. That is also an unauthenticated memory DoS (SEC-018). There is no global rate limit. The AI routes have an in-process limiter. OTP did not, until the unmerged PR.
- `DEV_MODE=true` skips authentication and sets user 999, role `developer` (`auth.js` lines 40–43). The committed file has it `false`. The code is still a switch (SEC-034).
- Secrets are read from `process.env` after `dotenv`. The values were committed (SEC-001). On cPanel they belong in the Node.js App environment screen, not in a file under the document root.
- The backend `package.json` does not declare `express`, `mysql2`, `jsonwebtoken`, `multer`, `dotenv`, or `cookie-parser`. Those packages are on the Vite package. Passenger’s node module path is UNKNOWN. A wrong application root will fail closed (crash) rather than run a second copy. Still a deploy hazard (SEC-026).

## Node end of life

Do not guess the production version. In the Node.js App screen, record the version. Node 18 is end of life. Node 20 is end of life as of April 2026. Node 22 is the current LTS line as of this review (November 2026). If the panel shows 18 or 20, move the application to 22 after Gate 1, on staging first.

## Lobby service

`realtime-lobby-service/src/config/env.ts` defaults `JWT_SECRET` to the public string `super-secret-change-me` when the variable is missing (SEC-028). The committed `.env` overrides it with the same student JWT secret as the API (SEC-001). Socket authentication verifies that secret (`auth.service.ts`). Helmet and `express-rate-limit` are used here and are not used on the main API.

PR #55 makes `JWT_SECRET` required and at least 32 characters. That is the right change. It does not rotate the key.
