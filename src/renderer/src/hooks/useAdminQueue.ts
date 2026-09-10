// Extracts AdminPage's load() effect, tab state, refreshKey, per-tab data,
// and the pendingApps/pendingProps/pendingReports/fullNav/nav derivation —
// the highest-leverage extraction in the rewrite given the near-total
// hook-name overlap already observed between AdminPage.desktop.tsx and
// .mobile.tsx.
//
// Desktop and mobile differ in two real ways that this hook preserves via
// its options rather than papering over:
//   1. The top-level load() gate. Desktop allows managers in (canLoad =
//      isFullAdmin || isManager) so they can load the Song edits queue too;
//      mobile only allows load() to run for full admins (canLoad = isAdmin),
//      because mobile forces managers onto the Comp files tab exclusively
//      (see forceTab below) and that tab fetches its own data independently
//      inside CompProposalsTab.mobile — it was never fed by this hook.
//   2. Which tabs a manager's nav shows: desktop gives managers both
//      "Song edits" and "Comp files" (managerNavIds), mobile gives managers
//      only "Comp files". Both are deliberate, pre-existing differences —
//      not something to unify here.
import { useCallback, useEffect, useState } from 'react'
import * as userApi from '../lib/userApi'
import { CONTRIBUTOR_ENABLED } from '../lib/userApi'
import type { AdminUser, EditorApplication, ProposalStatus, SongEditProposal } from '../lib/userApi'
import * as reportsApi from '../lib/reportsApi'
import type { SongReportRow, SongReportStatus } from '../lib/reportsApi'

export type AdminTab = 'proposals' | 'comp-proposals' | 'applications' | 'reports' | 'users' | 'stats' | 'security' | 'channels'

export interface AdminNavItem {
  id: AdminTab
  label: string
  iconKey: 'proposals' | 'comp-proposals' | 'applications' | 'reports' | 'users' | 'stats' | 'channels' | 'security'
  badge?: number
}

export interface UseAdminQueueOptions {
  /** Overall gate for load() — desktop: isFullAdmin || isManager. mobile: isAdmin only. */
  canLoad: boolean
  isFullAdmin: boolean
  /** Desktop gates applications/reports/users/stats fetches on `isFullAdmin &&`
   *  (managers can reach the proposals tab, but not those). Mobile has no such
   *  gate in the body — canLoad already restricted the whole function to
   *  full admins, so pass false here to fetch unconditionally once inside. */
  gateNonProposalTabs: boolean
  activeChannel: string
  initialTab: AdminTab
  /** Mobile-only: forces the tab to a fixed value while `when` is true (handles
   *  account loading in after mount and flipping managerOnly from false to
   *  true). Omit on desktop, which has no equivalent re-forcing effect. */
  forceTab?: { when: boolean; tab: AdminTab }
  /** Tab ids visible to a non-full-admin (manager) in the nav, filtered out of
   *  fullNav. Desktop: ['proposals', 'comp-proposals']. Mobile: ['comp-proposals']. */
  managerNavIds: AdminTab[]
}

export function useAdminQueue(opts: UseAdminQueueOptions) {
  const { canLoad, isFullAdmin, gateNonProposalTabs, activeChannel, initialTab, forceTab, managerNavIds } = opts

  const [tab, setTab] = useState<AdminTab>(initialTab)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [applications, setApplications] = useState<EditorApplication[]>([])
  const [propStatus, setPropStatus] = useState<ProposalStatus | ''>('pending')
  const [proposals, setProposals] = useState<SongEditProposal[]>([])
  const [users, setUsers] = useState<AdminUser[]>([])
  const [reportStatus, setReportStatus] = useState<SongReportStatus | ''>('pending')
  const [reports, setReports] = useState<SongReportRow[]>([])

  const load = useCallback(async () => {
    if (!canLoad) return
    setLoading(true); setError(null)
    try {
      if (tab === 'proposals') {
        setProposals(await userApi.adminListProposals(propStatus || undefined, activeChannel))
      } else if ((!gateNonProposalTabs || isFullAdmin) && tab === 'applications') {
        setApplications(await userApi.adminListApplications())
      } else if ((!gateNonProposalTabs || isFullAdmin) && tab === 'reports') {
        setReports(await reportsApi.listSongReports(reportStatus || undefined))
      } else if ((!gateNonProposalTabs || isFullAdmin) && (tab === 'users' || tab === 'stats')) {
        setUsers(await userApi.adminListUsers())
        if (tab === 'stats') {
          setApplications(await userApi.adminListApplications())
          setProposals(await userApi.adminListProposals(undefined, activeChannel))
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
      // Don't leave the previous channel's/tab's data on screen underneath the
      // error — it's stale and its action buttons (approve/reject etc.) would
      // still be live against the wrong channel context.
      if (tab === 'proposals') setProposals([])
      else if (tab === 'applications') setApplications([])
      else if (tab === 'reports') setReports([])
      else if (tab === 'users' || tab === 'stats') setUsers([])
    }
    finally { setLoading(false) }
  }, [tab, canLoad, isFullAdmin, gateNonProposalTabs, propStatus, reportStatus, activeChannel])

  useEffect(() => { load() }, [load, refreshKey])

  // Mobile-only re-forcing effect: account can still be loading when the page
  // first mounts (deep link, page refresh) — managerOnly flips from false to
  // true once it lands, and the tab set at mount time would otherwise strand
  // a manager on a tab their nav bar no longer offers a button for.
  useEffect(() => {
    if (forceTab?.when && tab !== forceTab.tab) setTab(forceTab.tab)
  }, [forceTab?.when, forceTab?.tab, tab])

  const pendingApps    = applications.filter(a => a.status === 'pending').length
  const pendingProps   = tab !== 'proposals' ? proposals.filter(p => p.status === 'pending').length : 0
  const pendingReports = tab !== 'reports' ? reports.filter(r => r.status === 'pending').length : 0

  const fullNav: AdminNavItem[] = [
    { id: 'proposals',    label: 'Song edits',   iconKey: 'proposals',   badge: pendingProps || undefined },
    ...(CONTRIBUTOR_ENABLED ? [{ id: 'comp-proposals' as const, label: 'Comp files', iconKey: 'comp-proposals' as const }] : []),
    { id: 'applications', label: 'Applications', iconKey: 'applications', badge: pendingApps || undefined },
    { id: 'reports',      label: 'Reports',      iconKey: 'reports',      badge: pendingReports || undefined },
    { id: 'users',        label: 'Users',        iconKey: 'users' },
    { id: 'stats',        label: 'Stats',        iconKey: 'stats' },
    { id: 'channels',     label: 'Channels',     iconKey: 'channels' },
    { id: 'security',     label: 'Security',     iconKey: 'security' },
  ]
  const nav = isFullAdmin ? fullNav : fullNav.filter(n => managerNavIds.includes(n.id))

  return {
    tab, setTab,
    loading,
    error,
    refreshKey, refresh: () => setRefreshKey(k => k + 1),
    applications, setApplications,
    propStatus, setPropStatus,
    proposals, setProposals,
    users, setUsers,
    reportStatus, setReportStatus,
    reports, setReports,
    pendingApps, pendingProps, pendingReports,
    fullNav, nav,
  }
}
