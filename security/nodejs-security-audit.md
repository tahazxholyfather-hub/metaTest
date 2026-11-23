# Node.js security audit

Agent: web-security and infrastructure-security, consolidated by the Lead.
Runtime in this workspace: Node v22.23.4. Host runtime: unknown.

## Process model

`metatest/src/backend/server.js` builds an Express app, listens on `process.env.PORT` or 3000, and optionally spawns the Vite dev server when `profile.localhost` is true:

- `spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], ...)` around line 583.
- Arguments are constants. User input is not concatenated into the command.
- This is a local convenience. It should never run when `LOCALHOST=false`.

There is no second HTTP framework.

## Dangerous APIs

| API | Result |
| --- | --- |
| `child_process` | Only the fixed Vite spawn above |
| `eval` / `new Function` | Not used by backend application code. Present inside vendored MathJax |
| Dynamic `import()` of user paths | Not found |
| `vm` | Not found in the backend |
| `fs` writes of user data | Avatar, AI, blog, question images, PDF library, VAPID key file, error log. See `file-upload-security.md` |
| Path traversal | Avatar names keep only `path.extname`. Question images use `safeImageName`. AI delete/read uses `path.basename`. No user path is joined onto the web root without a basename or an allowlisted name in the paths that were read |
| Prototype pollution | No `Object.assign` of raw JSON onto a prototype was confirmed as exploitable. `express.json` limit is 50 MB (line 113), which is large and is a DoS consideration (below) |
| Deserialization | `JSON.parse` of database JSON (`question_ids`) feeds SQL-001. No `node-serialize` usage was found |

## Request parsing

- `express.json({ limit: '50mb' })` and the same limit for urlencoded bodies (`server.js` lines 113–114). The comment says this is for base64 PDFs. A 50 MB JSON body is a memory DoS. Prefer a smaller default and a larger limit only on the PDF route.
- Multer limits: avatar 5 MB, blog 80 MB, AI limits from config. Multer 2.1.1 has its own DoS advisories (DEP-001).

## File upload and RCE

Node will not execute a stored `.php` file. The RCE question is whether another program on the same account will. Details: `file-upload-security.md`, findings UP-001 (confirmed) and UP-002 (suspected).

Uploaded paths are not passed to `spawn`, `eval`, or the module loader.

## Auth and sessions

Covered in `security-report.md` (AUTH-001 through AUTH-006). The Node-specific defect is trusting decoded JSON that was not signed.

## Errors

`reportError` writes stack traces to `error.log` and returns `sqlMessage` to the client (ERR-001). Stack traces are not returned in full; the message is sliced to 300 characters, which is still too much when the message is SQL.

## Environment handling

`dotenv` loads `metatest/src/backend/.env` and `metatest/.env` (`server.js` lines 5–6). Those files are a deployment concern. The backend file is also a git concern (SEC-001).

`DEV_MODE`, `APP_TOKEN`, and `INTERNAL_SERVICE_KEY` change authentication. They must be absent or strongly random in production, and the code paths that trust them should be removed (AUTH-002, AUTH-005, INT-001).

## Regression surface for a Node fix

After an approved upload patch, run the existing backend tests (`runtimeMode.test.js` and neighbors) plus the new avatar cases. Do not start the server on `0.0.0.0` for the test.
