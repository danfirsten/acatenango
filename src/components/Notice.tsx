import Pill from '@/components/ink/Pill';
import { getDict, type Locale } from '@/i18n';

/**
 * A short, standing note for anyone reading the numbers. Shown on every visit
 * and not dismissable. It states what Fuego is and points to the official
 * sources; it gives no advice either way.
 */
export default function Notice({ locale }: { locale: Locale }) {
  const t = getDict(locale).notice;
  return (
    <aside className="notice" id="notice" aria-label={t.label}>
      <p>
        <strong>{t.lead}</strong> {t.body}
      </p>
      <nav className="notice-links" aria-label={t.linksLabel}>
        <Pill variant="outline" compact external href="https://insivumeh.gob.gt/vulcanologia/">{t.insivumeh}</Pill>
        <Pill variant="outline" compact external href="https://conred.gob.gt/alertas/">{t.conred}</Pill>
      </nav>
    </aside>
  );
}
