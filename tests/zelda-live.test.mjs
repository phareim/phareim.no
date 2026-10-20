// The studio's live art (render/live.ts and the override seam in render/sheet.ts): what is
// accepted, what is skipped, the kept copy before the fetch, and the draft mode. Pure modules,
// bundled with esbuild like the other zelda tests.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../themes/zelda')

let m
before(async () => {
  const out = esbuild.buildSync({
    stdin: {
      contents: [
        `export * from './render/live'`,
        `export { setSpriteOverrides } from './render/sheet'`,
        `export { SPRITES } from './render/sprites'`,
      ].join('; '),
      resolveDir: root,
      loader: 'ts',
    },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  m = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
})

const blank = (w, h, ch = '.') => Array.from({ length: h }, () => ch.repeat(w))
const pack = (release, sprites) => JSON.stringify({ format: 1, pack: 'neon-shrine', release, sprites })

function fakeStorage(init = {}) {
  const data = { ...init }
  return { data, getItem: k => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = v } }
}

function fakeFetch(body, calls = []) {
  return async (url, init) => {
    calls.push({ url, init })
    return { ok: true, text: async () => body }
  }
}

describe('parseLive', () => {
  it('takes the studio format and drops ragged rows', () => {
    const art = m.parseLive({ format: 1, pack: 'neon-shrine', release: 3, sprites: { blob_0: ['ab', 'cd'], bad: ['ab', 'c'], empty: [] } })
    assert.equal(art.release, 3)
    assert.deepEqual(Object.keys(art.sprites), ['blob_0'])
  })
  it('refuses another pack or format', () => {
    assert.equal(m.parseLive({ format: 2, pack: 'neon-shrine', sprites: {} }), null)
    assert.equal(m.parseLive({ format: 1, pack: 'nova', sprites: {} }), null)
    assert.equal(m.parseLive('nope'), null)
  })
})

describe('setSpriteOverrides', () => {
  it('applies names in the registry at their drawn size only', () => {
    const drawn = m.SPRITES.blob_0.rows
    const w = drawn[0].length
    const h = drawn.length
    const applied = m.setSpriteOverrides({
      blob_0: blank(w, h, 'k'),
      blob_1: blank(w + 1, h),
      not_a_sprite: blank(4, 4),
    })
    assert.deepEqual(applied, ['blob_0'])
    assert.deepEqual(m.setSpriteOverrides({}), [])
  })
})

describe('startLiveSprites', () => {
  it('applies the kept copy at once, then the fetched one, and keeps that', async () => {
    const drawn = m.SPRITES.blob_0.rows
    const kept = pack(1, { blob_0: blank(drawn[0].length, drawn.length, 'k') })
    const fresh = pack(2, { blob_0: blank(drawn[0].length, drawn.length, 'p') })
    const storage = fakeStorage({ 'studio.live.neon-shrine': kept })
    const seen = []
    const calls = []
    const stop = m.startLiveSprites({ search: '', storage, fetcher: fakeFetch(fresh, calls), onApplied: a => seen.push(a.release) })
    assert.deepEqual(seen, [1], 'the kept copy is applied before any fetch resolves')
    await new Promise(r => setTimeout(r, 0))
    assert.deepEqual(seen, [1, 2])
    assert.equal(storage.data['studio.live.neon-shrine'], fresh)
    assert.equal(calls[0].url, 'https://studio.phareim.no/live/neon-shrine.json')
    assert.equal(calls[0].init.credentials, 'omit')
    stop()
    m.setSpriteOverrides({})
  })

  it('shows drafts with the sign-in cookie and never keeps them', async () => {
    const storage = fakeStorage({ 'studio.live.neon-shrine': pack(1, {}) })
    const calls = []
    const seen = []
    const stop = m.startLiveSprites({ search: '?sprites=draft', storage, fetcher: fakeFetch(pack('draft', {}), calls), onApplied: a => seen.push(a.release) })
    await new Promise(r => setTimeout(r, 0))
    assert.deepEqual(seen, ['draft'], 'the kept live copy is not applied over drafts')
    assert.equal(calls[0].url, 'https://studio.phareim.no/api/packs/neon-shrine/draft.json')
    assert.equal(calls[0].init.credentials, 'include')
    assert.equal(storage.data['studio.live.neon-shrine'], pack(1, {}))
    stop()
    m.setSpriteOverrides({})
  })

  it('stays quiet when the studio is down', async () => {
    const stop = m.startLiveSprites({ search: '', storage: null, fetcher: async () => { throw new Error('offline') } })
    await new Promise(r => setTimeout(r, 0))
    stop()
  })
})
