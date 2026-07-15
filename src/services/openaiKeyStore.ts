const KEY = 'ai_studio_openai_key';

export function loadOpenaiKey(): string {
  return localStorage.getItem(KEY) || '';
}

export function saveOpenaiKey(value: string): void {
  if (value.trim()) localStorage.setItem(KEY, value.trim());
  else localStorage.removeItem(KEY);
}
