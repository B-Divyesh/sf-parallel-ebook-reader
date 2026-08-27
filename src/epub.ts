import { unzipSync, strFromU8 } from 'fflate';
import type { Book, Chapter } from './types';

const MAX_BYTES = 80 * 1024 * 1024;

function parseXml(text: string, type: DOMParserSupportedType = 'application/xml'): Document {
  const document = new DOMParser().parseFromString(text, type);
  if (document.querySelector('parsererror')) throw new Error('This EPUB contains unreadable book data.');
  return document;
}

function localElements(root: ParentNode, name: string): Element[] {
  return Array.from(root.querySelectorAll('*')).filter((element) => element.localName === name);
}

function directory(path: string): string {
  return path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
}

function normalizePath(path: string): string {
  const parts: string[] = [];
  for (const bit of path.split('/')) {
    if (!bit || bit === '.') continue;
    if (bit === '..') parts.pop(); else parts.push(bit);
  }
  return parts.join('/');
}

export function cleanParagraphs(document: Document): string[] {
  document.querySelectorAll('script,style,nav,svg,form').forEach((node) => node.remove());
  const candidates = Array.from(document.querySelectorAll('h1,h2,h3,h4,p,li,blockquote'));
  const output: string[] = [];
  for (const node of candidates) {
    if (node.querySelector('p,li,blockquote')) continue;
    const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (text && !output.includes(text)) output.push(text);
  }
  return output;
}

export async function parseEpub(file: File): Promise<Book> {
  if (!file.name.toLowerCase().endsWith('.epub')) throw new Error('Choose a DRM-free .epub file.');
  if (file.size > MAX_BYTES) throw new Error('This file is over 80 MB. Choose a smaller EPUB.');
  let archive: Record<string, Uint8Array>;
  try { archive = unzipSync(new Uint8Array(await file.arrayBuffer())); }
  catch { throw new Error('The file could not be opened as an EPUB. It may be damaged or protected.'); }

  const encrypted = archive['META-INF/encryption.xml'];
  if (encrypted) {
    const encryptionDoc = parseXml(strFromU8(encrypted));
    const encryptedItems = localElements(encryptionDoc, 'EncryptedData');
    const fontObfuscationOnly = encryptedItems.length > 0 && encryptedItems.every((item) => {
      const algorithm = localElements(item, 'EncryptionMethod')[0]?.getAttribute('Algorithm') ?? '';
      return algorithm.includes('idpf.org/2008/embedding') || algorithm.includes('ns.adobe.com/pdf/enc#RC');
    });
    if (encryptedItems.length && !fontObfuscationOnly) {
      throw new Error('This EPUB contains encrypted content. Parallel Reader accepts DRM-free books only.');
    }
  }
  const containerBytes = archive['META-INF/container.xml'];
  if (!containerBytes) throw new Error('This file is missing its EPUB container information.');
  const container = parseXml(strFromU8(containerBytes));
  const rootfile = localElements(container, 'rootfile')[0]?.getAttribute('full-path');
  if (!rootfile || !archive[rootfile]) throw new Error('This EPUB does not point to readable book content.');
  const packageDoc = parseXml(strFromU8(archive[rootfile]!));
  const packageDir = directory(rootfile);
  const meta = (property: string) => {
    const modern = localElements(packageDoc, 'meta').find((item) => item.getAttribute('property') === `dcterms:${property}` || item.getAttribute('property') === property);
    const dc = localElements(packageDoc, property)[0];
    return (modern?.textContent || dc?.textContent || '').trim();
  };
  const manifest = new Map<string, string>();
  for (const item of localElements(packageDoc, 'item')) {
    const id = item.getAttribute('id');
    const href = item.getAttribute('href');
    if (id && href) manifest.set(id, normalizePath(packageDir + decodeURIComponent(href.split('#')[0]!)));
  }
  const chapters: Chapter[] = [];
  for (const itemref of localElements(packageDoc, 'itemref')) {
    const idref = itemref.getAttribute('idref');
    const path = idref ? manifest.get(idref) : undefined;
    const bytes = path ? archive[path] : undefined;
    if (!path || !bytes) continue;
    try {
      const doc = parseXml(strFromU8(bytes), 'text/html');
      const paragraphs = cleanParagraphs(doc);
      if (!paragraphs.length) continue;
      const heading = doc.querySelector('h1,h2,h3,title')?.textContent?.replace(/\s+/g, ' ').trim();
      chapters.push({ id: idref!, title: heading || `Section ${chapters.length + 1}`, paragraphs });
    } catch { /* skip malformed non-reading-order resources */ }
  }
  if (!chapters.length) throw new Error('No readable chapters were found in this EPUB.');
  return {
    id: crypto.randomUUID(),
    title: meta('title') || file.name.replace(/\.epub$/i, ''),
    creator: meta('creator') || 'Unknown author',
    language: meta('language') || 'Unspecified',
    filename: file.name,
    chapters,
    importedAt: Date.now()
  };
}

export function nearestMappedParagraph(source: number, anchors: Array<[number, number]>, targetLength: number): number {
  if (!anchors.length) return Math.max(0, Math.min(targetLength - 1, source));
  const sorted = [...anchors].sort((a, b) => a[0] - b[0]);
  let before = sorted[0]!;
  let after = sorted[sorted.length - 1]!;
  for (const anchor of sorted) {
    if (anchor[0] <= source) before = anchor;
    if (anchor[0] >= source) { after = anchor; break; }
  }
  const span = after[0] - before[0];
  const mapped = span === 0 ? before[1] : before[1] + ((source - before[0]) / span) * (after[1] - before[1]);
  return Math.max(0, Math.min(targetLength - 1, Math.round(mapped)));
}
