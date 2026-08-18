import { useIsMobile } from '../hooks/useIsMobile'
import AdminPageDesktop from './AdminPage.desktop'
import AdminPageMobile from './AdminPage.mobile'

export default function AdminPage(props: { embedded?: boolean }): JSX.Element {
  const isMobile = useIsMobile()
  return isMobile ? <AdminPageMobile {...props} /> : <AdminPageDesktop {...props} />
}
