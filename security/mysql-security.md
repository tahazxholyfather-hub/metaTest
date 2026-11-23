# MySQL security

Agent: mysql-security. Lead re-checked connection setup, the `FIELD` interpolation, password verification, error disclosure, and the fact of the dumps. No query was sent to a database. No row was read from the dumps.

## Library

There is no Prisma schema and no ORM. Access is `mysql2/promise` pools in `metatest/src/backend/db.js`.

```19:29:metatest/src/backend/db.js
const pool = mysql.createPool({
    host: dbHost,
    port: dbPort,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: dbName,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 8000,
});
```

The pool sets no `ssl`. On a cPanel account where MySQL is on localhost this is normal. If `DB_HOST` is ever a remote host, traffic is cleartext. The tracked env's host value is not copied here.

Startup logs the host, port, and database name. It does not log the password.

The lobby service does not open MySQL. It calls the main API with `INTERNAL_SERVICE_KEY`.

## Findings

| ID | Severity | Confidence | Topic |
| --- | --- | --- | --- |
| SEC-001 | CRITICAL | confirmed | `DB_PASSWORD` and the rest of the env are tracked. See `security-report.md`. |
| DATA-001 | HIGH | confirmed | phpMyAdmin dumps with INSERT data are tracked. Contents were not reviewed. |
| AUTH-006 | HIGH | confirmed | MD5 and `Admin@{n}` still verify. Bootstrap fallback `Admin@1`. |
| IDOR-003 | HIGH | confirmed | Answer key query is parameterized and still returns `is_correct` to any token. |
| ERR-001 | MEDIUM | confirmed | `sqlMessage` is returned to clients (`reportError.js` lines 10–11, `server.js` 546). |
| SQL-001 | MEDIUM | confirmed | `ORDER BY FIELD(q.id, ${questionIds.join(',')})` at `quizWorldController.js` line 1435. |
| OTP | MEDIUM | confirmed | `tam24_otps.code` is stored and compared in plaintext in `userController.js`. |
| INT-001 | MEDIUM | confirmed | Not a SQL bug. Internal routes that write quiz rows fail open outside production. |

## SQL injection search

Request body values are overwhelmingly passed as `?` parameters, including `LIKE` patterns. Dynamic `IN (...)` clauses that were sampled build one placeholder per id.

User-controlled table names were not found. Admin curriculum and tag helpers use fixed maps. `questionImages.js` rejects SQL aliases that fail `^[A-Za-z_][A-Za-z0-9_]*$`.

`LIMIT` / `OFFSET` samples use `parseInt` or fixed page sizes before interpolation. That is safe today and brittle if a later edit interpolates the raw string. Prefer bound parameters when those queries are next touched.

The exception to record is SQL-001. `parseQuestionIds()` already exists in the same controller and is the right fix.

## Password storage

- Students: `crypto.scrypt` with a random salt, stored as `salt:hex` (`userController.js`). Comparison of the hex digest in the student path should be switched to `timingSafeEqual` when that function is next edited. Admin compare already uses `timingSafeEqualStr`.
- Minimum length on at least one reset path is 6. That is below a reasonable floor. Not raised in this pass.
- Profile JSON sets `password_hash` to `undefined` before responding. The column is selected and then removed. Keep the allowlist explicit so a future spread does not leak it.
- Admins: current hashes are scrypt. Legacy MD5 and the username-derived password remain in `utils/password.js` lines 69–77.

## Permissions

The database user's grants are not visible from the repo. Least privilege (no `FILE`, no `SUPER`, no access to other schemas) has to be checked in cPanel/MariaDB by a person. This audit did not connect.

## Upload metadata

Avatar URL is a parameterized update:

```991:994:metatest/src/backend/controllers/userController.js
        const [result] = await db.query(
            'UPDATE tam24_users SET avatar_url = ? WHERE id = ?',
            [avatarUrl, userId]
        );
```

`userId` comes from `req.user.id` in this handler, which is correct once AUTH-001 is fixed. The URL is the public path of whatever multer saved. The SQL is not the upload bug.

AI files insert metadata with placeholders into `tam24_ai_files`, including `public_url` and `original_name` truncated to 255 characters. Download authorization is not in the SQL; it is missing at the static file server (UP-004).

## What was not done

- No `SELECT` against production or the local dumps' data.
- No printing of connection strings.
- No recommendation to switch ORMs.
