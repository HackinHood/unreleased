import { useState, useEffect } from 'react'
import { useResizablePanel } from '../hooks/useResizablePanel'
import { X, Music, ChevronUp, ChevronDown, Pencil, Info } from 'lucide-react'
import { useStore, useStorePick } from '../store/useStore'
import LyricsDisplay from './LyricsDisplay'
import SongInfoModal from './SongInfoModal'
import { apiFetch, smallCoverUrl, JWApiSong } from '../lib/juicewrldApi'
import { ProgressiveCover } from './ProgressiveCover'

export default function NowPlaying(): JSX.Element {
  const {
    currentTrack,
    currentTrackFull,
    setShowNowPlaying,
    account,
    setPendingEditorSongId,
    setActiveView,
  } = useStorePick('currentTrack', 'currentTrackFull', 'setShowNowPlaying', 'account', 'setPendingEditorSongId', 'setActiveView')

  const [artCollapsed, setArtCollapsed] = useState(false)
  const [panelWidth, dragHandle] = useResizablePanel(360, 280, 520)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  const [infoSong, setInfoSong] = useState<JWApiSong | null>(null)
  const [loadingInfo, setLoadingInfo] = useState(false)

  useEffect(() => {
    const check = (): void => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => { setInfoSong(null) }, [currentTrack?.id])

  const handleInfo = async (): Promise<void> => {
    const jwMatch = currentTrack?.id.match(/^jw-(\d+)$/)
    if (!jwMatch) return
    setLoadingInfo(true)
    try {
      const song = await apiFetch<JWApiSong>(`/songs/${jwMatch[1]}/`)
      setInfoSong(song)
    } catch { /* silently fail */ }
    finally { setLoadingInfo(false) }
  }

  const jwMatch = currentTrack?.id.match(/^jw-(\d+)$/)
  const canEdit = !!account?.is_editor

  return (
    <div
      className="bg-surface-raised flex shrink-0 overflow-hidden animate-slide-in-right"
      style={isMobile
        ? { position: 'fixed', inset: 0, zIndex: 50 }
        : { width: panelWidth, borderLeft: '1px solid var(--border)' }
      }
    >
      {!isMobile && (
        <div className="w-1 shrink-0 relative group/handle" {...dragHandle}>
          <div className="absolute inset-y-0 -left-1 -right-1 group-hover/handle:bg-accent/30 transition-colors rounded-full" />
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <div className="flex items-center justify-between px-5 pb-3 pt-5 shrink-0">
          <h2 className="text-text-primary font-semibold text-sm uppercase tracking-widest truncate min-w-0">Now Playing</h2>
          <div className="flex items-center gap-2 shrink-0">
            {currentTrack && (
              <button
                onClick={() => setArtCollapsed(!artCollapsed)}
                className="text-text-muted hover:text-text-primary transition-colors"
                title={artCollapsed ? 'Show artwork' : 'Hide artwork'}
              >
                {artCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              </button>
            )}
            {jwMatch && (
              <button
                onClick={handleInfo}
                disabled={loadingInfo}
                className="text-text-muted hover:text-text-primary transition-colors disabled:opacity-40"
                title="Song info"
              >
                <Info size={16} />
              </button>
            )}
            {jwMatch && canEdit && (
              <button
                onClick={() => useStore.getState().openSongEditor(parseInt(jwMatch[1]))}
                className="text-text-muted hover:text-text-primary transition-colors"
                title="Edit this song"
              >
                <Pencil size={15} />
              </button>
            )}
            <button
              onClick={() => setShowNowPlaying(false)}
              className="text-text-muted hover:text-text-primary transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {!currentTrack ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-8">
            <div className="w-24 h-24 rounded-full bg-surface-overlay flex items-center justify-center">
              <Music className="text-text-muted w-10 h-10" />
            </div>
            <p className="text-text-muted text-sm text-center">Play a track to see it here</p>
          </div>
        ) : (
          <>
            {(() => {
              const artSrc = currentTrackFull?.albumArt ?? currentTrack.imageUrl
              return !artCollapsed && (
                <div className="px-6 shrink-0">
                  <div className={`${isMobile ? 'h-48' : 'aspect-square'} w-full rounded-xl overflow-hidden bg-surface-overlay shadow-2xl`}>
                    {artSrc ? (
                      <ProgressiveCover src={artSrc} alt="Album Art" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Music className="text-text-muted w-16 h-16" />
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}
            {(() => {
              const artSrc = currentTrackFull?.albumArt ?? currentTrack.imageUrl
              return (
                <div className={`px-6 shrink-0 ${artCollapsed ? 'pt-2 pb-3' : 'py-3'}`}>
                  {artCollapsed && (
                    <div className="flex gap-3 items-center mb-3">
                      {artSrc && <img src={smallCoverUrl(artSrc)} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-text-primary font-bold text-base truncate" title={currentTrack.title}>{currentTrack.title}</p>
                        <p className="text-text-muted text-xs truncate">{currentTrack.artist}</p>
                      </div>
                    </div>
                  )}
                  {!artCollapsed && (
                    <>
                      <p className="text-text-primary font-bold text-lg truncate" title={currentTrack.title}>{currentTrack.title}</p>
                      <p className="text-text-muted text-sm truncate mt-0.5">{currentTrack.artist}</p>
                      <p className="text-text-muted text-xs truncate mt-0.5">{currentTrack.album}</p>
                    </>
                  )}
                </div>
              )
            })()}
            <div className="flex-1 min-h-0 overflow-hidden">
              <LyricsDisplay />
            </div>
          </>
        )}
      </div>

      {infoSong && (
        <SongInfoModal
          song={infoSong}
          onClose={() => setInfoSong(null)}
          onEdit={canEdit ? (songId) => {
            setInfoSong(null)
            setPendingEditorSongId(songId)
            setActiveView('editor')
          } : undefined}
        />
      )}
    </div>
  )
}
