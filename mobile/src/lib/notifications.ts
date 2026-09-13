import { Platform } from 'react-native';
import api from './api';

export async function registerForPushNotifications(): Promise<string | null> {
  try {
    const Notifications = await import('expo-notifications');
    const Device = await import('expo-device');

    // Configura handler notifiche in foreground
    Notifications.default.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    if (!Device.default.isDevice) {
      if (__DEV__) console.log('[PUSH] Simulatore — notifiche non disponibili');
      return null;
    }

    const { status: existing } = await Notifications.default.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.default.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      if (__DEV__) console.log('[PUSH] Permesso notifiche negato dall\'utente');
      return null;
    }

    // Token Expo Push — funziona in Expo Go e in build produzione
    const tokenData = await Notifications.default.getExpoPushTokenAsync();
    const token = tokenData.data;
    if (__DEV__) console.log('[PUSH] Token ottenuto');

    // Registra token nel backend
    await api.post('/push-tokens', { token, device_type: Platform.OS });

    // Canale Android
    if (Platform.OS === 'android') {
      await Notifications.default.setNotificationChannelAsync('default', {
        name: 'Girogirotondo',
        importance: (Notifications as any).AndroidImportance?.MAX ?? 5,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4169E1',
      });
    }

    return token;
  } catch (err) {
    // Non bloccante — l'app funziona anche senza push
    if (__DEV__) console.log('[PUSH] Registrazione skippata:', String(err).substring(0, 100));
    return null;
  }
}

/**
 * Rimuove il push token di questo dispositivo dal backend.
 * Va chiamata al logout PRIMA di invalidare la sessione (la DELETE richiede auth):
 * su un dispositivo condiviso evita che l'ex-utente continui a ricevere le push
 * a lui destinate finché un nuovo login non riassocia il token.
 */
export async function unregisterForPushNotifications(): Promise<void> {
  try {
    const Notifications = await import('expo-notifications');
    const Device = await import('expo-device');
    if (!Device.default.isDevice) return;
    const tokenData = await Notifications.default.getExpoPushTokenAsync();
    const token = tokenData.data;
    if (token) {
      await api.delete(`/push-tokens/${encodeURIComponent(token)}`);
      if (__DEV__) console.log('[PUSH] Token deregistrato');
    }
  } catch (err) {
    // Non bloccante — il logout deve procedere comunque.
    if (__DEV__) console.log('[PUSH] Deregistrazione skippata:', String(err).substring(0, 100));
  }
}

export async function sendLocalNotification(title: string, body: string) {
  try {
    const Notifications = await import('expo-notifications');
    await Notifications.default.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: null,
    });
  } catch {}
}
