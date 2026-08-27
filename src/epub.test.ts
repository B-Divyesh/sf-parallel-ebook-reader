import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { cleanParagraphs, nearestMappedParagraph, parseEpub } from './epub';

describe('paragraph extraction', () => {
  it('keeps readable blocks and strips unsafe or nested content', () => {
    const doc = new DOMParser().parseFromString('<main><h1>Chapter One</h1><p>Hello   world.</p><div><p>Second line.</p></div><script>bad()</script></main>', 'text/html');
    expect(cleanParagraphs(doc)).toEqual(['Chapter One', 'Hello world.', 'Second line.']);
  });
});

describe('alignment interpolation', () => {
  it('maps the reading position between manual anchors', () => {
    expect(nearestMappedParagraph(5, [[0, 2], [10, 22]], 30)).toBe(12);
    expect(nearestMappedParagraph(20, [[0, 2], [10, 22]], 24)).toBe(22);
  });
});

describe('EPUB parser', () => {
  it('reads metadata and spine chapters from a valid local EPUB', async () => {
    const archive = zipSync({
      'META-INF/container.xml': strToU8('<?xml version="1.0"?><container><rootfiles><rootfile full-path="OPS/package.opf"/></rootfiles></container>'),
      'OPS/package.opf': strToU8('<?xml version="1.0"?><package xmlns:dc="http://purl.org/dc/elements/1.1/"><metadata><dc:title>Test Book</dc:title><dc:creator>A. Writer</dc:creator><dc:language>fr</dc:language></metadata><manifest><item id="c1" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/></spine></package>'),
      'OPS/chapter.xhtml': strToU8('<html><head><title>Opening</title></head><body><h1>Opening</h1><p>Bonjour le monde.</p></body></html>')
    });
    const file = { name: 'test.epub', size: archive.byteLength, arrayBuffer: async () => archive.buffer } as File;
    const book = await parseEpub(file);
    expect(book.title).toBe('Test Book');
    expect(book.creator).toBe('A. Writer');
    expect(book.chapters[0]?.paragraphs).toContain('Bonjour le monde.');
  });

  it('rejects declared encrypted content', async () => {
    const archive = zipSync({
      'META-INF/container.xml': strToU8('<container><rootfiles><rootfile full-path="package.opf"/></rootfiles></container>'),
      'META-INF/encryption.xml': strToU8('<encryption><EncryptedData /></encryption>')
    });
    const file = { name: 'locked.epub', size: archive.byteLength, arrayBuffer: async () => archive.buffer } as File;
    await expect(parseEpub(file)).rejects.toThrow('encrypted content');
  });
});
