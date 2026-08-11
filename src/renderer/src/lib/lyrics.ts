import { SyncedLyricLine } from '../types'

/**
 * Parse LRC format into timed lines.
 * Handles: [mm:ss.xx] or [mm:ss:xx] timestamps
 */
export function parseLrc(lrc: string): SyncedLyricLine[] {
  const lines: SyncedLyricLine[] = []
  const timeRegex = /\[(\d{1,2}):(\d{2})[.:](\d{2,3})\]/g

  for (const rawLine of lrc.split(/\r?\n/)) {
    const matches = [...rawLine.matchAll(timeRegex)]
    if (matches.length === 0) continue

    const text = rawLine.replace(timeRegex, '').trim()

    for (const match of matches) {
      const min = parseInt(match[1])
      const sec = parseInt(match[2])
      const ms = parseInt(match[3].padEnd(3, '0'))
      lines.push({ time: min * 60 + sec + ms / 1000, text })
    }
  }

  return lines.sort((a, b) => a.time - b.time)
}

/**
 * Check if a string contains LRC timestamps
 */
export function isLrcFormat(text: string): boolean {
  return /\[\d{1,2}:\d{2}[.:]\d{2}/.test(text)
}

/**
 * Find current lyric line index for given time
 */
export function getCurrentLineIndex(lines: SyncedLyricLine[], currentTime: number): number {
  if (lines.length === 0) return -1

  let idx = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= currentTime) {
      idx = i
    } else {
      break
    }
  }
  return idx
}

/** How much smaller ad-libs render than the line around them. Unitless `em`
 *  so it tracks the surface's own font size and the active line's scale. */
export const ADLIB_FONT_SCALE = 0.72

/**
 * Split a lyric line into plain runs and parenthesized ad-lib runs, so the
 * renderers can shrink the ad-libs ("I'm still here (still here)"). The
 * brackets stay in the output — they're part of how ad-libs read.
 *
 * Only balanced `(...)` pairs on a single line count; an unclosed bracket is
 * left as ordinary text rather than swallowing the rest of the lyrics (this
 * also runs over whole multi-line plain-text lyrics, where a stray "(" would
 * otherwise shrink everything down to the next line's ")"). Nesting isn't
 * handled — it doesn't occur in practice, and the failure mode is just a
 * normally-sized fragment.
 */
export function splitAdLibs(text: string): { text: string; adLib: boolean }[] {
  const parts: { text: string; adLib: boolean }[] = []
  let last = 0
  for (const m of text.matchAll(/\([^)\r\n]*\)/g)) {
    const start = m.index ?? 0
    if (start > last) parts.push({ text: text.slice(last, start), adLib: false })
    parts.push({ text: m[0], adLib: true })
    last = start + m[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last), adLib: false })
  return parts.length > 0 ? parts : [{ text, adLib: false }]
}

/**
 * Save a synced (LRC) lyrics string as a local .lrc file — a plain client-side
 * Blob download, not a server fetch, since the lyrics text is already in
 * memory (loaded with the track).
 */
export function downloadSyncedLyrics(title: string, artist: string, lrcContent: string): void {
  // Strip characters that are invalid in filenames on Windows/macOS.
  const safeName = `${title} - ${artist}`.replace(/[/\\?%*:|"<>]/g, '').trim() || 'lyrics'
  const blob = new Blob([lrcContent], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${safeName}.lrc`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
