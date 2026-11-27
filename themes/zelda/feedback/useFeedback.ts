/**
 * The shell's one handle on the feedback button (docs/games/neon-shrine-feedback.md). This file alone is in the
 * shell's own chunk, so it holds the little that must be: everything else is fetched once DEV MODE is on, and the
 * camera (`capture.ts`) at the first tap. With DEV MODE off nothing is fetched and no request is made.
 */
import { onMounted, ref, shallowReactive, shallowRef, watch, type Ref } from 'vue'
import type { Shot } from './capture'
import type { Context, Snapshot } from './context'

/** One report, from the tap that began it until the service has it. In memory only. */
export interface Report extends Context {
  shot: Promise<Shot>
  state: 'idle' | 'sending' | 'sent' | 'failed'
  /** Why it was not sent. */
  reason: string
}

/** What belongs to the page rather than to one visit of the world: the gate keeps its yes. */
let gate: Promise<{ ask(devOn: boolean): Promise<boolean> }> | null = null

export function useFeedback({ devOn, snapshot }: { devOn: Ref<boolean>; snapshot: () => Snapshot }) {
  const allowed = ref(false)
  const report = shallowRef<Report | null>(null)
  let context: typeof import('./context') | null = null

  async function ask(on: boolean) {
    if (!on) return
    try {
      gate ??= Promise.all([import('./gate'), import('./url')])
        .then(([g, u]) => g.createFeedbackGate({ fetch: (...a) => fetch(...a), url: u.FEEDBACK_BASE }))
      if (!await (await gate).ask(true)) return
      // Fetched before the button shows: a tap reads the game at once, and the panel opens even if the line drops.
      const [c] = await Promise.all([import('./context'), import('./FeedbackPanel.vue')])
      context = c
      allowed.value = true
    } catch {
      // The code did not arrive: asked again the next time DEV MODE is switched on.
      gate = null
    }
  }
  watch(devOn, ask)
  onMounted(() => ask(devOn.value))

  const fb = {
    allowed,
    report,
    /** The words typed so far (null: not typed since the page loaded). The panel keeps them in storage too. */
    draft: null as string | null,
    /** At the tap, before the panel opens: where the hero stands, and the picture. A report not yet sent is kept as it is. */
    begin() {
      const held = report.value?.state
      if (!context || held === 'failed' || held === 'sending') return
      const s = snapshot()
      report.value = shallowReactive<Report>({
        ...context.collectContext(s),
        shot: import('./capture').then(c => c.captureScreen(s.canvas)),
        state: 'idle',
        reason: '',
      })
      // (No camera: the panel says NO PICTURE, and nothing is left unhandled.)
      report.value.shot.catch(() => {})
    },
  }
  return fb
}

export type Feedback = ReturnType<typeof useFeedback>
