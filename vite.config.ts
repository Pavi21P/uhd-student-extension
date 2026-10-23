import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    target: 'chrome120',
    rolldownOptions: {
      input: { dashboard: 'dashboard.html', popup: 'popup.html' },
    },
  },
});
