import {
  useState, useMemo, useRef, useEffect, useCallback, useReducer, useContext,
  createContext, Children, isValidElement, cloneElement,
} from 'react'
import { ChevronDown, ChevronRight, ChevronLeft, ExternalLink, Search, X } from 'lucide-react'
import { useStorePick } from '../store/useStore'

// ─── Cross-tab search ─────────────────────────────────────────────────────────
// Every tab stays mounted (this page is static markup — no fetching, no data
// deps), so each Section can hand its own rendered text to the page on mount
// and search can cover the whole document instead of only the open tab.
// Non-matching sections hide, matching ones force open, and tabs with no hits
// drop out of the tab bar.

interface DocsSearchValue {
  /** Trimmed + lowercased. Empty string means "not searching". */
  query: string
  /** Which tab the consuming Section lives in. */
  tab: string
  register: (id: string, tab: string, title: string, text: string) => void
}

const DocsSearchContext = createContext<DocsSearchValue>({ query: '', tab: '', register: () => {} })

// ─── Match highlighting ───────────────────────────────────────────────────────
// `query` is already lowercased; matching is case-insensitive but the original
// casing is what gets rendered. <mark> doesn't affect textContent, so the
// search index Section builds from its own DOM stays unpolluted by highlights.

function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text
  const lower = text.toLowerCase()
  let idx = lower.indexOf(query)
  if (idx === -1) return text

  const out: React.ReactNode[] = []
  let pos = 0
  let n = 0
  while (idx !== -1) {
    if (idx > pos) out.push(text.slice(pos, idx))
    out.push(
      <mark key={n++} className="bg-accent/25 text-accent rounded-[3px] px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
    )
    pos = idx + query.length
    idx = lower.indexOf(query, pos)
  }
  if (pos < text.length) out.push(text.slice(pos))
  return out
}

// Walks arbitrary JSX and highlights every raw string it contains, cloning
// elements on the way down. Elements that hold their text in props rather than
// children (Table, Endpoint) have no children to walk, so they're returned
// untouched and highlight themselves from context instead — which is also what
// keeps this from double-marking their content.
function highlightChildren(children: React.ReactNode, query: string): React.ReactNode {
  if (!query) return children
  return Children.map(children, (child) => {
    if (typeof child === 'string') return highlightText(child, query)
    if (!isValidElement(child)) return child
    const kids = (child.props as { children?: React.ReactNode }).children
    if (kids == null) return child
    return cloneElement(child, undefined, highlightChildren(kids, query))
  })
}

/** Highlights a plain string against the active query. */
function useHighlight(): (text: string) => React.ReactNode {
  const { query } = useContext(DocsSearchContext)
  return useCallback((text: string) => highlightText(text, query), [query])
}

/** Highlights arbitrary JSX (e.g. a Table cell that isn't a plain string). */
function useHighlightNodes(): (node: React.ReactNode) => React.ReactNode {
  const { query } = useContext(DocsSearchContext)
  return useCallback((node: React.ReactNode) => highlightChildren(node, query), [query])
}

// ─── Small reusable primitives ────────────────────────────────────────────────

function Badge({ children, color = 'default' }: { children: string; color?: 'get' | 'post' | 'delete' | 'patch' | 'default' }) {
  const styles: Record<string, string> = {
    get:     'bg-emerald-500/15 text-emerald-500 border border-emerald-500/25',
    post:    'bg-blue-500/15 text-blue-400 border border-blue-500/25',
    delete:  'bg-red-500/15 text-red-400 border border-red-500/25',
    patch:   'bg-amber-500/15 text-amber-400 border border-amber-500/25',
    default: 'bg-[var(--surface-raised)] text-text-muted border border-[var(--border)]',
  }
  return (
    <span className={`inline-block text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded font-mono ${styles[color]}`}>
      {children}
    </span>
  )
}

function Code({ children }: { children: string }) {
  return (
    <code className="bg-[var(--surface-raised)] text-accent border border-[var(--border)] text-[11px] font-mono px-1.5 py-0.5 rounded break-all">
      {children}
    </code>
  )
}

function Pre({ children }: { children: string }) {
  return (
    <pre className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-xl text-[11px] font-mono text-text-secondary p-4 overflow-x-auto whitespace-pre leading-relaxed">
      {children}
    </pre>
  )
}

function Table({ headers, rows }: { headers: string[]; rows: (string | JSX.Element)[][] }) {
  const hl = useHighlight()
  const hlNodes = useHighlightNodes()
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--surface-raised)] border-b border-[var(--border)]">
            {headers.map(h => (
              <th key={h} className="text-left px-4 py-2.5 text-text-muted text-xs font-semibold uppercase tracking-wide">{hl(h)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={`border-b border-[var(--border)] last:border-0 ${i % 2 === 0 ? '' : 'bg-[var(--surface-raised)]/40'}`}>
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2.5 text-text-secondary align-top">
                  {typeof cell === 'string' ? hl(cell) : hlNodes(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const { query, tab, register } = useContext(DocsSearchContext)
  const bodyRef = useRef<HTMLDivElement>(null)
  const [text, setText] = useState('')

  // The body is always in the DOM (hidden via `hidden` rather than unmounted)
  // so collapsed sections are still indexed and still findable by search.
  useEffect(() => {
    const t = (bodyRef.current?.textContent ?? '').toLowerCase()
    setText(t)
    register(`${tab}:${title}`, tab, title, t)
  }, [tab, title, register])

  const hit = !query || title.toLowerCase().includes(query) || text.includes(query)
  // While searching, expand matches so the hit is visible without a click —
  // but don't clobber the user's own toggle state for when the search clears.
  const expanded = query ? true : open

  return (
    <div className="rounded-2xl overflow-hidden bg-[var(--surface-overlay)]" hidden={!hit}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5 active:bg-[var(--surface-raised)] transition-colors text-left"
      >
        <span className="text-text-primary font-semibold text-sm">{highlightText(title, query)}</span>
        {expanded ? <ChevronDown size={16} className="text-text-muted shrink-0" /> : <ChevronRight size={16} className="text-text-muted shrink-0" />}
      </button>
      <div ref={bodyRef} hidden={!expanded} className="px-4 pb-4 space-y-4">
        {highlightChildren(children, query)}
      </div>
    </div>
  )
}

function Endpoint({ method, path, description }: { method: 'GET' | 'POST' | 'DELETE' | 'PATCH'; path: string; description: string }) {
  const hl = useHighlight()
  return (
    <div className="flex items-start gap-3 py-2">
      <Badge color={method.toLowerCase() as 'get' | 'post' | 'delete' | 'patch'}>{method}</Badge>
      <div className="min-w-0 flex-1">
        <code className="text-[12px] font-mono text-text-primary break-all">{hl(path)}</code>
        <p className="text-xs text-text-muted mt-0.5">{hl(description)}</p>
      </div>
    </div>
  )
}

// ─── Tab content ──────────────────────────────────────────────────────────────

function OverviewTab() {
  return (
    <div className="space-y-6">
      <Section title="Introduction">
        <p className="text-sm text-text-secondary leading-relaxed">
          The Juice WRLD API provides programmatic access to the most comprehensive Juice WRLD music database —
          over 2,700 catalogued songs, unreleased tracks, file browsing, and rich metadata. No API key required
          for public read endpoints.
        </p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-text-muted">Base URL</span>
          <Code>https://juicewrldapi.com/juicewrld</Code>
        </div>
        <a
          href="https://juicewrldapi.com/api-docs"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
        >
          Open live API docs <ExternalLink size={11} />
        </a>
      </Section>

      <Section title="Endpoint Overview">
        <div className="divide-y divide-[var(--border)]">
          <Endpoint method="GET" path="/songs/" description="List, filter, search and paginate songs" />
          <Endpoint method="GET" path="/songs/{id}/" description="Single song by internal ID" />
          <Endpoint method="GET" path="/categories/" description="Available category values with labels" />
          <Endpoint method="GET" path="/eras/" description="All eras — paginated (34 total, 20 per page)" />
          <Endpoint method="GET" path="/stats/" description="Database-wide counts by category and era" />
          <Endpoint method="GET" path="/radio/random/" description="Random playable song with full metadata" />
          <Endpoint method="GET" path="/radio/live/" description="Live 999 FM station state — now playing, votes, listeners" />
          <Endpoint method="GET" path="/radio/stream.mp3" description="Live radio MP3 stream (WebSocket /ws/radio/ carries the same audio + metadata)" />
          <Endpoint method="GET" path="/files/browse/" description="Browse the file system" />
          <Endpoint method="GET" path="/files/info/" description="Metadata for a single file" />
          <Endpoint method="GET" path="/files/cover-art/" description="Cover art image for an audio file" />
          <Endpoint method="GET" path="/files/download/" description="Stream/download audio — supports Range requests" />
          <Endpoint method="GET" path="/versions/" description="All song-version rows (bulk mode via ?all=true)" />
          <Endpoint method="GET" path="/versions/{song_id}/" description="Version row for one song, if linked" />
          <Endpoint method="POST" path="/versions/" description="Link a song into a version group (editor+)" />
          <Endpoint method="PATCH" path="/versions/{song_id}/" description="Update a song's version label/title/group (editor+)" />
          <Endpoint method="POST" path="/playlists/share/" description="Create a public shared playlist link" />
          <Endpoint method="GET" path="/playlists/shared/{share_id}/" description="Fetch a shared playlist by ID" />
          <Endpoint method="POST" path="/plays/" description="Record a play event (no auth required)" />
          <Endpoint method="GET" path="/accounts/account/me/" description="Current user info (public-facing), incl. per-song preferences + playlist folders" />
          <Endpoint method="PATCH" path="/accounts/account/me/" description="Update user_preferences (custom titles, covers, default version, playcounts) and/or playlist_folders" />
          <Endpoint method="GET" path="/accounts/me/" description="Current user with role — editor/admin dashboards" />
          <Endpoint method="POST" path="/feedback/" description="Submit API feedback (no auth)" />
          <Endpoint method="POST" path="/reports/" description="Report wrong info on a song (no auth)" />
          <Endpoint method="GET" path="/reports/" description="List song reports (editor+)" />
          <Endpoint method="PATCH" path="/reports/{id}/" description="Review a song report (editor+)" />
          <Endpoint method="POST" path="/accounts/logout/" description="Invalidate the current token" />
          <Endpoint method="GET" path="/accounts/application/" description="Fetch the logged-in user's editor or contributor application" />
          <Endpoint method="POST" path="/accounts/application/" description="Apply to become an editor or contributor" />
          <Endpoint method="GET" path="/accounts/editor/proposals/" description="List your own edit proposals" />
          <Endpoint method="POST" path="/accounts/editor/proposals/" description="Submit an edit proposal (editor+)" />
          <Endpoint method="PATCH" path="/accounts/editor/proposals/{id}/" description="Edit a pending proposal" />
          <Endpoint method="DELETE" path="/accounts/editor/proposals/{id}/" description="Withdraw a proposal" />
          <Endpoint method="GET" path="/accounts/editor/leaderboard/" description="Editor approved-count leaderboard with badges" />
          <Endpoint method="GET" path="/accounts/contributor/proposals/" description="List your own comp-file proposals (contributor+)" />
          <Endpoint method="POST" path="/accounts/contributor/proposals/" description="Submit a comp-file proposal — multipart (contributor+)" />
          <Endpoint method="PATCH" path="/accounts/contributor/proposals/{id}/" description="Edit a pending comp-file proposal — multipart" />
          <Endpoint method="DELETE" path="/accounts/contributor/proposals/{id}/" description="Withdraw a comp-file proposal" />
          <Endpoint method="GET" path="/accounts/admin/comp-proposals/" description="List all comp-file proposals (admin)" />
          <Endpoint method="POST" path="/accounts/admin/comp-proposals/{id}/review/" description="Approve/reject a comp-file proposal (admin)" />
          <Endpoint method="POST" path="/accounts/admin/comp-proposals/{id}/reverse/" description="Reverse an approved comp-file proposal (admin)" />
          <Endpoint method="GET" path="/accounts/admin/comp-proposals/{id}/staging/" description="Download the staged file for review (admin)" />
          <Endpoint method="GET" path="/accounts/admin/comp-files/{filepath}/history/" description="Revision history for a compilation file (admin)" />
          <Endpoint method="GET" path="/library/favorites/" description="List personal favorites (any logged-in user)" />
          <Endpoint method="POST" path="/library/favorites/" description="Add a favorite" />
          <Endpoint method="DELETE" path="/library/favorites/{song_id}/" description="Remove a favorite" />
          <Endpoint method="GET" path="/library/playlists/" description="List personal playlists" />
          <Endpoint method="POST" path="/library/playlists/" description="Create a personal playlist" />
          <Endpoint method="GET" path="/library/playlists/{id}/" description="Get a personal playlist with tracks" />
          <Endpoint method="PATCH" path="/library/playlists/{id}/" description="Update name, description, cover, visibility, track order" />
          <Endpoint method="DELETE" path="/library/playlists/{id}/" description="Delete a personal playlist" />
          <Endpoint method="POST" path="/library/playlists/{id}/items/" description="Add a track to a playlist" />
          <Endpoint method="DELETE" path="/library/playlists/{id}/items/{song_id}/" description="Remove a track from a playlist" />
          <Endpoint method="GET" path="/library/playlists/public/{id}/" description="Fetch a playlist marked public — no auth required" />
        </div>
      </Section>

      <Section title="Songs Object — Full Shape">
        <Pre>{`{
  "id": 1,
  "public_id": 123,
  "name": "Song Title",
  "original_key": "Original JSON Key",
  "category": "released|unreleased|unsurfaced|recording_session",
  "path": "Compilation/folder/song.mp3",
  "era": {
    "id": 1,
    "name": "Era Name",
    "description": "Era Description",
    "time_frame": "Time Period",
    "play_count": 0
  },
  "track_titles": ["Title 1", "Title 2"],
  "credited_artists": "Artist Names",
  "producers": "Producer Names",
  "engineers": "Engineer Names",
  "recording_locations": "Studio Locations",
  "record_dates": "Recording Dates",
  "length": "3:59",
  "bitrate": "Bitrate Info",
  "additional_information": "Extra Info",
  "file_names": "File Name(s)",
  "instrumentals": "Instrumental beat name",
  "instrumental_names": "Instrumental track names",
  "preview_date": "Preview Date",
  "release_date": "Release Date",
  "dates": "Additional Dates",
  "session_titles": "Session Titles",
  "session_tracking": "Session Tracking",
  "notes": "Internal notes",
  "groupbuy_info": {
    "additional_info": "",
    "price": "",
    "start_date": "",
    "end_date": "",
    "blind": false,
    "finished": false,
    "surfaced_with_og": false
  },
  "lyrics": "Song Lyrics",
  "synced_lyrics": "Timestamped lyrics (karaoke-style)",
  "album": "Album Name",
  "snippets": [],
  "date_leaked": "Leak Date",
  "leak_type": "Leak Type",
  "image_url": "/assets/era-image.webp",
  "version_title": "Version label (only with ?versions=true on /songs/)",
  "versions": []
}`}</Pre>
        <p className="text-xs text-text-muted">
          <Code>image_url</Code> is relative — prepend <Code>https://juicewrldapi.com</Code> before use.
        </p>
        <p className="text-xs text-text-muted">
          <Code>version_title</Code> / <Code>versions</Code> are omitted unless the request includes <Code>?versions=true</Code> — see the <Code>/songs/</Code> params below.
        </p>
        <p className="text-xs text-text-muted font-semibold mt-3">
          <Code>synced_lyrics</Code> — no separate param, no opt-in flag
        </p>
        <p className="text-xs text-text-muted">
          Unlike <Code>version_title</Code>/<Code>versions</Code> above, <Code>synced_lyrics</Code> is a plain field
          on the song object like <Code>lyrics</Code> — it comes back on every request that returns a song (list,
          detail, radio, live), with no query param needed to request it. It&apos;s <Code>null</Code> when the song
          has no synced lyrics.
        </p>
        <p className="text-xs text-text-muted">
          Format is <span className="font-semibold text-text-primary">LRC</span> — one timestamp per line,{' '}
          <Code>[mm:ss.xx]</Code> (also accepts <Code>[mm:ss:xx]</Code>), text after the bracket:
        </p>
        <Pre>{`[00:12.50]First line
[00:15.80]Second line
[00:19.10](ad-lib) Next line`}</Pre>
        <p className="text-xs text-text-muted">
          A line can carry more than one timestamp (repeats the same text at each). Parenthesized runs like{' '}
          <Code>(ad-lib)</Code> are a convention this app renders dimmer, not part of the LRC spec itself.
        </p>
      </Section>
    </div>
  )
}

function SongsTab() {
  return (
    <div className="space-y-6">
      <Section title="GET /songs/ — List & Search">
        <p className="text-sm text-text-secondary">Paginated song list with rich filtering. All params are optional.</p>
        <Table
          headers={['Param', 'Type', 'Description']}
          rows={[
            [<Code>page</Code>, 'number', 'Page number (default: 1)'],
            [<Code>page_size</Code>, 'number', 'Results per page (default: 20)'],
            [<Code>category</Code>, 'string', <><Code>released</Code>, <Code>unreleased</Code>, <Code>unsurfaced</Code>, <Code>recording_session</Code></>],
            [<Code>era</Code>, 'string', 'Era abbreviation e.g. "GB&GR", "DRFL", "WOD", "OUT", "POST" — use name from /eras/'],
            [<Code>search</Code>, 'string', 'Search names, artists, track titles (normalizes special chars — "dont" matches "don\'t")'],
            [<Code>searchall</Code>, 'string', 'Search names, artists, producers, track titles'],
            [<Code>lyrics</Code>, 'string', 'Full-text search within lyrics content'],
            [<Code>all</Code>, 'string', <>&quot;true&quot; returns the <span className="font-semibold text-text-primary">entire catalogue in one response</span> as a plain array — no pagination envelope, and <Code>page</Code>/<Code>page_size</Code> are ignored. It&apos;s ~2,500 songs, so use it for whole-dataset work (calendars, grouping, offline seeding), not for lists a user scrolls.</>],
            [<Code>file_names_array</Code>, 'string', '"true" to return file_names as array instead of string'],
            [<Code>versions</Code>, 'string', <>"true" to add <Code>version_title</Code> and a <Code>versions</Code> array to each song. Collection endpoint only — <Code>{'/songs/{id}/'}</Code> ignores it.</>],
          ]}
        />
        <p className="text-xs text-text-muted font-semibold mt-2">Response shape:</p>
        <Pre>{`{
  "count": 1234,
  "next": "https://juicewrldapi.com/juicewrld/songs/?page=2",
  "previous": null,
  "results": [ /* Song objects */ ]
}`}</Pre>
        <p className="text-xs text-text-muted font-semibold mt-2">With <Code>?all=true</Code> — bare array, no envelope:</p>
        <Pre>{`[ /* every Song object */ ]`}</Pre>
        <p className="text-xs text-text-muted">
          Note there is <span className="font-semibold text-text-primary">no ordering/sort param</span>, and{' '}
          <Code>category</Code>/<Code>era</Code> each accept only one value per request — sorting, and any
          multi-category or multi-era view, has to be assembled client-side.
        </p>
      </Section>

      <Section title="GET /songs/{id}/ — Single Song">
        <p className="text-sm text-text-secondary">Returns a full song object by internal ID (<Code>song.id</Code>, not <Code>public_id</Code>).</p>
      </Section>

      <Section title="GET /categories/">
        <Pre>{`{
  "categories": [
    { "value": "released",          "label": "Released" },
    { "value": "unreleased",        "label": "Unreleased" },
    { "value": "unsurfaced",        "label": "Unsurfaced" },
    { "value": "recording_session", "label": "Recording Session" }
  ]
}`}</Pre>
      </Section>

      <Section title="GET /eras/">
        <p className="text-sm text-text-secondary">Paginated — same envelope as /songs/. 34 eras total. Era names use short abbreviation strings.</p>
        <Pre>{`{
  "count": 34,
  "next": "http://juicewrldapi.com/juicewrld/eras/?page=2",
  "previous": null,
  "results": [
    { "id": 101, "name": "jute",        "description": "JUICED UP THE EP era (~2014-February 2017)", "time_frame": "(January 2014-February 2017)", "play_count": 2980 },
    { "id": 103, "name": "afflictions", "description": "Affliction era (February 2017-May 2017)",    "time_frame": "(February 2017-May 2017)",   "play_count": 1398 },
    { "id": 105, "name": "jw 999",      "description": "Juice WRLD 999 era (May 2017-May 2018)",     "time_frame": "(May 2017-May 2018)",        "play_count": 1389 },
    { "id": 108, "name": "GB&GR",       "description": "Goodbye & Good Riddance era",                "time_frame": "(December 2017-May 2018)",   "play_count": 15485 },
    { "id": 109, "name": "WOD",         "description": "WRLD On Drugs era",                          "time_frame": "(August 2018-December 2018)", "play_count": 11228 },
    { "id": 110, "name": "DRFL",        "description": "Death Race For Love era",                    "time_frame": "(May 2018-March 2019)",      "play_count": 11040 },
    { "id": 111, "name": "OUT",         "description": "Outsiders era",                              "time_frame": "(March 2019-December 2019)", "play_count": 13729 },
    { "id": 112, "name": "POST",        "description": "Posthumous era",                             "time_frame": "(December 2019-Present)",    "play_count": 3660 }
    // ... 34 total
  ]
}`}</Pre>
        <p className="text-xs text-text-muted mt-1">
          Pass <Code>name</Code> as the <Code>era</Code> filter param on /songs/ — e.g. <Code>era=GB%26GR</Code>.
        </p>
      </Section>

      <Section title="GET /stats/">
        <Pre>{`{
  "total_songs": 2452,
  "category_stats": {
    "released":          320,
    "unreleased":        1462,
    "unsurfaced":        269,
    "recording_session": 401
  },
  "era_stats": {
    "GB&GR":       574,
    "OUT":         312,
    "POST":        369,
    "WOD":         488,
    "DRFL":        326,
    "Mainstream":  63,
    "jute":        37
    // ... one key per era
  }
}`}</Pre>
        <p className="text-xs text-text-muted">Era keys in <Code>era_stats</Code> match the <Code>name</Code> field from <Code>/eras/</Code>.</p>
      </Section>

      <Section title="GET /radio/random/">
        <p className="text-sm text-text-secondary">Returns a random playable song with full metadata and stream path.</p>
        <Pre>{`{
  "id": "Compilation/1. Released Discography/.../song.mp3",
  "title": "Song Title",
  "path": "Compilation/1. Released Discography/.../song.mp3",
  "size": 5195736,
  "modified": "2025-10-18T19:19:53.784271",
  "hash": "d199a85e510b32b9ef3c02a29044a41d",
  "song": { /* Full song object */ }
}`}</Pre>
      </Section>
    </div>
  )
}

function FilesTab() {
  return (
    <div className="space-y-6">
      <Section title="GET /files/browse/ — Directory Listing">
        <Table
          headers={['Param', 'Required', 'Description']}
          rows={[
            [<Code>path</Code>, 'No', 'Directory path relative to compilation root'],
            [<Code>search</Code>, 'No', 'Filter items by name (e.g. ".mp3")'],
          ]}
        />
      </Section>

      <Section title="GET /files/info/ — File Metadata">
        <Table
          headers={['Param', 'Required', 'Description']}
          rows={[
            [<Code>path</Code>, 'Yes', 'File path relative to compilation root'],
          ]}
        />
      </Section>

      <Section title="GET /files/cover-art/ — Cover Art Image">
        <Table
          headers={['Param', 'Required', 'Description']}
          rows={[
            [<Code>path</Code>, 'Yes', 'Audio file path relative to compilation root'],
            [<Code>small</Code>, 'No', <>&quot;true&quot; — returns a degraded ~128px JPEG instead of the full-size embedded art</>],
          ]}
        />
        <p className="text-xs text-text-muted">
          The original is often a 600×600 PNG around 1&nbsp;MB. <Code>small=true</Code> serves the same image
          downscaled to a few KB — use it for anything drawn at thumbnail size, and as a fast first paint
          before the full-size one loads.
        </p>
        <Pre>{`GET /files/cover-art/?path=Compilation/…/Lucid Dreams.mp3&small=true`}</Pre>
      </Section>

      <Section title="GET /files/download/ — Audio Stream">
        <p className="text-sm text-text-secondary">
          The primary audio streaming endpoint. Supports HTTP Range requests — the browser{' '}
          <Code>{'<audio>'}</Code> element handles seeking automatically when you set <Code>src</Code>.
        </p>
        <Table
          headers={['Param', 'Required', 'Description']}
          rows={[
            [<Code>path</Code>, 'Yes', 'File path relative to compilation root'],
            [<Code>small</Code>, 'No', <>&quot;true&quot; — for an image path, returns a degraded/downscaled version instead of the original</>],
          ]}
        />
        <p className="text-xs text-text-muted">
          <Code>small=true</Code> only makes sense when <Code>path</Code> points at an image (e.g. a cover art
          file) — pass it to shrink a large cover for a thumbnail without fetching the full-size original.
          For audio, it has no effect.
        </p>
        <Pre>{`GET /files/download/?path=Compilation/cover.jpg&small=true`}</Pre>
        <p className="text-xs text-text-muted font-semibold mt-3">Simple playback:</p>
        <Pre>{`<audio
  controls
  src={\`https://juicewrldapi.com/juicewrld/files/download/?path=\${encodeURIComponent(song.path)}\`}
/>`}</Pre>
        <p className="text-xs text-text-muted font-semibold mt-3">Manual Range request (for custom seeking):</p>
        <Pre>{`fetch(
  \`https://juicewrldapi.com/juicewrld/files/download/?path=\${encodeURIComponent(path)}\`,
  { headers: { Range: 'bytes=0-1048575' } }
)
// Returns 206 Partial Content with Content-Range header`}</Pre>
        <p className="text-xs text-text-muted mt-2">Responses: <Code>200 OK</Code> full file · <Code>206 Partial Content</Code> range</p>
      </Section>

      <Section title="ZIP Operations">
        <div className="space-y-3">
          <div>
            <div className="flex items-center gap-2 mb-1"><Badge color="post">POST</Badge><code className="text-xs font-mono text-text-primary break-all">/start-zip-job/</code></div>
            <p className="text-xs text-text-muted">Start a background ZIP job. Returns a <Code>job_id</Code> for polling.</p>
            <Pre>{`{ "paths": ["Compilation/song1.mp3", "Compilation/song2.mp3"] }`}</Pre>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1"><Badge color="get">GET</Badge><code className="text-xs font-mono text-text-primary break-all">/zip-job-status/{'{job_id}'}/ </code></div>
            <p className="text-xs text-text-muted">Poll ZIP job progress.</p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1"><Badge color="post">POST</Badge><code className="text-xs font-mono text-text-primary break-all">/cancel-zip-job/{'{job_id}'}/ </code></div>
            <p className="text-xs text-text-muted">Cancel an in-progress ZIP job.</p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1"><Badge color="post">POST</Badge><code className="text-xs font-mono text-text-primary break-all">/files/zip-selection/</code></div>
            <p className="text-xs text-text-muted">Immediate ZIP stream (not background).</p>
            <Pre>{`{ "paths": ["Compilation/Folder"] }`}</Pre>
          </div>
        </div>
      </Section>
    </div>
  )
}

function PlaylistsTab() {
  return (
    <div className="space-y-6">
      <Section title="Shared Playlists (no auth required)">
        <p className="text-sm text-text-secondary">
          Public, anonymous-link playlists. Anyone with the share ID can read them.
        </p>
        <div className="space-y-3">
          <div>
            <div className="flex items-center gap-2 mb-1"><Badge color="post">POST</Badge><code className="text-xs font-mono text-text-primary break-all">/playlists/share/</code></div>
            <Pre>{`// Request
{ "paths": ["Compilation/song1.mp3", "Compilation/song2.mp3"] }

// Response
{ "share_id": "abc123..." }`}</Pre>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1"><Badge color="get">GET</Badge><code className="text-xs font-mono text-text-primary break-all">/playlists/shared/{'{share_id}'}/ </code></div>
            <p className="text-xs text-text-muted">Full shared playlist with all track metadata.</p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1"><Badge color="get">GET</Badge><code className="text-xs font-mono text-text-primary break-all">/playlists/shared/{'{share_id}'}/info/</code></div>
            <p className="text-xs text-text-muted">Lightweight preview — name + track count without full fetch.</p>
          </div>
        </div>
      </Section>

      <Section title="Personal Library Playlists (auth required)">
        <p className="text-sm text-text-secondary">
          Private, account-synced playlists. Any logged-in user (including standard accounts) can use these — does not require editor role.
        </p>
        <Table
          headers={['Method', 'Path', 'Description']}
          rows={[
            ['GET', '/library/playlists/', 'List all playlists for logged-in user (supports ?omit_cover_image=true)'],
            ['POST', '/library/playlists/', 'Create a playlist'],
            ['GET', '/library/playlists/{id}/', 'Get playlist with full track list'],
            ['PATCH', '/library/playlists/{id}/', 'Update name, description, cover, visibility, or reorder tracks'],
            ['DELETE', '/library/playlists/{id}/', 'Delete a playlist'],
            ['POST', '/library/playlists/{id}/items/', 'Add a track'],
            ['DELETE', '/library/playlists/{id}/items/{song_id}/', 'Remove a track'],
          ]}
        />
        <p className="text-xs text-text-muted mt-2">
          <Code>?omit_cover_image=true</Code> drops the (large, base64) <Code>cover_image</Code> field from the response — use it for
          list views that only need <Code>cover_image_url</Code>.
        </p>
        <p className="text-xs text-text-muted font-semibold mt-3">Create:</p>
        <Pre>{`POST /library/playlists/
Authorization: Token <token>

{
  "name": "My Playlist",
  "description": "optional",
  "cover_image": undefined  // optional base64 string
}`}</Pre>
        <p className="text-xs text-text-muted font-semibold mt-3">Update (all fields optional, including track reorder):</p>
        <Pre>{`PATCH /library/playlists/{id}/

{
  "name": "New name",
  "description": "New description",
  "cover_image": "",         // base64, or "" to clear
  "is_public": true,         // toggle public sharing (see below)
  "order": [123, 456, 789]  // song IDs in desired order
}`}</Pre>
        <p className="text-xs text-text-muted font-semibold mt-3">List response — each item:</p>
        <Pre>{`{
  "id": 1,
  "name": "My Playlist",
  "description": "optional",
  "cover_image": "...",
  "cover_image_url": "...",  // fallback to first track image_url
  "track_count": 12,
  "is_public": false,
  "created_at": "...",
  "updated_at": "..."
}`}</Pre>
        <p className="text-xs text-text-muted font-semibold mt-3">Detail response — same fields plus <Code>items[]</Code>:</p>
        <Pre>{`{
  "id": 1,
  "name": "My Playlist",
  "is_public": false,
  "items": [
    {
      "id": 501,
      "position": 0,
      "added_at": "...",
      "song": {
        "id": 123, "public_id": 163, "name": "Maze",
        "path": "Compilation/.../Maze.mp3",
        "length": "2:24", "credited_artists": "Juice WRLD",
        "category": "released", "album": "...",
        "image_url": "/assets/drfl.png",
        "era": { /* era object */ },
        "lyrics": "...", "synced_lyrics": "..."
      }
    }
  ]
}`}</Pre>
        <p className="text-xs text-text-muted mt-2">The song object in playlist items is a trimmed shape — no <Code>producers</Code>, <Code>engineers</Code>, or <Code>bitrate</Code>.</p>
      </Section>

      <Section title="Public Library Playlists (no auth required)">
        <p className="text-sm text-text-secondary">
          A personal library playlist with <Code>is_public: true</Code> can be fetched anonymously by its numeric{' '}
          <Code>id</Code> — distinct from the ephemeral, no-account "Shared Playlists" above. Toggle visibility via{' '}
          <Code>{'PATCH /library/playlists/{id}/'}</Code> with <Code>{'{ "is_public": true }'}</Code>.
        </p>
        <Table
          headers={['Method', 'Path', 'Description']}
          rows={[
            ['GET', '/library/playlists/public/{id}/', 'Full playlist detail (same shape as the authed detail response)'],
          ]}
        />
        <p className="text-xs text-text-muted mt-2">Making a playlist public does not change its owner or contents — it only exposes this read-only endpoint.</p>
      </Section>

      <Section title="Favorites (auth required)">
        <Table
          headers={['Method', 'Path', 'Description']}
          rows={[
            ['GET', '/library/favorites/', 'List favorite tracks'],
            ['POST', '/library/favorites/', 'Add a favorite — body: { song_id }'],
            ['DELETE', '/library/favorites/{song_id}/', 'Remove a favorite'],
          ]}
        />
      </Section>
    </div>
  )
}

function AuthTab() {
  return (
    <div className="space-y-6">
      <Section title="Roles">
        <Table
          headers={['Role', 'role string', 'is_editor', 'is_administrator', 'is_contributor']}
          rows={[
            ['Standard', <Code>applicant</Code>, '—', '—', '—'],
            ['Editor', <Code>editor</Code>, '✓', '—', '—'],
            ['Contributor', <Code>contributor</Code>, '—', '—', '✓'],
            ['Admin', <Code>administrator</Code>, '✓', '✓', '—'],
          ]}
        />
        <p className="text-xs text-text-muted mt-2">
          New Discord users start as <Code>applicant</Code>. Editors are promoted after application approval. Admins are assigned manually.
          Admins always have <Code>is_editor: true</Code>.
        </p>
        <p className="text-xs text-text-muted mt-2">
          <Code>contributor</Code> is a separate track from editor — it grants access to the comp-file proposal
          pipeline below (uploading/replacing/moving/deleting files in the compilation), not to song-data edit
          proposals. A user can hold either role independently of the other. <Code>is_manager</Code> is an optional
          flag layered on top of admin for reviewing comp-file proposals specifically — treat it as absent unless
          the account payload actually includes it.
        </p>
        <p className="text-xs text-text-muted font-semibold mt-3">Attach token to every authenticated request:</p>
        <Pre>{`Authorization: Token YOUR_TOKEN_HERE`}</Pre>
      </Section>

      <Section title="Discord Login (recommended)">
        <ol className="space-y-3 text-sm text-text-secondary list-decimal list-inside">
          <li><code className="text-accent font-mono text-xs break-all">GET /accounts/auth/discord/url/</code> → returns <Code>authorize_url</Code> and <Code>state</Code></li>
          <li>Redirect the user through Discord OAuth using <Code>authorize_url</Code></li>
          <li>Exchange the code Discord returns:</li>
        </ol>
        <Pre>{`POST /accounts/auth/discord/exchange/

{
  "code": "discord_auth_code",
  "state": "state_from_step_1",
  "redirect_uri": "https://your-app.com/callback"
}

// Response includes token + user object`}</Pre>
        <p className="text-xs text-text-muted">Store the token and attach it as <Code>Authorization: Token &lt;token&gt;</Code> on subsequent requests.</p>
      </Section>

      <Section title="Logout">
        <Pre>{`POST /accounts/logout/
Authorization: Token <token>`}</Pre>
        <p className="text-xs text-text-muted">Invalidates the token server-side. Clear the locally stored token regardless of whether this call succeeds.</p>
      </Section>

      <Section title="Admin Login">
        <p className="text-sm text-text-secondary">Username/password — administrators only. Not needed for a public music player.</p>
        <Pre>{`POST /accounts/login/

{
  "token": "abc123...",
  "profile": { "role": "administrator", "is_editor": true, "is_administrator": true },
  "requires_otp_setup": false
}`}</Pre>
      </Section>

      <Section title="Who Am I — Two Endpoints">
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1"><Badge color="get">GET</Badge><code className="text-xs font-mono text-text-primary break-all">/accounts/account/me/</code></div>
            <p className="text-xs text-text-muted mb-2">Public-facing. No <Code>role</Code> string — booleans only. Use this for music player UI gating.</p>
            <Pre>{`{
  "id": 42,
  "display_name": "someuser",
  "discord_id": "123456789",
  "discord_username": "someuser",
  "discord_avatar": "https://cdn.discordapp.com/avatars/...",
  "is_editor": false,
  "is_administrator": false,
  "is_contributor": false,
  "otp_enabled": false,
  "user_preferences": [
    { "song": 94086, "name": "My title", "cover_url": "/assets/wod.jpg", "default_version": "v1", "playcount": 12 }
  ],
  "playlist_folders": [
    { "id": "f1", "name": "Favorites", "playlist_ids": [12, 34] }
  ],
  "listening_plays": [
    { "song": 94086, "played_at": "2026-08-03T20:14:00Z" }
  ]
}`}</Pre>
            <p className="text-xs text-text-muted mt-2">
              Also mounted at <Code>/juicewrld/accounts/account/me/</Code> (same handler, different prefix).
            </p>
            <p className="text-xs text-text-muted mt-2">
              <Code>listening_plays</Code> and <Code>is_manager</Code> aren&apos;t guaranteed present on every
              account payload yet — read them defensively (optional/undefined, not required).
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1"><Badge color="patch">PATCH</Badge><code className="text-xs font-mono text-text-primary break-all">/accounts/account/me/</code></div>
            <p className="text-xs text-text-muted mb-2">
              Updates the logged-in user&apos;s own <Code>user_preferences</Code>, <Code>playlist_folders</Code>, and/or{' '}
              <Code>listening_plays</Code> blobs — see the sections below for what goes in each.
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1"><Badge color="get">GET</Badge><code className="text-xs font-mono text-text-primary break-all">/accounts/me/</code></div>
            <p className="text-xs text-text-muted mb-2">Editor/admin dashboards. Includes raw <Code>role</Code> string and extra stats.</p>
            <Pre>{`{
  "username": "discord_123456789",
  "role": "applicant",
  "is_editor": false,
  "is_administrator": false,
  "is_contributor": false,
  "is_superuser": false,
  "otp_enabled": false,
  "discord_id": "123456789",
  "discord_username": "someuser",
  "discord_avatar": "https://cdn.discordapp.com/avatars/...",
  "approved_count": 0,
  "badges": []
}`}</Pre>
            <p className="text-xs text-text-muted mt-2">
              <Code>role</Code> is <Code>&quot;applicant&quot; | &quot;editor&quot; | &quot;contributor&quot; | &quot;administrator&quot;</Code> —
              widened from three values to four with the contributor track. Don&apos;t treat it as a strict
              editor-vs-admin ladder; check the specific boolean (<Code>is_editor</Code>/<Code>is_contributor</Code>/<Code>is_administrator</Code>)
              for the access you actually need.
            </p>
          </div>
        </div>
      </Section>

      <Section title="Per-Song Preferences — custom titles, covers, playcounts">
        <p className="text-sm text-text-secondary leading-relaxed">
          <Code>user_preferences</Code> is a per-user, per-song override list carried on the profile: a personal
          display <span className="font-semibold text-text-primary">name</span>, a personal{' '}
          <span className="font-semibold text-text-primary">cover</span>, a preferred{' '}
          <span className="font-semibold text-text-primary">version</span> to play within the song&apos;s version
          group, and a <span className="font-semibold text-text-primary">playcount</span>. These are personal only —
          they never change the song for anyone else, and editors proposing upstream edits see the API&apos;s own
          untouched values.
        </p>
        <Pre>{`{
  "song": 94086,              // API song id (song.id, not public_id)
  "name": "My title",         // null = use the song's own title
  "cover_url": "Compilation/.../cover.jpg",
  "default_version": "v1",    // null = no preference
  "playcount": 12
}`}</Pre>
        <Table
          headers={['Field', 'Type', 'Meaning']}
          rows={[
            [<Code>song</Code>, 'number', 'Which song this row overrides. The only required field.'],
            [<Code>name</Code>, 'string | null', 'Custom display title. Null falls back to the song\'s own title.'],
            [<Code>cover_url</Code>, 'string | null', 'Custom cover art. Null falls back to the song\'s image_url.'],
            [<Code>default_version</Code>, 'string | null', <>Preferred version <span className="font-semibold text-text-primary">label</span> (e.g. <Code>v1</Code>, <Code>OG</Code>, <Code>TV Mix</Code>) — matched against the <Code>version</Code> field in the <Code>/versions/</Code> table, not a song id, so it survives songs being relinked or groups merging. A default set on any group member governs the whole group.</>],
            [<Code>playcount</Code>, 'number', 'How many times this user played the song. Client-owned — there is no server-side increment endpoint.'],
          ]}
        />
        <p className="text-xs text-text-muted font-semibold mt-3">Resolving <Code>cover_url</Code>:</p>
        <Table
          headers={['Form', 'Example', 'Resolves to']}
          rows={[
            ['Absolute URL', 'https://… / data: / blob:', 'Used as-is'],
            ['Leading slash', '/assets/wod.jpg', <>Site-relative asset — prepend <Code>https://juicewrldapi.com</Code> (same shape as a song&apos;s <Code>image_url</Code>)</>],
            ['Anything else', 'Compilation/…/cover.jpg', <>A path into file storage — fetch via <Code>/files/cover-art/?path=</Code></>],
          ]}
        />
        <p className="text-xs text-text-muted font-semibold mt-3">Write semantics — read this before implementing:</p>
        <ul className="space-y-2 text-sm text-text-secondary">
          <li className="flex items-start gap-2"><span className="text-accent mt-0.5">•</span> It&apos;s <span className="font-semibold text-text-primary">one JSON blob, not per-song rows</span> — there is no per-song save and no delete. The client owns the whole array and PATCHes it in full; sending a shorter array is how a row gets removed.</li>
          <li className="flex items-start gap-2"><span className="text-accent mt-0.5">•</span> Debounce the pushes. A burst of edits (or plays) should collapse into one PATCH rather than one per change.</li>
          <li className="flex items-start gap-2"><span className="text-accent mt-0.5">•</span> On login, merge the server&apos;s copy into the local one taking <Code>max()</Code> of each <Code>playcount</Code> — otherwise plays made while signed out or on another device get overwritten.</li>
          <li className="flex items-start gap-2"><span className="text-accent mt-0.5">•</span> The validator caps the array at <span className="font-semibold text-text-primary">500 rows</span>. Past that, drop playcount-only rows first — rows carrying a real override (name/cover/version) are the ones worth keeping, since every song played creates a playcount row.</li>
          <li className="flex items-start gap-2"><span className="text-accent mt-0.5">•</span> Normalize cleared text fields to <Code>null</Code>, not <Code>""</Code> — an empty string reads as a real override downstream.</li>
        </ul>
      </Section>

      <Section title="Playlist Folders">
        <p className="text-sm text-text-secondary">
          <Code>playlist_folders</Code> groups the user&apos;s playlists into folders. Same blob mechanics as{' '}
          <Code>user_preferences</Code> above — whole-array PATCH on <Code>/accounts/account/me/</Code>, no per-folder route.
        </p>
        <Pre>{`{
  "id": "f1",
  "name": "Favorites",
  "playlist_ids": [12, 34]
}`}</Pre>
        <Table
          headers={['Field', 'Type', 'Meaning']}
          rows={[
            [<Code>id</Code>, 'string', 'Client-generated folder id — round-trips unchanged'],
            [<Code>name</Code>, 'string', 'Folder display name'],
            [<Code>playlist_ids</Code>, 'number[]', 'Library playlist IDs in this folder'],
          ]}
        />
        <p className="text-xs text-text-muted">Limits: max 200 folders, max 500 playlist ids per folder.</p>
      </Section>

      <Section title="Listening History">
        <p className="text-sm text-text-secondary">
          <Code>listening_plays</Code> is a raw per-play log — one entry per listen, distinct from{' '}
          <Code>user_preferences[].playcount</Code> which is just a running total per song. Same blob mechanics:
          whole-array PATCH on <Code>/accounts/account/me/</Code>, no per-event route.
        </p>
        <Pre>{`{
  "song": 94086,
  "played_at": "2026-08-03T20:14:00Z"
}`}</Pre>
        <Table
          headers={['Field', 'Type', 'Meaning']}
          rows={[
            [<Code>song</Code>, 'number', 'API song id that was played'],
            [<Code>played_at</Code>, 'string', 'ISO 8601 timestamp of the play'],
          ]}
        />
        <p className="text-xs text-text-muted">
          Capped at <span className="font-semibold text-text-primary">10,000 events</span> — send the whole array,
          debounced the same way as <Code>user_preferences</Code>, so a burst of plays collapses into one PATCH
          rather than one per play.
        </p>
      </Section>

      <Section title="Permission Matrix">
        <Table
          headers={['Access Level', 'Endpoints']}
          rows={[
            ['No login', 'Songs, eras, categories, files, radio, stats, shared playlists, play tracking, feedback, report submission'],
            ['Any logged-in user', '/account/me/ (incl. PATCH), /application/, /library/*'],
            ['Editor or admin', '/me/, /editor/proposals/, /editor/leaderboard/, /badges/, /reports/ (read + review)'],
            ['Contributor', '/contributor/proposals/ (comp-file proposals — read/write your own)'],
            ['Admin only', '/admin/users/, /admin/proposals/, /admin/applications/, /admin/comp-proposals/, /admin/comp-files/'],
            ['Beta code (X-Beta-Code)', '/beta/versions, /beta/download — independent of the token/role system'],
          ]}
        />
        <p className="text-xs text-text-muted mt-2">
          A 403 response means insufficient role — message text is typically{' '}
          <Code>"Editor access required."</Code> or <Code>"Administrator access required."</Code>.
        </p>
      </Section>

      <Section title="Edit Proposals (Editor+)">
        <Table
          headers={['Method', 'Path', 'Description']}
          rows={[
            ['GET', '/accounts/editor/proposals/', "List the logged-in editor's own proposals"],
            ['POST', '/accounts/editor/proposals/', 'Submit a new proposal'],
            ['PATCH', '/accounts/editor/proposals/{id}/', 'Edit a still-pending proposal'],
            ['DELETE', '/accounts/editor/proposals/{id}/', 'Withdraw a proposal'],
          ]}
        />
        <p className="text-xs text-text-muted">
          <Code>change_type</Code> is <Code>"create"</Code>, <Code>"update"</Code>, or <Code>"delete"</Code> — <Code>"update"</Code> is by far the most common in practice.
        </p>
        <Pre>{`POST /accounts/editor/proposals/
Authorization: Token <token>
Content-Type: application/json

{
  "change_type": "update",
  "song": 94086,
  "title": "Song Title",
  "editor_notes": "",
  "proposed_data": {
    "lyrics": "..."
  }
}`}</Pre>
        <Table
          headers={['Field', 'Type', 'Description']}
          rows={[
            [<Code>change_type</Code>, 'string', '"create" | "update" | "delete"'],
            [<Code>song</Code>, 'number | null', 'Internal song ID (song.id, not public_id) — null for a "create" proposal'],
            [<Code>title</Code>, 'string', 'Song title for display purposes'],
            [<Code>editor_notes</Code>, 'string', 'Optional notes from the editor'],
            [<Code>proposed_data</Code>, 'object', 'Only the fields being changed'],
          ]}
        />
        <p className="text-xs text-text-muted">
          To re-submit a stale/stuck pending proposal, <Code>DELETE</Code> it then <Code>POST</Code> the same data again as a fresh proposal (there's no separate "resubmit" endpoint).
        </p>
        <p className="text-xs text-text-muted font-semibold mt-3">Proposal object shape:</p>
        <Pre>{`{
  "id": 167,
  "editor_username": "freakypallet",
  "editor_id": 12,
  "song": 94086,
  "song_public_id": 163,
  "change_type": "update",
  "title": "Song Title",
  "proposed_data": { "lyrics": "..." },
  "original_proposed_data": { "lyrics": "..." },
  "applied_data": {},
  "revised_by_admin": false,
  "original_snapshot": { /* Full song fields at time of proposal */ },
  "editor_notes": "",
  "status": "pending",
  "reviewer_username": null,
  "review_notes": "",
  "edit_count": 0,
  "last_edited_at": null,
  "created_at": "2026-06-16T22:07:24.970047Z",
  "reviewed_at": null
}`}</Pre>
        <p className="text-xs text-text-muted"><Code>status</Code> is one of <Code>pending</Code>, <Code>approved</Code>, <Code>rejected</Code>, <Code>reversed</Code>.</p>
      </Section>

      <Section title="Applications (Editor or Contributor)">
        <p className="text-sm text-text-secondary">
          How a standard user applies for either the editor or the contributor track — same endpoint, distinguished
          by <Code>application_type</Code>.
        </p>
        <Table
          headers={['Method', 'Path', 'Description']}
          rows={[
            ['GET', '/accounts/application/', "Fetch the logged-in user's own application (null if none)"],
            ['POST', '/accounts/application/', 'Submit an application'],
          ]}
        />
        <Pre>{`POST /accounts/application/

{
  "application_type": "editor",  // "editor" | "contributor"
  "display_name": "optional",
  "contact": "optional",
  "experience": "optional",
  "motivation": "required — why you want this access",
  "areas": "optional"
}`}</Pre>
        <p className="text-xs text-text-muted"><Code>status</Code> on the returned application is <Code>pending</Code>, <Code>approved</Code>, or <Code>rejected</Code>.</p>
        <p className="text-xs text-text-muted">
          Approving a <Code>contributor</Code> application should set <Code>is_contributor</Code>, not{' '}
          <Code>is_editor</Code> — the two tracks are separate (see Roles above).
        </p>
      </Section>

      <Section title="Editor Leaderboard">
        <div className="flex items-center gap-2 mb-1"><Badge color="get">GET</Badge><code className="text-xs font-mono text-text-primary break-all">/accounts/editor/leaderboard/</code></div>
        <p className="text-xs text-text-muted mb-2">Ranked by approved proposal count. No auth required to view.</p>
        <Pre>{`[
  {
    "rank": 1,
    "user_id": 12,
    "username": "freakypallet",
    "discord_username": "freakypallet",
    "discord_avatar": "https://cdn.discordapp.com/avatars/...",
    "approved_count": 214,
    "badges": [
      {
        "slug": "hundred-club",
        "name": "100 Club",
        "description": "100 approved edits",
        "icon": "🏅",
        "category": "milestone",
        "note": "",
        "awarded_at": "...",
        "awarded_by_username": null
      }
    ]
  }
]`}</Pre>
      </Section>

      <Section title="Play Tracking">
        <p className="text-sm text-text-secondary">Record a listen event — no auth required. Call when a track starts (or after e.g. 30 s).</p>
        <Pre>{`POST /juicewrld/plays/`}</Pre>
      </Section>

      <Section title="Feedback">
        <div className="flex items-center gap-2 mb-1"><Badge color="post">POST</Badge><code className="text-xs font-mono text-text-primary break-all">/juicewrld/feedback/</code></div>
        <p className="text-xs text-text-muted mb-2">General API/app feedback. No auth required. Forwards to a webhook + the mod server.</p>
        <Pre>{`{
  "message": "required",
  "contact": "optional"
}`}</Pre>
        <p className="text-xs text-text-muted">Throttled at <Code>10/min</Code>.</p>
      </Section>

      <Section title="Song Reports">
        <p className="text-sm text-text-secondary">
          Public-facing way to flag wrong/missing info on a specific song. Submissions go to the DB and are forwarded
          to the mod server via webhook; editors triage them from the queue.
        </p>
        <Table
          headers={['Method', 'Path', 'Access', 'Description']}
          rows={[
            ['POST', '/juicewrld/reports/', 'No auth', 'Submit a report'],
            ['GET', '/juicewrld/reports/', 'Editor+', 'List reports — filter: ?status=pending|resolved'],
            ['PATCH', '/juicewrld/reports/{id}/', 'Editor+', 'Set status/review_notes (records reviewer + time)'],
          ]}
        />
        <p className="text-xs text-text-muted font-semibold mt-3">Create:</p>
        <Pre>{`POST /juicewrld/reports/

{
  "song_id": 94086,     // or "public_id": 163 — one of the two, not both
  "message": "required — what's wrong",
  "contact": "optional"
}`}</Pre>
        <p className="text-xs text-text-muted">Throttled at <Code>10/min</Code>.</p>
        <p className="text-xs text-text-muted font-semibold mt-3">Report row (from the editor list):</p>
        <Pre>{`{
  "id": 31,
  "song": 94086,
  "song_name": "Maze",
  "message": "Issues: Wrong era\\n\\nSong: Maze\\n\\n— Unreleased v1.18.0",
  "contact": "someuser",
  "status": "pending",
  "review_notes": "",
  "reviewer_username": null,
  "created_at": "...",
  "reviewed_at": null
}`}</Pre>
        <p className="text-xs text-text-muted">
          Read the list defensively: it may come back as a bare array <span className="font-semibold text-text-primary">or</span> a
          DRF <Code>{'{ results: [...] }'}</Code> envelope, and the song id has been seen under{' '}
          <Code>song</Code>, <Code>song_id</Code>, and <Code>public_id</Code> depending on the serializer. Only{' '}
          <Code>status</Code>, <Code>review_notes</Code>, and the reviewer/timestamp fields are guaranteed.
        </p>
        <p className="text-xs text-text-muted">
          There&apos;s no structured category/issue field on submit — clients fold those into the{' '}
          <Code>message</Code> text, which is why the messages above look pre-formatted.
        </p>
        <p className="text-xs text-text-muted font-semibold mt-3">Review:</p>
        <Pre>{`PATCH /juicewrld/reports/{id}/
Authorization: Token <token>

{
  "status": "resolved",     // "pending" | "resolved"
  "review_notes": "optional"
}`}</Pre>
        <p className="text-xs text-text-muted">
          The server records the reviewer and review time itself — don&apos;t send those. Note there is no
          idempotency key on submit, so a client retrying a queued report can double-post.
        </p>
      </Section>

      <Section title="Beta App (installer gating)" defaultOpen={false}>
        <p className="text-sm text-text-secondary">
          Gates access to in-development desktop builds behind a beta code, separate from the public token/role
          system above — auth here is the <Code>X-Beta-Code</Code> header, not <Code>Authorization: Token</Code>.
        </p>
        <Table
          headers={['Method', 'Path', 'Auth', 'Description']}
          rows={[
            ['GET', '/beta/unlock?code=X', 'None', <>Check a code — returns <Code>{'{ "valid": true|false }'}</Code></>],
            ['GET', '/beta/versions', <Code>X-Beta-Code</Code>, 'List active beta builds (401 if the code is invalid)'],
            ['GET', '/beta/download?version=X', <Code>X-Beta-Code</Code>, 'Stream the installer for that build (401/404)'],
          ]}
        />
        <Pre>{`GET /beta/versions
X-Beta-Code: YOUR_CODE`}</Pre>
      </Section>

      <Section title="Admin: User Lookup" defaultOpen={false}>
        <Table
          headers={['Method', 'Path', 'Description']}
          rows={[
            ['GET', '/accounts/admin/users/', 'List all users. Filter: ?role=editor|contributor|administrator|applicant'],
            ['GET', '/accounts/admin/users/{user_id}/', 'Single user detail — role, is_active, Discord info, proposal counts, badges'],
            ['PATCH', '/accounts/admin/users/{user_id}/', 'Update role, is_active, auto_approve_proposals, or contributor flags'],
          ]}
        />
        <Pre>{`PATCH /accounts/admin/users/{user_id}/

{
  "role": "contributor",            // "editor" | "contributor" | "applicant"
  "is_active": true,
  "auto_approve_proposals": false,
  "contributor_enabled": true,
  "auto_approve_comp_proposals": false
}`}</Pre>
        <Table
          headers={['Field', 'Type', 'Meaning']}
          rows={[
            [<Code>contributor_enabled</Code>, 'boolean', 'Whether this user has comp-file proposal access, independent of role string'],
            [<Code>auto_approve_comp_proposals</Code>, 'boolean', "Skip manual review and apply this user's comp-file proposals automatically"],
            [<Code>comp_proposal_count</Code>, 'number', "Read-only — this user's total comp-file proposal submissions"],
            [<Code>comp_approved_count</Code>, 'number', 'Read-only — how many of those were approved'],
          ]}
        />
        <p className="text-xs text-text-muted">Requires admin token (<Code>is_administrator: true</Code>).</p>
      </Section>

      <Section title="Admin: Proposal Review" defaultOpen={false}>
        <Table
          headers={['Method', 'Path', 'Description']}
          rows={[
            ['GET', '/accounts/admin/proposals/', 'List all proposals. Filter: ?status=pending|approved|rejected|reversed'],
            ['POST', '/accounts/admin/proposals/{id}/review/', 'Approve, reject, or revise-and-approve a proposal'],
            ['POST', '/accounts/admin/proposals/{id}/reverse/', 'Reverse a previously approved proposal'],
          ]}
        />
        <Pre>{`POST /accounts/admin/proposals/{id}/review/

{
  "action": "approve",          // "approve" | "reject" | "revise"
  "review_notes": "optional",
  "revised_data": { }           // only for action: "revise" — overrides proposed_data
}`}</Pre>
      </Section>

      <Section title="Admin: Applications" defaultOpen={false}>
        <Table
          headers={['Method', 'Path', 'Description']}
          rows={[
            ['GET', '/accounts/admin/applications/', 'List editor applications. Filter: ?status=pending|approved|rejected'],
            ['POST', '/accounts/admin/applications/{id}/review/', 'Approve or reject an application'],
          ]}
        />
        <Pre>{`POST /accounts/admin/applications/{id}/review/

{
  "action": "approve",          // "approve" | "reject"
  "review_notes": "optional"
}`}</Pre>
        <p className="text-xs text-text-muted">
          Approving promotes the applicant to the role matching the application&apos;s{' '}
          <Code>application_type</Code> — <Code>editor</Code> or <Code>contributor</Code>.
        </p>
      </Section>

      <Section title="Comp File Proposals — Overview" defaultOpen={false}>
        <p className="text-sm text-text-secondary leading-relaxed">
          A second, separate proposal pipeline from song-data Edit Proposals above — this one is for changes to the{' '}
          <span className="font-semibold text-text-primary">compilation&apos;s files themselves</span> (uploading a
          new file, replacing one, moving/renaming, or deleting), submitted by contributors and reviewed by admins.
          Everything under <Code>/accounts/contributor/</Code> requires <Code>is_contributor</Code>; everything
          under <Code>/accounts/admin/comp-proposals/</Code> and <Code>/accounts/admin/comp-files/</Code> requires{' '}
          <Code>is_administrator</Code>.
        </p>
        <p className="text-xs text-text-muted mt-2">
          Backend note: none of this works until the server ships these routes plus the underlying{' '}
          <Code>listening_plays</Code> profile field and file staging/archive storage — the client codes against
          this contract ahead of the backend landing it.
        </p>
      </Section>

      <Section title="Contributor: Comp File Proposals" defaultOpen={false}>
        <Table
          headers={['Method', 'Path', 'Description']}
          rows={[
            ['GET', '/accounts/contributor/proposals/', "List the logged-in contributor's own comp-file proposals"],
            ['POST', '/accounts/contributor/proposals/', 'Submit a new comp-file proposal — multipart'],
            ['PATCH', '/accounts/contributor/proposals/{id}/', 'Edit a still-pending proposal — multipart'],
            ['DELETE', '/accounts/contributor/proposals/{id}/', 'Withdraw a proposal'],
          ]}
        />
        <p className="text-xs text-text-muted">
          The two write endpoints send <Code>multipart/form-data</Code>, not JSON — the request carries the actual
          file being uploaded/replaced alongside the metadata fields. Send{' '}
          <Code>Authorization: Token &lt;token&gt;</Code> and deliberately{' '}
          <span className="font-semibold text-text-primary">omit</span> <Code>Content-Type</Code> so the browser
          sets the multipart boundary itself — setting it manually breaks the boundary and the server can&apos;t
          parse the body.
        </p>
        <Pre>{`POST /accounts/contributor/proposals/
Authorization: Token <token>
Content-Type: multipart/form-data; boundary=... (set automatically — do not set this header yourself)

FormData:
  change_type       "upload" | "replace" | "move" | "delete"
  file_path         "Compilation/Unreleased/Song.mp3"     // target path in the compilation
  destination_path  "Compilation/Unreleased/New Name.mp3" // only for "move"
  contributor_notes "optional"
  file              <binary>                              // only for "upload"/"replace"`}</Pre>
        <p className="text-xs text-text-muted font-semibold mt-3">Comp file proposal object shape:</p>
        <Pre>{`{
  "id": 55,
  "contributor_username": "someuser",
  "contributor_id": 12,
  "file_path": "Compilation/Unreleased/Song.mp3",
  "destination_path": null,
  "change_type": "replace",
  "staging_filename": "staged-a1b2c3.mp3",
  "original_snapshot": { /* file metadata before this change */ },
  "contributor_notes": "Higher quality rip",
  "status": "pending",
  "reviewer_username": null,
  "review_notes": "",
  "applied_commit_id": null,
  "edit_count": 0,
  "created_at": "...",
  "reviewed_at": null
}`}</Pre>
        <p className="text-xs text-text-muted">
          <Code>status</Code> is <Code>pending</Code>, <Code>approved</Code>, <Code>rejected</Code>, or{' '}
          <Code>reversed</Code>. <Code>staging_filename</Code> points at the uploaded file sitting in staging until
          an admin approves it; <Code>applied_commit_id</Code> is set once approval actually lands the change.
        </p>
      </Section>

      <Section title="Admin: Comp File Proposal Review" defaultOpen={false}>
        <Table
          headers={['Method', 'Path', 'Description']}
          rows={[
            ['GET', '/accounts/admin/comp-proposals/', 'List all comp-file proposals. Filter: ?status=pending|approved|rejected|reversed'],
            ['POST', '/accounts/admin/comp-proposals/{id}/review/', 'Approve or reject a proposal'],
            ['POST', '/accounts/admin/comp-proposals/{id}/reverse/', 'Reverse a previously approved proposal'],
            ['GET', '/accounts/admin/comp-proposals/{id}/staging/', 'Download the staged file to inspect before approving'],
          ]}
        />
        <Pre>{`POST /accounts/admin/comp-proposals/{id}/review/

{
  "action": "approve",          // "approve" | "reject"
  "review_notes": "optional"
}`}</Pre>
        <p className="text-xs text-text-muted">
          Unlike song-data proposals, there is no <Code>&quot;revise&quot;</Code> action here — a comp-file change
          is either accepted as staged or rejected, since there&apos;s no meaningful way to hand-edit a binary file
          upload.
        </p>
        <p className="text-xs text-text-muted">
          <Code>/staging/</Code> streams the actual staged file (not JSON) — treat it as a download/preview link,
          the same way <Code>/files/download/</Code> is used for library audio.
        </p>
      </Section>

      <Section title="Admin: Comp File History" defaultOpen={false}>
        <Table
          headers={['Method', 'Path', 'Description']}
          rows={[
            ['GET', '/accounts/admin/comp-files/{filepath}/history/', 'Every revision applied to a given compilation file path'],
          ]}
        />
        <Pre>{`{
  "filepath": "Compilation/Unreleased/Song.mp3",
  "revisions": [
    {
      "id": 9,
      "filepath": "Compilation/Unreleased/Song.mp3",
      "hash": "d199a85e510b32b9ef3c02a29044a41d",
      "size": 7381244,
      "archive_path": "archive/Compilation/Unreleased/Song.mp3.v9",
      "proposal_id": 55,
      "commit_id": "c_9f2a",
      "is_current": true,
      "created_at": "..."
    }
  ]
}`}</Pre>
        <p className="text-xs text-text-muted">
          Exactly one revision per file has <Code>is_current: true</Code>. Older revisions stay addressable via{' '}
          <Code>archive_path</Code> for rollback/audit, even after a newer one supersedes them.
        </p>
      </Section>

      <Section title="Two-Factor (OTP)" defaultOpen={false}>
        <Table
          headers={['Method', 'Path', 'Description']}
          rows={[
            ['GET', '/accounts/otp/setup/', 'Generate a new OTP secret + QR code for enrolling'],
            ['POST', '/accounts/otp/setup/', 'Confirm enrollment with a code from the authenticator app'],
          ]}
        />
        <Pre>{`// GET response
{
  "otp_enabled": false,
  "account_label": "someuser",
  "otp_secret": "JBSWY3DPEHPK3PXP",
  "provisioning_uri": "otpauth://totp/...",
  "qr_code": "data:image/png;base64,..."
}

// POST request
{ "otp_token": "123456" }
// Response: { "otp_enabled": true }`}</Pre>
      </Section>
    </div>
  )
}

function VersionsTab() {
  return (
    <div className="space-y-6">
      <Section title="What is the Versions API?">
        <p className="text-sm text-text-secondary leading-relaxed">
          Groups multiple song rows together as versions of the same underlying track — e.g. a released mix and a
          leaked earlier take, or several titled variants like &quot;v1&quot;, &quot;v2&quot;, &quot;TV Mix&quot;.
          Each row links one <Code>song_id</Code> to a shared <Code>group_id</Code>; every song in a group shares
          the same <Code>title</Code> (the display name for the group, e.g. &quot;She&apos;s The One&quot;), while
          each song keeps its own <Code>version</Code> label (e.g. &quot;v1&quot;) distinguishing it from its
          groupmates.
        </p>
        <p className="text-sm text-text-secondary leading-relaxed mt-2">
          Reads require no auth. Writes (<Code>POST</Code>/<Code>PATCH</Code>) require an editor or admin token.
        </p>
      </Section>

      <Section title="Version Row Shape">
        <Pre>{`{
  "id": 501,
  "song_id": 94086,
  "group_id": 94086,
  "version": "v1",
  "title": "She's The One",
  "created_at": "2026-03-04T12:00:00Z",
  "created_by": "freakypallet"
}`}</Pre>
        <p className="text-xs text-text-muted">
          <Code>group_id</Code> is just the <Code>song_id</Code> of whichever song originally anchored the group — it
          has no meaning beyond being a shared key. <Code>title</Code> is <Code>null</Code> until an editor names the
          group; <Code>version</Code> is <Code>null</Code> until an editor labels that specific song.
        </p>
      </Section>

      <Section title="GET /versions/{song_id}/ — This Song's Row">
        <p className="text-sm text-text-secondary">
          The one filtered read the API supports server-side. Returns the paginated envelope with 0 or 1 result —
          empty means the song isn&apos;t linked into any group.
        </p>
        <Pre>{`{
  "count": 1,
  "next": null,
  "previous": null,
  "results": [ { "id": 501, "song_id": 94086, "group_id": 94086, "version": "v1", "title": "She's The One", ... } ]
}`}</Pre>
      </Section>

      <Section title="GET /versions/ — All Rows">
        <p className="text-sm text-text-secondary">
          The list endpoint does <span className="font-semibold text-text-primary">not</span> apply query params
          (<Code>group_id</Code>, <Code>search</Code>, <Code>title</Code>) server-side — any filtering by group or
          title has to happen client-side. Pass <Code>?all=true</Code> to get every row in one response instead of
          paging through it (same bulk-mode convention <Code>/songs/</Code> supports).
        </p>
        <Pre>{`GET /versions/?all=true

// Response: a plain array (not the paginated envelope)
[
  { "id": 501, "song_id": 94086, "group_id": 94086, "version": "v1",   "title": "She's The One", ... },
  { "id": 502, "song_id": 94112, "group_id": 94086, "version": "v2",   "title": "She's The One", ... },
  { "id": 503, "song_id": 95230, "group_id": 95230, "version": null,   "title": null, ... }
]`}</Pre>
      </Section>

      <Section title="POST /versions/ — Create a Row (editor+)">
        <Pre>{`POST /versions/
Authorization: Token <token>
Content-Type: application/json

{
  "song_id": 94112,
  "group_id": 94086,
  "version": "v2",
  "title": "She's The One"
}`}</Pre>
        <p className="text-xs text-text-muted">
          Used both to link a previously-ungrouped song into an existing group and to seed a brand-new group
          (pass a <Code>group_id</Code> no other row uses yet — the app conventionally uses one of the two
          songs&apos; own <Code>song_id</Code>).
        </p>
      </Section>

      <Section title="PATCH /versions/{song_id}/ — Update a Row (editor+)">
        <Pre>{`PATCH /versions/{song_id}/
Authorization: Token <token>
Content-Type: application/json

{ "group_id": 94086, "title": "She's The One" }`}</Pre>
        <p className="text-xs text-text-muted">
          Any subset of <Code>group_id</Code>, <Code>version</Code>, <Code>title</Code> may be sent. There is no
          bulk-write endpoint — merging two groups or renaming a group&apos;s title means sending one
          <Code> PATCH</Code> per affected song.
        </p>
      </Section>

      <Section title="Common Operations (client-side recipes)">
        <ul className="space-y-3 text-sm text-text-secondary">
          <li>
            <span className="font-semibold text-text-primary">Link two ungrouped songs:</span> create two rows
            sharing a new <Code>group_id</Code> (e.g. the lower of the two song IDs).
          </li>
          <li>
            <span className="font-semibold text-text-primary">Add an ungrouped song to an existing group:</span>{' '}
            <Code>POST</Code> one row with that group&apos;s <Code>group_id</Code> and <Code>title</Code>.
          </li>
          <li>
            <span className="font-semibold text-text-primary">Merge two existing groups:</span> fetch every row in
            both groups (via <Code>?all=true</Code>), then <Code>PATCH</Code> every row in the losing group to the
            surviving <Code>group_id</Code> — and if only one side had a <Code>title</Code> set, <Code>PATCH</Code>{' '}
            that title onto every row in the merged group so all members agree.
          </li>
          <li>
            <span className="font-semibold text-text-primary">Rename a group&apos;s title:</span> <Code>PATCH</Code>{' '}
            <Code>{'{ title }'}</Code> onto every row whose <Code>group_id</Code> matches.
          </li>
        </ul>
      </Section>
    </div>
  )
}

function FetchPatternTab() {
  return (
    <div className="space-y-6">
      <Section title="Fetch Utility">
        <p className="text-sm text-text-secondary">Always use a utility function — never fetch inline in components.</p>
        <Pre>{`// lib/juicewrld.ts
const BASE = 'https://juicewrldapi.com/juicewrld'

export async function apiFetch(
  path: string,
  params: Record<string, string | number | undefined> = {},
  opts: { method?: string; token?: string; body?: unknown } = {}
) {
  const url = new URL(BASE + path)
  Object.entries(params).forEach(([k, v]) => {
    if (v != null) url.searchParams.set(k, String(v))
  })
  const headers: Record<string, string> = {}
  if (opts.token) headers['Authorization'] = \`Token \${opts.token}\`
  if (opts.body)  headers['Content-Type'] = 'application/json'
  const res = await fetch(url, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  if (!res.ok) throw new Error(\`API error \${res.status}\`)
  return res.json()
}`}</Pre>
      </Section>

      <Section title="React Hook Pattern">
        <Pre>{`// hooks/useSongs.ts
import { useState, useEffect } from 'react'
import { apiFetch } from '../lib/juicewrld'

export function useSongs({
  category, era, search, searchall, lyrics,
  page = 1, page_size = 20
} = {}) {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    setLoading(true)
    apiFetch('/songs/', { category, era, search, searchall, lyrics, page, page_size })
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false))
  }, [category, era, search, searchall, lyrics, page, page_size])

  return { songs: data?.results ?? [], count: data?.count ?? 0, loading, error }
}`}</Pre>
      </Section>

      <Section title="Audio Streaming">
        <Pre>{`// Simple — browser handles range/seeking automatically
<audio
  controls
  src={\`https://juicewrldapi.com/juicewrld/files/download/?path=\${encodeURIComponent(song.path)}\`}
/>

// Tier check before rendering play button
{song.path && (
  <button onClick={() => playSong(song)}>▶</button>
)}`}</Pre>
      </Section>

      <Section title="Tips">
        <ul className="space-y-2 text-sm text-text-secondary">
          <li className="flex items-start gap-2"><span className="text-accent mt-0.5">•</span> Use <Code>song.path</Code> directly as the stream path — it's already in the right format.</li>
          <li className="flex items-start gap-2"><span className="text-accent mt-0.5">•</span> The browser <Code>{'<audio>'}</Code> element handles Range requests automatically — just set <Code>src</Code>.</li>
          <li className="flex items-start gap-2"><span className="text-accent mt-0.5">•</span> Debounce search inputs 300–500 ms to avoid hammering the API.</li>
          <li className="flex items-start gap-2"><span className="text-accent mt-0.5">•</span> <Code>track_titles</Code> is an array — a song may have multiple alternative titles. Show the first or let users pick.</li>
          <li className="flex items-start gap-2"><span className="text-accent mt-0.5">•</span> Not all songs have a <Code>path</Code> (some are metadata-only). Check before rendering a play button.</li>
          <li className="flex items-start gap-2"><span className="text-accent mt-0.5">•</span> <Code>image_url</Code> is relative — prepend <Code>https://juicewrldapi.com</Code>.</li>
          <li className="flex items-start gap-2"><span className="text-accent mt-0.5">•</span> Use <Code>/radio/random/</Code> for a shuffle/discover feature — it already returns a playable file.</li>
          <li className="flex items-start gap-2"><span className="text-accent mt-0.5">•</span> Check <Code>/account/me/</Code> first to know the role — don't probe restricted endpoints and handle 403s.</li>
        </ul>
      </Section>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────


// ─── 999 FM Tab ───────────────────────────────────────────────────────────────

function RadioTab() {
  return (
    <div className="space-y-6">
      <Section title="What is 999 FM?">
        <p className="text-sm text-text-secondary leading-relaxed">
          999 FM is the Juice WRLD API radio — a single endpoint that returns a random, fully playable song
          on every request. Named after Juice WRLD&apos;s 999 brand, it&apos;s designed for discover or continuous
          playback features: call it, stream the song, call it again for the next one.
        </p>
        <p className="text-sm text-text-secondary leading-relaxed mt-2">
          No authentication required. Returns a full song object plus the direct stream path.
        </p>
      </Section>

      <Section title="GET /radio/random/">
        <p className="text-sm text-text-secondary">Pick a random song from the full catalogue and return its stream path and metadata.</p>
        <Pre>{`GET https://juicewrldapi.com/juicewrld/radio/random/`}</Pre>
        <p className="text-xs text-text-muted mt-2">No parameters required. Every call returns a different song.</p>
        <div className="mt-4">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Response</p>
          <Pre>{`{
  "id":       "Compilation/2. Unreleased Discography/8. WOD (Sessions)/Maze.mp3",
  "title":    "Maze",
  "path":     "Compilation/2. Unreleased Discography/8. WOD (Sessions)/Maze.mp3",
  "size":     7381244,
  "modified": "2025-10-18T19:19:53.784271",
  "hash":     "d199a85e510b32b9ef3c02a29044a41d",
  "song": {
    "id": 95001,
    "public_id": 2232,
    "name": "Maze",
    "category": "unreleased",
    "era": { "id": 109, "name": "WOD", "description": "WRLD On Drugs era" },
    "path": "Compilation/2. Unreleased Discography/8. WOD (Sessions)/Maze.mp3",
    "credited_artists": "Juice WRLD",
    "length": "2:24",
    "lyrics": "...",
    "synced_lyrics": "...",
    "image_url": "/assets/wod.jpg"
    // ... all standard song fields
  }
}`}</Pre>
        </div>
        <Table
          headers={['Field', 'Type', 'Description']}
          rows={[
            [<Code>id</Code>, 'string', 'Internal file path (same as path)'],
            [<Code>title</Code>, 'string', 'Song title'],
            [<Code>path</Code>, 'string', 'Stream path — pass to /files/download/?path='],
            [<Code>size</Code>, 'number', 'File size in bytes'],
            [<Code>modified</Code>, 'string', 'ISO 8601 last-modified timestamp'],
            [<Code>hash</Code>, 'string', 'MD5 file hash (use for deduplication or cache-busting)'],
            [<Code>song</Code>, 'object', 'Full song object — same shape as GET /songs/{id}/'],
          ]}
        />
      </Section>

      <Section title="Streaming the result">
        <p className="text-sm text-text-secondary">
          The <Code>path</Code> field maps directly to the <Code>/files/download/</Code> endpoint. Pass it as the
          stream URL for your audio element.
        </p>
        <Pre>{`const BASE = 'https://juicewrldapi.com/juicewrld';

async function getRadioSong() {
  const res = await fetch(\`\${BASE}/radio/random/\`);
  const data = await res.json();
  return {
    title:        data.title,
    streamUrl:    \`\${BASE}/files/download/?path=\${encodeURIComponent(data.path)}\`,
    coverUrl:     \`https://juicewrldapi.com\${data.song.image_url}\`,
    artist:       data.song.credited_artists,
    era:          data.song.era?.name,
    lyrics:       data.song.lyrics || null,
    syncedLyrics: data.song.synced_lyrics || null,
  };
}

// Basic usage
const track = await getRadioSong();
audioElement.src = track.streamUrl;
audioElement.play();`}</Pre>
      </Section>

      <Section title="React hook — useRadio">
        <Pre>{`import { useState, useCallback } from 'react';

const BASE = 'https://juicewrldapi.com/juicewrld';

export function useRadio() {
  const [track, setTrack] = useState(null);
  const [loading, setLoading] = useState(false);

  const next = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(\`\${BASE}/radio/random/\`);
      const data = await res.json();
      setTrack({
        title:        data.title,
        streamUrl:    \`\${BASE}/files/download/?path=\${encodeURIComponent(data.path)}\`,
        coverUrl:     \`https://juicewrldapi.com\${data.song.image_url}\`,
        artist:       data.song.credited_artists,
        era:          data.song.era?.name,
        length:       data.song.length,
        lyrics:       data.song.lyrics || null,
        syncedLyrics: data.song.synced_lyrics || null,
        song:         data.song,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  return { track, loading, next };
}

// In your component:
function RadioPlayer() {
  const { track, loading, next } = useRadio();

  return (
    <div>
      {track ? (
        <>
          <img src={track.coverUrl} alt={track.title} />
          <p>{track.title} — {track.artist}</p>
          <audio
            src={track.streamUrl}
            autoPlay
            onEnded={next}
          />
        </>
      ) : (
        <button onClick={next} disabled={loading}>
          {loading ? 'Loading...' : 'Start 999 FM'}
        </button>
      )}
      <button onClick={next} disabled={loading}>Next</button>
    </div>
  );
}`}</Pre>
      </Section>

      <Section title="Live Radio — one shared broadcast">
        <p className="text-sm text-text-secondary leading-relaxed">
          Separate from <Code>/radio/random/</Code> above. That endpoint hands each client its own random song;
          this is a single <span className="font-semibold text-text-primary">shared station</span> — every listener
          hears the same audio at the same time, with listener counts and community skip/queue votes. No auth required.
        </p>
        <Table
          headers={['Transport', 'Endpoint', 'Purpose']}
          rows={[
            ['REST', 'GET /radio/live/', 'One-shot snapshot of station state — now playing, up next, vote, listener counts'],
            ['WebSocket', '/ws/radio/', 'Live metadata pushes, vote participation, and (optionally) the audio itself'],
            ['HTTP', 'GET /radio/stream.mp3', 'Plain MP3 stream — the fallback when MediaSource is unavailable'],
          ]}
        />
        <p className="text-xs text-text-muted">
          The websocket URL is the API base with its scheme swapped to <Code>ws</Code>/<Code>wss</Code> and{' '}
          <Code>/ws/radio/</Code> appended — e.g. <Code>wss://juicewrldapi.com/juicewrld/ws/radio/</Code>.
        </p>
      </Section>

      <Section title="GET /radio/live/ — Station State">
        <Pre>{`{
  "is_live": true,
  "station": "999 FM",
  "state": "playing",
  "stream_url": "https://juicewrldapi.com/juicewrld/radio/stream.mp3",
  "now_playing": {
    "title": "Maze",
    "artist": "Juice WRLD",
    "album": "...",
    "display": "Juice WRLD — Maze",
    "elapsed_ms": 41000,
    "duration_ms": 144000,
    "image_url": "/assets/wod.jpg",
    "song_id": 95001
  },
  "up_next": { /* same shape, or null */ },
  "queue_preview": ["Song A", "Song B"],
  "dj_enabled": true,
  "dj_line": "Coming up next…",
  "vote": {
    "active": true,
    "kind": "skip",           // "skip" | "queue"
    "yes": 3,
    "no": 1,
    "votes_needed": 5,
    "total_listeners": 12,
    "seconds_left": 20,
    "track": "Maze"
  },
  "web_listeners": 8,
  "discord_listeners": 4,
  "total_listeners": 12,
  "stale_seconds": null
}`}</Pre>
        <p className="text-xs text-text-muted">
          <Code>song_id</Code> on a track is the numeric API song id, so a live track can be looked up via{' '}
          <Code>{'/songs/{id}/'}</Code> for full metadata, lyrics, or cover art. <Code>image_url</Code> is
          relative — prepend <Code>https://juicewrldapi.com</Code>. <Code>vote.active: false</Code> means no vote
          is running and the other vote fields may be absent.
        </p>
      </Section>

      <Section title="WebSocket /ws/radio/">
        <p className="text-sm text-text-secondary">
          The socket carries <span className="font-semibold text-text-primary">both</span> metadata and audio:
          text frames are JSON station-state objects (same shape as <Code>/radio/live/</Code>), binary frames are
          MP3 chunks. Set <Code>binaryType = &apos;arraybuffer&apos;</Code> and branch on the frame type.
        </p>
        <Pre>{`const ws = new WebSocket('wss://juicewrldapi.com/juicewrld/ws/radio/')
ws.binaryType = 'arraybuffer'

ws.onmessage = (e) => {
  if (typeof e.data === 'string') {
    const state = JSON.parse(e.data)   // RadioLiveState — update the UI
  } else {
    // MP3 chunk — feed to a MediaSource SourceBuffer('audio/mpeg')
  }
}`}</Pre>
        <p className="text-xs text-text-muted font-semibold mt-3">Client → server messages:</p>
        <Table
          headers={['Message', 'Purpose']}
          rows={[
            [<Code>{'{ type: "listening", value, audio }'}</Code>, <>Join/leave the listener count. <Code>audio</Code> is <Code>&quot;ws&quot;</Code> or <Code>&quot;http&quot;</Code> depending on which stream you&apos;re consuming. Re-send on reconnect if still listening.</>],
            [<Code>{'{ type: "propose_skip" }'}</Code>, 'Start a vote to skip the current track'],
            [<Code>{'{ type: "propose_queue", song_id }'}</Code>, <>Start a vote to queue a song. <Code>song_id</Code> must be the <span className="font-semibold text-text-primary">number</span> — a stringified id is silently ignored and the vote never starts.</>],
            [<Code>{'{ type: "vote", value }'}</Code>, <><Code>&quot;yes&quot;</Code> or <Code>&quot;no&quot;</Code> on the active vote</>],
          ]}
        />
        <p className="text-xs text-text-muted font-semibold mt-3">Playback notes:</p>
        <ul className="space-y-2 text-sm text-text-secondary">
          <li className="flex items-start gap-2"><span className="text-accent mt-0.5">•</span> Binary frames only make sense with MediaSource (<Code>audio/mpeg</Code>). Where it&apos;s unsupported, ignore them and point an <Code>{'<audio>'}</Code> element at <Code>/radio/stream.mp3</Code> instead — tell the server which you chose via the <Code>audio</Code> field.</li>
          <li className="flex items-start gap-2"><span className="text-accent mt-0.5">•</span> Because it&apos;s a live stream, buffered audio drifts behind. Seek forward when you fall more than a few seconds behind the buffered end, and evict old buffered ranges or the SourceBuffer eventually throws <Code>QuotaExceededError</Code>.</li>
          <li className="flex items-start gap-2"><span className="text-accent mt-0.5">•</span> Reconnect on close — background tabs get their socket closed and audio paused silently, with no event fired, so a periodic health check is worth having.</li>
        </ul>
      </Section>

      <Section title="Notes">
        <ul className="space-y-2 text-sm text-text-secondary">
          <li className="flex items-start gap-2"><span className="text-accent mt-0.5">•</span> Calls are not seeded — every request is independent. Repeats are possible but rare given the 2,452-song catalogue.</li>
          <li className="flex items-start gap-2"><span className="text-accent mt-0.5">•</span> The <Code>song</Code> object is identical to <Code>{`/songs/{id}/`}</Code> — full producers, engineers, lyrics, synced lyrics, and groupbuy info included.</li>
          <li className="flex items-start gap-2"><span className="text-accent mt-0.5">•</span> <Code>image_url</Code> is a relative path (e.g. <Code>/assets/wod.jpg</Code>) — prepend <Code>https://juicewrldapi.com</Code> for use in <Code>&lt;img&gt;</Code> tags.</li>
          <li className="flex items-start gap-2"><span className="text-accent mt-0.5">•</span> The stream endpoint supports HTTP Range requests — the browser <Code>&lt;audio&gt;</Code> element handles seeking automatically.</li>
          <li className="flex items-start gap-2"><span className="text-accent mt-0.5">•</span> No rate limiting on public endpoints, but call once per track end — not on a tight loop.</li>
        </ul>
      </Section>
    </div>
  )
}

const TABS = [
  { id: 'overview',  label: 'Overview' },
  { id: 'songs',     label: 'Songs & Search' },
  { id: 'versions',  label: 'Versions' },
  { id: 'files',     label: 'Files & Stream' },
  { id: 'playlists', label: 'Playlists' },
  { id: 'radio',     label: '999 FM' },
  { id: 'auth',      label: 'Auth & Accounts' },
  { id: 'patterns',  label: 'Code Patterns' },
] as const

type TabId = typeof TABS[number]['id']

const TAB_CONTENT: Record<TabId, () => JSX.Element> = {
  overview:  OverviewTab,
  songs:     SongsTab,
  versions:  VersionsTab,
  files:     FilesTab,
  playlists: PlaylistsTab,
  radio:     RadioTab,
  auth:      AuthTab,
  patterns:  FetchPatternTab,
}

// One tab's worth of content. Kept mounted even when hidden so its Sections
// stay registered with the search index — `hidden` (not unmounting) is what
// makes cross-tab search possible without duplicating the content as data.
function TabPanel({ tab, query, register, visible, showLabel }: {
  tab: typeof TABS[number]
  query: string
  register: DocsSearchValue['register']
  visible: boolean
  showLabel: boolean
}): JSX.Element {
  const ctx = useMemo(() => ({ query, tab: tab.id, register }), [query, tab.id, register])
  const Content = TAB_CONTENT[tab.id]
  return (
    <div hidden={!visible}>
      <DocsSearchContext.Provider value={ctx}>
        {showLabel && (
          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-3 mt-2">{tab.label}</p>
        )}
        <Content />
      </DocsSearchContext.Provider>
    </div>
  )
}

export default function DocsPage(): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [rawQuery, setRawQuery] = useState('')
  const { setActiveView, previousView } = useStorePick('setActiveView', 'previousView')

  // Sections self-report their text on mount. The registry is a ref (identity
  // must stay stable so `register` doesn't retrigger every Section's effect);
  // the counter bumps state so match counts recompute once entries land.
  const registry = useRef(new Map<string, { tab: string; title: string; text: string }>())
  const [indexVersion, bumpIndex] = useReducer((n: number) => n + 1, 0)
  const register = useCallback((id: string, tab: string, title: string, text: string) => {
    const prev = registry.current.get(id)
    if (prev && prev.text === text && prev.title === title) return
    registry.current.set(id, { tab, title, text })
    bumpIndex()
  }, [])

  const query = rawQuery.trim().toLowerCase()

  const hitsByTab = useMemo(() => {
    const counts = new Map<string, number>()
    if (!query) return counts
    for (const e of registry.current.values()) {
      if (e.title.toLowerCase().includes(query) || e.text.includes(query)) {
        counts.set(e.tab, (counts.get(e.tab) ?? 0) + 1)
      }
    }
    return counts
    // indexVersion is the signal that registry.current changed — it has no
    // other use here, hence the explicit reference.
  }, [query, indexVersion])

  const totalHits = useMemo(
    () => [...hitsByTab.values()].reduce((a, b) => a + b, 0),
    [hitsByTab]
  )

  // Wherever this was opened from (Settings, most likely) is where "back"
  // should return to — matching the app's other pushed pages (EditorPage,
  // LocalEditorPage) rather than a hardcoded destination.
  const backView = previousView && previousView !== 'docs' ? previousView : 'wrld'

  return (
    <div className="flex-1 flex flex-col min-h-0 min-w-0">
      {/* App bar — same shape as the other pushed pages' */}
      <div className="shrink-0 flex items-center gap-1 px-2">
        <button
          onClick={() => setActiveView(backView)}
          aria-label="Back"
          className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full text-text-primary active:bg-surface-overlay"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1 min-w-0 px-0.5">
          <h1 className="text-text-primary text-[20px] font-bold leading-tight truncate">API Docs</h1>
          <p className="text-text-muted text-xs font-mono truncate">juicewrldapi.com</p>
        </div>
        <a
          href="https://juicewrldapi.com/api-docs"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open live docs"
          className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full text-text-muted active:bg-surface-overlay"
        >
          <ExternalLink size={18} />
        </a>
      </div>

      <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-contain px-4 pt-1 pb-6">
        {/* Search */}
        <div className="relative mb-3">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
          <input
            value={rawQuery}
            onChange={(e) => setRawQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') setRawQuery('') }}
            placeholder="Search endpoints, fields, params…"
            className="w-full bg-[var(--surface-overlay)] rounded-xl pl-10 pr-16 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none transition-colors"
          />
          {rawQuery && (
            <>
              <span className="absolute right-10 top-1/2 -translate-y-1/2 text-[10px] text-text-muted tabular-nums">
                {totalHits}
              </span>
              <button
                onClick={() => setRawQuery('')}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full text-text-muted active:bg-surface-raised transition-colors"
              >
                <X size={14} />
              </button>
            </>
          )}
        </div>

        {/* Tabs — a horizontally scrollable chip row rather than an
            underline tab bar (underlines read as desktop chrome and give no
            touch feedback of their own). */}
        <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 scrollbar-none">
          {TABS.map(tab => {
            const hits = hitsByTab.get(tab.id) ?? 0
            const dimmed = !!query && hits === 0
            const active = !query && activeTab === tab.id
            return (
              <button
                key={tab.id}
                // Tapping a tab while searching is a "take me there" action —
                // clear the query so the tab shows in full.
                onClick={() => { setActiveTab(tab.id); setRawQuery('') }}
                className={`shrink-0 flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[13px] font-medium transition-colors ${
                  active ? 'bg-accent text-white'
                    : dimmed ? 'bg-[var(--surface-overlay)] text-text-muted/40'
                    : 'bg-[var(--surface-overlay)] text-text-secondary active:bg-[var(--surface-raised)]'
                }`}
              >
                {tab.label}
                {!!query && hits > 0 && (
                  <span className="text-[10px] tabular-nums bg-black/15 rounded px-1 py-0.5">{hits}</span>
                )}
              </button>
            )
          })}
        </div>

        <div className="space-y-3">
          {query && totalHits === 0 && (
            <div className="text-center py-16">
              <Search size={28} className="mx-auto text-text-muted mb-3 opacity-40" />
              <p className="text-sm text-text-secondary">No matches for &ldquo;{rawQuery.trim()}&rdquo;</p>
              <p className="text-xs text-text-muted mt-1">Try an endpoint path, a field name, or a parameter.</p>
            </div>
          )}
          {TABS.map(tab => (
            <TabPanel
              key={tab.id}
              tab={tab}
              query={query}
              register={register}
              visible={query ? (hitsByTab.get(tab.id) ?? 0) > 0 : activeTab === tab.id}
              showLabel={!!query}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
