import { useState } from 'react'
import { X, Loader2, AlertCircle, Heart, ListMusic } from 'lucide-react'
import { useStore, useStorePick } from '../store/useStore'

interface Props {
  onClose: () => void
}

export default function UserAuthModal({ onClose }: Props): JSX.Element {
  const { loginWithDiscord } = useStorePick('loginWithDiscord')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = async (): Promise<void> => {
    setError(null)
    setLoading(true)
    try {
      await loginWithDiscord()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start Discord login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.currentTarget === e.target) onClose() }}
    >
      {/* Bottom sheet on a phone, centered dialog from md up. */}
      <div
        className="bg-surface border border-[var(--border)] rounded-t-2xl md:rounded-2xl shadow-2xl w-full md:max-w-sm md:mx-4 overflow-hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-text-primary text-sm font-semibold">Log in</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          <p className="text-sm text-text-muted leading-relaxed">
            Log in with Discord to save favorite tracks and playlists that follow you on every device.
          </p>

          <div className="space-y-2">
            <div className="flex items-center gap-2.5 text-xs text-text-secondary">
              <Heart size={14} className="text-accent shrink-0" /> Liked songs synced to your account
            </div>
            <div className="flex items-center gap-2.5 text-xs text-text-secondary">
              <ListMusic size={14} className="text-accent shrink-0" /> Playlists available everywhere you log in
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <button
            onClick={start}
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-[#5865F2] hover:bg-[#4752c4] text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20.317 4.369A19.79 19.79 0 0 0 16.558 3c-.2.36-.43.84-.59 1.23a18.27 18.27 0 0 0-3.94 0A8.26 8.26 0 0 0 11.43 3a19.74 19.74 0 0 0-3.76 1.37C3.39 8.6 2.71 12.72 3.04 16.78a19.9 19.9 0 0 0 5.99 3.04c.48-.66.91-1.36 1.28-2.1-.7-.26-1.37-.59-2-.98.17-.12.33-.25.49-.38 3.86 1.8 8.03 1.8 11.84 0 .16.14.32.26.49.38-.64.39-1.31.72-2.01.98.37.74.8 1.44 1.28 2.1a19.86 19.86 0 0 0 6-3.04c.39-4.71-.67-8.8-3.27-12.41ZM9.68 14.29c-1.16 0-2.11-1.06-2.11-2.37 0-1.3.93-2.37 2.11-2.37 1.19 0 2.14 1.07 2.12 2.37 0 1.31-.94 2.37-2.12 2.37Zm6.64 0c-1.16 0-2.11-1.06-2.11-2.37 0-1.3.93-2.37 2.11-2.37 1.19 0 2.14 1.07 2.12 2.37 0 1.31-.93 2.37-2.12 2.37Z" />
              </svg>
            )}
            Continue with Discord
          </button>
        </div>
      </div>
    </div>
  )
}
