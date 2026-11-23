# Next.js security audit

Result: this repository is not a Next.js application. The checklist was still walked, against the code that actually exists.

| Next.js surface | Present? |
| --- | --- |
| `next.config.js` / `next.config.ts` | No |
| App Router `app/` | No application router. `metatest/src` is a Vite tree |
| Pages Router `pages/api` | No |
| Server Actions | No |
| `middleware.ts` | No Next middleware. Express middleware is in `metatest/src/backend/middleware/` |
| Server / Client Components | React client components bundled by Vite. Data loading is `fetch` to Express |
| Image optimization config | No `images.remotePatterns`. The client uses normal `<img>` and canvas cropping. Server-side `sharp` exists for AI uploads only |
| Next.js dependency | Not in `metatest/package.json`. `next-themes` is a theme package, not the framework |

## What was reviewed instead

- Vite config: `metatest/vite.config.ts` (dev server and an uploads ignore pattern). It is not a security boundary.
- Environment exposure: client code uses `import.meta.env.VITE_API_BASE_URL`. That prefix is public by Vite's design. Server secrets (`JWT_SECRET`, `DB_PASSWORD`, `OPENAI_API_KEY`) are read with `process.env` in the backend and are not bundled by Vite, except that the tracked `metatest/src/backend/.env` also contains `VITE_*` names beside real secrets (SEC-001). Do not import that file into the Vite build.
- Authentication and authorization run in Express, which is the correct side. Several handlers still trust body fields after the token check (IDOR-001, IDOR-002, IDOR-003).
- Cache: no Next.js fetch cache. Static files are served by Express and, in production, possibly by LiteSpeed with whatever cache headers the panel sets. Those headers are not in git.
- SSR: Vite SPA. There is no server-rendered HTML path in the quiz app beyond the static `index.html`.

## Outdated Next.js

Not applicable. There is no Next.js version to upgrade.

If a future migration adds Next.js, the rules in `.cursor/rules/nextjs-security.mdc` apply, and the upload route must not move to a public `public/` directory with the client filename.
