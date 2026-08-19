import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { readFileSync } from 'fs'

// package.json's own "version" isn't kept current on this branch —
// scripts/python/release_android.py only bumps android/app/build.gradle's
// versionName, so reading pkg.version here would show a stale desktop-era
// number in things like feedback reports. build.gradle's versionName is the
// one source of truth the release script actually updates.
const gradle = readFileSync(resolve(__dirname, 'android/app/build.gradle'), 'utf-8')
const gradleVersionMatch = gradle.match(/versionName\s+"([^"]+)"/)
if (!gradleVersionMatch) throw new Error('Could not find versionName in android/app/build.gradle')
const appVersion = gradleVersionMatch[1]

export default defineConfig({
  plugins: [react()],
  root: resolve(__dirname, 'src/renderer'),
  envDir: resolve(__dirname, '.'),
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
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
