import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Loader2, Trophy, FileEdit, ChevronLeft, RefreshCw, Plus, X, Search, Flag, ShieldCheck, FolderOpen } from 'lucide-react'
import { useStore } from '../store/useStore'
import { SongEditProposal } from '../lib/userApi'
import ReportsTab from './ReportsTab'
import AdminPage from './AdminPage'
import CompProposalList, { CompFilterBar, filterCompProposals } from './CompProposalList'
import RoleBadges from './RoleBadges'
import ProfileTabBar, { type ProfileTabDef } from './ProfileTabBar'
import ProposalListItem from './ProposalListItem'
import AddSongModal from './AddSongModal.desktop'
import { useStaffRoles } from '../hooks/useStaffRoles'
import { useMyProposals } from '../hooks/useMyProposals'
import { useLeaderboard } from '../hooks/useLeaderboard'
import { useMyCompProposals } from '../hooks/useMyCompProposals'
import { useReportsQueue } from '../hooks/useReportsQueue'
import { RANK_STYLES, type ProposalFilterTab } from '../lib/proposalSearch'

// Standardized card wrapper used by every panel on this page (My Proposals,
// Leaderboard, Comp tab, Reports tab) — the admin embed keeps its own
// wrapper untouched (Phase 4's job), everything else here shares this shape.
const CARD = 'rounded-2xl border border-[var(--border)] bg-surface-raised/50'

type ProfileTab = 'proposals' | 'reports' | 'admin' | 'comp'

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
  // Every list on this page — my proposals, my comp proposals, the Admin tab's
  // review queues — is already scoped to activeChannel (see the effects
  // below and AdminPage). ApiFilesView is the only other place that lets a
  // user change it; without a switcher here too, reviewing a second channel
  // meant leaving the profile to flip it in Files first.
  useEffect(() => { if (channels.length === 0) loadChannels().catch(() => {}) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [refreshKey, setRefreshKey] = useState(0)
  const [showAddSong, setShowAddSong] = useState(false)

  // Reports review (moved out of the Admin sidebar entry for editor-only
  // accounts — it now lives as a tab alongside their own proposals).
  // Not `|| is_administrator`: this tab lists proposals *you* submitted, and
  // an admin who never contributed has none. Their review queue is the Admin
  // tab's "Comp files" — the one place proposals are reviewed.
  // Managers review the same two queues admins do, so they get the same
  // embedded panel here. Scoped to the active channel — a manager grant on
  // one channel shouldn't leave this tab visible (and then erroring) on a
  // channel they don't actually manage.
  const { isContributor, isAdmin, isManager, canReviewReports, canReviewStaff } = useStaffRoles(account, activeChannel, channels)
  const [profileTab, setProfileTab] = useState<ProfileTab>('proposals')

  const {
    proposals, loading: loadingProposals, refreshing,
    filter, setFilter, search, setSearch, deletingId, resubmittingId,
    filteredProposals, handleDelete, handleResubmit, tabCount,
  } = useMyProposals(activeChannel, refreshKey)

  const { leaderboard, loading: loadingLeaderboard, myEntry } = useLeaderboard(refreshKey, activeChannel, account?.discord_username)

  const {
    compProposals, loading: loadingComp, filter: compFilter, setFilter: setCompFilter,
    withdrawingId: withdrawingCompId, handleWithdraw: handleWithdrawComp,
  } = useMyCompProposals(profileTab === 'comp' && isContributor, activeChannel, refreshKey, () => setRefreshKey(k => k + 1))

  const {
    reports, status: reportStatus, setStatus: setReportStatus, loading: loadingReports,
  } = useReportsQueue(profileTab === 'reports' && canReviewReports, refreshKey)

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

  const tabs: ProfileTabDef<ProfileTab>[] = [
    { id: 'proposals', label: 'Proposals', icon: <FileEdit size={13} /> },
    ...(isContributor ? [{ id: 'comp' as const, label: 'Comp files', icon: <FolderOpen size={13} /> }] : []),
    ...(canReviewReports ? [{ id: 'reports' as const, label: 'Reports', icon: <Flag size={13} /> }] : []),
    ...(canReviewStaff ? [{ id: 'admin' as const, label: isAdmin ? 'Admin' : 'Manager', icon: <ShieldCheck size={13} /> }] : []),
  ]

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

      {/* ── Header: identity row + stats row ── */}
      <div className="px-6 pb-5 pt-5 border-b border-[var(--border)] shrink-0">
        <div className="flex items-center justify-between mb-4">
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

        {/* Identity row */}
        <div className="flex items-center gap-4">
          {account?.discord_avatar ? (
            <img src={account.discord_avatar} alt="" className="w-14 h-14 rounded-full object-cover shrink-0 ring-2 ring-[var(--border)]" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xl font-bold shrink-0">
              {(account?.display_name || account?.discord_username || '?').charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-text-primary text-xl font-bold truncate">
                {account?.display_name || account?.discord_username || 'My Profile'}
              </h1>
              <RoleBadges isAdmin={isAdmin} isManager={isManager} isEditor={!!account?.is_editor} isContributor={isContributor} />
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {myEntry && (
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted flex items-center gap-1.5">
                  <Trophy size={11} className="text-accent" />
                  Rank #{myEntry.rank} · {myEntry.approved_count} approved
                </p>
              )}
              {!loadingProposals && (
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted opacity-70">
                  {proposals.length} proposal{proposals.length !== 1 ? 's' : ''} submitted
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      {(canReviewReports || isContributor || canReviewStaff) && (
        <div className="px-6 pt-3 shrink-0 border-b border-[var(--border)]">
          <ProfileTabBar tabs={tabs} active={profileTab} onChange={setProfileTab} variant="underline" />
        </div>
      )}

      {profileTab === 'admin' && canReviewStaff ? (
        <div className="flex-1 overflow-hidden p-4 md:p-5">
          <div className={`h-full ${CARD} overflow-hidden flex flex-col`}>
            <AdminPage embedded />
          </div>
        </div>
      ) : profileTab === 'comp' && isContributor ? (
        <div className="flex-1 overflow-hidden p-4 md:p-5">
          <div className={`h-full flex flex-col min-h-0 overflow-hidden ${CARD}`}>
            <div className="px-5 pt-4 pb-3 shrink-0 border-b border-[var(--border)]">
              <div className="flex items-center gap-2 mb-3">
                <FolderOpen size={13} className="text-text-muted" />
                <h2 className="text-text-secondary text-xs font-semibold uppercase tracking-widest">Comp Files</h2>
                {!loadingComp && (
                  <span className="text-text-muted text-sm">
                    {compProposals.length} total · {compProposals.filter(p => p.status === 'approved').length} approved
                  </span>
                )}
                <button
                  onClick={() => go('contributor')}
                  className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-accent/15 hover:bg-accent/25 text-accent text-xs font-semibold transition-colors"
                  title="Propose a comp file change"
                >
                  <Plus size={12} /> New comp proposal
                </button>
              </div>
              <CompFilterBar filter={compFilter} setFilter={setCompFilter} />
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 p-3">
              <CompProposalList
                proposals={filterCompProposals(compProposals, compFilter)}
                loading={loadingComp}
                onSelect={() => go('contributor')}
                onWithdraw={handleWithdrawComp}
                withdrawingId={withdrawingCompId}
              />
            </div>
          </div>
        </div>
      ) : profileTab === 'reports' && canReviewReports ? (
        <div className="flex-1 overflow-hidden p-5">
          <div className={`h-full ${CARD} overflow-hidden relative`}>
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
        </div>
      ) : (
      // Stacked below md — side by side, the fixed-width leaderboard left
      // the proposals column 2px wide on a phone.
      <div className="flex-1 flex flex-col md:flex-row gap-4 md:gap-5 overflow-hidden p-4 md:p-5">

        {/* ── Left: My Proposals ── */}
        <div className={`flex-1 flex flex-col min-h-0 overflow-hidden ${CARD}`}>
          {/* Section header */}
          <div className="px-5 pt-4 pb-3 shrink-0 border-b border-[var(--border)]">
            <div className="flex items-center gap-2 mb-3">
              <FileEdit size={13} className="text-text-muted" />
              <h2 className="text-text-secondary text-xs font-semibold uppercase tracking-widest">My Proposals</h2>
              {!loadingProposals && (
                <span className="text-text-muted text-sm">{proposals.length} total</span>
              )}
              {(account?.is_editor || account?.is_administrator) && (
                <div className="ml-auto flex items-center gap-1.5">
                  <button
                    onClick={() => go('albums-admin')}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-raised hover:bg-surface-highest text-text-secondary hover:text-text-primary text-xs font-semibold transition-colors"
                    title="Edit albums (wrlddata.json)"
                  >
                    Edit albums
                  </button>
                  <button
                    onClick={() => setShowAddSong(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-accent/15 hover:bg-accent/25 text-accent text-xs font-semibold transition-colors"
                    title="Propose a new song"
                  >
                    <Plus size={12} /> New song
                  </button>
                </div>
              )}
            </div>

            {/* Search */}
            <div className="relative mb-3">
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

            {/* Filter tabs */}
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

          {/* Proposals list */}
          <div className="flex-1 overflow-y-auto min-h-0 p-3">
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
        </div>

        {/* ── Right: Leaderboard ── */}
        {/* Mobile: fixed-height strip under the proposals list (which keeps
            the remaining height); desktop: full-height side column. */}
        <div className={`h-44 md:h-auto w-full md:w-80 flex flex-col min-h-0 overflow-hidden shrink-0 ${CARD}`}>
          <div className="px-5 pt-4 pb-3 shrink-0 flex items-center gap-2 border-b border-[var(--border)]">
            <Trophy size={13} className="text-text-muted" />
            <h2 className="text-text-secondary text-xs font-semibold uppercase tracking-widest">Leaderboard</h2>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 p-3">
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
              <div className="space-y-1">
                {leaderboard.map((entry) => {
                  const isMe = entry.discord_username === account?.discord_username
                  const rankStyle = RANK_STYLES[entry.rank]
                  return (
                    <div
                      key={entry.user_id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                        isMe ? 'bg-accent/8 ring-1 ring-accent/20' : 'hover:bg-surface-overlay'
                      }`}
                    >
                      {/* Rank */}
                      <span className={`w-5 shrink-0 flex items-center justify-center`}>
                        <span className={`text-sm tabular-nums rounded-md px-1 py-0.5 ${
                          rankStyle ? `${rankStyle.num} ${rankStyle.badge}` : 'text-text-muted font-medium'
                        }`}>
                          {entry.rank}
                        </span>
                      </span>

                      {/* Avatar */}
                      {entry.discord_avatar ? (
                        <img src={entry.discord_avatar} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-surface-raised flex items-center justify-center text-xs text-text-muted shrink-0">
                          {(entry.discord_username || '?').charAt(0).toUpperCase()}
                        </div>
                      )}

                      {/* Name */}
                      <p className={`flex-1 min-w-0 text-sm truncate ${isMe ? 'text-accent font-semibold' : 'text-text-primary'}`}>
                        {entry.username || entry.discord_username}
                        {isMe && <span className="ml-1.5 text-xs opacity-60 font-normal">you</span>}
                      </p>

                      {/* Approved count */}
                      <span className={`text-sm tabular-nums shrink-0 font-semibold ${isMe ? 'text-accent' : rankStyle ? rankStyle.num : 'text-text-muted'}` }>
                        {entry.approved_count}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      )}

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
