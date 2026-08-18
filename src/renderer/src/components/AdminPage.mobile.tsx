import { useEffect, useState, useCallback, useMemo, useDeferredValue, memo } from 'react'
import {
  ChevronLeft, Users, Clock, CheckCircle, XCircle, ShieldCheck, BarChart2,
  Loader2, RefreshCw, FileEdit, KeyRound, Check, AlertCircle, RotateCcw,
  ChevronDown, ChevronUp, Shield, TrendingUp, MessageSquare, Calendar,
  Hash, Minus, Plus, UserCheck, FileCheck, Activity, Pencil, X as XIcon, ChevronDown as ChevronDownIcon,
  Flag, Play, History,
} from 'lucide-react'
import { useStore, useStorePick } from '../store/useStore'
import * as userApi from '../lib/userApi'
import type { EditorApplication, SongEditProposal, AdminUser, ProposalStatus } from '../lib/userApi'
import * as reportsApi from '../lib/reportsApi'
import type { SongReportRow, SongReportStatus } from '../lib/reportsApi'
import { invalidateLyricsCache } from './Player'
import { apiFetch, songToTrack } from '../lib/juicewrldApi'
import type { JWApiSong } from '../lib/juicewrldApi'
import {
  relativeTime, shortDate, STATUS_STYLE, StatusChip, Avatar, Empty, AppSection,
  buildHaystack, matchesHaystack, QueueSearch,
} from './adminShared'
import ReportsTab from './ReportsTab.mobile'
import CompProposalsTab from './CompProposalsTab.mobile'
import { CONTRIBUTOR_ENABLED } from '../lib/userApi'
import { useBackToClose } from '../hooks/useBackToClose'

type Tab = 'proposals' | 'comp-proposals' | 'applications' | 'reports' | 'users' | 'stats' | 'security'

// ── Utilities ─────────────────────────────────────────────────────────────────

function renderValue(v: unknown): string {
  if (v == null || v === '') return '(empty)'
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v.length ? v.join('\n') : '(empty)'
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  return JSON.stringify(v, null, 2)
}

const LONG_KEYS = new Set(['lyrics', 'synced_lyrics', 'description', 'notes', 'additional_information'])
const LONG_THRESHOLD = 200

// ── Diff ──────────────────────────────────────────────────────────────────────

function FieldDiff({ fieldKey, before, after }: { fieldKey: string; before: unknown; after: unknown }): JSX.Element {
  const beforeStr = renderValue(before)
  const afterStr  = renderValue(after)
  const unchanged = beforeStr === afterStr
  const isLong    = LONG_KEYS.has(fieldKey) || beforeStr.length > LONG_THRESHOLD || afterStr.length > LONG_THRESHOLD
  // synced_lyrics is LRC — default expanded so content is visible immediately
  const [exp, setExp] = useState(!isLong || fieldKey === 'synced_lyrics')
  const MAX = fieldKey === 'synced_lyrics' ? 60 : 8

  const sliceLong = (s: string) => {
    const lines = s.split('\n')
    if (exp || lines.length <= MAX) return { lines, clipped: false }
    return { lines: lines.slice(0, MAX), clipped: true, total: lines.length }
  }

  const b = sliceLong(beforeStr)
  const a = sliceLong(afterStr)
  const hasBefore = before !== undefined && !unchanged
  const sideBySide = hasBefore && !unchanged

  return (
    <div className="rounded-lg overflow-hidden border border-[var(--border)] text-[11px]">
      {/* Field header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-surface-raised border-b border-[var(--border)]">
        <span className="font-mono text-[10px] text-text-muted tracking-tight">{fieldKey.replace(/_/g, ' ')}</span>
        <div className="flex items-center gap-2">
          {unchanged && <span className="text-[9px] italic text-text-muted">unchanged</span>}
          {isLong && (
            <button onClick={() => setExp(e => !e)} className="text-[10px] text-accent/70 active:text-accent">
              {exp ? 'collapse' : 'expand'}
            </button>
          )}
        </div>
      </div>

      {/* Before / after — stacked, not side-by-side (a phone-width column each
          would leave both unreadable). */}
      {sideBySide && (
        <div className="grid grid-cols-1 divide-y divide-[var(--border)]">
          {/* Before */}
          <div className="bg-red-500/8 min-w-0">
            <div className="flex items-center gap-1.5 px-3 py-1 border-b border-red-500/15">
              <Minus size={9} className="text-red-500 shrink-0" />
              <span className="text-[9px] font-bold uppercase tracking-wide text-red-500">Before</span>
            </div>
            <div className="px-3 py-2">
              {b.lines.map((line, i) => (
                <pre key={i} className="font-mono text-red-500 whitespace-pre-wrap break-words leading-relaxed">{line || ' '}</pre>
              ))}
              {'clipped' in b && b.clipped && (
                <p className="text-[9px] text-red-400 italic mt-1">+{(b as { total?: number }).total! - MAX} more lines</p>
              )}
            </div>
          </div>

          {/* After */}
          <div className="bg-emerald-500/8 min-w-0">
            <div className="flex items-center gap-1.5 px-3 py-1 border-b border-emerald-500/15">
              <Plus size={9} className="text-emerald-600 shrink-0" />
              <span className="text-[9px] font-bold uppercase tracking-wide text-emerald-600">After</span>
            </div>
            <div className="px-3 py-2">
              {a.lines.map((line, i) => (
                <pre key={i} className="font-mono text-emerald-600 whitespace-pre-wrap break-words leading-relaxed">{line || ' '}</pre>
              ))}
              {'clipped' in a && a.clipped && (
                <p className="text-[9px] text-emerald-500 italic mt-1">+{(a as { total?: number }).total! - MAX} more lines</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New value only (no snapshot) */}
      {!unchanged && !hasBefore && (
        <div className="bg-emerald-500/8">
          <div className="flex items-center gap-1.5 px-3 py-1 border-b border-emerald-500/15">
            <Plus size={9} className="text-emerald-600 shrink-0" />
            <span className="text-[9px] font-bold uppercase tracking-wide text-emerald-600">Value</span>
          </div>
          <div className="px-3 py-2">
            {a.lines.map((line, i) => (
              <pre key={i} className="font-mono text-emerald-600 whitespace-pre-wrap break-words leading-relaxed">{line || ' '}</pre>
            ))}
          </div>
        </div>
      )}

      {/* Unchanged */}
      {unchanged && (
        <div className="px-3 py-2">
          <pre className="font-mono text-text-muted whitespace-pre-wrap break-words leading-relaxed">
            {exp ? afterStr : afterStr.slice(0, 120) + (afterStr.length > 120 ? '…' : '')}
          </pre>
        </div>
      )}
    </div>
  )
}

function ProposalDiff({ proposal }: { proposal: SongEditProposal }): JSX.Element {
  const entries = Object.entries(proposal.proposed_data || {})
  if (!entries.length) return <p className="text-text-muted text-xs italic p-4">No field data.</p>
  const snap = proposal.original_snapshot || {}
  return (
    <div className="space-y-2 p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-3">
        Changes · {entries.length} field{entries.length !== 1 ? 's' : ''}
      </p>
      {entries.map(([k, v]) => <FieldDiff key={k} fieldKey={k} before={snap[k]} after={v} />)}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

// `embedded` renders the page as a panel inside another view (the editor
// profile's Admin tab) — no back button, page title, or window-control
// clearance, since the host view owns that chrome.
export default function AdminPage({ embedded = false }: { embedded?: boolean }): JSX.Element {
  const { account, setActiveView, loadAccount } = useStorePick('account', 'setActiveView', 'loadAccount')
  // The header's rightmost controls (refresh + tabs) sit at the same corner
  // as the custom frameless-window buttons (see WindowControls in App.tsx,
  // fixed top-right). Without extra clearance they render underneath them —
  const isAdmin    = !!account?.is_administrator
  // is_manager grants no admin power beyond reviewing comp-file proposals —
  // everything else on this page (song edits, applications, users, stats,
  // security) stays isAdmin-only. managerOnly narrows the page down to just
  // that one tab instead of the full admin console.
  const isManager    = !!account?.is_manager
  const managerOnly  = isManager && !isAdmin
  const otpEnabled = !!account?.otp_enabled

  const [tab,          setTab]          = useState<Tab>(managerOnly ? 'comp-proposals' : 'proposals')
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [refreshKey,   setRefreshKey]   = useState(0)
  const [applications, setApplications] = useState<EditorApplication[]>([])
  const [propStatus,   setPropStatus]   = useState<ProposalStatus | ''>('pending')
  const [proposals,    setProposals]    = useState<SongEditProposal[]>([])
  const [users,        setUsers]        = useState<AdminUser[]>([])
  const [reportStatus, setReportStatus] = useState<SongReportStatus | ''>('pending')
  const [reports,      setReports]      = useState<SongReportRow[]>([])

  const load = useCallback(async () => {
    if (!isAdmin) return
    setLoading(true); setError(null)
    try {
      if (tab === 'proposals') {
        setProposals(await userApi.adminListProposals(propStatus || undefined))
      } else if (tab === 'applications') {
        setApplications(await userApi.adminListApplications())
      } else if (tab === 'reports') {
        setReports(await reportsApi.listSongReports(reportStatus || undefined))
      } else if (tab === 'users' || tab === 'stats') {
        setUsers(await userApi.adminListUsers())
        if (tab === 'stats') {
          setApplications(await userApi.adminListApplications())
          setProposals(await userApi.adminListProposals())
        }
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load') }
    finally { setLoading(false) }
  }, [tab, isAdmin, propStatus, reportStatus])

  useEffect(() => { load() }, [load, refreshKey])

  // account can still be loading when this page first mounts (deep link,
  // page refresh) — managerOnly flips from false to true once it lands, and
  // the tab set at mount time (still 'proposals') would otherwise strand a
  // manager on a tab their nav bar no longer offers a button for.
  useEffect(() => {
    if (managerOnly && tab !== 'comp-proposals') setTab('comp-proposals')
  }, [managerOnly, tab])

  if (!isAdmin && !isManager) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
      <Shield size={28} className="text-text-muted" />
      <p className="text-text-primary font-semibold text-sm">Admins only</p>
      <button onClick={() => setActiveView('api-tracker')} className="text-xs text-accent active:underline">Go back</button>
    </div>
  )

  if (!otpEnabled) return (
    <div className="flex-1 overflow-y-auto flex items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <OtpSetupPanel onEnabled={async () => { await loadAccount() }} />
      </div>
    </div>
  )

  const pendingApps    = applications.filter(a => a.status === 'pending').length
  const pendingProps   = tab !== 'proposals' ? proposals.filter(p => p.status === 'pending').length : 0
  const pendingReports = tab !== 'reports' ? reports.filter(r => r.status === 'pending').length : 0

  type NavItem = { id: Tab; label: string; icon: React.ReactNode; badge?: number }
  const nav: NavItem[] = managerOnly ? [
    { id: 'comp-proposals', label: 'Comp files', icon: <FileCheck size={13} /> },
  ] : [
    { id: 'proposals',    label: 'Song edits',   icon: <FileEdit size={13} />,   badge: pendingProps || undefined },
    ...(CONTRIBUTOR_ENABLED ? [{ id: 'comp-proposals' as const, label: 'Comp files', icon: <FileCheck size={13} /> }] : []),
    { id: 'applications', label: 'Applications', icon: <Clock size={13} />,      badge: pendingApps || undefined },
    { id: 'reports',      label: 'Reports',      icon: <Flag size={13} />,       badge: pendingReports || undefined },
    { id: 'users',        label: 'Users',        icon: <Users size={13} /> },
    { id: 'stats',        label: 'Stats',        icon: <TrendingUp size={13} /> },
    { id: 'security',     label: 'Security',     icon: <Shield size={13} /> },
  ]

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className={`shrink-0 ${embedded ? 'px-3 pt-1' : 'px-2 pt-1'}`}>
        <div className="flex items-center gap-1">
          {!embedded && (
            <button onClick={() => setActiveView('api-tracker')}
              className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full text-text-primary active:bg-surface-overlay transition-colors">
              <ChevronLeft size={20} />
            </button>
          )}
          {!embedded && (
            <div className="flex-1 min-w-0 pl-1.5">
              <h1 className="text-text-primary text-[20px] font-bold leading-tight truncate">{managerOnly ? 'Manager' : 'Admin'}</h1>
              {account?.discord_username && <p className="text-text-muted text-xs truncate">{account.discord_username}</p>}
            </div>
          )}
          {embedded && <div className="flex-1" />}
          <button onClick={() => setRefreshKey(k => k + 1)} disabled={loading}
            className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full text-text-muted active:bg-surface-overlay transition-colors disabled:opacity-40">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Tabs — scrollable pill row rather than underline tabs, which don't
            fit six of them at once on a phone width. */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-2 pt-1">
          {nav.map(n => (
            <button key={n.id} onClick={() => setTab(n.id)}
              className={`shrink-0 flex items-center gap-1.5 h-9 px-3.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap ${
                tab === n.id ? 'bg-accent text-white' : 'bg-[var(--surface-overlay)] text-text-muted'
              }`}>
              {n.icon}
              {n.label}
              {n.badge ? (
                <span className={`text-[9px] font-bold rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1 ${
                  tab === n.id ? 'bg-white/25' : 'bg-accent text-[var(--bg)]'
                }`}>
                  {n.badge > 9 ? '9+' : n.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mx-3 mb-2 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs shrink-0">
          <AlertCircle size={13} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {/* The tab body stays mounted through a reload (switching the reports/
          proposals status filter, hitting refresh, etc.) instead of being
          replaced by a spinner — that was unmounting things like the status
          filter chips and each tab's local state (selection, draft notes,
          cached song lookups) on every refetch. A translucent overlay signals
          the load without tearing the UI down. */}
      <div className="flex-1 overflow-hidden relative">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--bg)]/60 backdrop-blur-[1px]">
            <Loader2 size={20} className="animate-spin text-text-muted" />
          </div>
        )}
        {tab === 'proposals'    && <ProposalsTab proposals={proposals} status={propStatus} setStatus={setPropStatus} onChanged={() => setRefreshKey(k => k + 1)} />}
        {tab === 'comp-proposals' && <CompProposalsTab embedded onChanged={() => setRefreshKey(k => k + 1)} />}
        {tab === 'applications' && <ApplicationsTab applications={applications} onChanged={() => setRefreshKey(k => k + 1)} />}
        {tab === 'reports'      && <ReportsTab reports={reports} status={reportStatus} setStatus={setReportStatus} onChanged={() => setRefreshKey(k => k + 1)} />}
        {tab === 'users'        && <UsersTab users={users} onChanged={() => setRefreshKey(k => k + 1)} currentUserId={account?.id} />}
        {tab === 'stats'        && <StatsTab applications={applications} proposals={proposals} users={users} />}
        {tab === 'security'     && <SecurityTab />}
      </div>
    </div>
  )
}


// ── Revise Panel ──────────────────────────────────────────────────────────────

const TEXTAREA_FIELDS = new Set(['lyrics', 'synced_lyrics', 'notes', 'additional_information', 'description'])
const ALL_SONG_FIELDS = [
  'name','track_titles','credited_artists','producers','engineers',
  'recording_locations','record_dates','length','bitrate','additional_information',
  'file_names','instrumentals','instrumental_names','preview_date','release_date',
  'dates','session_titles','session_tracking','lyrics','synced_lyrics',
  'album','date_leaked','leak_type',
]

function RevisePanel({ proposal, onClose, onDone }: {
  proposal: SongEditProposal
  onClose: () => void
  onDone:  () => void
}): JSX.Element {
  const [fields,  setFields]  = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    Object.entries(proposal.proposed_data || {}).forEach(([k, v]) => {
      init[k] = Array.isArray(v) ? v.join('\n') : (typeof v === 'string' ? v : JSON.stringify(v))
    })
    return init
  })
  const [reviewNote, setReviewNote] = useState('')
  const [addKey,     setAddKey]     = useState('')
  const [saving,     setSaving]     = useState(false)
  const [err,        setErr]        = useState<string | null>(null)

  // Fields that are available to add (in snapshot but not already in the working set)
  const snap = proposal.original_snapshot || {}
  const available = ALL_SONG_FIELDS.filter(k => !(k in fields))

  const addField = (key: string) => {
    if (!key) return
    const snapVal = snap[key]
    const init = Array.isArray(snapVal) ? (snapVal as string[]).join('\n')
                : typeof snapVal === 'string' ? snapVal : ''
    setFields(f => ({ ...f, [key]: init }))
    setAddKey('')
  }

  const removeField = (key: string) => {
    setFields(f => { const n = { ...f }; delete n[key]; return n })
  }

  const submit = async () => {
    setSaving(true); setErr(null)
    try {
      // Convert back — track_titles is array
      const revised_data: Record<string, unknown> = {}
      Object.entries(fields).forEach(([k, v]) => {
        if (k === 'track_titles') {
          revised_data[k] = v.split('\n').map(s => s.trim()).filter(Boolean)
        } else {
          revised_data[k] = v
        }
      })
      await userApi.adminReviewProposal(proposal.id, {
        action: 'revise',
        review_notes: reviewNote,
        revised_data,
      })
      onDone()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to revise')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--surface)]">
      {/* Panel header */}
      <div className="shrink-0 flex items-center gap-1 px-2 py-1.5 border-b border-[var(--border)]">
        <button onClick={onClose} className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full text-text-primary active:bg-surface-overlay transition-colors">
          <ChevronLeft size={20} />
        </button>
        <Pencil size={14} className="text-accent shrink-0" />
        <span className="text-text-primary text-[15px] font-bold flex-1 min-w-0 truncate">Revise proposal</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Field editors */}
        {Object.entries(fields).map(([key, val]) => (
          <div key={key} className="rounded-xl border border-[var(--border)] overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--surface-raised)] border-b border-[var(--border)]">
              <span className="font-mono text-[10px] text-text-muted flex-1">{key.replace(/_/g, ' ')}</span>
              <button onClick={() => removeField(key)} className="text-[10px] text-red-400 active:text-red-300 transition-colors">
                remove
              </button>
            </div>
            {TEXTAREA_FIELDS.has(key) ? (
              <textarea
                value={val}
                onChange={e => setFields(f => ({ ...f, [key]: e.target.value }))}
                rows={key === 'lyrics' || key === 'synced_lyrics' ? 10 : 4}
                className="w-full bg-[var(--surface)] text-text-primary text-xs font-mono px-3 py-2.5 resize-none focus:outline-none focus:bg-[var(--surface-raised)] transition-colors"
              />
            ) : (
              <input
                type="text"
                value={val}
                onChange={e => setFields(f => ({ ...f, [key]: e.target.value }))}
                className="w-full bg-[var(--surface)] text-text-primary text-xs px-3 py-2.5 focus:outline-none focus:bg-[var(--surface-raised)] transition-colors"
              />
            )}
          </div>
        ))}

        {/* Add field */}
        <div className="rounded-xl border border-dashed border-[var(--border)] overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--surface-raised)] border-b border-[var(--border)]">
            <Plus size={11} className="text-text-muted" />
            <span className="text-[10px] text-text-muted font-semibold">Add field</span>
          </div>
          <div className="flex gap-2 p-2">
            <select
              value={addKey}
              onChange={e => setAddKey(e.target.value)}
              className="flex-1 bg-[var(--surface)] text-text-primary text-xs px-2 py-1.5 rounded-lg border border-[var(--border)] focus:outline-none focus:border-accent/40"
            >
              <option value="">Choose a field…</option>
              {available.map(k => (
                <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>
              ))}
              {/* Also allow snapshot fields not in the predefined list */}
              {Object.keys(snap).filter(k => !ALL_SONG_FIELDS.includes(k) && !(k in fields)).map(k => (
                <option key={k} value={k}>{k.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <button
              onClick={() => addField(addKey)}
              disabled={!addKey}
              className="px-3 py-1.5 rounded-lg bg-accent/10 active:bg-accent/20 text-accent text-xs font-semibold disabled:opacity-40 transition-colors"
            >
              Add
            </button>
          </div>
        </div>

        {/* Review note */}
        <div className="rounded-xl border border-[var(--border)] overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--surface-raised)] border-b border-[var(--border)]">
            <MessageSquare size={11} className="text-text-muted" />
            <span className="text-[10px] text-text-muted font-semibold">Review note (optional)</span>
          </div>
          <input
            type="text"
            value={reviewNote}
            onChange={e => setReviewNote(e.target.value)}
            placeholder="Explain what you changed…"
            className="w-full bg-[var(--surface)] text-text-primary text-xs px-3 py-2.5 focus:outline-none"
          />
        </div>

        {err && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs border border-red-500/20">
            <AlertCircle size={12} />{err}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 flex items-center gap-2 p-3 border-t border-[var(--border)]">
        <button onClick={onClose} className="h-11 px-4 rounded-xl text-sm text-text-muted active:bg-surface-overlay transition-colors">
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={saving || Object.keys(fields).length === 0}
          className="flex-1 h-11 rounded-xl bg-accent active:bg-accent/90 text-[var(--bg)] text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          Save revision
        </button>
      </div>
    </div>
  )
}

// ── Proposals (master-detail) ─────────────────────────────────────────────────

type ProposalSort = 'date' | 'user'

function sortProposals(rows: SongEditProposal[], sortBy: ProposalSort): SongEditProposal[] {
  if (sortBy === 'date') return rows
  return [...rows].sort((a, b) => {
    const byUser = a.editor_username.localeCompare(b.editor_username, undefined, { sensitivity: 'base' })
    if (byUser !== 0) return byUser
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

/** How many proposal rows to mount at once (see `shown` in ProposalsTab). */
const PROPOSAL_PAGE = 400

// Memoized because the list isn't windowed: with the status filter on "All"
// it holds the whole proposal archive, and without this every keystroke in
// the search box re-rendered every row that survived the filter. `onSelect`
// is setSelected straight from useState, so its identity is stable and the
// memo actually holds.
const ProposalRow = memo(function ProposalRow({ item, showUserHeader, onSelect }: {
  item: SongEditProposal
  showUserHeader: boolean
  onSelect: (p: SongEditProposal) => void
}): JSX.Element {
  const ss = STATUS_STYLE[item.status] ?? { border: 'border-l-transparent', text: 'text-text-muted', bg: '', dot: '' }
  return (
    <div>
      {showUserHeader && (
        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted bg-surface-overlay border-b border-[var(--border)] sticky top-0 z-[1]">
          {item.editor_username}
        </div>
      )}
      <button onClick={() => onSelect(item)}
        className={`w-full text-left px-3 py-3 border-b border-[var(--border)] border-l-2 ${ss.border} transition-colors active:bg-surface-raised`}>
        <div className="flex items-center gap-1.5 mb-1">
          <StatusChip status={item.status} />
          <span className="text-[10px] text-text-muted bg-surface-raised px-1.5 py-0.5 rounded font-medium">
            {item.change_type}
          </span>
          {item.song_public_id != null && (
            <span className="text-[10px] text-text-muted ml-auto flex items-center gap-0.5">
              <Hash size={9} />{item.song_public_id}
            </span>
          )}
        </div>
        <p className="text-sm font-semibold truncate leading-snug mb-0.5 text-text-primary">
          {item.title || `Proposal #${item.id}`}
        </p>
        <p className="text-xs text-text-muted truncate">
          {item.editor_username} · {relativeTime(item.created_at)}
        </p>
      </button>
    </div>
  )
})

function ProposalsTab({ proposals, status, setStatus, onChanged }: {
  proposals: SongEditProposal[]
  status: ProposalStatus | ''
  setStatus: (s: ProposalStatus | '') => void
  onChanged: () => void
}): JSX.Element {
  const [actionId,    setActionId]    = useState<number | null>(null)
  const [notes,       setNotes]       = useState<Record<number, string>>({})
  const [selected,    setSelected]    = useState<SongEditProposal | null>(null)
  const [revising,    setRevising]    = useState(false)
  const [sortBy,      setSortBy]      = useState<ProposalSort>('date')
  const [query,       setQuery]       = useState('')
  const { playTrack } = useStorePick('playTrack')

  // Every proposal ever filed, fetched once and only when the history panel is
  // first opened — /admin/proposals/ has no per-song filter, so "what else has
  // been proposed for this song" means holding the whole archive and grouping
  // client-side. Nulled after a review so the next open reflects it.
  const [archive,        setArchive]        = useState<SongEditProposal[] | null>(null)
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [archiveError,   setArchiveError]   = useState(false)
  const [historyOpen,    setHistoryOpen]    = useState(false)
  const [expandedPast,   setExpandedPast]   = useState<number | null>(null)

  const [loadingSongId, setLoadingSongId] = useState<number | null>(null)
  const [playError,     setPlayError]     = useState<string | null>(null)

  // Searchable: the song title, who filed it, the change type, and both ids —
  // the public song id is what reports and Discord threads cite, so pasting
  // one should land on its proposal. Built once per fetch: under the "All"
  // filter this list is the entire archive, and doing it inline in the filter
  // meant re-flattening every row on every keystroke.
  const haystacks = useMemo(() => {
    const m = new Map<number, string>()
    for (const item of proposals) {
      m.set(item.id, buildHaystack(item.title, item.editor_username, item.change_type, item.song_public_id, item.id))
    }
    return m
  }, [proposals])

  // The filter runs against a deferred copy of the query, so a keystroke
  // repaints the input immediately and React re-runs the list at a lower
  // priority — typing stays smooth even when the match set is huge.
  const deferredQuery = useDeferredValue(query)

  const sortedProposals = useMemo(() => sortProposals(
    deferredQuery.trim()
      ? proposals.filter(item => matchesHaystack(deferredQuery, haystacks.get(item.id)))
      : proposals,
    sortBy,
  ), [proposals, haystacks, sortBy, deferredQuery])

  // The list isn't windowed, and "All" can be the entire archive — mounting
  // every row costs several DOM nodes each before the user has even typed.
  // Render a page at a time and let them ask for more; searching normally
  // narrows the set well below the cap anyway.
  const [shown, setShown] = useState(PROPOSAL_PAGE)
  useEffect(() => { setShown(PROPOSAL_PAGE) }, [proposals, deferredQuery, sortBy])
  const pageOf = sortedProposals.slice(0, shown)
  const remaining = sortedProposals.length - pageOf.length

  // Approving/reversing a proposal changes a song's live data — drop its
  // cached lyrics so the next play reflects it.
  const dropCache = (id: number) => {
    const songId = proposals.find(p => p.id === id)?.song
    if (songId != null) invalidateLyricsCache(songId)
  }

  const doReview = async (id: number, action: 'approve' | 'reject') => {
    setActionId(id)
    try { await userApi.adminReviewProposal(id, { action, review_notes: notes[id] || '' }); dropCache(id); setArchive(null); onChanged(); setSelected(null) }
    catch {} finally { setActionId(null) }
  }

  const doReverse = async (id: number) => {
    if (!confirm('Reverse this approval?')) return
    setActionId(id)
    try { await userApi.adminReverseProposal(id); dropCache(id); setArchive(null); onChanged(); setSelected(null) }
    catch {} finally { setActionId(null) }
  }

  const openHistory = (): void => {
    const next = !historyOpen
    setHistoryOpen(next)
    if (!next || archive || archiveLoading) return
    setArchiveLoading(true)
    setArchiveError(false)
    userApi.adminListProposals()
      .then(setArchive)
      .catch(() => setArchiveError(true))
      .finally(() => setArchiveLoading(false))
  }

  // Plays the song a proposal targets, so a reviewer can hear what they're
  // approving without leaving the queue.
  const playProposalSong = async (songId: number): Promise<void> => {
    setPlayError(null)
    setLoadingSongId(songId)
    try {
      const song = await apiFetch<JWApiSong>(`/songs/${songId}/`)
      // An unsurfaced song is a real catalog entry with no file behind it —
      // the proposal is still reviewable, there's just nothing to play.
      if (!song.path) { setPlayError('No file on this song to play'); return }
      const track = songToTrack(song)
      playTrack(track, [track])
    } catch {
      setPlayError('Could not load this song')
    } finally {
      setLoadingSongId(null)
    }
  }

  const FILTERS: { id: ProposalStatus | ''; label: string }[] = [
    { id: 'pending',  label: 'Pending'  },
    { id: 'approved', label: 'Approved' },
    { id: 'rejected', label: 'Rejected' },
    { id: 'reversed', label: 'Reversed' },
    { id: '',         label: 'All'      },
  ]

  const SORTS: { id: ProposalSort; label: string }[] = [
    { id: 'date', label: 'Newest' },
    { id: 'user', label: 'User' },
  ]

  const p = selected

  // Newest first, and it deliberately includes the proposal being viewed — the
  // point is to read this one in the context of the run, so dropping it leaves
  // a hole in the timeline. It's marked "viewing" instead.
  const history = useMemo(() => {
    if (!p?.song || !archive) return []
    return archive
      .filter(r => r.song === p.song)
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
  }, [archive, p?.song])
  const pastCount = Math.max(history.length - 1, 0)

  // Both are about the proposal on screen, so neither should outlive it.
  useEffect(() => { setExpandedPast(null); setPlayError(null) }, [p?.id])
  // A refetch replaces the rows wholesale, so a half-written revision no
  // longer lines up with what's on screen. Typing in the search box must not
  // trip this — that's why it keys off the raw list, not the filtered one.
  useEffect(() => { setRevising(false) }, [proposals])

  useBackToClose(() => (revising ? setRevising(false) : historyOpen ? setHistoryOpen(false) : setSelected(null)), p != null)

  if (p && revising) return (
    <RevisePanel
      proposal={p}
      onClose={() => setRevising(false)}
      onDone={() => { setRevising(false); setSelected(null); onChanged() }}
    />
  )

  if (p) return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Detail header */}
      <div className="shrink-0 flex items-center gap-1 px-2 py-1.5 border-b border-[var(--border)]">
        <button onClick={() => setSelected(null)}
          className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full text-text-primary active:bg-surface-overlay transition-colors">
          <ChevronLeft size={20} />
        </button>
        <h2 className="flex-1 min-w-0 truncate text-text-primary text-[15px] font-bold">{p.title || `Proposal #${p.id}`}</h2>
        {/* Hearing the song is just as useful when auditing something already
            approved or reversed, so this isn't gated to pending. */}
        {p.song != null && (
          <button onClick={() => playProposalSong(p.song as number)} disabled={loadingSongId != null}
            aria-label="Play this song"
            className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full text-text-secondary active:bg-surface-overlay transition-colors disabled:opacity-40">
            {loadingSongId === p.song ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
          </button>
        )}
        <StatusChip status={p.status} />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-text-muted bg-surface-overlay px-2 py-0.5 rounded font-medium">{p.change_type}</span>
            {p.song_public_id != null && (
              <span className="flex items-center gap-0.5 text-xs text-text-muted"><Hash size={10} />{p.song_public_id}</span>
            )}
            <span className="text-xs text-text-muted">by {p.editor_username}</span>
            <span className="flex items-center gap-1 text-xs text-text-muted"><Calendar size={10} />{shortDate(p.created_at)}</span>
            {p.reviewer_username && <span className="text-xs text-text-muted">reviewed by {p.reviewer_username}</span>}
            {p.edit_count > 0 && <span className="text-xs text-text-muted">{p.edit_count} edit{p.edit_count !== 1 ? 's' : ''}</span>}
            {p.song != null && (
              <button onClick={openHistory}
                className={`flex items-center gap-1 text-xs transition-colors ${historyOpen ? 'text-accent' : 'text-text-muted active:text-text-primary'}`}>
                <History size={10} />
                {/* The count is unknown until the archive loads, so the label
                    stays generic rather than promising a number it might have
                    to take back. */}
                {archive ? (pastCount === 0 ? 'no earlier proposals' : `${pastCount} earlier proposal${pastCount === 1 ? '' : 's'}`) : 'history'}
                {historyOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              </button>
            )}
          </div>

          {playError && (
            <p className="flex items-center gap-1.5 text-[11px] text-amber-400">
              <AlertCircle size={11} /> {playError}
            </p>
          )}

          {(p.editor_notes || p.review_notes) && (
            <div className="flex flex-col gap-2">
              {p.editor_notes && (
                <div className="flex items-start gap-1.5 px-3 py-2 bg-surface-overlay rounded-lg text-xs text-text-muted italic border border-[var(--border)]">
                  <MessageSquare size={11} className="text-text-muted shrink-0 mt-0.5" />
                  {p.editor_notes}
                </div>
              )}
              {p.review_notes && (
                <div className="flex items-start gap-1.5 px-3 py-2 bg-surface-overlay rounded-lg text-xs text-text-muted italic border border-[var(--border)]">
                  <Check size={11} className="text-text-muted shrink-0 mt-0.5" />
                  {p.review_notes}
                </div>
              )}
            </div>
          )}

          {p.status === 'pending' && (
            <input
              type="text"
              value={notes[p.id] || ''}
              onChange={e => setNotes(n => ({ ...n, [p.id]: e.target.value }))}
              placeholder="Add review note (optional)…"
              className="w-full bg-surface-overlay border border-[var(--border)] rounded-lg px-3 py-2.5 text-text-primary text-sm focus:outline-none focus:border-accent/40"
            />
          )}
        </div>

        {/* Song history — every proposal ever filed against this song, so a
            reviewer can see whether a field has been fought over before, or
            whether this editor is re-submitting something already rejected.
            Read-only: expanding a row shows its diff in place rather than
            moving the selection, which would fight the status filter (a
            rejected proposal isn't in a Pending list). */}
        {historyOpen && p.song != null && (
          <div className="border-y border-[var(--border)] bg-[var(--surface)]">
            {archiveLoading && (
              <div className="flex justify-center py-4"><Loader2 size={14} className="animate-spin text-text-muted" /></div>
            )}
            {archiveError && (
              <p className="flex items-center gap-1.5 px-4 py-3 text-[11px] text-amber-400">
                <AlertCircle size={11} /> Could not load this song&apos;s history
              </p>
            )}
            {archive && history.length <= 1 && (
              <p className="px-4 py-3 text-[11px] text-text-muted italic">
                No other proposals have been filed for this song.
              </p>
            )}
            {archive && history.length > 1 && history.map(row => {
              const isViewing = row.id === p.id
              const open = expandedPast === row.id
              return (
                <div key={row.id} className="border-b border-[var(--border)] last:border-b-0">
                  <button onClick={() => setExpandedPast(open ? null : row.id)}
                    className={`w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors ${isViewing ? 'bg-accent/5' : 'active:bg-surface-raised'}`}>
                    <StatusChip status={row.status} />
                    <span className="text-[11px] text-text-primary truncate flex-1 min-w-0">
                      {row.title || `Proposal #${row.id}`}
                    </span>
                    {isViewing && <span className="text-[9px] text-accent font-semibold shrink-0">viewing</span>}
                    <span className="text-[10px] text-text-muted shrink-0">{shortDate(row.created_at)}</span>
                    {open ? <ChevronUp size={11} className="text-text-muted shrink-0" /> : <ChevronDown size={11} className="text-text-muted shrink-0" />}
                  </button>
                  {open && (
                    <div className="bg-[var(--surface-raised)] border-t border-[var(--border)]">
                      {row.review_notes && (
                        <p className="px-4 pt-3 text-[11px] text-text-muted italic">
                          {row.reviewer_username ? `${row.reviewer_username}: ` : ''}{row.review_notes}
                        </p>
                      )}
                      <ProposalDiff proposal={row} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Diff body */}
        <ProposalDiff proposal={p} />
      </div>

      {/* Actions */}
      <div className="shrink-0 p-3 border-t border-[var(--border)] flex items-center gap-2">
        {actionId === p.id ? (
          <div className="flex-1 flex justify-center py-2.5"><Loader2 size={16} className="animate-spin text-text-muted" /></div>
        ) : p.status === 'pending' ? (
          <>
            <button onClick={() => setRevising(true)}
              className="h-11 px-3.5 rounded-xl bg-[var(--surface-overlay)] active:bg-[var(--surface-raised)] text-text-secondary text-sm font-semibold transition-colors flex items-center gap-1.5">
              <Pencil size={14} /> Revise
            </button>
            <button onClick={() => doReview(p.id, 'reject')}
              className="flex-1 h-11 rounded-xl bg-red-500/10 active:bg-red-500/20 text-red-400 text-sm font-semibold transition-colors flex items-center justify-center gap-1.5">
              <XCircle size={15} /> Reject
            </button>
            <button onClick={() => doReview(p.id, 'approve')}
              className="flex-1 h-11 rounded-xl bg-emerald-500/15 active:bg-emerald-500/25 text-emerald-400 text-sm font-semibold transition-colors flex items-center justify-center gap-1.5">
              <CheckCircle size={15} /> Approve
            </button>
          </>
        ) : p.status === 'approved' ? (
          <button onClick={() => doReverse(p.id)} disabled={actionId === p.id}
            className="w-full h-11 rounded-xl text-sm text-text-muted active:text-amber-400 active:bg-amber-500/10 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40">
            <RotateCcw size={15} /> Reverse
          </button>
        ) : null}
      </div>
    </div>
  )

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Filter bar */}
      <div className="shrink-0 flex flex-col gap-2 px-3 py-2.5 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <div className="flex gap-2 overflow-x-auto scrollbar-none">
            {FILTERS.map(f => (
              <button key={f.id || 'all'} onClick={() => setStatus(f.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  status === f.id ? 'bg-accent text-[var(--bg)]' : 'text-text-muted bg-surface-overlay'
                }`}>{f.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex gap-1 shrink-0">
            {SORTS.map(s => (
              <button key={s.id} onClick={() => setSortBy(s.id)}
                className={`px-2.5 py-1.5 rounded-full text-[11px] font-semibold transition-colors ${
                  sortBy === s.id ? 'bg-surface-overlay text-text-primary ring-1 ring-[var(--border)]' : 'text-text-muted'
                }`}>{s.label}
              </button>
            ))}
          </div>
        </div>
        <QueueSearch value={query} onChange={setQuery} placeholder="Search title, editor, #id…"
          matches={sortedProposals.length} total={proposals.length} />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {proposals.length === 0 && <Empty label="No proposals" />}
        {proposals.length > 0 && sortedProposals.length === 0 && <Empty label="No matches" />}
        {pageOf.map((item, idx) => (
          <ProposalRow
            key={item.id}
            item={item}
            showUserHeader={sortBy === 'user' && (idx === 0 || pageOf[idx - 1].editor_username !== item.editor_username)}
            onSelect={setSelected}
          />
        ))}
        {remaining > 0 && (
          <button onClick={() => setShown(s => s + PROPOSAL_PAGE)}
            className="w-full px-3 py-3 text-[11px] font-semibold text-accent active:bg-surface-raised transition-colors">
            Show {Math.min(remaining, PROPOSAL_PAGE)} more · {remaining} left
          </button>
        )}
      </div>
    </div>
  )
}

// ── Applications (master-detail) ──────────────────────────────────────────────

function ApplicationsTab({ applications, onChanged }: { applications: EditorApplication[]; onChanged: () => void }): JSX.Element {
  const [actionId, setActionId] = useState<number | null>(null)
  const [notes,    setNotes]    = useState<Record<number, string>>({})
  const [selected, setSelected] = useState<EditorApplication | null>(null)

  const doReview = async (id: number, action: 'approve' | 'reject') => {
    setActionId(id)
    try { await userApi.adminReviewApplication(id, { action, review_notes: notes[id] || '' }); onChanged(); setSelected(null) }
    catch {} finally { setActionId(null) }
  }

  const pending  = applications.filter(a => a.status === 'pending')
  const reviewed = applications.filter(a => a.status !== 'pending')
  const a = selected

  useBackToClose(() => setSelected(null), a != null)

  if (a) return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="shrink-0 flex items-center gap-1 px-2 py-1.5 border-b border-[var(--border)]">
        <button onClick={() => setSelected(null)}
          className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full text-text-primary active:bg-surface-overlay transition-colors">
          <ChevronLeft size={20} />
        </button>
        <h2 className="flex-1 min-w-0 truncate text-text-primary text-[15px] font-bold">{a.display_name || a.username}</h2>
        <StatusChip status={a.status} />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex items-center gap-3">
          <Avatar src={a.discord_avatar} name={a.display_name || a.username} size={12} />
          <div className="flex-1 min-w-0 flex flex-col gap-0.5 text-xs text-text-muted">
            {a.discord_username && <span>{a.discord_username}</span>}
            {a.contact && <span>{a.contact}</span>}
            <span className="flex items-center gap-1"><Calendar size={10} />{shortDate(a.created_at)}</span>
            {a.reviewer_username && <span>Reviewed by {a.reviewer_username}</span>}
          </div>
        </div>

        <div className="space-y-4">
          {a.areas && <AppSection label="Areas of interest" value={a.areas} />}
          {a.experience && <AppSection label="Experience" value={a.experience} />}
          {a.motivation && <AppSection label="Motivation" value={a.motivation} />}
        </div>

        {a.status === 'pending' && (
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Review note</label>
            <textarea
              value={notes[a.id] || ''}
              onChange={e => setNotes(n => ({ ...n, [a.id]: e.target.value }))}
              placeholder="Optional note for the applicant…"
              rows={3}
              className="w-full bg-surface-overlay border border-[var(--border)] rounded-xl px-3 py-2.5 text-text-primary text-sm resize-none focus:outline-none focus:border-accent/40"
            />
          </div>
        )}
      </div>

      {a.status === 'pending' && (
        <div className="shrink-0 p-3 border-t border-[var(--border)] flex items-center gap-2">
          {actionId === a.id ? (
            <div className="flex-1 flex justify-center py-2.5"><Loader2 size={16} className="animate-spin text-text-muted" /></div>
          ) : (
            <>
              <button onClick={() => doReview(a.id, 'reject')}
                className="flex-1 h-11 rounded-xl bg-red-500/10 active:bg-red-500/20 text-red-400 text-sm font-semibold transition-colors flex items-center justify-center gap-1.5">
                <XCircle size={15} /> Reject
              </button>
              <button onClick={() => doReview(a.id, 'approve')}
                className="flex-1 h-11 rounded-xl bg-emerald-500/15 active:bg-emerald-500/25 text-emerald-400 text-sm font-semibold transition-colors flex items-center justify-center gap-1.5">
                <CheckCircle size={15} /> Approve
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {applications.length === 0 && <Empty label="No applications" />}
        {pending.length > 0 && (
          <div className="px-3 pt-3 pb-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Pending · {pending.length}</p>
          </div>
        )}
        {pending.map(item => (
          <button key={item.id} onClick={() => setSelected(item)}
            className="w-full text-left px-3 py-3 border-b border-[var(--border)] border-l-2 border-l-amber-500/60 transition-colors text-text-primary active:bg-surface-raised">
            <div className="flex items-center gap-2.5">
              <Avatar src={item.discord_avatar} name={item.display_name || item.username} size={9} />
              <div className="min-w-0 flex-1">
                <p className="text-text-primary text-sm font-semibold truncate">{item.display_name || item.username}</p>
                <p className="text-text-muted text-xs truncate">{item.application_type} · {item.discord_username} · {relativeTime(item.created_at)}</p>
              </div>
            </div>
          </button>
        ))}

        {reviewed.length > 0 && (
          <div className="px-3 pt-3 pb-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Reviewed</p>
          </div>
        )}
        {reviewed.map(item => (
          <button key={item.id} onClick={() => setSelected(item)}
            className={`w-full text-left px-3 py-3 border-b border-[var(--border)] border-l-2 ${STATUS_STYLE[item.status]?.border ?? 'border-l-transparent'} transition-colors text-text-primary opacity-60 active:bg-surface-raised active:opacity-100`}>
            <div className="flex items-center gap-2.5">
              <Avatar src={item.discord_avatar} name={item.display_name || item.username} size={8} />
              <div className="min-w-0 flex-1">
                <p className="text-text-primary text-sm font-medium truncate">{item.display_name || item.username}</p>
                <p className="text-text-muted text-xs">{item.status} · {shortDate(item.reviewed_at)}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Users ─────────────────────────────────────────────────────────────────────

function UsersTab({ users, onChanged, currentUserId }: { users: AdminUser[]; onChanged: () => void; currentUserId?: number }): JSX.Element {
  const [actionId, setActionId] = useState<number | null>(null)
  const [filter,   setFilter]   = useState<'all' | 'admins' | 'editors' | 'contributors' | 'applicants'>('all')
  const [search,   setSearch]   = useState('')

  const doUpdate = async (uid: number, payload: Parameters<typeof userApi.adminUpdateUser>[1]) => {
    setActionId(uid)
    try { await userApi.adminUpdateUser(uid, payload); onChanged() }
    catch {} finally { setActionId(null) }
  }

  const FILTERS = [
    { id: 'all' as const,        label: 'All',        count: users.length },
    { id: 'admins' as const,     label: 'Admins',     count: users.filter(u => u.role === 'administrator').length },
    { id: 'editors' as const,    label: 'Editors',    count: users.filter(u => u.role === 'editor').length },
    // Contributors cuts across the role buckets rather than being one of them
    // — contributor_enabled is a flag on top of a role, so a contributor is
    // still counted under whichever of Admins/Editors/Applicants they are.
    { id: 'contributors' as const, label: 'Contributors', count: users.filter(u => u.contributor_enabled).length },
    { id: 'applicants' as const, label: 'Applicants', count: users.filter(u => u.role === 'applicant').length },
  ]

  const ROLE = {
    administrator: 'text-accent bg-accent/15 border-accent/20',
    editor:        'text-emerald-400 bg-emerald-500/15 border-emerald-500/20',
    applicant:     'text-text-muted bg-surface-raised border-[var(--border)]',
  } as Record<string, string>
  const CONTRIBUTOR_BADGE = 'text-sky-400 bg-sky-500/15 border-sky-500/20'

  const visible = useMemo(() => users.filter(u => {
    const ok = filter === 'all'
      ? true
      : filter === 'admins'
        ? u.role === 'administrator'
        : filter === 'editors'
          ? u.role === 'editor'
          : filter === 'contributors'
            ? u.contributor_enabled
            : u.role === 'applicant'
    const q = search.toLowerCase()
    return ok && (!q || (u.discord_username || u.username || '').toLowerCase().includes(q))
  }), [users, filter, search])

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="shrink-0 flex flex-col gap-2 px-3 py-2.5 border-b border-[var(--border)]">
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          {FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`shrink-0 flex items-center gap-1.5 h-9 px-3 rounded-full text-xs font-semibold transition-colors ${
                filter === f.id ? 'bg-accent text-[var(--bg)]' : 'text-text-muted bg-surface-overlay'
              }`}>
              {f.label}
              <span className={`text-[10px] px-1 rounded ${filter === f.id ? 'bg-white/20' : 'bg-surface-raised'}`}>{f.count}</span>
            </button>
          ))}
        </div>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
          className="w-full bg-surface-overlay border border-[var(--border)] rounded-lg px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-accent/40" />
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {visible.length === 0 && <Empty label="No users" />}
        {visible.map(u => (
          <div key={u.user_id} className="flex flex-col gap-2 px-3 py-3 border-b border-[var(--border)]">
            <div className="flex items-center gap-2.5">
              <Avatar src={u.discord_avatar} name={u.discord_username || u.username} size={9} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-text-primary text-sm font-medium truncate">{u.discord_username || u.username}</p>
                  {!u.is_active && <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded text-red-400 bg-red-500/15 shrink-0">disabled</span>}
                  {u.user_id === currentUserId && <span className="text-[10px] text-text-muted italic shrink-0">you</span>}
                </div>
                <p className="text-text-muted text-xs">joined {shortDate(u.date_joined)} · {u.approved_count} approved · {u.proposal_count} props</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${ROLE[u.role] ?? 'text-text-muted bg-surface-raised border-[var(--border)]'}`}>
                {u.role}
              </span>
              {u.contributor_enabled && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${CONTRIBUTOR_BADGE}`}>
                  contributor
                </span>
              )}
            </div>

            {actionId === u.user_id ? (
              <div className="flex justify-center py-1"><Loader2 size={14} className="animate-spin text-text-muted" /></div>
            ) : u.user_id !== currentUserId && u.role !== 'administrator' ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {u.role === 'editor' && (
                  <label className="flex items-center gap-1.5 text-[11px] text-text-muted h-8 px-2">
                    <input type="checkbox" checked={u.auto_approve_proposals}
                      onChange={e => doUpdate(u.user_id, { auto_approve_proposals: e.target.checked })}
                      className="w-3.5 h-3.5 accent-[var(--accent)]" />
                    auto
                  </label>
                )}
                {u.contributor_enabled && (
                  <label className="flex items-center gap-1.5 text-[11px] text-text-muted h-8 px-2">
                    <input type="checkbox" checked={u.auto_approve_comp_proposals}
                      onChange={e => doUpdate(u.user_id, { auto_approve_comp_proposals: e.target.checked })}
                      className="w-3.5 h-3.5 accent-[var(--accent)]" />
                    auto
                  </label>
                )}
                {u.role === 'editor' ? (
                  <button onClick={() => doUpdate(u.user_id, { role: 'applicant' })}
                    className="h-8 px-2.5 rounded-lg text-[11px] text-text-muted active:text-red-400 active:bg-red-500/10 transition-colors font-semibold bg-surface-overlay">−Editor</button>
                ) : (
                  <button onClick={() => doUpdate(u.user_id, { role: 'editor' })}
                    className="h-8 px-2.5 rounded-lg text-[11px] text-emerald-400 active:bg-emerald-500/10 transition-colors font-semibold bg-surface-overlay">+Editor</button>
                )}
                {u.contributor_enabled ? (
                  <button onClick={() => doUpdate(u.user_id, { contributor_enabled: false })}
                    className="h-8 px-2.5 rounded-lg text-[11px] text-text-muted active:text-red-400 active:bg-red-500/10 transition-colors font-semibold bg-surface-overlay">−Contrib</button>
                ) : (
                  <button onClick={() => doUpdate(u.user_id, { contributor_enabled: true })}
                    className="h-8 px-2.5 rounded-lg text-[11px] text-emerald-400 active:bg-emerald-500/10 transition-colors font-semibold bg-surface-overlay">+Contrib</button>
                )}
                <button onClick={() => doUpdate(u.user_id, { is_active: !u.is_active })}
                  className="h-8 px-2.5 rounded-lg text-[11px] text-text-muted active:bg-surface-raised transition-colors font-semibold bg-surface-overlay">
                  {u.is_active ? 'Disable' : 'Enable'}
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Stats ─────────────────────────────────────────────────────────────────────

function StatsTab({ applications, proposals, users }: {
  applications: EditorApplication[]; proposals: SongEditProposal[]; users: AdminUser[]
}): JSX.Element {
  const approved    = proposals.filter(p => p.status === 'approved').length
  const reviewed    = proposals.filter(p => p.status !== 'pending').length
  const approvalPct = reviewed > 0 ? Math.round(approved / reviewed * 100) : 0
  const editors     = users.filter(u => u.role === 'editor')
  const topEditors  = [...editors].sort((a, b) => b.approved_count - a.approved_count).slice(0, 8)

  const metrics = [
    { label: 'Total users',       value: users.length,                                             color: 'text-accent',        icon: <Users size={16} /> },
    { label: 'Editors',           value: editors.length,                                           color: 'text-emerald-400',   icon: <UserCheck size={16} /> },
    { label: 'Total proposals',   value: proposals.length,                                         color: 'text-blue-400',      icon: <FileEdit size={16} /> },
    { label: 'Approved',          value: approved,                                                  color: 'text-emerald-400',   icon: <FileCheck size={16} /> },
    { label: 'Pending proposals', value: proposals.filter(p => p.status === 'pending').length,     color: 'text-amber-400',     icon: <Clock size={16} /> },
    { label: 'Pending apps',      value: applications.filter(a => a.status === 'pending').length,  color: 'text-amber-400',     icon: <Clock size={16} /> },
    { label: 'Approval rate',     value: `${approvalPct}%`,                                        color: 'text-purple-400',    icon: <Activity size={16} /> },
    { label: 'Applicants',        value: users.filter(u => u.role === 'applicant').length,          color: 'text-text-muted', icon: <Users size={16} /> },
  ]

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="grid grid-cols-2 gap-2.5 mb-6">
        {metrics.map(m => (
          <div key={m.label} className="bg-surface-overlay border border-[var(--border)] rounded-xl p-3.5">
            <div className={`mb-2 ${m.color}`}>{m.icon}</div>
            <p className={`text-2xl font-black leading-none ${m.color}`}>{m.value}</p>
            <p className="text-text-muted text-[11px] mt-2">{m.label}</p>
          </div>
        ))}
      </div>

      {topEditors.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-3">Top editors by approvals</p>
          <div className="grid grid-cols-1 gap-2">
            {topEditors.map((u, i) => (
              <div key={u.user_id} className="flex items-center gap-3 px-4 py-3 bg-surface-overlay border border-[var(--border)] rounded-xl">
                <span className={`text-sm font-black w-6 text-center shrink-0 ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-amber-700' : 'text-text-muted'}`}>
                  {i + 1}
                </span>
                <Avatar src={u.discord_avatar} name={u.discord_username || u.username} size={8} />
                <div className="flex-1 min-w-0">
                  <p className="text-text-primary text-xs font-semibold truncate">{u.discord_username || u.username}</p>
                  <p className="text-text-muted text-[10px]">{u.proposal_count} total</p>
                </div>
                <div className="text-right">
                  <p className="text-text-primary text-sm font-bold">{u.approved_count}</p>
                  <p className="text-text-muted text-[9px]">approved</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Security ──────────────────────────────────────────────────────────────────

function SecurityTab(): JSX.Element {
  return (
    <div className="p-4">
      <div className="flex items-start gap-4 px-5 py-5 rounded-2xl bg-emerald-500/8 border border-emerald-500/20">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
          <Check size={18} className="text-emerald-400" />
        </div>
        <div>
          <p className="text-text-primary font-semibold">Two-factor authentication enabled</p>
          <p className="text-text-muted text-sm mt-1">Your account is protected with 2FA.</p>
        </div>
      </div>
    </div>
  )
}

// ── OTP Setup ─────────────────────────────────────────────────────────────────

function OtpSetupPanel({ onEnabled }: { onEnabled: () => Promise<void> }): JSX.Element {
  const [setup,      setSetup]      = useState<userApi.OtpSetupPayload | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [code,       setCode]       = useState('')
  const [confirming, setConfirming] = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  useEffect(() => {
    userApi.getOtpSetup().then(setSetup).catch(e => setError(e instanceof Error ? e.message : 'Could not load')).finally(() => setLoading(false))
  }, [])

  const confirm = async () => {
    setConfirming(true); setError(null)
    try { await userApi.confirmOtpSetup(code); await onEnabled() }
    catch (e) { setError(e instanceof Error ? e.message : 'Verification failed') }
    finally { setConfirming(false) }
  }

  if (loading) return <div className="flex items-center justify-center h-32"><Loader2 size={20} className="animate-spin text-text-muted" /></div>
  if (!setup) return <p className="text-red-400 text-sm">Could not load OTP setup.</p>

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-text-primary text-base font-bold flex items-center gap-2"><KeyRound size={16} /> Enable 2FA</h2>
        <p className="text-text-muted text-sm mt-1.5 leading-relaxed">Admins must enable two-factor authentication. Scan the QR code with your authenticator app.</p>
      </div>
      {setup.qr_code && (
        <div className="bg-white p-4 rounded-2xl flex items-center justify-center w-fit mx-auto">
          <img src={setup.qr_code} alt="OTP QR code" className="w-40 h-40" />
        </div>
      )}
      {setup.otp_secret && (
        <div>
          <p className="text-text-muted text-[10px] mb-1.5">Manual entry:</p>
          <code className="block bg-surface-overlay border border-[var(--border)] rounded-xl px-3 py-2.5 text-text-primary text-xs font-mono break-all">{setup.otp_secret}</code>
        </div>
      )}
      <div>
        <label className="block text-xs font-semibold text-text-muted mb-1.5">Verification code</label>
        <input type="text" inputMode="numeric" value={code}
          onChange={e => { setCode(e.target.value); setError(null) }}
          onKeyDown={e => e.key === 'Enter' && confirm()} placeholder="123456"
          className="w-full bg-surface-overlay border border-[var(--border)] rounded-xl px-4 py-2.5 text-text-primary text-base focus:outline-none focus:border-accent/50 font-mono tracking-[0.5em] text-center"
        />
      </div>
      {error && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          <AlertCircle size={13} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}
      <button onClick={confirm} disabled={confirming || !code}
        className="w-full py-2.5 rounded-xl bg-accent text-[var(--bg)] text-sm font-semibold hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40">
        {confirming && <Loader2 size={14} className="animate-spin" />} Verify & enable
      </button>
    </div>
  )
}
