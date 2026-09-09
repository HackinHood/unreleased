import { useStorePick } from '../store/useStore'
import { orderedNavItems, isNavItemVisible, splitMobileNavTabs, type NavItemDef } from '../lib/navItems'

// The mobile bottom nav's visible items, ordered and filtered exactly like
// BottomNav does — pulled out so BottomNav, HomeView (the "More" trigger),
// and MoreNavSheet (its contents) all agree on what's direct vs. overflowed.
function useMobileNavItems(): NavItemDef[] {
  const { navVisibility, navOrder } = useStorePick('navVisibility', 'navOrder')
  // WRLD excluded here only — tapping the mini player already opens it, so a
  // second entry point in the tab bar is redundant on mobile.
  return orderedNavItems(navOrder).filter((i) => i.view !== 'wrld' && isNavItemVisible(i, navVisibility, false, true))
}

export function useMobileNavSplit(): { tabs: NavItemDef[]; moreTabs: NavItemDef[] } {
  return splitMobileNavTabs(useMobileNavItems())
}
