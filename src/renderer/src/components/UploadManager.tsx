import { Upload, X, CheckCircle2, AlertCircle, Loader2, ArrowUpFromLine } from 'lucide-react'
import { useStorePick, UploadItem } from '../store/useStore'
import { formatBytes } from '../lib/format'
import { cancelCompUpload, cancelAllCompUploads } from '../lib/compUploads'
import { ModalOverlay, LockToggle } from './Modal'

// Triggered from the Uploads row in the side menu (see Sidebar.tsx) — this
// component only renders the panel itself.
export default function UploadManager(): JSX.Element {
  const { uploads, setShowUploadManager, clearCompletedUploads } = useStorePick('uploads', 'setShowUploadManager', 'clearCompletedUploads')

  const active = uploads.filter((d) => d.state === 'downloading').length

  return (
    <ModalOverlay
      onClose={() => setShowUploadManager(false)}
      zIndexClassName="z-[62]"
      panelClassName="bg-surface border border-[var(--border)] rounded-2xl shadow-2xl w-full max-w-[380px] h-[440px] max-h-[70vh]"
      minWidth={320} minHeight={280}
    >
      {({ onHandleMouseDown, locked, toggleLock }) => (
        <div className="bg-surface w-full h-full flex flex-col overflow-hidden">
          {/* Header */}
          <div
            className="flex items-center gap-2 px-4 py-3 bg-[var(--surface-overlay)] border-b border-[var(--border)] shrink-0 cursor-grab active:cursor-grabbing"
            onMouseDown={onHandleMouseDown}
          >
            <Upload size={14} className="text-accent shrink-0" />
            <span className="text-text-primary text-sm font-semibold flex-1">
              Uploads
              {active > 0
                ? <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-accent/20 text-accent text-[10px] font-medium">{active} active</span>
                : uploads.length > 0
                  ? <span className="ml-1 text-text-muted font-normal text-[10px]">· {uploads.length}</span>
                  : null}
            </span>
            {uploads.some(d => d.state !== 'downloading') && (
              <button onClick={clearCompletedUploads} className="text-[10px] text-text-muted hover:text-text-primary transition-colors px-1 rounded">
                Clear
              </button>
            )}
            {uploads.filter((d) => d.type === 'upload' && d.state === 'downloading').length > 1 && (
              <button onClick={cancelAllCompUploads} className="text-[10px] text-text-muted hover:text-red-400 transition-colors px-1 rounded">
                Cancel All
              </button>
            )}
            <LockToggle locked={locked} onClick={toggleLock} />
            <button onClick={() => setShowUploadManager(false)} className="text-text-muted hover:text-text-primary transition-colors">
              <X size={16} />
            </button>
          </div>
          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {uploads.length === 0 ? (
              <p className="text-text-muted text-xs text-center py-6">No uploads</p>
            ) : (
              <div className="divide-y divide-[var(--border)]/40">
                {uploads.map((item) => <UploadRow key={item.id} item={item} />)}
              </div>
            )}
          </div>
        </div>
      )}
    </ModalOverlay>
  )
}

function UploadRow({ item }: { item: UploadItem }): JSX.Element {
  const isDone = item.state === 'done'
  const isError = item.state === 'error' || item.state === 'cancelled'
  const isActive = item.state === 'downloading'
  const isUpload = item.type === 'upload'

  const sizeLabel = item.total && item.total > 0
    ? `${formatBytes(item.received ?? 0)} / ${formatBytes(item.total)}`
    : item.received ? formatBytes(item.received) : null

  const speedLabel = isActive && item.speedBps ? `${formatBytes(item.speedBps)}/s` : null

  return (
    <div className="px-4 py-2.5 hover:bg-[var(--surface-overlay)] transition-colors">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 shrink-0">
          {isDone ? <CheckCircle2 size={13} className="text-emerald-400" />
            : isError ? <AlertCircle size={13} className="text-red-400" />
            : isUpload ? <ArrowUpFromLine size={13} className="text-accent animate-pulse" />
            : <Loader2 size={13} className="text-accent animate-spin" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-text-primary text-xs truncate leading-snug" title={item.filename}>{item.filename}</p>
          {isActive && (sizeLabel || speedLabel) && (
            <p className="text-text-muted text-[10px] mt-0.5">
              {sizeLabel}{sizeLabel && speedLabel ? ' · ' : ''}{speedLabel}
            </p>
          )}
          {isError && item.error && <p className="text-red-400 text-[10px] mt-0.5 truncate">{item.error}</p>}
          {isActive && (
            <div className="mt-1.5 h-1 bg-[var(--surface-overlay)] rounded-full overflow-hidden">
              <div className="h-full bg-accent rounded-full transition-all duration-200" style={{ width: `${item.percent}%` }} />
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isActive && <span className="text-text-muted text-[10px]">{item.percent}%</span>}
          {isActive && isUpload && (
            <button onClick={() => cancelCompUpload(item.id)} title="Cancel upload"
              className="p-1 rounded hover:bg-[var(--surface-raised)] text-text-muted hover:text-red-400 transition-colors">
              <X size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
