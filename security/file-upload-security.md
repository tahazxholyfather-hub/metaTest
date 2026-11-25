# File upload security

Phase 2 of the 2026-11-25 program. Static review only. Nothing was uploaded to metatest.app.

## Verdict

**CONFIRMED remote code execution. It was exploited.**

The profile upload accepts the client’s file extension and writes the bytes under `public/avatars`. Owner Apache SSL logs show a `.php` upload on 6 Nov 2026 was executed from `public_html/avatars/` through 18–19 Nov 2026. Node did not run it. The cPanel PHP handler did. SEC-007. Timeline: `incident-2026-11.md`.

Rejecting `.php` in application code is not the fix by itself. The target control is all of:

- Allow-list JPEG, PNG, and WebP by extension **and** magic bytes **and** a real decode.
- Re-encode with `sharp` so the stored bytes are a new image.
- Random server filename, no client extension.
- Store outside the web root. Do not put the files in `public/` or `public_html`.
- `nosniff`, and no PHP handler on any directory that is still web-visible.
- Path stays inside the storage root after `path.resolve`.
- Auth on the route that is actually a user JWT, plus a rate limit and a quota.

PR #55 (`https://github.com/tahazxholyfather-hub/metaTest/pull/55`) only does the extension and magic-byte allow-list (JPEG, PNG, WebP, GIF) and a random prefix plus that extension. It still writes into `public/avatars`, does not re-encode, and does not add the cPanel handler deny. **That change is not sufficient.** It is worth keeping, and it is not “fixed”.

## Paths

| Path | Auth on `main` | What is accepted | Name | Where | Who serves it |
| --- | --- | --- | --- | --- | --- |
| `POST /api/upload_avatar` | `requireToken` (bypassable, SEC-006) | Any extension, 5 MB, no MIME check | `avatar-<time>-<rand>` + client extension | `metatest/public/avatars` | Node `express.static('public')` if the cwd is the app root, **and** Apache/LiteSpeed if that folder is in the docroot |
| `Admin_save_pdf` | Any logged-in caller (SEC-005) | Base64, extension forced to `.pdf`, no magic check | timestamp + stripped original name + `.pdf` | `public/files/pdfs` | Same |
| AI image / audio / PDF | `requireToken` plus feature flags | Images and PDFs by magic bytes. Audio by declared MIME. 8 / 15 / 30 MB | random, extension from MIME map | `public/uploads/ai/{images,audio,pdfs,generated}` | Same |
| `Admin_parse_questions_docx` | Any logged-in caller | `.docx` XML via regex, not written as a script | none on disk | memory | n/a |

`server.js` lines 68–71 take `path.extname(file.originalname)`. There is no `fileFilter`. A name `a.php`, `a.phtml`, `a.PhP`, or `a.html` is stored as-is. `../` in the original name does not become the directory: only the extension is copied, and the directory is fixed. Overwrite of another user’s avatar by name is unlikely (`Date.now` and a random suffix) but the URL is then public.

## Content-Type, nosniff, disposition

On `main`, Express does not set `X-Content-Type-Options`, `Content-Disposition`, or a restrictive type. `express.static` picks a type from the extension. `.html` is `text/html` (stored XSS). `.svg` is `image/svg+xml` (stored XSS if the file is rendered). `.php` is not executed by the `send` module; a browser will not run it either. LiteSpeed or Apache will, if the handler is on.

There is no `.htaccess` in the repo to turn the handler off.

## sharp

`package.json` has `sharp` `^0.34.5`. The avatar path does not call it. The AI image path does (`fileStorage.js` line 114): `sharp(buffer, { failOn: 'none' }).rotate()` then WebP. `limitInputPixels` is not set (library default applies, on the order of 268 megapixels). EXIF is dropped only when re-encode succeeds, because `withMetadata()` is not used. GIFs skip re-encode. A decode failure stores the original bytes. `npm audit` reports high-severity libvips / libheif / librsvg issues in this version line (SEC-025). The suggested npm fix is a breaking `sharp` upgrade and was not applied.

## Authz, CSRF, cross-user

The avatar route checks `requireToken`, then writes the file and sets `avatar_url` on `req.user.id` only after the file is on disk. It does not check that the caller owns an existing object. Avatars are public by URL once the name is known. CSRF: the browser client sends `x-app-token`, which a cross-site form cannot set. That blocks classic CSRF. It does not matter if the caller can forge a token (SEC-006).

PDF save and the Word parser do not check the admin cookie (SEC-005).

## Downstream

`avatar_url` is stored and later rendered as an image URL. A `.html` or `.svg` file in that URL is script in the origin. AI `public_url` is returned to the owning user and is also world-readable if the path is known (SEC-019). Nothing in the code `require`s or `eval`s the stored path.

## Classification

| Claim | Result |
| --- | --- |
| “.php upload leads to RCE” | CONFIRMED. Webshell `avatar-1793964090912-103811333.php` executed `?cmd=` (SEC-007, `incident-2026-11.md`) |
| Unrestricted upload | CONFIRMED |
| Stored XSS via `.html` / `.svg` | CONFIRMED code path, independent of PHP |
| Path traversal / arbitrary overwrite | Not shown. Filename is server-built |
| PDF upload is PHP RCE | No. Extension is forced to `.pdf`. Missing magic-byte check remains (SEC-036) |
| AI image upload is PHP RCE | No, as long as the MIME map is what is written. Files still sit on a PHP-capable web root (SEC-019) |

## What to verify on staging only (Phase 7)

Staging does not exist yet. Do not run this on production.

1. After the upload-directory `.htaccess` is installed, place a text file whose **name** ends in `.php` and whose body is the word `FIXTURE` with no PHP tags. Request it. Expect 403. A 200 that shows `FIXTURE` means the PHP handler ran.
2. Upload a JPEG, a PNG, and a WebP through the avatar route. Expect 200 and a random name that is not the client’s name.
3. Upload a file named `x.php` and a file named `x.html`. Expect rejection before the file is written.
4. Confirm the stored bytes are a re-encoded image (not a copy of the upload) once that control exists. It does not exist on `main` or in PR #55.
