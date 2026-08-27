const SLUG = 'parallel-ebook-reader';
const KEY = `sb_license:${SLUG}`;
const VERDICT_KEY = `${KEY}:verdict`;
const API = 'https://api.sociobot.in/api/v1';

type Verdict = { valid: boolean; checkedAt: number };

export function captureReturnedLicense(): void {
  const url = new URL(location.href);
  const token = url.searchParams.get('license');
  if (!token) return;
  localStorage.setItem(KEY, token);
  url.searchParams.delete('license');
  history.replaceState({}, '', url.pathname + url.search + url.hash);
}

export function cachedUnlock(): boolean {
  const token = localStorage.getItem(KEY);
  if (!token) return false;
  try { return JSON.parse(localStorage.getItem(VERDICT_KEY) ?? '{}').valid === true; }
  catch { return false; }
}

export async function verifyLicense(force = false): Promise<boolean> {
  const token = localStorage.getItem(KEY);
  if (!token) return false;
  try {
    const old = JSON.parse(localStorage.getItem(VERDICT_KEY) ?? '{}') as Verdict;
    if (!force && Date.now() - (old.checkedAt || 0) < 86_400_000) return old.valid;
    const response = await fetch(`${API}/products/${SLUG}/verify?license=${encodeURIComponent(token)}`);
    if (!response.ok) throw new Error('verify unavailable');
    const result = await response.json() as { valid: boolean };
    localStorage.setItem(VERDICT_KEY, JSON.stringify({ valid: result.valid, checkedAt: Date.now() }));
    return result.valid;
  } catch { return cachedUnlock(); }
}

export function restoreLicense(token: string): void {
  localStorage.setItem(KEY, token.trim());
  localStorage.removeItem(VERDICT_KEY);
}

export const checkoutUrl = `${API}/products/${SLUG}/checkout`;
