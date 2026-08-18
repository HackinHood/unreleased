import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// The production CSP (style-src 'self', see index.html) blocks the inline
// <style> tags Vite's dev server injects for HMR, so every view renders
// unstyled under `npm run dev`. The meta tag is only meaningful in the built
// output that actually ships, so strip it for the dev server only.
function stripDevCsp() {
  return {
    name: 'strip-dev-csp',
    apply: 'serve' as const,
    transformIndexHtml(html: string) {
      return html.replace(/<meta http-equiv="Content-Security-Policy"[\s\S]*?"\s*\/>\s*/, '')
    },
  }
}

export default defineConfig({
  plugins: [react(), stripDevCsp()],
  root: resolve(__dirname, 'src/renderer'),
  envDir: resolve(__dirname, '.'),
  base: './',
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
  server: {
    port: 3018,
    strictPort: true,
    host: true,
    allowedHosts: ['.juicewrldapi.com', 'player.juicewrldapi.com', 'localhost', '127.0.0.1'],
  },
  preview: {
    port: 3018,
    strictPort: true,
    host: true,
    allowedHosts: ['.juicewrldapi.com', 'player.juicewrldapi.com', 'localhost', '127.0.0.1'],
  },
})
