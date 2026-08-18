import { useIsMobile } from '../hooks/useIsMobile'
import ApiFilesViewDesktop from './ApiFilesView.desktop'
import ApiFilesViewMobile from './ApiFilesView.mobile'

export default function ApiFilesView(): JSX.Element {
  const isMobile = useIsMobile()
  return isMobile ? <ApiFilesViewMobile /> : <ApiFilesViewDesktop />
}
