import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { readFileSync, existsSync } from 'fs'

function commitHash() {
  const envSha =
    process.env.COMMIT_HASH ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.CF_PAGES_COMMIT_SHA ||
    process.env.GITHUB_SHA
  if (envSha) return envSha.slice(0, 7)

  try {
    const dotGit = resolve(__dirname, '.git')
    // A worktree checkout has a `.git` *file* pointing at the real gitdir
    // (e.g. `<main-repo>/.git/worktrees/<name>`), rather than a `.git` dir.
    const dotGitContents = readFileSync(dotGit, 'utf-8')
    const gitDir = dotGitContents.startsWith('gitdir:')
      ? resolve(__dirname, dotGitContents.slice(7).trim())
      : dotGit

    const readRef = (dir: string, ref: string) => {
      const refPath = resolve(dir, ref)
      if (existsSync(refPath)) return readFileSync(refPath, 'utf-8').trim()
      const packed = resolve(dir, 'packed-refs')
      if (!existsSync(packed)) return undefined
      return readFileSync(packed, 'utf-8')
        .split('\n')
        .find((line) => line.endsWith(ref))
        ?.split(' ')[0]
    }

    let head = readFileSync(resolve(gitDir, 'HEAD'), 'utf-8').trim()
    if (head.startsWith('ref:')) {
      const ref = head.slice(4).trim()
      // Refs live in the shared/common gitdir, not the per-worktree one.
      const commondirPath = resolve(gitDir, 'commondir')
      const commonDir = existsSync(commondirPath)
        ? resolve(gitDir, readFileSync(commondirPath, 'utf-8').trim())
        : gitDir
      head = readRef(gitDir, ref) ?? readRef(commonDir, ref) ?? 'unknown'
    }
    return head.slice(0, 7)
  } catch {
    return 'unknown'
  }
}

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
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash()),
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    allowedHosts: ['.juicewrldapi.com', 'player.juicewrldapi.com', 'localhost', '127.0.0.1'],
  },
  preview: {
    port: 5173,
    strictPort: true,
    host: true,
    allowedHosts: ['.juicewrldapi.com', 'player.juicewrldapi.com', 'localhost', '127.0.0.1'],
  },
})
