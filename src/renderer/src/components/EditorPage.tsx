import { useIsMobile } from '../hooks/useIsMobile'
import EditorPageDesktop from './EditorPage.desktop'
import EditorPageMobile from './EditorPage.mobile'

export default function EditorPage(props: { initialSongId?: number | null }): JSX.Element {
  const isMobile = useIsMobile()
  return isMobile ? <EditorPageMobile {...props} /> : <EditorPageDesktop {...props} />
}
