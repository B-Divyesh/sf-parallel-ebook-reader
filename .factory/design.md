# Parallel Reader — visual thesis

## Direction: monochrome typographic broadsheet

Parallel Reader should feel like a bilingual newspaper laid open on a quiet desk: ink, paper, measured columns, crop marks, and the practical marginalia of a serious learner. It must not resemble an ebook storefront or a generic dashboard. The books remain the visual centre; controls recede into a compact masthead and a numbered workbench.

## Palette

The palette is explicitly single-mode, derived from warm newsprint and black printer's ink. It avoids bright product colour so that paragraph selections and alignment marks carry meaning through shape as well as tone.

- `paper #F2EFE6` — page background, warm enough to reduce glare.
- `sheet #FBF9F2` — raised reading surfaces.
- `ink #171714` — primary text, 16.2:1 on paper.
- `soft-ink #5C5A52` — secondary text, 6.1:1 on paper.
- `rule #AAA69A` — structural rules; never the only state signal.
- `signal #B43A28` — editorial red used sparingly for anchors, focus, and warnings.
- `signal-dark #7D2519` — interactive red, 7.1:1 on paper.
- `success #285B3D`, `warning #755214`, `danger #8A291F` — always paired with text/iconography.

## Type

- Display and reading: Georgia, `Times New Roman`, serif. Its newspaper ancestry gives long-form passages an editorial cadence without any network font cost.
- Interface and metadata: Arial, Helvetica, sans-serif in small uppercase labels with generous tracking.
- Scale: 12 / 14 / 16 / 20 / 32 / clamp(44–76) px. Reading text is 18px with 1.65 leading and a 68-character measure.

## Spacing and layout

An 8px base rhythm with 4px only for fine optical adjustments. The shell uses broad 24–40px gutters, hairline rules, and asymmetric editorial composition. Desktop reading is two equal columns divided by a central alignment rail. At 390px the composition becomes an intentional tabbed single-language reader; alignment actions remain in a bottom workbench and no control becomes smaller than 44px.

## Interaction grammar

- Import is framed as “Edition A / Edition B”, like assigning newspaper columns.
- Paragraphs are numbered. Clicking or pressing Enter selects a paragraph; selecting one on each side creates a reversible anchor.
- Anchor marks use a red left rule, a linked-chain glyph, and explicit text — never colour alone.
- Selecting paired paragraphs exposes “Save sentence pair”; the notebook is a chronological clipping file with TSV/JSON ownership controls.
- Synchronized position follows the nearest manual anchor and proportional progress between anchors. The linkage can be toggled without changing data.

## Motion policy

Motion is restrained and physical: 180ms opacity/translate for notices and drawer reveals, 220ms background transition for selections. Nothing loops. Under `prefers-reduced-motion: reduce`, transitions and smooth scrolling become instant while hierarchy and state remain intact.

## Asset plan and prompt sheet

The sole raster illustration is an original editorial still life for the empty-library introduction: an overhead open bilingual book with two narrow text-column textures, a red pencil drawing linking marks between pages, loose paper tabs, black ink and warm newsprint, high-contrast screenprint/halftone texture, hard directional desk light, flat graphic composition, monochrome cream/charcoal with one oxide-red accent. No legible text, no people, no hands, no logos, no watermark, no branded objects, no glossy 3D, no gradients. It clarifies the product's linked-edition idea; it is not a capability screenshot.

Generated asset provenance: created for this product with the factory Azure OpenAI image deployment (`factory-image`) on 2026-08-27. The exact prompt is stored beside the source image in `assets/src/parallel-desk.prompt.json`. Generated imagery is disclosed in the footer. App icons are original hand-authored SVG/PNG marks based on paired pages and an alignment rule.
