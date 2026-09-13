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
