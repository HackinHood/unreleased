import { ChevronRight } from 'lucide-react'

// Shared bento-tile primitive. Originally private to HomeView.desktop.tsx
// (the desktop Home bento rework); extracted so the Editor/Manager profile,
// Admin review panel, and Contributor profile pages can reuse the exact same
// visual language for the "Visual Redesign v2 — Bento Dashboard Pivot"
// instead of hand-rolling near-identical wrappers again.
export function Tile({ title, icon, action, span, children }: {
  title?: string
  icon?: JSX.Element
  action?: { label: string; onClick: () => void }
  span: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <section className={`${span} min-w-0 min-h-0 flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-overlay)]/50 p-4`}>
      {title && (
        <div className="flex items-center gap-2 mb-3 shrink-0">
          <span className="text-text-muted">{icon}</span>
          <h2 className="text-text-primary text-sm font-bold uppercase tracking-wider flex-1 min-w-0 truncate">{title}</h2>
          {action && (
            <button
              onClick={action.onClick}
              className="flex items-center gap-0.5 px-2 py-0.5 -mr-2 rounded-lg text-text-muted text-xs font-semibold hover:text-text-primary hover:bg-[var(--surface-raised)] transition-colors shrink-0"
            >
              {action.label}<ChevronRight size={13} />
            </button>
          )}
        </div>
      )}
      {/* min-h-0 lets this shrink below its content's natural size when the
          grid track is fixed and short of room (the default flex-shrink
          behavior is blocked by min-height:auto otherwise) — combined with
          overflow-y-auto, a tile whose content doesn't fit its track scrolls
          internally instead of spilling content out past the rounded border.
          A no-op for a tile sized to its own content (nothing to shrink). */}
      <div className="min-h-0 overflow-y-auto">
        {children}
      </div>
    </section>
  )
}

export default Tile
