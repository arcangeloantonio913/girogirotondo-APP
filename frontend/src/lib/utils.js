import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Data di OGGI in fuso LOCALE (YYYY-MM-DD). `new Date().toISOString()` usa UTC: tra
// mezzanotte e le 01/02 ora italiana restituiva il giorno PRECEDENTE → la griglia/diario
// "di oggi" interrogavano la data sbagliata.
export function todayLocal() {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().split('T')[0];
}
