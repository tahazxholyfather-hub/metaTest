# MySQL / MariaDB security

The API uses `mysql2` promise pools (`metatest/src/backend/db.js`). The committed environment points at `localhost`, user `root`, empty password, database `quiz_app`. Whether production matches that is UNKNOWN. The dump was taken from MariaDB 10.4.32 (phpMyAdmin header in `quiz_app(full_Database).txt`).

## Query construction

Most statements use `?` placeholders. That is the right default.

Confirmed exceptions:

- `adminController.js` builds `UPDATE ... SET` lists from fixed column names and binds the values. The column names are not taken from the client. Not SQL injection.
- Curriculum writes use a whitelist `CURRICULUM_TABLES` (`adminController.js` around line 542). The table name is not the client’s raw string. Not SQL injection. The missing admin check is SEC-005.
- `quizWorldController.js` line 1101 interpolates `ORDER BY FIELD(q.id, ${questionIds.join(',')})`. The array is parsed from `quizzes.question_ids`, which `handleCreateQuiz` fills from ids the server selected, then `JSON.stringify`. No second writer that stores a client string was found. The pattern is unsafe if that column is ever edited by hand or by another bug. Confidence SUSPECTED, severity LOW (SEC-035). PR #55 coerces the list to positive integers.
- AI settings update uses a server-side map of column names (`ai-teacher/controller.js`). Values are bound. Not injection.
- `toolsService.js` builds `LIKE` with escaped tokens and placeholders. Not injection.

## Privileges

UNKNOWN. The sample `.env` uses `root` with an empty password. On cPanel the database user is usually a per-account user created in MySQL Databases, not `root`. If production really uses `root` on localhost, any SQL injection is full database control, and a PHP shell (SEC-007) can read the socket. Record the actual user and grants (`SHOW GRANTS`) on staging. Do not paste the output into git.

## PII at rest

Tables that hold personal or exam data: `tam24_users` (phone, scrypt password hash, IP), `tam24_otps` (plaintext code and phone), `tam24_admins` (password hash; the login code does not read this table), `payments`, `tam24_ai_messages`, `tam24_ai_student_memory`, `notes_tam24`, `questions_tam24`, `options_tam24` (answer key in `is_correct`).

The dump of these tables is SEC-002. It is deleted from the tree only on PR #55. History still has it.

Passwords of students are `scrypt` with a random salt (`userController.js`). Comparison on `main` uses `===` (SEC-029). Admin panel passwords are not hashes. They are the string `Admin@` plus the id (SEC-003).

OTP codes are stored in plaintext and compared in SQL. They are four digits (SEC-010).

## Backups

A full phpMyAdmin dump was committed. That is the backup control failing in public. cPanel backups (JetBackup or the account backup) are UNKNOWN. If they include this database, they must not be downloaded into the git tree. After history is purged, rotate what the dump exposed (phones are already public; password hashes in `tam24_admins` should be treated as disclosed).

## Encryption

No application-level encryption of phone numbers or chat text. TLS to the browser was observed. TLS from Node to MySQL is UNKNOWN and is usually off for `localhost`. Acceptable on localhost only if the socket is not exposed. Do not bind MariaDB to a public address.
