import { ChevronRight, Play, ListMusic, Gamepad2, Flame, Music2, Disc3, User, Newspaper, Radio, Heart, BarChart3 } from 'lucide-react'
import { AlbumArtThumbnail } from './AlbumArtThumbnail'
import { ProgressiveCover } from './ProgressiveCover'
import { useHomeData } from '../hooks/useHomeData'

// The desktop landing screen. Same sections, same data (useHomeData) and the
// same Settings → Home screen toggles as the mobile shell — but laid out as a
// dashboard rather than a stack of rails: the phone's horizontal strips would
// leave most of a 1600px window empty while still hiding content behind a
// scroll, so every section here is a grid that wraps to fill the width.
//
// One section id still maps to exactly one place on screen, so hiding a
// section in Settings removes exactly one thing. The 999 FM row is the only
// one that moves: on desktop it's the hero's right-hand card, where the extra
// width actually buys something (a readable now-playing line).

// Covers wide enough to breathe but small enough that a 1400px row still
// holds eight — the grid picks the column count from these.
const COVER_GRID = 'grid gap-4 grid-cols-[repeat(auto-fill,minmax(150px,1fr))]'
const NEWS_GRID = 'grid gap-4 grid-cols-[repeat(auto-fill,minmax(280px,1fr))]'

// Enough to fill two rows at most desktop widths without turning Home into a
// full listing — each section has an "All" route for that.
const MAX_COVERS = 12
const MAX_NEWS = 6

function Section({ title, icon, action, children }: {
  title: string
  icon: JSX.Element
  action?: { label: string; onClick: () => void }
  children: React.ReactNode
}): JSX.Element {
  return (
    <section className="mb-9">
      <div className="flex items-center gap-2.5 mb-3.5">
        <span className="text-text-muted">{icon}</span>
        <h2 className="text-text-primary text-lg font-bold flex-1 min-w-0 truncate">{title}</h2>
        {action && (
          <button
            onClick={action.onClick}
            className="flex items-center gap-0.5 px-2.5 py-1 -mr-2.5 rounded-lg text-text-muted text-xs font-semibold hover:text-text-primary hover:bg-[var(--surface-overlay)] transition-colors shrink-0"
          >
            {action.label}<ChevronRight size={14} />
          </button>
        )}
      </div>
      {children}
    </section>
  )
}

function StatCard({ icon, value, label }: { icon: JSX.Element; value: string; label: string }): JSX.Element {
  return (
    <div className="flex-1 min-w-0 rounded-xl bg-[var(--surface-overlay)] px-4 py-3">
      <span className="flex items-center gap-1.5 text-text-muted">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-widest truncate">{label}</span>
      </span>
      <p className="text-text-primary text-2xl font-bold tabular-nums truncate mt-1">{value}</p>
    </div>
  )
}

function EmptyNote({ children }: { children: React.ReactNode }): JSX.Element {
  return <p className="text-text-muted text-sm">{children}</p>
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Up late'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function HomeViewDesktop(): JSX.Element {
  const {
    account, likedTrackIds, radioFmIsLive, radioFmNowPlaying, setActiveView,
    openProfile, showSection, recent, newsItems, games, playlistRow,
    totalPlays, distinctSongs, weekPlays, openTrack, openNewsItem,
  } = useHomeData()

  const showListening = showSection('listening')
  const showLiked = showSection('liked') && likedTrackIds.length > 0

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
      <div className="px-6 pt-6 pb-10 w-full max-w-[1400px] mx-auto">
        {/* ── Hero ── */}
        <div className="flex items-center gap-5 mb-9 flex-wrap">
          <button
            onClick={openProfile}
            aria-label="Profile"
            className="w-14 h-14 shrink-0 rounded-full overflow-hidden bg-[var(--surface-overlay)] flex items-center justify-center text-text-muted hover:bg-surface-highest transition-colors"
          >
            {account?.discord_avatar
              ? <img src={account.discord_avatar} alt="" className="w-full h-full object-cover" />
              : <User size={24} />}
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-text-primary text-3xl font-bold leading-tight truncate">
              {greeting()}{account ? `, ${account.display_name}` : ''}
            </h1>
            <p className="text-text-muted text-sm mt-1">
              {totalPlays > 0
                ? `${totalPlays.toLocaleString()} ${totalPlays === 1 ? 'play' : 'plays'} · ${distinctSongs.toLocaleString()} ${distinctSongs === 1 ? 'song' : 'songs'}`
                : 'Everything Juice WRLD ever recorded, in one place.'}
            </p>
          </div>

          {showSection('radio') && (
            <button
              onClick={() => setActiveView('wrld')}
              className="group w-[340px] shrink-0 flex items-center gap-3.5 rounded-2xl border border-[var(--border)] bg-gradient-to-br from-accent/15 to-transparent px-4 py-3.5 text-left hover:border-[var(--accent)] transition-colors"
            >
              <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${radioFmIsLive ? 'bg-red-600/15' : 'bg-accent/15'}`}>
                <Radio size={20} className={radioFmIsLive ? 'text-red-500 animate-pulse' : 'text-accent'} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2">
                  <span className="text-text-primary text-sm font-semibold">999 FM</span>
                  {radioFmIsLive && <span className="text-red-500 text-[10px] font-bold uppercase tracking-widest">Live</span>}
                </span>
                <span className="block text-text-muted text-xs truncate mt-0.5">
                  {radioFmIsLive && radioFmNowPlaying
                    ? `${radioFmNowPlaying.title} — ${radioFmNowPlaying.artist}`
                    : 'Juice WRLD radio, live 24/7'}
                </span>
              </span>
              <ChevronRight size={16} className="text-text-muted shrink-0 group-hover:text-text-primary transition-colors" />
            </button>
          )}
        </div>

        {showSection('recent') && recent.length > 0 && (
          <Section title="Recently played" icon={<Disc3 size={17} />}>
            <div className={COVER_GRID}>
              {recent.slice(0, MAX_COVERS).map((track) => (
                <button key={track.id} onClick={() => openTrack(track)} className="group text-left">
                  <div className="relative aspect-square rounded-xl overflow-hidden bg-surface-overlay mb-2">
                    <AlbumArtThumbnail track={track} fill className="w-full h-full object-cover" />
                    <span className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-accent text-black flex items-center justify-center opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all">
                      <Play size={15} className="ml-0.5" fill="currentColor" />
                    </span>
                  </div>
                  <p className="text-text-primary text-sm leading-snug truncate group-hover:text-accent transition-colors">{track.title}</p>
                  <p className="text-text-muted text-xs truncate mt-0.5">{track.artist}</p>
                </button>
              ))}
            </div>
          </Section>
        )}

        {showSection('news') && newsItems.length > 0 && (
          <Section
            title="News"
            icon={<Newspaper size={17} />}
            action={{ label: 'All', onClick: () => setActiveView('news') }}
          >
            <div className={NEWS_GRID}>
              {newsItems.slice(0, MAX_NEWS).map((item) => (
                <button
                  key={item.id}
                  onClick={() => openNewsItem(item)}
                  className="group text-left rounded-xl border border-[var(--border)] bg-[var(--surface-overlay)] overflow-hidden hover:border-[var(--accent)] transition-colors"
                >
                  <div className="aspect-video bg-surface-raised flex items-center justify-center overflow-hidden">
                    {item.image_url
                      ? <ProgressiveCover src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                      : <Newspaper size={30} className="text-text-muted" />}
                  </div>
                  <div className="px-3.5 py-3">
                    <p className="text-text-primary text-sm font-medium leading-snug line-clamp-2">{item.title}</p>
                    {item.category && <p className="text-text-muted text-xs truncate mt-1.5">{item.category}</p>}
                  </div>
                </button>
              ))}
            </div>
          </Section>
        )}

        {showSection('playlists') && (
          <Section
            title="Playlists"
            icon={<ListMusic size={17} />}
            action={{ label: 'All', onClick: () => setActiveView('playlists') }}
          >
            {playlistRow.length === 0 ? (
              <EmptyNote>No playlists yet — build one from any song&apos;s menu.</EmptyNote>
            ) : (
              <div className={COVER_GRID}>
                {playlistRow.map((p) => (
                  <button key={p.key} onClick={p.open} className="group text-left">
                    <div className="aspect-square rounded-xl overflow-hidden bg-surface-overlay mb-2 flex items-center justify-center">
                      {p.cover
                        ? <ProgressiveCover src={p.cover} alt={p.name} className="w-full h-full object-cover" />
                        : <ListMusic size={30} className="text-text-muted" />}
                    </div>
                    <p className="text-text-primary text-sm leading-snug truncate group-hover:text-accent transition-colors">{p.name}</p>
                    <p className="text-text-muted text-xs truncate mt-0.5">{p.subtitle}</p>
                  </button>
                ))}
              </div>
            )}
          </Section>
        )}

        {showSection('games') && (
          <Section title="Games" icon={<Gamepad2 size={17} />}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {games.map((g) => (
                <button
                  key={g.view}
                  onClick={() => setActiveView(g.view)}
                  className="group flex items-center gap-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface-overlay)] px-4 py-3.5 text-left hover:border-[var(--accent)] hover:bg-surface-highest transition-colors"
                >
                  <span className="w-11 h-11 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
                    <Gamepad2 size={20} className="text-accent" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-text-primary text-sm font-semibold truncate">{g.label}</span>
                    {g.kind === 'daily' ? (
                      <span className="flex items-center gap-2.5 mt-1">
                        <span className="flex items-center gap-1 text-text-muted">
                          <Flame size={12} className={g.streak > 0 ? 'text-accent' : ''} />
                          <span className="text-xs tabular-nums">{g.streak} day streak</span>
                        </span>
                        <span className={`text-xs font-medium ${g.done ? 'text-accent' : 'text-text-muted'}`}>
                          {g.done ? 'Played today' : 'Not played today'}
                        </span>
                      </span>
                    ) : (
                      <span className="block text-xs mt-1 text-text-muted">{g.sub}</span>
                    )}
                  </span>
                  <ChevronRight size={16} className="text-text-muted shrink-0 group-hover:text-text-primary transition-colors" />
                </button>
              ))}
            </div>
          </Section>
        )}

        {/* Two halves of one closing row — either can be hidden from Settings,
            and whichever survives alone spans the full width. */}
        {(showListening || showLiked) && (
          <div className={`grid gap-6 ${showListening && showLiked ? 'xl:grid-cols-2' : ''}`}>
            {showListening && (
              <Section
                title="Your listening"
                icon={<Music2 size={17} />}
                action={{ label: 'Wrapped', onClick: () => setActiveView('stats') }}
              >
                {totalPlays === 0 ? (
                  <EmptyNote>Play something and your stats will show up here.</EmptyNote>
                ) : (
                  <div className="flex gap-3">
                    <StatCard icon={<Play size={11} fill="currentColor" />} value={totalPlays.toLocaleString()} label="Plays" />
                    <StatCard icon={<Disc3 size={11} />} value={distinctSongs.toLocaleString()} label="Songs" />
                    <StatCard icon={<BarChart3 size={11} />} value={weekPlays.toLocaleString()} label="This week" />
                  </div>
                )}
              </Section>
            )}

            {showLiked && (
              <Section title="Liked songs" icon={<Heart size={17} />}>
                <button
                  onClick={() => setActiveView('liked')}
                  className="group w-full flex items-center gap-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface-overlay)] px-4 py-3.5 hover:border-[var(--accent)] hover:bg-surface-highest transition-colors"
                >
                  <span className="w-11 h-11 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
                    <Music2 size={20} className="text-accent" />
                  </span>
                  <span className="flex-1 min-w-0 text-left">
                    <span className="block text-text-primary text-sm font-semibold">Liked songs</span>
                    <span className="block text-text-muted text-xs mt-0.5">
                      {likedTrackIds.length} song{likedTrackIds.length === 1 ? '' : 's'}
                    </span>
                  </span>
                  <ChevronRight size={16} className="text-text-muted shrink-0 group-hover:text-text-primary transition-colors" />
                </button>
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
