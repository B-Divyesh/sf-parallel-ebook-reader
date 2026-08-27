# Parallel Reader — repair handoff

## Completed

Repaired every release-blocking finding recorded in `.factory/verification.md` for candidate `d677fe6eae1e5ca71e35adb59c788133da90067c`.

- The update toast is now hidden by CSS whenever its `hidden` attribute is present, and application code exposes it only when the current registration has a real `waiting` worker and the page was already controlled before registration. Its button only posts `SKIP_WAITING` to that worker; if it disappears first, the stale control is hidden rather than becoming a no-op.
- Service-worker cache release moved to `parallel-reader-v2`; install fetches use `cache: reload` so a new offline shell is not assembled from stale HTTP entries. The manifest start URL is versioned at `v=2`.
- Added `public/staticwebapp.config.json` for Azure Static Web Apps Standard delivery: long-lived immutable `/assets/*` caching, revalidation for the app document/worker/manifest, a self-only CSP (with the registered Sociobot API allowed only for license verification), `frame-ancestors 'none'`, `X-Frame-Options: DENY`, Permissions-Policy, nosniff/referrer headers, and `application/manifest+json` for `.webmanifest`.
- The existing paid action remains the registered production Sociobot endpoint `https://api.sociobot.in/api/v1/products/parallel-ebook-reader/checkout`; a live request returned a 303 to a `checkout.dodopayments.com` Dodo Live session. No payment provider is embedded.
- Added browser regressions for clean-profile first install, build-A/build-B worker waiting/update activation, and compiled static delivery policy. Existing real EPUB parsing, IndexedDB/local-only behavior, offline reload, mobile layout, keyboard behavior, and accessibility tests remain intact.

## Run and verify

```sh
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Verified locally on 2026-08-27 UTC:

- `npm ci`: completed; `npm audit --audit-level=high` found 0 vulnerabilities.
- `npm test`: 4/4 passed.
- `npm run build`: passed and produced `dist/`. Initial reader JS is 22.39 kB (9.06 kB gzip) and CSS is 12.97 kB (3.65 kB gzip), within the static budgets.
- `npm run test:e2e`: 6/6 Chromium tests passed: real EPUB import/anchor/export/persistence; 390px + axe; offline reload; clean-profile install; build-A/build-B update; and output delivery-policy checks.
- The browser suite's axe scan reports no serious or critical WCAG 2 A/AA violations. It includes the 390×844 mobile view and an offline reload (`context.setOffline(true)`).

## Deployment

Deploy the built `dist/` directory with `/opt/fleet/lib/deploy-static.sh parallel-ebook-reader /work/repo/dist`; it provisions/uses the Standard Azure Static Web App and honors `staticwebapp.config.json`. After deployment, check the live page, `/manifest.webmanifest`, `/sw.js`, and a hashed `/assets/*` file for the configured headers and MIME type.

## Known gaps

- EPUB parsing intentionally extracts readable text and headings instead of recreating publisher layout, images, footnotes, or CSS. DRM/encrypted content remains rejected.
- Linked position follows interpolated manual paragraph anchors in the selected chapter pair; chapter matching is deliberately manual.
- Local audio is session-only and has no timestamp mapping. The only paid feature remains private clipping notes; reading, backup, export, and accessibility features remain free.
