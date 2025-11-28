import { useEffect } from 'react';
import { useAuth } from './useAuth';
import { API_ENDPOINTS, apiPost, apiGet } from '@/lib/api';
import { getFirebaseMessaging } from '@/lib/firebase';
import { getToken } from 'firebase/messaging';

/**
 * Hook: useFirebaseToken
 * 
 * Initializes Firebase Cloud Messaging (FCM) and registers the device token
 * with the backend so the server can send real-time notifications.
 * 
 * Should be called early in the app lifecycle (e.g., in App.tsx or MainLayout).
 * 
 * Requirements:
 * - Firebase SDK must be initialized (via initializeFirebase in main.tsx)
 * - Browser/app must support Web Push API (navigator.serviceWorker, Notification)
 * - Service worker must be registered to handle FCM messages
 * - VAPID public key must be available from FCM settings
 * 
 * Usage:
 *   const { user } = useAuth();
 *   useFirebaseToken();  // Call once per app session
 */
export const useFirebaseToken = () => {
  const { user } = useAuth();

  useEffect(() => {
    console.log('[FCM] useFirebaseToken hook running, user:', user?.id);

    // Fallback: try to read cached user from localStorage (edutrack_user)
    const cached = (() => {
      try {
        const s = localStorage.getItem('edutrack_user');
        return s ? JSON.parse(s) : null;
      } catch {
        return null;
      }
    })();

    const effectiveUser = user || cached;

    // Only run if user is authenticated (either from context or cached)
    if (!effectiveUser || !effectiveUser.id) {
      console.log('[FCM] User not authenticated (context or localStorage), skipping token registration');
      return;
    }

    const registerToken = async () => {
      try {
        console.log('[FCM] Starting token registration for user:', user.id);
        
        // Get the Firebase Messaging instance
        const messaging = getFirebaseMessaging();
        if (!messaging) {
          console.warn('[FCM] Firebase Messaging not initialized');
          return;
        }

        console.log('[FCM] Firebase Messaging instance found');

        // Request permission to send notifications
        console.log('[FCM] Requesting notification permission...');
        const permission = await Notification.requestPermission();
        console.log('[FCM] Notification permission result:', permission);
        
        if (permission !== 'granted') {
          console.log('[FCM] Notification permission not granted; FCM disabled');
          return;
        }

        // Register service worker for FCM (store registration to pass to getToken)
        let serviceWorkerRegistration: ServiceWorkerRegistration | null = null;
        if ('serviceWorker' in navigator) {
          try {
            console.log('[FCM] Registering service worker...');
            serviceWorkerRegistration = await navigator.serviceWorker.register(
              '/firebase-messaging-sw.js',
              { scope: '/' }
            );
            console.log('[FCM] Service worker registered successfully:', serviceWorkerRegistration.scope);
          } catch (err) {
            console.warn('[FCM] Failed to register service worker:', err);
          }
        }

        // Get VAPID public key from environment or Firebase config
        const vapidKey =
          import.meta.env.VITE_FIREBASE_VAPID_KEY ||
          import.meta.env.VITE_REACT_APP_FIREBASE_VAPID_KEY ||
          (window as any).FIREBASE_VAPID_KEY;

        console.log('[FCM] VAPID key present:', !!vapidKey);
        if (!vapidKey) {
          console.warn('[FCM] VAPID key not found in environment variables');
          // Continue anyway - messaging may still work with default key
        }

        // Get the current FCM token using the modular SDK
        console.log('[FCM] Requesting FCM token...');
        const token = await getToken(messaging, {
          vapidKey: vapidKey || undefined,
          serviceWorkerRegistration: serviceWorkerRegistration || undefined,
        });

        if (!token) {
          console.warn('[FCM] Failed to obtain FCM token');
          return;
        }

        console.log('[FCM] FCM Token obtained:', token.substring(0, 20) + '...');

        // Send token to backend with a simple retry-on-401 logic
        const sendTokenToBackend = async () => {
          try {
            console.log('[FCM] Sending token to backend...');
            const response = await apiPost(`${API_ENDPOINTS.USERS}/register-fcm-token`, {
              token,
            });

            console.log('[FCM] Backend response:', response);
            if (response && response.success) {
              console.log('[FCM✓] FCM token registered with backend successfully');
              return true;
            }

            console.warn('[FCM] Failed to register FCM token with backend:', response?.message);
            return false;
          } catch (err: any) {
            console.warn('[FCM] Error registering FCM token with backend:', err?.message || err);

            // If unauthorized, try to validate session once and retry
            if (err && /Unauthorized|401/.test(err.message || '')) {
              try {
                console.log('[FCM] Attempting to refresh session via /api/auth/check and retry');
                const check = await apiGet(API_ENDPOINTS.CHECK);
                if (check && check.authenticated) {
                  console.log('[FCM] Session validated, retrying token registration');
                  const retry = await apiPost(`${API_ENDPOINTS.USERS}/register-fcm-token`, { token });
                  if (retry && retry.success) {
                    console.log('[FCM✓] FCM token registered on retry');
                    return true;
                  }
                }
              } catch (e) {
                console.warn('[FCM] Session refresh attempt failed', e);
              }
            }

            return false;
          }
        };

        await sendTokenToBackend();

        // Note: token refresh events are handled differently in the modular SDK.
        // If needed, we can periodically call getToken or re-run registration on app resume.
      } catch (err) {
        console.error('[FCM] Error in useFirebaseToken:', err);
      }
    };

    registerToken();
  }, [user]);
};

export default useFirebaseToken;
