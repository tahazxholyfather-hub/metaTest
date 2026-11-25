# Upload trace (static, redacted)

No file was uploaded. No upload was requested against production.

## Profile image — `POST /api/upload_avatar`

Code: `metatest/src/backend/server.js` lines 57–78 and 102–106.

- Auth: `requireToken` (see SEC-006: that check accepts a forged base64 token and the committed app token).
- Library: `multer` disk storage. No `fileFilter`.
- Size cap: 5 MB.
- Directory: `path.resolve(__dirname, '../../public/avatars')`, which is `metatest/public/avatars` from this file.
- Filename: `avatar-<timestamp>-<random>` plus `path.extname(file.originalname)`. The extension is taken from the client. `.php`, `.phtml`, `.phar`, `.html`, and `.svg` are all accepted. The directory portion of the original name is not used, so this is not a `../` write.
- Bytes are not sniffed and not re-encoded. `sharp` is not called.
- `express.static('public')` (line 93) serves that tree from the process working directory. Node’s static handler does not execute PHP. On cPanel, Apache or LiteSpeed often claims `.php` before Passenger does.

## PDF library — `Admin_save_pdf` on `POST /api/flow`

Code: `metatest/src/backend/controllers/adminController.js` lines 671–682.

- Body is base64, not multipart.
- Extension is forced to `.pdf`. Slashes in the original name are replaced, so this name does not escape the directory.
- No `%PDF-` check on `main`. A PHP payload stored with a `.pdf` name is not executed as PHP.
- Auth on this action is only `requireToken` (SEC-005). Any session can call it.

## AI files — `/api/ai-teacher/*`

Code: `metatest/src/backend/ai-teacher/services/fileStorage.js` lines 22–27 and 76–104.

- Images and PDFs are checked by magic bytes. Audio trusts the declared MIME.
- Names are random. The extension comes from the MIME map, not from the raw client filename.
- Files are written under `public/uploads/ai/`.
- Images that `sharp` can decode are re-encoded to WebP. GIFs are kept. `limitInputPixels` is left at the library default. `failOn: 'none'` is set. `.rotate()` runs, and `withMetadata()` is not called, so a successful re-encode drops EXIF. If `sharp` throws, the original bytes are stored.

## Word import — `Admin_parse_questions_docx`

The `.docx` is base64 in JSON. It is unzipped with `zlib` and read as XML text with regular expressions. It is not written to disk as a script and it is not passed to `child_process`.

## Execution search

No `child_process`, no `eval(`, no `new Function`, no `<?php`, and no `.php` application files in this repository. Redis `pipeline.exec()` is a client command, not a shell.

## RCE conclusion used by SEC-007

The write of a `.php` file into `public/avatars` is confirmed from the code. Whether Apache/LiteSpeed then executes it is not proven, because the vhost document root is not in the repo and production was not probed. Given shared cPanel with PHP handlers and Passenger, that execution is likely if `public/` is under the account document root. It is not a false positive.
