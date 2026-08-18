import { useState, useEffect } from 'react'

// Matches Tailwind's default `md` breakpoint — the same cutoff Sidebar/
// BottomNav already switch on via `hidden md:flex` / `md:hidden`, so a view
// that branches on this hook agrees with the shell chrome around it.
const QUERY = '(max-width: 767px)'

/** True below the `md` breakpoint. Viewport-based (not user-agent based —
 *  see IS_MOBILE in lib/platform.ts for device detection), so it also
 *  reflects a resized desktop browser window, consistent with the rest of
 *  the app's responsive chrome. */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches
  )

  useEffect(() => {
    const mql = window.matchMedia(QUERY)
    const onChange = (): void => setIsMobile(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isMobile
}
