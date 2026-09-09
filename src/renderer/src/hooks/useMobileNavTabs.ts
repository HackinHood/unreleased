import { useStorePick } from '../store/useStore'
import { orderedNavItems, isNavItemVisible, splitMobileNavTabs, type NavItemDef } from '../lib/navItems'
import type { ViewType } from '../types'

// Games ('heardle' — see NAV_ITEMS) and Playlists: Home's own sections cover
// both directly, so a tab here would just be a second, less complete route
// to the same destination.
const MOBILE_HIDDEN_VIEWS: ViewType[] = ['heardle', 'playlists']

// The mobile bottom nav's visible items, ordered and filtered exactly like
// BottomNav does — pulled out so BottomNav, HomeView (the "More" trigger),
// and MoreNavSheet (its contents) all agree on what's direct vs. overflowed.
function useMobileNavItems(): NavItemDef[] {
  const { navVisibility, navOrder } = useStorePick('navVisibility', 'navOrder')
  return orderedNavItems(navOrder).filter((i) => !MOBILE_HIDDEN_VIEWS.includes(i.view) && isNavItemVisible(i, navVisibility, false, true))
}

export function useMobileNavSplit(): { tabs: NavItemDef[]; moreTabs: NavItemDef[] } {
  return splitMobileNavTabs(useMobileNavItems())
}
