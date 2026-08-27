# Parallel Reader

Parallel Reader is a private, offline-first reading desk for language learners who own two DRM-free editions of the same book. It opens EPUBs entirely in the browser, lets readers align corresponding paragraphs, follows those anchors while scrolling, plays a local audiobook, and exports useful sentence pairs as TSV.

Live: <https://parallel-ebook-reader.sociobot.in>

## What v1 includes

- Real EPUB container, package, spine, metadata, and XHTML extraction
- Independent chapter selection and side-by-side reading
- Manual, reversible paragraph anchors and linked reading position
- Local audio playback without upload
- Private sentence-pair notebook with TSV and full JSON backup/export
- IndexedDB persistence, installable PWA shell, and tested offline reload
- Truthful update prompt: it appears only for a worker that is actually waiting
- Mobile 390 px edition tabs and complete keyboard operation
- Optional $18 one-time Reader’s desk license for private clipping notes; all reading and export features remain free

Parallel Reader does not include books, remove DRM, translate text, or publish user content. Font obfuscation used by otherwise DRM-free EPUBs is supported; encrypted reading content is rejected.

## Run and verify

Requires Node.js 20 or newer.

```sh
npm install
npm run dev
npm test
npm run build
```

The exact production command is `npm run build`. Static output lands in `dist/`, with `dist/index.html` at its root. To run the browser suite after installing Playwright Chromium:

```sh
npx playwright install chromium
npm run test:e2e
```

The browser suite includes a brand-new-profile first-install check and a build-A/build-B service-worker update check, plus the reader, mobile, accessibility, and offline flows.

## Privacy and data ownership

Books, anchors, and clippings remain in IndexedDB on the reader’s device. Audio is session-only. The app has no analytics, trackers, remote fonts, or runtime CDN dependencies. Users can export and restore the complete workspace as JSON and export clippings as TSV. See `/privacy/` and `/terms/` in the built site.

## Deploy

Deploy `dist/` as an Azure Static Web Apps **Standard** static site. `public/staticwebapp.config.json` is copied into the build and supplies immutable caching for `/assets/*`, revalidation for the HTML/worker/manifest, CSP, anti-framing, Permissions-Policy, and `application/manifest+json`. No backend or environment variable is required. Purchases and license verification use the registered Sociobot production endpoint for `parallel-ebook-reader`, which creates Dodo Live checkout sessions; no payment provider is embedded.

The researched scope is in `.factory/brief.json`, visual decisions and asset provenance are in `.factory/design.md`, and verification details are in `.factory/handoff.md`.

## License

MIT. See [LICENSE](LICENSE).
