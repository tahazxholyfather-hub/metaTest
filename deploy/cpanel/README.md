# cPanel deploy artifacts

These files are not installed by the Node app and are not copied into `public/` on build. After Gate 2, copy each `.htaccess` into the matching directory on the shared hosting account (`public_html/...`).

| File in this folder | Copy to |
| --- | --- |
| `public_html/avatars/.htaccess` | `public_html/avatars/` |
| `public_html/uploads/.htaccess` | `public_html/uploads/` |
| `public_html/uploads/ai/.htaccess` | `public_html/uploads/ai/` |
| `public_html/files/pdfs/.htaccess` | `public_html/files/pdfs/` |
| `public_html.htaccess` | `public_html/.htaccess` (headers and HTTP to HTTPS). Merge with care if a file is already there. |

They turn off PHP for Apache and LiteSpeed and deny script extensions, including `.php` and `.l33t`. Directory listing is off. Paste them by hand in File Manager. Do not upload a test `.php` to the live site.
