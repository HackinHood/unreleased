import { ReactNode } from 'react'
import { Play, MoreHorizontal, CheckSquare2, Square } from 'lucide-react'

// One playlist tile in the library grid. Presentational only — the caller owns
// the cover node and every handler, so the same card renders a synced playlist,
// a local one, and (now) a playlist nested inside a folder without duplicating
// this markup three times. Extracted from PlaylistsView when folders needed a
// third place to draw the exact same tile.

function CardPlayOverlay({ onPlay }: { onPlay: () => void }): JSX.Element {
  return (
    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors">
      <button
        onClick={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); onPlay() }}
        className="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-accent text-black shadow-lg flex items-center justify-center opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all hover:scale-110"
        title="Play"
      >
        <Play size={15} fill="currentColor" className="ml-0.5" />
      </button>
    </div>
  )
}

export default function PlaylistCard({
  name, subtitle, cover, badge, selected, selectMode,
  onClick, onContextMenu, onMenuButton, onPlay,
  draggable, onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop, isDragging, isDropTarget,
}: {
  name: string
  subtitle: string
  cover: ReactNode
  /** Corner badge (e.g. the "Local" tag) shown when not in select mode. */
  badge?: ReactNode
  selected: boolean
  selectMode: boolean
  onClick: (e: React.MouseEvent) => void
  onContextMenu: (e: React.MouseEvent) => void
  /** The always-visible "⋯" button (distinct from right-click). */
  onMenuButton: (e: React.MouseEvent) => void
  onPlay: () => void
  /** Drag-to-move-into-a-folder support — all optional so cards that are
   *  neither draggable nor droppable (e.g. the "Liked Songs" tile) don't
   *  need to pass any of this. */
  draggable?: boolean
  onDragStart?: (e: React.DragEvent) => void
  onDragEnd?: () => void
  onDragOver?: (e: React.DragEvent) => void
  onDragLeave?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent) => void
  /** Dims the card while it's the one being dragged. */
  isDragging?: boolean
  /** Rings the card while another card is being dragged over it as a drop target. */
  isDropTarget?: boolean
}): JSX.Element {
  return (
    <div
      className={`group text-left relative cursor-pointer transition-opacity ${isDragging ? 'opacity-40' : ''}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className={`relative aspect-square rounded-2xl overflow-hidden bg-surface-overlay flex items-center justify-center mb-2.5 shadow-md group-hover:shadow-xl group-hover:-translate-y-1 transition-all duration-200 ${selected ? 'ring-2 ring-accent' : ''} ${isDropTarget ? 'ring-2 ring-accent scale-[1.03]' : ''}`}>
        {cover}
        <CardPlayOverlay onPlay={onPlay} />
      </div>

      {selectMode ? (
        <div className="absolute top-1.5 left-1.5 z-10 bg-black/60 rounded-md p-0.5">
          {selected
            ? <CheckSquare2 size={16} className="text-accent" />
            : <Square size={16} className="text-white/70" />}
        </div>
      ) : badge ? (
        <div className="absolute top-1.5 left-1.5 z-10">{badge}</div>
      ) : null}

      {!selectMode && (
        <button
          className="absolute top-1.5 right-1.5 md:opacity-0 md:group-hover:opacity-100 p-1 rounded-lg bg-black/60 text-white hover:bg-black/80 transition-opacity"
          onClick={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); onMenuButton(e) }}
        >
          <MoreHorizontal size={13} />
        </button>
      )}

      <p className="text-text-primary text-sm font-semibold truncate">{name}</p>
      <p className="text-text-muted text-xs mt-0.5">{subtitle}</p>
    </div>
  )
}
