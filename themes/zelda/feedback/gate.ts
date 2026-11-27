/**
 * May this browser send feedback? The service answers `GET /can` with 200 `{"ok":true}` to Petter's signed-in browser
 * and refuses everybody else alike. Asked only while DEV MODE is on; the dev flag (the caller's) is the one thing from
 * storage that decides it, and the answer is stored nowhere.
 */

/** A question that has not been answered in this long counts as no. */
export const GATE_TIMEOUT_MS = 6000

export function createFeedbackGate({ fetch, url }: { fetch: typeof globalThis.fetch; url: string }) {
  /** A yes is kept for the page's life; a no is asked again. */
  let yes = false
  let asking: Promise<boolean> | null = null

  async function can(): Promise<boolean> {
    const stop = new AbortController()
    const timer = setTimeout(() => stop.abort(), GATE_TIMEOUT_MS)
    try {
      const r = await fetch(`${url}/can`, { credentials: 'include', signal: stop.signal })
      if (r.status !== 200) return false
      const body = await r.json() as { ok?: unknown } | null
      return body?.ok === true
    } catch {
      // Refused (no CORS headers), no network, timed out, not JSON.
      return false
    } finally {
      clearTimeout(timer)
    }
  }

  return {
    ask(devOn: boolean): Promise<boolean> {
      if (!devOn) return Promise.resolve(false)
      if (yes) return Promise.resolve(true)
      asking ??= can().then((answer) => {
        yes = answer
        asking = null
        return answer
      })
      return asking
    },
  }
}
