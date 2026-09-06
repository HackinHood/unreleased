export function createTtlCache<T>(ttlMs: number, fetcher: () => Promise<T>): () => Promise<T> {
  let cache: { promise: Promise<T>; ts: number } | null = null
  return function load(): Promise<T> {
    const now = Date.now()
    if (!cache || now - cache.ts > ttlMs) {
      cache = { promise: fetcher(), ts: now }
    }
    const entry = cache
    entry.promise.catch(() => { if (cache === entry) cache = null })
    return entry.promise
  }
}
