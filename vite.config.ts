import preact from '@preact/preset-vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Served from a GitHub Pages project site (user.github.io/wanna-bet-web-rtc/), not the domain root.
  base: '/wanna-bet-web-rtc/',
  plugins: [preact()],
})
