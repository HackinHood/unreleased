import { ls } from './persist'

export interface SessionEditOverride {
  path: string
  duration: string | null
  channel: string
}

let _overrides: Record<number, SessionEditOverride> = ls.get<Record<number, SessionEditOverride>>('sessionEditOverrides') ?? {}

export function peekSessionEditOverride(songId: number): SessionEditOverride | undefined {
  return _overrides[songId]
}

export function setSessionEditOverride(songId: number, override: SessionEditOverride | null): void {
  _overrides = { ..._overrides }
  if (override) _overrides[songId] = override
  else delete _overrides[songId]
  ls.set('sessionEditOverrides', _overrides)
}
