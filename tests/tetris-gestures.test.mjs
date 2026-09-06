import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const source = ts.transpileModule(readFileSync(new URL('../themes/tetris/gestures.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
const { TetrisGesture } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
const gesture = () => new TetrisGesture(100, 100, 0, 20)
test('tap rotates; long press and returning swipes do not', () => {
  assert.equal(gesture().end(104, 102, 120), 'rotate')
  assert.equal(gesture().end(100, 100, 500), null)
  const g = gesture(); g.move(160, 100, 100)
  assert.equal(g.end(100, 100, 200), null)
})
test('horizontal drag follows cells and reverses immediately', () => {
  const g = gesture()
  assert.equal(g.move(160, 104, 80).horizontal, 3)
  assert.equal(g.move(140, 106, 100).horizontal, -1)
  assert.equal(g.end(140, 180, 200), null)
})
test('a quick down flick drops on release without first lowering', () => {
  const g = gesture()
  assert.deepEqual(g.move(103, 180, 140), { horizontal: 0, down: 0 })
  assert.equal(g.end(103, 185, 180), 'drop')
})
test('slow downward drag lowers without hard drop', () => {
  const g = gesture()
  assert.deepEqual(g.move(103, 180, 450), { horizontal: 0, down: 4 })
  assert.equal(g.end(103, 185, 500), null)
})
test('up swipe holds; diagonal and short flicks do not drop', () => {
  assert.equal(gesture().end(100, 40, 150), 'hold')
  assert.equal(gesture().end(155, 165, 150), null)
  assert.equal(gesture().end(100, 140, 150), null)
})
