import { useRef } from 'react'
import { ChevronRight, Play, ListMusic, Gamepad2, Flame, Music2, Disc3, User, Newspaper, Radio, Heart } from 'lucide-react'
import { AlbumArtThumbnail } from './AlbumArtThumbnail'
import { ProgressiveCover } from './ProgressiveCover'
import { useHomeData, type GameCard, type HomePlaylistCard } from '../hooks/useHomeData'
import { useElementSize } from '../hooks/useElementSize'
import type { NewsItem } from '../lib/newsApi'
import type { Track } from '../types'

// The desktop landing screen — same sections, same data (useHomeData) and the
// same Settings → Home screen toggles as the mobile shell, laid out as a bento
// that fills the window instead of a stack that scrolls out of it.
//
// The whole point of the desktop layout is that a desktop screen can hold the
// entire dashboard at once: the view is height-bound (h-full inside App's
// fixed-height <main>), the two big rows split the leftover space between
// them, and each tile fits itself to the box it lands in. Cover grids clamp to
// whole rows — a half-visible row of covers reads as broken in a way a short
// grid doesn't — and News, the one section where the extra headlines are worth
// keeping reachable, scrolls inside its own tile.
//
// Section ids map 1:1 to one place on screen, so hiding a section in Settings
// removes exactly one thing. Three move relative to mobile: News, 999 FM and
// Liked share one narrow right-hand rail (compact cards, News taking whatever
// height they leave it) rather than each claiming a full-height column of
// their own, so Recently played and Playlists — the two sections actually
// worth spending width on — get the rest of the page. "Your listening" is the
// hero's row of numbers, where it costs no vertical space of its own.

const GAP = 12          // matches gap-3 on the cover grids
const MIN_TILE = 130    // narrowest a cover may get before dropping a column
const LABEL_H = 38      // the title + subtitle block under each cover
const MAX_NEWS = 20

// Whole rows only — see the header note. Returns how many items fit the box.
function fitCount(size: { width: number; height: number }, total: number): { cols: number; count: number } {
  if (size.width <= 0 || size.height <= 0) return { cols: 1, count: 0 }
  const cols = Math.max(1, Math.floor((size.width + GAP) / (MIN_TILE + GAP)))
  const tileW = (size.width - (cols - 1) * GAP) / cols
  const rowH = tileW + LABEL_H
  const rows = Math.max(1, Math.floor((size.height + GAP) / (rowH + GAP)))
  return { cols, count: Math.min(total, cols * rows) }
}

function Tile({ title, icon, action, span, children }: {
  title?: string
  icon?: JSX.Element
  action?: { label: string; onClick: () => void }
  span: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <section className={`${span} min-w-0 min-h-0 flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface-overlay)]/50 p-4`}>
      {title && (
        <div className="flex items-center gap-2 mb-3 shrink-0">
          <span className="text-text-muted">{icon}</span>
          <h2 className="text-text-primary text-sm font-bold uppercase tracking-wider flex-1 min-w-0 truncate">{title}</h2>
          {action && (
            <button
              onClick={action.onClick}
              className="flex items-center gap-0.5 px-2 py-0.5 -mr-2 rounded-lg text-text-muted text-xs font-semibold hover:text-text-primary hover:bg-[var(--surface-raised)] transition-colors shrink-0"
            >
              {action.label}<ChevronRight size={13} />
            </button>
          )}
        </div>
      )}
      {children}
    </section>
  )
}

function EmptyNote({ children }: { children: React.ReactNode }): JSX.Element {
  return <p className="text-text-muted text-xs">{children}</p>
}

// ─── Row A / B mains: the two clamped cover grids ────────────────────────────

function CoverGrid({ children, cols, bodyRef }: {
  children: React.ReactNode
  cols: number
  bodyRef: React.RefObject<HTMLDivElement>
}): JSX.Element {
  return (
    <div ref={bodyRef} className="flex-1 min-h-0 overflow-hidden">
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {children}
      </div>
    </div>
  )
}

function RecentTile({ tracks, onPlay, span }: {
  tracks: Track[]
  onPlay: (track: Track) => void
  span: string
}): JSX.Element {
  const bodyRef = useRef<HTMLDivElement>(null)
  const { cols, count } = fitCount(useElementSize(bodyRef), tracks.length)
  return (
    <Tile title="Recently played" icon={<Disc3 size={15} />} span={span}>
      <CoverGrid cols={cols} bodyRef={bodyRef}>
        {tracks.slice(0, count).map((track) => (
          <button key={track.id} onClick={() => onPlay(track)} className="group text-left min-w-0">
            <div className="relative aspect-square rounded-lg overflow-hidden bg-surface-raised mb-1.5">
              <AlbumArtThumbnail track={track} fill className="w-full h-full object-cover" />
              <span className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="absolute bottom-1.5 right-1.5 w-8 h-8 rounded-full bg-accent text-black flex items-center justify-center opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all">
                <Play size={13} className="ml-0.5" fill="currentColor" />
              </span>
            </div>
            <p className="text-text-primary text-xs leading-snug truncate group-hover:text-accent transition-colors">{track.title}</p>
            <p className="text-text-muted text-[11px] truncate mt-0.5">{track.artist}</p>
          </button>
        ))}
      </CoverGrid>
    </Tile>
  )
}

function PlaylistsTile({ playlists, onAll, span }: {
  playlists: HomePlaylistCard[]
  onAll: () => void
  span: string
}): JSX.Element {
  const bodyRef = useRef<HTMLDivElement>(null)
  const { cols, count } = fitCount(useElementSize(bodyRef), playlists.length)
  return (
    <Tile title="Playlists" icon={<ListMusic size={15} />} action={{ label: 'All', onClick: onAll }} span={span}>
      {playlists.length === 0 ? (
        <EmptyNote>No playlists yet — build one from any song&apos;s menu.</EmptyNote>
      ) : (
        <CoverGrid cols={cols} bodyRef={bodyRef}>
          {playlists.slice(0, count).map((p) => (
            <button key={p.key} onClick={p.open} className="group text-left min-w-0">
              <div className="aspect-square rounded-lg overflow-hidden bg-surface-raised mb-1.5 flex items-center justify-center">
                {p.cover
                  ? <ProgressiveCover src={p.cover} alt={p.name} className="w-full h-full object-cover" />
                  : <ListMusic size={26} className="text-text-muted" />}
              </div>
              <p className="text-text-primary text-xs leading-snug truncate group-hover:text-accent transition-colors">{p.name}</p>
              <p className="text-text-muted text-[11px] truncate mt-0.5">{p.subtitle}</p>
            </button>
          ))}
        </CoverGrid>
      )}
    </Tile>
  )
}

// ─── Row A side: the one tile that scrolls ───────────────────────────────────

function NewsTile({ items, onOpen, onAll, span }: {
  items: NewsItem[]
  onOpen: (item: NewsItem) => void
  onAll: () => void
  span: string
}): JSX.Element {
  return (
    <Tile title="News" icon={<Newspaper size={15} />} action={{ label: 'All', onClick: onAll }} span={span}>
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar -mx-1 px-1 space-y-1">
        {items.slice(0, MAX_NEWS).map((item) => (
          <button
            key={item.id}
            onClick={() => onOpen(item)}
            className="group w-full flex items-center gap-2.5 rounded-lg p-1.5 text-left hover:bg-[var(--surface-raised)] transition-colors"
          >
            <span className="w-12 h-12 shrink-0 rounded-md overflow-hidden bg-surface-raised flex items-center justify-center">
              {item.image_url
                ? <ProgressiveCover src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                : <Newspaper size={16} className="text-text-muted" />}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-text-primary text-xs leading-snug line-clamp-2 group-hover:text-accent transition-colors">{item.title}</span>
              {item.category && <span className="block text-text-muted text-[11px] truncate mt-0.5">{item.category}</span>}
            </span>
          </button>
        ))}
      </div>
    </Tile>
  )
}

// ─── Row B side + row C: the compact shortcut tiles ──────────────────────────

function ShortcutCard({ icon, title, subtitle, tone = 'accent', onClick }: {
  icon: JSX.Element
  title: React.ReactNode
  subtitle: React.ReactNode
  tone?: 'accent' | 'live'
  onClick: () => void
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      className="group shrink-0 w-full flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-overlay)] px-3.5 py-3 text-left hover:border-[var(--accent)] hover:bg-surface-highest transition-colors"
    >
      <span className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${tone === 'live' ? 'bg-red-600/15' : 'bg-accent/15'}`}>
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-1.5 text-text-primary text-sm font-semibold">{title}</span>
        <span className="block text-text-muted text-xs truncate mt-0.5">{subtitle}</span>
      </span>
      <ChevronRight size={15} className="text-text-muted shrink-0 group-hover:text-text-primary transition-colors" />
    </button>
  )
}

function GamesTile({ games, onOpen, span }: {
  games: GameCard[]
  onOpen: (view: GameCard['view']) => void
  span: string
}): JSX.Element {
  return (
    <Tile title="Games" icon={<Gamepad2 size={15} />} span={span}>
      <div className="grid grid-cols-3 gap-3">
        {games.map((g) => (
          <button
            key={g.view}
            onClick={() => onOpen(g.view)}
            className="group flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-overlay)] px-3.5 py-2.5 text-left hover:border-[var(--accent)] hover:bg-surface-highest transition-colors"
          >
            <span className="w-9 h-9 rounded-lg bg-accent/15 flex items-center justify-center shrink-0">
              <Gamepad2 size={17} className="text-accent" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-text-primary text-sm font-semibold truncate">{g.label}</span>
              {g.kind === 'daily' ? (
                <span className="flex items-center gap-2 mt-0.5 min-w-0">
                  <span className="flex items-center gap-1 text-text-muted shrink-0">
                    <Flame size={11} className={g.streak > 0 ? 'text-accent' : ''} />
                    <span className="text-[11px] tabular-nums">{g.streak}</span>
                  </span>
                  <span className={`text-[11px] font-medium truncate ${g.done ? 'text-accent' : 'text-text-muted'}`}>
                    {g.done ? 'Played today' : 'Not played today'}
                  </span>
                </span>
              ) : (
                <span className="block text-[11px] mt-0.5 text-text-muted truncate">{g.sub}</span>
              )}
            </span>
          </button>
        ))}
      </div>
    </Tile>
  )
}

// ─── Hero ────────────────────────────────────────────────────────────────────

function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Up late'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function Stat({ value, label }: { value: string; label: string }): JSX.Element {
  return (
    <span className="flex items-baseline gap-1.5 min-w-0">
      <span className="text-text-primary text-base font-bold tabular-nums">{value}</span>
      <span className="text-text-muted text-xs truncate">{label}</span>
    </span>
  )
}

export default function HomeViewDesktop(): JSX.Element {
  const {
    account, likedTrackIds, radioFmIsLive, radioFmNowPlaying, setActiveView,
    openProfile, showSection, recent, newsItems, games, playlistRow,
    totalPlays, distinctSongs, weekPlays, openTrack, openNewsItem,
  } = useHomeData()

  const showRecent = showSection('recent') && recent.length > 0
  const showNews = showSection('news') && newsItems.length > 0
  const showPlaylists = showSection('playlists')
  const showRadio = showSection('radio')
  const showLiked = showSection('liked') && likedTrackIds.length > 0
  const showGames = showSection('games')
  const showListening = showSection('listening')

  const mainShown = showRecent || showPlaylists
  const sideShown = showNews || showRadio || showLiked

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="h-full min-h-[600px] w-full max-w-[1800px] mx-auto px-6 py-5 flex flex-col gap-4">
        {/* ── Hero: one line, with "Your listening" folded in as numbers ── */}
        <div className="shrink-0 flex items-center gap-3.5 flex-wrap">
          <button
            onClick={openProfile}
            aria-label="Profile"
            className="w-11 h-11 shrink-0 rounded-full overflow-hidden bg-[var(--surface-overlay)] flex items-center justify-center text-text-muted hover:bg-surface-highest transition-colors"
          >
            {account?.discord_avatar
              ? <img src={account.discord_avatar} alt="" className="w-full h-full object-cover" />
              : <User size={19} />}
          </button>
          <h1 className="text-text-primary text-xl font-bold leading-tight truncate min-w-0">
            {greeting()}{account ? `, ${account.display_name}` : ''}
          </h1>
          {showListening && (
            <div className="ml-auto flex items-center gap-4 min-w-0">
              {totalPlays === 0 ? (
                <span className="text-text-muted text-xs truncate">Play something and your stats will show up here.</span>
              ) : (
                <>
                  <Stat value={totalPlays.toLocaleString()} label={totalPlays === 1 ? 'play' : 'plays'} />
                  <Stat value={distinctSongs.toLocaleString()} label={distinctSongs === 1 ? 'song' : 'songs'} />
                  <Stat value={weekPlays.toLocaleString()} label="this week" />
                </>
              )}
              <button
                onClick={() => setActiveView('stats')}
                className="flex items-center gap-0.5 px-2.5 py-1 rounded-lg text-text-muted text-xs font-semibold hover:text-text-primary hover:bg-[var(--surface-overlay)] transition-colors shrink-0"
              >
                Wrapped<ChevronRight size={13} />
              </button>
            </div>
          )}
        </div>

        {/* ── Main: recently played + playlists stacked, full width ──
            ── Side rail: news, 999 FM, liked — compact, narrow ── */}
        {(mainShown || sideShown) && (
          <div className="flex-1 min-h-0 flex gap-4">
            {mainShown && (
              <div className="flex-1 min-w-0 flex flex-col gap-4">
                {showRecent && <RecentTile tracks={recent} onPlay={openTrack} span="flex-1" />}
                {showPlaylists && (
                  <PlaylistsTile playlists={playlistRow} onAll={() => setActiveView('playlists')} span="flex-1" />
                )}
              </div>
            )}

            {sideShown && (
              <div className="w-[300px] shrink-0 min-h-0 flex flex-col gap-3">
                {showNews && (
                  <NewsTile
                    items={newsItems}
                    onOpen={openNewsItem}
                    onAll={() => setActiveView('news')}
                    span="flex-1 min-h-0"
                  />
                )}
                {showRadio && (
                  <ShortcutCard
                    tone={radioFmIsLive ? 'live' : 'accent'}
                    icon={<Radio size={18} className={radioFmIsLive ? 'text-red-500 animate-pulse' : 'text-accent'} />}
                    title={
                      <>
                        999 FM
                        {radioFmIsLive && <span className="text-red-500 text-[10px] font-bold uppercase tracking-widest">Live</span>}
                      </>
                    }
                    subtitle={
                      radioFmIsLive && radioFmNowPlaying
                        ? `${radioFmNowPlaying.title} — ${radioFmNowPlaying.artist}`
                        : 'Juice WRLD radio, live 24/7'
                    }
                    onClick={() => setActiveView('wrld')}
                  />
                )}
                {showLiked && (
                  <ShortcutCard
                    icon={<Heart size={18} className="text-accent" fill="currentColor" />}
                    title="Liked songs"
                    subtitle={`${likedTrackIds.length} song${likedTrackIds.length === 1 ? '' : 's'}`}
                    onClick={() => setActiveView('liked')}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Games: full width ── */}
        {showGames && (
          <div className="shrink-0">
            <GamesTile games={games} onOpen={(view) => setActiveView(view)} span="w-full" />
          </div>
        )}

        {!mainShown && !sideShown && !showGames && (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <Music2 size={34} className="text-text-muted mb-3" />
            <p className="text-text-primary text-sm font-semibold mb-1">Nothing to show</p>
            <p className="text-text-muted text-xs max-w-xs leading-relaxed">
              Every Home section is switched off. Turn some back on in
              Settings → Appearance → Home screen.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
