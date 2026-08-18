import { useIsMobile } from '../hooks/useIsMobile'
import PlaylistsViewDesktop from './PlaylistsView.desktop'
import PlaylistsViewMobile from './PlaylistsView.mobile'

export default function PlaylistsView(): JSX.Element {
  const isMobile = useIsMobile()
  return isMobile ? <PlaylistsViewMobile /> : <PlaylistsViewDesktop />
}
