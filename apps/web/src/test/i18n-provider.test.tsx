import { act, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';
import { I18nProvider, useAppLocale, useTranslations } from '@/lib/i18n';

function Probe() {
  const t = useTranslations('common');
  const { setLocale } = useAppLocale();
  return (
    <>
      <span>{t('simulatedData')}</span>
      <button type="button" onClick={() => setLocale('fr')}>
        fr
      </button>
    </>
  );
}

describe('I18nProvider', () => {
  afterEach(() => localStorage.clear());

  it('renders the default locale on the server even when a locale is stored', () => {
    localStorage.setItem('mitsinjo_locale', 'mg');
    const html = renderToString(
      <I18nProvider>
        <Probe />
      </I18nProvider>
    );
    expect(html).toContain('SIMULATED DATA');
  });

  it('applies the stored locale on the client', () => {
    localStorage.setItem('mitsinjo_locale', 'fr');
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>
    );
    expect(screen.getByText('DONNÉES SIMULÉES')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('fr');
  });

  it('switches locale, persists it and ignores invalid stored values', () => {
    localStorage.setItem('mitsinjo_locale', 'xx');
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>
    );
    expect(screen.getByText('SIMULATED DATA')).toBeInTheDocument();
    act(() => screen.getByRole('button', { name: 'fr' }).click());
    expect(screen.getByText('DONNÉES SIMULÉES')).toBeInTheDocument();
    expect(localStorage.getItem('mitsinjo_locale')).toBe('fr');
  });
});
