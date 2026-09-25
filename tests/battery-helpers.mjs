// Helpers for driving Night of the Dead Battery in node tests.
export const hs = id => ({ kind: 'hotspot', id })
export const item = id => ({ kind: 'item', id })
export const hero = id => ({ kind: 'hero', id })

/** Step until the game is idle, answering dialogue with `answers` (ids, in order). Returns the lines spoken. */
export function settle(g, { answers = [], max = 240 } = {}) {
  const said = []
  const queue = [...answers]
  for (let i = 0; i < max * 60; i++) {
    if (g.choice) {
      const id = queue.shift()
      if (!id || !g.chooseId(id)) throw new Error('settle: no answer for choice ' + JSON.stringify(g.shownChoices().map(o => o.id)))
    }
    g.update(1 / 60)
    for (const e of g.drain()) if (e.t === 'speak') said.push(`${e.who}: ${e.text}`)
    if (g.idle && !g.choice) return said
  }
  throw new Error('settle: still busy after ' + max + ' s')
}

/** Act and settle in one go. */
export function doing(g, verb, a, b, opts) {
  g.act(verb, a, b)
  return settle(g, opts)
}
