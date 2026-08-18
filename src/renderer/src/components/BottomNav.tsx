import { ReactNode, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Settings, ShieldCheck, MoreHorizontal } from 'lucide-react'
import { useStorePick } from '../store/useStore'
import { ViewType } from '../types'
import { showStaffProfile, staffProfileView, staffProfileLabel } from '../lib/userApi'
import { orderedNavItems, isNavItemVisible, navTabFor, tabEntryView } from '../lib/navItems'
import { useBackToClose } from '../hooks/useBackToClose'

// The mobile nav bar — the counterpart to the desktop Sidebar, which it now
// shares its destination list with. It used to hardcode its own four tabs,
// which meant Settings → Appearance → "Menu items" (order + show/hide) silently
// did nothing on a phone; the same maps drive both surfaces here.
//
// Placement follows the same `sidebarPosition` setting: only top/bottom are
// offered on mobile (a vertical rail doesn't fit a phone — see Settings), and
// `atTop` flips the border, the safe-area inset, and the active marker to the
// opposite edge.
//
// Hard-capped at 6 tabs total, Settings always the last of them — a phone-width
// row scrolling to reach an 8th or 9th enabled item (the original behavior) is
// worse than just not offering that many at once. When more items are enabled
// than fit, a "More" tab takes one of the direct slots and the rest live in a
// bottom sheet off of it — see moreTabs below. Nothing enabled on this device
// is ever unreachable on mobile the way it used to be (there's no Sidebar
// fallback here, unlike desktop).
const MAX_TABS = 6

interface Tab { view: ViewType; icon: ReactNode; label: string }

export default function BottomNav(): JSX.Element {
  const { activeView, setActiveView, toggleSettings, showSettings, setShowSettings, account, navVisibility, navOrder, sidebarPosition } =
    useStorePick('activeView', 'setActiveView', 'toggleSettings', 'showSettings', 'setShowSettings', 'account', 'navVisibility', 'navOrder', 'sidebarPosition')
  const profileView = staffProfileView(account)
  const atTop = sidebarPosition === 'top'

  // Shared with the side menu: orderedNavItems sanitizes the saved order,
  // isNavItemVisible drops anything toggled off.
  // NAV_ITEMS icons are sized for the 18px side menu; scale them up to a
  // touch-appropriate 24 without forking the definitions.
  const navItemTabs: Tab[] = orderedNavItems(navOrder)
    .filter((i) => isNavItemVisible(i, navVisibility, false))
    .map((item) => ({
      view: item.view,
      label: item.label,
      icon: <span className="[&_svg]:w-6 [&_svg]:h-6 [&_img]:w-7 [&_img]:h-7 flex items-center justify-center">{item.icon}</span>,
    }))

  // The staff profile isn't in NAV_ITEMS (it's a role-gated extra with no
  // desktop side-menu row), so it stays special-cased here and reads its
  // toggle out of the same map under its view id.
  const navShown = (view: ViewType): boolean => navVisibility[view] ?? true
  const extraTabs: Tab[] = []
  if (showStaffProfile(account) && navShown(profileView)) {
    extraTabs.push({
      view: profileView,
      icon: <ShieldCheck size={24} />,
      label: staffProfileLabel(account),
    })
  }

  // Settings has a guaranteed slot (it's the only route into Settings on
  // mobile), so the rest compete for the remaining MAX_TABS - 1 spots. Only
  // when that's not enough does "More" claim one of those spots for itself —
  // with few enough items enabled, every tab still shows directly and no
  // "More" button appears at all.
  const allTabs = [...navItemTabs, ...extraTabs]
  const overflow = allTabs.length > MAX_TABS - 1
  const tabs = overflow ? allTabs.slice(0, MAX_TABS - 2) : allTabs
  const moreTabs = overflow ? allTabs.slice(MAX_TABS - 2) : []
  // Settings is an overlay, not a view — activeView still points at whatever
  // was showing underneath it. Without checking showSettings here, that tab
  // stayed lit accent-colored the whole time Settings was open on top of it,
  // while the Settings button itself (hardcoded to tabCls(false) below) never
  // showed as current at all — neither end of the swap reflected reality.
  const moreActive = !showSettings && moreTabs.some((t) => navTabFor(activeView) === t.view)
  const [moreOpen, setMoreOpen] = useState(false)
  useBackToClose(() => setMoreOpen(false), moreOpen)

  // Shared by both the direct tabs and the "More" sheet's rows.
  const navigateTo = (view: ViewType): void => {
    // Re-tapping the already-active Playlists tab dispatches a back event
    // instead of going through setActiveView (it's a no-op there — same
    // view), so it needs its own close-Settings call to match every other
    // tab's behavior.
    if (activeView === view && view === 'playlists') {
      setShowSettings(false)
      window.dispatchEvent(new CustomEvent('playlists:back'))
    } else {
      // A tab holding several views (Games: Heardle/Wordle) reopens on
      // whichever one was last played.
      setActiveView(tabEntryView(view))
    }
  }

  const tabCls = (active: boolean): string =>
    `flex-1 min-w-0 flex flex-col items-center justify-center py-2.5 gap-1 transition-colors relative overflow-hidden ${
      active ? 'text-accent' : 'text-text-muted'
    }`
  const labelCls = 'text-[10px] font-semibold leading-none w-full text-center truncate px-0.5'
  const marker = (active: boolean): JSX.Element | null => active ? (
    <span
      className={`absolute ${atTop ? 'bottom-0' : 'top-0'} left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full`}
      style={{ background: 'var(--accent)' }}
    />
  ) : null

  // Published as a CSS var so other full-screen overlays (mobile Settings)
  // can carve out exactly this much space instead of covering the nav bar —
  // measured rather than hardcoded since it varies with the safe-area inset.
  // Zero on desktop, where this is display:none and the rule is a no-op.
  const navRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = navRef.current
    if (!el) return
    const publish = (): void => {
      document.documentElement.style.setProperty('--bottom-nav-height', `${el.offsetHeight}px`)
    }
    publish()
    const ro = new ResizeObserver(publish)
    ro.observe(el)
    return () => { ro.disconnect(); document.documentElement.style.setProperty('--bottom-nav-height', '0px') }
  }, [])

  return (
    <nav
      ref={navRef}
      className="md:hidden flex items-stretch bg-sidebar shrink-0"
      style={atTop
        ? { borderBottom: '1px solid var(--border)', paddingTop: 'env(safe-area-inset-top, 0px)' }
        : { borderTop: '1px solid var(--border)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {tabs.map((tab) => {
        const active = !showSettings && navTabFor(activeView) === tab.view
        return (
          <button key={tab.view} onClick={() => navigateTo(tab.view)} className={tabCls(active)}>
            {marker(active)}
            {tab.icon}
            <span className={labelCls}>{tab.label}</span>
          </button>
        )
      })}

      {moreTabs.length > 0 && (
        <button onClick={() => setMoreOpen(true)} className={tabCls(moreActive)}>
          {marker(moreActive)}
          <MoreHorizontal size={24} />
          <span className={labelCls}>More</span>
        </button>
      )}

      {/* Never hideable or counted against the cap: on mobile this is the
          only route into Settings. */}
      <button onClick={() => toggleSettings()} className={tabCls(showSettings)}>
        {marker(showSettings)}
        <Settings size={24} />
        <span className={labelCls}>Settings</span>
      </button>

      {moreOpen && createPortal(
        <>
          <div className="fixed inset-0 z-[60] bg-black/40" onClick={() => setMoreOpen(false)} />
          <div
            className="fixed z-[61] left-0 right-0 bottom-0 rounded-t-2xl bg-surface border border-[var(--border)] border-b-0 shadow-2xl max-h-[75svh] overflow-y-auto"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <div className="px-4 pt-4 pb-1">
              <h3 className="text-text-primary font-bold text-base">More</h3>
            </div>
            <div className="pb-2">
              {moreTabs.map((tab) => {
                const active = navTabFor(activeView) === tab.view
                return (
                  <button
                    key={tab.view}
                    onClick={() => { navigateTo(tab.view); setMoreOpen(false) }}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${
                      active ? 'text-accent bg-accent/10' : 'text-text-primary hover:bg-[var(--surface-overlay)] active:bg-[var(--surface-overlay)]'
                    }`}
                  >
                    {tab.icon}
                    <span className="text-sm font-medium">{tab.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </>,
        document.body
      )}
    </nav>
  )
}
