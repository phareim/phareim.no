import { ref, computed, type ComputedRef, type Ref } from 'vue'
import { readStoredPlayer } from '~/composables/useLeaderboard'
import { readWallet, syncWallet } from '~/composables/useWallet'
import { useMiniWorld } from '~/composables/useMiniWorld'
import { cleanCode } from '~/themes/miniworld/core/names'
import type { SocialState, PublicProfile, Gift, Hood, RoyalTitle, HouseLayout, PersonLook } from '~/themes/miniworld/types'
import type { NeighborInfo } from '~/themes/miniworld/scene/contracts'

/**
 * Mini World's neighbourhood for the UI (2026-09-26): friends, the Nabolag
 * with its crown, gifts and visits, over `/api/mw/*`. Every call is silent
 * and offline-tolerant: it answers a `SocialResult` the UI shows with
 * `socialText(result)`. Nothing here creates a player; useMiniWorld does
 * that with the first person.
 */

export type SocialResult =
  | 'ok'
  /** No answer from the server. */
  | 'offline'
  /** This browser has no player yet (make a person first). */
  | 'no-player'
  /** No friend or neighbourhood with that code, or no such gift/player. */
  | 'not-found'
  | 'bad-code'
  /** Your own friend code. */
  | 'self'
  | 'already'
  /** 30 friends (yours or theirs). */
  | 'friends-full'
  /** Already in a neighbourhood (leave first). */
  | 'in-hood'
  | 'no-hood'
  /** 12 members. */
  | 'hood-full'
  | 'not-member'
  | 'not-ruler'
  | 'bad-title'
  /** Only one king and one queen. */
  | 'title-taken'
  /** Not enough bits. */
  | 'poor'
  /** Not a friend or neighbour. */
  | 'not-allowed'
  /** Their mailbox is full (40 unopened). */
  | 'inbox-full'
  /** This thing cannot be given (a royal or prize piece, your last pair of shoes…). */
  | 'not-giftable'
  | 'error'

/** What the player chooses to send. Furniture goes by uid (it leaves the house). */
export type GiftChoice =
  | { kind: 'clothing'; id: string }
  | { kind: 'furniture'; uid: string }
  | { kind: 'bits'; amount: number }

/** What others see of me: built from the save by useMiniWorld, published by this composable. */
export interface ProfileData {
  person: { name: string; look: PersonLook } | null
  house: HouseLayout | null
  levels: Record<string, 1 | 2 | 3>
  kinds: Record<string, string>
}

export interface MiniWorldSocialApi {
  /** Last state from the server; null before the first refresh or without a player. */
  state: Ref<SocialState | null>
  /** True while a request runs. */
  busy: Ref<boolean>
  /** My player id (for finding myself in the hood), or null. */
  me: ComputedRef<string | null>
  /** Unopened gifts in the mailbox. */
  inboxCount: ComputedRef<number>
  /** Friends and neighbours for Nabogata (no duplicates, never me), for runtime.setNeighbors. */
  neighbors: ComputedRef<NeighborInfo[]>
  /** My title in the hood, or null. */
  myTitle: ComputedRef<RoyalTitle | null>
  /** True when I am the hood's ruler. */
  isRuler: ComputedRef<boolean>

  /** Fetches friends, hood and mailbox (creates my friend code on first call). Also hands a new title's prizes to the save. */
  refresh(): Promise<SocialResult>
  /** Sends what others see of me (debounced ~3 s; useMiniWorld calls it on changes). */
  publish(profile: ProfileData): void

  addFriend(code: string): Promise<SocialResult>
  removeFriend(playerId: string): Promise<SocialResult>

  createHood(): Promise<SocialResult>
  joinHood(code: string): Promise<SocialResult>
  leaveHood(): Promise<SocialResult>
  /** One vote for who is ruler (yourself is allowed). */
  vote(playerId: string): Promise<SocialResult>
  /** The ruler picks king or queen for themself. */
  crown(title: 'king' | 'queen'): Promise<SocialResult>
  /** The ruler gives (or, with null, takes back) a title. */
  giveTitle(playerId: string, title: RoyalTitle | null): Promise<SocialResult>

  /** Sends a gift; clothing and furniture leave the save, bits the wallet. */
  sendGift(to: string, choice: GiftChoice): Promise<SocialResult>
  /** Opens a gift from the mailbox and takes it in. */
  openGift(id: string): Promise<{ result: SocialResult; gift: Gift | null }>

  /** A friend's or neighbour's house and person for a visit. */
  fetchHouse(playerId: string): Promise<{ result: SocialResult; profile: PublicProfile | null }>
}

/** Norwegian text for a result (empty for 'ok'). */
export function socialText(r: SocialResult): string {
  return SOCIAL_TEXT[r]
}

const SOCIAL_TEXT: Record<SocialResult, string> = {
  'ok': '',
  'offline': 'Fikk ikke kontakt. Prøv igjen snart.',
  'no-player': 'Lag en person først.',
  'not-found': 'Fant ingen med den koden.',
  'bad-code': 'Koden har seks bokstaver.',
  'self': 'Det er din egen kode!',
  'already': 'Det er allerede gjort.',
  'friends-full': 'Det er ikke plass til flere venner.',
  'in-hood': 'Du bor allerede i et nabolag.',
  'no-hood': 'Du er ikke i et nabolag.',
  'hood-full': 'Nabolaget er fullt.',
  'not-member': 'Hen bor ikke i nabolaget.',
  'not-ruler': 'Bare den som har kronen kan gjøre det.',
  'bad-title': 'Den tittelen går ikke.',
  'title-taken': 'Noen har allerede den tittelen.',
  'poor': 'Du har ikke nok bits.',
  'not-allowed': 'Du kan bare sende til venner og naboer.',
  'inbox-full': 'Postkassen deres er full.',
  'not-giftable': 'Den kan du ikke gi bort.',
  'error': 'Noe gikk galt. Prøv igjen.',
}

const PUBLISH_DELAY_MS = 3000
const MAX_NEIGHBORS = 12

const KNOWN: ReadonlySet<string> = new Set(Object.keys(SOCIAL_TEXT))

/** Server error code → result; anything unexpected is 'error'. */
function resultOf(code: string, status: number): SocialResult {
  if (KNOWN.has(code)) return code as SocialResult
  if (code === 'self') return 'self'
  if (status === 404) return 'not-found'
  if (status === 403) return 'not-allowed'
  return 'error'
}

async function call<T>(path: string, body?: Record<string, unknown>): Promise<{ result: SocialResult; data: T | null }> {
  const p = readStoredPlayer()
  if (!p) return { result: 'no-player', data: null }
  try {
    const res = body
      ? await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: p.id, ...body }),
      })
      : await fetch(path, { cache: 'no-store' })
    if (res.ok) return { result: 'ok', data: await res.json() as T }
    let code = ''
    try {
      const j = await res.json() as { data?: { code?: string }; statusMessage?: string }
      code = j.data?.code ?? j.statusMessage ?? ''
    } catch { /* no body */ }
    return { result: resultOf(code, res.status), data: null }
  } catch {
    return { result: 'offline', data: null }
  }
}

// --- publishing (also used by useMiniWorld, outside any component)

let publishTimer: ReturnType<typeof setTimeout> | null = null
let publishNext: ProfileData | null = null
let lastPublished = ''

/** Sends what others see of me, debounced; the same profile twice is sent once. */
export function publishProfile(profile: ProfileData): void {
  if (typeof window === 'undefined') return
  publishNext = profile
  if (publishTimer) clearTimeout(publishTimer)
  publishTimer = setTimeout(() => {
    publishTimer = null
    const next = publishNext
    publishNext = null
    if (!next) return
    const json = JSON.stringify(next)
    if (json === lastPublished) return
    void call('/api/mw/profile', { ...next }).then(({ result }) => { if (result === 'ok') lastPublished = json })
  }, PUBLISH_DELAY_MS)
}

// --- the composable

let shared: MiniWorldSocialApi | null = null

export function useMiniWorldSocial(): MiniWorldSocialApi {
  if (typeof window === 'undefined') return build()
  return (shared ??= build())
}

function build(): MiniWorldSocialApi {
  const state = ref<SocialState | null>(null)
  const busy = ref(false)
  // Re-read with each state change: the player can appear after the first person is made.
  const me = computed(() => {
    void state.value
    return readStoredPlayer()?.id ?? null
  })
  const inboxCount = computed(() => state.value?.inbox.length ?? 0)
  const myMember = computed(() => state.value?.hood?.members.find(m => m.playerId === me.value) ?? null)
  const myTitle = computed(() => myMember.value?.title ?? null)
  const isRuler = computed(() => !!me.value && state.value?.hood?.ruler === me.value)

  const neighbors = computed<NeighborInfo[]>(() => {
    const s = state.value
    if (!s) return []
    const out: NeighborInfo[] = []
    const seen = new Set<string>([me.value ?? ''])
    for (const m of s.hood?.members ?? []) {
      if (seen.has(m.playerId)) continue
      seen.add(m.playerId)
      out.push({ playerId: m.playerId, label: m.person?.name ?? m.playerName, title: m.title, look: m.person?.look ?? null })
    }
    for (const f of s.friends) {
      if (seen.has(f.playerId)) continue
      seen.add(f.playerId)
      out.push({ playerId: f.playerId, label: f.person?.name ?? f.playerName, title: null, look: f.person?.look ?? null })
    }
    return out.slice(0, MAX_NEIGHBORS)
  })

  /** Runs a request with the busy flag. */
  async function busyCall<T>(path: string, body?: Record<string, unknown>) {
    busy.value = true
    try {
      return await call<T>(path, body)
    } finally {
      busy.value = false
    }
  }

  /** A new title brings its royal clothes (once; the save remembers). */
  function claimTitle(): void {
    if (myTitle.value) useMiniWorld().applyTitle(myTitle.value)
  }

  function setHood(hood: Hood | null): void {
    if (state.value) state.value = { ...state.value, hood }
    claimTitle()
  }

  async function refresh(): Promise<SocialResult> {
    const id = readStoredPlayer()?.id
    if (!id) return 'no-player'
    const { result, data } = await busyCall<SocialState>(`/api/mw/state?player=${encodeURIComponent(id)}`)
    if (data) {
      state.value = data
      claimTitle()
    }
    return result
  }

  async function hoodAction(body: Record<string, unknown>): Promise<SocialResult> {
    const { result, data } = await busyCall<{ hood: Hood | null }>('/api/mw/hood', body)
    if (data) setHood(data.hood)
    return result
  }

  async function sendGift(to: string, choice: GiftChoice): Promise<SocialResult> {
    const mw = useMiniWorld()
    if (choice.kind === 'bits') {
      const amount = Math.floor(choice.amount)
      if (!(amount >= 1)) return 'error'
      if (readWallet() < amount) return 'poor'
      // The server takes the bits from its balance: bring it up to date first.
      await syncWallet()
      const { result } = await busyCall('/api/mw/gift', { to, kind: 'bits', amount })
      await syncWallet()
      return result
    }
    const key = choice.kind === 'clothing' ? choice.id : choice.uid
    if (!mw.canGiveAway(choice.kind, key).ok) return 'not-giftable'
    const body = choice.kind === 'clothing'
      ? { to, kind: 'clothing', item: choice.id }
      : (() => {
          const o = mw.save.value.furniture.find(f => f.uid === choice.uid)!
          return { to, kind: 'furniture', item: o.id, level: o.level }
        })()
    const { result } = await busyCall('/api/mw/gift', body)
    if (result === 'ok') mw.giveAway(choice.kind, key)
    return result
  }

  async function openGift(id: string): Promise<{ result: SocialResult; gift: Gift | null }> {
    const { result, data } = await busyCall<{ gift: Gift }>('/api/mw/gift/open', { id })
    if (!data) return { result, gift: null }
    // Already taken in (a retried open) is fine: the gift is ours either way.
    useMiniWorld().receive(data.gift)
    if (state.value) state.value = { ...state.value, inbox: state.value.inbox.filter(g => g.id !== id) }
    return { result: 'ok', gift: data.gift }
  }

  async function fetchHouse(playerId: string): Promise<{ result: SocialResult; profile: PublicProfile | null }> {
    const viewer = readStoredPlayer()?.id
    if (!viewer) return { result: 'no-player', profile: null }
    const q = `player=${encodeURIComponent(playerId)}&viewer=${encodeURIComponent(viewer)}`
    const { result, data } = await busyCall<{ profile: PublicProfile }>(`/api/mw/house?${q}`)
    return { result, profile: data?.profile ?? null }
  }

  return {
    state,
    busy,
    me,
    inboxCount,
    neighbors,
    myTitle,
    isRuler,
    refresh,
    publish: publishProfile,

    async addFriend(code) {
      const c = cleanCode(code)
      if (!c) return 'bad-code'
      const { result, data } = await busyCall<{ friend: PublicProfile; already: boolean }>('/api/mw/friend', { code: c })
      if (!data) return result
      if (state.value && !state.value.friends.some(f => f.playerId === data.friend.playerId)) {
        state.value = { ...state.value, friends: [...state.value.friends, data.friend] }
      }
      return data.already ? 'already' : 'ok'
    },
    async removeFriend(playerId) {
      const { result } = await busyCall('/api/mw/unfriend', { friendId: playerId })
      if (result === 'ok' && state.value) {
        state.value = { ...state.value, friends: state.value.friends.filter(f => f.playerId !== playerId) }
      }
      return result
    },

    createHood: () => hoodAction({ action: 'create' }),
    async joinHood(code) {
      const c = cleanCode(code)
      if (!c) return 'bad-code'
      return hoodAction({ action: 'join', code: c })
    },
    leaveHood: () => hoodAction({ action: 'leave' }),
    vote: playerId => hoodAction({ action: 'vote', target: playerId }),
    crown: title => hoodAction({ action: 'crown', title }),
    giveTitle: (playerId, title) => hoodAction({ action: 'title', target: playerId, title }),

    sendGift,
    openGift,
    fetchHouse,
  }
}
