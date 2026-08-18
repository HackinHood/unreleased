import { useIsMobile } from '../hooks/useIsMobile'
import SettingsDesktop from './Settings.desktop'
import SettingsMobile from './Settings.mobile'

// `floating` only applies to the Electron pop-out window path (a desktop-only
// concept — see Settings.desktop.tsx). Mobile has no pop-out windows, so it's
// accepted here just to keep the two variants swappable and ignored below.
export default function Settings({ floating = false }: { floating?: boolean }): JSX.Element {
  const isMobile = useIsMobile()
  return isMobile ? <SettingsMobile /> : <SettingsDesktop floating={floating} />
}
