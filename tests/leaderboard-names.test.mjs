import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { FIRST_WORDS, SECOND_WORDS, NAME_SPACE, randomName, rerollName, isValidName } from '../themes/leaderboard/names.ts'
import { GAMES, GAME_IDS, gameById, TOP_N, avatarThumbUrl, avatarImageUrl, AVATAR_MAX_GENS } from '../themes/leaderboard/games.ts'

/** Deterministic rng: walks a fixed sequence. */
function seq(values) {
  let i = 0
  return () => values[i++ % values.length]
}

describe('Hall of Fame names', () => {
  it('has a roomy, duplicate-free name space', () => {
    assert.equal(new Set(FIRST_WORDS).size, FIRST_WORDS.length)
    assert.equal(new Set(SECOND_WORDS).size, SECOND_WORDS.length)
    assert.ok(NAME_SPACE >= 2000, `only ${NAME_SPACE} names`)
    for (const w of [...FIRST_WORDS, ...SECOND_WORDS]) {
      assert.match(w, /^[A-Z][A-Za-z]+$/, `word "${w}" must be one title-case token`)
    }
  })

  it('generates "First Second" names that validate', () => {
    for (let i = 0; i < 500; i++) {
      const n = randomName()
      assert.ok(isValidName(n), n)
      assert.equal(n.split(' ').length, 2)
    }
  })

  it('picks by the rng', () => {
    assert.equal(randomName(seq([0, 0])), `${FIRST_WORDS[0]} ${SECOND_WORDS[0]}`)
    assert.equal(randomName(seq([0.999, 0.999])), `${FIRST_WORDS.at(-1)} ${SECOND_WORDS.at(-1)}`)
  })

  it('rerolls to a different name', () => {
    const current = `${FIRST_WORDS[0]} ${SECOND_WORDS[0]}`
    // First draw repeats the current name, second draw differs.
    const next = rerollName(current, seq([0, 0, 0.5, 0.5]))
    assert.notEqual(next, current)
    assert.ok(isValidName(next))
  })

  it('rejects anything the generator cannot produce', () => {
    for (const bad of [
      '', 'Neon', 'Neon  Otter', 'neon otter', 'NEON OTTER', 'Neon Otter Extra',
      'Otter Neon', 'Neon Hitler', '<b>Neon</b> Otter', 'Neon Otter\n', 42, null, undefined, {},
    ]) {
      assert.equal(isValidName(bad), false, JSON.stringify(bad))
    }
    assert.equal(isValidName('Neon Otter'), true)
  })
})

describe('Hall of Fame games', () => {
  it('lists the six score games, each with a plausibility cap', () => {
    assert.deepEqual(GAME_IDS, ['galaga', 'breakout', 'rtype', 'invaders', 'starfox', 'tetris'])
    for (const g of GAMES) assert.ok(Number.isInteger(g.maxScore) && g.maxScore > 0, g.id)
    assert.equal(gameById('tetris')?.title, 'Tetris')
    assert.equal(gameById('anotherworld'), undefined)
    assert.equal(gameById(7), undefined)
    assert.equal(TOP_N, 10)
  })
})

describe('Hall of Fame avatars', () => {
  it('composes fixer.ink URLs from the stored filename', () => {
    assert.equal(avatarThumbUrl('abc123.png'), 'https://media.fixer.ink/thumbnails/abc123_thumb.jpg')
    assert.equal(avatarImageUrl('abc123.png'), 'https://media.fixer.ink/images/abc123.png')
    assert.equal(avatarThumbUrl('x.y.webp'), 'https://media.fixer.ink/thumbnails/x.y_thumb.jpg')
  })

  it('has no URL without a file', () => {
    assert.equal(avatarThumbUrl(null), null)
    assert.equal(avatarThumbUrl(undefined), null)
    assert.equal(avatarThumbUrl(''), null)
    assert.equal(avatarImageUrl(null), null)
  })

  it('bounds paintings per player', () => {
    assert.ok(Number.isInteger(AVATAR_MAX_GENS) && AVATAR_MAX_GENS >= 2 && AVATAR_MAX_GENS <= 20)
  })
})
