import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

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
 * Usare il valore come dipendenza degli effect di caricamento.
 */
export function useScreenRefresh(): number {
  const [tick, setTick] = useState(0);
  const focused = useRef(false);
  const firstFocus = useRef(true);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      // Il primo focus coincide col mount: il caricamento iniziale lo fa già l'effect.
      if (firstFocus.current) firstFocus.current = false;
      else setTick(t => t + 1);
      return () => { focused.current = false; };
    }, [])
  );

  useEffect(() => {
    let prev = AppState.currentState;
    const sub = AppState.addEventListener('change', next => {
      if (/inactive|background/.test(prev) && next === 'active' && focused.current) {
        setTick(t => t + 1);
      }
      prev = next;
    });
    return () => sub.remove();
  }, []);

  return tick;
}
