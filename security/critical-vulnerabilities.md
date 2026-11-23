# Critical vulnerabilities and the proposed fix

Nothing in this file has been applied to application code.

The reported RCE is split on purpose. Uploading a `.php` avatar is proven. Execution of that file is not proven from the repository.

## Fix first

| Order | ID | Why it is first | Breaking? |
| --- | --- | --- | --- |
| 1 | SEC-001 | Database, JWT, payment, SMS, and model credentials are in git | Yes. Production breaks until the new values are installed on the server. History rewrite needs a maintainer. |
| 2 | AUTH-001 | Forged base64 `{"id":N}` passes as that user, including the upload route | Yes. Legacy guest tokens stop working. |
| 3 | AUTH-002 | Static `APP_TOKEN` is user 1 / admin, and the value is in git | Yes. Any script that sends `APP_TOKEN` as a user session breaks. Rotate the value anyway. |
| 4 | UP-001 | Any extension is stored on the public web root | Low if the UI keeps sending cropped JPEG and the server re-encodes it. Old avatar URLs keep working. |
| 5 | UP-002 | Confirm on the host that `/avatars/*.php` is not executed | Hosting change. May be impossible from git alone. Do it in addition to UP-001, not instead of it. |
| 6 | DATA-001 | Full dumps may contain users and hashes | Removing files from git does not change runtime. Do not delete the only backup. |

## UP-001 proposed change (minimal)

In `server.js` / `handleUploadAvatar` only:

- Memory storage, 5 MB limit.
- Allow JPEG, PNG, WebP by magic bytes, then `sharp` re-encode to WebP (or JPEG if you want to avoid a new content type).
- Filename: `avatar-` + `crypto.randomBytes(16).toString('hex')` + the encoder's extension.
- Reject decode failures. Do not write the original buffer.
- Cap the longest side (for example 1024).
- Keep `requireToken`.
- Do not trust `originalname`, MIME, or the cropper.

Optional file written into the avatar directory, only if you approve a hosting-facing change:

```
# avatars/.htaccess — defense in depth, not the actual fix
<FilesMatch "\.(php|phtml|phar|php[0-9]|shtml)$">
  Require all denied
</FilesMatch>
RemoveHandler .php .phtml .phar
```

`php_flag engine off` is useful only for `mod_php`. LiteSpeed often uses `lsphp`, so do not treat that flag as proof.

Out of scope for the minimal patch: moving the directory outside `public_html`. That is safer and needs a deploy check, because `ensureAvatarDir` currently prefers the web root. Ask before changing production paths.

## AUTH-001 / AUTH-002 proposed change

In `middleware/auth.js`, delete lines 90–111 (the base64 parse and the `APP_TOKEN` comparison). `jwt.verify` failure returns 401.

Do not ship this until guest login issues a real JWT. `handleGuestLogin` must be read in the same change so guests are not locked out with no replacement.

## What will not be called a fix

- Rejecting names that end in `.php` while still storing `.phtml`, `.html`, `.svg`, or `.php.jpg` with the original bytes.
- A client-side `accept="image/*"` check.
- Assuming Express static serving means LiteSpeed will not execute PHP.

## Hosting questions that block UP-002

Answer these before anyone edits the live panel:

1. Is Nginx or Apache config available to this account, or only cPanel and `.htaccess`?
2. Can Node's environment change, or only the application files?
3. Can the process write outside `public_html`?
4. Is there object storage?
5. Can Semgrep, Gitleaks, or Trivy run on the host? They are not installed in this workspace.

Until those answers exist, the code fix for UP-001 is the part this repository can guarantee.
