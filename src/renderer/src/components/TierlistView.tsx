import { useIsMobile } from '../hooks/useIsMobile'
import TierlistViewDesktop from './TierlistView.desktop'
import TierlistViewMobile from './TierlistView.mobile'

export default function TierlistView(): JSX.Element {
  const isMobile = useIsMobile()
  return isMobile ? <TierlistViewMobile /> : <TierlistViewDesktop />
}
