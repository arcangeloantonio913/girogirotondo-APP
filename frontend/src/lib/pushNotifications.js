/**
 * Push Notifications — Firebase Cloud Messaging
 * Import completamente lazy: non crasha mai l'app se FCM non è disponibile.
 * Richiede REACT_APP_FIREBASE_VAPID_KEY su Vercel per funzionare.
 */
import api from './api';

const VAPID_KEY = process.env.REACT_APP_FIREBASE_VAPID_KEY || '';

export async function requestPushPermission() {
  // Requisiti: browser con Notification API + HTTPS + VAPID key configurata
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'denied') return false;
  if (!VAPID_KEY) {
    console.debug('[Push] VAPID key non configurata — notifiche disabilitate');
    return false;
  }

  try {
    // Import dinamico — caricato solo quando serve, non al boot dell'app
    const { getMessaging, getToken } = await import('firebase/messaging');
    const { app } = await import('./firebase');

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    const messaging = getMessaging(app);
    const swReg = await navigator.serviceWorker.ready;
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });

    if (token) {
      await api.post('/notifications/register-token', { token, platform: 'web' });
      localStorage.setItem('ggt_push_token', token);
      console.log('[Push] Token registrato');
      return true;
    }
  } catch (err) {
    // Non propagare — le notifiche sono opzionali
    console.debug('[Push] Registrazione fallita:', err.message);
  }
  return false;
}

export async function listenForegroundMessages(onNotification) {
  if (!VAPID_KEY) return () => {};
  try {
    const { getMessaging, onMessage } = await import('firebase/messaging');
    const { app } = await import('./firebase');
    const messaging = getMessaging(app);
    return onMessage(messaging, (payload) => {
      const { title, body } = payload.notification || {};
      if (onNotification) onNotification(title, body, payload.data || {});
      if (Notification.permission === 'granted' && title) {
        new Notification(title, { body, icon: '/icon-192x192.png' });
      }
    });
  } catch { return () => {}; }
}
