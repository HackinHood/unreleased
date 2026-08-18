import { useIsMobile } from '../hooks/useIsMobile'
import WordleViewDesktop from './WordleView.desktop'
import WordleViewMobile from './WordleView.mobile'

export default function WordleView(): JSX.Element {
  const isMobile = useIsMobile()
  return isMobile ? <WordleViewMobile /> : <WordleViewDesktop />
}
