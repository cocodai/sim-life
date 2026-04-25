import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// `base` is configured for GitHub Pages at https://<user>.github.io/sim-life/
// Override with `VITE_BASE=/ npm run build` for non-Pages hosts.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/sim-life/',
  plugins: [react()],
})
