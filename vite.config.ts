
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
// Import 'cwd' directly from 'node:process' to avoid type resolution issues with the global 'process' object in some TypeScript environments.
import { cwd } from 'node:process';

export default defineConfig(({ mode }) => {
  // Use the explicitly imported cwd() function to reliably load environment variables from the current working directory.
  const env = loadEnv(mode, cwd(), '');
  return {
    plugins: [react()],
    define: {
      'process.env.GOOGLE_CLIENT_ID': JSON.stringify(env.GOOGLE_CLIENT_ID),
      'process.env.GOOGLE_PICKER_API_KEY': JSON.stringify(env.GOOGLE_PICKER_API_KEY),
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      'process.env.STRIPE_PUBLIC_KEY': JSON.stringify(env.STRIPE_PUBLIC_KEY),
      'process.env.FIREBASE_API_KEY': JSON.stringify(env.FIREBASE_API_KEY),
      'process.env.FIREBASE_AUTH_DOMAIN': JSON.stringify(env.FIREBASE_AUTH_DOMAIN),
      'process.env.FIREBASE_PROJECT_ID': JSON.stringify(env.FIREBASE_PROJECT_ID),
      'process.env.FIREBASE_STORAGE_BUCKET': JSON.stringify(env.FIREBASE_STORAGE_BUCKET),
      'process.env.FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(env.FIREBASE_MESSAGING_SENDER_ID),
      'process.env.FIREBASE_APP_ID': JSON.stringify(env.FIREBASE_APP_ID),
      'process.env.FIREBASE_CONFIG': JSON.stringify(env.FIREBASE_CONFIG),
      'process.env.WHATSAPP_ACCESS_TOKEN': JSON.stringify(env.WHATSAPP_ACCESS_TOKEN),
      'process.env.WAHA_API_URL': JSON.stringify(env.WAHA_API_URL || 'https://waha-app-fly.fly.dev'),
      'process.env.WAHA_API_KEY': JSON.stringify(env.WAHA_API_KEY || '0eeb0aa6d6a64eedadd7f28fc642ec3f'),
      'process.env.ADMIN_PHONE': JSON.stringify(env.ADMIN_PHONE),
    },
  };
});
