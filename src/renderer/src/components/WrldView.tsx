import { useIsMobile } from '../hooks/useIsMobile'
import WrldViewDesktop from './WrldView.desktop'
import WrldViewMobile from './WrldView.mobile'

export default function WrldView(): JSX.Element {
  const isMobile = useIsMobile()
  return isMobile ? <WrldViewMobile /> : <WrldViewDesktop />
}
