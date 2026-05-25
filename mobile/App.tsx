import 'react-native-gesture-handler';
import React, { useEffect, useRef, useState } from 'react';
import { AppState, View, Text, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/lib/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';

// Componente interno che usa il context
function AppContent() {
  const appState = useRef(AppState.currentState);
  const [isOffline, setIsOffline] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    // AppState: refresh automatico quando si torna in foreground
    const sub = AppState.addEventListener('change', nextState => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        setRefreshKey(k => k + 1); // trigger refresh nei componenti che lo ascoltano
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    // Controlla connessione periodicamente
    const check = async () => {
      try {
        const res = await fetch('https://girogirotondo-app-production.up.railway.app/api/', { method: 'HEAD' });
        setIsOffline(!res.ok && res.status !== 401);
      } catch {
        setIsOffline(true);
      }
    };
    check();
    const interval = setInterval(check, 30000); // ogni 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <>
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
});
