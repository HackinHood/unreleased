import { useIsMobile } from '../hooks/useIsMobile'
import HeardleViewDesktop from './HeardleView.desktop'
import HeardleViewMobile from './HeardleView.mobile'

export default function HeardleView(): JSX.Element {
  const isMobile = useIsMobile()
  return isMobile ? <HeardleViewMobile /> : <HeardleViewDesktop />
}
