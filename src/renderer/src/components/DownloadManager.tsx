import { useEffect, useRef } from 'react'
import { Download, X, CheckCircle2, AlertCircle, Loader2, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react'
import { useStorePick, DownloadItem } from '../store/useStore'
import { formatBytes } from '../lib/format'
import { cancelCompUpload } from '../lib/compUploads'
import { useIsMobile } from '../hooks/useIsMobile'

export default function DownloadManager(): JSX.Element | null {
  const { downloads, showDownloadManager, setShowDownloadManager, clearCompletedDownloads, wrldFullscreen } = useStorePick('downloads', 'showDownloadManager', 'setShowDownloadManager', 'clearCompletedDownloads', 'wrldFullscreen')
  const panelRef = useRef<HTMLDivElement>(null)
  // Fixed-positioned next to the desktop title bar's window-control buttons
  // (right: 144px below) — there's no such row on mobile, and ContributorPage
  // already mirrors upload progress inline for exactly that reason.
  const isMobile = useIsMobile()

  // Close panel on outside click
  useEffect(() => {
    if (!showDownloadManager) return
    const handler = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setShowDownloadManager(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showDownloadManager])

  // WRLD's immersive fullscreen hides the window-control buttons this
  // trigger is anchored next to (see App.tsx / WrldView.tsx) — with no
  // corner reference left, it just floats awkwardly, so hide it too.
  if (wrldFullscreen || isMobile) return null

  const active = downloads.filter((d) => d.state === 'downloading').length
  const hasDownloads = downloads.length > 0

  return (
    <div ref={panelRef} className="fixed top-0 z-[9990]" style={{ right: '144px' }}>
      {/* Trigger icon */}
      <button
        onClick={() => setShowDownloadManager(!showDownloadManager)}
        className={`flex items-center justify-center w-9 h-7 transition-colors ${
          active > 0 ? 'text-[var(--accent)]' : hasDownloads ? 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]' : 'text-[var(--titlebar-icon,var(--text-muted))] hover:text-[var(--titlebar-icon-hover,var(--text-secondary))]'
        }`}
        title="Downloads"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <div className="relative">
          <ArrowDownToLine size={14} className={active > 0 ? 'animate-pulse' : ''} />
          {active > 0 && (
            <span className="absolute -top-1.5 -right-2 min-w-[14px] h-[14px] rounded-full bg-[var(--accent)] text-white text-[9px] font-bold flex items-center justify-center px-0.5 leading-none">
              {active}
            </span>
          )}
        </div>
      </button>

      {/* Dropdown panel */}
      {showDownloadManager && (
        <div className="absolute top-full right-0 mt-1 w-[320px] rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-2.5 bg-[var(--surface-overlay)] border-b border-[var(--border)]">
            <Download size={13} className="text-[var(--accent)] shrink-0" />
            <span className="text-[var(--text-primary)] text-xs font-semibold flex-1">
              Downloads
              {active > 0
                ? <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-[var(--accent)]/20 text-[var(--accent)] text-[10px] font-medium">{active} active</span>
                : downloads.length > 0
                  ? <span className="ml-1 text-[var(--text-muted)] font-normal text-[10px]">· {downloads.length}</span>
                  : null}
            </span>
            {downloads.some(d => d.state !== 'downloading') && (
              <button onClick={clearCompletedDownloads} className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors px-1 rounded">
                Clear
              </button>
            )}
            <button onClick={() => setShowDownloadManager(false)} className="p-0.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
              <X size={13} />
            </button>
          </div>
          {/* List */}
          <div className="max-h-72 overflow-y-auto">
            {downloads.length === 0 ? (
              <p className="text-[var(--text-muted)] text-xs text-center py-6">No downloads</p>
            ) : (
              <div className="divide-y divide-[var(--border)]/40">
                {downloads.map((item) => <DownloadRow key={item.id} item={item} />)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function DownloadRow({ item }: { item: DownloadItem }): JSX.Element {
  const isDone = item.state === 'done'
  const isError = item.state === 'error' || item.state === 'cancelled'
  const isActive = item.state === 'downloading'
  const isUpload = item.type === 'upload'

  const sizeLabel = item.total && item.total > 0
    ? `${formatBytes(item.received ?? 0)} / ${formatBytes(item.total)}`
    : item.received ? formatBytes(item.received) : null

  const speedLabel = isActive && item.speedBps ? `${formatBytes(item.speedBps)}/s` : null

  return (
    <div className="px-3 py-2.5 hover:bg-[var(--surface-overlay)] transition-colors">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 shrink-0">
          {isDone ? <CheckCircle2 size={13} className="text-emerald-400" />
            : isError ? <AlertCircle size={13} className="text-red-400" />
            : isUpload ? <ArrowUpFromLine size={13} className="text-[var(--accent)] animate-pulse" />
            : <Loader2 size={13} className="text-[var(--accent)] animate-spin" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[var(--text-primary)] text-xs truncate leading-snug" title={item.filename}>{item.filename}</p>
          {isActive && (sizeLabel || speedLabel) && (
            <p className="text-[var(--text-muted)] text-[10px] mt-0.5">
              {sizeLabel}{sizeLabel && speedLabel ? ' · ' : ''}{speedLabel}
            </p>
          )}
          {isError && item.error && <p className="text-red-400 text-[10px] mt-0.5 truncate">{item.error}</p>}
          {isActive && (
            <div className="mt-1.5 h-1 bg-[var(--surface-overlay)] rounded-full overflow-hidden">
              <div className="h-full bg-[var(--accent)] rounded-full transition-all duration-200" style={{ width: `${item.percent}%` }} />
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isActive && <span className="text-[var(--text-muted)] text-[10px]">{item.percent}%</span>}
          {isActive && isUpload && (
            <button onClick={() => cancelCompUpload(item.id)} title="Cancel upload"
              className="p-1 rounded hover:bg-[var(--surface-raised)] text-[var(--text-muted)] hover:text-red-400 transition-colors">
              <X size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
