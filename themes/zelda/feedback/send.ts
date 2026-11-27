/** `POST /entry`: one report to the feedback service, as `multipart/form-data` (docs/games/neon-shrine-feedback.md). */

export type Sent = { ok: true; id: string } | { ok: false; reason: string }

export interface Post {
  fetch: typeof globalThis.fetch
  /** The service's base address. */
  url: string
  meta: unknown
  /** null: no save goes along. */
  save: unknown
  text: string
  /** null: no picture goes along. */
  shot: Blob | null
  timeoutMs?: number
}

export const TEXT_MAX = 4000

const NO_ANSWER = 'NO ANSWER OR NOT SIGNED IN'

/** A multipart body sends every line break as two characters (CR LF): the end of a text over the cap that way is left off. */
function fit(text: string): string {
  let out = text.slice(0, TEXT_MAX)
  const over = () => out.replace(/\r\n|\r|\n/g, '\r\n').length - TEXT_MAX
  // (A character taken off is one or two of those: half the excess at a time never takes too much.)
  while (over() > 0) out = out.slice(0, -Math.ceil(over() / 2))
  return out
}

function refusal(status: number): string {
  if (status === 400) return 'REJECTED'
  if (status === 413) return 'TOO BIG'
  if (status === 507) return 'STORE FULL'
  // (The service's one refusal. A browser never shows it to the page: it has no CORS headers, so the fetch rejects.)
  if (status === 404) return NO_ANSWER
  return 'SERVER ERROR'
}

export async function postFeedback({ fetch, url, meta, save, text, shot, timeoutMs = 15000 }: Post): Promise<Sent> {
  const body = new FormData()
  body.append('meta', JSON.stringify(meta))
  body.append('text', fit(text))
  if (shot) body.append('shot', shot, 'shot.jpg')
  if (save !== null && save !== undefined) body.append('save', JSON.stringify(save))
  const stop = new AbortController()
  const timer = setTimeout(() => stop.abort(), timeoutMs)
  try {
    const r = await fetch(`${url}/entry`, { method: 'POST', credentials: 'include', body, signal: stop.signal })
    if (r.status !== 201) return { ok: false, reason: refusal(r.status) }
    const answer = await r.json().catch(() => null) as { ok?: unknown; id?: unknown } | null
    if (answer?.ok === true && typeof answer.id === 'string') return { ok: true, id: answer.id }
    return { ok: false, reason: stop.signal.aborted ? 'TIMED OUT' : 'SERVER ERROR' }
  } catch {
    return { ok: false, reason: stop.signal.aborted ? 'TIMED OUT' : NO_ANSWER }
  } finally {
    clearTimeout(timer)
  }
}
