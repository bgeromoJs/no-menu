
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
// Fix: Import process explicitly from node:process to ensure TypeScript recognizes the cwd() method
import process from 'node:process';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      'process.env.FIREBASE_CONFIG': JSON.stringify(env.FIREBASE_CONFIG),
      'process.env.ADMIN_PHONE': JSON.stringify(env.ADMIN_PHONE),
      'process.env.GOOGLE_CLIENT_ID': JSON.stringify(env.GOOGLE_CLIENT_ID),
    },
  };
});
