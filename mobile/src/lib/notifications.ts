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
      }),
    });

    if (!Device.default.isDevice) {
      console.log('[PUSH] Simulatore — notifiche non disponibili');
      return null;
    }

    const { status: existing } = await Notifications.default.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.default.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('[PUSH] Permesso notifiche negato dall\'utente');
      return null;
    }

    // Token Expo Push — funziona in Expo Go e in build produzione
    const tokenData = await Notifications.default.getExpoPushTokenAsync();
    const token = tokenData.data;
    console.log('[PUSH] Token ottenuto');

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
    console.log('[PUSH] Registrazione skippata:', String(err).substring(0, 100));
    return null;
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
