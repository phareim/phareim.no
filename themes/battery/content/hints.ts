/** TALK TO a friend's portrait: a hint from the first goal the pair has not reached. */
import type { Ctx, HandlerResult, HeroId } from '../types'

export function hint(c: Ctx, to: HeroId): HandlerResult {
  return function* () {
    yield c.say('Any ideas?')
    yield c.sayAs(to, 'Not yet.')
  }()
}

export function lookHero(c: Ctx, at: HeroId): HandlerResult {
  return c.by({
    kjell: at === 'dag' ? 'Dag. Somewhere under my feet, eating something.' : 'Espen. Somewhere above me, being thrilled.',
    dag: at === 'kjell' ? 'Kjell. Upstairs, worrying.' : 'Espen. Way up. Talking to ghosts, probably.',
    espen: at === 'kjell' ? 'Kjell. Downstairs. He\'ll be fine. Probably.' : 'Dag. In the cellar. Probably happy.',
  })
}
