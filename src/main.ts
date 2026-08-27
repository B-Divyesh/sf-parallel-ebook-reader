import './styles.css';
import { parseEpub, nearestMappedParagraph } from './epub';
import { clearState, loadState, saveState } from './db';
import { cachedUnlock, captureReturnedLicense, checkoutUrl, restoreLicense, verifyLicense } from './license';
import { emptyState, type Anchor, type AppState, type Book, type Side } from './types';

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const dialogs = {
  library: byId<HTMLDialogElement>('library-dialog'),
  notebook: byId<HTMLDialogElement>('notebook-dialog'),
  anchors: byId<HTMLDialogElement>('anchors-dialog'),
  support: byId<HTMLDialogElement>('support-dialog')
};
let state: AppState = structuredClone(emptyState);
let selected: Record<Side, number | null> = { left: null, right: null };
let unlocked = false;
let audioUrl: string | null = null;
let saveTimer = 0;
let scrollLock = false;

function announce(message: string): void { byId('import-status').textContent = message; }
function bookFor(side: Side): Book | null { return side === 'left' ? state.leftBook : state.rightBook; }
function chapterFor(side: Side) { return bookFor(side)?.chapters[state[`${side}Chapter`]]; }
function queueSave(): void {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => saveState(state).catch(() => announce('Could not save locally. Export a backup to protect your work.')), 180);
}

function showDialog(dialog: HTMLDialogElement): void {
  if (!dialog.open) dialog.showModal();
}

function renderBook(side: Side): void {
  const book = bookFor(side);
  const title = byId(`${side}-book-title`);
  const author = byId(`${side}-book-author`);
  const language = byId(`${side}-language`);
  const select = byId<HTMLSelectElement>(`${side}-chapter`);
  const pages = byId(`${side}-pages`);
  title.textContent = book?.title ?? 'No book open';
  author.textContent = book?.creator ?? '';
  language.textContent = book?.language ?? '—';
  byId(`${side}-file-label`).textContent = book ? book.title : `Choose ${side === 'left' ? 'first' : 'second'} EPUB`;
  select.replaceChildren();
  if (!book) {
    select.disabled = true;
    const option = new Option('Open an EPUB to begin', '');
    select.add(option);
    pages.innerHTML = `<div class="empty-reader"><b>Edition ${side === 'left' ? 'A' : 'B'} is empty</b>Choose a DRM-free EPUB from your device.</div>`;
    return;
  }
  select.disabled = false;
  book.chapters.forEach((chapter, index) => select.add(new Option(`${String(index + 1).padStart(2, '0')} — ${chapter.title}`, String(index))));
  select.value = String(state[`${side}Chapter`]);
  const chapter = chapterFor(side);
  pages.replaceChildren();
  chapter?.paragraphs.forEach((text, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'paragraph';
    button.dataset.index = String(index);
    button.setAttribute('aria-pressed', String(selected[side] === index));
    if (selected[side] === index) button.classList.add('selected');
    if (isAnchored(side, index)) button.classList.add('anchored');
    const number = document.createElement('span');
    number.className = 'pnum';
    number.textContent = `¶${String(index + 1).padStart(2, '0')}`;
    const content = document.createElement('span');
    content.textContent = text;
    button.append(number, content);
    button.addEventListener('click', () => selectParagraph(side, index));
    pages.append(button);
  });
}

function isAnchored(side: Side, paragraph: number): boolean {
  const chapter = state[`${side}Chapter`];
  return state.anchors.some((anchor) => anchor[`${side}Chapter`] === chapter && anchor[`${side}Paragraph`] === paragraph);
}

function selectParagraph(side: Side, index: number): void {
  selected[side] = selected[side] === index ? null : index;
  renderBook(side);
  updatePairBar();
}

function updatePairBar(): void {
  const ready = selected.left !== null && selected.right !== null && Boolean(chapterFor('left') && chapterFor('right'));
  byId<HTMLButtonElement>('add-anchor').disabled = !ready;
  byId<HTMLButtonElement>('save-pair').disabled = !ready;
  byId('pair-summary').textContent = ready ? `A ¶${selected.left! + 1} paired with B ¶${selected.right! + 1}` : 'Select one paragraph in each edition';
}

function createAnchor(): void {
  if (selected.left === null || selected.right === null) return;
  const duplicate = state.anchors.some((anchor) => anchor.leftChapter === state.leftChapter && anchor.rightChapter === state.rightChapter && anchor.leftParagraph === selected.left && anchor.rightParagraph === selected.right);
  if (duplicate) { announce('That paragraph pair is already anchored.'); return; }
  state.anchors.push({ id: crypto.randomUUID(), leftChapter: state.leftChapter, rightChapter: state.rightChapter, leftParagraph: selected.left, rightParagraph: selected.right, createdAt: Date.now() });
  queueSave();
  renderAll();
  announce('Anchor added. Linked position now follows this correspondence.');
}

function savePair(): void {
  if (selected.left === null || selected.right === null) return;
  const left = chapterFor('left');
  const right = chapterFor('right');
  if (!left || !right) return;
  state.clips.unshift({
    id: crypto.randomUUID(),
    leftText: left.paragraphs[selected.left] ?? '',
    rightText: right.paragraphs[selected.right] ?? '',
    leftRef: `${bookFor('left')?.title} — ${left.title}, ¶${selected.left + 1}`,
    rightRef: `${bookFor('right')?.title} — ${right.title}, ¶${selected.right + 1}`,
    note: '', createdAt: Date.now()
  });
  queueSave();
  renderNotebook();
  byId('clip-count').textContent = String(state.clips.length);
  announce('Sentence pair saved to your notebook.');
}

function renderNotebook(): void {
  const list = byId('clips-list');
  list.replaceChildren();
  if (!state.clips.length) {
    list.innerHTML = '<div class="empty-list">No clippings yet. Select matching paragraphs in the reader, then save the pair.</div>';
    return;
  }
  state.clips.forEach((clip, index) => {
    const row = document.createElement('article');
    row.className = 'clip';
    row.innerHTML = `<span class="clip-number">${String(index + 1).padStart(2, '0')}</span><blockquote></blockquote><blockquote></blockquote>`;
    const quotes = row.querySelectorAll('blockquote');
    quotes[0]!.textContent = clip.leftText;
    quotes[1]!.textContent = clip.rightText;
    for (const [quote, reference] of [[quotes[0]!, clip.leftRef], [quotes[1]!, clip.rightRef]] as const) {
      const cite = document.createElement('cite'); cite.textContent = reference; quote.append(cite);
    }
    const remove = document.createElement('button');
    remove.type = 'button'; remove.className = 'delete-clip'; remove.setAttribute('aria-label', `Delete sentence pair ${index + 1}`); remove.textContent = '×';
    remove.addEventListener('click', () => { state.clips = state.clips.filter((item) => item.id !== clip.id); queueSave(); renderNotebook(); byId('clip-count').textContent = String(state.clips.length); });
    row.append(remove);
    const note = document.createElement('input');
    note.className = 'clip-note'; note.value = clip.note; note.placeholder = unlocked ? 'Add a private note…' : 'Private notes are included with Reader’s desk'; note.disabled = !unlocked; note.setAttribute('aria-label', `Private note for pair ${index + 1}`);
    note.addEventListener('change', () => { clip.note = note.value; queueSave(); });
    row.append(note);
    list.append(row);
  });
}

function renderAnchors(): void {
  const list = byId('anchors-list'); list.replaceChildren();
  if (!state.anchors.length) { list.innerHTML = '<div class="empty-list">No anchors yet. Select one matching paragraph on each side.</div>'; return; }
  for (const anchor of state.anchors) {
    const leftChapter = state.leftBook?.chapters[anchor.leftChapter]?.title ?? `Chapter ${anchor.leftChapter + 1}`;
    const rightChapter = state.rightBook?.chapters[anchor.rightChapter]?.title ?? `Chapter ${anchor.rightChapter + 1}`;
    const row = document.createElement('div'); row.className = 'anchor-item';
    const left = document.createElement('span'); left.textContent = `A · ${leftChapter} ¶${anchor.leftParagraph + 1}`;
    const link = document.createElement('span'); link.textContent = '↔';
    const right = document.createElement('span'); right.textContent = `B · ${rightChapter} ¶${anchor.rightParagraph + 1}`;
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'delete-anchor'; remove.textContent = '×'; remove.setAttribute('aria-label', `Remove anchor between paragraphs ${anchor.leftParagraph + 1} and ${anchor.rightParagraph + 1}`);
    remove.addEventListener('click', () => { state.anchors = state.anchors.filter((item) => item.id !== anchor.id); queueSave(); renderAll(); });
    row.append(left, link, right, remove); list.append(row);
  }
}

function renderAll(): void {
  renderBook('left'); renderBook('right'); renderNotebook(); renderAnchors(); updatePairBar();
  byId('anchor-count').textContent = String(state.anchors.length);
  byId('clip-count').textContent = String(state.clips.length);
  byId<HTMLInputElement>('link-scroll').checked = state.linked;
  renderMobileTabs();
}

async function importBook(side: Side, file?: File): Promise<void> {
  if (!file) return;
  announce(`Opening ${file.name}…`);
  const input = byId<HTMLInputElement>(`${side}-file`); input.disabled = true;
  try {
    const book = await parseEpub(file);
    if (side === 'left') { state.leftBook = book; state.leftChapter = 0; }
    else { state.rightBook = book; state.rightChapter = 0; }
    selected[side] = null;
    state.anchors = [];
    queueSave(); renderAll();
    announce(`${book.title} opened: ${book.chapters.length} readable sections.`);
    if (state.leftBook && state.rightBook) dialogs.library.close();
  } catch (error) { announce(error instanceof Error ? error.message : 'The EPUB could not be opened.'); }
  finally { input.disabled = false; input.value = ''; }
}

function currentAnchors(sourceSide: Side): Array<[number, number]> {
  const other: Side = sourceSide === 'left' ? 'right' : 'left';
  return state.anchors
    .filter((a) => a[`${sourceSide}Chapter`] === state[`${sourceSide}Chapter`] && a[`${other}Chapter`] === state[`${other}Chapter`])
    .map((a) => [a[`${sourceSide}Paragraph`], a[`${other}Paragraph`]]);
}

function syncPosition(sourceSide: Side): void {
  if (!state.linked || scrollLock || matchMedia('(max-width: 800px)').matches) return;
  const source = byId(`${sourceSide}-pages`); const otherSide: Side = sourceSide === 'left' ? 'right' : 'left'; const target = byId(`${otherSide}-pages`);
  const sourceButtons = Array.from(source.querySelectorAll<HTMLElement>('.paragraph'));
  if (!sourceButtons.length) return;
  const top = source.getBoundingClientRect().top;
  let nearest = sourceButtons[0]!; let distance = Infinity;
  sourceButtons.forEach((button) => { const d = Math.abs(button.getBoundingClientRect().top - top - 8); if (d < distance) { nearest = button; distance = d; } });
  const sourceIndex = Number(nearest.dataset.index);
  const targetLength = chapterFor(otherSide)?.paragraphs.length ?? 0;
  if (!targetLength) return;
  const mapped = nearestMappedParagraph(sourceIndex, currentAnchors(sourceSide), targetLength);
  const targetButton = target.querySelector<HTMLElement>(`.paragraph[data-index="${mapped}"]`);
  if (!targetButton) return;
  scrollLock = true;
  target.scrollTop += targetButton.getBoundingClientRect().top - target.getBoundingClientRect().top - 8;
  requestAnimationFrame(() => { scrollLock = false; });
}

function download(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a'); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}

function tsvField(text: string): string { return `"${text.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`; }
function exportTsv(): void {
  if (!state.clips.length) { byId('clips-list').innerHTML = '<div class="empty-list">Save at least one sentence pair before exporting.</div>'; return; }
  const header = ['Edition A', 'Edition B', 'A reference', 'B reference', 'Note'];
  const rows = state.clips.map((clip) => [clip.leftText, clip.rightText, clip.leftRef, clip.rightRef, clip.note].map(tsvField).join('\t'));
  download(`parallel-reader-${new Date().toISOString().slice(0, 10)}.tsv`, [header.join('\t'), ...rows].join('\n'), 'text/tab-separated-values;charset=utf-8');
}

function renderMobileTabs(): void {
  for (const side of ['left', 'right'] as Side[]) {
    const active = state.activeMobileSide === side;
    byId(`tab-${side}`).setAttribute('aria-selected', String(active));
    byId(`${side}-panel`).classList.toggle('mobile-hidden', !active);
  }
}

function setupEvents(): void {
  byId('start-button').addEventListener('click', () => showDialog(dialogs.library));
  byId('library-button').addEventListener('click', () => showDialog(dialogs.library));
  byId('desk-library-button').addEventListener('click', () => showDialog(dialogs.library));
  byId('notebook-button').addEventListener('click', () => { renderNotebook(); showDialog(dialogs.notebook); });
  byId('anchors-button').addEventListener('click', () => { renderAnchors(); showDialog(dialogs.anchors); });
  byId('support-button').addEventListener('click', () => showDialog(dialogs.support));
  byId<HTMLAnchorElement>('buy-link').href = checkoutUrl;
  byId<HTMLInputElement>('left-file').addEventListener('change', (event) => importBook('left', (event.target as HTMLInputElement).files?.[0]));
  byId<HTMLInputElement>('right-file').addEventListener('change', (event) => importBook('right', (event.target as HTMLInputElement).files?.[0]));
  for (const side of ['left', 'right'] as Side[]) {
    byId<HTMLSelectElement>(`${side}-chapter`).addEventListener('change', (event) => { state[`${side}Chapter`] = Number((event.target as HTMLSelectElement).value); selected[side] = null; queueSave(); renderBook(side); updatePairBar(); });
    byId(`${side}-pages`).addEventListener('scroll', () => syncPosition(side), { passive: true });
    byId(`tab-${side}`).addEventListener('click', () => { state.activeMobileSide = side; queueSave(); renderMobileTabs(); });
  }
  byId('add-anchor').addEventListener('click', createAnchor);
  byId('save-pair').addEventListener('click', savePair);
  byId<HTMLInputElement>('link-scroll').addEventListener('change', (event) => { state.linked = (event.target as HTMLInputElement).checked; queueSave(); });
  byId('export-tsv').addEventListener('click', exportTsv);
  byId('backup-button').addEventListener('click', () => download(`parallel-reader-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), state }, null, 2), 'application/json'));
  byId<HTMLInputElement>('restore-file').addEventListener('change', async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return;
    try { const data = JSON.parse(await file.text()) as { version: number; state: AppState }; if (data.version !== 1 || !data.state || !Array.isArray(data.state.anchors) || !Array.isArray(data.state.clips)) throw new Error(); state = { ...structuredClone(emptyState), ...data.state }; queueSave(); renderAll(); announce('Backup imported.'); }
    catch { announce('That file is not a valid Parallel Reader backup.'); }
  });
  byId('clear-button').addEventListener('click', async () => { if (!confirm('Clear both books, all anchors, and every saved sentence pair from this device? Export a backup first if you may need them.')) return; await clearState(); state = structuredClone(emptyState); selected = { left: null, right: null }; renderAll(); announce('This reading desk has been cleared.'); });
  byId<HTMLInputElement>('audio-file').addEventListener('change', (event) => {
    const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return;
    if (audioUrl) URL.revokeObjectURL(audioUrl); audioUrl = URL.createObjectURL(file);
    const player = byId<HTMLAudioElement>('audio-player'); player.src = audioUrl; player.hidden = false; player.play().catch(() => undefined); announce(`Audio ready: ${file.name}.`);
  });
  byId('restore-license').addEventListener('click', async () => {
    const token = byId<HTMLInputElement>('license-input').value.trim(); if (!token) { byId('license-status').textContent = 'Paste your license token first.'; return; }
    restoreLicense(token); byId('license-status').textContent = 'Checking license…'; unlocked = await verifyLicense(true); byId('license-status').textContent = unlocked ? 'Reader’s desk unlocked on this device.' : 'This license could not be verified. Check the token and try again.'; renderNotebook();
  });
  window.addEventListener('online', updateConnection); window.addEventListener('offline', updateConnection);
}

function updateConnection(): void { byId('connection').hidden = navigator.onLine; }

async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    const replacingExistingWorker = Boolean(navigator.serviceWorker.controller);
    const registration = await navigator.serviceWorker.register('/sw.js');
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing; if (!worker) return;
      worker.addEventListener('statechange', () => { if (worker.state === 'installed' && navigator.serviceWorker.controller) byId('update-toast').hidden = false; });
    });
    byId('update-button').addEventListener('click', () => { registration.waiting?.postMessage({ type: 'SKIP_WAITING' }); });
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (replacingExistingWorker) location.reload(); });
  } catch { /* the reader remains functional without installation support */ }
}

async function init(): Promise<void> {
  captureReturnedLicense(); unlocked = cachedUnlock();
  setupEvents(); updateConnection();
  try { const saved = await loadState(); if (saved) state = { ...structuredClone(emptyState), ...saved }; }
  catch { announce('Local storage is unavailable. You can read, but refresh will clear this desk.'); }
  renderAll();
  if (!state.leftBook && !state.rightBook) announce('Choose two DRM-free EPUBs to begin.');
  void verifyLicense().then((valid) => { unlocked = valid; renderNotebook(); if (localStorage.getItem('sb_license:parallel-ebook-reader') && !valid) byId('license-status').textContent = 'License no longer active. The free reader remains available.'; });
  void registerServiceWorker();
}

void init();
