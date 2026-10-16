// Space Voyagers II: the tuning table. Each bot profile flies a mission on
// several seeds; the table says how it went. Plain node:
//   node scripts/voyagers2-lab/tune.mjs [mission] [seeds]
import { createWorld, step, calzone } from '../../themes/voyagers2/engine/world.ts'
import { MISSIONS } from '../../themes/voyagers2/engine/missions.ts'
import { createBot, botInput, BOT_PROFILES } from '../../themes/voyagers2/engine/bot.ts'
import { condition } from '../../themes/voyagers2/engine/ships.ts'

const arg = process.argv[2] ?? 'firstshift'
const seeds = Number(process.argv[3] ?? 8)
const ids = arg === 'all' ? Object.keys(MISSIONS) : arg.split(',')
for (const id of ids) if (!MISSIONS[id]) { console.error('no mission', id); process.exit(1) }

const LIMIT = 60 * 60 * 8

function fly(mission, profile, seed) {
  const w = createWorld({ seed, mission, pilot: seed % 2 ? 'rex' : 'nova' })
  const bot = createBot(profile, seed)
  let hitsTaken = 0, front = 0, back = 0, wing = 0, shots = 0, fights = 0, inFight = 0
  for (let i = 0; i < LIMIT; i++) {
    const inp = botInput(bot, w)
    step(w, inp)
    for (const e of w.events) {
      if ((e.type === 'shieldHit' || e.type === 'armourHit') && e.a === w.player) hitsTaken++
      if (e.type === 'kill' && w.ships.find(s => s.id === e.a)?.side === 'them') {
        if (e.b === w.player) { if (e.seat === 'back') back++; else front++ } else wing++
      }
      if (e.type === 'shot' && e.a === w.player && e.seat === 'front') shots++
      if (e.type === 'arrive') fights++
    }
    if (w.mission.stage === 'fly' && w.ships.some(s => s.side === 'them' && s.dead === 0 && !s.gone)) inFight++
    if (w.mission.stage === 'done') break
  }
  const me = calzone(w)
  const c = me ? condition(me) : null
  return {
    result: w.mission.result || 'timeout', why: w.mission.why, secs: Math.round(w.tick / 60), fightSecs: Math.round(inFight / 60),
    hitsTaken, front, back, wing, shots, score: w.score, whole: c ? Math.round((c.af + c.ab + c.al + c.ar + c.core) / 5 * 100) : 0,
  }
}

for (const missionId of ids) {
const mission = MISSIONS[missionId]
console.log(`mission ${missionId}, ${seeds} seeds`)
for (const profile of Object.keys(BOT_PROFILES)) {
  const runs = []
  for (let s = 1; s <= seeds; s++) runs.push(fly(mission, profile, s))
  const won = runs.filter(r => r.result === 'won').length
  const avg = k => (runs.reduce((a, r) => a + r[k], 0) / runs.length).toFixed(1)
  console.log(`${profile.padEnd(7)} won ${won}/${seeds}  secs ${avg('secs')} (fighting ${avg('fightSecs')})  hits taken ${avg('hitsTaken')}  kills front ${avg('front')} back ${avg('back')} wing ${avg('wing')}  shots ${avg('shots')}  hull left ${avg('whole')}%  score ${avg('score')}`)
  const lost = runs.filter(r => r.result !== 'won').map(r => `${r.result}:${r.why}`)
  if (lost.length) console.log('        not won:', lost.join(' '))
}
}
