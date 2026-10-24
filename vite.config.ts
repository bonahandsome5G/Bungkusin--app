import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base './' supaya hasil build bisa dibuka dari folder mana pun (Netlify, Vercel, GitHub Pages)
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
