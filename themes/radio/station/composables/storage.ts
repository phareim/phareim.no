// Vendored from phareim/radio@61a86d4 by scripts/sync-radio.mjs — edit it there, then re-sync.
/** localStorage that never throws (private windows, blocked storage). */
export function load<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function save(key: string, value: unknown): void {
  try {
    if (value === undefined) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable: settings last the session */
  }
}
