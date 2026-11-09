import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // En dev, l'API tourne à part (cd backend && npm run dev).
    proxy: { '/api': 'http://localhost:3000' },
  },
});
