import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Loader2, Trophy, FileEdit, ChevronLeft, RefreshCw, Plus, X, Search, Flag, ShieldCheck, FolderOpen } from 'lucide-react'
import { useStore } from '../store/useStore'
import { SongEditProposal } from '../lib/userApi'
import ReportsTab from './ReportsTab'
import AdminPage from './AdminPage'
import CompProposalList, { CompFilterBar, filterCompProposals } from './CompProposalList'
import RoleBadges from './RoleBadges'
import { Tile } from './Tile'
import ProposalListItem from './ProposalListItem'
import AddSongModal from './AddSongModal.desktop'
import { useStaffRoles } from '../hooks/useStaffRoles'
import { useMyProposals } from '../hooks/useMyProposals'
import { useLeaderboard } from '../hooks/useLeaderboard'
import { useMyCompProposals } from '../hooks/useMyCompProposals'
import { useReportsQueue } from '../hooks/useReportsQueue'
import { RANK_STYLES, type ProposalFilterTab } from '../lib/proposalSearch'

// Bento tile grid — replaces the v1 header+tabs+single-panel layout (see
// "Visual Redesign v2 — Bento Dashboard Pivot" in the rewrite plan). Reuses
// the app's own Tile primitive (originally HomeView.desktop.tsx's bento
// rework) so this page is visually unmistakable from the old tab-bar shape
// while staying consistent with where the rest of the app is heading.
// Everything below is height-bound (h-full inside App's fixed-height
// <main>), not page-scrolling — individual tiles scroll internally.

type ViewMode = 'grid' | 'admin'

function LeaderboardRows({ entries, myUsername }: {
  entries: ReturnType<typeof useLeaderboard>['leaderboard']
  myUsername: string | undefined
}): JSX.Element {
  return (
    <div className="space-y-1">
      {entries.map((entry) => {
        const isMe = entry.discord_username === myUsername
        const rankStyle = RANK_STYLES[entry.rank]
        return (
          <div
            key={entry.user_id}
            className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${
              isMe ? 'bg-accent/8 ring-1 ring-accent/20' : 'hover:bg-surface-overlay'
            }`}
          >
            <span className="w-5 shrink-0 flex items-center justify-center">
              <span className={`text-sm tabular-nums rounded-md px-1 py-0.5 ${
                rankStyle ? `${rankStyle.num} ${rankStyle.badge}` : 'text-text-muted font-medium'
              }`}>
                {entry.rank}
              </span>
            </span>

            {entry.discord_avatar ? (
              <img src={entry.discord_avatar} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-surface-raised flex items-center justify-center text-xs text-text-muted shrink-0">
                {(entry.discord_username || '?').charAt(0).toUpperCase()}
              </div>
            )}

            <p className={`flex-1 min-w-0 text-sm truncate ${isMe ? 'text-accent font-semibold' : 'text-text-primary'}`}>
              {entry.username || entry.discord_username}
              {isMe && <span className="ml-1.5 text-xs opacity-60 font-normal">you</span>}
            </p>

            <span className={`text-sm tabular-nums shrink-0 font-semibold ${isMe ? 'text-accent' : rankStyle ? rankStyle.num : 'text-text-muted'}`}>
              {entry.approved_count}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function EditorProfileView(): JSX.Element {
  const { account, setActiveView, setPendingEditorSongId, setPendingEditProposal, activeChannel, channels, setActiveChannel, loadChannels } = useStore(useShallow(s => ({
    account: s.account,
    setActiveView: s.setActiveView,
    setPendingEditorSongId: s.setPendingEditorSongId,
    setPendingEditProposal: s.setPendingEditProposal,
    activeChannel: s.activeChannel,
    channels: s.channels,
    setActiveChannel: s.setActiveChannel,
    loadChannels: s.loadChannels,
  })))
  const go = setActiveView
  // Every list on this page — my proposals, my comp proposals, the Admin
  // tile's review queues — is already scoped to activeChannel (see the
  // effects below and AdminPage). ApiFilesView is the only other place that
  // lets a user change it; without a switcher here too, reviewing a second
  // channel meant leaving the profile to flip it in Files first.
  useEffect(() => { if (channels.length === 0) loadChannels().catch(() => {}) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [refreshKey, setRefreshKey] = useState(0)
  const [showAddSong, setShowAddSong] = useState(false)
  const [mode, setMode] = useState<ViewMode>('grid')

  // Not `|| is_administrator`: this tile lists proposals *you* submitted, and
  // an admin who never contributed has none. Their review queue is the Admin
  // tile's "Comp files" — the one place proposals are reviewed. Managers
  // review the same two queues admins do, so they get the same embedded
  // panel here. Scoped to the active channel — a manager grant on one
  // channel shouldn't leave this tile visible (and then erroring) on a
  // channel they don't actually manage.
  const { isContributor, isAdmin, isManager, canReviewReports, canReviewStaff } = useStaffRoles(account, activeChannel, channels)

  const {
    proposals, loading: loadingProposals, refreshing,
    filter, setFilter, search, setSearch, deletingId, resubmittingId,
    filteredProposals, handleDelete, handleResubmit, tabCount,
  } = useMyProposals(activeChannel, refreshKey)

  const { leaderboard, loading: loadingLeaderboard, myEntry } = useLeaderboard(refreshKey, activeChannel, account?.discord_username)

  // Grid mode has no "active tab" gating a tile's own fetch — every visible
  // tile is live at once — so this is gated on the role condition alone
  // (still exactly the role-gating logic from before, just not additionally
  // gated on tab selection).
  const {
    compProposals, loading: loadingComp, filter: compFilter, setFilter: setCompFilter,
    withdrawingId: withdrawingCompId, handleWithdraw: handleWithdrawComp,
  } = useMyCompProposals(isContributor, activeChannel, refreshKey, () => setRefreshKey(k => k + 1))

  const {
    reports, status: reportStatus, setStatus: setReportStatus, loading: loadingReports,
  } = useReportsQueue(canReviewReports, refreshKey)

  const handleEdit = (p: SongEditProposal): void => {
    // p.song is null for 'create' proposals (new song, no backing record yet) —
    // EditorPage handles that case, so don't block it here.
    setPendingEditProposal({ id: p.id, songId: p.song, proposedData: p.proposed_data, editorNotes: p.editor_notes || '' })
    setPendingEditorSongId(p.song)
    go('editor')
  }

  const FILTER_TABS: { key: ProposalFilterTab; label: string }[] = [
    { key: 'all',      label: 'All' },
    { key: 'pending',  label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
  ]

  // ── Focused mode: Admin/Manager tile expands to fill the page ──
  if (mode === 'admin' && canReviewStaff) {
    return (
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="px-4 md:px-5 pt-4 pb-2 shrink-0">
          <button
            onClick={() => setMode('grid')}
            className="flex items-center gap-1.5 text-text-muted hover:text-text-primary text-xs transition-colors"
          >
            <ChevronLeft size={14} /> Back to dashboard
          </button>
        </div>
        <div className="flex-1 overflow-hidden p-4 md:p-5 pt-2">
          <div className="h-full rounded-2xl border border-[var(--border)] bg-surface-raised/50 overflow-hidden flex flex-col">
            <AdminPage embedded />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

      {/* ── Toolbar: back, channel switcher, refresh ── */}
      <div className="flex items-center justify-between px-4 md:px-5 pt-4 pb-3 shrink-0">
        <button
          onClick={() => go('api-tracker')}
          className="flex items-center gap-1.5 text-text-muted hover:text-text-primary text-xs transition-colors"
        >
          <ChevronLeft size={14} /> Back
        </button>
        <div className="flex items-center gap-1.5">
          {channels.length > 0 && (
            <div className="flex items-center bg-surface-overlay rounded-lg p-1 gap-0.5 mr-1">
              {channels.map((ch) => (
                <button
                  key={ch.slug}
                  onClick={() => setActiveChannel(ch.slug)}
                  disabled={channels.length === 1}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${activeChannel === ch.slug ? 'bg-surface-raised text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'} disabled:opacity-70`}
                  title={ch.description || ch.name}
                >{ch.name}</button>
              ))}
            </div>
          )}
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            disabled={refreshing}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-[var(--surface-raised)] transition-colors disabled:opacity-40"
            title="Refresh"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Bento grid ──
          Explicit left/right columns instead of one grid with mixed
          row-spans: auto-placement with uneven spans (1/2/3 rows across a
          4-col track) produced an unpredictable implicit row count, so
          `auto-rows-[minmax(0,1fr)]` squeezed some tracks down to a sliver
          and let others (Reports' old -m-4 escape-hatch especially) bleed
          past their tile's rounded border. Every grid below is now either
          non-spanning (safe auto-placement) or a single flex-1 cell, with
          min-h-0 threaded down each flex/grid ancestor so a tile's own
          content scrolls internally instead of overflowing it. */}
      <div className="flex-1 overflow-y-auto md:overflow-hidden px-4 md:px-5 pb-4 md:pb-5">
        <div className="flex flex-col md:flex-row gap-3 md:gap-4 md:h-full">

          {/* Left column: identity + stats, then My Proposals filling the rest */}
          <div className="flex flex-col gap-3 md:gap-4 md:w-[42%] md:min-h-0">
            <div className="grid grid-cols-2 gap-3 shrink-0">
              <Tile span="col-span-1">
                <div className="flex items-center gap-3">
                  {account?.discord_avatar ? (
                    <img src={account.discord_avatar} alt="" className="w-12 h-12 rounded-full object-cover shrink-0 ring-2 ring-[var(--border)]" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-accent/20 text-accent flex items-center justify-center text-lg font-bold shrink-0">
                      {(account?.display_name || account?.discord_username || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h1 className="text-text-primary text-base font-bold truncate">
                      {account?.display_name || account?.discord_username || 'My Profile'}
                    </h1>
                    <div className="mt-1">
                      <RoleBadges isAdmin={isAdmin} isManager={isManager} isEditor={!!account?.is_editor} isContributor={isContributor} />
                    </div>
                  </div>
                </div>
              </Tile>

              <Tile title="Stats" icon={<Trophy size={13} />} span="col-span-1">
                <div className="flex flex-col justify-center gap-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">
                    {myEntry ? `Rank #${myEntry.rank}` : 'Unranked'}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted opacity-70">
                    {myEntry ? `${myEntry.approved_count} approved` : '0 approved'}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted opacity-70">
                    {!loadingProposals ? `${proposals.length} proposal${proposals.length !== 1 ? 's' : ''} total` : '…'}
                  </p>
                </div>
              </Tile>
            </div>

            <Tile
              title="My Proposals"
              icon={<FileEdit size={13} />}
              span="flex-1 min-h-[22rem] md:min-h-0"
            >
              <div className="mb-3 shrink-0">
                <div className="relative mb-2">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search proposals…"
                    className="w-full bg-surface-overlay text-text-primary text-sm pl-7 pr-7 py-2 rounded-lg outline-none border border-transparent focus:ring-1 ring-accent focus:border-accent/40 placeholder:text-text-muted"
                  />
                  {search && (
                    <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary">
                      <X size={13} />
                    </button>
                  )}
                </div>
                <div className="flex gap-1">
                  {FILTER_TABS.map(({ key, label }) => {
                    const count = tabCount(key)
                    const active = filter === key
                    return (
                      <button
                        key={key}
                        onClick={() => setFilter(key)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-medium transition-colors ${
                          active ? 'bg-accent/15 text-accent' : 'text-text-muted hover:text-text-primary hover:bg-surface-overlay'
                        }`}
                      >
                        {label}
                        {count > 0 && (
                          <span className={`text-[10px] tabular-nums ${active ? 'text-accent/70' : 'text-text-muted'}`}>
                            {count}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto min-h-0">
                {loadingProposals ? (
                  <div className="flex justify-center py-12">
                    <Loader2 size={18} className="animate-spin text-text-muted" />
                  </div>
                ) : filteredProposals.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2 text-text-muted opacity-50">
                    <FileEdit size={28} />
                    <p className="text-sm">
                      {search.trim()
                        ? `No proposals match "${search.trim()}"`
                        : filter === 'all' ? 'No proposals yet' : `No ${filter} proposals`}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {filteredProposals.map((p) => (
                      <ProposalListItem
                        key={p.id}
                        proposal={p}
                        onEdit={handleEdit}
                        onResubmit={handleResubmit}
                        onDelete={handleDelete}
                        resubmittingId={resubmittingId}
                        deletingId={deletingId}
                        variant="desktop"
                      />
                    ))}
                  </div>
                )}
              </div>
            </Tile>
          </div>

          {/* Right column: quick actions, then a plain (non-spanning, so
              safely auto-placed) 2-col grid of whichever medium tiles apply. */}
          <div className="flex flex-col gap-3 md:gap-4 md:flex-1 md:min-h-0">
            <Tile title="Quick actions" span="shrink-0">
              <div className="flex items-center gap-2">
                {(account?.is_editor || account?.is_administrator) && (
                  <button
                    onClick={() => setShowAddSong(true)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-accent/15 hover:bg-accent/25 text-accent text-xs font-semibold transition-colors"
                  >
                    <Plus size={12} /> New song
                  </button>
                )}
                <button
                  onClick={() => go('albums-admin')}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-surface-raised hover:bg-surface-highest text-text-secondary hover:text-text-primary text-xs font-semibold transition-colors"
                >
                  Edit albums
                </button>
              </div>
            </Tile>

            <div className="grid grid-cols-2 gap-3 md:gap-4 md:flex-1 md:min-h-0 auto-rows-[minmax(16rem,1fr)] md:auto-rows-[minmax(0,1fr)]">
              <Tile title="Leaderboard" icon={<Trophy size={13} />}>
                <div className="flex-1 overflow-y-auto min-h-0">
                  {loadingLeaderboard ? (
                    <div className="flex justify-center py-12">
                      <Loader2 size={18} className="animate-spin text-text-muted" />
                    </div>
                  ) : leaderboard.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-2 text-text-muted opacity-50">
                      <Trophy size={28} />
                      <p className="text-sm">No data</p>
                    </div>
                  ) : (
                    <LeaderboardRows entries={leaderboard} myUsername={account?.discord_username} />
                  )}
                </div>
              </Tile>

              {isContributor && (
                <Tile title="Comp Files" icon={<FolderOpen size={13} />}>
                  <div className="flex items-center gap-2 mb-2 shrink-0">
                    <CompFilterBar filter={compFilter} setFilter={setCompFilter} />
                    <button
                      onClick={() => go('contributor')}
                      className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-accent/15 hover:bg-accent/25 text-accent text-xs font-semibold transition-colors shrink-0"
                      title="Propose a comp file change"
                    >
                      <Plus size={12} /> New comp proposal
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto min-h-0">
                    <CompProposalList
                      proposals={filterCompProposals(compProposals, compFilter)}
                      loading={loadingComp}
                      onSelect={() => go('contributor')}
                      onWithdraw={handleWithdrawComp}
                      withdrawingId={withdrawingCompId}
                    />
                  </div>
                </Tile>
              )}

              {canReviewReports && (
                <Tile title="Reports" icon={<Flag size={13} />}>
                  <div className="flex-1 relative min-h-0 overflow-y-auto -mx-4 -mb-4 px-4 pb-4">
                    {loadingReports && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--bg)]/60 backdrop-blur-[1px]">
                        <Loader2 size={20} className="animate-spin text-text-muted" />
                      </div>
                    )}
                    <ReportsTab
                      reports={reports}
                      status={reportStatus}
                      setStatus={setReportStatus}
                      onChanged={() => setRefreshKey(k => k + 1)}
                    />
                  </div>
                </Tile>
              )}

              {canReviewStaff && (
                <button onClick={() => setMode('admin')} className="text-left min-h-0">
                  <Tile title={isAdmin ? 'Admin' : 'Manager'} icon={<ShieldCheck size={13} />} span="h-full hover:bg-[var(--surface-overlay)]/80 transition-colors cursor-pointer">
                    <div className="flex-1 flex flex-col items-center justify-center gap-2 text-text-muted">
                      <ShieldCheck size={28} />
                      <p className="text-sm text-center">
                        Open the {isAdmin ? 'admin' : 'manager'} review queues
                      </p>
                    </div>
                  </Tile>
                </button>
              )}
            </div>
          </div>

        </div>
      </div>

      {showAddSong && (
        <AddSongModal
          onClose={() => setShowAddSong(false)}
          onSubmitted={() => setRefreshKey(k => k + 1)}
          channel={activeChannel}
        />
      )}
    </div>
  )
}
