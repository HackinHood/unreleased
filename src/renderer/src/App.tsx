import { useEffect, Suspense } from 'react'
import { useStore, useStorePick } from './store/useStore'
import { setToken, getToken } from './lib/userApi'
import { useThemeEffects } from './lib/themeEffects'
import { runWhenIdle } from './lib/platform'
import { applySeo } from './lib/seo'
import { lazyView } from './lib/lazyView'
import { useIsMobile } from './hooks/useIsMobile'
import { ViewType } from './types'

function getViewFromPath(pathname: string): ViewType {
  if (pathname === '/' || pathname === '/tracker') return 'api-tracker'
  if (pathname.startsWith('/files')) return 'api-files'
  if (pathname === '/editor') return 'editor'
  if (pathname === '/contributor') return 'contributor'
  if (pathname === '/admin') return 'admin'
  if (pathname === '/liked') return 'liked'
  if (pathname === '/playlists') return 'playlists'
  if (pathname === '/docs') return 'docs'
  if (pathname === '/wrld') return 'wrld'
  if (pathname === '/news') return 'news'
  if (pathname === '/heardle') return 'heardle'
  if (pathname === '/wordle') return 'wordle'
  if (pathname === '/tierlist') return 'tierlist'
  if (pathname === '/stats') return 'stats'
  if (pathname === '/download') return 'download'
  if (pathname.startsWith('/shared/')) return 'shared-playlist'
  if (pathname === '/auth/discord/callback') return 'api-tracker'
  return 'not-found'
}

import Sidebar from './components/Sidebar'
import BottomNav from './components/BottomNav'
import ApiTrackerView from './components/ApiTrackerView'
import ApiFilesView from './components/ApiFilesView'
import LikedSongsView from './components/LikedSongsView'
import PlaylistsView from './components/PlaylistsView'
import RadioFmPlayer from './components/RadioFmPlayer'
import RadioVotePopup from './components/RadioVotePopup'
import LastfmScrobbler from './components/LastfmScrobbler'
import NewsNotifier from './components/NewsNotifier'
import UserAuthModal from './components/UserAuthModal'
import ReportModal from './components/ReportModal'
import BulkEditModal from './components/BulkEditModal'
import InstallPrompt from './components/InstallPrompt'
import CookieNotice from './components/CookieNotice'
import { GlobalSongInfoHost } from './components/SongInfoModal'
import Player from './components/Player'
import NowPlaying from './components/NowPlaying'
import QueuePanel from './components/QueuePanel'
import DownloadManager from './components/DownloadManager'
import ErrorBoundary from './components/ErrorBoundary'

// Rarely-visited views load on first navigation instead of inflating the
// startup bundle. Suspense fallback is null: these chunks are local (Electron)
// or small (web), so a spinner would just flash. lazyView (not React's lazy)
// so a chunk that vanished in a redeploy triggers a reload instead of an
// error card — see lib/lazyView.
const EditorPage = lazyView(() => import('./components/EditorPage'))
const AdminPage = lazyView(() => import('./components/AdminPage'))
const SharedPlaylistView = lazyView(() => import('./components/SharedPlaylistView'))
const EditorProfileView = lazyView(() => import('./components/EditorProfileView'))
const NotFoundView = lazyView(() => import('./components/NotFoundView'))
const DocsPage = lazyView(() => import('./components/DocsPage'))
const WrldView = lazyView(() => import('./components/WrldView'))
const NewsView = lazyView(() => import('./components/NewsView'))
const HeardleView = lazyView(() => import('./components/HeardleView'))
const WordleView = lazyView(() => import('./components/WordleView'))
const TierlistView = lazyView(() => import('./components/TierlistView'))
const StatsView = lazyView(() => import('./components/StatsView'))
const DownloadAppView = lazyView(() => import('./components/DownloadAppView'))
const AlbumsAdminView = lazyView(() => import('./components/AlbumsAdminView'))
const ContributorPage = lazyView(() => import('./components/ContributorPage'))
const ContributorProfileView = lazyView(() => import('./components/ContributorProfileView'))
const Settings = lazyView(() => import('./components/Settings'))
const DiagnosticsModal = lazyView(() => import('./components/DiagnosticsModal'))

export default function App(): JSX.Element {
  const { showNowPlaying, showQueue, showSettings, setShowSettings, showDiagnostics, setShowDiagnostics, activeView, sidebarPosition, loadAccount, completeDiscordLogin, showUserAuth, setShowUserAuth, prefetchApiData, refreshPlaylists, heroBleedTop } = useStorePick(
    'showNowPlaying', 'showQueue', 'showSettings', 'setShowSettings', 'showDiagnostics', 'setShowDiagnostics', 'activeView', 'sidebarPosition', 'loadAccount', 'completeDiscordLogin', 'showUserAuth', 'setShowUserAuth', 'prefetchApiData', 'refreshPlaylists', 'heroBleedTop')
  const isMobile = useIsMobile()
  useThemeEffects()
  // Seed auth token from env in local dev only — import.meta.env.DEV is false in production
  // builds, so this never runs for real users even if the token is baked into the bundle.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const devToken = import.meta.env.VITE_AUTH_TOKEN as string | undefined
    if (devToken) { setToken(devToken); loadAccount() }
  }, [])

  // Sync view from URL on mount + handle back/forward
  useEffect(() => {
    const syncFromPath = (): void => {
      useStore.setState({ activeView: getViewFromPath(window.location.pathname) })
    }
    syncFromPath()
    window.addEventListener('popstate', syncFromPath)
    return () => window.removeEventListener('popstate', syncFromPath)
  }, [])

  // Give each route its own title/description/canonical. Web only — no-op in
  // the desktop app, including electron:dev (see lib/seo.ts).
  useEffect(() => { applySeo(activeView) }, [activeView])

  // Complete Discord OAuth redirect, then load the public account
  useEffect(() => {
    if (window.location.pathname === '/auth/discord/callback') {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      const state = params.get('state')
      const finish = (): void => {
        window.history.replaceState({}, '', '/tracker')
        useStore.setState({ activeView: 'api-tracker' })
      }
      if (code && state) {
        completeDiscordLogin(code, state).catch(() => undefined).finally(finish)
      } else {
        finish()
      }
      return
    }
    loadAccount()
  }, [loadAccount, completeDiscordLogin])

  // Re-fetch playlists on window focus — playlist edits made elsewhere (the
  // web player, another device, or a playlist saved from a shared link) don't
  // otherwise reach this window until it's restarted. refreshPlaylists() is a
  // no-op while signed out.
  useEffect(() => {
    const onFocus = (): void => { refreshPlaylists() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refreshPlaylists])

  // Warm the Tracker/Files offline cache on startup (public data — no auth
  // needed), so those views are ready before the user first opens them.
  // Deferred to idle: none of it is needed to paint, and running it in the
  // mount commit put four requests in front of the ones the visible view was
  // making at that same moment. Overlap with those is still free — apiRequest
  // dedupes identical in-flight GETs.
  useEffect(() => runWhenIdle(() => { prefetchApiData() }), [prefetchApiData])

  // Deliver any reports queued in a previous session. loadAccount also flushes
  // after login (to attach the token), but this covers a signed-out user whose
  // loadAccount returns early. No-op until the reporting endpoints exist.
  useEffect(() => { useStore.getState()._flushReports() }, [])

  return (
    <div className="app-shell flex flex-col h-dvh bg-surface overflow-hidden">
      {/* Sidebar stays first in the DOM; reverse variants place it visually
          on the right/bottom without reordering focus/tab order. */}
      <div className={`flex flex-1 overflow-hidden ${
        sidebarPosition === 'right' ? 'flex-row-reverse'
          : sidebarPosition === 'top' ? 'flex-col'
          : sidebarPosition === 'bottom' ? 'flex-col-reverse'
          : 'flex-row'
      }`}>
        <Sidebar />
        <main
          className="flex-1 overflow-hidden flex flex-col relative"
          // Reserve the phone status-bar inset by default; a mobile view that
          // wants a hero image to bleed full-bleed behind its own header (WRLD,
          // Playlists' detail screens) raises heroBleedTop and paints that
          // strip itself instead — see the store field's doc comment.
          style={sidebarPosition !== 'top' && !((activeView === 'wrld' || heroBleedTop) && !showSettings)
            ? { paddingTop: 'env(safe-area-inset-top, 0px)' } : undefined}
        >
          <div className="flex-1 overflow-hidden flex">
            <ErrorBoundary>
            <Suspense fallback={null}>
            {activeView === 'api-tracker' ? <ApiTrackerView />
              : activeView === 'api-files' ? <ApiFilesView />
              : activeView === 'editor' ? <EditorPage />
              : activeView === 'contributor' ? <ContributorPage />
              : activeView === 'contributor-profile' ? <ContributorProfileView />
              : activeView === 'admin' ? <AdminPage />
              : activeView === 'liked' ? <LikedSongsView />
              : activeView === 'playlists' ? <PlaylistsView />
              : activeView === 'shared-playlist' ? <SharedPlaylistView />
              : activeView === 'editor-profile' ? <EditorProfileView />
              : activeView === 'docs' ? <DocsPage />
              : activeView === 'wrld' ? <WrldView />
              : activeView === 'news' ? <NewsView />
              : activeView === 'heardle' ? <HeardleView />
              : activeView === 'wordle' ? <WordleView />
              : activeView === 'tierlist' ? <TierlistView />
              : activeView === 'stats' ? <StatsView />
              : activeView === 'download' ? <DownloadAppView />
              : activeView === 'albums-admin' ? <AlbumsAdminView />
              : activeView === 'not-found' ? <NotFoundView />
              : <ApiTrackerView />}
            </Suspense>
          </ErrorBoundary>
            {/* Desktop only — on mobile the WRLD tab is the only "now playing"
                screen (the mini player expands straight into it), so this
                would only ever be a redundant second one. Nothing on mobile
                can actually open it (its trigger button lives in the
                desktop-only bottom bar), but excluding it here is the real
                guarantee rather than relying on that. */}
            {!isMobile && showNowPlaying && activeView !== 'wrld' && <ErrorBoundary><NowPlaying /></ErrorBoundary>}
            {showQueue && activeView !== 'wrld' && <ErrorBoundary><QueuePanel /></ErrorBoundary>}
          </div>
        </main>
      </div>
      {/* Everything below is a loose sibling of the main content rather than a
          child of the pane boundary above, so an uncaught render error here
          used to unmount the entire app (a blank window). Each gets its own
          boundary: the chrome keeps a compact inline notice, the invisible
          background workers fail silently, and the modals/overlays show a
          centered, dismissible card. */}
      <ErrorBoundary fallback={<div className="h-20 shrink-0 border-t border-[var(--border)] flex items-center justify-center text-text-muted text-xs">Player crashed — reload the app to restore playback controls.</div>}>
        <Player />
      </ErrorBoundary>
      <ErrorBoundary fallback={null}><RadioFmPlayer /></ErrorBoundary>
      <ErrorBoundary fallback={null}><RadioVotePopup /></ErrorBoundary>
      <ErrorBoundary fallback={null}><LastfmScrobbler /></ErrorBoundary>
      <ErrorBoundary fallback={null}><NewsNotifier /></ErrorBoundary>
      <ErrorBoundary fallback={null}><BottomNav /></ErrorBoundary>
      {showSettings && (
        <ErrorBoundary variant="overlay" onDismiss={() => setShowSettings(false)}>
          <Suspense fallback={null}><Settings /></Suspense>
        </ErrorBoundary>
      )}
      {showDiagnostics && (
        <ErrorBoundary variant="overlay" onDismiss={() => setShowDiagnostics(false)}>
          <Suspense fallback={null}><DiagnosticsModal /></Suspense>
        </ErrorBoundary>
      )}
      {showUserAuth && (
        <ErrorBoundary variant="overlay" onDismiss={() => setShowUserAuth(false)}>
          <UserAuthModal onClose={() => setShowUserAuth(false)} />
        </ErrorBoundary>
      )}
      <ErrorBoundary variant="overlay"><ReportModal /></ErrorBoundary>
      <ErrorBoundary variant="overlay"><BulkEditModal /></ErrorBoundary>
      <ErrorBoundary fallback={null}><InstallPrompt /></ErrorBoundary>
      <ErrorBoundary fallback={null}><CookieNotice /></ErrorBoundary>
      <ErrorBoundary variant="overlay"><GlobalSongInfoHost /></ErrorBoundary>
      <ErrorBoundary fallback={null}><DownloadManager /></ErrorBoundary>
    </div>
  )
}
