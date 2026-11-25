<template>
  <!-- `px16` on every root (and on the canvas, for the page's hint beside it): the HTML wears the 16-bit dress while the canvas HUD does.
    The canvas also says when the game is paused, so that hint can step aside. -->
  <canvas ref="canvas" class="zelda-canvas" :class="{ px16: dress16, 'zelda-canvas--paused': paused }" />
  <!-- Measures the notch and status-bar insets for the HUD (installed web app, landscape). -->
  <div ref="safeProbe" class="zelda-safe" aria-hidden="true" />
  <EscHold :class="{ px16: dress16 }" :is-active="() => phase === 'play' && !panel" :paused="paused" :show-paused="false" label="HOLD ESC FOR TOWN" @tap="escTap" @hold="toTown" />
  <!-- The corner: pause and the turn switch, and the map under them: the three ways into the menu and the views.
    (The map comes and goes, indoors and in a fight, with nothing under it to move: the chip stays where the thumb knows it.)
    All three hand the game its keys back when they have been reached by Tab (`data-game-keys`, input.ts).
    It steps away, by class and never by v-if, while something else has the screen: the menu (which has its own
    buttons), a dialog (its box may lie across the corner), a panel, the dark of a way out.
    The corner map (`render/worldMap.ts`) is a window round the hero that turns with the world; a press opens the
    menu's MAP page, as M does. The pause chip opens its ITEMS page, as P and an Escape tap do.
    The turn switch (`render/turnSwitch.ts`): 8 [ carriage ] 16. A press turns the world to the next view, as V
    does, and the carriage rides the turn. No `.stop` on its press: a first touch must still reach input.ts, which
    is where the touch deck is turned on. -->
  <div
    v-if="phase === 'play'"
    ref="corner"
    class="zelda-corner"
    :class="{ px16: dress16, 'zelda-corner--touch': touchUI, 'zelda-corner--away': paused || !!panel || talking || leaving, 'zelda-corner--night': turnStage === 'night', 'zelda-corner--dawn': turnStage === 'dawn' }"
  >
    <div class="zelda-corner-row">
    <button
      type="button"
      class="zelda-chip"
      data-game-keys
      :disabled="paused || !!panel || talking || leaving"
      aria-label="Pause"
      aria-keyshortcuts="P"
      :title="touchUI ? undefined : 'Pause (P)'"
      @pointerdown.prevent.stop="openPage('items')"
      @click="$event.detail === 0 && openPage('items')"
      @mousedown.prevent
      @contextmenu.prevent
    >II</button>
  <div
    v-if="viewCount > 1"
    ref="turnWrap"
    class="zelda-turn-wrap"
    :class="{ px16: dress16, 'zelda-turn-wrap--touch': touchUI }"
  >
    <button
      ref="turnBtn"
      type="button"
      class="zelda-turn"
      data-game-keys
      :disabled="paused || !!panel || talking || leaving"
      :aria-label="turnLabel"
      aria-keyshortcuts="V"
      :aria-busy="turnWaiting || undefined"
      :title="touchUI ? undefined : 'View (V)'"
      @pointerdown.prevent="turnPress"
      @mousedown.prevent
      @pointerup="turnRelease"
      @pointercancel="turnRelease"
      @click="turnClick"
      @keydown="turnKey"
      @contextmenu.prevent
      @pointerenter="turnHover($event, true)"
      @pointerleave="turnHover($event, false)"
    ><canvas ref="turnCanvas" class="zelda-turn-canvas" aria-hidden="true" /></button>
  </div>
    </div>
    <button
      v-if="miniShown"
      type="button"
      class="zelda-mini"
      data-game-keys
      :disabled="paused || !!panel || talking || leaving"
      aria-label="Map"
      aria-keyshortcuts="M"
      :title="touchUI ? undefined : 'Map (M)'"
      @pointerdown.prevent.stop="openPage('map')"
      @click="$event.detail === 0 && openPage('map')"
      @mousedown.prevent
      @contextmenu.prevent
    ><canvas ref="miniCanvas" class="zelda-mini-canvas" aria-hidden="true" /></button>
  </div>
  <span class="zelda-turn-said" role="status" aria-live="polite">{{ turnSaid }}</span>
  <!-- Touch deck. The buttons float bottom-right over the world, which fills
    the whole screen, and step aside while a dialog box takes the bottom of
    the screen (any tap moves it on). The floating stick starts anywhere on
    the left 60 % that isn't a button. Pause, the map and the views sit apart,
    in the top-right corner, where no thumb rests. While the game stands
    still the deck holds the menu's buttons: its two pages, and what each
    switches, four to a page (the views are on the MAP page, and in the
    corner in play). -->
  <div
    v-if="touchUI && phase === 'play' && !panel && (paused || !talking)"
    class="zelda-deck"
    :class="{ 'zelda-deck--paused': paused, px16: dress16 }"
  >
    <template v-if="!paused">
      <button v-if="hasItem" class="zelda-pad zelda-pad-swap" aria-label="Swap item" @pointerdown.prevent.stop="cycle" @contextmenu.prevent>
        <img v-if="swapIcon" :src="swapIcon" alt="" class="zelda-pad-icon">
      </button>
      <div class="zelda-deck-btns" :class="{ 'zelda-deck-btns--solo': !hasItem }">
        <button v-if="hasItem" class="zelda-pad zelda-pad-b" aria-label="Use item" @pointerdown.prevent.stop="pressB" @contextmenu.prevent>
          <img v-if="itemIcon" :src="itemIcon" alt="" class="zelda-pad-icon">
        </button>
        <button
          class="zelda-pad zelda-pad-a"
          aria-label="Sword: talk, read, use"
          @pointerdown.prevent.stop="pressA"
          @pointerup.prevent.stop="releaseA"
          @pointercancel="releaseA"
          @pointerleave="releaseA"
          @contextmenu.prevent
        ><img v-if="swordIcon" :src="swordIcon" alt="" class="zelda-pad-icon zelda-pad-icon--big"></button>
      </div>
    </template>
    <div v-else-if="confirmReset" class="zelda-deck-paused">
      <button class="zelda-pad zelda-pad-wide zelda-pad-quit" @pointerdown.prevent.stop="resetRun" @contextmenu.prevent>YES, START OVER</button>
      <button class="zelda-pad zelda-pad-wide" @pointerdown.prevent.stop="cancelReset" @contextmenu.prevent>NO</button>
    </div>
    <div v-else class="zelda-deck-paused">
      <button class="zelda-pad zelda-pad-wide" @pointerdown.prevent.stop="togglePause()" @contextmenu.prevent>RESUME</button>
      <button v-if="menuPage === 'items'" class="zelda-pad zelda-pad-wide" @pointerdown.prevent.stop="openPage('map')" @contextmenu.prevent>MAP</button>
      <button v-else class="zelda-pad zelda-pad-wide" @pointerdown.prevent.stop="openPage('items')" @contextmenu.prevent>ITEMS</button>
      <template v-if="menuPage === 'items'">
        <button class="zelda-pad zelda-pad-wide" :aria-pressed="!sound.muted.value" @pointerdown.prevent.stop="toggleSound" @contextmenu.prevent>{{ sound.muted.value ? 'SOUND OFF' : 'SOUND ON' }}</button>
        <button class="zelda-pad zelda-pad-wide zelda-pad-quit" @pointerdown.prevent.stop="toTown" @contextmenu.prevent>TO TOWN</button>
      </template>
      <template v-else>
        <button class="zelda-pad zelda-pad-wide" :aria-pressed="cornerMap" @pointerdown.prevent.stop="toggleCorner" @contextmenu.prevent>{{ cornerMap ? 'CORNER MAP ON' : 'CORNER MAP OFF' }}</button>
        <button class="zelda-pad zelda-pad-wide" @pointerdown.prevent.stop="cycleView" @contextmenu.prevent>VIEW: {{ viewLabel }}</button>
      </template>
    </div>
  </div>
  <!-- The login console in Petter's house: the world stands still behind it. -->
  <AccountConsole v-if="panel === 'account'" :class="{ px16: dress16 }" :touch="touchUI" @close="closePanel" @leave="leaveForPanel" @session="applySession" />
  <!-- The NEW LOOK stall on the square: its mirror, where the hero's look is changed. -->
  <LookBooth v-if="panel === 'look'" :class="{ px16: dress16 }" :touch="touchUI" :current="heroLook" :figure="figureColors" :reduced-motion="reducedMotion" @close="closePanel" @wear="wearLook" />
  <!-- The newsstand on the coast: Sleeper's feed, read here. Its own chunk, fetched when the stand is first used. -->
  <NewsStand v-if="panel === 'news'" :class="{ px16: dress16 }" :touch="touchUI" @close="closePanel" />
</template>

<script setup lang="ts">
/**
 * THE WORLD SHELL — phareim.no's front page and Neon Shrine in one: the
 * town, the coast, the shrine. Clock, input, touch deck, audio, saves and
 * the ways out. The game is `engine/` (pure), `world/` (data) and `render/`
 * (Canvas). Always in play: no title. Phases: play → won (the ending panel
 * is the page's, `portal/Landing.vue`) → play again: the run is kept and
 * the hero plays on; the NEW GAME machine in Petter's house is the only
 * reset (its lines close into `startOver`, and the shell asks yes or no).
 *
 * Start: in front of the exit last used (sessionStorage `portal.return`,
 * { map, entry }), else the plaza start; the save brings items, hearts and
 * flags. It is written (here and on the profile) only once the hero has the
 * blade, so a visitor who walks into a house never becomes a player.
 *
 * Keys: arrows / WASD move; Space / J / Z / Enter = A (sword, talk, lift,
 * throw; hold then release for a spin); K / X / Shift = B (item); Q swaps
 * item, Tab too when there is one (else Tab reaches the page's link index);
 * P or an Escape tap open the menu on its ITEMS page, M on its MAP page
 * (`render/worldMap.ts`); there the key of the open page (or Escape) closes
 * it, the other key turns the page. In the menu T goes to town, O turns the
 * sound on or off, C the corner map; V turns to the next view anywhere
 * (`views.ts`: the classic one a visit starts in, the 16-bit one, and the
 * studio's own); holding Escape saves and goes back to town.
 * Touch: floating stick on the left; on the right three round buttons with
 * pictures, no letters: A (the sword), and with an item B (the item) and
 * swap. The top-right corner holds the map, the pause chip and the turn
 * switch. The input itself is `input.ts`.
 *
 * Leaving: an engine `exit` saves, writes `portal.return` and launches the
 * theme or opens the URL. Installed as a web app, a game on another address
 * is shown in a frame on this page instead (`useFrame`, docs/games/frame.md).
 *
 * The login console (Petter's house) sends a `panel` event instead: the
 * shell opens `AccountConsole.vue` over the world, which stands still (the
 * scene keeps animating). Its LOG IN / CREATE ACCOUNT save and write
 * `portal.return` for the console the same way, then load the auth page.
 * The newsstand on the coast opens `NewsStand.vue` the same way: Sleeper's
 * feed (sleeper.phareim.md) read inside the game; its links open new tabs.
 *
 * Bits are the site wallet (`composables/useWallet.ts`, shared with Mini
 * World): `wallet.ts` bridges the pure engine's `inv.bits` to it — a new
 * state starts on the wallet's balance, each frame's change becomes a wallet
 * op (a chest's bits only the first time on this browser), and a change
 * elsewhere (another tab, Mini World) lands in the purse.
 * The hero wears the newest choice: the look from the NEW LOOK stall on the
 * square (`LookBooth.vue`, `render/heroLook.ts`, localStorage
 * `zelda.heroLook`), until the figure from Lag Din Figur, or else Mini
 * World's active person (`render/heroColors.ts`), is changed after it.
 * Re-read on `storage` and when the tab comes back.
 */
import EscHold from '../base/EscHold.vue'
import AccountConsole from './AccountConsole.vue'
import LookBooth from './LookBooth.vue'
import { createGame, HOURS, mapInfo, resumeAfterWin, setDaytime, setSession, stepGame, toSave, useItems } from './engine/index'
import { fetchSession } from './account'
import { WORLD, worldStartingAt } from './world/index'
import { neighbourPrefetch } from './prefetch'
import { createRenderer, type FrameUI, type Renderer, type ViewFactory } from './render/renderer'
import { ease, turnMove } from './render/iso/project'
import { ENGINE_LOADERS, VIEW_KEY, nextView, setLiveViews, startView, viewDef, viewList, viewName, type LiveViews, type ViewId } from './views'
import { HIRES_WINDOW_SKIN, NEON_SKIN, type HudSkin } from './render/hud'
import { drawMiniMap, hasMiniMap, MINI_H, MINI_W } from './render/worldMap'
import { REFUSE_MS, SW_H, SW_W, TICK_MS, captionFor, chromeAlpha, drawTurnSwitch, refuseNudge, shortTag, switchLayout, tickNudge, type SwitchState } from './render/turnSwitch'
import { resolveParams } from './viewParams'
import { sprite } from './render/sheet'
import { itemIconName } from './render/dig'
import { startLiveSprites } from './render/live'
import { KEYBOARD_KEYS, TOUCH_KEYS } from './keys'
import { createZeldaAudio, flavorForView, type SfxName, type ZeldaAudio } from './audio'
import { readLocalSave, writeLocalSave, clearLocalSave, readLocalBest, writeLocalBest } from './localSave'
import { syncWithProfile } from './profileSync'
import { usePortalAccountLink } from '../../composables/useAccount'
import { createInput, type GameInput } from './input'
import { loadHighScoreSign } from './hiscore'
import { createBitsBridge, migrateSaveBits, bitRewards, paidFlagStore, type WalletApi } from './wallet'
import { parseHeroColors } from './render/heroColors'
import { HERO_LOOK_KEY, storeHeroLook, wornLook, type HeroLook } from './render/heroLook'
import { HERO_COLORS_KEY, type HeroColors } from '../miniworld/types'
import { FIGUR_HERO_KEY } from '../figur/types'
import { readWallet, addToWallet, onWalletChange } from '../../composables/useWallet'
import type { ExitTarget, GameState, GameEvent, PanelId, SaveData, TrackId, World } from './types'

/** The newsstand's reader stays out of the entry (what `/` costs): nobody pays for it before using the stand. */
const NewsStand = defineAsyncComponent(() => import('./NewsStand.vue'))

type Phase = 'play' | 'won'
type Spot = World['start']

const emit = defineEmits<{
  /** The visitor walked for the first time (the page hint can go). */
  moved: []
  phase: [phase: Phase]
  result: [result: { elapsed: number; best: number | null }]
}>()

const RETURN_KEY = 'portal.return'
/** A theme exit that has not navigated after this long (bad id) comes back to the world. */
const STUCK_S = 2.5
/** A URL exit waits longer (the next site may be slow), but not forever: Esc or Stop can cancel the navigation. */
const STUCK_URL_S = 8
/** The ending panel ignores keys and taps this long, so the press that took the prism does not skip it. */
const WON_GRACE_MS = 1200
const CONTINUE_KEYS = new Set(['Enter', 'Space', 'KeyJ', 'KeyZ'])
/** The start-over question ignores YES this long, so a tap mashed through the machine's lines does not answer it. */
const RESET_GRACE_MS = 600

const canvas = ref<HTMLCanvasElement | null>(null)
const safeProbe = ref<HTMLDivElement | null>(null)
const paused = ref(false)
/** The menu's page while paused: ITEMS (P, Escape, the pause chip) or MAP (M, the corner map). */
const menuPage = ref<'items' | 'map'>('items')
/** The corner map is wanted (C on the MAP page; kept in this browser), and where the hero is it has something to show. */
const CORNER_KEY = 'zelda.cornerMap'
const cornerMap = ref(true)
const miniShown = ref(false)
/** The NEW GAME machine is asking whether to throw the run away (the game stands paused behind it). */
const confirmReset = ref(false)
/** An HTML panel over the world (the login console's, the NEW LOOK stall's mirror, the newsstand's reader); the hero stands still while it is open. */
const panel = ref<PanelId | null>(null)
/** The look chosen at the NEW LOOK stall (null: none), and a made figure's colours, as last read from storage. */
const heroLook = ref<HeroLook | null>(null)
const figureColors = ref<HeroColors | null>(null)
/** The exit that opened the panel: coming back from the auth page stands the hero in front of it. */
let panelExit = ''
/** Logged in on auth.phareim.no, as last heard: the VIP hall's rope is down while it holds. Not saved. */
let signedIn = false
const phase = ref<Phase>('play')
const touchUI = ref(false)
/** The B item's icon, as the HUD would draw it (for DIG: the tool the tile in front wants); '' with nothing out. */
const padItem = ref('')
/** The hero has a B item to use here (bombs, the disc, the hook, a dig tool on a dig map): B, SWAP and Tab have a job. */
const hasItem = ref(false)
/** A dialog is open (the floating buttons hide so they don't sit on the text). */
const talking = ref(false)
const { navigationLocked, launch } = useTheme()
const { enter: enterFrame } = useFrame()
const sound = useSound()
const profileSave = useGameSave('zelda')
/** Signed in: play under the account's profile, so the save follows it to every device (composables/useAccount.ts). */
const linkAccount = usePortalAccountLink()
let linkedUser = ''

let renderer: Renderer | null = null
let audio: ZeldaAudio | null = null
let state: GameState = createGame(WORLD, { at: WORLD.start })
/**
 * The frontier's next regions, made when nothing is moving (paused, a panel or a dialog open, or a long idle
 * slice) so crossing an edge does not stall; never mid-warp, mid-fight or mid-scroll, and never in a short slice.
 */
const prefetch = neighbourPrefetch(WORLD, {
  busy: () => state.mode === 'warp' || state.mode === 'battle' || state.mode === 'scroll',
  calm: () => paused.value || panel.value !== null || state.mode === 'dialog' || state.mode === 'get',
})
let raf = 0
let lastT = 0
let hitStopMs = 0
/** A paused world is drawn once, then left alone until it resumes (2026-09-30). */
let pausedDrawn = false
const reducedMotion = ref(false)
let lowHpT = 0
let track: TrackId | null = null
/** Audio is awake (browsers keep it asleep until a key or tap). */
let unlocked = false
let moved = false
let alive = false
/** The save this run began from, to tell whether a profile pull changes anything. */
let loadedSave: SaveData | null = null
/** This session has written the save (or dropped it): a late profile pull no longer replaces the run. */
let ownsSave = false
/** A newer save from the profile, applied at the next calm frame. */
let pendingPull: { save: SaveData | null } | null = null
/** Seconds spent in mode 'exit' without leaving. */
let stuckT = 0
let leavingUrl = false
let wonAt = 0
const walletApi: WalletApi = { read: readWallet, add: addToWallet }
// A chest pays into the wallet once per browser, not once per run.
const purse = createBitsBridge(walletApi, { rewards: bitRewards(WORLD), paid: paidFlagStore(() => localStorage) })
let askedAt = 0

const ui: FrameUI = {
  paused: false, confirmReset: false, muted: false, reducedMotion: false, touch: false, stick: null, attract: false, cam: null, banner: null,
  keys: KEYBOARD_KEYS,
}

// ---- the 16-bit dress ----------------------------------------------------------

/**
 * A view whose canvas HUD is the 16-bit one (`hud16.ts`): the isometric engine with its `windows` value at '16-bit'.
 * While it is on, the shell's HTML (chips, deck, pause buttons, panels, the page's hint) wears the same dress:
 * the class `px16` (base/pixel/pixel16.css).
 */
function wears16(id: ViewId): boolean {
  const def = viewDef(id) ?? viewDef('classic')!
  return def.engine === 'iso' && resolveParams(def.engine, def.params).windows === '16-bit'
}
/** The dress is on. The first paint guesses from the address alone (the server knows no more); mounting corrects it. */
const dress16 = ref(wears16(startView(useRoute().query.view, null)))
/** `?daytime=dusk|night|dawn|noon|<seconds>`: start the day at that hour (after the prism; before it in development too). */
const askedHour = ((): number | null => {
  const q = useRoute().query.daytime
  const v = Array.isArray(q) ? q[0] : q
  if (typeof v !== 'string' || !v) return null
  if (v in HOURS) return HOURS[v as keyof typeof HOURS]
  const n = Number(v)
  return Number.isFinite(n) ? n : null
})()
/** What the view on screen (or the one a turn is heading for) asks for, and the turn's `k` at the last frame. */
let dressWanted = dress16.value
let dressK = 0

/** After the view or its values changed. */
function syncDress() {
  dressWanted = wears16(viewShown)
}

/**
 * Each frame: the HTML changes dress when the canvas HUD does. That is at once when nothing turns, and halfway
 * through a turn (`k` past 0.5, as in iso/view.ts): on the way in while `k` rises, on the way out when it has fallen.
 */
function stepDress(vs: { k: number; turning: boolean; dark: boolean }) {
  // (A visit's first dark moments: the dress guessed for the view on its way stays on.)
  if (vs.dark) return
  // Where the canvas cannot show its fine HUD (a screen with one device px to the classic px), the HTML keeps the classic dress with it.
  const fine = !renderer || renderer.fineUnit() > 0
  const on = fine && (!vs.turning ? dressWanted : dress16.value ? vs.k > 0.5 : dressWanted && vs.k > 0.5 && vs.k > dressK)
  dressK = vs.k
  if (on !== dress16.value) dress16.value = on
}

/** CSS px to one pixel of the canvas's 16-bit HUD, as last written to the page (0: not yet). */
let fineUnit = 0

/**
 * What stands beside the canvas HUD in the 16-bit dress (chips, pause buttons, the Escape pill, the page's hint) is
 * sized by that HUD's own pixel, so its letters are the canvas's size: `Renderer.fineUnit()`, which follows the screen
 * and the map, as `--px16-fine` on the element the shell sits in (the hint is beside the canvas, not inside a root of
 * ours, so the property goes where both inherit it). Snapped to whole device px, so the letters stay sharp. Called
 * after a resize and each frame; it writes only when the number changed. Before the first call the CSS falls back to 1px.
 */
function syncUnit() {
  const host = canvas.value?.parentElement
  if (!renderer || !host) return
  const dpr = window.devicePixelRatio || 1
  const unit = Math.max(1, Math.round(renderer.fineUnit() * dpr)) / dpr
  if (unit === fineUnit) return
  fineUnit = unit
  host.style.setProperty('--px16-fine', `${unit}px`)
}

// The deck's buttons carry pictures: the sprites, as data URLs (browser only). `artVersion`
// moves when the studio's live art arrives (render/live.ts), so the pictures are made again.
// In the 16-bit dress they are the canvas HUD's: the sprite at twice the pixels (EPX, `hud16.ts`).
const iconCache = new Map<string, string>()
const artVersion = ref(0)
function iconUrl(name: string) {
  if (!import.meta.client) return ''
  void artVersion.value
  const fine = dress16.value
  const key = fine ? `16:${name}` : name
  let url = iconCache.get(key)
  if (!url) { url = (fine ? HIRES_WINDOW_SKIN.icon!(name) : sprite(name)).toDataURL(); iconCache.set(key, url) }
  return url
}
const itemIcon = computed(() => (padItem.value ? iconUrl(padItem.value) : ''))
const swordIcon = ref('')
const swapIcon = ref('')
watch(dress16, () => {
  swordIcon.value = iconUrl('item_sword')
  swapIcon.value = iconUrl('hud_swap')
})

// ---- input -------------------------------------------------------------------

const input: GameInput = createInput({
  canvas: () => canvas.value,
  touch: () => touchUI.value,
  onTouch: () => { touchUI.value = true; resize() },
  idle: () => phase.value !== 'play',
  paused: () => paused.value || panel.value !== null,
  dialog: () => state.mode === 'dialog',
  battle: () => state.mode === 'battle',
  onIdleTap: () => { if (phase.value === 'won') keepExploring() },
  onKey: shellKey,
})

// ---- views ---------------------------------------------------------------------

/** The way the world is shown (`views.ts`); the game underneath is the same. */
const viewId = ref<ViewId>(startView(useRoute().query.view, null))
/** Counts the studio's changes to the round, so a renamed view shows its new name. */
const viewRound = ref(0)
const viewLabel = computed(() => (void viewRound.value, viewName(viewId.value)))
let viewAsk = 0
/** The view the renderer was last handed: where a failed switch falls back to. */
let viewShown: ViewId = 'classic'
/**
 * The first frames wait for the view the visit starts in (the 16-bit one, unless this browser chose another), so
 * no other picture flashes by: the screen stays dark for `NIGHT_MS` from the first frame the tab is looked at,
 * while the view's code is fetched, its shaders compile and its pictures are painted, and the view then comes up
 * out of the dark. A device or a network that needs longer gets the classic picture meanwhile, and the view turns
 * in from it when it is here.
 */
let viewHold = false
const NIGHT_MS = 450
/** When the night began: the first frame the tab was looked at (0: not yet), so a tab opened in the background has its night too. */
let nightFrom = 0
const nightLeft = () => nightFrom ? Math.max(0, NIGHT_MS - (performance.now() - nightFrom)) : NIGHT_MS
/** How many views the renderer had put away for throwing when the shell last looked (`viewState().failed`). */
let failedSeen = 0
/** How often each engine's view has thrown this visit: after three times a press for it is refused, not tried again. */
const engineFails = new Map<string, number>()
const FAILS_MAX = 3

/**
 * The renderer put a view away (it threw) and draws the classic picture: the shell follows it there, as when a
 * view's code did not arrive. What the visitor chose stays chosen; the next visit tries it again.
 */
function viewFailed() {
  const def = viewDef(viewShown)
  // (A view that was on its way out anyway: the turn ended there, on the classic picture, and that is no refusal.)
  if (!renderer || !def || renderer.hasView(def.engine)) return
  engineFails.set(def.engine, (engineFails.get(def.engine) ?? 0) + 1)
  viewAsk++
  viewId.value = 'classic'
  viewShown = 'classic'
  turnAt.a = 'classic'
  // (The switch is told where it stands: the bump and NO SIGNAL are the news here, not an arrival at the classic view.)
  sw.rest = 'classic'
  turnSaid.value = `${sayView('classic')} view`
  pausedDrawn = false
  syncSound()
  syncDress()
  turnRefuse()
}

/**
 * Turn to a view, fetching its code the first time. `instant`: no turn (a paused game, an open panel, the ending, reduced motion).
 * `remember`: this is the visitor's own choice, kept for the next visit; the view a visit starts in is not one
 * (a browser that never chose keeps following the site's first view, and one bad fetch does not pin it to the classic one).
 * `arriving`: it is the view the visit starts in (`renderer.arrive`).
 * A view that is not ready when it is asked for (its shaders compile for a moment the first time) is waited for
 * on the classic picture, and turns in when it is (`render/turn.ts`).
 */
async function showView(id: ViewId, instant = false, remember = true, arriving = false) {
  if (!renderer) return
  // A view is an engine with its own values (`views.ts`); one the round no longer holds is the classic one.
  const def = viewDef(id) ?? viewDef('classic')!
  // (A view that keeps throwing is not made a fourth time.)
  if ((engineFails.get(def.engine) ?? 0) >= FAILS_MAX) { turnRefuse(); return }
  viewId.value = def.id
  if (def.engine === 'classic') turnAt.a = def.id
  else turnAt.b = def.id
  const ask = ++viewAsk
  const load = ENGINE_LOADERS[def.engine]
  if (load && !renderer.hasView(def.engine)) {
    try {
      const mod = await load()
      if (!alive || !renderer) return
      renderer.addView(def.engine, mod.default as ViewFactory)
    } catch {
      // The code did not arrive (offline, a deploy in between): stay where we were.
      if (ask !== viewAsk || !alive || !renderer) return
      viewId.value = viewShown
      syncDress()
      turnRefuse()
      return
    }
  }
  if (ask !== viewAsk) return
  // Kept only now that it can be shown: a view whose code did not arrive is not a choice, however many presses asked for it.
  if (remember) try { localStorage.setItem(VIEW_KEY, def.id) } catch { /* private mode: this visit only */ }
  renderer.setParams(def.engine, def.params)
  // No turn where nothing would play it: reduced motion, a paused game, an open panel, the ending.
  if (arriving) renderer.arrive(def.engine, nightLeft(), !reducedMotion.value)
  else renderer.setView(def.engine, instant || reducedMotion.value || paused.value || panel.value !== null || phase.value === 'won')
  viewShown = def.id
  pausedDrawn = false
  syncSound()
  syncDress()
  // (Under a panel or the ending the world is drawn five times a second: the new picture comes with its dress, now.)
  slowT = 0
}

/** The sound follows the picture: the isometric view plays on the 16-bit chip, unless its values ask for the 8-bit one (`flavorForView` in audio.ts). */
function syncSound() {
  const def = viewDef(viewShown) ?? viewDef('classic')!
  audio?.setFlavor(flavorForView(def.engine, resolveParams(def.engine, def.params)))
}

/** The map the view was last fitted to, and the visitor's own view while a map holds the world in another (MapDef.views). */
let fitMap = ''
let heldView: ViewId | null = null

/** May this map be shown in that view? (MapDef.views; the frontier's dig realms are isometric only.) */
function allows(id: ViewId): boolean {
  const only = state ? mapInfo(WORLD, state.map.id).def.views : undefined
  const def = viewDef(id)
  return !only || !def || only.includes(def.engine)
}

/**
 * A map that is drawn in some views only: turn to the first it allows (the isometric one first) without making it the
 * visitor's choice, and back to their own view on a map that allows it again.
 */
function fitView() {
  if (!state) return
  fitMap = state.map.id
  if (!allows(viewId.value)) {
    heldView ??= viewId.value
    const round = viewList()
    const to = round.find(v => v.engine === 'iso' && allows(v.id)) ?? round.find(v => allows(v.id))
    if (to) void showView(to.id, false, false)
  } else if (heldView && heldView !== viewId.value && allows(heldView)) {
    const back = heldView
    heldView = null
    void showView(back, false, false)
  } else if (heldView && allows(heldView)) heldView = null
}

function cycleView() {
  if (phase.value !== 'play') return
  // (The visitor has found the views: the switch has nothing left to point out.)
  sw.fresh = false
  audio?.sfx('menu')
  // (The pause screen names the view itself; in play the turn switch shows it, and names it when it arrives.)
  let next = nextView(viewId.value)
  for (let i = 0; i < viewList().length && !allows(next); i++) next = nextView(next)
  if (next === viewId.value) { turnRefuse(); return }
  heldView = null
  void showView(next)
}

/** The studio published views (or took them back): the round changes, and the view on screen takes its new values at once. */
function applyLiveViews(live: LiveViews | null) {
  setLiveViews(live)
  viewRound.value++
  if (!renderer) return
  const def = viewDef(viewId.value)
  if (!def) { void showView('classic', true); return }
  renderer.setParams(def.engine, def.params)
  pausedDrawn = false
  syncSound()
  syncDress()
  slowT = 0
}

// ---- the turn switch -------------------------------------------------------------

/**
 * The instrument in the corner (`render/turnSwitch.ts`): a slot with the views' numerals at its ends and a
 * carriage that carries one ground tile. Everything on it is a function of the renderer's own `k`, read once
 * a frame after the dress: where the carriage stands, the tile's shape (a square, the 2:1 diamond), the seam
 * between its two dresses. So it turns with the world, and a second press in the middle of a turn takes it
 * back in the same frame as the world. It holds no motion of its own but two small ones: the tick that shows a
 * first-time visitor it can move, and the bump of a refusal.
 */
const turnWrap = ref<HTMLElement | null>(null)
const turnBtn = ref<HTMLButtonElement | null>(null)
const turnCanvas = ref<HTMLCanvasElement | null>(null)
const viewCount = computed(() => (void viewRound.value, viewList().length))
/** The hero is on the way out of the map (a door, a cabinet): the canvas goes dark and hides its HUD. */
const leaving = ref(false)
/** A visit's first moments: nothing while the screen is dark, then up out of it with the first picture. */
const turnStage = ref<'night' | 'dawn' | 'up'>('night')
const turnWaiting = ref(false)
/** What a screen reader is told when the view changes. */
const turnSaid = ref('')
const sayView = (id: ViewId) => {
  const v = viewDef(id) ?? viewDef('classic')!
  return `${v.name.charAt(0)}${v.name.slice(1).toLowerCase()}${v.tag ? ` ${v.tag.toLowerCase()}` : ''}`
}
const turnLabel = computed(() => (void viewRound.value, `View: ${sayView(viewId.value)}. Press for ${sayView(nextView(viewId.value))}.`))
/** The stops the carriage runs between: the classic-engine view last asked for (k = 0) and the last of another engine (k = 1). */
const turnAt = { a: 'classic' as ViewId, b: '' as ViewId }
const DAWN_MS = 320
const CAPTION_MS = 1800
const WAIT_SHOWN_MS = 150
const sw = {
  hover: false, down: false, downAt: -1e9, byPointer: false,
  sig: '', chrome: 1, unit: '', width: '', firstAt: 0,
  caption: '', captionAt: -1e9, captionHot: false, refuseAt: -1e9,
  /** A browser that has never chosen a view: the carriage ticks once or twice, and no more. */
  fresh: false, tickAt: -1e9, ticks: 0, tickDue: 0, sawWaiting: false,
  /** The view at the last rest (null: no frame yet), and whether a turn has been seen since. */
  rest: null as ViewId | null, sawTurn: false,
  /** The canvas last painted (the ending takes the switch away and brings a new one back), and when the wait began. */
  el: null as HTMLCanvasElement | null, waitFrom: -1,
  scratch: null as [HTMLCanvasElement, HTMLCanvasElement] | null,
}

function turnCaption(text: string, nowMs: number, hot = false) {
  sw.caption = text
  sw.captionAt = nowMs
  sw.captionHot = hot
}

/** The view's code did not arrive: the carriage bumps toward it and falls back, and says so. */
function turnRefuse() {
  const now = performance.now()
  sw.refuseAt = now
  turnCaption('NO SIGNAL', now, true)
  audio?.sfx('error')
}

/** The HUD skin a view wears on this screen (`fine`: the screen has a finer pixel than the HUD's). */
function hudSkinOf(id: ViewId, fine: boolean): HudSkin {
  return !wears16(id) ? NEON_SKIN : fine ? HIRES_WINDOW_SKIN : HIRES_WINDOW_SKIN.coarse?.() ?? NEON_SKIN
}

/** The corner's unit: one fine px of the canvas HUD, a whole number of device px and never under one CSS px. */
function cornerUnit(): { uDev: number; css: string } {
  const dpr = window.devicePixelRatio || 1
  const uDev = Math.max(Math.round((renderer?.fineUnit() ?? 1) * dpr), Math.ceil(dpr))
  return { uDev, css: `${uDev / dpr}px` }
}

const corner = ref<HTMLElement | null>(null)
const miniCanvas = ref<HTMLCanvasElement | null>(null)
const mini = { sig: '', unit: '', wrap: null as HTMLElement | null, cv: null as HTMLCanvasElement | null }

/** Each frame, after the switch: the corner map round the hero, drawn when what it shows has changed. */
function stepMiniMap(nowMs: number) {
  if (!renderer) return
  const shown = cornerMap.value && hasMiniMap(WORLD, state)
  if (shown !== miniShown.value) miniShown.value = shown
  const wrap = corner.value
  const { uDev, css } = cornerUnit()
  // (A corner or a canvas made anew, after the ending or a fight, has neither the unit nor the picture yet.)
  if (wrap !== mini.wrap) { mini.wrap = wrap; mini.unit = '' }
  if (wrap && css !== mini.unit) { mini.unit = css; wrap.style.setProperty('--zelda-turn-u', css) }
  const cv = miniCanvas.value
  if (cv !== mini.cv) { mini.cv = cv; mini.sig = '' }
  if (!shown || !cv) return
  const vs = renderer.viewState()
  const e = Math.max(0, Math.min(1, vs.turn))
  const reduced = reducedMotion.value
  // The dress changes where the canvas HUD's does, half way through a turn.
  const skin = hudSkinOf((vs.k >= 0.5 ? turnAt.b : turnAt.a) || viewId.value, renderer.fineUnit() > 0)
  const s = state
  const key = touchUI.value ? null : 'M'
  const blink = reduced ? 0 : Math.floor(nowMs / 400) % 2
  const sig = [uDev, skin === NEON_SKIN ? 0 : 3, s.map.id, s.map.version, s.explored?.[s.map.id] ?? '', Math.round(s.hero.x * 8), Math.round(s.hero.y * 8), s.hero.dir, Math.round(e * 200), viewId.value, key, blink].join('|')
  if (sig === mini.sig) return
  mini.sig = sig
  if (cv.width !== MINI_W * 2 * uDev || cv.height !== MINI_H * 2 * uDev) { cv.width = MINI_W * 2 * uDev; cv.height = MINI_H * 2 * uDev }
  const g = cv.getContext('2d')!
  g.setTransform(uDev * 2, 0, 0, uDev * 2, 0, 0)
  g.imageSmoothingEnabled = false
  drawMiniMap(g, WORLD, s, e, skin, key, nowMs / 1000, reduced)
}

/** Each frame, after the dress: the switch as the renderer's turn has it. Draws only when something changed. */
function stepTurnSwitch(nowMs: number) {
  if (!renderer) return
  const vs = renderer.viewState()
  if (vs.dark) { if (turnStage.value !== 'night') turnStage.value = 'night'; return }
  if (turnStage.value === 'night') { turnStage.value = 'dawn'; sw.firstAt = nowMs; sw.tickDue = nowMs + 1200 }
  else if (turnStage.value === 'dawn' && nowMs - sw.firstAt > DAWN_MS) turnStage.value = 'up'
  const e = ease(vs.k)
  const fine = renderer.fineUnit() > 0
  // What changes dress beside the canvas fades out before the flip and in after it, as the canvas HUD does.
  const chrome = fine && (dressWanted || dress16.value) && vs.turning && !vs.waiting ? Math.round(chromeAlpha(e) * 50) / 50 : 1
  if (chrome !== sw.chrome) { sw.chrome = chrome; canvas.value?.parentElement?.style.setProperty('--zelda-chrome-a', String(chrome)) }
  const cv = turnCanvas.value
  const wrap = turnWrap.value
  if (!cv || !wrap) return
  if (sw.el !== cv) { sw.el = cv; sw.sig = ''; sw.unit = ''; sw.width = '' }

  const round = viewList()
  const n = round.length
  const skinOf = (id: ViewId) => hudSkinOf(id, fine)
  const stops = round.map(v => ({ label: n === 2 ? shortTag(v.tag) : '', skin: skinOf(v.id) }))
  const stopOf = (id: ViewId, classic: boolean) => {
    let i = round.findIndex(v => v.id === id)
    if (i < 0) i = round.findIndex(v => (v.engine === 'classic') === classic)
    return Math.max(0, i)
  }
  const a = stopOf(turnAt.a, true)
  const b = stopOf(turnAt.b, false)
  const waiting = vs.waiting || viewId.value !== viewShown
  if (!waiting) sw.waitFrom = -1
  else if (sw.waitFrom < 0) sw.waitFrom = nowMs
  // (A view that is here but paints its map first is waited for over a frame or three: too short to say so.)
  const busy = waiting && nowMs - sw.waitFrom >= WAIT_SHOWN_MS
  if (busy !== turnWaiting.value) turnWaiting.value = busy
  // (Any wait counts as having seen the switch at work, shown or not: a view that then turns in needs no pointing out.)
  if (waiting) sw.sawWaiting = true
  const away = paused.value || panel.value !== null || talking.value || leaving.value
  const reduced = reducedMotion.value
  const here = Math.max(0, round.findIndex(v => v.id === viewId.value))

  // Arriving: the caption names the view, once the turn has seated. A change made while the switch was away is taken in silence.
  if (vs.turning && !vs.waiting) sw.sawTurn = true
  if (!vs.turning && !waiting) {
    if (sw.rest !== null && sw.rest !== viewId.value) {
      turnSaid.value = `${sayView(viewId.value)} view`
      if (!away) {
        turnCaption(captionFor(viewName(viewId.value), here, n, skinOf(viewId.value)), nowMs)
        if (sw.sawTurn) audio?.sfx('select')
      }
    }
    sw.rest = viewId.value
    sw.sawTurn = false
  } else if (sw.rest === null) sw.rest = ''

  // A first visit: the carriage leans toward the other end and comes back, with the view's name under it; once more a while later.
  // (Not over a refusal: NO SIGNAL is read first, 1.6 s lit and 0.3 s fading.)
  if (sw.fresh && sw.captionHot) sw.tickDue = Math.max(sw.tickDue, sw.captionAt + 1900)
  if (sw.fresh && sw.ticks < 2 && !sw.sawWaiting && !away && !vs.turning && !waiting && nowMs >= sw.tickDue && n === 2) {
    sw.ticks++
    sw.tickAt = nowMs
    sw.tickDue = nowMs + 6000
    if (sw.ticks === 1) turnCaption(captionFor(viewName(viewId.value), here, n, skinOf(viewId.value)), nowMs)
  } else if (sw.fresh && away && sw.tickDue < nowMs + 600) sw.tickDue = nowMs + 600

  const toward = (from: number, to: number) => Math.sign(to - from)
  const atB = e >= 0.5
  const ticking = !reduced && nowMs - sw.tickAt < TICK_MS
  const nudge = ticking ? toward(atB ? b : a, atB ? a : b) * tickNudge(nowMs - sw.tickAt)
    : !reduced && nowMs - sw.refuseAt < REFUSE_MS ? toward(a, b) * refuseNudge(nowMs - sw.refuseAt) : 0
  const age = nowMs - sw.captionAt
  const hold = sw.captionHot ? 1600 : CAPTION_MS
  const lit = !sw.caption ? 0 : age < hold ? 3 : reduced ? 0 : age < hold + 150 ? 2 : age < hold + 300 ? 1 : 0
  const st: SwitchState = {
    stops, a, b, e,
    key: touchUI.value ? null : 'V',
    waiting: busy,
    hover: sw.hover,
    down: sw.down || nowMs - sw.downAt < 90,
    nudge,
    flash: ticking ? (atB ? a : b) : -1,
    caption: lit ? sw.caption : '',
    captionLit: lit as 0 | 1 | 2 | 3,
    captionHot: sw.captionHot,
    time: nowMs / 1000,
    reduced,
  }

  // One fine px of the instrument is a whole number of device px, and never under one CSS px.
  const dpr = window.devicePixelRatio || 1
  const uDev = Math.max(Math.round(renderer.fineUnit() * dpr), Math.ceil(dpr))
  const unit = `${uDev / dpr}px`
  if (unit !== sw.unit) { sw.unit = unit; wrap.style.setProperty('--zelda-turn-u', unit) }
  const width = String(switchLayout(st).box.w * 2)
  if (width !== sw.width) { sw.width = width; wrap.style.setProperty('--zelda-turn-w', width) }
  const sig = [uDev, n, a, b, Math.round(e * 400), st.key, fine, round.map(v => +wears16(v.id)).join(''), busy ? Math.floor(st.time * 6) : -1, +st.hover, +st.down, Math.round(nudge * 2), st.flash, st.caption, lit, +sw.captionHot, +reduced].join('|')
  if (sig === sw.sig) return
  sw.sig = sig
  if (cv.width !== SW_W * 2 * uDev || cv.height !== SW_H * 2 * uDev) { cv.width = SW_W * 2 * uDev; cv.height = SW_H * 2 * uDev }
  const g = cv.getContext('2d')!
  g.setTransform(uDev, 0, 0, uDev, 0, 0)
  sw.scratch ??= [document.createElement('canvas'), document.createElement('canvas')]
  drawTurnSwitch(g, st, sw.scratch)
}

/**
 * A press turns the view, as V does. The button never keeps the keyboard: a pointer press does not focus it, and
 * when it has been reached by Tab it owns Enter, Space and Tab only (`data-game-keys` in input.ts gives every
 * other key back to the game, and blurs it).
 */
function turnPress(e: PointerEvent) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  sw.byPointer = true
  sw.down = true
  sw.downAt = performance.now()
  try { turnBtn.value?.setPointerCapture(e.pointerId) } catch { /* the pointer is already gone */ }
  cycleView()
  turnBtn.value?.blur()
}
function turnRelease() {
  sw.down = false
  // The click that follows a press is its own echo; a release off the button has none.
  setTimeout(() => { sw.byPointer = false }, 0)
}
/** Enter or Space on the focused button, or a screen reader's own press. */
function turnClick() {
  if (sw.byPointer) { sw.byPointer = false; return }
  sw.downAt = performance.now()
  cycleView()
}
function turnKey(e: KeyboardEvent) {
  if (e.repeat && (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space')) e.preventDefault()
}
function turnHover(e: PointerEvent, on: boolean) {
  sw.hover = on && e.pointerType === 'mouse'
}

/** Ending, pause-screen and pause keys; the game keys are input.ts's. */
function shellKey(e: KeyboardEvent): boolean {
  if (phase.value === 'won') {
    if (CONTINUE_KEYS.has(e.code) && !e.repeat) { e.preventDefault(); keepExploring() }
    return true
  }
  if (paused.value && !e.repeat) {
    if (confirmReset.value) {
      // Y only: Enter and Space are A, and an A mashed through the machine's lines must not answer.
      if (e.code === 'KeyY') { e.preventDefault(); resetRun(); return true }
      if (e.code === 'KeyN' || e.code === 'Backspace') { e.preventDefault(); cancelReset(); return true }
    } else if (e.code === 'KeyT') { e.preventDefault(); toTown(); return true }
    else if (e.code === 'KeyO') { e.preventDefault(); toggleSound(); return true }
    else if (e.code === 'KeyC' && menuPage.value === 'map') { e.preventDefault(); toggleCorner(); return true }
  }
  // Backspace backs out of lines that lead somewhere, like B.
  if (e.code === 'Backspace' && !paused.value && backsOut()) { e.preventDefault(); if (!e.repeat) input.pressB(); return true }
  // V is the quick way to the next view, in play and on the pause screen (which also has it as a button).
  if (e.code === 'KeyV' && !confirmReset.value) { e.preventDefault(); if (!e.repeat) cycleView(); return true }
  if (e.code === 'KeyP') { e.preventDefault(); if (!e.repeat) openPage('items'); return true }
  if (e.code === 'KeyM' && !confirmReset.value) { e.preventDefault(); if (!e.repeat) openPage('map'); return true }
  // Nothing to swap: Tab keeps its job and reaches the page's link index.
  if (e.code === 'Tab' && !hasItem.value) return true
  return false
}

/** The open lines lead out of the world (a cabinet, a door out, the NEW GAME machine): B, Backspace and an Escape tap back out. */
function backsOut() {
  const after = state.dialog?.after
  return state.mode === 'dialog' && !!(after?.exit || after?.startOver)
}

function pressA() { input.pressA() }
function releaseA() { input.releaseA() }
function pressB() { input.pressB() }
function cycle() { input.cycle() }

// ---- where to start -------------------------------------------------------------

function readReturn(): Spot | null {
  try {
    const raw = sessionStorage.getItem(RETURN_KEY)
    if (!raw) return null
    const r = JSON.parse(raw) as { map?: unknown; entry?: unknown } | null
    return r && typeof r === 'object' ? worldStartingAt(r.map, r.entry)?.start ?? null : null
  } catch { return null }
}

function writeReturn(map: string, entry: string) {
  try { sessionStorage.setItem(RETURN_KEY, JSON.stringify({ map, entry })) } catch { /* private mode: start at the plaza next time */ }
}

/** Back on the plaza on purpose (to town, start over, a new quest): a reload stays there too. */
function clearReturn() {
  try { sessionStorage.removeItem(RETURN_KEY) } catch { /* ignore */ }
}

/** A new state at `at` from `save` (items, hearts, flags, play time); the bits are the wallet's. */
function begin(save: SaveData | null, at: Spot, banner = false) {
  loadedSave = save
  pendingPull = null
  state = createGame(WORLD, { save, at, seed: Date.now() >>> 0, session: signedIn })
  prefetch.near(state.map.id)
  // Before the prism only in development: out there it would empty the woods at noon for anyone.
  if (askedHour !== null && (import.meta.dev || state.inv.prism)) setDaytime(WORLD, state, askedHour)
  purse.adopt(state.inv, state.flags)
  input.clear()
  paused.value = false
  confirmReset.value = false
  panel.value = null
  hitStopMs = 0
  lowHpT = 0
  stuckT = 0
  leavingUrl = false
  ui.banner = banner ? { text: state.area, t: 0 } : null
  if (unlocked) audio?.pause(false)
  syncDeck()
  playTrack(trackFor(state))
  setPhase('play')
  lastT = 0
}

/** The profile had a newer save than this browser: rebuild on it, keeping the hero where they stand. */
function applyPull(save: SaveData | null) {
  const old = state
  begin(save, old.entry)
  if (state.map.id === old.map.id && state.zoneIndex === old.zoneIndex) {
    const h = state.hero
    h.x = old.hero.x
    h.y = old.hero.y
    h.dir = old.hero.dir
    h.safe = { ...old.hero.safe }
    h.auto = null
  }
}

function sameSave(a: SaveData | null, b: SaveData | null): boolean {
  const key = (s: SaveData | null) => (s ? JSON.stringify({ ...s, savedAt: 0 }) : 'null')
  return key(a) === key(b)
}

async function syncProfile() {
  const pulled = await syncWithProfile(profileSave, () => ownsSave || !alive)
  if (pulled && alive && !ownsSave && !sameSave(pulled.save, loadedSave)) pendingPull = pulled
}

// ---- phases, saves --------------------------------------------------------------

function setPhase(p: Phase) {
  if (phase.value !== p) {
    phase.value = p
    emit('phase', p)
  }
  resize()
}

/** Saves here and on the player's profile (the first save creates the player) — once the hero has the blade. */
function persist() {
  if (!state.inv.sword) return
  const save = toSave(state)
  if (!save) return
  save.savedAt = Date.now()
  writeLocalSave(save)
  profileSave.push({ data: save, savedAt: save.savedAt })
  ownsSave = true
  pendingPull = null
}

/** Drops the save here and, if this browser has a player, on the profile. */
function dropSave(extra: { best?: number, won?: boolean } = {}) {
  const had = readLocalSave() !== null
  const at = Date.now()
  clearLocalSave(at)
  if (extra.won || (had && profileSave.hasPlayer())) profileSave.push({ data: null, savedAt: at, ...extra })
  ownsSave = true
  pendingPull = null
}

function syncDeck() {
  const pad = itemIconName(WORLD, state)
  if (pad !== padItem.value) padItem.value = pad
  const item = useItems(state, WORLD).length > 0
  if (item !== hasItem.value) hasItem.value = item
  if (leaving.value !== (state.mode === 'exit')) leaving.value = state.mode === 'exit'
  if (talking.value !== (state.mode === 'dialog')) {
    talking.value = state.mode === 'dialog'
    // The floating A unmounts under the finger; its pointerup never comes.
    if (talking.value) releaseA()
  }
}

/** Where the engine's `exit` leads. The save is written first; the component unmounts on the way out. */
function leave(id: string, to: ExitTarget) {
  persist()
  input.clear()
  // Nothing in the world leads `home` any more; if something does, it is the plaza.
  // `reset` and `panel` never get here (the engine turns them into `startOver` and `panel`).
  if ('home' in to || 'reset' in to || 'panel' in to) { begin(toSave(state), WORLD.start, true); return }
  writeReturn(state.map.id, id)
  if ('theme' in to) launch(to.theme)
  // Installed, a game on another address stays on this page, in a frame: no browser bar over it.
  else if (enterFrame(id)) return
  else { leavingUrl = true; window.location.assign(to.url) }
}

/** The visitor is (or is no longer) logged in: the VIP hall's rope goes down or up. */
function applySession(on: boolean) {
  const first = on && !signedIn
  signedIn = on
  setSession(WORLD, state, on)
  // Signed in through the console just now: link the profile, then bring its save in.
  if (first && !linkedUser) void checkSession().then(() => syncProfile())
}

/** Asks auth.phareim.no who this browser is. Offline counts as nobody, and leaves the rope as it was. */
async function checkSession() {
  const s = await fetchSession()
  const needLink = s.state === 'in' && linkedUser !== s.user.id
  if (needLink) linkedUser = s.user.id // before applySession, which links a first sign-in itself
  if (alive && s.state !== 'offline') applySession(s.state === 'in')
  // Signed in: this browser plays as the account from here on. Another account's local copies are gone then, and
  // the page starts again on a clean slate.
  if (alive && needLink && s.state === 'in' && (await linkAccount(s.user)) === 'switched') window.location.reload()
}

/** The login console, the NEW LOOK stall or the newsstand was used: open its panel over the still world. */
function openPanel(id: string, p: PanelId) {
  if (phase.value !== 'play' || paused.value) return
  // The viewfinder on the square opens nothing: it turns the world to its next view.
  if (p === 'view') { cycleView(); return }
  panelExit = id
  panel.value = p
  slowT = 0
  input.clear()
  audio?.sfx('menu')
}

function closePanel() {
  if (!panel.value) return
  panel.value = null
  input.clear()
  audio?.sfx('menu')
}

/** LOG IN / CREATE ACCOUNT: save, come back in front of the console, and load the auth page. */
function leaveForPanel(url: string) {
  persist()
  input.clear()
  if (panelExit) writeReturn(state.map.id, panelExit)
  // Closed first, so a return through the page cache finds the town, not a stale panel.
  panel.value = null
  window.location.assign(url)
}

/** An exit that did not navigate: step back out in front of it, carrying everything. */
function comeBack() {
  begin(toSave(state), readReturn() ?? WORLD.start)
}

function trackFor(s: GameState): TrackId {
  const def = mapInfo(WORLD, s.map.id).def
  if (def.areas) {
    const h = s.hero
    const a = def.areas.find(r => h.x >= r.x && h.x < r.x + r.w && h.y >= r.y && h.y < r.y + r.h)
    return a?.track ?? def.track
  }
  if (def.cell) {
    const cols = Math.ceil(def.rows[0]!.length / def.cell.w)
    const key = `${s.zoneIndex % cols},${Math.floor(s.zoneIndex / cols)}`
    return def.cells?.[key]?.track ?? def.track
  }
  return def.track
}

// ---- audio ---------------------------------------------------------------------------

function playTrack(t: TrackId | null) {
  if (t === track) return
  track = t
  if (unlocked) audio?.music(t)
}

/** Browsers keep audio asleep until a key or tap; the first one wakes it and starts the music. */
function onFirstGesture() {
  if (unlocked) return
  unlocked = true
  audio?.unlock()
  sound.unlock()
  audio?.music(track)
  window.removeEventListener('keydown', onFirstGesture, true)
  window.removeEventListener('pointerdown', onFirstGesture, true)
}

// ---- pause menu -------------------------------------------------------------------

/** An Escape tap: backs out of a cabinet's (or any exit's) lines, else pauses. */
function escTap() {
  if (phase.value === 'play' && !paused.value && backsOut()) { input.pressB(); return }
  togglePause()
}

/**
 * P, M, the pause chip, the corner map: the menu on that page. The key of the page already open closes the menu;
 * the other one turns the page.
 */
function openPage(page: 'items' | 'map') {
  if (phase.value !== 'play') return
  if (confirmReset.value) { cancelReset(); return }
  if (!paused.value) { togglePause(page); return }
  if (menuPage.value === page) { togglePause(); return }
  menuPage.value = page
  pausedDrawn = false
  audio?.sfx('select')
}

/** The corner map on or off, kept in this browser. */
function toggleCorner() {
  cornerMap.value = !cornerMap.value
  try { localStorage.setItem(CORNER_KEY, cornerMap.value ? 'on' : 'off') } catch { /* private mode: this visit only */ }
  pausedDrawn = false
  audio?.sfx('select')
}

/** Stops the world on the menu's `page`, or sets it going again. */
function togglePause(page: 'items' | 'map' = 'items') {
  if (phase.value !== 'play') return
  // P or an Escape tap while asking "start over?" means no.
  if (confirmReset.value) { cancelReset(); return }
  if (!paused.value) menuPage.value = page
  paused.value = !paused.value
  pausedDrawn = false
  slowT = 0
  input.clear()
  audio?.sfx('menu')
  audio?.pause(paused.value)
}

/** Pause menu: game sound on or off (the watcher on `sound.muted` tells the audio module). */
function toggleSound() {
  sound.toggleMute()
  pausedDrawn = false
}

/** The NEW GAME machine's lines closed: stop the world and ask. */
function askReset() {
  if (phase.value !== 'play') return
  paused.value = true
  confirmReset.value = true
  askedAt = performance.now()
  input.clear()
  audio?.pause(true)
}

/** No: back to the world, standing at the machine. */
function cancelReset() {
  confirmReset.value = false
  paused.value = false
  input.clear()
  audio?.sfx('menu')
  audio?.pause(false)
}

/** Throws the run away — here and on the profile — and begins again on the plaza. Best time stays. */
function resetRun() {
  if (phase.value !== 'play' || !confirmReset.value || performance.now() - askedAt < RESET_GRACE_MS) return
  dropSave()
  clearReturn()
  begin(null, WORLD.start, true)
}

/** Save and quit, LTTP style: back on the plaza with everything the hero carries, hearts full. */
function toTown() {
  if (phase.value !== 'play') return
  persist()
  clearReturn()
  begin(toSave(state), WORLD.start, true)
}

function finishWon() {
  // The run is kept: the world stays, the prism in hand. Starting over is the player's call (pause menu).
  const save = toSave(state)
  if (save) {
    save.savedAt = Date.now()
    writeLocalSave(save)
    profileSave.push({ data: save, savedAt: save.savedAt, best: state.elapsed, won: true })
    ownsSave = true
    pendingPull = null
  }
  input.clear()
  playTrack('ending')
  const prev = readLocalBest()
  const best = prev === null || state.elapsed < prev ? state.elapsed : prev
  if (best !== prev) writeLocalBest(best)
  wonAt = performance.now()
  setPhase('won')
  emit('result', { elapsed: state.elapsed, best })
}

/** From the ending: back into the world, where the prism was taken. */
function keepExploring() {
  if (phase.value !== 'won' || performance.now() - wonAt < WON_GRACE_MS) return
  resumeAfterWin(state)
  input.clear()
  setPhase('play')
  track = null
  playTrack(trackFor(state))
}

// ---- events → sound, save, banner ----------------------------------------------

const BIG_FOES = new Set(['king', 'knight', 'llama', 'mistral', 'deepseek', 'gemini'])

const SFX: Partial<Record<GameEvent['type'], SfxName>> = {
  swing: 'sword', spin: 'spin', charged: 'charge', clank: 'clank', hurt: 'hurt', shock: 'shock',
  cut: 'cut', shatter: 'shatter', lift: 'lift', throw: 'throw', unlock: 'unlock', gate: 'gate',
  choose: 'select', back: 'menu',
  plate: 'plate', crystal: 'crystal', push: 'push', bombPlace: 'bombPlace', boom: 'boom', disc: 'disc',
  discHit: 'discHit', fall: 'fall', reflect: 'reflect', warp: 'stairs', text: 'text', talk: 'select',
  error: 'error', cycle: 'select', died: 'die', bossPhase: 'bossRoar',
  hook: 'hook', hookHit: 'hookHit', pull: 'pull', psi: 'psi', glyph: 'glyph', lever: 'lever', land: 'land',
  gust: 'gust', bark: 'bark',
}

function handleEvents(events: GameEvent[]) {
  const a = audio
  let save = false
  for (const e of events) {
    const name = SFX[e.type]
    if (name) a?.sfx(name)
    switch (e.type) {
      case 'hit': a?.sfx(BIG_FOES.has(e.kind) ? 'bossHit' : e.killed ? 'kill' : 'hit'); break
      case 'join': a?.jingle('friend'); save = true; break
      case 'wait': save = true; break
      case 'lever': save = true; break
      // Dig & build: the edit is kept at once.
      case 'dig': a?.sfx(e.verb === 'build' ? 'push' : 'жзийаеrR%'.includes(e.tile) ? 'shatter' : 'cut'); save = true; break
      case 'collect': a?.sfx(e.kind === 'heart' ? 'heart' : e.kind === 'key' ? 'key' : 'coin'); break
      case 'chest': a?.sfx('chest'); break
      case 'itemGet':
        a?.jingle(e.item === 'prism' ? 'fanfare' : e.item === 'heartPiece' || e.item === 'heartContainer' ? 'heartPiece' : 'item')
        save = true
        break
      case 'secret': a?.jingle('secret'); save = true; break
      case 'shoot': a?.sfx(e.kind === 'laser' ? 'laser' : 'pellet'); break
      case 'buy': if (!e.ok) a?.sfx('error'); break
      case 'bossDown': a?.sfx('bossDie'); a?.jingle('fanfare'); save = true; break
      case 'unlock': case 'gate': save = true; break
      case 'enter':
        save = true
        prefetch.near(state.map.id)
        ui.banner = { text: e.area, t: 0 }
        playTrack(e.track)
        break
      case 'area':
        ui.banner = { text: e.name, t: 0 }
        playTrack(e.track)
        break
      case 'scroll': break
      case 'respawn': save = true; break
      case 'died': a?.jingle('gameOver'); break
      case 'hitStop': if (!reducedMotion.value) hitStopMs = Math.max(hitStopMs, e.ms); break
      case 'exit': leave(e.id, e.to); return
      case 'startOver': askReset(); break
      case 'panel': openPanel(e.id, e.panel); break
      // Field battles: their music, the turn's blip, the win's jingle.
      case 'battle':
        if (e.what === 'start') { a?.sfx('charge'); playTrack(e.track ?? 'boss') }
        else if (e.what === 'turn') a?.sfx('select')
        else if (e.what === 'won' || e.what === 'fled') { if (e.what === 'won') a?.jingle(e.boss ? 'fanfare' : 'secret'); else a?.sfx('menu'); playTrack(trackFor(state)); save = true }
        break
    }
  }
  if (save) persist()
}

// ---- loop -------------------------------------------------------------------------

/** Redraw at most this often for a picture that is only softly animating. */
const SLOW_MS = 200
let slowT = 0

/** True when a soft-animation redraw is due this frame. */
function slowTick(nowMs: number) {
  if (nowMs - slowT < SLOW_MS) return false
  slowT = nowMs
  return true
}

/** The shell's dress and switch were last stepped while a view was waited for. */
let steppedWaiting = false

/**
 * Draw. A view that was waited for and took over in that draw without a turn (reduced motion, a pause, a panel,
 * the ending) is on screen now: the dress and the switch follow in the same frame, not the next one. A view that
 * threw in that draw was put away: the shell follows to the classic view in this frame too (`viewFailed`), so
 * the dress and the switch that were stepped for it before the draw are never painted.
 */
function drawFrame(nowMs: number, dt: number) {
  if (!renderer) return
  renderer.draw(state, ui, dt)
  const vs = renderer.viewState()
  if (vs.failed !== failedSeen) { failedSeen = vs.failed; viewFailed(); steppedWaiting = false; stepDress(vs); stepTurnSwitch(nowMs); return }
  if (steppedWaiting && !vs.waiting && !vs.turning) { steppedWaiting = false; stepDress(vs); stepTurnSwitch(nowMs) }
}

function frame(nowMs: number) {
  raf = requestAnimationFrame(frame)
  if (!renderer) return
  const dt = lastT ? Math.min((nowMs - lastT) / 1000, 0.1) : 0
  lastT = nowMs

  // Nothing is on screen to change while the tab is in the background, and a
  // backgrounded phone may still be running this loop (2026-09-30).
  if (document.hidden) return
  if (!nightFrom) nightFrom = performance.now()
  // (A slow network must not keep the page dark: after the night the classic view plays until the code is here.)
  if (viewHold) { if (nightLeft() > 0) return; viewHold = false; syncDress() }
  { const f = renderer.viewState().failed; if (f !== failedSeen) { failedSeen = f; viewFailed() } }
  // A visit's first dark moments: the view is on its way (`arrive`), and nothing steps until there is a picture.
  if (renderer.viewState().dark) { renderer.draw(state, ui, 0); return }
  // A turn caught by a pause, a panel or the ending would hang half done (the world is drawn once, or five times a
  // second): finish it. The picture follows in this frame, not at the next slow tick, and a view that threw being
  // asked is followed before the dress and the switch are stepped for it.
  if ((paused.value || panel.value || phase.value === 'won') && renderer.viewState().turning) {
    renderer.setView(viewDef(viewId.value)?.engine ?? 'classic', true)
    pausedDrawn = false
    if (!renderer.viewState().turning) slowT = 0
    const f = renderer.viewState().failed
    if (f !== failedSeen) { failedSeen = f; viewFailed() }
  }
  steppedWaiting = renderer.viewState().waiting
  stepDress(renderer.viewState())
  syncUnit()
  stepTurnSwitch(nowMs)
  stepMiniMap(nowMs)

  ui.paused = paused.value
  ui.page = menuPage.value
  ui.corner = cornerMap.value
  ui.turn = renderer.viewState().turn
  ui.confirmReset = confirmReset.value
  ui.muted = sound.muted.value
  ui.reducedMotion = reducedMotion.value
  ui.touch = touchUI.value
  ui.keys = touchUI.value ? TOUCH_KEYS : KEYBOARD_KEYS
  ui.stick = input.stick
  ui.view = viewLabel.value

  // The ending: the world stays put behind the page's panel. Nothing steps, so
  // it is redrawn at a fifth of the rate rather than 60 times a second.
  if (phase.value === 'won') { if (slowTick(nowMs)) drawFrame(nowMs, reducedMotion.value ? 0 : dt); return }
  // Paused: dt is 0, so the picture is already identical to last frame's. Draw
  // it once more in case the pause was what changed it, then leave the pixels
  // alone until something resumes.
  // (A first picture still coming up out of the dark is drawn until it is up.)
  if (paused.value) { if (!pausedDrawn || renderer.viewState().dawn) { pausedDrawn = true; drawFrame(nowMs, 0) } return }
  pausedDrawn = false
  // A panel is open: the world stands still but keeps glowing. A soft glow at
  // a fifth of the rate is the same glow.
  if (panel.value) { if (slowTick(nowMs)) drawFrame(nowMs, reducedMotion.value ? 0 : dt); return }
  if (hitStopMs > 0) { hitStopMs -= dt * 1000; drawFrame(nowMs, 0); return }
  if (pendingPull && state.mode === 'play') applyPull(pendingPull.save)

  // The controls turn with the picture: up on the stick is up on the screen in every view.
  const raw = input.read()
  // Not in a dialog: there a direction picks YES or NO by its sign, whichever way the picture faces.
  // (Nor in a field battle, where up and down move the cursor; a tap there is a pick on the overlay.)
  const turn = state.mode === 'dialog' || state.mode === 'battle' ? 0 : renderer.viewState().turn
  const inp = turn ? { ...raw, move: turnMove(raw.move, turn) } : raw
  if (raw.tap && state.mode === 'battle') inp.pick = renderer.battlePick(raw.tap.x, raw.tap.y) ?? { none: true }
  if (!moved && (inp.move.x !== 0 || inp.move.y !== 0)) { moved = true; emit('moved') }
  // What the screen shows, so the woods' foes come and go past its edge (the turned view shows a diamond of the ground).
  const vt = renderer.viewTiles()
  state.sight = { x: vt.w, y: vt.h, turned: turn !== 0 }
  const events = stepGame(WORLD, state, dt, inp)
  purse.step(state.inv, state.flags)
  renderer.onEvents(events)
  handleEvents(events)
  if (state.map.id !== fitMap) fitView()
  if (ui.banner) { ui.banner.t += dt; if (ui.banner.t > 2.2) ui.banner = null }
  syncDeck()
  if (state.hero.hp > 0 && state.hero.hp <= 2 && state.mode === 'play') {
    lowHpT -= dt
    if (lowHpT <= 0) { audio?.sfx('lowHp'); lowHpT = 1.2 }
  }
  if (state.mode === 'exit') {
    stuckT += dt
    if (stuckT > (leavingUrl ? STUCK_URL_S : STUCK_S)) comeBack()
  }
  drawFrame(nowMs, dt)
  if (state.mode === 'won') finishWon()
}

/**
 * The hero wears the newest choice: the look from the NEW LOOK stall, until
 * the made figure (Lag Din Figur's, else Mini World's active person) is
 * changed after it; then the figure's colours, and the look is forgotten.
 * With neither: its own clothes.
 */
function dressHero() {
  let look = null
  let colors = null
  try {
    colors = parseHeroColors(localStorage.getItem(FIGUR_HERO_KEY)) ?? parseHeroColors(localStorage.getItem(HERO_COLORS_KEY))
    const raw = localStorage.getItem(HERO_LOOK_KEY)
    look = wornLook(raw, colors)
    // A figure made over since: the stall's look is the older choice now, for good.
    if (raw !== null && !look) localStorage.removeItem(HERO_LOOK_KEY)
  } catch { /* private mode: as drawn */ }
  heroLook.value = look
  figureColors.value = colors
  renderer?.setHeroColors(colors)
  renderer?.setHeroLook(look)
}

/** WEAR IT at the stall: keep the look on this browser (null: back to the made figure's clothes) and put it on. */
function wearLook(look: HeroLook | null) {
  try {
    if (look) localStorage.setItem(HERO_LOOK_KEY, storeHeroLook(look, figureColors.value))
    else localStorage.removeItem(HERO_LOOK_KEY)
  } catch { /* private mode: worn until the page goes */ }
  dressHero()
  // Storage refused the write: wear it anyway for as long as the page lives.
  if (look && !heroLook.value) { heroLook.value = look; renderer?.setHeroLook(look) }
  closePanel()
  audio?.sfx('chest')
}

function onStorage(e: StorageEvent) {
  if (e.key === HERO_LOOK_KEY || e.key === FIGUR_HERO_KEY || e.key === HERO_COLORS_KEY || e.key === null) dressHero()
}

function onVisibility() {
  if (!document.hidden) dressHero()
  if (document.hidden) {
    input.clear()
    if (phase.value === 'play') {
      // Phones kill background tabs: keep the play time up to now.
      persist()
      // With the blade there is danger about, so the run waits; before it the town just goes quiet.
      if (state.inv.sword && !paused.value && !panel.value) togglePause()
    }
  }
  if (unlocked) audio?.pause(document.hidden || paused.value)
  lastT = 0
}

/** Back from a URL exit through the browser's page cache: the world is still dark, so step back out. */
function onPageShow(e: PageTransitionEvent) {
  if (e.persisted && state.mode === 'exit') comeBack()
  // Back from the auth page through the page cache: the login may have changed.
  if (e.persisted) void checkSession()
  lastT = 0
}

function resize() {
  if (!canvas.value || !renderer) return
  const w = canvas.value.clientWidth
  const h = canvas.value.clientHeight
  renderer.resize(w, h, canvasPixelRatio(3), safeInsets())
  syncUnit()
}

/** The screen's safe-area insets in CSS px (all 0 in an ordinary browser tab). */
function safeInsets() {
  const cs = safeProbe.value ? getComputedStyle(safeProbe.value) : null
  const px = (v?: string) => parseFloat(v ?? '') || 0
  return { top: px(cs?.paddingTop), right: px(cs?.paddingRight), bottom: px(cs?.paddingBottom), left: px(cs?.paddingLeft) }
}

let observer: ResizeObserver | null = null
let muteStop: (() => void) | null = null
let liveStop: (() => void) | null = null
let walletStop: (() => void) | null = null

onMounted(() => {
  if (!canvas.value) return
  alive = true
  // The studio's published art over the drawn sprites, before the first frame (render/live.ts).
  liveStop = startLiveSprites({
    search: location.search,
    storage: (() => { try { return localStorage } catch { return null } })(),
    onApplied: (art) => {
      iconCache.clear()
      artVersion.value++
      swordIcon.value = iconUrl('item_sword')
      swapIcon.value = iconUrl('hud_swap')
      applyLiveViews(art.views)
    },
  })
  swordIcon.value = iconUrl('item_sword')
  swapIcon.value = iconUrl('hud_swap')
  reducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  try {
    touchUI.value = window.matchMedia('(hover: none) and (pointer: coarse)').matches
  } catch { touchUI.value = false }
  // The home page owns every key: arrows walk the hero, Escape pauses.
  navigationLocked.value = true
  renderer = createRenderer(canvas.value, WORLD)
  // The view the address asks for (?view=classic), the one this browser chose last, or the site's first: the 16-bit one.
  let lastView: string | null = null
  try { lastView = localStorage.getItem(VIEW_KEY) } catch { /* private mode */ }
  try { cornerMap.value = localStorage.getItem(CORNER_KEY) !== 'off' } catch { /* private mode: on */ }
  const firstView = startView(new URLSearchParams(location.search).get('view'), lastView)
  // The dress of the view the visit starts in, before its first frame: nothing of the other look flashes by either.
  dressWanted = wears16(firstView)
  dress16.value = dressWanted
  viewId.value = firstView
  // The first picture comes up out of the dark, whichever view draws it.
  renderer.dawn()
  // A browser that has never chosen a view and has not walked here before: the turn switch ticks for it.
  try { sw.fresh = lastView === null && !new URLSearchParams(location.search).get('view') && !sessionStorage.getItem(RETURN_KEY) } catch { sw.fresh = false }
  if (firstView !== 'classic') {
    viewHold = true
    const release = () => { viewHold = false }
    void showView(firstView, false, false, true).then(release, release)
  }
  void loadHighScoreSign()
  audio = createZeldaAudio()
  // A view that was shown before the sound existed still gets its chip.
  syncSound()
  // The world plays its own music; the radio (and its hidden widget) stays quiet here.
  audio.holdRadio()
  muteStop = watch(sound.muted, (m: boolean) => audio?.setMuted(m), { immediate: true })
  dressHero()
  // Bits carried by a save from before the wallet move into it, once per browser.
  const local = readLocalSave()
  try { migrateSaveBits(local, localStorage, walletApi) } catch { /* no storage: nothing to move */ }
  // Start at once on this browser's save; the profile's copy may replace it in a moment.
  begin(local, readReturn() ?? WORLD.start)
  walletStop = onWalletChange(b => purse.external(state.inv, b))
  // The session first (a signed-in visitor plays under the account's profile), then the profile's save.
  void checkSession().then(() => syncProfile())
  resize()
  // (The page's hint may come up now: its dress and its unit are the real ones.)
  canvas.value.parentElement?.style.setProperty('--zelda-hint-play', 'running')
  observer = new ResizeObserver(resize)
  observer.observe(canvas.value)
  window.addEventListener('resize', resize)
  input.attach()
  window.addEventListener('keydown', onFirstGesture, true)
  window.addEventListener('pointerdown', onFirstGesture, true)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pageshow', onPageShow)
  window.addEventListener('storage', onStorage)
  raf = requestAnimationFrame(frame)
  // Dev-only handle for the headless checks in scripts/zelda-lab (either name).
  if (import.meta.dev) {
    const handle = { get state() { return state }, get world() { return WORLD }, get phase() { return phase.value } }
    const w = window as unknown as { __zelda: unknown; __portal: unknown }
    w.__zelda = handle
    w.__portal = handle
  }
})

onBeforeUnmount(() => {
  alive = false
  canvas.value?.parentElement?.style.removeProperty('--px16-fine')
  canvas.value?.parentElement?.style.removeProperty('--zelda-chrome-a')
  canvas.value?.parentElement?.style.removeProperty('--zelda-hint-play')
  liveStop?.()
  liveStop = null
  prefetch.stop()
  cancelAnimationFrame(raf)
  observer?.disconnect()
  muteStop?.()
  walletStop?.()
  window.removeEventListener('storage', onStorage)
  window.removeEventListener('resize', resize)
  input.detach()
  window.removeEventListener('keydown', onFirstGesture, true)
  window.removeEventListener('pointerdown', onFirstGesture, true)
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('pageshow', onPageShow)
  if (phase.value === 'play') persist()
  audio?.dispose()
  audio = null
  // The 16-bit view holds a GPU context: give it back now, not when the collector gets round to it.
  renderer?.dispose()
  renderer = null
  navigationLocked.value = false
})
</script>

<style>
.zelda-canvas {
  display: block;
  width: 100%;
  height: 100%;
  background: #0b0616;
  touch-action: none;
  image-rendering: pixelated;
}

/* Paused before the first step: the page's hint (portal/Landing.vue, after the canvas) would lie on the pause screen's key line. */
.zelda-canvas--paused ~ .portal-hint {
  visibility: hidden;
}

.zelda-safe {
  position: fixed;
  inset: 0;
  visibility: hidden;
  pointer-events: none;
  padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) var(--app-safe-bottom, 0px) env(safe-area-inset-left, 0px);
}

.zelda-deck {
  box-sizing: border-box;
  position: absolute;
  right: 0;
  bottom: 0;
  z-index: 5;
  pointer-events: none;
  display: flex;
  align-items: flex-end;
  gap: 12px;
  padding: 0 calc(14px + env(safe-area-inset-right, 0px)) calc(14px + var(--app-safe-bottom, 0px));
  /* Neon Shrine's letters and hard edges; round pads, like a SNES pad. */
  font-family: var(--font-pixel);
  -webkit-font-smoothing: none;
}

/* The pause buttons sit centred across the bottom. */
.zelda-deck--paused {
  left: 0;
  justify-content: center;
}

/*
 * The corner: top-right, clear of the notch and the status bar. The pause chip and the turn switch, and under
 * them, right edges in line, the map. Its unit is one fine px of the canvas HUD (`--zelda-turn-u`, written by
 * `stepMiniMap` here and by `stepTurnSwitch` on the switch), so the map's pixels and the switch's are the HUD's.
 */
.zelda-corner {
  --zelda-turn-u: 1px;
  position: absolute;
  top: calc(14px + env(safe-area-inset-top, 0px));
  right: calc(14px + env(safe-area-inset-right, 0px));
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  /* (Room under the switch for the name it shows after a turn.) */
  gap: calc(16 * var(--zelda-turn-u));
  transition: opacity 120ms steps(3), visibility 0s;
}
.zelda-corner-row {
  display: flex;
  align-items: flex-start;
  gap: calc(6 * var(--zelda-turn-u));
}
/* Away (the menu, a dialog, a panel, a way out): it steps out, and is not there to be pressed or read. */
.zelda-corner--away {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 120ms steps(3), visibility 0s 120ms;
}
/* A visit's dark first moments, and the first picture coming up out of them (the renderer's dawn is the same curve). */
.zelda-corner--night {
  opacity: 0;
  transition: none;
}
.zelda-corner--dawn {
  transition: opacity 320ms cubic-bezier(0.5, 1, 0.89, 1);
}
/* The corner map: a canvas in a real button, the HUD's pixels. */
.zelda-mini {
  position: relative;
  display: block;
  width: calc(112 * var(--zelda-turn-u));
  height: calc(80 * var(--zelda-turn-u));
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: none;
  cursor: pointer;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
  opacity: var(--zelda-chrome-a, 1);
}
.zelda-mini:focus { outline: none; }
.zelda-mini:focus-visible {
  outline: calc(2 * var(--zelda-turn-u)) solid #ffd23f;
  outline-offset: calc(2 * var(--zelda-turn-u));
}
.zelda-mini-canvas {
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
  image-rendering: pixelated;
}
/* Beside a keyboard the chip is the switch's height; on touch never smaller than a thumb. */
.zelda-corner .zelda-chip {
  min-width: calc(28 * var(--zelda-turn-u));
  min-height: calc(28 * var(--zelda-turn-u));
  font-size: calc(10 * var(--zelda-turn-u));
  cursor: pointer;
  opacity: var(--zelda-chrome-a, 1);
}
.zelda-corner--touch .zelda-chip {
  min-width: max(52px, calc(40 * var(--px16-fine, 1px)));
  min-height: max(44px, calc(28 * var(--px16-fine, 1px)));
  font-size: 16px;
}

/*
 * The turn switch, beside the pause chip. The picture is a canvas inside a real button; it hangs out under the
 * button (the caption's line) and to its left, where nothing is pressed.
 */
.zelda-turn-wrap {
  position: relative;
}
.zelda-turn {
  position: relative;
  display: block;
  width: calc(var(--zelda-turn-w, 102) * var(--zelda-turn-u));
  height: max(44px, calc(40 * var(--zelda-turn-u)));
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: none;
  cursor: pointer;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.zelda-turn:focus { outline: none; }
.zelda-turn:focus-visible {
  outline: calc(2 * var(--zelda-turn-u)) solid #ffd23f;
  outline-offset: calc(2 * var(--zelda-turn-u));
  box-shadow: 0 0 0 calc(6 * var(--zelda-turn-u)) #0b0616;
}
/* A thumb's slop, down only: the pause chip stands left of it. */
.zelda-turn-wrap--touch .zelda-turn::before {
  content: '';
  position: absolute;
  inset: 0 0 -8px 0;
}
.zelda-turn-canvas {
  position: absolute;
  right: 0;
  top: calc((100% - 40 * var(--zelda-turn-u)) / 2);
  width: calc(176 * var(--zelda-turn-u));
  height: calc(60 * var(--zelda-turn-u));
  pointer-events: none;
  image-rendering: pixelated;
}
.zelda-turn-said {
  position: absolute;
  /* (At a place of its own: left where the page's flow puts it, it lies under the stage and makes it a px taller.) */
  top: 0;
  left: 0;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
/* What changes dress beside the canvas goes out before the flip and comes back after it (`--zelda-chrome-a`, `stepTurnSwitch`). */
.zelda-canvas ~ .portal-hint {
  filter: opacity(var(--zelda-chrome-a, 1));
  /* The hint waits for the page to know its view and its unit (set at mount): before that it would come up in a
     guessed dress at a guessed size, and change both in front of the visitor. */
  animation-play-state: var(--zelda-hint-play, paused);
}
@media (prefers-reduced-motion: reduce) {
  .zelda-corner,
  .zelda-corner--away,
  .zelda-corner--dawn { transition: none; }
}

.zelda-chip {
  /* (One box in both dresses, so nothing beside it moves when the dress changes.) */
  min-width: max(52px, calc(40 * var(--px16-fine, 1px)));
  min-height: max(44px, calc(28 * var(--px16-fine, 1px)));
  border: 0;
  border-radius: 0;
  background: rgba(11, 6, 22, 0.88);
  box-shadow: 0 -2px 0 0 #b9a8d9, 0 2px 0 0 #b9a8d9, -2px 0 0 0 #b9a8d9, 2px 0 0 0 #b9a8d9;
  color: #b9a8d9;
  font-family: var(--font-pixel);
  font-size: 16px;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.zelda-deck-btns {
  position: relative;
  width: 168px;
  height: 142px;
  pointer-events: auto;
}

/* A alone, before the hero has an item. */
.zelda-deck-btns--solo {
  width: 88px;
  height: 88px;
}

.zelda-pad {
  position: absolute;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-family: var(--font-pixel);
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
  background: rgba(11, 6, 22, 0.35);
}

.zelda-pad:active {
  filter: brightness(1.6);
  transform: scale(0.96);
}

.zelda-pad-a {
  right: 0;
  top: 0;
  width: 88px;
  height: 88px;
  border: 4px solid #ff2fa0;
  color: #ff2fa0;
  box-shadow: 4px 4px 0 #0b0616;
}

.zelda-pad-b {
  left: 0;
  bottom: 0;
  width: 72px;
  height: 72px;
  border: 4px solid #2ff3ff;
  color: #2ff3ff;
  box-shadow: 4px 4px 0 #0b0616;
}

/* Swap: the small third button, left of B. */
.zelda-pad-swap {
  position: relative;
  width: 56px;
  height: 56px;
  padding: 0;
  border: 4px solid #b9a8d9;
  box-shadow: 4px 4px 0 #0b0616;
  pointer-events: auto;
}

.zelda-pad-icon {
  position: absolute;
  width: 32px;
  height: 32px;
  image-rendering: pixelated;
  opacity: calc(0.9 * var(--zelda-chrome-a, 1));
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.zelda-pad-icon--big {
  width: 48px;
  height: 48px;
}

.zelda-deck-paused {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 14px;
  max-width: 820px;
  margin: 0 auto;
  pointer-events: auto;
}

.zelda-pad-wide {
  position: static;
  border-radius: 0;
  min-width: 118px;
  min-height: 54px;
  border: 0;
  --edge: #2ff3ff;
  box-shadow: 0 -2px 0 0 var(--edge), 0 2px 0 0 var(--edge), -2px 0 0 0 var(--edge), 2px 0 0 0 var(--edge);
  background: rgba(11, 6, 22, 0.88);
  color: var(--edge);
  font-size: 16px;
}

.zelda-pad-quit {
  --edge: #ff2fa0;
}

/* A phone on its side: the screen is short, so the pads sit lower and more
   side by side, still above the bottom band. */
@media (orientation: landscape) and (max-height: 500px) {
  .zelda-deck:not(.zelda-deck--paused) { padding-bottom: calc(4px + var(--app-safe-bottom, 0px)); }
  .zelda-deck-btns:not(.zelda-deck-btns--solo) { height: 104px; }
}

/* Two wide buttons across a 375 px phone. */
@media (max-width: 440px) {
  .zelda-deck-paused { gap: 6px; }
  .zelda-pad-wide { min-width: 0; flex: 1 1 40%; font-size: 13px; }
  .zelda-pad-wide { min-width: 0; padding: 0 12px; }
}

/*
 * The 16-bit dress: `px16` is on every root above while the isometric view
 * shows its 16-bit windows (`wears16`), and the shell's HTML then speaks the
 * canvas HUD's language: its windows, its font, its icons. The pieces (fills,
 * frames, shade, the letters' colours) and where they come from are in
 * themes/base/pixel/pixel16.css, which also dresses .px-box and .px-btn in
 * the panels. Without the class nothing below applies.
 *
 * What stands beside the canvas HUD takes that HUD's pixel as its unit
 * (`--px16-fine`, kept by `syncUnit`; 1px until it is known), so the letters
 * here and on the canvas are one size on every screen: every length below is
 * so many units. The panels and the ending keep 1 CSS px: they are pages of
 * their own over a dimmed world and must fit a phone.
 */
.px16.zelda-corner,
.px16.zelda-deck,
.px16.esc-hold-layer,
.zelda-canvas.px16 ~ .portal-hint {
  --px16-u: var(--px16-fine, 1px);
}

/* Pause: a plate in the sea green of the item box and the pause screen. Never smaller than a thumb. */
.px16 .zelda-chip {
  min-width: max(52px, calc(40 * var(--px16-u)));
  min-height: max(44px, calc(28 * var(--px16-u)));
  border: calc(3 * var(--px16-u)) solid transparent;
  border-radius: calc(3 * var(--px16-u));
  border-image: var(--px16-frame-cool) var(--px16-cut);
  background: var(--px16-fill-cool) padding-box;
  box-shadow: var(--px16-shade);
  color: var(--px16-text);
  text-shadow: var(--px16-drop);
  font-size: calc(16 * var(--px16-u));
  line-height: calc(16 * var(--px16-u));
}
/* Beside a keyboard, in either dress, the chip stays the switch's height. */
.px16.zelda-corner:not(.zelda-corner--touch) .zelda-chip {
  min-width: calc(28 * var(--zelda-turn-u));
  min-height: calc(28 * var(--zelda-turn-u));
  font-size: calc(10 * var(--zelda-turn-u));
  line-height: calc(10 * var(--zelda-turn-u));
}
.px16 .zelda-chip:active {
  border-image: var(--px16-frame-cool-in) var(--px16-cut);
  box-shadow: var(--px16-inner);
}
/* The round pads keep their rings and their size; their pictures are the HUD's own, at twice the pixels: one CSS px each, two on A. */
.px16 .zelda-pad-icon { opacity: var(--zelda-chrome-a, 1); }
.px16.zelda-turn-wrap .zelda-turn:focus-visible {
  outline-color: var(--px16-prize);
  box-shadow: 0 0 0 calc(6 * var(--zelda-turn-u)) var(--px16-shadow);
}
.px16 .zelda-pad-icon--big {
  width: 64px;
  height: 64px;
}

/*
 * The pause buttons: windows like the pause screen's; the way out in the dialog's blue with pink letters.
 * Four in a row where four fit at this unit, else two rows of two, never three and one: the narrowest a column
 * may be flips from a quarter of the row to half of it when four of the least width no longer fit.
 */
.px16 .zelda-deck-paused {
  --zelda-pad-gap: calc(8 * var(--px16-u));
  --zelda-pad-least: calc(140 * var(--px16-u));
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(clamp(25% - var(--zelda-pad-gap), (var(--zelda-pad-least) * 4 + var(--zelda-pad-gap) * 3 - 100%) * 9999, 50% - var(--zelda-pad-gap)), 1fr));
  gap: var(--zelda-pad-gap);
  width: 100%;
  max-width: calc(760 * var(--px16-u));
}
.px16 .zelda-pad-wide {
  box-sizing: border-box;
  min-width: 0;
  min-height: max(44px, calc(44 * var(--px16-u)));
  padding: 0 calc(6 * var(--px16-u));
  border: calc(3 * var(--px16-u)) solid transparent;
  border-radius: calc(3 * var(--px16-u));
  border-image: var(--px16-frame-cool) var(--px16-cut);
  background: var(--px16-fill-cool) padding-box;
  box-shadow: var(--px16-shade);
  color: var(--px16-text);
  text-shadow: var(--px16-drop);
  font-size: calc(16 * var(--px16-u));
  line-height: calc(16 * var(--px16-u));
}
.px16 .zelda-pad-quit {
  border-image: var(--px16-frame-hot) var(--px16-cut);
  background: var(--px16-fill-hot) padding-box;
  color: var(--px16-hot);
}
/* Pressed: the bevel turns inward and the shadow goes; a window is not scaled or brightened (its pixels would smear). */
.px16 .zelda-pad-wide:active {
  filter: none;
  transform: none;
  border-image: var(--px16-frame-cool-in) var(--px16-cut);
  box-shadow: var(--px16-inner);
}
.px16 .zelda-pad-quit:active { border-image: var(--px16-frame-hot-in) var(--px16-cut); }

/* The page's first hint (portal/Landing.vue) comes after the canvas: a line of dialog, so the dialog box's blue window. */
.zelda-canvas.px16 ~ .portal-hint {
  --font-pixel: var(--font-pixel16);
  /* Centred on whole pixels: half of an odd width would blur these letters. (Where round() is not known the page's own centring stays.) */
  left: round(down, 50%, 1px);
  transform: translateX(round(down, -50%, 1px));
  /* As wide as its line, and on two lines where the screen is narrower than that at this unit. */
  box-sizing: border-box;
  width: max-content;
  max-width: calc(100% - 24px);
  white-space: normal;
  text-align: center;
  text-wrap: balance;
  padding: calc(8 * var(--px16-u)) calc(14 * var(--px16-u));
  border: calc(3 * var(--px16-u)) solid transparent;
  border-radius: calc(3 * var(--px16-u));
  border-image: var(--px16-frame-hot) var(--px16-cut);
  background: var(--px16-fill-hot) padding-box;
  box-shadow: var(--px16-shade);
  color: var(--px16-text);
  text-shadow: var(--px16-drop);
  font-size: calc(16 * var(--px16-u));
  line-height: calc(20 * var(--px16-u));
}

/* The page's ending panel, the same way: the dialog's window, the HUD's colours, its hard shadow under every line. */
.zelda-canvas.px16 ~ .portal-end { --font-pixel: var(--font-pixel16); }
.zelda-canvas.px16 ~ .portal-end .portal-end-panel {
  padding: 22px 28px 24px;
  border: calc(3 * var(--px16-u)) solid transparent;
  border-radius: calc(3 * var(--px16-u));
  border-image: var(--px16-frame-hot) var(--px16-cut);
  background: var(--px16-fill-hot) padding-box;
  box-shadow: var(--px16-shade);
  text-shadow: var(--px16-drop);
}
.zelda-canvas.px16 ~ .portal-end .portal-end-title { line-height: 36px; color: var(--px16-prize); text-shadow: var(--px16-drop); }
.zelda-canvas.px16 ~ .portal-end .portal-end-time { color: var(--px16-cool); text-shadow: var(--px16-drop); }
.zelda-canvas.px16 ~ .portal-end .portal-end-best { color: var(--px16-prize); }
.zelda-canvas.px16 ~ .portal-end .portal-end-start { color: var(--px16-hot); }
.zelda-canvas.px16 ~ .portal-end .portal-end-note { color: var(--px16-dim); }

/* The Escape pill (base/EscHold.vue): its own sizes and colours are scoped to it and would win a tie with .px-box, so they are said again, one class stronger. */
.px16.esc-hold-layer .esc-hold-pill {
  gap: calc(12 * var(--px16-u));
  padding: calc(5 * var(--px16-u)) calc(9 * var(--px16-u));
  background: var(--px16-fill-hot) padding-box;
  color: var(--px16-text);
  text-shadow: var(--px16-drop);
  font-size: calc(16 * var(--px16-u));
  line-height: calc(20 * var(--px16-u));
}
.px16.esc-hold-layer .esc-hold-track {
  width: calc(96 * var(--px16-u));
  height: calc(8 * var(--px16-u));
  background: rgba(6, 8, 44, 0.62);
  box-shadow: 0 0 0 var(--px16-u) #070a2c;
}
.px16.esc-hold-layer .esc-hold-fill {
  background: repeating-linear-gradient(90deg, var(--px16-hot) 0 calc(6 * var(--px16-u)), transparent calc(6 * var(--px16-u)) calc(8 * var(--px16-u)));
}
</style>
