import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // <- Permite que otros dispositivos accedan (LAN)
    proxy: {
      '/api': 'http://localhost:5000',
      '/uploads': 'http://localhost:5000' // <- Para imágenes estáticas
    }
  }
})
