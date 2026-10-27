'use client';

import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {
  NextIntlClientProvider,
  useTranslations as nextIntlUseTranslations,
} from 'next-intl';

import enMessages from '@/messages/en.json';
import frMessages from '@/messages/fr.json';
import mgMessages from '@/messages/mg.json';

export type Locale = 'en' | 'fr' | 'mg';

export const DEFAULT_LOCALE: Locale = 'en';
export const DEFAULT_TIMEZONE = 'UTC';

export const SUPPORTED_LOCALES: { code: Locale; label: string; short: string }[] = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'fr', label: 'Français', short: 'FR' },
  { code: 'mg', label: 'Malagasy', short: 'MG' },
];

export type Messages = typeof enMessages;

const MESSAGES_BY_LOCALE: Record<Locale, Messages> = {
  en: enMessages,
  fr: frMessages,
  mg: mgMessages,
};

interface I18nContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  availableLocales: typeof SUPPORTED_LOCALES;
}

const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  availableLocales: SUPPORTED_LOCALES,
});

const STORAGE_KEY = 'mitsinjo_locale';

function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'fr' || value === 'mg';
}

// The chosen locale lives in localStorage. useSyncExternalStore renders the default during SSR
// and hydration (no mismatch), then switches to the stored choice.
const localeListeners = new Set<() => void>();
let sessionLocale: Locale | null = null; // fallback when storage is blocked

function readStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    // storage blocked (private mode, sandbox)
  }
  return sessionLocale ?? DEFAULT_LOCALE;
}

function subscribeLocale(listener: () => void) {
  localeListeners.add(listener);
  return () => localeListeners.delete(listener);
}

function writeLocale(next: Locale) {
  sessionLocale = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // storage blocked: the choice lasts for this session only
  }
  localeListeners.forEach((listener) => listener());
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(subscribeLocale, readStoredLocale, () => DEFAULT_LOCALE);
  const setLocale = writeLocale;

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const activeMessages = MESSAGES_BY_LOCALE[locale] || enMessages;

  return (
    <I18nContext.Provider
      value={{
        locale,
        setLocale,
        availableLocales: SUPPORTED_LOCALES,
      }}
    >
      <NextIntlClientProvider
        locale={locale}
        messages={activeMessages}
        timeZone={DEFAULT_TIMEZONE}
        key={locale}
      >
        {children}
      </NextIntlClientProvider>
    </I18nContext.Provider>
  );
}

export function useAppLocale() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useAppLocale must be used within an I18nProvider');
  }
  return context;
}

function getNestedValue(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined;
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

export type TranslationValues = Record<string, string | number | Date>;

/**
 * Universal useTranslations wrapper:
 * Uses next-intl useTranslations when within a configured NextIntlClientProvider,
 * with zero-exception fallback to the static dictionary during SSR/SSG prerender passes
 * and isolated component tests.
 */
export function useTranslations(namespace?: string) {
  const context = useContext(I18nContext);
  const locale = context?.locale || DEFAULT_LOCALE;
  const messages = MESSAGES_BY_LOCALE[locale] || enMessages;

  const fallbackTranslate = (key: string, values?: TranslationValues) => {
    const root = namespace ? getNestedValue(messages, namespace) : messages;
    const value = getNestedValue(root, key);
    if (typeof value === 'string') {
      if (values) {
        return Object.entries(values).reduce(
          (acc, [k, v]) => acc.replace(new RegExp(`{${k}}`, 'g'), String(v)),
          value
        );
      }
      return value;
    }
    return key;
  };

  try {
    const nextIntlTranslate = nextIntlUseTranslations(namespace);
    return (key: string, values?: TranslationValues) => {
      try {
        return nextIntlTranslate(key, values);
      } catch {
        return fallbackTranslate(key, values);
      }
    };
  } catch {
    return fallbackTranslate;
  }
}

