# File upload security

Responsible agents: web-security, infrastructure-security, security-auditor.
Lead verification: the avatar path, AI storage, blog upload, question-image writer, static mounts, and `path.extname` behavior were re-read or executed locally. No upload was sent to a server. No file was executed.

## Reported issue

"Arbitrary file upload leads to remote code execution. Users can upload profile images with arbitrary extensions, including `.php`."

Verdict:

- Arbitrary extension upload is **confirmed**.
- Remote code execution is **not confirmed**. It is suspected only if the fronting web server executes PHP (or honors an uploaded `.htaccess`) for files under `public_html/avatars`.
- Rejecting the filename suffix `.php` would not be a fix. The client extension is the bug, and HTML/SVG would still be stored and served.

## UP-001 — Avatar upload accepts any extension and stores it on the web root

- Severity: HIGH
- Confidence: confirmed
- Status: open, awaiting approval
- Files:
  - `metatest/src/backend/server.js` lines 80–94, 116, 134–138
  - `metatest/src/backend/controllers/userController.js` lines 980–1009
  - `metatest/src/backend/runtimeMode.js` lines 62–78 and 94–121
  - `metatest/src/views/ProfileView.tsx` lines 446–481

### What the code does

```80:94:metatest/src/backend/server.js
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }
});
```

There is no `fileFilter`. The MIME type is ignored. The file bytes are never inspected. `sharp` is a dependency and is used by the AI uploader, but this route does not call it.

`path.extname` results checked with Node on this machine:

| Client filename | Stored suffix |
| --- | --- |
| `photo.jpg` | `.jpg` |
| `shell.php` | `.php` |
| `shell.PHP` | `.PHP` |
| `shell.phtml` | `.phtml` |
| `a.jpg.php` | `.php` |
| `a.php.jpg` | `.jpg` (content still not checked) |
| `x.htaccess` | `.htaccess` |
| `.htaccess` | empty (hidden-file rule in Node) |
| `foo.html` / `foo.svg` | `.html` / `.svg` |
| `../x.php` | `.php` (the directory portion is not kept) |

The stored basename is always `avatar-<timestamp>-<random><extension>` inside the avatar directory. `path.extname` stops at a path separator, so this filename builder does not by itself write outside `uploadDir` or overwrite `server.js`.

`uploadDir` is `ensureAvatarDir(profile)`. In production that resolves to `<webRoot>/avatars`, and the web root is `public_html` unless `WEB_ROOT` / `DOCUMENT_ROOT` says otherwise. Locally it is `metatest/public/avatars`.

The route is authenticated:

```134:138:metatest/src/backend/server.js
app.post(
    '/api/upload_avatar',
    requireToken,
    upload.single('avatar'),
    userController.handleUploadAvatar
);
```

`requireToken` is not a sufficient control while AUTH-001 exists, because any caller can mint a base64 token for a real user id. The handler then saves `/avatars/<filename>` on that user.

Serving:

```116:117:metatest/src/backend/server.js
app.use('/avatars', express.static(uploadDir));
app.use(express.static(profile.webRoot));
```

`express.static` does not execute PHP. It does serve `.html` as `text/html` and `.svg` as `image/svg+xml`. A stored HTML or SVG file on this origin is a stored XSS if a victim opens the URL. That impact does not depend on PHP.

The profile UI crops to a JPEG named `avatar.jpg` (`ProfileView.tsx`). That is a client convenience. `accept="image/*"` is not enforced by the server. The UI also sends cookie `token` (`AuthView.tsx` writes it without `HttpOnly`). A direct multipart request with a valid `x-app-token` bypasses the cropper.

CSRF: the API reads the token from a header, not from the cookie. A cross-site form post cannot set `x-app-token`. CSRF is not the primary issue on this route.

Size limit: 5 MB. No dimension limit. `Math.random` is not a cryptographic name, but the name is not taken from the user except for the extension.

### Impact

- Confirmed: public hosting of attacker-controlled bytes on the application origin, including HTML and SVG.
- Confirmed: a `.php`, `.phtml`, `.phar`, or `.htaccess` name is preserved on disk inside the document root.
- Not confirmed: the Node process does not pass that path to `child_process`, `eval`, or `import()`.

### Remediation (not applied)

1. Accept only JPEG, PNG, and WebP.
2. Check magic bytes, then decode and re-encode with `sharp`. Reject the file if decode fails. Do not keep the original bytes.
3. Write `avatar-<crypto.randomBytes>.webp` (or `.jpg`). Never use `file.originalname`.
4. Keep the 5 MB limit and cap pixel dimensions.
5. Keep `requireToken`, and fix AUTH-001 so the token cannot be forged.
6. Leave existing non-image files in place until a reviewed cleanup. Do not delete production files from this audit.

## UP-002 — PHP execution in the avatar directory is a hosting question

- Severity: CRITICAL if the condition is true
- Confidence: suspected
- Status: open, needs a hosting check. No exploit was attempted.

### Evidence that supports the condition

- Avatars are created under `public_html/avatars` on the cPanel layout (`runtimeMode.js`, `runtimeMode.test.js`).
- `server.js` line 148 describes a LiteSpeed proxy for `/api`, which means LiteSpeed is the public server and is not required to send every URL to Node.
- `metatest/public/.htaccess` is written for Apache/LiteSpeed.
- phpMyAdmin dumps in this repo were generated on PHP 8.2.12 and PHP 8.4.27. PHP is installed on those machines. The dumps do not include a vhost.

### Evidence that blocks calling it confirmed

- The repository contains no `.php` application and no `AddHandler` / `SetHandler` / `php_flag` directive.
- The only `.htaccess` rewrites `/app/` to `index.html`. It does not enable PHP under `/avatars`.
- `express.static` will not run PHP.
- This environment has no access to the live LiteSpeed vhost, `AllowOverride`, or the account's PHP handler.
- An uploaded `.htaccess` could change handlers only if Apache/LiteSpeed allows overrides in that directory. That setting is not in git.

### What to verify on the host (read-only)

- Does a request for `/avatars/avatar-test.php` hit LiteSpeed's PHP handler or the Node static middleware?
- Is `AllowOverride` enabled for `public_html/avatars`?
- Can the app store uploads outside `public_html`? `ensureAvatarDir` already falls back to `os.tmpdir()` only when every web-root candidate is unwritable. A dedicated non-public directory is not configured.
- Is object storage available? Nothing in the repo configures S3 or similar.

### Defense that does not require root

After approval, the application can write a static hardening file into the avatar directory if the panel honors `.htaccess`:

- Deny `.php`, `.phtml`, `.phar`, `.php5`, `.shtml`.
- `RemoveHandler` for those extensions.
- `php_flag engine off` where `mod_php` is in use (often a no-op on LiteSpeed `lsphp`).

That file is a supplement. Re-encoding is the control that stays effective when the web server ignores `.htaccess`.

## Other upload paths

### AI files — stronger, still public

`metatest/src/backend/ai-teacher/services/fileStorage.js`

- Images: MIME allowlist plus magic bytes (lines 76–93). Optional `sharp` resize to WebP (lines 111–124). If `sharp` is missing or throws, the original bytes are stored.
- PDF: `%PDF-` magic required.
- Audio: declared MIME only (lines 99–101). No magic bytes.
- Names: `crypto.randomBytes` plus an extension taken from the sniffed MIME, not from the client, except the audio/fallback branch (lines 66–70, 142–144).
- Location: `{webRoot}/uploads/ai/{images,audio,pdfs,generated}`.
- Auth on upload: `requireToken` and an upload rate limit (`ai-teacher/routes.js`, `middleware.js`).
- Auth on download: none. `express.static(profile.webRoot)` serves `/uploads/ai/...` to anyone who knows the URL.

Finding UP-004. Severity MEDIUM. Confidence confirmed for missing download authorization and for audio MIME-only checks. RCE is not indicated: image extensions come from the sniff map, not from `.php`.

### Blog media — admin, MIME only

`metatest/src/backend/blog/upload.js` lines 9–40.

Allowlist is the client MIME type mapped to `.jpg`, `.png`, `.webp`, `.gif`, `.mp4`, `.webm`, `.mov`. No magic bytes. 80 MB limit. Random name plus the mapped extension. Stored in `{webRoot}/blog-media`. Route: `POST /api/admin/blog/media` with admin session and the blog section (`adminRoutes.js`).

Finding UP-003. Severity MEDIUM. Confidence confirmed. A polyglot can be stored if the browser-supplied MIME is one of the allowed types. Admin auth limits who can call it. It is not an anonymous RCE path in this code.

### Question images — admin, magic bytes, original bytes

`metatest/src/backend/admin/questionImages.js` lines 22–53 and 156–164.

JPEG, PNG, WebP, and GIF signatures are required. The original buffer is written under `{webRoot}/images/questions` with a server-generated name and the detected extension. No re-encode. Admin-only.

Finding UP-005. Severity LOW. Confidence confirmed. A polyglot image can be stored, but the extension is an image extension, so the Node static server will not treat it as PHP.

### PDF library — admin, extension forced, content not checked

`metatest/src/backend/controllers/adminController.js` around the PDF save path (base64 body, `.pdf` suffix forced, directory `{webRoot}/files/pdfs`). No `%PDF-` check was found on this path, unlike the AI PDF uploader.

Finding UP-006. Severity MEDIUM. Confidence confirmed for missing signature check. Admin-only. Not an RCE path by itself.

### Paths that do not write user files to the web root

- DOCX import parses a ZIP in memory (`admin/docxQuestions.js`).
- VAPID keys are written to `metatest/src/backend/data/vapid.json`, which is outside the web root and gitignored. Not a user upload.
- `pushService.js` writes server-generated keys, not request bodies as filenames.

## Execution sinks

`child_process.spawn` appears in `server.js` around line 583 and only starts `npm run dev` when `profile.localhost` is true. The arguments are fixed. Uploaded paths are not passed to it.

No application `eval`, `new Function`, or `require(userInput)` was found in `metatest/src/backend` outside vendor/mathjax bundles. The lobby service uses Redis `EVAL` for a lock script, not uploaded code.

## Regression tests to add after approval

Use harmless fixtures only. Do not include a working webshell. A `.php` fixture should be a few bytes of plain text.

| Case | Expect |
| --- | --- |
| Valid 1×1 JPEG, PNG, WebP | 200 and a server-generated image URL |
| Text body with name `x.php` | 400, nothing new on disk |
| Text body with MIME `image/jpeg` | 400 |
| Valid PNG header followed by extra bytes that are not a decodable image | 400 after `sharp` rejects it |
| `.html`, `.svg`, `.htaccess`, `.phtml` names | 400 |
| Filename `../../server.js.jpg` | stored name stays inside the avatar directory |
| Body larger than 5 MB | 413 or multer limit error |
| Missing token | 401 |
| Second user requesting a private AI file URL | 401 or 404 after downloads require auth |
| Existing cropped JPEG from `ProfileView` | still updates `avatar_url` |

Suggested location: `metatest/src/backend/__tests__/uploadAvatar.test.js`, following `runtimeMode.test.js`. The test must stub `sharp` or use the installed `sharp` to re-encode a tiny PNG. It must not listen on a public interface.

## Hosting changes that need a person

- Confirm whether LiteSpeed executes PHP under `/avatars`.
- If it does, disable script handlers on `avatars`, `uploads`, `blog-media`, `images/questions`, and `files` before or at the same time as the code fix.
- Prefer a directory outside `public_html` and a Node route that streams images with `Content-Type: image/webp` and `Content-Disposition: inline` plus `X-Content-Type-Options: nosniff`.
- Object storage is not configured. Do not assume it exists.
