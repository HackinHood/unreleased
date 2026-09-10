import { useEffect, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Loader2, Trophy, FileEdit, RefreshCw, Plus, X, Search, Flag, ShieldCheck, FolderOpen } from 'lucide-react'
import { useStore } from '../store/useStore'
import { SongEditProposal } from '../lib/userApi'
import ReportsTab from './ReportsTab.mobile'
import AdminPage from './AdminPage.mobile'
import CompProposalList, { CompFilterBar, filterCompProposals } from './CompProposalList'
import RoleBadges from './RoleBadges'
import ProfileTabBar, { type ProfileTabDef } from './ProfileTabBar'
import ProposalListItem from './ProposalListItem'
import AddSongModal from './AddSongModal.mobile'
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
  const { isContributor, isAdmin, isManager, canReviewReports, canReviewStaff } = useStaffRoles(account, activeChannel, channels)
  // Managers only get the Admin tab (renamed "Manager" for them below) — they
  // have no song-edit or report-review power, so they land there directly
  // rather than on a Proposals tab that'll always be empty for them.
  const managerOnly = isManager && !isAdmin
  const [profileTab, setProfileTab] = useState<ProfileTab>(managerOnly ? 'admin' : 'proposals')

  const {
    proposals, loading: loadingProposals, refreshing,
    filter, setFilter, search, setSearch, deletingId, resubmittingId,
    filteredProposals, handleDelete, handleResubmit, tabCount,
  } = useMyProposals(activeChannel, refreshKey)

  const { leaderboard, loading: loadingLeaderboard, myEntry } = useLeaderboard(refreshKey, activeChannel, account?.discord_username)

  // Mobile has never wired an onWithdraw handler through to CompProposalList
  // (unlike desktop's Comp tab) — withdrawingId/handleWithdraw are available
  // from the hook but intentionally unused below, matching that existing gap.
  const {
    compProposals, loading: loadingComp, filter: compFilter, setFilter: setCompFilter,
  } = useMyCompProposals(profileTab === 'comp' && isContributor, activeChannel, refreshKey, () => setRefreshKey(k => k + 1))

  const {
    reports, status: reportStatus, setStatus: setReportStatus, loading: loadingReports,
  } = useReportsQueue(profileTab === 'reports' && canReviewReports, refreshKey)

  const handleEdit = (p: SongEditProposal): void => {
    // p.song is null for 'create' proposals (new song, no backing record yet) —
    // EditorPage handles that case, so don't block it here.
    setPendingEditProposal({ id: p.id, songId: p.song, proposedData: p.proposed_data, editorNotes: p.editor_notes || '' })
    setPendingEditorSongId(p.song)
    setActiveView('editor')
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
    ...(isAdmin ? [{ id: 'admin' as const, label: 'Admin', icon: <ShieldCheck size={13} /> }]
      : isManager ? [{ id: 'admin' as const, label: 'Manager', icon: <ShieldCheck size={13} /> }] : []),
  ]

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

      {/* ── Header: identity row + stats/role row ── */}
      <div className="shrink-0 px-2 pt-1">
        <div className="flex items-center gap-1">
          <div className="flex-1 min-w-0 pl-2.5 flex items-center gap-3">
            {account?.discord_avatar ? (
              <img src={account.discord_avatar} alt="" className="w-11 h-11 rounded-full object-cover shrink-0 ring-2 ring-[var(--border)]" />
            ) : (
              <div className="w-11 h-11 rounded-full bg-accent/20 text-accent flex items-center justify-center text-lg font-bold shrink-0">
                {(account?.display_name || account?.discord_username || '?').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-text-primary text-[17px] font-bold leading-tight truncate">
                {account?.display_name || account?.discord_username || 'My Profile'}
              </h1>
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted truncate">
                {myEntry
                  ? `Rank #${myEntry.rank} · ${myEntry.approved_count} approved`
                  : !loadingProposals ? `${proposals.length} proposal${proposals.length !== 1 ? 's' : ''} submitted` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            disabled={refreshing}
            className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full text-text-muted active:bg-surface-overlay transition-colors disabled:opacity-40"
            title="Refresh"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Roles + actions row */}
        <div className="flex items-center gap-1.5 pl-2.5 pt-1.5 pb-1 flex-wrap">
          <RoleBadges isAdmin={isAdmin} isManager={isManager} isEditor={!!account?.is_editor} isContributor={isContributor} />
          {channels.length > 1 && (
            <div className="flex items-center bg-surface-overlay rounded-full p-0.5 gap-0.5 shrink-0">
              {channels.map((ch) => (
                <button
                  key={ch.slug}
                  onClick={() => setActiveChannel(ch.slug)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${activeChannel === ch.slug ? 'bg-surface-raised text-text-primary' : 'text-text-muted'}`}
                  title={ch.description || ch.name}
                >{ch.name}</button>
              ))}
            </div>
          )}
          {(account?.is_editor || account?.is_administrator) && (
            <button
              onClick={() => setShowAddSong(true)}
              className="flex items-center gap-1 h-7 px-2.5 rounded-full bg-accent/15 active:bg-accent/25 text-accent text-[11px] font-semibold transition-colors ml-auto"
            >
              <Plus size={11} /> New song
            </button>
          )}
          {profileTab === 'comp' && isContributor && (
            <button
              onClick={() => setActiveView('contributor')}
              className={`flex items-center gap-1 h-7 px-2.5 rounded-full bg-accent/15 active:bg-accent/25 text-accent text-[11px] font-semibold transition-colors ${
                (account?.is_editor || account?.is_administrator) ? '' : 'ml-auto'
              }`}
            >
              <Plus size={11} /> New comp proposal
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      {(canReviewReports || isContributor || isManager) && (
        <div className="px-2 pt-1 pb-2 shrink-0">
          <ProfileTabBar tabs={tabs} active={profileTab} onChange={setProfileTab} variant="pill" />
        </div>
      )}

      {profileTab === 'admin' && (isAdmin || isManager) ? (
        <AdminPage embedded />
      ) : profileTab === 'comp' && isContributor ? (
        <div className="flex-1 overflow-y-auto p-3">
          <div className={`flex flex-col min-h-0 overflow-hidden ${CARD}`}>
            <div className="px-4 pt-3 pb-3 shrink-0 border-b border-[var(--border)]">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <CompFilterBar filter={compFilter} setFilter={setCompFilter} />
              </div>
              <p className="text-sm text-text-muted">
                {compProposals.filter(p => p.status === 'approved').length} approved comp proposals
              </p>
            </div>
            <div className="p-3">
              <CompProposalList
                proposals={filterCompProposals(compProposals, compFilter)}
                loading={loadingComp}
                onSelect={() => setActiveView('contributor')}
              />
            </div>
          </div>
        </div>
      ) : profileTab === 'reports' && canReviewReports ? (
        <div className="flex-1 overflow-hidden relative">
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
      ) : (
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── My Proposals ── */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Section header */}
          <div className="px-3 pt-1 pb-2 shrink-0">
            {/* Search */}
            <div className="relative mb-2">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search proposals…"
                className="w-full bg-surface-overlay text-text-primary text-sm pl-9 pr-9 py-2.5 rounded-xl outline-none border border-transparent focus:border-accent/40 placeholder:text-text-muted"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-text-muted active:text-text-primary">
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2 overflow-x-auto scrollbar-none">
              {FILTER_TABS.map(({ key, label }) => {
                const count = tabCount(key)
                const active = filter === key
                return (
                  <button
                    key={key}
                    onClick={() => setFilter(key)}
                    className={`shrink-0 flex items-center gap-1 h-8 px-3 rounded-full text-xs font-semibold transition-colors ${
                      active ? 'bg-accent/15 text-accent' : 'text-text-muted bg-surface-overlay'
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
          <div className="flex-1 overflow-y-auto min-h-0 px-3 pb-3">
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
                    variant="mobile"
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Leaderboard ── */}
        <div className={`h-56 shrink-0 flex flex-col min-h-0 overflow-hidden mx-3 mb-3 ${CARD}`}>
          <div className="px-4 pt-3 pb-2 shrink-0 flex items-center gap-2 border-b border-[var(--border)]">
            <Trophy size={13} className="text-text-muted" />
            <h2 className="text-text-secondary text-xs font-semibold uppercase tracking-widest">Leaderboard</h2>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 px-3 pb-2">
            {loadingLeaderboard ? (
              <div className="flex justify-center py-8">
                <Loader2 size={18} className="animate-spin text-text-muted" />
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-text-muted opacity-50">
                <Trophy size={24} />
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
                      className={`flex items-center gap-3 px-2 py-2 rounded-xl transition-colors ${
                        isMe ? 'bg-accent/8 ring-1 ring-accent/20' : ''
                      }`}
                    >
                      {/* Rank */}
                      <span className="w-5 shrink-0 flex items-center justify-center">
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
