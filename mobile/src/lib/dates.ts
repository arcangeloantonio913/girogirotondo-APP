/**
 * Utility date in fuso LOCALE.
 *
 * PERCHÉ: `new Date().toISOString().split('T')[0]` restituisce la data in UTC. In Italia
 * (UTC+1/+2), tra mezzanotte e le ~01/02 locali dà il GIORNO PRECEDENTE → presenze/griglia
 * registrate o lette sulla data sbagliata a cavallo della mezzanotte. Queste funzioni
 * compongono la data dai componenti locali, evitando il problema.
 */

/** YYYY-MM-DD nel fuso locale del dispositivo per una data data. */
export function localYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** YYYY-MM-DD di oggi nel fuso locale. */
export function todayLocal(): string {
  return localYMD(new Date());
}

/**
 * Formatta una data in italiano gestendo sia le date pure YYYY-MM-DD sia i timestamp ISO completi.
 *
 * PERCHÉ: aggiungere sempre 'T12:00:00' a un timestamp ISO già completo (es. "2026-09-14T10:00:00Z")
 * produce una stringa non valida → "Invalid Date". Qui il suffisso si aggiunge SOLO alle date pure
 * (per evitare il giorno sbagliato a cavallo della mezzanotte); i timestamp completi si parsano così
 * come sono. Valori vuoti o non parsabili restituiscono '' (mai "Invalid Date").
 */
export function formatItDate(raw?: string | null, opts?: Intl.DateTimeFormatOptions): string {
  if (!raw) return '';
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T12:00:00` : raw;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('it-IT', opts);
}
