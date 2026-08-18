import { useIsMobile } from '../hooks/useIsMobile'
import EqualizerPanelDesktop from './EqualizerPanel.desktop'
import EqualizerPanelMobile from './EqualizerPanel.mobile'

export default function EqualizerPanel(): JSX.Element {
  const isMobile = useIsMobile()
  return isMobile ? <EqualizerPanelMobile /> : <EqualizerPanelDesktop />
}
