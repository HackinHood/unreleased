import { useIsMobile } from '../hooks/useIsMobile'
import AdminPageDesktop from './AdminPage.desktop'
import AdminPageMobile from './AdminPage.mobile'
import type { AdminTab } from '../hooks/useAdminQueue'

export default function AdminPage(props: { embedded?: boolean; initialTab?: AdminTab }): JSX.Element {
  const isMobile = useIsMobile()
  return isMobile ? <AdminPageMobile {...props} /> : <AdminPageDesktop {...props} />
}
