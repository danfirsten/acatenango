'use client';

import { getDict, LOCALE_PATH, type Locale } from '@/i18n';
import { withBase } from '@/lib/base-path';
import { rememberLanguage, savePlace } from '@/lib/place';

/**
 * A link to the same page in the other language. On the way it remembers the
 * choice and saves the reader's place (the section and the replayed day), which
 * FuegoView restores on arrival. Without scripts it is a plain link.
 */
export default function LanguageSwitch({ locale }: { locale: Locale }) {
  const other: Locale = locale === 'en' ? 'es' : 'en';
  const target = getDict(other);

  function onClick() {
    rememberLanguage(other);
    savePlace();
  }

  return (
    <a className="lang-switch" href={withBase(LOCALE_PATH[other])} hrefLang={target.htmlLang} lang={target.htmlLang}
      aria-label={target.switchLabel} onClick={onClick}>
      {target.languageName}
    </a>
  );
}
