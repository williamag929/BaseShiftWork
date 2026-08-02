import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import en from './translations/en';
import es from './translations/es';

type TranslationDict = Record<string, unknown>;

const translationMap: Record<string, TranslationDict> = { en, es };
const LOCALE_STORAGE_KEY = 'app_locale';
const SUPPORTED_LOCALES = ['en', 'es'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

interface LocaleContextValue {
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => Promise<void>;
  /**
   * Applies the company's default language (CompanySettings.DefaultLanguage).
   * Ignored once someone has toggled the language on this device; not persisted.
   */
  applyServerLocale: (language: string | null | undefined) => void;
}

/** Normalizes a language tag ("es-MX" → "es"); unknown tags → null. */
export function normalizeLocale(language: string | null | undefined): SupportedLocale | null {
  if (!language) return null;
  const tag = language.split('-')[0].trim().toLowerCase();
  return (SUPPORTED_LOCALES as readonly string[]).includes(tag) ? (tag as SupportedLocale) : null;
}

function getNestedValue(obj: Record<string, unknown>, dotPath: string): string | undefined {
  return dotPath.split('.').reduce<unknown>((acc, key) => {
    if (acc != null && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj) as string | undefined;
}

function interpolate(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text;
  return Object.entries(vars).reduce(
    (str, [k, v]) => str.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v)),
    text
  );
}

function detectDeviceLocale(): SupportedLocale {
  try {
    const tag = Intl.DateTimeFormat().resolvedOptions().locale.split('-')[0];
    return (SUPPORTED_LOCALES as readonly string[]).includes(tag)
      ? (tag as SupportedLocale)
      : 'en';
  } catch {
    return 'en';
  }
}

const LocaleContext = createContext<LocaleContextValue>({
  t: (key) => key,
  locale: 'en',
  setLocale: async () => {},
  applyServerLocale: () => {},
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>('en');
  // True once someone toggled the language on this device (stored choice wins over company default)
  const hasExplicitChoice = useRef(false);

  useEffect(() => {
    (async () => {
      const stored = await SecureStore.getItemAsync(LOCALE_STORAGE_KEY).catch(() => null);
      const storedLocale = normalizeLocale(stored);
      if (storedLocale) hasExplicitChoice.current = true;
      setLocaleState(storedLocale ?? detectDeviceLocale());
    })();
  }, []);

  function t(key: string, vars?: Record<string, string | number>): string {
    const dict = translationMap[locale] ?? en;
    const value =
      getNestedValue(dict, key) ??
      getNestedValue(en as Record<string, unknown>, key) ??
      key;
    return interpolate(value, vars);
  }

  async function setLocale(newLocale: SupportedLocale): Promise<void> {
    hasExplicitChoice.current = true;
    setLocaleState(newLocale);
    await SecureStore.setItemAsync(LOCALE_STORAGE_KEY, newLocale).catch(() => {});
  }

  function applyServerLocale(language: string | null | undefined): void {
    if (hasExplicitChoice.current) return;
    const normalized = normalizeLocale(language);
    if (normalized) setLocaleState(normalized);
  }

  return (
    <LocaleContext.Provider value={{ t, locale, setLocale, applyServerLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export const useTranslation = () => useContext(LocaleContext);
