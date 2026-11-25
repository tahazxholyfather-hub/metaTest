# Infrastructure audit

Standards: ASVS 5.0 V12 Secure Communication, V13 Configuration. CIS Docker does not apply: there is no Docker file in this repository.

## What the host is

| Question | Answer | Evidence |
| --- | --- | --- |
| Provider | Pars Web Server (پارس وب سرور) | Owner, 2026-11-25 |
| Plan | Shared cPanel | Owner, 2026-11-25 |
| Web server | Apache or LiteSpeed, PHP handlers enabled | Owner. Which of the two is UNKNOWN |
| App process | Node, probably cPanel “Setup Node.js App” / Passenger | Owner. The startup file in the panel is UNKNOWN |
| Staging | None | Owner. This blocks Phase 7 |
| Proxy in front | A previous response identified Pingora. The config is not in the repo | Prior observation. How it sits in front of cPanel is UNKNOWN |
| TLS | Valid Let’s Encrypt certificate on the HTTPS response already observed | Prior observation. Not re-checked |
| Hidden files | `/.env` and `/.git/HEAD` returned 403 | Prior observation. Good |
| Docker | Not in the repo | No `Dockerfile` |
| CI | Not in the repo | No `.github/workflows` |
| `.htaccess` | Not in the repo | No file to review |

The live document response had no security headers, and plain HTTP returned 500 instead of a redirect to HTTPS. Those two facts are SEC-011 and SEC-012. This program did not send a new request to production.

## Why cPanel changes the upload risk

Passenger runs Node. Apache or LiteSpeed still owns the virtual host, and on this plan PHP handlers are enabled. Existing files whose names end in `.php` are commonly handled by `lsphp` or `mod_php` / PHP-FPM **before** Passenger. The profile upload writes those names into `public/avatars` (SEC-007). If that `public/` directory is the cPanel document root, or is mapped under `public_html`, the file runs. Node’s `express.static` does not execute PHP; the web server in front of it does.

Confirm in cPanel, without uploading anything:

- Setup Node.js App → application root and application URL.
- File Manager → whether `public/avatars` and `public/uploads` sit inside `public_html` or the domain’s document root.
- MultiPHP Manager → which PHP version is on for `metatest.app`.
- The HTTP error log for the 500 on port 80.

## Required changes (cPanel only)

Do these on the **origin** that answers for `metatest.app`. There is no VPS nginx config to add. If the Pingora front door strips headers, the same header list also has to be set there; the files below are what this cPanel account can do.

Use one redirect, not two. cPanel “Force HTTPS Redirect” plus the rewrite below will loop. If port 80 currently returns 500, the rewrite never runs until that vhost error is fixed. Read the cPanel error log first, then enable the redirect.

### 1. Document-root `.htaccess` (headers, HTTPS, no indexes)

Place this in the domain document root (often `public_html/.htaccess`). `Header` needs `mod_headers`, which cPanel Apache and LiteSpeed both provide.

```apache
RewriteEngine On
RewriteCond %{HTTPS} !=on
RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

Options -Indexes -ExecCGI

<IfModule mod_headers.c>
  Header always set Strict-Transport-Security "max-age=15552000; includeSubDomains"
  Header always set X-Content-Type-Options "nosniff"
  Header always set X-Frame-Options "DENY"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
  Header always set Permissions-Policy "camera=(), microphone=(self), geolocation=()"
  Header always set Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; media-src 'self' blob:; worker-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"
</IfModule>
```

`microphone=(self)` is there because the tutor records audio in the browser. Load the Content-Security-Policy as `Content-Security-Policy-Report-Only` first. MathJax may need the style exception. Do not add `script-src 'unsafe-inline'`. Do not add `preload` until every name on the certificate is HTTPS.

### 2. `.htaccess` in every upload directory (kill PHP)

Put this in `public/avatars/`, `public/uploads/` (and `images/`, `audio/`, `pdfs/`, `generated/` under it), and `public/files/pdfs/`. It covers Apache and LiteSpeed. `php_flag engine off` alone is not enough on PHP-FPM; the `FilesMatch` deny is the control that still works.

```apache
Options -Indexes -ExecCGI

<IfModule mod_php.c>
  php_flag engine off
</IfModule>
<IfModule lsapi_module>
  php_flag engine off
</IfModule>

RemoveHandler .php .phtml .php3 .php4 .php5 .php7 .php8 .phar .phps .cgi .pl
RemoveType .php .phtml .phar .phps

<FilesMatch "(?i)\.(php|phtml|php[0-9]|phar|phps|cgi|pl|py|asp|aspx|shtml|htaccess)$">
  <IfModule mod_authz_core.c>
    Require all denied
  </IfModule>
  <IfModule !mod_authz_core.c>
    Deny from all
  </IfModule>
</FilesMatch>

<IfModule mod_headers.c>
  Header set X-Content-Type-Options "nosniff"
  Header set Content-Disposition "attachment"
</IfModule>

SetHandler none
```

`Content-Disposition: attachment` on avatars will stop them rendering in an `<img>`. Use that on PDF and AI document folders. For `avatars/` and AI images, keep the `FilesMatch` deny and `nosniff`, and drop `Content-Disposition: attachment` only if images must display. Never drop the PHP deny.

Also turn directory indexes off in cPanel (Indexes) so a missing `.htaccess` is not the only control.

### 3. Secrets and the Node app

In cPanel → Setup Node.js App, set the environment variables there. Do not put them back in a file inside the application root that Apache can serve. The committed `.env` files are SEC-001. Set `NODE_ENV=production`. Passenger’s “application mode” should be production.

Application root should not be the same folder Apache lists as a PHP document root if you can split them. If they must stay together, the upload `.htaccess` files are mandatory before any other deploy.

## Staging is a prerequisite for Phase 7

There is no staging environment. Phase 7 (retest) must not run against `metatest.app`. Create a cPanel subdomain or addon domain that is not the live site, with its own Node application and synthetic users. Do not restore `quiz_app(full_Database).txt` onto any host that is reachable from the internet. Do not upload a PHP probe to production to “see if it runs”.

## What this repo cannot fix

PR #55 adds response headers inside Express. Passenger will attach those to responses Node generates. Apache/LiteSpeed will not add them to the static `index.html` it serves itself, and it will still execute `.php` in `public/` until the upload `.htaccess` is in place. Those two files are an owner change in cPanel, after Gate 1, not a commit to `main` from this program.
