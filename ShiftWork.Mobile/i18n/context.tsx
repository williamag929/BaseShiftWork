import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './translations/en';
import es from './translations/es';

type TranslationDict = Record<string, unknown>;

const translationMap: Record<string, TranslationDict> = { en, es };
const LOCALE_STORAGE_KEY = '@app_locale';
const SUPPORTED_LOCALES = ['en', 'es'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

interface LocaleContextValue {
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => Promise<void>;
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
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>('en');

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(LOCALE_STORAGE_KEY).catch(() => null);
      const resolved =
        stored && (SUPPORTED_LOCALES as readonly string[]).includes(stored)
          ? (stored as SupportedLocale)
          : detectDeviceLocale();
      setLocaleState(resolved);
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
    setLocaleState(newLocale);
    await AsyncStorage.setItem(LOCALE_STORAGE_KEY, newLocale).catch(() => {});
  }

  return (
    <LocaleContext.Provider value={{ t, locale, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export const useTranslation = () => useContext(LocaleContext);
