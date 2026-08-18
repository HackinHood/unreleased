import { useEffect, useState } from 'react'
import {
  Loader2, CheckCircle, XCircle, RotateCcw, Download, Calendar, Hash, AlertCircle, ChevronLeft, ImageOff,
} from 'lucide-react'
import * as userApi from '../lib/userApi'
import type { CompFileProposal, ProposalStatus } from '../lib/userApi'
import { getToken } from '../lib/userApi'
import { relativeTime, shortDate, StatusChip, Empty } from './adminShared'
import { useBackToClose } from '../hooks/useBackToClose'
import { buildStreamUrl } from '../lib/juicewrldApi'
import { getMediaType } from '../lib/fileTypes'
import { formatBytes, formatDuration } from '../lib/format'

/** Loads a comp-admin route's bytes into an object URL — the staging file
 *  isn't public like a live comp/ path, so it needs the same authed fetch
 *  downloadStaging already uses, just kept in memory instead of saved to
 *  disk. Torn down (URL revoked) on unmount or when the source URL changes,
 *  since a leaked object URL pins the blob in memory for the page's life. */
function useAuthedBlobUrl(url: string | null): { src: string | null; loading: boolean; error: boolean; bytes: number | null } {
  const [state, setState] = useState<{ src: string | null; loading: boolean; error: boolean; bytes: number | null }>(
    { src: null, loading: !!url, error: false, bytes: null },
  )
  useEffect(() => {
    if (!url) { setState({ src: null, loading: false, error: false, bytes: null }); return }
    let cancelled = false
    let objectUrl: string | null = null
    setState({ src: null, loading: true, error: false, bytes: null })
    const token = getToken()
    fetch(url, { headers: token ? { Authorization: `Token ${token}` } : {} })
      .then((r) => { if (!r.ok) throw new Error(); return r.blob() })
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setState({ src: objectUrl, loading: false, error: false, bytes: blob.size })
      })
      .catch(() => { if (!cancelled) setState({ src: null, loading: false, error: true, bytes: null }) })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [url])
  return state
}

/** One preview slot — a live comp/ path (plain <img>/<audio> against the
 *  public download URL, same as FilePickerModal's thumbnails) or an authed
 *  blob (the staged file, not yet part of comp/). Anything that isn't audio
 *  or an image (a tracklist .txt, a folder) renders nothing — the JSON
 *  snapshot below already covers non-media proposals. */
function MediaPreview({ label, name, src, loading, error, bytes }: {
  label: string
  name: string
  src: string | null
  loading?: boolean
  error?: boolean
  bytes?: number | null
}): JSX.Element | null {
  const mediaType = getMediaType(name)
  const [meta, setMeta] = useState<string | null>(null)
  const [broken, setBroken] = useState(false)
  useEffect(() => { setMeta(null); setBroken(false) }, [src])

  if (mediaType !== 'image' && mediaType !== 'audio') return null

  const failed = error || broken || (!loading && !src)
  const sizeLabel = bytes != null ? formatBytes(bytes) : null

  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5">{label}</p>
      {loading ? (
        <div className="h-20 rounded-lg bg-surface-overlay flex items-center justify-center">
          <Loader2 size={16} className="animate-spin text-text-muted" />
        </div>
      ) : failed ? (
        <div className="h-20 rounded-lg bg-surface-overlay flex flex-col items-center justify-center gap-1 text-text-muted">
          <ImageOff size={16} className="opacity-50" />
          <span className="text-[10px]">Preview unavailable</span>
        </div>
      ) : mediaType === 'image' ? (
        <img
          src={src ?? undefined}
          alt=""
          onLoad={(e) => setMeta(`${e.currentTarget.naturalWidth}×${e.currentTarget.naturalHeight}`)}
          onError={() => setBroken(true)}
          className="max-h-56 max-w-full rounded-lg border border-[var(--border)] object-contain bg-surface-overlay"
        />
      ) : (
        <audio
          controls
          src={src ?? undefined}
          preload="metadata"
          onLoadedMetadata={(e) => setMeta(formatDuration(e.currentTarget.duration))}
          onError={() => setBroken(true)}
          className="w-full h-9"
        />
      )}
      {(meta || sizeLabel) && !failed && !loading && (
        <p className="text-[10px] text-text-muted mt-1">{[meta, sizeLabel].filter(Boolean).join(' · ')}</p>
      )}
    </div>
  )
}

export default function CompProposalsTab({ embedded = false, onChanged }: { embedded?: boolean; onChanged?: () => void }): JSX.Element {
  const [status, setStatus] = useState<ProposalStatus | ''>('pending')
  const [proposals, setProposals] = useState<CompFileProposal[]>([])
  const [selected, setSelected] = useState<CompFileProposal | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<number | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    userApi.adminListCompProposals(status || undefined)
      .then(rows => {
        setProposals(rows)
        // Reviewing a proposal reloads the list and moves the selection, so
        // the notes box has to reset with it — otherwise the text typed for
        // the proposal just approved rides along into the next Approve.
        setSelected(rows[0] ?? null)
        setReviewNotes('')
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [status, refreshKey])

  const reload = (): void => {
    setRefreshKey(k => k + 1)
    onChanged?.()
  }

  const doReview = async (id: number, action: 'approve' | 'reject'): Promise<void> => {
    setActionId(id)
    setError(null)
    try {
      await userApi.adminReviewCompProposal(id, { action, review_notes: reviewNotes })
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : `Could not ${action} this proposal`)
    } finally {
      setActionId(null)
    }
  }

  const doReverse = async (id: number): Promise<void> => {
    setActionId(id)
    setError(null)
    try {
      await userApi.adminReverseCompProposal(id)
      reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reverse this proposal')
    } finally {
      setActionId(null)
    }
  }

  const downloadStaging = (p: CompFileProposal): void => {
    const token = getToken()
    const url = userApi.adminCompProposalStagingUrl(p.id)
    fetch(url, { headers: token ? { Authorization: `Token ${token}` } : {} })
      .then(r => r.blob())
      .then(blob => {
        const href = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = href
        a.download = p.staging_filename || 'staged-file'
        // Anchor has to be in the document for the click to count in some
        // browsers, and the object URL has to outlive the click — revoking it
        // on the same tick cancels the download before it starts.
        document.body.appendChild(a)
        a.click()
        a.remove()
        setTimeout(() => URL.revokeObjectURL(href), 60_000)
      })
      .catch(() => {})
  }

  // The proposed file only exists in staging while the proposal is pending
  // (approval moves it into comp/, rejection discards it) — matches the same
  // condition the existing "Staged file" download button already gates on.
  const stagingUrl = selected && selected.staging_filename && selected.status === 'pending'
    ? userApi.adminCompProposalStagingUrl(selected.id)
    : null
  const staged = useAuthedBlobUrl(stagingUrl)

  const p = selected

  useBackToClose(() => setSelected(null), p != null)

  if (p) return (
    <div className={`flex-1 min-w-0 h-full flex flex-col overflow-hidden ${embedded ? '' : 'bg-[var(--surface)]'}`}>
      <div className="shrink-0 flex items-center gap-1 px-2 py-1.5 border-b border-[var(--border)]">
        <button onClick={() => setSelected(null)}
          className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full text-text-primary active:bg-surface-overlay transition-colors">
          <ChevronLeft size={20} />
        </button>
        <h2 className="flex-1 min-w-0 truncate text-text-primary text-[14px] font-bold font-mono">{p.file_path}</h2>
        <StatusChip status={p.status} />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-text-muted bg-surface-overlay px-2 py-0.5 rounded font-semibold">{p.change_type}</span>
          <span className="text-xs text-text-muted">by {p.contributor_username}</span>
          <span className="flex items-center gap-1 text-xs text-text-muted"><Calendar size={10} />{shortDate(p.created_at)}</span>
          {p.applied_commit_id && <span className="flex items-center gap-1 text-xs text-text-muted"><Hash size={10} />{p.applied_commit_id}</span>}
        </div>

        {p.change_type === 'move' && p.destination_path && (
          <p className="text-text-muted font-mono text-sm break-all">→ {p.destination_path}</p>
        )}

        {/* "Current" is the file already in comp/ — meaningful context for a
            replace, move, or delete (what's about to change or vanish), and
            for a plain upload it's simply not there yet, so the public fetch
            404s and the slot quietly shows "unavailable". */}
        <div className="grid grid-cols-1 gap-3">
          <MediaPreview label="Current file" name={p.file_path} src={buildStreamUrl(p.file_path)} />
          {p.staging_filename && (
            <MediaPreview
              label="Proposed file"
              name={p.staging_filename}
              src={staged.src}
              loading={p.status === 'pending' && staged.loading}
              error={p.status !== 'pending' || staged.error}
              bytes={staged.bytes}
            />
          )}
        </div>

        {p.staging_filename && p.status === 'pending' && (
          <button onClick={() => downloadStaging(p)}
            className="w-full h-10 rounded-lg text-sm text-text-secondary active:bg-surface-raised border border-[var(--border)] flex items-center justify-center gap-1.5">
            <Download size={14} /> Staged file
          </button>
        )}

        {p.contributor_notes && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Contributor notes</p>
            <p className="text-text-secondary text-sm whitespace-pre-wrap">{p.contributor_notes}</p>
          </div>
        )}
        {Object.keys(p.original_snapshot || {}).length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Original snapshot</p>
            <pre className="text-xs font-mono text-text-muted bg-surface-overlay rounded-lg p-3 overflow-x-auto">{JSON.stringify(p.original_snapshot, null, 2)}</pre>
          </div>
        )}
        {p.review_notes && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Review notes</p>
            <p className="text-text-secondary text-sm whitespace-pre-wrap">{p.review_notes}</p>
          </div>
        )}

        {p.status === 'pending' && (
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Review note</label>
            <textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} rows={3} placeholder="Optional…"
              className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-surface-overlay px-3 py-2.5 text-sm text-text-primary focus:outline-none resize-none" />
          </div>
        )}

        {error && (
          <p className="text-xs text-red-400 flex items-center gap-1.5"><AlertCircle size={12} />{error}</p>
        )}
      </div>

      <div className="shrink-0 p-3 border-t border-[var(--border)] flex items-center gap-2">
        {actionId === p.id ? (
          <div className="flex-1 flex justify-center py-2.5"><Loader2 size={16} className="animate-spin text-text-muted" /></div>
        ) : p.status === 'pending' ? (
          <>
            <button onClick={() => doReview(p.id, 'reject')}
              className="flex-1 h-11 rounded-xl bg-red-500/10 active:bg-red-500/20 text-red-400 text-sm font-semibold flex items-center justify-center gap-1.5">
              <XCircle size={15} /> Reject
            </button>
            <button onClick={() => doReview(p.id, 'approve')}
              className="flex-1 h-11 rounded-xl bg-emerald-500/15 active:bg-emerald-500/25 text-emerald-400 text-sm font-semibold flex items-center justify-center gap-1.5">
              <CheckCircle size={15} /> Approve
            </button>
          </>
        ) : p.status === 'approved' ? (
          <button onClick={() => doReverse(p.id)} disabled={actionId === p.id}
            className="w-full h-11 rounded-xl text-sm text-text-muted active:text-amber-400 active:bg-amber-500/10 flex items-center justify-center gap-1.5">
            <RotateCcw size={15} /> Reverse
          </button>
        ) : null}
      </div>
    </div>
  )

  return (
    <div className={`flex-1 min-w-0 h-full flex flex-col overflow-hidden ${embedded ? '' : 'bg-[var(--surface)]'}`}>
      <div className="shrink-0 p-3 border-b border-[var(--border)] flex gap-2 overflow-x-auto scrollbar-none">
        {(['pending', 'approved', 'rejected', 'reversed', ''] as const).map(s => (
          <button key={s || 'all'} onClick={() => setStatus(s)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${status === s ? 'bg-accent/15 text-accent' : 'text-text-muted bg-surface-overlay'}`}>
            {s || 'all'}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && <div className="flex justify-center py-8"><Loader2 className="animate-spin text-text-muted" size={18} /></div>}
        {!loading && proposals.length === 0 && <Empty label="No comp proposals" />}
        {proposals.map(item => (
          <button key={item.id} onClick={() => { setSelected(item); setReviewNotes(''); setError(null) }}
            className="w-full text-left px-3 py-3 border-b border-[var(--border)] transition-colors active:bg-surface-raised">
            <div className="flex items-center gap-1.5 mb-1">
              <StatusChip status={item.status} />
              <span className="text-[9px] text-text-muted bg-surface-raised px-1.5 py-0.5 rounded">{item.change_type}</span>
            </div>
            <p className="text-[12px] font-mono text-text-primary truncate">{item.file_path}</p>
            {item.change_type === 'move' && item.destination_path && (
              <p className="text-[10px] font-mono text-text-muted truncate">→ {item.destination_path}</p>
            )}
            <p className="text-[10px] text-text-muted truncate">{item.contributor_username} · {relativeTime(item.created_at)}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
