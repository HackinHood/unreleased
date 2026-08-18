import { useIsMobile } from '../hooks/useIsMobile'
import StatsViewDesktop from './StatsView.desktop'
import StatsViewMobile from './StatsView.mobile'

export default function StatsView(): JSX.Element {
  const isMobile = useIsMobile()
  return isMobile ? <StatsViewMobile /> : <StatsViewDesktop />
}
