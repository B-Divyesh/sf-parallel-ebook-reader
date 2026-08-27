# Independent verification 2 — PASS

Verified 2026-08-27 UTC from a clean checkout of candidate `8a507acd38520c5db0abdcd7209148062022b900` (`main`) against [https://parallel-ebook-reader.sociobot.in](https://parallel-ebook-reader.sociobot.in). This is an unambiguous **PASS**. The prior deployment-only failures are fixed in both the candidate and the live site.

## Local install, static checks, and build

- `npm ci` completed from the clean checkout; `npm audit --audit-level=high` reported 0 vulnerabilities.
- `npm test` passed: 4/4 Vitest tests.
- There is no separate lint script. `npm run build` runs `tsc --noEmit` then the exact Vite production build; it passed and produced `dist/`.
- `npm run test:e2e` passed: 6/6 Chromium tests, including the real EPUB reader flow, 390px/axe scan, offline reload, clean-profile first install, build-A/build-B service-worker update, and compiled static delivery policy.
- Production initial application JS is 22.39 kB (9.06 kB gzip); CSS is 12.97 kB (3.65 kB gzip). Both are below the 200 kB / 50 kB static budget. The only hero asset is a 134,428-byte WebP and there are no webfonts.

## Independent product exercise

Using generated DRM-free EPUBs with 20 paragraphs each on a 1440px desktop browser:

- Keyboard Enter opened the local-library dialog; the focused primary control had a visible 3px focus outline.
- `.txt` input was rejected with `Choose a DRM-free .epub file.`; an 80 MiB + 1 byte `.epub` was rejected with `This file is over 80 MB. Choose a smaller EPUB.` A subsequent valid import recovered normally.
- Imported both editions, created endpoint anchors, scrolled Edition A from 0 to 652px, and verified linked Edition B moved to 631px. Both anchors could then be removed; the visible anchor count became 0.
- Saved 20 sentence pairs, exported a TSV containing the header plus 20 rows (21 lines), and confirmed all 20 clippings survived reload via IndexedDB.
- An installed local shell and a fresh live service-worker-controlled profile both reloaded offline to `Your two editions. One reading rhythm.` The two `net::ERR_FAILED` console messages observed only during the deliberately offline local reload are expected failed network fallbacks; normal-flow console/page errors were zero.

At live 390×844:

- Exactly one `h1` and one `main` were present; Edition B was keyboard-operable as the active single-reader tab.
- `prefers-reduced-motion: reduce` reduced transition duration to `0.00001s`.
- An independent axe WCAG 2 A/AA scan had no serious or critical violations.
- The live console/page-error capture was empty. Normal runtime requests were solely to `https://parallel-ebook-reader.sociobot.in`; no analytics, tracker, CDN, or content-upload request occurred. Source review confirms the only external endpoint is the disclosed Sociobot license verification API, used only after a license is stored or supplied.

## PWA, response policy, performance, and live identity

- The browser update regression explicitly validated: a clean profile sees no false update toast; a changed build-B `sw.js` waits; `Update now` activates it; the stale toast then hides. This is the repaired failure from verification 1.
- Live service worker, manifest, offline page, `/privacy/`, and `/terms/` returned 200. Manifest has standalone display, a versioned `start_url`, 192/512 icons, and a maskable icon.
- SHA-256 values prove the deployed candidate shell/assets byte-match the local production build:
  - `dist/index.html` = live `/`: `53ae798e90335b5b37c1051951461e448c5bdb42ae1e78d07b73a2378f937434`
  - `dist/assets/main-CacILrpU.js` = live asset: `6e4b519f29906c95a21a2c1403ecc4ce531694b92d7728e763762420741c6bc9`
  - `dist/assets/main-Dwf686ho.css` = live asset: `4a840fd774f8e062ae4adc5fdb0142faa41de380e62d8e5a3acb195bbdd9513f`
- Live HTML/worker/manifest use `Cache-Control: public, max-age=0, must-revalidate`; hashed JS, CSS, and WebP use `public, max-age=31536000, immutable`.
- Live responses carry CSP (`default-src 'self'`, `frame-ancestors 'none'`, only the disclosed Sociobot API in `connect-src`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, strict-origin referrer policy, Permissions-Policy, and HSTS. Manifest content type is `application/manifest+json`.
- Local Lighthouse (mobile) scored Performance 98, Accessibility 100, Best Practices 100, SEO 92; FCP 1.0s, LCP 1.1s, TTI 1.4s, CLS 0. The local Vite preview's fallback response makes Lighthouse report a malformed `/robots.txt`; the live host correctly returns 404 for that absent file, so this is not a product or deployment defect.

## Privacy and documentation

The implementation uses IndexedDB for the workspace, object URLs for session-only audio, JSON backup/restore, and TSV export. EPUB contents are parsed locally; no books, audio, selections, or analytics leave the browser. `/privacy/`, `/terms/`, README, MIT LICENSE, design provenance, and the offline PWA manifest/service worker are present.

## Defects by severity

No P0, P1, P2, or P3 defects found. No release blockers.

## Re-run

```sh
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```
