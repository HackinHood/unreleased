import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, MoreHorizontal, Play, ListMusic, Gamepad2, Flame, Music2, Disc3, User, Newspaper } from 'lucide-react'
import { useStorePick } from '../store/useStore'
import { AlbumArtThumbnail } from './AlbumArtThumbnail'
import { ProgressiveCover } from './ProgressiveCover'
import { loadRecentTracks } from '../lib/recentTracks'
import { filterListeningPlaysByDays } from '../lib/listeningPlays'
import { playlistCoverUrl } from '../lib/juicewrldApi'
import { useMobileNavSplit } from '../hooks/useMobileNavTabs'
import { loadStats as loadHeardleStats, todayKey as heardleToday } from '../lib/heardle'
import { loadStats as loadWordleStats, todayKey as wordleToday } from '../lib/wordle'
import { loadTierlistState } from '../lib/tierlist'
import { ALL_CHANNEL, fetchNews, peekNews, type NewsItem } from '../lib/newsApi'
import type { Track, ViewType } from '../types'

// A daily puzzle (streak + played-today) vs. Tier List, which is a standing
// ranking with no daily reset — same card shell, different second line.
type GameCard =
  | { view: ViewType; label: string; kind: 'daily'; streak: number; done: boolean }
  | { view: ViewType; label: string; kind: 'freeform'; sub: string }

// The mobile landing screen — a dashboard over things the app already knows,
// not a new data source. Everything here reads from the store or localStorage
// synchronously: no fetch on mount, so Home paints instantly and works offline.
//
// Deliberately NOT using lib/listeningStats' buildListeningStats: it operates on
// songs joined against the stats catalog, and resolving that costs ~25 requests
// on a cold cache (lib/statsCatalog). The counts below come straight off the
// raw play events instead. Listening *time* is the one number that genuinely
// needs song durations, so it isn't shown here — /stats owns that.

function Section({ title, icon, action, children }: {
  title: string
  icon: JSX.Element
  action?: { label: string; onClick: () => void }
  children: React.ReactNode
}): JSX.Element {
  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 px-4 mb-2.5">
        <span className="text-text-muted">{icon}</span>
        <h2 className="text-text-primary text-[15px] font-bold flex-1 min-w-0 truncate">{title}</h2>
        {action && (
          <button onClick={action.onClick} className="flex items-center gap-0.5 text-text-muted text-xs font-medium active:text-text-primary shrink-0">
            {action.label}<ChevronRight size={14} />
          </button>
        )}
      </div>
      {children}
    </section>
  )
}

function StatCard({ value, label }: { value: string; label: string }): JSX.Element {
  return (
    <div className="flex-1 min-w-0 rounded-xl bg-[var(--surface-overlay)] px-3 py-2.5">
      <p className="text-text-primary text-lg font-bold tabular-nums truncate">{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted truncate">{label}</p>
    </div>
  )
}

function EmptyNote({ children }: { children: React.ReactNode }): JSX.Element {
  return <p className="px-4 text-text-muted text-xs">{children}</p>
}

export default function HomeViewMobile(): JSX.Element {
  const {
    account, playlists, guestPlaylists, followedPlaylists, likedTrackIds,
    listeningPlays, setActiveView, setPendingPlaylistId, playTrack, setShowMoreNav, openProfile,
  } = useStorePick(
    'account', 'playlists', 'guestPlaylists', 'followedPlaylists', 'likedTrackIds',
    'listeningPlays', 'setActiveView', 'setPendingPlaylistId', 'playTrack', 'setShowMoreNav', 'openProfile',
  )
  // Whatever doesn't fit the bottom nav directly — its old in-bar "More" tab
  // moved here, since fitting it AND a Home tab both in the bar pushed the
  // cap down by one more real destination.
  const { moreTabs } = useMobileNavSplit()

  // localStorage-backed, so read once per mount rather than per render. Home is
  // remounted on every visit (it's a route), which is exactly when this should
  // refresh — a song played while you were on another tab shows up on return.
  const recent = useMemo(() => loadRecentTracks(), [])

  // Same stale-while-revalidate pattern as NewsView: paint the last cached
  // page instantly, then let the network response replace it.
  const [newsItems, setNewsItems] = useState<NewsItem[]>(() => peekNews({ channel: ALL_CHANNEL })?.results ?? [])
  useEffect(() => {
    fetchNews({ channel: ALL_CHANNEL }).then((res) => setNewsItems(res.results)).catch(() => undefined)
  }, [])
  const games = useMemo((): GameCard[] => {
    const heardle = loadHeardleStats('daily')
    const wordle = loadWordleStats()
    const rankedCount = Object.keys(loadTierlistState().assignments).length
    return [
      { view: 'heardle', label: 'Heardle', kind: 'daily', streak: heardle.currentStreak, done: heardle.lastDay === heardleToday() },
      { view: 'wordle', label: 'Wordle', kind: 'daily', streak: wordle.currentStreak, done: wordle.lastDay === wordleToday() },
      { view: 'tierlist', label: 'Tier List', kind: 'freeform', sub: rankedCount > 0 ? `${rankedCount} ranked` : 'Rank your songs' },
    ]
  }, [])

  const totalPlays = listeningPlays.length
  const distinctSongs = useMemo(
    () => new Set(listeningPlays.map((e) => e.song)).size,
    [listeningPlays],
  )
  const weekPlays = useMemo(
    () => filterListeningPlaysByDays(listeningPlays, 7).length,
    [listeningPlays],
  )

  // Server playlists need an account; the local kinds don't. Signed out we just
  // show what exists locally rather than prompting to sign in.
  const ownPlaylists = account ? playlists : []
  const playlistRow = [
    ...ownPlaylists.filter((p) => p.track_count > 0).map((p) => ({
      key: `p${p.id}`,
      name: p.name,
      subtitle: `${p.track_count} song${p.track_count === 1 ? '' : 's'}`,
      cover: playlistCoverUrl(p),
      open: () => { setPendingPlaylistId(p.id); setActiveView('playlists') },
    })),
    ...followedPlaylists.filter((p) => p.trackCount > 0).map((p) => ({
      key: `f${p.id}`,
      name: p.name,
      subtitle: `${p.trackCount} song${p.trackCount === 1 ? '' : 's'}`,
      cover: p.coverUrl,
      open: () => { setPendingPlaylistId(p.id); setActiveView('playlists') },
    })),
    ...guestPlaylists.filter((p) => p.tracks.length > 0).map((p) => ({
      key: `g${p.id}`,
      name: p.name,
      subtitle: `${p.tracks.length} song${p.tracks.length === 1 ? '' : 's'}`,
      cover: p.tracks[0]?.imageUrl ?? null,
      open: () => setActiveView('playlists'),
    })),
  ].slice(0, 10)

  const openTrack = (track: Track): void => { playTrack(track) }

  // Mirrors NewsNotifier's openPost: NewsView reads this sessionStorage key
  // on mount to jump straight to the tapped post.
  const openNewsItem = (item: NewsItem): void => {
    setActiveView('news')
    try { sessionStorage.setItem('news:openPostId', String(item.id)) } catch {}
    window.dispatchEvent(new CustomEvent('news:open', { detail: item.id }))
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pt-2 pb-4">
      <div className="flex items-center gap-2 px-4 pb-4">
        <button
          onClick={openProfile}
          aria-label="Profile"
          className="w-9 h-9 shrink-0 rounded-full overflow-hidden bg-[var(--surface-overlay)] flex items-center justify-center text-text-muted active:bg-surface-highest transition-colors"
        >
          {account?.discord_avatar
            ? <img src={account.discord_avatar} alt="" className="w-full h-full object-cover" />
            : <User size={17} />}
        </button>
        <h1 className="flex-1 min-w-0 text-text-primary text-[26px] font-bold leading-tight">Home</h1>
        {moreTabs.length > 0 && (
          <button
            onClick={() => setShowMoreNav(true)}
            aria-label="More"
            className="w-9 h-9 shrink-0 rounded-full bg-[var(--surface-overlay)] flex items-center justify-center text-text-primary active:bg-surface-highest transition-colors"
          >
            <MoreHorizontal size={19} />
          </button>
        )}
      </div>

      {recent.length > 0 && (
        <Section title="Recently played" icon={<Disc3 size={15} />}>
          <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 pb-1">
            {recent.map((track) => (
              <button
                key={track.id}
                onClick={() => openTrack(track)}
                className="w-[116px] shrink-0 text-left active:opacity-70 transition-opacity"
              >
                <div className="relative w-[116px] h-[116px] rounded-xl overflow-hidden bg-surface-overlay mb-1.5">
                  <AlbumArtThumbnail track={track} fill className="w-full h-full object-cover" />
                  <span className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full bg-black/65 flex items-center justify-center">
                    <Play size={13} className="text-white ml-0.5" fill="currentColor" />
                  </span>
                </div>
                <p className="text-text-primary text-xs leading-snug truncate">{track.title}</p>
                <p className="text-text-muted text-[11px] truncate mt-0.5">{track.artist}</p>
              </button>
            ))}
          </div>
        </Section>
      )}

      {newsItems.length > 0 && (
        <Section
          title="News"
          icon={<Newspaper size={15} />}
          action={{ label: 'All', onClick: () => setActiveView('news') }}
        >
          <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 pb-1">
            {newsItems.slice(0, 8).map((item) => (
              <button
                key={item.id}
                onClick={() => openNewsItem(item)}
                className="w-[200px] shrink-0 text-left active:opacity-70 transition-opacity"
              >
                <div className="w-[200px] h-[112px] rounded-xl overflow-hidden bg-surface-overlay mb-1.5 flex items-center justify-center">
                  {item.image_url
                    ? <ProgressiveCover src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                    : <Newspaper size={26} className="text-text-muted" />}
                </div>
                <p className="text-text-primary text-xs leading-snug line-clamp-2">{item.title}</p>
                {item.category && <p className="text-text-muted text-[11px] truncate mt-0.5">{item.category}</p>}
              </button>
            ))}
          </div>
        </Section>
      )}

      <Section
        title="Playlists"
        icon={<ListMusic size={15} />}
        action={{ label: 'All', onClick: () => setActiveView('playlists') }}
      >
        {playlistRow.length === 0 ? (
          <EmptyNote>No playlists yet — build one from any song&apos;s menu.</EmptyNote>
        ) : (
          <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 pb-1">
            {playlistRow.map((p) => (
              <button key={p.key} onClick={p.open} className="w-[116px] shrink-0 text-left active:opacity-70 transition-opacity">
                <div className="w-[116px] h-[116px] rounded-xl overflow-hidden bg-surface-overlay mb-1.5 flex items-center justify-center">
                  {p.cover
                    ? <ProgressiveCover src={p.cover} alt={p.name} className="w-full h-full object-cover" />
                    : <ListMusic size={26} className="text-text-muted" />}
                </div>
                <p className="text-text-primary text-xs leading-snug truncate">{p.name}</p>
                <p className="text-text-muted text-[11px] truncate mt-0.5">{p.subtitle}</p>
              </button>
            ))}
          </div>
        )}
      </Section>

      <Section title="Games" icon={<Gamepad2 size={15} />}>
        <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 pb-1">
          {games.map((g) => (
            <button
              key={g.view}
              onClick={() => setActiveView(g.view)}
              className="w-[140px] shrink-0 rounded-xl bg-[var(--surface-overlay)] px-3.5 py-3 text-left active:bg-surface-highest transition-colors"
            >
              <p className="text-text-primary text-sm font-semibold truncate">{g.label}</p>
              {g.kind === 'daily' ? (
                <>
                  <div className="flex items-center gap-1 mt-1 text-text-muted">
                    <Flame size={12} className={g.streak > 0 ? 'text-accent' : ''} />
                    <span className="text-[11px] tabular-nums">{g.streak} day streak</span>
                  </div>
                  <p className={`text-[11px] mt-1.5 font-medium ${g.done ? 'text-accent' : 'text-text-muted'}`}>
                    {g.done ? 'Played today' : 'Not played today'}
                  </p>
                </>
              ) : (
                <p className="text-[11px] mt-1.5 text-text-muted">{g.sub}</p>
              )}
            </button>
          ))}
        </div>
      </Section>

      <Section
        title="Your listening"
        icon={<Music2 size={15} />}
        action={{ label: 'Wrapped', onClick: () => setActiveView('stats') }}
      >
        {totalPlays === 0 ? (
          <EmptyNote>Play something and your stats will show up here.</EmptyNote>
        ) : (
          <div className="px-4 flex gap-3">
            <StatCard value={totalPlays.toLocaleString()} label="Plays" />
            <StatCard value={distinctSongs.toLocaleString()} label="Songs" />
            <StatCard value={weekPlays.toLocaleString()} label="This week" />
          </div>
        )}
      </Section>

      {likedTrackIds.length > 0 && (
        <button
          onClick={() => setActiveView('liked')}
          className="mx-4 w-[calc(100%-2rem)] flex items-center gap-3 rounded-xl bg-[var(--surface-overlay)] px-3.5 py-3 active:bg-surface-highest transition-colors"
        >
          <span className="w-9 h-9 rounded-lg bg-accent/15 flex items-center justify-center shrink-0">
            <Music2 size={17} className="text-accent" />
          </span>
          <span className="flex-1 min-w-0 text-left">
            <span className="block text-text-primary text-sm font-semibold">Liked songs</span>
            <span className="block text-text-muted text-xs">{likedTrackIds.length} song{likedTrackIds.length === 1 ? '' : 's'}</span>
          </span>
          <ChevronRight size={16} className="text-text-muted shrink-0" />
        </button>
      )}
    </div>
  )
}
