export const environment = {
  production: false,
  googleAnalyticsId: 'G-7X3Z5F6Y7Z',
  apiUrl : process.env.API_URL,
  // Kiosk auto-refresh interval for employee status (milliseconds)
  kioskStatusRefreshMs: 45000,
  firebase: {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID
  }
};


