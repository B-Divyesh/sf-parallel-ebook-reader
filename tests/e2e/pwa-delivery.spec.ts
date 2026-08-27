import { expect, test } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, extname, normalize } from 'node:path';
import type { AddressInfo } from 'node:net';

const projectRoot = resolve(import.meta.dirname, '../..');
const contentTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.webp': 'image/webp'
};

let temporaryRoot = '';
let buildRoot = '';
let activeBuild = '';
let server: Server;
let origin = '';

async function serveBuild(requestPath: string): Promise<{ body: Buffer; type: string }> {
  const pathname = decodeURIComponent(new URL(requestPath, 'http://parallel-reader.test').pathname);
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  let file = normalize(join(activeBuild, relative));
  if (!file.startsWith(`${activeBuild}/`) && file !== activeBuild) throw new Error('Invalid test path');
  try { return { body: await readFile(file), type: contentTypes[extname(file)] ?? 'application/octet-stream' }; }
  catch {
    file = join(activeBuild, relative, 'index.html');
    return { body: await readFile(file), type: contentTypes['.html']! };
  }
}

test.describe.serial('PWA install and static delivery', () => {
  test.beforeAll(async () => {
    temporaryRoot = await mkdtemp(join(tmpdir(), 'parallel-reader-pwa-'));
    const buildA = join(temporaryRoot, 'build-a');
    const buildB = join(temporaryRoot, 'build-b');
    await cp(join(projectRoot, 'dist'), buildA, { recursive: true });
    await cp(join(projectRoot, 'dist'), buildB, { recursive: true });
    const worker = await readFile(join(buildB, 'sw.js'), 'utf8');
    await writeFile(join(buildB, 'sw.js'), `// build B update fixture\n${worker}`);
    buildRoot = buildA;
    activeBuild = buildA;
    server = createServer(async (request, response) => {
      try {
        const result = await serveBuild(request.url ?? '/');
        response.writeHead(200, { 'Cache-Control': 'no-store', 'Content-Type': result.type });
        response.end(result.body);
      } catch { response.writeHead(404).end(); }
    });
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  test.afterAll(async () => {
    await new Promise<void>((done, reject) => server.close((error) => error ? reject(error) : done()));
    await rm(temporaryRoot, { recursive: true, force: true });
  });

  test('a clean profile never announces an update after its first install', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(origin);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForTimeout(250);
    await expect(page.locator('#update-toast')).toBeHidden();
    await expect.poll(() => page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.waiting))).toBe(false);
    await context.close();
  });

  test('a build B worker waits, announces itself, and Update now activates it', async ({ browser }) => {
    activeBuild = buildRoot;
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(origin);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await expect(page.locator('#update-toast')).toBeHidden();

    activeBuild = join(temporaryRoot, 'build-b');
    await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())?.update(); });
    await expect.poll(() => page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.waiting))).toBe(true);
    await expect(page.locator('#update-toast')).toBeVisible();

    const reloaded = page.waitForEvent('load');
    await page.getByRole('button', { name: 'Update now' }).click();
    await reloaded;
    await expect.poll(() => page.evaluate(async () => Boolean((await navigator.serviceWorker.getRegistration())?.waiting))).toBe(false);
    await expect(page.locator('#update-toast')).toBeHidden();
    await context.close();
  });

  test('build output contains immutable assets and static security policy', async () => {
    const config = JSON.parse(await readFile(join(projectRoot, 'dist', 'staticwebapp.config.json'), 'utf8')) as {
      globalHeaders: Record<string, string>; routes: Array<{ route: string; headers: Record<string, string> }>; mimeTypes: Record<string, string>;
    };
    expect(config.routes.find((route) => route.route === '/assets/*')?.headers['Cache-Control']).toBe('public, max-age=31536000, immutable');
    expect(config.mimeTypes['.webmanifest']).toBe('application/manifest+json');
    expect(config.globalHeaders['Content-Security-Policy']).toContain("frame-ancestors 'none'");
    expect(config.globalHeaders['Permissions-Policy']).toContain('camera=()');
    expect(config.globalHeaders['X-Frame-Options']).toBe('DENY');
  });
});
