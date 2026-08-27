# Parallel Reader — build handoff

## Independent verification verdict — FAIL (2026-08-27 UTC)

Commit `d677fe6eae1e5ca71e35adb59c788133da90067c` and `https://parallel-ebook-reader.sociobot.in` were independently checked from a clean checkout. The live `index.html` and `sw.js` byte-match the candidate build. Core unit, build, E2E, desktop/mobile, offline, accessibility, keyboard, malformed-EPUB recovery, TSV export, privacy/outbound-request, and bundle checks passed; see `.factory/verification.md` for exact commands and evidence.

Do **not** release this candidate as verified. A brand-new browser profile incorrectly displays the PWA “update available” toast despite having no waiting worker; its Update now action is then a no-op. The deployed site also serves hashed assets with only `max-age=30` and lacks CSP/frame/permissions hardening (and serves the manifest as `application/octet-stream`). These are recorded as P1/P2 defects in `.factory/verification.md`.

## Shipped

Finished v1 of the local-first Parallel Reader PWA. Users can import two real DRM-free EPUBs, choose chapters independently, read side by side, create and remove paragraph anchors, follow anchored linked position, save sentence pairs, play local audio, export TSV, and export/import a complete JSON workspace backup. Books, anchors, clippings, and notes persist in IndexedDB. No book content is uploaded.

The responsive 390px experience uses explicit Edition A / Edition B tabs. Empty, invalid-file, encrypted-content, unavailable-storage, offline, update, and destructive-clear states are covered. Native controls and dialogs support keyboard operation. The optional $18 one-time Reader’s desk license follows the Sociobot buy/capture/verify/restore contract; it adds private clipping notes without gating reading, accessibility, backup, or TSV export.

The product-specific monochrome broadsheet system, exact generated-image prompt, review, and provenance are recorded in `.factory/design.md`. The optimized WebP hero is 132 KB; the original source and prompt sidecar are retained under `assets/src/`.

## Verify

Run from a clean checkout:

```sh
npm install
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Verified on 2026-08-27:

- `npm test`: 4/4 unit tests pass (EPUB parsing, DRM rejection, paragraph cleaning, anchor interpolation).
- `npm run test:e2e`: 3/3 Chromium scenarios pass (complete import/anchor/export/persistence flow, 390px + axe, offline service-worker reload).
- `npm run build`: passes; output is `dist/` with `dist/index.html` at root.
- Factory `verify-url.sh`: HTTP 200, title/lang/main present, one h1, no images missing alt, no unlabeled buttons, and no console/page errors.
- Lighthouse mobile: performance 100, accessibility 100, best practices 100; LCP 1.0 s, FCP 1.0 s, TBT 0 ms, CLS 0.
- Production bundle: initial app JS 22.35 KB / 9.04 KB gzip; CSS 12.92 KB / 3.63 KB gzip; no webfonts; hero WebP 132 KB.
- `npm audit`: 0 vulnerabilities.

Evidence is in `.factory/evidence/` (`verify.json`, desktop/mobile screenshots, Lighthouse JSON).

## Known gaps and next steps

- EPUB parsing intentionally extracts readable text and headings rather than reproducing publisher layout, images, footnotes, or CSS. This keeps the alignment surface safe and consistent.
- Linked position follows interpolated manual paragraph anchors within the selected chapter pair. Chapter matching itself is manual, by design.
- Local audio is session-only and is not mapped to audiobook timestamps. A future paid enhancement could persist explicit audio bookmarks after adding storage-size controls.
- License verification needs the factory-registered production product to exercise a real purchase; the request shape and offline verdict cache are implemented.
