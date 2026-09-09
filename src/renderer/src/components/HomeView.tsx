import { useEffect } from 'react'
import { useIsMobile } from '../hooks/useIsMobile'
import { useStore } from '../store/useStore'
import HomeViewMobile from './HomeView.mobile'

// Home is mobile-only for now. This dispatcher is the single place that
// enforces it — deliberately not also guarded in App.tsx's getViewFromPath,
// which resolves /home unconditionally so the URL stays valid; adding a second
// gate there would break a /home bookmark opened in a narrow desktop window.
//
// On desktop it redirects rather than showing "not found": /home is a real
// route that simply has no desktop surface yet, and bouncing to the Tracker is
// closer to what someone landing there wants than a dead end. This also covers
// a mobile window being widened past the breakpoint mid-session.
export default function HomeView(): JSX.Element | null {
  const isMobile = useIsMobile()
  const setActiveView = useStore((s) => s.setActiveView)

  useEffect(() => {
    if (!isMobile) setActiveView('api-tracker')
  }, [isMobile, setActiveView])

  return isMobile ? <HomeViewMobile /> : null
}
