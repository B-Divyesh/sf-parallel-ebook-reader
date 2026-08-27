import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { strToU8, zipSync } from 'fflate';

function epub(title: string, language: string, paragraphs: string[]): Buffer {
  const body = paragraphs.map((text) => `<p>${text}</p>`).join('');
  return Buffer.from(zipSync({
    'META-INF/container.xml': strToU8('<?xml version="1.0"?><container><rootfiles><rootfile full-path="OPS/package.opf"/></rootfiles></container>'),
    'OPS/package.opf': strToU8(`<?xml version="1.0"?><package xmlns:dc="http://purl.org/dc/elements/1.1/"><metadata><dc:title>${title}</dc:title><dc:creator>Test Author</dc:creator><dc:language>${language}</dc:language></metadata><manifest><item id="c1" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/></spine></package>`),
    'OPS/chapter.xhtml': strToU8(`<html><head><title>Opening</title></head><body><h1>Opening</h1>${body}</body></html>`)
  }));
}

test('imports editions, anchors and exports a sentence pair', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await expect(page).toHaveTitle(/Parallel Reader/);
  await page.getByRole('button', { name: 'Open your editions' }).click();
  await page.locator('#left-file').setInputFiles({ name: 'alpha.epub', mimeType: 'application/epub+zip', buffer: epub('The First Edition', 'en', ['A quiet beginning.', 'The train arrived at noon.']) });
  await page.locator('#right-file').setInputFiles({ name: 'beta.epub', mimeType: 'application/epub+zip', buffer: epub('La Première Édition', 'fr', ['Un début tranquille.', 'Le train arriva à midi.']) });
  await expect(page.locator('#left-book-title')).toHaveText('The First Edition');
  await expect(page.locator('#right-book-title')).toHaveText('La Première Édition');
  await page.locator('#left-pages .paragraph').nth(1).click();
  await page.locator('#right-pages .paragraph').nth(1).click();
  await page.getByRole('button', { name: 'Add anchor' }).click();
  await page.getByRole('button', { name: 'Save sentence pair' }).click();
  await expect(page.locator('#clip-count')).toHaveText('1');
  await page.getByRole('button', { name: /Notebook/ }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export TSV' }).click();
  expect((await download).suggestedFilename()).toMatch(/parallel-reader-.*\.tsv/);
  await page.keyboard.press('Escape');
  await page.reload();
  await expect(page.locator('#left-book-title')).toHaveText('The First Edition');
  expect(errors).toEqual([]);
});

test('has no serious accessibility violations and adapts at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('main')).toHaveCount(1);
  await page.locator('#tab-right').click();
  await expect(page.locator('#left-panel')).toBeHidden();
  await expect(page.locator('#right-panel')).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations.filter((issue) => ['serious', 'critical'].includes(issue.impact ?? ''))).toEqual([]);
});

test('reloads the application shell offline', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Your two editions');
});
