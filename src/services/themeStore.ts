export type ThemeMode = 'dark' | 'light';

const KEY = 'ai_studio_theme';

export function loadTheme(): ThemeMode {
  const v = localStorage.getItem(KEY);
  return v === 'light' ? 'light' : 'dark';
}

export function saveTheme(mode: ThemeMode): void {
  localStorage.setItem(KEY, mode);
  applyTheme(mode);
}

export function applyTheme(mode: ThemeMode): void {
  document.documentElement.dataset.theme = mode;
  document.documentElement.style.colorScheme = mode;
}

export function toggleTheme(): ThemeMode {
  const next = loadTheme() === 'dark' ? 'light' : 'dark';
  saveTheme(next);
  return next;
}

applyTheme(loadTheme());
