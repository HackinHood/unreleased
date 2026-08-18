import { useIsMobile } from '../hooks/useIsMobile'
import EditorProfileViewDesktop from './EditorProfileView.desktop'
import EditorProfileViewMobile from './EditorProfileView.mobile'

export default function EditorProfileView(): JSX.Element {
  const isMobile = useIsMobile()
  return isMobile ? <EditorProfileViewMobile /> : <EditorProfileViewDesktop />
}
