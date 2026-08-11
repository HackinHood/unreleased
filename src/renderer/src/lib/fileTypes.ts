import { useStore } from '../store/useStore'

export const AUDIO_EXTS = new Set(['.mp3', '.flac', '.wav', '.m4a', '.ogg', '.aac', '.opus', '.wma', '.alac', '.caf', '.aiff', '.aif'])
export const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.avif'])
export const VIDEO_EXTS = new Set(['.mp4', '.mov', '.webm', '.m4v', '.mkv', '.avi'])
// Plain-text formats the in-app viewer can render. Deliberately conservative:
// anything not listed here falls through to 'other' and is left to download /
// the system app rather than being decoded as text.
export const TEXT_EXTS = new Set([
  '.txt', '.md', '.markdown', '.log', '.json', '.xml', '.csv', '.tsv',
  '.yml', '.yaml', '.ini', '.cfg', '.conf', '.nfo', '.srt', '.vtt', '.lrc',
  '.html', '.htm', '.css', '.js', '.ts', '.py', '.sh', '.bat', '.sql',
])

export type FileMediaType = 'audio' | 'image' | 'video' | 'text' | 'folder' | 'other'

export function getFileExt(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i).toLowerCase() : ''
}

export function getMediaType(name: string): FileMediaType {
  const ext = getFileExt(name)
  if (AUDIO_EXTS.has(ext)) return 'audio'
  if (IMAGE_EXTS.has(ext)) return 'image'
  if (VIDEO_EXTS.has(ext)) return 'video'
  if (TEXT_EXTS.has(ext)) return 'text'
  return 'other'
}

// Dev mode serves the renderer from http://localhost:3018 (see the
// electron:dev script), and Chromium refuses to load `file://` media from a
// non-file-origin page ("Not allowed to load local resource"). Routing
// through the app's `local-media://` custom protocol (registered in
// electron/main.js) sidesteps that in both dev and the packaged file:// build.
export function toFileUrl(absPath: string): string {
  const url = new URL('local-media://play/')
  url.searchParams.set('p', absPath)
  return url.toString()
}

// Converts a scanned library file into the queue/player Track shape — the
// single conversion every local-file play path goes through. Cover art lives in
// the store's libraryArt map (not on the track), so seed the queue thumbnail
// from there if it's already been read; covers read later stream in via
// applyLibraryArt's queue fan-out.
export function libraryTrackToTrack(t: import('../types').LibraryTrack): import('../types').Track {
  const art = useStore.getState().libraryArt[t.id]
  return {
    id: t.id,
    path: t.filePath,
    streamUrl: toFileUrl(t.filePath),
    imageUrl: art || '',
    title: t.title,
    artist: t.artist,
    album: t.album,
    albumArtist: t.albumArtist,
    year: t.year,
    trackNumber: t.trackNumber,
    duration: t.duration,
    genre: t.genre,
    hasAlbumArt: t.hasAlbumArt,
  }
}
