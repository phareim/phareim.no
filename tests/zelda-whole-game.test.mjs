// One hero through everything: a new game, the seven dungeons in the design's order with one save, a closed tab
// between each, the Sun Prism, the Balance, the second ending and the walk home. What each dungeon's own test cannot
// see, because it starts from a game made for it, is asked on the way (`zelda-plays/whole.mjs`): the save under its
// cap, the treasures on B or on the ITEMS page and pressed in the next dungeon, the keyrings, what is finished staying
// finished, the hearts adding up, and no flag two dungeons share. The account, with what each door lends, is printed.
import { it } from 'node:test'
import { load, wholeGame } from './zelda-plays/whole.mjs'

it('carries one hero with one save from a new game through the seven dungeons and the Sun Prism to the second ending and home', async (t) => {
  await wholeGame(await load(), { say: line => t.diagnostic(line) })
})
