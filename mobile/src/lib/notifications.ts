// Notifiche push — richiede EAS Build per funzionare pienamente.
// In Expo Go viene ignorato silenziosamente.

export async function registerForPushNotifications(): Promise<string | null> {
  try {
    const Notifications = await import('expo-notifications');
    const Device = await import('expo-device');
    const { Platform } = await import('react-native');

    if (!Device.default.isDevice) return null;

    const { status: existing } = await Notifications.default.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.default.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    const tokenData = await Notifications.default.getExpoPushTokenAsync({ projectId: 'girogirotondo-app' });
    return tokenData.data;
  } catch {
    // expo-notifications non disponibile in questa build
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
