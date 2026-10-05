import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { todayLocal } from './dates';

/**
 * Contatore che si incrementa quando la schermata torna visibile:
 *  - ri-focus della schermata (cambio tab / ritorno da uno stack screen)
 *  - app che torna in foreground mentre la schermata è a fuoco
 *
 * PERCHÉ: i tab di React Navigation restano MONTATI e su iOS l'app resta sospesa in memoria
 * per giorni. Senza questo, i dati caricati al primo mount (es. menu mensa letto PRIMA che la
 * maestra lo pubblicasse, o la data di "ieri") non si aggiornano mai finché l'app non viene
 * chiusa dal multitasking. Sul web invece ogni navigazione rimonta la pagina → lì si vedeva.
 *
 * Throttle (minIntervalMs): passare avanti e indietro tra i tab non rilancia le richieste ogni volta.
 * Usare il valore come dipendenza degli effect di caricamento.
 */
export function useScreenRefresh(minIntervalMs = 30_000): number {
  const [tick, setTick] = useState(0);
  const focused = useRef(false);
  const firstFocus = useRef(true);
  const lastBump = useRef(Date.now());

  const bump = useCallback(() => {
    if (Date.now() - lastBump.current < minIntervalMs) return;
    lastBump.current = Date.now();
    setTick(t => t + 1);
  }, [minIntervalMs]);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      // Il primo focus coincide col mount: il caricamento iniziale lo fa già l'effect.
      if (firstFocus.current) firstFocus.current = false;
      else bump();
      return () => { focused.current = false; };
    }, [bump])
  );

  useEffect(() => {
    let prev = AppState.currentState;
    const sub = AppState.addEventListener('change', next => {
      if (/inactive|background/.test(prev) && next === 'active' && focused.current) bump();
      prev = next;
    });
    return () => sub.remove();
  }, [bump]);

  return tick;
}

/**
 * Restituisce una funzione da chiamare DENTRO l'effect di caricamento: true se l'effect è
 * ripartito per un refresh automatico (tick cambiato) → caricare in silenzio, senza spinner
 * a tutto schermo che fa "lampeggiare" la schermata ad ogni ritorno sul tab.
 */
export function useIsAutoRefresh(tick: number): () => boolean {
  const last = useRef(tick);
  return () => {
    const changed = last.current !== tick;
    last.current = tick;
    return changed;
  };
}

/**
 * Stato data (YYYY-MM-DD) che "segue oggi": se l'utente sta guardando oggi e l'app resta
 * aperta oltre la mezzanotte, al refresh successivo la data passa al nuovo giorno.
 * Se l'utente ha scelto un altro giorno, la sua scelta viene rispettata.
 */
export function useFollowToday(tick: number): [string, (d: string) => void] {
  const [date, setDateState] = useState(todayLocal());
  const following = useRef(true);

  useEffect(() => {
    if (!following.current) return;
    const t = todayLocal();
    setDateState(prev => (prev === t ? prev : t));
  }, [tick]);

  const setDate = useCallback((d: string) => {
    following.current = d === todayLocal();
    setDateState(d);
  }, []);

  return [date, setDate];
}
