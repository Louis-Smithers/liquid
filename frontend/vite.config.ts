import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    // Allow the app to be served through a tunnel host (localtunnel, ngrok, etc.);
    // Vite otherwise rejects unknown Host headers with "host is not allowed".
    allowedHosts: true,
    // Forward /api to the local backend so a single tunnel covers both.
    proxy: {
      '/api': {
        target: 'http://localhost:5088',
        changeOrigin: true,
      },
    },
  },
  // `vite preview` (production build) is what we tunnel — far fewer requests than dev
  // mode, so it survives localtunnel reliably. Mirror the host/proxy setup here.
  preview: {
    port: 4173,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5088',
        changeOrigin: true,
      },
    },
  },
})
