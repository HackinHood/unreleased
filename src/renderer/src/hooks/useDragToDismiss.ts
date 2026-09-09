import { CSSProperties, TouchEvent as ReactTouchEvent, useRef, useState } from 'react'

// Shared "drag down to close" gesture — the curtain-reveal WRLD's full-screen
// player uses, and every bottom-sheet-style panel (SongInfoModal, mobile/
// Sheet.tsx) since. Wire `handlers` onto whatever region should arm the
// gesture (often just a header/grabber, not the whole scrollable panel, so it
// doesn't fight that panel's own scroll) and spread `style` onto the element
// that should actually translate.
interface Options {
  /** Downward drag distance (px) past which `onDismiss` fires. */
  threshold?: number
  /** Scale upward drag instead of freezing it in place, for a rubber-band
   *  feel (mobile/Sheet.tsx's grabber). Off by default, matching WRLD/
   *  SongInfoModal: dragging back up just holds at the last downward offset. */
  rubberBand?: boolean
  /** Transition applied once the finger lifts (snap back, or into the close
   *  animation). */
  transition?: string
}

export function useDragToDismiss(onDismiss: () => void, options: Options = {}) {
  const { threshold = 110, rubberBand = false, transition = 'transform 0.25s ease-out' } = options
  const dragStartY = useRef<number | null>(null)
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)

  const onTouchStart = (e: ReactTouchEvent): void => {
    if (e.touches.length !== 1) return
    // Let the handle's own buttons (close/edit/lock, etc.) work normally
    // instead of starting a drag.
    if ((e.target as HTMLElement).closest('button, a, input, textarea, select')) return
    dragStartY.current = e.touches[0].clientY
    setDragging(true)
  }
  const onTouchMove = (e: ReactTouchEvent): void => {
    if (dragStartY.current == null) return
    const dy = e.touches[0].clientY - dragStartY.current
    if (rubberBand) setDragY(dy > 0 ? dy : dy / 5)
    else if (dy > 0) setDragY(dy)
  }
  const onTouchEnd = (): void => {
    if (dragStartY.current == null) return
    if (dragY > threshold) onDismiss()
    setDragY(0)
    setDragging(false)
    dragStartY.current = null
  }

  const style: CSSProperties = {
    transform: dragY ? `translateY(${dragY}px)` : undefined,
    transition: dragging ? 'none' : transition,
  }

  return {
    dragY,
    dragging,
    style,
    handlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: onTouchEnd },
  }
}
