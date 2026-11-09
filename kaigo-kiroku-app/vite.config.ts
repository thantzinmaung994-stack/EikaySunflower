import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Capacitor の WebView から読み込めるよう、相対パスで出力する
export default defineConfig({
  base: './',
  plugins: [react()],
});
