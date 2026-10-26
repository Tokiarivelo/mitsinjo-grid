'use client';

import {
  createContext,
  useContext,
  useState,
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

function getInitialLocale(): Locale {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
      if (stored && (stored === 'en' || stored === 'fr' || stored === 'mg')) {
        return stored;
      }
    } catch {
      // LocalStorage unavailable in SSR or sandboxes
    }
  }
  return DEFAULT_LOCALE;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  const setLocale = (next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
      if (typeof document !== 'undefined') {
        document.documentElement.lang = next;
      }
    } catch {
      // Ignore
    }
  };

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

/**
 * Universal useTranslations wrapper:
 * Uses next-intl useTranslations when within a configured NextIntlClientProvider,
 * with zero-exception fallback to the static dictionary during SSR/SSG prerender passes.
 */
export function useTranslations(namespace?: string) {
  const context = useContext(I18nContext);
  const locale = context?.locale || DEFAULT_LOCALE;
  const messages = MESSAGES_BY_LOCALE[locale] || enMessages;

  try {
    return nextIntlUseTranslations(namespace);
  } catch {
    return (key: string) => {
      const root = namespace
        ? (messages as unknown as Record<string, unknown>)[namespace]
        : messages;

      const parts = key.split('.');
      let current: unknown = root;
      for (const part of parts) {
        if (current && typeof current === 'object' && part in current) {
          current = (current as Record<string, unknown>)[part];
        } else {
          return key;
        }
      }
      return typeof current === 'string' ? current : key;
    };
  }
}

