// Neon Shrine's feedback button (themes/zelda/feedback/, docs/games/neon-shrine-feedback.md) against the fake of the
// service's two routes: who is asked and when, what a report says about where the hero stands, and what arrives.
// The shell's side (the button and the window) is `npm run smoke:feedback`, run by hand.
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { startFake } from '../scripts/zelda-lab/feedback-fake.mjs'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const zelda = join(dirname(fileURLToPath(import.meta.url)), '..', 'themes', 'zelda')

/** An 8 × 8 picture. */
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAACKADAAQAAAABAAAACAAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgACAAIAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMACQkJCQkJEAkJEBYQEBAWHhYWFhYeJh4eHh4eJi4mJiYmJiYuLi4uLi4uLjc3Nzc3N0BAQEBASEhISEhISEhISP/bAEMBCwwMEhESHxERH0szKjNLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS//dAAQAAf/aAAwDAQACEQMRAD8AraZ4Z6fLW7/wjP8As1u6Z2reor42rzvUMszCv9Xjqf/Z', 'base64')

let Z
let fake
let url
/** What a browser adds to a request from the dev page. */
const browser = (u, init = {}) => fetch(u, { ...init, headers: { origin: 'http://localhost:3030' } })

before(async () => {
  const out = esbuild.buildSync({
    stdin: {
      contents: `export { createFeedbackGate } from './feedback/gate'; export { postFeedback } from './feedback/send';
        export { collectContext } from './feedback/context'; export { createGame, enterMap, mapInfo } from './engine/index';
        export { WORLD } from './world/index'`,
      resolveDir: zelda, loader: 'ts',
    },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  Z = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
  fake = await startFake({ port: 0 })
  url = `http://127.0.0.1:${fake.port}`
})
after(() => fake?.close())

describe('the feedback button against the fake service', () => {
  it('asks nobody while DEV MODE is off, and believes only a yes', async () => {
    const gate = Z.createFeedbackGate({ fetch: browser, url })
    assert.equal(await gate.ask(false), false)
    assert.equal(fake.requests.length, 0)
    assert.equal(await gate.ask(true), true)
    assert.deepEqual(fake.requests, [{ method: 'GET', path: '/can' }])
    fake.setMode('no')
    assert.equal(await Z.createFeedbackGate({ fetch: browser, url }).ask(true), false)
    fake.setMode('yes')
  })

  it('says where the hero stands, so that the save and the spot stand them there again', () => {
    const map = 'overworld'
    const entry = 'hut'
    const at = Z.mapInfo(Z.WORLD, map).entries[entry]
    const state = Z.createGame(Z.WORLD, { at: { map, entry } })
    const { meta, save } = Z.collectContext({ state, world: Z.WORLD, renderer: null, canvas: null, touch: true, signedIn: true, paused: false })
    assert.deepEqual(meta.where.tile, { x: Math.floor(at.x), y: Math.floor(at.y) })
    assert.deepEqual(meta.where.pos, { x: state.hero.x, y: state.hero.y })
    assert.ok(Buffer.byteLength(JSON.stringify(meta)) < 32_768)
    assert.ok(Buffer.byteLength(JSON.stringify(save)) < 65_536)
    const again = Z.createGame(Z.WORLD, { save })
    Z.enterMap(Z.WORLD, again, meta.where.map.id, meta.where.entry.entry, [], { x: meta.where.pos.x, y: meta.where.pos.y })
    assert.equal(again.map.id, map)
    assert.deepEqual([Math.floor(again.hero.x), Math.floor(again.hero.y)], [meta.where.tile.x, meta.where.tile.y])
  })

  it('delivers the report as sent, and says why when it does not', async () => {
    const state = Z.createGame(Z.WORLD, { at: { map: 'overworld', entry: 'hut' } })
    const { meta, save } = Z.collectContext({ state, world: Z.WORLD, renderer: null, canvas: null, touch: false, signedIn: true, paused: false })
    const report = { fetch: browser, url, meta, save, text: 'I CAN GET ON THE ISLAND BUT NOT OFF', shot: new Blob([JPEG], { type: 'image/jpeg' }) }
    const sent = await Z.postFeedback(report)
    assert.equal(sent.ok, true)
    assert.equal(typeof sent.id, 'string')
    assert.equal(fake.entries().length, 1)
    const got = fake.entries()[0]
    assert.deepEqual(got.meta, JSON.parse(JSON.stringify(meta)))
    assert.deepEqual(got.save, JSON.parse(JSON.stringify(save)))
    assert.ok(got.shot.equals(JPEG))
    assert.equal(got.text, report.text)
    for (const [mode, reason, timeoutMs] of [['drop', 'NO ANSWER OR NOT SIGNED IN'], ['slow', 'TIMED OUT', 300], ['500', 'SERVER ERROR']]) {
      fake.setMode(mode)
      assert.deepEqual(await Z.postFeedback({ ...report, timeoutMs }), { ok: false, reason }, mode)
    }
    assert.equal(fake.entries().length, 1)
  })
})
