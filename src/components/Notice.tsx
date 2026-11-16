/**
 * A short, standing note for anyone reading the numbers. Shown on every visit
 * and not dismissable. It states what Fuego is and points to the official
 * sources; it gives no advice either way.
 */
export default function Notice() {
  return (
    <aside className="notice" aria-label="About this record">
      <p>
        <strong>Unofficial archive.</strong> Fuego is not a warning service. It copies
        INSIVUMEH&rsquo;s daily bulletin once or twice a day, so it always lags the observatory.
      </p>
      <nav className="notice-links" aria-label="Official sources">
        <a href="https://insivumeh.gob.gt/vulcanologia/">INSIVUMEH volcano page</a>
        <a href="https://conred.gob.gt/alertas/">CONRED alerts</a>
      </nav>
    </aside>
  );
}
