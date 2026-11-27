/**
 * DEV MODE: a choice of this browser (`localStorage['zelda.dev']`), never of a save or a profile. While it is on,
 * one quiet line along the top of the screen (`DevStrip.vue`) says the frame rate, the megabytes up and down and
 * the game's version. Switched on and off on the menu's LOG page. While it is off none of this runs: no observer,
 * `fetch` and `sendBeacon` the browser's own, no element.
 *
 * FPS: the frames the shell painted in the last half second (a menu's page is painted once and left alone, so it
 * reads 0). DN: `transferSize` of the page's own Performance entries, the navigation and every resource, since the
 * page loaded; the browser's resource buffer holds 250 of them from before the switch, and another origin that
 * sends no Timing-Allow-Origin counts as nothing. UP: the bodies of the requests made with `fetch` and
 * `sendBeacon` while the mode has been on; headers are not counted. 1 MB is 1 000 000 bytes.
 */
import { ref } from 'vue'

export const DEV_KEY = 'zelda.dev'
/** The strip's height, CSS px: what the HUD and the corner move down by while it is on. */
export const STRIP_H = 12
/** How often the line is written anew, ms. */
const EVERY = 500

const utf8 = (s: string) => new TextEncoder().encode(s).length

/** The bytes of a request's body; 0 for what cannot be counted without reading it (a stream). */
function bodyBytes(body: unknown): number {
  if (body == null) return 0
  if (typeof body === 'string') return utf8(body)
  if (body instanceof Blob) return body.size
  if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) return body.byteLength
  if (body instanceof URLSearchParams) return utf8(body.toString())
  // (Without the multipart's own lines between the fields.)
  if (body instanceof FormData) return [...body].reduce((a, [k, v]) => a + utf8(k) + (typeof v === 'string' ? utf8(v) : v.size), 0)
  return 0
}

const mb = (bytes: number) => (bytes / 1e6).toFixed(bytes < 1e5 ? 2 : 1)

export function createDevMode(version: number) {
  const on = ref(false)
  const text = ref('')
  let up = 0
  let down = 0
  let fps = 0
  let frames = 0
  /** When the half second being counted began (0: with the next frame). */
  let since = 0
  let running = false
  let observer: PerformanceObserver | null = null
  /** The wrappers in place: how to take each away again (false: something else has wrapped it since, so it stays). */
  let unwrapFetch: (() => boolean) | null = null
  let unwrapBeacon: (() => boolean) | null = null

  const write = () => { text.value = `${fps} FPS · UP ${mb(up)} MB · DN ${mb(down)} MB · V ${version}` }
  const sent = (body: unknown) => { if (running) up += bodyBytes(body) }

  function wrapFetch() {
    if (unwrapFetch) return
    const own = window.fetch
    const counted: typeof fetch = function (input, init) {
      try {
        if (init?.body != null) sent(init.body)
        // A Request carries its body as a stream: a copy is read for its length.
        else if (running && input instanceof Request && input.method !== 'GET' && input.method !== 'HEAD') {
          void input.clone().arrayBuffer().then(sent, () => {})
        }
      } catch { /* the count is never the request's business */ }
      return own.call(window, input, init)
    }
    window.fetch = counted
    unwrapFetch = () => {
      if (window.fetch !== counted) return false
      window.fetch = own
      return true
    }
  }

  function wrapBeacon() {
    const own = navigator.sendBeacon
    if (unwrapBeacon || !own) return
    const had = Object.getOwnPropertyDescriptor(navigator, 'sendBeacon')
    const counted: typeof navigator.sendBeacon = (url, data) => {
      const queued = own.call(navigator, url, data)
      if (queued) sent(data)
      return queued
    }
    navigator.sendBeacon = counted
    unwrapBeacon = () => {
      if (navigator.sendBeacon !== counted) return false
      if (had) Object.defineProperty(navigator, 'sendBeacon', had)
      else delete (navigator as { sendBeacon?: unknown }).sendBeacon
      return true
    }
  }

  function start() {
    if (running) return
    running = true
    down = 0
    fps = 0
    frames = 0
    since = 0
    wrapFetch()
    wrapBeacon()
    try {
      observer = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) down += (e as PerformanceResourceTiming).transferSize || 0
      })
      for (const type of ['navigation', 'resource']) observer.observe({ type, buffered: true })
    } catch { /* an old browser: DN stays at nothing */ }
    write()
  }

  function stop() {
    if (!running) return
    running = false
    observer?.disconnect()
    observer = null
    // (A wrapper that cannot be taken away counts nothing while the mode is off, and is not put on twice.)
    if (unwrapFetch?.()) unwrapFetch = null
    if (unwrapBeacon?.()) unwrapBeacon = null
  }

  return {
    on,
    text,
    /** In the browser, as the world comes up: on again where this browser chose it. */
    mount() {
      try { on.value = localStorage.getItem(DEV_KEY) === '1' } catch { /* private mode */ }
      if (on.value) start()
    },
    unmount: stop,
    toggle() {
      on.value = !on.value
      try {
        if (on.value) localStorage.setItem(DEV_KEY, '1')
        else localStorage.removeItem(DEV_KEY)
      } catch { /* private mode: for this visit only */ }
      if (on.value) start()
      else stop()
    },
    /** A frame was painted. */
    painted() { if (running) frames++ },
    /** Every turn of the shell's frame loop. */
    tick(now: number) {
      if (!running) return
      if (!since) { since = now; frames = 0; return }
      if (now - since < EVERY) return
      fps = Math.round((frames * 1000) / (now - since))
      frames = 0
      since = now
      write()
    },
  }
}
