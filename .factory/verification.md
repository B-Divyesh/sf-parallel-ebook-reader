# Independent verification — FAIL

Verified 2026-08-27 UTC against commit `d677fe6eae1e5ca71e35adb59c788133da90067c` (clean `main` checkout) and [https://parallel-ebook-reader.sociobot.in](https://parallel-ebook-reader.sociobot.in). The live `index.html` and `sw.js` SHA-256 values exactly matched the production build from that commit. This is a **FAIL**: the candidate has a reproducible false PWA update state, and the live deployment misses required cache/security hardening.

## Reproduction and results

- Clean install: `npm ci` completed; `npm audit --audit-level=high` reported 0 vulnerabilities.
- Unit/integration: `npm test` passed, 4/4 tests.
- Type check and exact production build: `npm run build` passed. `dist/` was produced. Initial application JS is 22.35 kB / 9.04 kB gzip and CSS is 12.92 kB / 3.63 kB gzip (within the 200 kB / 50 kB budgets); no webfonts; WebP illustration is 134,428 bytes.
- Repository browser suite: after `npx playwright install chromium`, `npm run test:e2e` passed 3/3 Chromium scenarios.
- Independent local browser exercise, desktop and 390×844:
  - Imported two generated, two-chapter DRM-free EPUBs; independently changed chapters; selected paragraphs; added anchors; saved clips; exported TSV with header `Edition A\tEdition B\tA reference\tB reference\tNote`; and reloaded after persistence. Two anchors and two clips survived reload.
  - Rejected `.txt`, corrupt ZIP-as-EPUB, and declared encrypted EPUB inputs with clear recovery messages; a subsequent valid EPUB imported successfully.
  - Keyboard Enter activated paragraph selection, anchor, and save controls (ending at two anchors/two clips). Tab traversal reached the skip link, primary controls, and link-position control with a visible solid focus outline. At 390 px, Edition B became the sole visible reader tab. `prefers-reduced-motion: reduce` reduced transitions to `0.00001s`.
  - No console errors or page errors occurred. Normal initial runtime requests were same-origin document, JS, CSS, and illustration only; source review confirms the only conditional external call is the disclosed Sociobot license API when a user supplies a license.
- Accessibility: independent axe WCAG 2 A/AA scans of the live site at desktop and 390 px had no serious or critical violations. Live page had status 200, one `<h1>`, one `<main>`, valid `lang`, title, and no request failures.
- PWA/offline: after service-worker activation, a live offline reload showed the application heading successfully. A local simulated changed `sw.js` produced a waiting worker, and Update now activated it. Manifest has standalone display, versioned start URL, 192/512 icons, and maskable purpose.
- Visual review: desktop and mobile live renders match the monochrome broadsheet design thesis, use the documented original illustration, and present usable empty states.

## Release-blocking defects

### P1 — Fresh install falsely announces an update

In a newly created Chromium persistent profile, opening the live URL once yielded `#update-toast` visible, `navigator.serviceWorker.controller === true`, and the registration had `waiting === false`. The toast says “An updated edition of the app is ready”, but no update exists and Update now has no waiting worker to activate. This was reproduced against the deployed URL and against the built candidate. It violates truthful action feedback and makes the required PWA update affordance misleading.

Actual later worker replacement works: after changing the local test copy of `sw.js`, the registration reached `waiting: "installed"`; activating it resulted in `waiting: false`. The failure is specifically the false-positive initial-install state, not the update mechanism itself.

### P2 — Production asset caching does not meet the PWA/static cache policy

The live HTML, hashed JS (`/assets/main-CKAz9ed9.js`), CSS, WebP, manifest, offline page, privacy page, terms page, and service worker are all served with `Cache-Control: public, must-revalidate, max-age=30`. Hashed static JS/CSS/media are not long-lived immutable assets, contrary to the performance/PWA cache requirement. The service worker masks this after activation but does not provide efficient normal browser caching.

### P2 — Production response hardening is incomplete

The live host sends HSTS, Referrer-Policy, and `X-Content-Type-Options: nosniff`, but no Content-Security-Policy, `frame-ancestors`/`X-Frame-Options`, or Permissions-Policy on the app, legal pages, service worker, or assets. The manifest is also sent as `application/octet-stream` rather than `application/manifest+json`. This is deployment configuration rather than an application-code mismatch, but it is part of the release under test.

## Scope notes

- No product files were changed during verification. This report and the handoff update are the only intended repository changes.
- The live deployment byte-matches the candidate’s app shell and service worker, so the P1 behavior is in the candidate rather than a deployment-only discrepancy.
- Re-run core checks with `npm ci && npm test && npm run build && npx playwright install chromium && npm run test:e2e`.
