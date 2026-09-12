import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TRACK_NAMES as GALAGA_NAMES } from '../themes/galaga/audio.ts'
import { TRACK_NAMES as OUTRUN_NAMES } from '../themes/outrun/audio.ts'
import {
  STATIONS, STATION_NAMES, OUTRUN_OFFSET,
  globalIndex, nextStation, prevStation, clampStation, migrateStation,
} from '../themes/radio/catalog.ts'

test('six stations: three Galaga, then three OutRun', () => {
  assert.equal(STATIONS.length, 6)
  assert.equal(OUTRUN_OFFSET, 3)
  assert.deepEqual([...STATION_NAMES].slice(0, 3), [...GALAGA_NAMES])
  assert.deepEqual([...STATION_NAMES].slice(3), [...OUTRUN_NAMES])
  assert.deepEqual(STATIONS.map(s => s.origin), ['galaga', 'galaga', 'galaga', 'outrun', 'outrun', 'outrun'])
  assert.deepEqual(STATIONS.map(s => s.track), [0, 1, 2, 0, 1, 2])
  // Station names are unique across the dial.
  assert.equal(new Set(STATION_NAMES).size, 6)
})

test('globalIndex maps local tracks, junk falls back to the block start', () => {
  assert.equal(globalIndex('galaga', 0), 0)
  assert.equal(globalIndex('galaga', 2), 2)
  assert.equal(globalIndex('outrun', 0), 3)
  assert.equal(globalIndex('outrun', 2), 5)
  assert.equal(globalIndex('galaga', 9), 0)
  assert.equal(globalIndex('outrun', -1), 3)
})

test('next/prev wrap around the six-station dial', () => {
  assert.equal(nextStation(0), 1)
  assert.equal(nextStation(5), 0)
  assert.equal(prevStation(0), 5)
  assert.equal(prevStation(3), 2)
})

test('clampStation turns junk into station 0', () => {
  assert.equal(clampStation(2), 2)
  assert.equal(clampStation(0), 0)
  assert.equal(clampStation(6), 0)
  assert.equal(clampStation(-1), 0)
  assert.equal(clampStation(NaN), 0)
  assert.equal(clampStation('1'), 0)
  assert.equal(clampStation(undefined), 0)
})

test('migrateStation prefers the unified key, then old game keys', () => {
  const store = (obj) => (k) => (k in obj ? obj[k] : null)
  assert.deepEqual(
    migrateStation(store({ 'phareim.radioStation': '4', 'phareim.radioMuted': '1' })),
    { station: 4, muted: true },
  )
  // A stale unified key falls through to the game keys.
  assert.deepEqual(
    migrateStation(store({ 'phareim.radioStation': 'nope', galagaRadio: GALAGA_NAMES[1] })),
    { station: 1, muted: false },
  )
  assert.deepEqual(
    migrateStation(store({ galagaRadio: GALAGA_NAMES[2] })),
    { station: 2, muted: false },
  )
  assert.deepEqual(
    migrateStation(store({ outrunRadio: '1' })),
    { station: 4, muted: false },
  )
  // OutRun OFF (-1) becomes muted rather than silent.
  assert.deepEqual(
    migrateStation(store({ outrunRadio: '-1' })),
    { station: 0, muted: true },
  )
  assert.deepEqual(migrateStation(store({})), { station: 0, muted: false })
})
