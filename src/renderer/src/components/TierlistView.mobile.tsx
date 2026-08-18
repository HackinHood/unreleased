// Tier List — rank songs into S/A/B/C/D (or whatever tiers the user builds)
// by tapping a song, then tapping the row it belongs in. Unlike Heardle/
// Wordle there's no daily puzzle or score: it's a personal ranking, persisted
// locally (see lib/tierlist) with no server round-trip.
//
// Desktop also supports HTML5 drag-and-drop; this is a touch surface, so that
// path is dropped entirely and tap-to-select-then-tap-a-row (which desktop
// already offers as a fallback) is the only interaction.
import { useEffect, useMemo, useState } from 'react'
import {
  ChevronLeft, ChevronUp, ChevronDown, Settings2, Music2, Plus, RotateCcw, Search, X, Check,
} from 'lucide-react'
import { useStorePick } from '../store/useStore'
import { loadPools, POOL_LABELS } from '../lib/heardle'
import type { HeardleSong, PoolId } from '../lib/heardle'
import { smallCoverUrl } from '../lib/juicewrldApi'
import {
  loadTierlistState, saveTierlistState, resetTierlistState, newTierId,
  unsortedSongs, songsInTier, TIER_COLOR_PRESETS,
} from '../lib/tierlist'
import type { Tier, TierlistState } from '../lib/tierlist'
import { Sheet } from './mobile/Sheet'
import { GameSwitcher, GameBackdrop } from './gameShell'

const DEFAULT_CATEGORIES: PoolId[] = ['released', 'unreleased']

// ─── Pieces ───────────────────────────────────────────────────────────────────

function SongChip({ song, selected, onClick }: {
  song: HeardleSong
  selected: boolean
  onClick: () => void
}): JSX.Element {
  return (
    <div onClick={onClick} title={song.name} className="shrink-0 w-16 cursor-pointer">
      <div
        className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
          selected ? 'border-accent ring-2 ring-accent/50 scale-95' : 'border-[var(--border)]'
        }`}
      >
        {song.imageUrl ? (
          <img src={smallCoverUrl(song.imageUrl)} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-[var(--surface-overlay)] flex items-center justify-center">
            <Music2 size={18} className="text-text-muted" />
          </div>
        )}
      </div>
      <div className="mt-1 text-[9px] leading-tight text-text-muted text-center line-clamp-2 break-words">
        {song.name}
      </div>
    </div>
  )
}

function TierRow({ tier, songs, isFirst, isLast, selectedSongId, onClickRow, onSelectSong, onMoveUp, onMoveDown, onEdit }: {
  tier: Tier
  songs: HeardleSong[]
  isFirst: boolean
  isLast: boolean
  selectedSongId: number | null
  onClickRow: () => void
  onSelectSong: (id: number) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onEdit: () => void
}): JSX.Element {
  return (
    <div className="flex rounded-xl overflow-hidden border border-[var(--border)]">
      <button
        onClick={onEdit}
        title="Edit tier"
        className="w-16 shrink-0 flex items-center justify-center text-center px-1.5 py-3 font-black text-sm leading-tight active:opacity-80 transition-opacity"
        style={{ background: tier.color, color: 'rgba(0,0,0,0.75)' }}
      >
        {tier.label}
      </button>
      <div
        onClick={onClickRow}
        className={`flex-1 min-h-[6.5rem] bg-[var(--surface-overlay)]/30 p-1.5 flex flex-wrap gap-1.5 content-start ${
          selectedSongId !== null ? 'cursor-copy' : ''
        }`}
      >
        {songs.map((s) => (
          <SongChip
            key={s.id}
            song={s}
            selected={selectedSongId === s.id}
            onClick={() => onSelectSong(s.id)}
          />
        ))}
      </div>
      <div className="w-9 shrink-0 flex flex-col border-l border-[var(--border)]">
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          title="Move tier up"
          className="flex-1 flex items-center justify-center text-text-muted active:text-text-primary disabled:opacity-20 transition-colors"
        >
          <ChevronUp size={14} />
        </button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          title="Move tier down"
          className="flex-1 flex items-center justify-center text-text-muted active:text-text-primary disabled:opacity-20 transition-colors border-t border-[var(--border)]"
        >
          <ChevronDown size={14} />
        </button>
      </div>
    </div>
  )
}

function TierEditPopover({ tier, canDelete, onChange, onDelete, onClose }: {
  tier: Tier
  canDelete: boolean
  onChange: (t: Tier) => void
  onDelete: () => void
  onClose: () => void
}): JSX.Element {
  return (
    <Sheet onClose={onClose} title="Edit tier">
      <div className="px-5 pb-2">
        <label className="text-xs text-text-muted mb-1 block">Label</label>
        <input
          value={tier.label}
          maxLength={20}
          onChange={(e) => onChange({ ...tier, label: e.target.value })}
          className="w-full mb-4 px-3 py-2.5 rounded-xl bg-[var(--surface-overlay)] border border-[var(--border)] text-sm text-text-primary focus:outline-none focus:border-accent/50"
        />
        <label className="text-xs text-text-muted mb-1 block">Color</label>
        <div className="flex flex-wrap gap-2.5 mb-5">
          {TIER_COLOR_PRESETS.map((c) => (
            <button
              key={c}
              onClick={() => onChange({ ...tier, color: c })}
              title={c}
              className={`w-9 h-9 rounded-full border-2 transition-colors ${tier.color === c ? 'border-text-primary' : 'border-transparent'}`}
              style={{ background: c }}
            />
          ))}
        </div>
        {canDelete && (
          <button
            onClick={onDelete}
            className="w-full h-11 rounded-xl border border-red-500/30 text-red-400 text-sm font-semibold active:bg-red-500/10 transition-colors"
          >
            Delete tier
          </button>
        )}
      </div>
    </Sheet>
  )
}

// ─── View ───────────────────────────────────────────────────────────────────

export default function TierlistView(): JSX.Element {
  const { setActiveView, sidebarPosition, setHeroBleedTop } = useStorePick(
    'setActiveView', 'sidebarPosition', 'setHeroBleedTop')

  // Lets GameBackdrop's wash paint full-bleed under the status bar instead of
  // stopping at the shell's usual inset — matches WRLD's ownsTopInset trick.
  // The corner buttons and the switcher's top clearance compensate below.
  const ownsTopInset = sidebarPosition !== 'top'
  useEffect(() => {
    setHeroBleedTop(true)
    return () => setHeroBleedTop(false)
  }, [setHeroBleedTop])

  const [state, setState] = useState<TierlistState>(() => loadTierlistState())
  const [categories, setCategories] = useState<PoolId[]>(DEFAULT_CATEGORIES)
  const [pool, setPool] = useState<HeardleSong[]>([])
  const [poolLoading, setPoolLoading] = useState(true)
  const [poolError, setPoolError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedSongId, setSelectedSongId] = useState<number | null>(null)
  const [editingTier, setEditingTier] = useState<Tier | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    let cancelled = false
    setPoolLoading(true)
    setPoolError(null)
    loadPools(categories)
      .then((songs) => { if (!cancelled) setPool(songs) })
      .catch((err) => { if (!cancelled) setPoolError(err instanceof Error ? err.message : 'Failed to load songs') })
      .finally(() => { if (!cancelled) setPoolLoading(false) })
    return () => { cancelled = true }
  }, [categories])

  useEffect(() => { saveTierlistState(state) }, [state])

  const { tiers, assignments } = state

  const visiblePool = useMemo(() => {
    const unsorted = unsortedSongs(pool, assignments)
    const q = search.trim().toLowerCase()
    if (!q) return unsorted
    return unsorted.filter((s) => s.titles.some((t) => t.toLowerCase().includes(q)))
  }, [pool, assignments, search])

  // Selecting the tier a song currently belongs to (or the pool, for
  // unassigning) is meant as a no-op, not a nudge to re-render — keeping the
  // state identity-equal skips the save effect that would otherwise fire.
  const assignSong = (songId: number, tierId: string | null): void => {
    setState((prev) => {
      const current = prev.assignments[songId] ?? null
      if (current === tierId) return prev
      const next = { ...prev.assignments }
      if (tierId) next[songId] = tierId
      else delete next[songId]
      return { ...prev, assignments: next }
    })
    setSelectedSongId(null)
  }

  const clickRow = (tierId: string | null) => (): void => {
    if (selectedSongId !== null) assignSong(selectedSongId, tierId)
  }

  const moveTier = (index: number, dir: -1 | 1): void => {
    setState((prev) => {
      const next = [...prev.tiers]
      const target = index + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return { ...prev, tiers: next }
    })
  }

  const addTier = (): void => {
    setState((prev) => ({
      ...prev,
      tiers: [
        ...prev.tiers,
        { id: newTierId(), label: 'New', color: TIER_COLOR_PRESETS[prev.tiers.length % TIER_COLOR_PRESETS.length] },
      ],
    }))
  }

  const updateTier = (tier: Tier): void => {
    setState((prev) => ({ ...prev, tiers: prev.tiers.map((t) => (t.id === tier.id ? tier : t)) }))
    setEditingTier(tier)
  }

  const deleteTier = (tierId: string): void => {
    setState((prev) => {
      const nextAssignments = { ...prev.assignments }
      for (const [songId, tid] of Object.entries(nextAssignments)) {
        if (tid === tierId) delete nextAssignments[Number(songId)]
      }
      return { tiers: prev.tiers.filter((t) => t.id !== tierId), assignments: nextAssignments }
    })
    setEditingTier(null)
  }

  const toggleCategory = (cat: PoolId): void => {
    setCategories((prev) => {
      const next = prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
      return next.length > 0 ? next : prev // never leave nothing to draw from
    })
  }

  const handleReset = (): void => {
    if (!window.confirm('Clear the whole tier list? This removes every ranking and custom tier.')) return
    setState(resetTierlistState())
    setSelectedSongId(null)
  }

  return (
    <div className="relative flex-1 flex flex-col h-full overflow-hidden bg-[var(--surface)]">
      <GameBackdrop />

      {/* Corner controls — the hero owns the middle, so navigation and the
          panels sit out of its way. z-20: the scroll container fills the whole
          view and comes later in the DOM, so at equal z it took every click in
          these corners and left the buttons visible but dead. */}
      <div
        className="absolute left-2 z-20"
        style={{ top: ownsTopInset ? 'calc(env(safe-area-inset-top, 0px) + 0.5rem)' : '0.5rem' }}
      >
        <button
          onClick={() => setActiveView('wrld')}
          aria-label="Back"
          className="w-11 h-11 flex items-center justify-center rounded-full text-text-primary active:bg-surface-overlay transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
      </div>
      <div
        className="absolute right-2 z-20 flex items-center gap-1"
        style={{ top: ownsTopInset ? 'calc(env(safe-area-inset-top, 0px) + 0.5rem)' : '0.5rem' }}
      >
        <button
          onClick={() => setShowFilters(true)}
          aria-label="Song pool"
          className="w-11 h-11 flex items-center justify-center rounded-full text-text-muted active:bg-surface-overlay transition-colors"
        >
          <Settings2 size={18} />
        </button>
        <button
          onClick={handleReset}
          aria-label="Clear tier list"
          className="w-11 h-11 flex items-center justify-center rounded-full text-text-muted active:bg-surface-overlay transition-colors"
        >
          <RotateCcw size={18} />
        </button>
      </div>

      {/* z-10: the backdrop layers above are absolutely positioned, so content
          has to be positioned too or they paint over it. */}
      <div className="relative z-10 flex-1 overflow-y-auto px-4 pt-2 pb-10">
        <div className="mx-auto w-full max-w-xl">
          {/* Clears the corner buttons (0.5rem + h-11 → bottom edge at 3.25rem)
              plus the safe-area inset they now sit below, since this view
              bleeds its own backdrop under the status bar. */}
          <div style={{ marginTop: ownsTopInset ? 'calc(env(safe-area-inset-top, 0px) + 3.5rem)' : '3.5rem' }}>
            <GameSwitcher current="tierlist" />
          </div>

          <div className="text-center mb-5">
            <h1 className="text-text-primary text-3xl font-black tracking-tight">Tier List</h1>
            <p className="text-text-muted text-xs mt-2">
              {selectedSongId !== null
                ? 'Tap a row to place it — tap the song again to cancel.'
                : 'Tap a song, then tap the row it belongs in.'}
            </p>
          </div>

          {poolError && (
            <div className="mb-4 px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm text-center">
              {poolError}
            </div>
          )}

          <div className="space-y-1.5 mb-2">
            {tiers.map((tier, i) => (
              <TierRow
                key={tier.id}
                tier={tier}
                songs={songsInTier(pool, assignments, tier.id)}
                isFirst={i === 0}
                isLast={i === tiers.length - 1}
                selectedSongId={selectedSongId}
                onClickRow={clickRow(tier.id)}
                onSelectSong={(id) => setSelectedSongId((cur) => (cur === id ? null : id))}
                onMoveUp={() => moveTier(i, -1)}
                onMoveDown={() => moveTier(i, 1)}
                onEdit={() => setEditingTier(tier)}
              />
            ))}
          </div>

          <button
            onClick={addTier}
            className="w-full mb-8 h-11 rounded-xl border border-dashed border-[var(--border)] text-text-muted active:text-text-primary active:border-accent/40 transition-colors text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-1.5"
          >
            <Plus size={14} /> Add tier
          </button>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)]/40 p-3">
            <div className="flex items-center gap-2 mb-3">
              <Music2 size={14} className="text-text-muted shrink-0" />
              <span className="text-xs font-bold uppercase tracking-widest text-text-muted">Unranked</span>
              <span className="text-xs text-text-muted">({visiblePool.length})</span>
            </div>
            <div className="relative mb-3">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search songs"
                className="w-full pl-8 pr-3 py-2 rounded-lg bg-[var(--surface-overlay)] border border-[var(--border)] text-xs text-text-primary focus:outline-none focus:border-accent/50"
              />
            </div>
            <div
              onClick={clickRow(null)}
              className={`min-h-[7.5rem] flex flex-wrap gap-1.5 content-start ${selectedSongId !== null ? 'cursor-copy' : ''}`}
            >
              {poolLoading ? (
                <span className="text-xs text-text-muted py-4">Loading songs…</span>
              ) : visiblePool.length === 0 ? (
                <span className="text-xs text-text-muted py-4">
                  {search ? 'No songs match that search.' : 'Every song has been ranked.'}
                </span>
              ) : (
                visiblePool.map((s) => (
                  <SongChip
                    key={s.id}
                    song={s}
                    selected={selectedSongId === s.id}
                    onClick={() => setSelectedSongId((cur) => (cur === s.id ? null : s.id))}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {showFilters && (
        <Sheet onClose={() => setShowFilters(false)} title="Song pool">
          <div className="px-5 pb-2 flex flex-col gap-2">
            {(['released', 'unreleased'] as PoolId[]).map((cat) => (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={`flex items-center justify-between px-4 h-12 rounded-xl border text-sm transition-colors ${
                  categories.includes(cat)
                    ? 'border-accent/40 bg-accent/10 text-text-primary'
                    : 'border-[var(--border)] text-text-muted'
                }`}
              >
                {POOL_LABELS[cat]}
                {categories.includes(cat) && <Check size={14} className="text-accent" />}
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {editingTier && (
        <TierEditPopover
          tier={editingTier}
          canDelete={tiers.length > 1}
          onChange={updateTier}
          onDelete={() => deleteTier(editingTier.id)}
          onClose={() => setEditingTier(null)}
        />
      )}
    </div>
  )
}
