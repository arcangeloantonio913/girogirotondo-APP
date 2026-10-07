import 'react-native-gesture-handler';
import React, { useEffect, useRef, useState } from 'react';
import { AppState, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Updates from 'expo-updates';
import { AuthProvider } from './src/lib/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';

// Componente interno che usa il context
function AppContent() {
  const appState = useRef(AppState.currentState);
  const lastUpdateCheck = useRef(0);
  const [isOffline, setIsOffline] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);

  // Controlla se c'è un OTA, lo scarica e — se nuovo — MOSTRA L'AVVISO (non ricarica da solo:
  // l'utente tocca il banner quando vuole). Usato sia all'apertura a freddo sia al rientro.
  const prepareOtaNotice = async () => {
    if (__DEV__ || !Updates.isEnabled) return;
    try {
      const res = await Updates.checkForUpdateAsync();
      if (!res.isAvailable) return;
      const fetched = await Updates.fetchUpdateAsync();
      if (fetched.isNew) setUpdateReady(true);
    } catch {}   // rete assente / server OTA irraggiungibile: si riprova dopo
  };

  // Apertura a FREDDO: appena si apre l'app, controlla e prepara l'avviso di aggiornamento.
  useEffect(() => { lastUpdateCheck.current = Date.now(); prepareOtaNotice(); }, []);

  useEffect(() => {
    // OTA (EAS Update): di default l'aggiornamento scaricato si applica solo al riavvio "a freddo".
    // Su iPhone l'app resta sospesa in memoria per giorni → i genitori iOS restavano con il codice
    // vecchio mentre il link web era già aggiornato. Al ritorno in foreground controlliamo se c'è
    // un update e, se sì, lo applichiamo subito (l'utente ha appena riaperto l'app).
    const sub = AppState.addEventListener('change', async nextState => {
      const cameBack = /inactive|background/.test(appState.current) && nextState === 'active';
      appState.current = nextState;
      if (!cameBack || __DEV__ || !Updates.isEnabled) return;
      if (Date.now() - lastUpdateCheck.current < 10 * 60 * 1000) return;   // max 1 check / 10 min
      lastUpdateCheck.current = Date.now();
      await prepareOtaNotice();   // mostra l'AVVISO (banner) invece di ricaricare in silenzio
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    let failures = 0;
    const check = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch('https://girogirotondo-app-production.up.railway.app/api/', {
          method: 'GET', signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.ok || res.status === 401 || res.status === 405) {
          failures = 0;
          setIsOffline(false);
        }
      } catch {
        failures++;
        // Mostra offline solo dopo 2 fallimenti consecutivi (evita falsi positivi)
        if (failures >= 2) setIsOffline(true);
      }
    };
    // Prima verifica dopo 3s (attendi che l'app si avvii)
    const initial = setTimeout(check, 3000);
    const interval = setInterval(check, 30000);
    return () => { clearTimeout(initial); clearInterval(interval); };
  }, []);

  return (
    <>
      {updateReady && (
        <TouchableOpacity style={banner.update} onPress={() => Updates.reloadAsync()} activeOpacity={0.85} testID="ota-update-banner">
          <Text style={banner.updateText}>✨ Aggiornamento disponibile — tocca qui per applicarlo</Text>
        </TouchableOpacity>
      )}
      {isOffline && (
        <View style={banner.wrap}>
          <Text style={banner.text}>📵 Connessione assente — alcune funzioni non disponibili</Text>
        </View>
      )}
      <RootNavigator />
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const banner = StyleSheet.create({
  wrap: { backgroundColor: '#F59E0B', paddingVertical: 6, paddingHorizontal: 16, alignItems: 'center' },
  text: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  update: { backgroundColor: '#16A34A', paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center' },
  updateText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
});
