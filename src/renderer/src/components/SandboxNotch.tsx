import { useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { sandboxSlotRef, useSandboxStore } from './Modal'

// The pill at the top-center of the app that every in-app modal now docks
// into (see ModalOverlay in Modal.tsx). The pill itself is hidden when
// nothing is docked, but the wrapper/slot div always stays mounted — pinning
// sandboxSlotRef the moment the app boots, well before any modal exists. If
// this returned null while empty, the slot node wouldn't exist yet the first
// time a modal opened: ModalOverlay checks sandboxSlotRef.current during
// render (not reactively), so it would find null, render nothing, and never
// get another chance to notice the slot show up later.
export default function SandboxNotch(): JSX.Element {
  const dockedCount = useSandboxStore((s) => s.dockedIds.size)
  const expanded = useSandboxStore((s) => s.expanded)
  const toggle = useSandboxStore((s) => s.toggle)
  const collapse = useSandboxStore((s) => s.collapse)
  const slotElRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    sandboxSlotRef.current = slotElRef.current
    return () => { sandboxSlotRef.current = null }
  }, [])

  const showBackdrop = expanded && dockedCount > 0

  return (
    // The backdrop-blur has to live on THIS element — the one that's also
    // the ancestor of the pill/slot below — not on a separate sibling div.
    // backdrop-filter is only supposed to blur what's painted behind an
    // element, but a sibling without its own stacking context can get
    // flattened into the same compositing layer as the filtered element and
    // end up blurred too (that's what made the pill blurry). Nesting the
    // pill/slot as children instead — the same pattern every full-screen
    // modal in this app already uses — guarantees they paint on top, clean.
    //
    // inset-0 (not left-1/2 + -translate-x-1/2) on purpose too: a `transform`
    // here would make this the containing block for any `position: fixed`
    // descendant, breaking useDraggableModal's dragged/resized panels (their
    // fixed left/top are computed in viewport coordinates).
    <div
      className={`fixed inset-0 z-[500] flex flex-col items-center transition-colors ${
        showBackdrop ? 'bg-black/40 backdrop-blur-sm pointer-events-auto' : 'pointer-events-none'
      }`}
      onClick={(e) => { if (e.target === e.currentTarget) collapse() }}
    >
      {dockedCount > 0 && (
        // relative z-10: a docked panel can be dragged (useDraggableModal)
        // right up over the pill's own position — without this, the panel
        // (painted after, same stacking context) would cover it, making the
        // pill un-clickable exactly when you need it to collapse the panel.
        <button
          onClick={toggle}
          className="relative z-10 pointer-events-auto mt-1.5 flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-overlay border border-[var(--border)] shadow-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-colors"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          Sandbox
          {dockedCount > 1 && <span className="text-text-muted">· {dockedCount}</span>}
          <ChevronDown size={12} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </button>
      )}
      {/* No overflow/max-height here on purpose: a docked panel that's been
          dragged or resized (see useDraggableModal) switches to
          position:fixed, and a clipping ancestor would still clip it even
          though it's positioned relative to the viewport, not this box. Each
          panel manages its own height/scrolling instead. */}
      <div
        ref={slotElRef}
        className={`pointer-events-auto mt-2 ${showBackdrop ? '' : 'hidden'}`}
        style={{ width: 'min(94vw, 800px)' }}
      />
    </div>
  )
}
