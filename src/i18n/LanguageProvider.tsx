import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AppLocale, TranslationKey } from './types';
import vi from './locales/vi';
import en from './locales/en';

const STORAGE_KEY = 'appLanguage';

const LOCALES: Record<AppLocale, typeof vi> = { vi, en };

function readStoredLocale(): AppLocale {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'en' || raw === 'vi') return raw;
  } catch {
    /* ignore */
  }
  return 'vi';
}

function interpolate(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    key in params ? String(params[key]) : '',
  );
}

export type TranslateFn = (
  key: TranslationKey,
  params?: Record<string, string | number>,
) => string;

type LanguageContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  toggleLocale: () => void;
  t: TranslateFn;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(() => readStoredLocale());

  const setLocale = useCallback((next: AppLocale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === 'vi' ? 'en' : 'vi');
  }, [locale, setLocale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useCallback<TranslateFn>(
    (key, params) => {
      const map = LOCALES[locale] ?? vi;
      const fallback = vi[key] ?? key;
      return interpolate(map[key] ?? fallback, params);
    },
    [locale],
  );

  const value = useMemo(
    () => ({ locale, setLocale, toggleLocale, t }),
    [locale, setLocale, toggleLocale, t],
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLocale(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLocale must be used within LanguageProvider');
  return ctx;
}
