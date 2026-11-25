# Privacy audit

The users are school students. The product is in Persian and the plan names follow Iranian school grades. Treat accounts as minors’ data even where the schema does not store an age.

## What is collected

From `tam24_users` and the handlers that write it: phone number, optional email, name, password hash, avatar, bio, social links, IP address (`last_login_ip` and OTP `ip`), plan, and referral. AI chat stores message text, and `tam24_ai_student_memory` stores weaknesses, strengths, and “important facts” the model extracted. Payments store amount, gateway ids, client IP, and user agent.

## What went public

SEC-002. The committed dump includes a phone number, plaintext OTP codes next to phones, payment rows, AI conversations, student memory, and notes. SEC-001 publishes the SMS credentials and the JWT key that can mint a session for any of those users once it is rotated-or-not: until rotation, anyone can forge a JWT.

There is no privacy policy file, no retention job, and no delete-account route in the code that was read. UNKNOWN whether a policy is shown in the UI copy. A code search found no scheduled purge of `tam24_otps`, `tam24_ai_messages`, or `payments`.

## Minimization

OTP rows keep the code and the phone after a failed attempt. Success deletes the row (`handleVerifyOtp`). Failures do not. IP is stored on the user and on the OTP.

AI memory is readable and deletable by the student (`/api/ai-teacher/memory`). That part is in good shape. The same rows were in the public dump.

`handleGetUserInfo` selects `password_hash` and then removes it from the JSON (`password_hash: undefined`). The hash is loaded into the Node process on every profile read. It is not returned. Fine. Do not log that object.

## Logs

Several handlers `console.error` the exception. OTP codes are not logged on the success path. `paymentController.js` logs the Zarinpal response body on create failure, which can include gateway details. `auth.js` logs `Token Auth Failed` plus the JWT error name, not the token. Passenger’s stderr on cPanel is a file under the account. UNKNOWN who can download it. Do not turn on debug logging of bodies.

## Third parties

- SMS: `api.payamak-panel.com` receives the phone and the code (`utils/sms.js`).
- Payments: Zarinpal receives the amount and a callback URL.
- AI: the configured base URL (`api.gapgpt.app` in the committed env) receives chat text and images. The key was in git (SEC-001).
- No analytics script tag in `metatest/index.html`. Firebase is a dependency. No Firebase config object was found in source. If a later commit adds `initializeApp`, that is a new disclosure. Not confirmed today.
- `lottie-web` runs in the page. It is local, not a third-party script host.

## What to tell a non-technical reader

See `summary-fa.md`. The short version: student phone numbers, chats, and one-time codes were in the public code history; changing the website code does not pull those copies back.
