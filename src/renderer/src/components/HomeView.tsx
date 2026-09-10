import { useIsMobile } from '../hooks/useIsMobile'
import HomeViewMobile from './HomeView.mobile'
import HomeViewDesktop from './HomeView.desktop'

// Home has a shell per breakpoint: the same sections and the same data
// (hooks/useHomeData), laid out as phone rails or as a desktop dashboard.
export default function HomeView(): JSX.Element {
  const isMobile = useIsMobile()
  return isMobile ? <HomeViewMobile /> : <HomeViewDesktop />
}
