import { useIsMobile } from '../hooks/useIsMobile'
import DocsPageDesktop from './DocsPage.desktop'
import DocsPageMobile from './DocsPage.mobile'

export default function DocsPage(): JSX.Element {
  const isMobile = useIsMobile()
  return isMobile ? <DocsPageMobile /> : <DocsPageDesktop />
}
