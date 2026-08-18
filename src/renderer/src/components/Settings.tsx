import { useIsMobile } from '../hooks/useIsMobile'
import SettingsDesktop from './Settings.desktop'
import SettingsMobile from './Settings.mobile'

export default function Settings(): JSX.Element {
  const isMobile = useIsMobile()
  return isMobile ? <SettingsMobile /> : <SettingsDesktop />
}
