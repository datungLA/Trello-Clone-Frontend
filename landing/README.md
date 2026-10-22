# Trello learning landing page

Standalone Next.js App Router project, colocated in the frontend repository. Uses static export and Nginx; no long-running Next.js process is needed. This public page describes the learning app and provides configurable login/signup links. Its board illustration is static, not an interactive feature preview.

Run installation and builds on Dev with Node 24. Dependencies are pinned in this package and its own lockfile, separate from the Vite application. Build with `npm ci` and `npm run build`; static files are generated into `out/`.

Configure `NEXT_PUBLIC_APP_URL` and `SITE_URL` at build time. Compose's optional `landing` profile supplies them through Docker build arguments; defaults target private Dev tunnels at `http://localhost:8080` and `http://localhost:8081`. A production build must explicitly set the approved HTTPS hostnames. Canonical/Open Graph metadata, robots.txt, and sitemap.xml use `SITE_URL`. Environment changes require rebuilding the static page.

The design uses system fonts, CSS, and a static board illustration. There are no external trackers, image services, paid assets, or animation packages. Reduced-motion preferences disable smooth scrolling and transitions. Keyboard/mobile and performance acceptance still require browser evidence.

Static export reference: https://nextjs.org/docs/app/guides/static-exports
