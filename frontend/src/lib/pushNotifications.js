/**
 * Push Notifications — Firebase Cloud Messaging
 * Richiede permesso all'utente e registra il token sul backend.
 */
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { app } from './firebase';
import api from './api';

// VAPID key da Firebase Console → Project Settings → Cloud Messaging → Web Push certificates
const VAPID_KEY = process.env.REACT_APP_FIREBASE_VAPID_KEY || '';

let _messaging = null;

function getMessagingInstance() {
  if (!_messaging) {
    try {
      _messaging = getMessaging(app);
    } catch (err) {
      console.warn('[Push] Firebase Messaging non disponibile:', err.message);
      return null;
    }
  }
  return _messaging;
}

/**
 * Richiede il permesso per le notifiche push e registra il token sul backend.
 * Chiamata dopo il login.
 * @returns {Promise<boolean>} true se il permesso è stato concesso
 */
export async function requestPushPermission() {
  if (!('Notification' in window)) {
    console.warn('[Push] Questo browser non supporta le notifiche');
    return false;
  }

  if (Notification.permission === 'denied') {
    console.warn('[Push] Permesso notifiche negato dall\'utente');
    return false;
  }

  const messaging = getMessagingInstance();
  if (!messaging) return false;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[Push] Permesso non concesso');
      return false;
    }

    if (!VAPID_KEY) {
      console.warn('[Push] VAPID key non configurata (REACT_APP_FIREBASE_VAPID_KEY mancante)');
      return false;
    }

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: await navigator.serviceWorker.ready,
    });

    if (token) {
      // Registra il token sul backend
      await api.post('/notifications/register-token', { token, platform: 'web' });
      console.log('[Push] Token registrato con successo');
      localStorage.setItem('ggt_push_token', token);
      return true;
    }
  } catch (err) {
    // Non bloccare il login se le notifiche falliscono
    console.warn('[Push] Errore durante la registrazione:', err.message);
  }
  return false;
}

/**
 * Ascolta le notifiche in foreground (app aperta).
 * @param {Function} onNotification - callback(title, body, data)
 */
export function listenForegroundMessages(onNotification) {
  const messaging = getMessagingInstance();
  if (!messaging) return () => {};

  return onMessage(messaging, (payload) => {
    console.log('[Push] Messaggio ricevuto in foreground:', payload);
    const { title, body } = payload.notification || {};
    const data = payload.data || {};
    if (onNotification) onNotification(title, body, data);

    // Mostra notifica nativa se l'app è in foreground
    if (Notification.permission === 'granted' && title) {
      new Notification(title, { body, icon: '/icon-192x192.png' });
    }
  });
}
