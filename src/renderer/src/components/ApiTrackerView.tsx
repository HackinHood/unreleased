import { useIsMobile } from '../hooks/useIsMobile'
import ApiTrackerViewDesktop from './ApiTrackerView.desktop'
import ApiTrackerViewMobile from './ApiTrackerView.mobile'

export default function ApiTrackerView(): JSX.Element {
  const isMobile = useIsMobile()
  return isMobile ? <ApiTrackerViewMobile /> : <ApiTrackerViewDesktop />
}
