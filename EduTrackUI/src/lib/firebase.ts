import { initializeApp } from 'firebase/app';
import { getMessaging, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_REACT_APP_FIREBASE_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_REACT_APP_FIREBASE_AUTH_DOMAIN || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_REACT_APP_FIREBASE_PROJECT_ID || import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_REACT_APP_FIREBASE_STORAGE_BUCKET || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_REACT_APP_FIREBASE_MESSAGING_SENDER_ID || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_REACT_APP_FIREBASE_APP_ID || import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_REACT_APP_FIREBASE_MEASUREMENT_ID || import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

let firebaseApp: any = null;
let messaging: any = null;

/**
 * Initialize Firebase app and messaging
 * Call this once at app startup (in main.tsx)
 */
export const initializeFirebase = () => {
  try {
    console.log('[FCM] Initializing Firebase with config:', {
      projectId: firebaseConfig.projectId,
      messagingSenderId: firebaseConfig.messagingSenderId,
    });
    
    firebaseApp = initializeApp(firebaseConfig);
    console.log('[FCM✓] Firebase initialized successfully');

    // Initialize messaging
    try {
      messaging = getMessaging(firebaseApp);
      console.log('[FCM✓] Firebase Messaging initialized');

      // Set up listener for foreground messages
      onMessage(messaging, (payload) => {
        console.log('[FCM] Foreground message received:', payload);
        // Dispatch custom event so components can listen
        window.dispatchEvent(
          new CustomEvent('fcm-message', {
            detail: {
              title: payload.notification?.title,
              body: payload.notification?.body,
              data: payload.data,
            },
          })
        );
      });
    } catch (err) {
      console.warn('[FCM] Firebase Messaging not available:', err);
    }
  } catch (err) {
    console.error('[FCM✗] Failed to initialize Firebase:', err);
  }
};

/**
 * Get the Firebase app instance
 */
export const getFirebaseApp = () => firebaseApp;

/**
 * Get the Firebase Messaging instance
 */
export const getFirebaseMessaging = () => messaging;

export default { initializeFirebase, getFirebaseApp, getFirebaseMessaging };
