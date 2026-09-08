import { useEffect, useState, useRef, useCallback } from 'react'
import {
  Plus, Save, Check, X,
  Search, Loader2, ChevronLeft, Pencil, Music, Image as ImageIcon,
} from 'lucide-react'
import { apiFetch, buildImageUrl } from '../lib/juicewrldApi'
import { saveFile } from '../lib/fileSave'
import { registerBackHandler } from '../lib/backHandlers'

// Editor/admin tool for wrlddata.json — the album/version/song catalog the
// app ships as a bundled static asset. Ported from desktop's AlbumsAdminView;
// the only real platform difference is how the edited file gets out of the
// app. Desktop has an Electron main process that can write straight back to
// the file on disk (or, web-built and run outside Electron, falls back to a
// plain download); a Capacitor WebView has neither a main process nor a
// working `<a download>` (see lib/fileSave's header comment), so this always
// takes the "download the edited JSON, the editor re-commits it" path already
// used by that desktop web fallback, just routed through saveFile() so it
// actually reaches the Downloads folder instead of silently no-opping.

// ── Types ─────────────────────────────────────────────────────────────────────

interface WrldSong    { name: string; id: number }
interface WrldVersion { name: string; year: number; cover_url: string; songs: WrldSong[] }
interface WrldAlbum   { id: number; name: string; versions: WrldVersion[] }
interface WrldData    { albums: WrldAlbum[] }

// ── Load / save ──────────────────────────────────────────────────────────────

async function loadData(): Promise<WrldData> {
  // Served by Capacitor's local webserver from the bundled assets, same as
  // any other static file the SPA ships with.
  const r = await fetch('/wrlddata.json')
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}

async function saveData(data: WrldData): Promise<void> {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  await saveFile('wrlddata.json', blob)
}

// ── Inline editable text ──────────────────────────────────────────────────────

function InlineEdit({
  value, onSave, placeholder = 'Edit…', className = '', inputClassName = '',
}: {
  value: string
  onSave: (v: string) => void
  placeholder?: string
  className?: string
  inputClassName?: string
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])

  const commit = () => { onSave(val.trim() || value); setEditing(false) }
  const cancel = () => { setVal(value); setEditing(false) }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel() }}
        onBlur={commit}
        placeholder={placeholder}
        className={`bg-[var(--surface-overlay)] border border-[var(--accent)]/40 rounded-lg px-2 py-1 focus:outline-none focus:border-[var(--accent)] text-[var(--text-primary)] transition-colors ${inputClassName}`}
      />
    )
  }
  return (
    <span
      onClick={() => { setVal(value); setEditing(true) }}
      className={`cursor-text inline-flex items-center gap-1.5 active:text-[var(--accent)] transition-colors ${className}`}
    >
      {value || <span className="text-[var(--text-muted)] italic">{placeholder}</span>}
      <Pencil size={11} className="opacity-40 shrink-0" />
    </span>
  )
}

// ── Song search autocomplete ───────────────────────────────────────────────────

function SongSearch({ onPick, onClose }: { onPick: (s: WrldSong) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    timer.current = setTimeout(async () => {
      try {
        const d = await apiFetch<{ results: any[] }>('/songs/', { search: q, page_size: 8 })
        setResults(d.results ?? [])
      } catch { setResults([]) }
      setLoading(false)
    }, 320)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [q])

  return (
    <div className="flex flex-col gap-2 animate-fade-in">
      <div className="flex items-center gap-2 bg-[var(--surface-overlay)] border border-[var(--border)] rounded-xl px-3 py-2.5">
        <Search size={13} className="text-[var(--text-muted)] shrink-0" />
        <input
          ref={inputRef}
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') onClose() }}
          placeholder="Search songs by name…"
          className="flex-1 bg-transparent text-sm text-[var(--text-primary)] focus:outline-none placeholder:text-[var(--text-muted)]"
        />
        {loading
          ? <Loader2 size={13} className="animate-spin text-[var(--text-muted)] shrink-0" />
          : <button onClick={onClose} className="text-[var(--text-muted)] active:text-[var(--text-primary)] transition-colors p-1"><X size={14} /></button>
        }
      </div>

      {results.length > 0 && (
        <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--surface-raised)] shadow-lg">
          {results.map((s, i) => (
            <button
              key={s.id}
              onClick={() => { onPick({ name: s.name, id: s.id }); onClose() }}
              className={`w-full text-left px-4 py-3 active:bg-[var(--surface-overlay)] transition-colors flex items-center gap-3 ${i > 0 ? 'border-t border-[var(--border)]' : ''}`}
            >
              <div className="w-8 h-8 rounded-md bg-[var(--surface-overlay)] flex items-center justify-center shrink-0 overflow-hidden">
                {buildImageUrl(s.image_url)
                  ? <img src={buildImageUrl(s.image_url)} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  : <Music size={13} className="text-[var(--text-muted)]" />
                }
              </div>
              <div className="min-w-0">
                <p className="text-sm text-[var(--text-primary)] truncate font-medium">
                  {s.name}
                </p>
                <p className="text-xs text-[var(--text-muted)] truncate">
                  {s.credited_artists} · ID {s.id}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Album grid card ───────────────────────────────────────────────────────────
// Desktop reveals the delete button on hover; a phone has no hover, so it's
// always visible here instead — the row's already the size a thumb needs.

function AlbumCard({ album, onClick, onDelete }: {
  album: WrldAlbum
  onClick: () => void
  onDelete: () => void
}) {
  const primary = album.versions[0]
  const [imgError, setImgError] = useState(false)

  return (
    <div className="flex flex-col gap-2 animate-fade-in">
      <button
        onClick={onClick}
        className="relative w-full aspect-square rounded-2xl overflow-hidden bg-[var(--surface-overlay)] shadow-sm active:scale-[0.98] transition-transform ring-1 ring-black/5 dark:ring-white/5"
      >
        {primary?.cover_url && !imgError ? (
          <img
            src={primary.cover_url}
            alt={album.name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music size={32} className="text-[var(--text-muted)] opacity-30" />
          </div>
        )}

        {/* Delete button */}
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm text-white/80 active:bg-red-500/80 flex items-center justify-center transition-colors"
        >
          <X size={13} />
        </button>

        {/* Version count badge */}
        {album.versions.length > 1 && (
          <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-white/80 text-[9px] font-semibold">
            {album.versions.length} versions
          </div>
        )}
      </button>

      <div className="px-0.5">
        <p className="text-sm font-semibold text-[var(--text-primary)] leading-snug line-clamp-2">
          {album.name}
        </p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5 tabular-nums">
          {primary?.year ?? '—'}
        </p>
      </div>
    </div>
  )
}

// ── Album detail view ─────────────────────────────────────────────────────────

function AlbumDetail({
  album, onBack, onChange,
}: {
  album: WrldAlbum
  onBack: () => void
  onChange: (a: WrldAlbum) => void
}) {
  const [vIdx, setVIdx] = useState(0)
  const [addingSong, setAddingSong] = useState(false)
  const [imgError, setImgError] = useState(false)

  const version = album.versions[vIdx] ?? album.versions[0]

  const updateVersion = useCallback((updated: WrldVersion) => {
    const versions = [...album.versions]
    versions[vIdx] = updated
    onChange({ ...album, versions })
  }, [album, vIdx, onChange])

  const addVersion = () => {
    const v: WrldVersion = {
      name: 'New Edition',
      year: new Date().getFullYear(),
      cover_url: '',
      songs: [],
    }
    const versions = [...album.versions, v]
    onChange({ ...album, versions })
    setVIdx(versions.length - 1)
  }

  const deleteVersion = (i: number) => {
    if (album.versions.length === 1) return
    const versions = album.versions.filter((_, j) => j !== i)
    onChange({ ...album, versions })
    setVIdx(Math.min(vIdx, versions.length - 1))
  }

  useEffect(() => { setImgError(false) }, [version?.cover_url])

  if (!version) return null

  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-fade-in">

      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-[var(--text-muted)] active:text-[var(--text-primary)] transition-colors -ml-1 p-1"
        >
          <ChevronLeft size={18} />
          Albums
        </button>
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto">

        {/* Hero section */}
        <div className="relative overflow-hidden">
          {/* Blurred background */}
          {version.cover_url && !imgError && (
            <div className="absolute inset-0">
              <img
                src={version.cover_url}
                alt=""
                className="w-full h-full object-cover"
                style={{ filter: 'blur(60px) brightness(0.35) saturate(1.8)', transform: 'scale(1.3)' }}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-[var(--surface)]" />
            </div>
          )}

          <div className="relative z-10 flex flex-col gap-5 px-4 pt-6 pb-6">
            {/* Cover art */}
            <div className="shrink-0 w-40 aspect-square rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 self-center">
              {version.cover_url && !imgError ? (
                <img
                  src={version.cover_url}
                  alt={album.name}
                  className="w-full h-full object-cover"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="w-full h-full bg-[var(--surface-overlay)] flex items-center justify-center">
                  <Music size={40} className="text-[var(--text-muted)] opacity-30" />
                </div>
              )}
            </div>

            {/* Album info */}
            <div className="flex flex-col gap-3 min-w-0">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-1.5">
                  Album
                </p>
                <h1 className="text-2xl font-bold text-[var(--text-primary)] leading-tight">
                  <InlineEdit
                    value={album.name}
                    onSave={n => onChange({ ...album, name: n })}
                    className="text-2xl font-bold text-[var(--text-primary)]"
                    inputClassName="text-xl font-bold w-full"
                  />
                </h1>
                <div className="flex items-center gap-2 mt-2 text-sm text-[var(--text-secondary)]">
                  <span>Juice WRLD</span>
                  <span className="text-[var(--text-muted)]">·</span>
                  <InlineEdit
                    value={String(version.year)}
                    onSave={v => updateVersion({ ...version, year: Number(v) || version.year })}
                    className="text-sm text-[var(--text-secondary)] tabular-nums"
                    inputClassName="text-sm w-16"
                  />
                  <span className="text-[var(--text-muted)]">·</span>
                  <span className="text-[var(--text-muted)]">{version.songs.length} songs</span>
                </div>
              </div>

              {/* Version tabs */}
              <div className="flex items-center gap-2 flex-wrap mt-1">
                {album.versions.map((v, i) => (
                  <button
                    key={i}
                    onClick={() => setVIdx(i)}
                    className={`flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 ${
                      vIdx === i
                        ? 'bg-[var(--accent)] text-white shadow-sm'
                        : 'bg-[var(--surface-overlay)] text-[var(--text-secondary)]'
                    }`}
                  >
                    <InlineEdit
                      value={v.name}
                      onSave={n => {
                        const versions = [...album.versions]
                        versions[i] = { ...versions[i], name: n }
                        onChange({ ...album, versions })
                      }}
                      className={`text-xs font-semibold ${vIdx === i ? 'text-white' : 'text-[var(--text-secondary)]'}`}
                      inputClassName="text-xs w-24"
                    />
                    {album.versions.length > 1 && (
                      <span
                        role="button"
                        onClick={e => { e.stopPropagation(); deleteVersion(i) }}
                        className={`flex items-center justify-center w-4 h-4 rounded-full opacity-70 transition-all ${vIdx === i ? 'active:bg-white/20' : 'active:bg-red-500/20 active:text-red-400'}`}
                      >
                        <X size={9} />
                      </span>
                    )}
                  </button>
                ))}
                <button
                  onClick={addVersion}
                  className="px-3 py-1.5 rounded-full text-xs font-medium border border-dashed border-[var(--border)] text-[var(--text-muted)] active:border-[var(--accent)] active:text-[var(--accent)] transition-colors"
                >
                  + Edition
                </button>
              </div>

              {/* Cover URL (collapsed) */}
              <details className="group/details mt-1">
                <summary className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] active:text-[var(--text-secondary)] cursor-pointer select-none list-none transition-colors">
                  <ImageIcon size={11} />
                  Cover URL
                </summary>
                <div className="mt-2 flex items-center gap-2">
                  <InlineEdit
                    value={version.cover_url || ''}
                    onSave={v => updateVersion({ ...version, cover_url: v })}
                    placeholder="Paste cover URL…"
                    className="text-xs text-[var(--text-muted)] font-mono break-all"
                    inputClassName="text-xs font-mono w-full"
                  />
                </div>
              </details>
            </div>
          </div>
        </div>

        {/* ── Track list ── */}
        <div className="px-4 pb-10">

          {/* Column header */}
          <div className="flex items-center gap-3 px-3 pb-2 mb-1 border-b border-[var(--border)]">
            <span className="w-6 text-right text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">#</span>
            <span className="flex-1 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Title</span>
            <span className="w-10 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">ID</span>
            <span className="w-7" />
          </div>

          {/* Tracks */}
          <div className="flex flex-col">
            {version.songs.map((song, i) => (
              <TrackRow
                key={`${song.id}-${i}`}
                song={song}
                index={i}
                onChangeName={n => {
                  const songs = [...version.songs]
                  songs[i] = { ...song, name: n }
                  updateVersion({ ...version, songs })
                }}
                onDelete={() => {
                  const songs = version.songs.filter((_, j) => j !== i)
                  updateVersion({ ...version, songs })
                }}
              />
            ))}
          </div>

          {/* Add song */}
          {addingSong ? (
            <div className="mt-3 px-3">
              <SongSearch
                onPick={s => {
                  updateVersion({ ...version, songs: [...version.songs, s] })
                  setAddingSong(false)
                }}
                onClose={() => setAddingSong(false)}
              />
            </div>
          ) : (
            <button
              onClick={() => setAddingSong(true)}
              className="mt-3 ml-3 flex items-center gap-2 text-sm text-[var(--text-muted)] active:text-[var(--accent)] transition-colors py-1.5"
            >
              <Plus size={14} />
              Add song
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Track row ──────────────────────────────────────────────────────────────────

function TrackRow({ song, index, onChangeName, onDelete }: {
  song: WrldSong
  index: number
  onChangeName: (n: string) => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl active:bg-[var(--surface-overlay)] transition-colors">
      <span className="w-6 text-right text-sm text-[var(--text-muted)] tabular-nums shrink-0">
        {index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <InlineEdit
          value={song.name}
          onSave={onChangeName}
          className="text-sm text-[var(--text-primary)]"
          inputClassName="text-sm w-full"
        />
      </div>
      <span className="w-10 text-xs text-[var(--text-muted)] tabular-nums shrink-0">
        {song.id}
      </span>
      <button
        onClick={onDelete}
        className="w-7 h-7 rounded-md text-[var(--text-muted)] active:text-red-400 active:bg-red-400/10 flex items-center justify-center transition-all shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  )
}

// ── Save button ───────────────────────────────────────────────────────────────

function SaveButton({ saving, saved, onSave }: { saving: boolean; saved: boolean; onSave: () => void }) {
  return (
    <button
      onClick={onSave}
      disabled={saving}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 ${
        saved
          ? 'bg-green-500/20 text-green-400 ring-1 ring-green-500/30'
          : 'bg-[var(--accent)]/15 active:bg-[var(--accent)]/25 text-[var(--accent)]'
      }`}
    >
      {saving ? <Loader2 size={12} className="animate-spin" /> : saved ? <Check size={12} /> : <Save size={12} />}
      {saved ? 'Saved' : 'Save'}
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AlbumsAdminView(): JSX.Element {
  const [data, setData]       = useState<WrldData | null>(null)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  useEffect(() => {
    loadData().then(setData).catch(() => setError('Failed to load wrlddata.json'))
  }, [])

  // Hardware back leaves the album detail before it does anything else (this
  // view mounts only while its tab is active, so there's nothing to bubble
  // past — but returning false when there's nothing to undo still matters,
  // otherwise a stray press with no album open would swallow the tab's own
  // back handling instead of falling through to it).
  const backRef = useRef<() => boolean>(() => false)
  backRef.current = (): boolean => {
    if (selectedId !== null) { setSelectedId(null); return true }
    return false
  }
  useEffect(() => registerBackHandler(() => backRef.current()), [])

  const handleSave = async () => {
    if (!data) return
    setSaving(true)
    try {
      await saveData(data)
      setSaved(true)
      setTimeout(() => setSaved(false), 2200)
    } catch { setError('Save failed') }
    setSaving(false)
  }

  const addAlbum = () => {
    if (!data) return
    const id = Math.max(0, ...data.albums.map(a => a.id)) + 1
    setData({
      albums: [...data.albums, {
        id,
        name: 'New Album',
        versions: [{ name: 'Standard Edition', year: new Date().getFullYear(), cover_url: '', songs: [] }],
      }],
    })
  }

  // ── Error / loading ────────────────────────────────────────────────────────

  if (error) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3">
      <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center">
        <X size={20} className="text-red-400" />
      </div>
      <p className="text-sm text-[var(--text-muted)]">{error}</p>
    </div>
  )

  if (!data) return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 size={22} className="animate-spin text-[var(--accent)]" />
    </div>
  )

  // ── Selected album ─────────────────────────────────────────────────────────

  const selectedAlbum = selectedId !== null ? data.albums.find(a => a.id === selectedId) ?? null : null

  if (selectedAlbum) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Save bar at top */}
        <div className="flex items-center justify-end gap-3 px-4 py-2.5 border-b border-[var(--border)] shrink-0 bg-[var(--surface)]">
          <SaveButton saving={saving} saved={saved} onSave={handleSave} />
        </div>
        <AlbumDetail
          album={selectedAlbum}
          onBack={() => setSelectedId(null)}
          onChange={updated => {
            setData({ albums: data.albums.map(a => a.id === updated.id ? updated : a) })
          }}
        />
      </div>
    )
  }

  // ── Grid view ──────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] shrink-0">
        <div>
          <h1 className="text-lg font-bold text-[var(--text-primary)]">Albums</h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {data.albums.length} albums · wrlddata.json
          </p>
        </div>
        <SaveButton saving={saving} saved={saved} onSave={handleSave} />
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <div className="grid grid-cols-2 gap-4">
          {data.albums.map((album, i) => (
            <AlbumCard
              key={album.id}
              album={album}
              onClick={() => setSelectedId(album.id)}
              onDelete={() => setData({ albums: data.albums.filter((_, j) => j !== i) })}
            />
          ))}

          {/* Add album tile */}
          <button
            onClick={addAlbum}
            className="flex flex-col items-center justify-center aspect-square rounded-2xl border-2 border-dashed border-[var(--border)] text-[var(--text-muted)] active:border-[var(--accent)] active:text-[var(--accent)] transition-colors gap-2"
          >
            <div className="w-10 h-10 rounded-full border-2 border-current flex items-center justify-center">
              <Plus size={18} />
            </div>
            <span className="text-xs font-medium">Add Album</span>
          </button>
        </div>
      </div>
    </div>
  )
}
