import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative asset paths so the built site works from any folder or static host.
  base: './',
  plugins: [react()],
  server: { port: 5299 },
  // ~300 hand-drawn character parts and the set kit are one big chunk by nature; the video encoder is split off.
  build: { chunkSizeWarningLimit: 800 },
  test: {
    environment: 'jsdom',
  },
} as never);
