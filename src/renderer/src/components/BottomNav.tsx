import { SearchCode, Settings, ShieldCheck, ListMusic, Disc, Gamepad2 } from 'lucide-react'
import logo from '../assets/logo.png'
import { useStore, useStorePick } from '../store/useStore'
import { ViewType } from '../types'
import { navTabFor, tabEntryView } from '../lib/navItems'
import { showStaffProfile, staffProfileView, staffProfileLabel } from '../lib/userApi'

export default function BottomNav(): JSX.Element {
  const { activeView, setActiveView, openProfile, toggleSettings, account, navVisibility } = useStorePick('activeView', 'setActiveView', 'openProfile', 'toggleSettings', 'account', 'navVisibility')
  const isAdmin = !!account?.is_administrator
  const isEditor = !!account?.is_editor
  const profileView = staffProfileView(account)
  const navShown = (view: ViewType): boolean => navVisibility[view] ?? true
  const profileTabVisible = showStaffProfile(account) && navShown(profileView)
  const showAlbums = (isAdmin || isEditor) && navShown('albums-admin')

  const items: { icon: React.ReactNode; label: string; view: ViewType }[] = [
    { icon: <img src={logo} alt="WRLD" className="w-8 h-8 object-contain" />, label: 'WRLD', view: 'wrld' },
    { icon: <SearchCode size={24} />, label: 'Tracker', view: 'api-tracker' },
    { icon: <ListMusic size={24} />, label: 'Playlists', view: 'playlists' },
    { icon: <Gamepad2 size={24} />, label: 'Games', view: 'heardle' },
    ...(showAlbums
      ? [{ icon: <Disc size={24} />, label: 'Albums', view: 'albums-admin' as ViewType }]
      : []),
  ]

  return (
    <nav className="md:hidden flex items-stretch bg-sidebar shrink-0" style={{ borderTop: '1px solid var(--border)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      {items.map(({ icon, label, view }) => {
        // Sub-views count as their tab — switching game inside Games must not
        // put the bar in a state where nothing looks selected. See navTabFor.
        const active = navTabFor(activeView) === view
        return (
          <button
            key={view}
            onClick={() => {
              if (activeView === view && view === 'playlists') {
                window.dispatchEvent(new CustomEvent('playlists:back'))
              } else {
                // A tab holding several views reopens on the one last used.
                setActiveView(tabEntryView(view))
              }
            }}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-colors relative overflow-hidden ${active ? 'text-accent' : 'text-text-muted'}`}
          >
            {active && (
              <span
                className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                style={{ background: 'var(--accent)' }}
              />
            )}
            {icon}
            <span className="text-[10px] font-semibold leading-none w-full text-center truncate px-0.5">
              {label}
            </span>
          </button>
        )
      })}
      {/* Admin review tools live inside the editor profile page (Admin tab)
          now — one profile entry for both roles instead of a separate Admin
          view in the nav. Hideable via Settings (see showEditorTab). */}
      {profileTabVisible && (
        <button
          onClick={openProfile}
          className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition-colors overflow-hidden relative ${activeView === profileView ? 'text-accent' : 'text-text-muted'}`}
        >
          {activeView === profileView && (
            <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full" style={{ background: 'var(--accent)' }} />
          )}
          <ShieldCheck size={24} />
          <span className="text-[10px] font-semibold leading-none w-full text-center truncate px-0.5">
            {staffProfileLabel(account)}
          </span>
        </button>
      )}
      <button
        onClick={() => toggleSettings()}
        className="flex-1 flex flex-col items-center justify-center py-2.5 gap-1 text-text-muted transition-colors overflow-hidden"
      >
        <Settings size={24} />
        <span className="text-[10px] font-semibold leading-none w-full text-center truncate px-0.5">Settings</span>
      </button>
    </nav>
  )
}
