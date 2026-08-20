import { useStorePick } from '../store/useStore'
import { isChannelEditor, isChannelContributor, isChannelManager } from '../lib/userApi'
import type { JWApiChannel } from '../lib/juicewrldApi'

// The global role flags only cover the primary channel (see isChannelEditor
// et al. in userApi.ts) — this resolves whether the active channel actually
// is primary so callers can pass that through. Defaults to true when the
// channel list hasn't loaded yet or the slug isn't recognized, matching the
// safe default already baked into the isChannel* functions.
export function isPrimaryChannelSlug(channels: JWApiChannel[], slug: string | null | undefined): boolean {
  if (channels.length === 0) return true
  const ch = channels.find((c) => c.slug === slug)
  return ch ? !!ch.is_primary : true
}

// Wraps isChannelEditor/isChannelContributor/isChannelManager with the
// account + activeChannel lookup every call site otherwise had to repeat —
// keeps the actual permission rule (global flag on primary OR per-channel
// membership, see userApi.ts) defined in exactly one place.
export function useCanEdit(): boolean {
  const { account, activeChannel, channels } = useStorePick('account', 'activeChannel', 'channels')
  return isChannelEditor(account, activeChannel, isPrimaryChannelSlug(channels, activeChannel))
}

export function useCanContribute(): boolean {
  const { account, activeChannel, channels } = useStorePick('account', 'activeChannel', 'channels')
  return isChannelContributor(account, activeChannel, isPrimaryChannelSlug(channels, activeChannel))
}

export function useCanManage(): boolean {
  const { account, activeChannel, channels } = useStorePick('account', 'activeChannel', 'channels')
  return isChannelManager(account, activeChannel, isPrimaryChannelSlug(channels, activeChannel))
}
