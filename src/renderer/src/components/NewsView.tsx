import { useEffect, useState, useCallback } from 'react'
import {
  ChevronLeft, Newspaper, RefreshCw, AlertCircle, Plus, Settings2,
  Pencil, Trash2, Star, Paperclip, Download, Bell, BellOff, ArrowDownWideNarrow, ArrowUpWideNarrow,
} from 'lucide-react'
import { useStorePick } from '../store/useStore'
import {
  fetchNews, fetchChannels, fetchNewsItem, deleteNewsItem, isImageAttachment, isAudioAttachment,
  buildNewsAttachmentStreamUrl, ensureHttpsMediaUrl,
  ALL_CHANNEL, DEFAULT_NEWS_CHANNEL, NEWS_CHANNELS,
  type NewsItem, type NewsChannel, type NewsAttachment, type NewsSort,
} from '../lib/newsApi'
import { isSubscribed, setSubscribed, ensureNotifyPermission } from '../lib/newsNotifications'
import NewsComposeModal from './NewsComposeModal'
import NewsChannelsModal from './NewsChannelsModal'
import ChangesFeedPanel from './ChangesFeedPanel'
import Markdown from './Markdown'

type ViewMode = 'news' | 'feed'

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// ─── Cards ────────────────────────────────────────────────────────────────────

function CategoryTag({ label }: { label: string }) {
  return (
    <span className="inline-block text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-accent/15 text-accent border border-accent/25">
      {label}
    </span>
  )
}

// Edit/delete cluster for editors. Always visible on android — touch has no
// hover state, so gating this behind group-hover (the desktop pattern) would
// make it permanently unreachable here.
function ManageActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="absolute top-2 right-2 flex items-center gap-1">
      <button onClick={onEdit} title="Edit" aria-label="Edit post" className="p-1.5 rounded-lg bg-black/60 text-white active:bg-black/80 transition-colors"><Pencil size={13} /></button>
      <button onClick={onDelete} title="Delete" aria-label="Delete post" className="p-1.5 rounded-lg bg-black/60 text-white active:bg-red-600 transition-colors"><Trash2 size={13} /></button>
    </div>
  )
}

interface CardProps {
  item: NewsItem
  onOpen: (item: NewsItem) => void
  canManage: boolean
  onEdit: (item: NewsItem) => void
  onDelete: (item: NewsItem) => void
}

function FeaturedCard({ item, onOpen, canManage, onEdit, onDelete }: CardProps) {
  return (
    <div className="relative group">
      <button
        onClick={() => onOpen(item)}
        className="w-full text-left rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--surface-raised)] active:border-accent/40 transition-colors block"
      >
        {item.image_url ? (
          <div className="relative aspect-[16/7] w-full overflow-hidden bg-[var(--surface-overlay)]">
            <img
              src={ensureHttpsMediaUrl(item.image_url) ?? undefined}
              alt=""
              loading="lazy"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-white drop-shadow"><Star size={11} className="fill-current text-accent" /> Featured</span>
                {item.category && <CategoryTag label={item.category} />}
                <span className="text-xs text-white/80 drop-shadow">{formatDate(item.published_at)}</span>
              </div>
              <h2 className="text-white text-xl font-bold leading-snug mb-1.5 drop-shadow-sm">{item.title}</h2>
              <p className="text-sm text-white/85 leading-relaxed line-clamp-2 drop-shadow-sm">{item.summary}</p>
            </div>
          </div>
        ) : (
          <div className="p-5">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-accent"><Star size={11} className="fill-current" /> Featured</span>
              {item.category && <CategoryTag label={item.category} />}
              <span className="text-xs text-text-muted">{formatDate(item.published_at)}</span>
            </div>
            <h2 className="text-text-primary text-lg font-bold leading-snug mb-1.5">{item.title}</h2>
            <p className="text-sm text-text-secondary leading-relaxed line-clamp-3">{item.summary}</p>
          </div>
        )}
      </button>
      {canManage && <ManageActions onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} />}
    </div>
  )
}

function NewsCard({ item, onOpen, canManage, onEdit, onDelete }: CardProps) {
  return (
    <div className="relative group h-full">
      <button
        onClick={() => onOpen(item)}
        className="w-full h-full text-left flex flex-col rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--surface-raised)] active:border-accent/40 transition-colors"
      >
        {item.image_url && (
          <div className="w-full aspect-[16/9] shrink-0 overflow-hidden bg-[var(--surface-overlay)]">
            <img
              src={ensureHttpsMediaUrl(item.image_url) ?? undefined}
              alt=""
              loading="lazy"
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="min-w-0 flex-1 p-3.5 pr-12">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            {item.category && <CategoryTag label={item.category} />}
            <span className="text-xs text-text-muted">{formatDate(item.published_at)}</span>
            {item.attachments.length > 0 && (
              <span className="inline-flex items-center gap-0.5 text-xs text-text-muted"><Paperclip size={11} />{item.attachments.length}</span>
            )}
          </div>
          <h3 className="text-text-primary text-sm font-semibold leading-snug mb-1 line-clamp-2">{item.title}</h3>
          <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">{item.summary}</p>
        </div>
      </button>
      {canManage && <ManageActions onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} />}
    </div>
  )
}

// ─── States ───────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--surface-raised)] animate-pulse">
      <div className="w-full aspect-[16/9] bg-[var(--surface-overlay)]" />
      <div className="space-y-2 p-3.5">
        <div className="h-3 w-20 rounded bg-[var(--surface-overlay)]" />
        <div className="h-4 w-3/4 rounded bg-[var(--surface-overlay)]" />
        <div className="h-3 w-full rounded bg-[var(--surface-overlay)]" />
        <div className="h-3 w-2/3 rounded bg-[var(--surface-overlay)]" />
      </div>
    </div>
  )
}

function EmptyState({ canManage, onCompose }: { canManage: boolean; onCompose: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-24 px-6">
      <div className="w-16 h-16 rounded-2xl bg-[var(--surface-raised)] border border-[var(--border)] flex items-center justify-center mb-4">
        <Newspaper size={28} className="text-text-muted" />
      </div>
      <h2 className="text-text-primary font-semibold mb-1">No news here yet</h2>
      <p className="text-sm text-text-muted max-w-sm">
        Announcements, releases and leaks will show up here. Check back soon.
      </p>
      {canManage && (
        <button
          onClick={onCompose}
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-accent text-white active:opacity-90 transition-opacity"
        >
          <Plus size={15} /> Write the first post
        </button>
      )}
    </div>
  )
}

// ─── Attachments ──────────────────────────────────────────────────────────────

function AudioAttachment({ attachment }: { attachment: NewsAttachment }) {
  const [broken, setBroken] = useState(false)
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] overflow-hidden">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <Paperclip size={15} className="text-text-muted shrink-0" />
        <span className="text-sm text-text-primary truncate flex-1">{attachment.name}</span>
        <span className="text-xs text-text-muted shrink-0">{humanSize(attachment.size)}</span>
        <a
          href={buildNewsAttachmentStreamUrl(attachment, true)}
          download={attachment.name}
          className="text-text-muted active:text-accent transition-colors shrink-0"
          aria-label={`Download ${attachment.name}`}
        >
          <Download size={15} />
        </a>
      </div>
      <div className="px-3 pb-3">
        {broken ? (
          <div className="h-9 rounded-md bg-surface-overlay flex items-center justify-center text-[11px] text-text-muted">
            Preview unavailable
          </div>
        ) : (
          <audio
            controls
            src={buildNewsAttachmentStreamUrl(attachment)}
            preload="metadata"
            onError={() => setBroken(true)}
            className="w-full h-9"
          />
        )}
      </div>
    </div>
  )
}

function AttachmentList({ attachments }: { attachments: NewsAttachment[] }) {
  const images = attachments.filter(isImageAttachment)
  const audio = attachments.filter((a) => !isImageAttachment(a) && isAudioAttachment(a))
  const files = attachments.filter((a) => !isImageAttachment(a) && !isAudioAttachment(a))
  return (
    <div className="mt-6 space-y-4">
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {images.map((a, i) => (
            <a key={i} href={ensureHttpsMediaUrl(a.url) ?? a.url} target="_blank" rel="noopener noreferrer" className="block rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--surface-overlay)] active:border-accent/40 transition-colors">
              <img src={ensureHttpsMediaUrl(a.url) ?? undefined} alt={a.name} loading="lazy" className="w-full aspect-square object-cover" />
            </a>
          ))}
        </div>
      )}
      {audio.length > 0 && (
        <div className="space-y-2">
          {audio.map((a, i) => (
            <AudioAttachment key={i} attachment={a} />
          ))}
        </div>
      )}
      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((a, i) => (
            <a
              key={i}
              href={buildNewsAttachmentStreamUrl(a, true)}
              download={a.name}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2.5 active:border-accent/40 transition-colors group"
            >
              <Paperclip size={15} className="text-text-muted shrink-0" />
              <span className="text-sm text-text-primary truncate flex-1">{a.name}</span>
              <span className="text-xs text-text-muted shrink-0">{humanSize(a.size)}</span>
              <Download size={15} className="text-text-muted active:text-accent transition-colors shrink-0" />
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Article detail ───────────────────────────────────────────────────────────

function ArticleDetail({ item, channelLabel, onBack, canManage, onEdit, onDelete }: {
  item: NewsItem
  channelLabel: string | null
  onBack: () => void
  canManage: boolean
  onEdit: (item: NewsItem) => void
  onDelete: (item: NewsItem) => void
}) {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          <ChevronLeft size={16} /> Back to news
        </button>
        {canManage && (
          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => onEdit(item)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-colors"><Pencil size={13} /> Edit</button>
            <button onClick={() => onDelete(item)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-text-secondary hover:text-red-400 hover:bg-surface-raised transition-colors"><Trash2 size={13} /> Delete</button>
          </div>
        )}
      </div>
      {item.image_url && (
        <div className="aspect-[16/7] w-full overflow-hidden rounded-2xl bg-[var(--surface-overlay)] mb-5">
          <img src={ensureHttpsMediaUrl(item.image_url) ?? undefined} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {item.featured && <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-accent"><Star size={11} className="fill-current" /> Featured</span>}
        {channelLabel && <CategoryTag label={channelLabel} />}
        {item.category && <span className="text-xs text-text-muted">{item.category}</span>}
        <span className="text-xs text-text-muted">{formatDate(item.published_at)}</span>
        {item.author && <span className="text-xs text-text-muted">· {item.author}</span>}
      </div>
      <h1 className="text-text-primary text-2xl font-bold leading-tight mb-4">{item.title}</h1>
      <Markdown>{item.body}</Markdown>
      {item.attachments.length > 0 && <AttachmentList attachments={item.attachments} />}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewsView(): JSX.Element {
  const { setActiveView, account } = useStorePick('setActiveView', 'account')
  // News write access is its own role (is_news), separate from is_editor —
  // admins can post regardless. Only admins manage channels.
  const canPost = !!(account?.is_news || account?.is_administrator)
  const canManageChannels = !!account?.is_administrator
  // Who can edit/delete a given post: admins can touch anything; is_news
  // holders only their own. Matches the backend's authorization, so the
  // buttons don't offer an action the API would reject.
  const canManageItem = (item: NewsItem): boolean =>
    !!account && (account.is_administrator || (!!account.is_news && item.author_id != null && item.author_id === account.id))

  const [mode, setMode] = useState<ViewMode>('news')
  const [channel, setChannel] = useState<string>(DEFAULT_NEWS_CHANNEL)
  const [sort, setSort] = useState<NewsSort>('newest')
  const [channels, setChannels] = useState<NewsChannel[]>(NEWS_CHANNELS)
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<NewsItem | null>(null)

  // Whether the user follows the active channel (drives the bell toggle). "All"
  // isn't subscribable — you follow specific channels.
  const [subscribed, setSubscribedState] = useState(false)

  // Modals
  const [composeOpen, setComposeOpen] = useState(false)
  const [editing, setEditing] = useState<NewsItem | null>(null)
  const [channelsOpen, setChannelsOpen] = useState(false)

  const loadChannels = useCallback(async () => {
    try {
      const list = await fetchChannels()
      setChannels(list)
    } catch {
      // Keep whatever we have (the static fallback) — a channels fetch failure
      // shouldn't blank out the tab bar.
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchNews({ channel, sort })
      setItems(res.results)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load news')
    } finally {
      setLoading(false)
    }
  }, [channel, sort])

  useEffect(() => { loadChannels() }, [loadChannels])

  // Reload whenever the channel changes (and on mount). Close any open article
  // so we don't strand the reader on a story from the previous channel.
  useEffect(() => { setSelected(null); load() }, [load])

  // Reflect the follow state of whatever channel is active.
  useEffect(() => { setSubscribedState(channel !== ALL_CHANNEL && isSubscribed(channel)) }, [channel])

  // Open a specific post when a notification is clicked (NewsNotifier routes
  // here then dispatches the id). Also honor an id left in sessionStorage if the
  // view mounts after the event fired.
  useEffect(() => {
    const openById = (id: number): void => { fetchNewsItem(id).then(setSelected).catch(() => undefined) }
    const onOpen = (e: Event): void => {
      const id = (e as CustomEvent<number>).detail
      // Already-mounted path: consume the id so a later remount doesn't reopen it.
      try { sessionStorage.removeItem('news:openPostId') } catch {}
      if (typeof id === 'number') openById(id)
    }
    window.addEventListener('news:open', onOpen)
    try {
      const pending = sessionStorage.getItem('news:openPostId')
      if (pending) { sessionStorage.removeItem('news:openPostId'); openById(Number(pending)) }
    } catch {}
    return () => window.removeEventListener('news:open', onOpen)
  }, [])

  const toggleSubscribe = async (): Promise<void> => {
    if (channel === ALL_CHANNEL) return
    const next = !subscribed
    if (next) await ensureNotifyPermission() // ask on the first follow; harmless if already granted/denied
    setSubscribed(channel, next)
    setSubscribedState(next)
  }

  const channelLabel = (id: string): string | null => channels.find((c) => c.id === id)?.label ?? null

  const openEdit = (item: NewsItem): void => { setEditing(item); setComposeOpen(true) }
  const openNew = (): void => { setEditing(null); setComposeOpen(true) }

  const handleDelete = async (item: NewsItem): Promise<void> => {
    if (!window.confirm(`Delete “${item.title}”? This can't be undone.`)) return
    try {
      await deleteNewsItem(item.id)
      setItems((prev) => prev.filter((i) => i.id !== item.id))
      setSelected((s) => (s?.id === item.id ? null : s))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  const handleSaved = (saved: NewsItem): void => {
    setComposeOpen(false)
    setEditing(null)
    // Merge the saved item in place (edit) or drop it on top (new). A full
    // reload also picks up server-side fields (author, hosted attachment urls).
    setSelected((s) => (s?.id === saved.id ? saved : s))
    load()
  }

  const featured = items.find((i) => i.featured) ?? null
  const rest = items.filter((i) => i !== featured)

  const tabs: NewsChannel[] = [{ id: ALL_CHANNEL, label: 'All' }, ...channels]

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--surface)]">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-0 border-b border-[var(--border)]">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setActiveView('wrld')}
            title="Back"
            className="p-1 -ml-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-overlay transition-colors shrink-0"
          >
            <ChevronLeft size={18} />
          </button>
          <h1 className="text-text-primary text-xl font-bold">News</h1>
          {/* News/Feed switcher — the changes feed (tracker edits + comp-file
              activity) is a real, live endpoint independent of NEWS_ENABLED, so
              it stays reachable here even while News itself shows an empty
              gated state. */}
          <div className="flex gap-0.5 rounded-lg bg-[var(--surface-overlay)] p-0.5">
            {(['news', 'feed'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`h-8 px-3 text-xs font-semibold rounded-md transition-colors ${
                  mode === m ? 'bg-accent text-white' : 'text-text-muted active:text-text-primary'
                }`}
              >
                {m === 'news' ? 'News' : 'Feed'}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1">
            {mode === 'news' && channel !== ALL_CHANNEL && (
              <button
                onClick={toggleSubscribe}
                title={subscribed ? `Following — notify me of new ${channelLabel(channel) ?? ''} posts` : 'Follow for notifications'}
                className={`p-1.5 rounded-lg transition-colors ${subscribed ? 'text-accent hover:bg-surface-overlay' : 'text-text-muted hover:text-text-primary hover:bg-surface-overlay'}`}
              >
                {subscribed ? <Bell size={16} /> : <BellOff size={16} />}
              </button>
            )}
            {mode === 'news' && canManageChannels && (
              <button
                onClick={() => setChannelsOpen(true)}
                title="Manage channels"
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-overlay transition-colors"
              >
                <Settings2 size={16} />
              </button>
            )}
            {mode === 'news' && (
              <button
                onClick={() => setSort((s) => (s === 'newest' ? 'oldest' : 'newest'))}
                title={sort === 'newest' ? 'Newest first — switch to oldest' : 'Oldest first — switch to newest'}
                className="flex items-center gap-1 p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-overlay transition-colors"
              >
                {sort === 'newest' ? <ArrowDownWideNarrow size={15} /> : <ArrowUpWideNarrow size={15} />}
                <span className="text-xs hidden sm:inline">{sort === 'newest' ? 'Newest' : 'Oldest'}</span>
              </button>
            )}
            {mode === 'news' && (
              <button
                onClick={load}
                disabled={loading}
                title="Refresh"
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-overlay transition-colors disabled:opacity-50"
              >
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              </button>
            )}
            {mode === 'news' && canPost && (
              <button
                onClick={openNew}
                className="ml-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-accent text-white hover:opacity-90 transition-opacity"
              >
                <Plus size={15} /> New post
              </button>
            )}
          </div>
        </div>
        {/* Channels */}
        {mode === 'news' && (
        <div className="flex gap-1 overflow-x-auto scrollbar-none">
          {tabs.map((ch) => (
            <button
              key={ch.id}
              onClick={() => setChannel(ch.id)}
              className={`flex-shrink-0 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                channel === ch.id
                  ? 'text-accent border-accent'
                  : 'text-text-muted border-transparent hover:text-text-primary'
              }`}
            >
              {ch.label}
            </button>
          ))}
        </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {mode === 'feed' ? (
          <ChangesFeedPanel />
        ) : selected ? (
          <ArticleDetail
            item={selected}
            channelLabel={channelLabel(selected.channel)}
            onBack={() => setSelected(null)}
            canManage={canManageItem(selected)}
            onEdit={openEdit}
            onDelete={handleDelete}
          />
        ) : (
          <div className="max-w-6xl mx-auto">
            {loading ? (
              <div className="space-y-4">
                <div className="rounded-2xl aspect-[16/7] w-full bg-[var(--surface-raised)] border border-[var(--border)] animate-pulse" />
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
                </div>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center text-center py-24 px-6">
                <AlertCircle size={28} className="text-red-400 mb-3" />
                <p className="text-sm text-text-secondary mb-4">{error}</p>
                <button
                  onClick={load}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--surface-raised)] border border-[var(--border)] text-text-primary active:border-accent/40 transition-colors"
                >
                  Try again
                </button>
              </div>
            ) : items.length === 0 ? (
              <EmptyState canManage={canPost} onCompose={openNew} />
            ) : (
              <div className="space-y-5">
                {featured && <FeaturedCard item={featured} onOpen={setSelected} canManage={canManageItem(featured)} onEdit={openEdit} onDelete={handleDelete} />}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {rest.map((item) => (
                    <NewsCard key={item.id} item={item} onOpen={setSelected} canManage={canManageItem(item)} onEdit={openEdit} onDelete={handleDelete} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {composeOpen && (
        <NewsComposeModal
          channels={channels}
          initialChannel={channel === ALL_CHANNEL ? undefined : channel}
          editing={editing}
          onClose={() => { setComposeOpen(false); setEditing(null) }}
          onSaved={handleSaved}
        />
      )}
      {channelsOpen && (
        <NewsChannelsModal
          channels={channels}
          onClose={() => setChannelsOpen(false)}
          onChanged={loadChannels}
        />
      )}
    </div>
  )
}
