# Next.js security audit

## Result

**This is not a Next.js application.** Next.js advisory classes (middleware bypass, React Server Components, Server Actions, `NEXT_PUBLIC_` leaks, the Next image optimizer) do not apply. Treating them as bugs here would be a false positive (SEC-901).

Evidence:

- `metatest/package.json` scripts are `vite`, `vite build`, and `vite preview`. Dependencies include `react`, `react-dom`, `react-router-dom`, and `vite`. There is no `next` dependency.
- There is no `next.config.js`, no `app/` router, and no `pages/` router.
- The only `next` import is `next-themes` in `metatest/src/components/ui/sonner.tsx`. That package only switches a CSS theme. It is not the Next.js framework.
- Routing is `createBrowserRouter` in `metatest/src/App.tsx` (lines 691–697): `/admin/*`, `/re/*`, `/payment/result/:token`, and `/*`.
- The UI is a Vite SPA. The earlier live response was a small static `index.html`, which matches `metatest/index.html`, not a Next server render.
- There are no React Server Actions and no `NEXT_PUBLIC_` variables. Vite only inlines variables that the client source reads. `import.meta.env.APP_TOKEN` is referenced in `QuizView.tsx` and is unused. A real shared secret must not be given a `VITE_` name: Vite will ship it in the bundle.

## What still matters for this front end

| Topic | Where | Finding |
| --- | --- | --- |
| Source maps | Vite production build. No `build.sourcemap: true` in `vite.config.ts` | Default is off. Confirm the cPanel `dist/` does not contain `.map` files. UNKNOWN until someone looks in File Manager |
| Caching of user data | SPA calls `/api` with `credentials: 'include'` and `x-app-token` | API responses are JSON, not CDN-cached HTML of a user. No `Cache-Control` is set on `main`. A shared cache in front of `/api` would be dangerous. UNKNOWN whether Pingora or cPanel caches `/api` |
| Headers | Not set by Vite. The document is static files on cPanel | SEC-011. Set them in `.htaccess` (`infrastructure-audit.md`) |
| `dangerouslySetInnerHTML` | Notes, reports, quiz text | SEC-013. This is the XSS issue. It is not a Next.js issue |

Current Next.js version: not applicable. Do not add Next.js to “get patches”.
