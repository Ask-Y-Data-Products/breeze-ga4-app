import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Asky deploy URL: https://appstage.ask-y.ai/blusterplugin/
// In prod build, assets need to be referenced under /blusterplugin/.
// In dev, serve from root for convenience.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/blusterplugin/' : '/',
  plugins: [react()],
  server: { port: 5173 },
}));
