const CACHE_KEY = 'adminVmediaCreditsCache';

export function getCachedAdminVmediaCredits(): number | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function setCachedAdminVmediaCredits(value: number | null): void {
  try {
    if (value == null) sessionStorage.removeItem(CACHE_KEY);
    else sessionStorage.setItem(CACHE_KEY, String(value));
  } catch {
    /* ignore */
  }
}

export function clearAdminVmediaCreditsCache(): void {
  setCachedAdminVmediaCredits(null);
}
