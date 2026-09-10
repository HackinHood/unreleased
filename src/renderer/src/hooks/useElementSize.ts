import { RefObject, useEffect, useState } from 'react'

export interface ElementSize {
  width: number
  height: number
}

/**
 * The observed content box of `ref`, in px. Both start at 0 for the first
 * render (before the element exists) — callers that lay out from these should
 * treat 0 as "not measured yet" rather than as an empty box.
 *
 * Used by height-bound layouts that have to work out how much fits: unlike a
 * media query, this reacts to whatever is actually sharing the row (the
 * sidebar collapsing, the queue or now-playing panel opening) as well as to
 * the window itself.
 */
export function useElementSize(ref: RefObject<HTMLElement>): ElementSize {
  const [size, setSize] = useState<ElementSize>({ width: 0, height: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = (): void => {
      setSize((prev) => (
        prev.width === el.clientWidth && prev.height === el.clientHeight
          ? prev
          : { width: el.clientWidth, height: el.clientHeight }
      ))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])

  return size
}
