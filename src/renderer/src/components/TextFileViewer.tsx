import { useEffect, useState, useMemo } from 'react'
import { X, Download, Loader2, AlertCircle, Check, Clipboard, WrapText } from 'lucide-react'
import { useBackToClose } from '../hooks/useBackToClose'

// In-app viewer for plain-text files in the Files tab — the Android
// counterpart to desktop's TextFileViewer. Desktop also feeds this from a
// local-disk source (read in the main process); Android only ever has API
// files (there's no local filesystem browsing here, just the SAF-scanned
// music library, which doesn't go through the Files tab), so the caller only
// ever builds `source.load` around a fetch of the stream URL.

export interface TextFileSource {
  name: string
  /** Resolves the file's text, or throws with a message worth showing. */
  load: () => Promise<{ text: string; truncated?: boolean }>
  onDownload?: () => void
}

interface Props {
  source: TextFileSource
  onClose: () => void
}

export default function TextFileViewer({ source, onClose }: Props): JSX.Element {
  useBackToClose(onClose)
  const [text, setText] = useState<string | null>(null)
  const [truncated, setTruncated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [wrap, setWrap] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    setText(null)
    setError(null)
    setTruncated(false)
    source.load()
      .then((res) => {
        if (cancelled) return
        setText(res.text)
        setTruncated(!!res.truncated)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to read file')
      })
    return () => { cancelled = true }
  // The caller rebuilds `source` each render, so key off the file name rather
  // than the object identity — otherwise this refetches on every parent render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.name])

  const lineCount = useMemo(() => (text ? text.split('\n').length : 0), [text])

  const copyAll = (): void => {
    if (text == null) return
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/95" onClick={onClose}>
      {/* Top bar — same treatment as MediaLightbox's: a fixed overlay sits
          outside the app shell's own status-bar inset, so it has to pad for
          one itself. */}
      <div
        className="flex items-center gap-2 px-4 py-3 shrink-0 bg-black/60 backdrop-blur-sm"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold truncate">{source.name}</p>
          {text != null && (
            <p className="text-white/50 text-[11px]">
              {lineCount.toLocaleString()} {lineCount === 1 ? 'line' : 'lines'}
              {truncated && ' · showing the first 2 MB'}
            </p>
          )}
        </div>
        <button
          onClick={() => setWrap((w) => !w)}
          className={`p-2 rounded-full transition-colors ${wrap ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
          title={wrap ? 'Disable word wrap' : 'Enable word wrap'}
        ><WrapText size={17} /></button>
        <button
          onClick={copyAll}
          disabled={text == null}
          className="p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-40 transition-colors"
          title="Copy all"
        >{copied ? <Check size={17} className="text-accent" /> : <Clipboard size={17} />}</button>
        {source.onDownload && (
          <button
            onClick={source.onDownload}
            className="p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            title="Download"
          ><Download size={17} /></button>
        )}
        <button
          onClick={onClose}
          className="p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          title="Close"
        ><X size={17} /></button>
      </div>

      {/* Body */}
      <div
        className="flex-1 min-h-0 overflow-auto"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {error ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 px-6 text-center">
            <AlertCircle size={28} className="text-white/40" />
            <p className="text-white/60 text-sm">{error}</p>
          </div>
        ) : text == null ? (
          <div className="flex items-center justify-center gap-2 py-16 text-white/60">
            <Loader2 size={18} className="animate-spin" /><span className="text-sm">Loading…</span>
          </div>
        ) : text.length === 0 ? (
          <p className="py-16 text-center text-white/60 text-sm">This file is empty.</p>
        ) : (
          <pre
            className={`px-4 py-3 text-xs leading-relaxed text-white/80 font-mono ${
              wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'
            }`}
          >{text}</pre>
        )}
      </div>
    </div>
  )
}
