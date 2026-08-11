import { useEffect, useState } from 'react'
import { RefreshCw, ChevronLeft, Plus, FolderOpen } from 'lucide-react'
import { useStorePick } from '../store/useStore'
import { navigateFromWindow } from '../lib/windowSync'
import * as userApi from '../lib/userApi'
import type { CompFileProposal } from '../lib/userApi'
import { CONTRIBUTOR_ENABLED } from '../lib/userApi'
import CompProposalList, { CompFilterBar, filterCompProposals, type CompFilterTab } from './CompProposalList'

// A contributor-only account's home. Reviewing other people's proposals is
// deliberately NOT here — that queue lives in exactly one place, the Admin
// page's "Comp files" tab, reachable from the editor profile.

export default function ContributorProfileView(): JSX.Element {
  const { account } = useStorePick('account')
  // Also renders as its own window (FloatApp's `profile` view), where
  // setActiveView goes nowhere — see navigateFromWindow.
  const go = navigateFromWindow
  const [proposals, setProposals] = useState<CompFileProposal[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<CompFilterTab>('all')
  const [refreshKey, setRefreshKey] = useState(0)
  const [withdrawingId, setWithdrawingId] = useState<number | null>(null)

  const isContributor = CONTRIBUTOR_ENABLED && !!(account?.is_contributor || account?.is_administrator)

  useEffect(() => {
    if (!isContributor) {
      setLoading(false)
      return
    }
    setLoading(true)
    userApi.getMyCompProposals().then(setProposals).catch(() => {}).finally(() => setLoading(false))
  }, [isContributor, refreshKey])

  const withdraw = async (id: number): Promise<void> => {
    setWithdrawingId(id)
    try {
      await userApi.withdrawCompProposal(id)
      setProposals(prev => prev.filter(p => p.id !== id))
    } catch {
      setRefreshKey(k => k + 1)
    } finally {
      setWithdrawingId(null)
    }
  }

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
          <h1 className="text-base font-bold text-text-primary">{account.display_name || account.discord_username}</h1>
          <p className="text-xs text-text-muted">
            Contributor · {approvedCount} approved
            {account.is_editor ? ' · also editor' : ''}
          </p>
        </div>
        {account.is_editor && (
          <button onClick={() => go('editor-profile')} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-raised text-text-secondary hover:text-text-primary transition-colors">
            Editor profile
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

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="mb-4">
          <CompFilterBar filter={filter} setFilter={setFilter} />
        </div>
        <CompProposalList
          proposals={filtered}
          loading={loading}
          onSelect={() => go('contributor')}
          onWithdraw={withdraw}
          withdrawingId={withdrawingId}
        />
      </div>
    </div>
  )
}
