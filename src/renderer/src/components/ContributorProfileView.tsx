import { useState } from 'react'
import { RefreshCw, ChevronLeft, Plus, FolderOpen } from 'lucide-react'
import { useStorePick } from '../store/useStore'
import RoleBadges from './RoleBadges'
import { useStaffRoles } from '../hooks/useStaffRoles'
import { useMyCompProposals } from '../hooks/useMyCompProposals'
import CompProposalList, { CompFilterBar, filterCompProposals } from './CompProposalList'

// A contributor-only account's home. Reviewing other people's proposals is
// deliberately NOT here — that queue lives in exactly one place, the Admin
// page's "Comp files" tab, reachable from the editor profile.

// Matches EditorProfileView's Phase-3 card treatment — the one visual
// convention shared across every panel in this rewrite.
const CARD = 'rounded-2xl border border-[var(--border)] bg-surface-raised/50'

export default function ContributorProfileView(): JSX.Element {
  const { account, setActiveView, activeChannel, channels } = useStorePick('account', 'setActiveView', 'activeChannel', 'channels')
  const go = setActiveView
  const [refreshKey, setRefreshKey] = useState(0)

  const { isContributor, isAdmin, isManager, isEditor } = useStaffRoles(account, activeChannel, channels)

  const {
    compProposals: proposals, loading, filter, setFilter, withdrawingId, handleWithdraw: withdraw,
  } = useMyCompProposals(isContributor, activeChannel, refreshKey, () => setRefreshKey(k => k + 1))

  const filtered = filterCompProposals(proposals, filter)
  const approvedCount = proposals.filter(p => p.status === 'approved').length

  if (!account) {
    return (
      <div className="flex-1 min-w-0 flex items-center justify-center h-full text-text-muted text-sm">Sign in to view your contributor profile.</div>
    )
  }

  if (!isContributor) {
    return (
      <div className="flex-1 min-w-0 flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
        <p className="text-sm text-text-muted">You are not a contributor yet.</p>
        <button onClick={() => go('contributor')} className="px-4 py-2 rounded-xl bg-accent text-white text-sm font-semibold">Apply or submit</button>
      </div>
    )
  }

  return (
    <div className="flex-1 min-w-0 h-full flex flex-col overflow-hidden">
      <div className="shrink-0 px-5 py-4 border-b border-[var(--border)] flex items-center gap-3">
        <button onClick={() => go('api-tracker')} className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-raised transition-colors md:hidden">
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base font-bold text-text-primary truncate">{account.display_name || account.discord_username}</h1>
            <RoleBadges isAdmin={isAdmin} isManager={isManager} isEditor={isEditor} isContributor={isContributor} />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mt-1">
            {approvedCount} approved
          </p>
        </div>
        {(isEditor || isManager) && (
          <button onClick={() => go('editor-profile')} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-raised text-text-secondary hover:text-text-primary transition-colors">
            {isEditor ? 'Editor profile' : 'Manager profile'}
          </button>
        )}
        <button onClick={() => go('contributor')} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent text-white flex items-center gap-1.5">
          <Plus size={14} /> New proposal
        </button>
        <button onClick={() => go('api-files')} className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-raised transition-colors" title="Browse comp files">
          <FolderOpen size={16} />
        </button>
        <button onClick={() => setRefreshKey(k => k + 1)} className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-raised transition-colors">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-5">
        <div className={`${CARD} flex flex-col min-h-0`}>
          <div className="px-5 pt-4 pb-3 border-b border-[var(--border)]">
            <CompFilterBar filter={filter} setFilter={setFilter} />
          </div>
          <div className="p-3">
            <CompProposalList
              proposals={filtered}
              loading={loading}
              onSelect={() => go('contributor')}
              onWithdraw={withdraw}
              withdrawingId={withdrawingId}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
