import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { EscHoldTracker, ESC_HOLD_MS } from '../themes/base/escHold.ts'

function escEvent(code = 'Escape', repeat = false) {
  return {
    code,
    repeat,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    target: null,
    preventDefault() {},
  }
}

function harness(holdMs = ESC_HOLD_MS) {
  let t = 0
  const calls = []
  const tracker = new EscHoldTracker(
    {
      isActive: () => true,
      onTap: () => calls.push('tap'),
      onHold: () => calls.push('hold'),
    },
    holdMs,
    () => t,
  )
  return { tracker, calls, setTime: (ms) => { t = ms } }
}

describe('EscHoldTracker', () => {
  it('quick tap fires onTap on keyup', () => {
    const { tracker, calls, setTime } = harness()
    assert.equal(tracker.onKeyDown(escEvent()), true)
    setTime(200)
    tracker.poll()
    assert.ok(tracker.holding)
    tracker.onKeyUp(escEvent())
    assert.deepEqual(calls, ['tap'])
    assert.equal(tracker.holding, false)
    assert.equal(tracker.progress, 0)
  })

  it('full hold fires onHold once, and the release does not tap', () => {
    const { tracker, calls, setTime } = harness()
    assert.equal(tracker.onKeyDown(escEvent()), true)
    setTime(ESC_HOLD_MS)
    tracker.poll()
    assert.deepEqual(calls, ['hold'])
    assert.equal(tracker.progress, 1)
    // Extra frames never re-fire.
    setTime(ESC_HOLD_MS * 3)
    tracker.poll()
    assert.deepEqual(calls, ['hold'])
    // Release after a hold is silent.
    tracker.onKeyUp(escEvent())
    assert.deepEqual(calls, ['hold'])
  })

  it('progress tracks elapsed time', () => {
    const { tracker, setTime } = harness(1000)
    tracker.onKeyDown(escEvent())
    setTime(250)
    tracker.poll()
    assert.equal(tracker.progress, 0.25)
    setTime(500)
    tracker.poll()
    assert.equal(tracker.progress, 0.5)
  })

  it('ignores key repeats and non-Escape keys', () => {
    const { tracker, calls } = harness()
    assert.equal(tracker.onKeyDown(escEvent('KeyP')), false)
    assert.equal(tracker.onKeyDown(escEvent('Escape', true)), false)
    assert.equal(tracker.holding, false)
    tracker.onKeyUp(escEvent('Escape'))
    assert.deepEqual(calls, [])
  })

  it('ignores Escape when no run is active', () => {
    let t = 0
    const calls = []
    const tracker = new EscHoldTracker(
      { isActive: () => false, onTap: () => calls.push('tap'), onHold: () => calls.push('hold') },
      ESC_HOLD_MS,
      () => t,
    )
    assert.equal(tracker.onKeyDown(escEvent()), false)
    tracker.onKeyUp(escEvent())
    assert.deepEqual(calls, [])
  })

  it('cancel() abandons a hold silently', () => {
    const { tracker, calls, setTime } = harness()
    tracker.onKeyDown(escEvent())
    setTime(1000)
    tracker.poll()
    tracker.cancel()
    tracker.onKeyUp(escEvent())
    assert.deepEqual(calls, [])
    assert.equal(tracker.holding, false)
  })

  it('keyup without keydown does nothing', () => {
    const { tracker, calls } = harness()
    tracker.onKeyUp(escEvent())
    assert.deepEqual(calls, [])
  })
})
