import type { World } from './types'

// Another Shore — flat-polygon cinematic alien coast.
//
// Palette (exact, from DESIGN.md — no other fills used):
//   sky #254b59 · far rock #356372 · middle rock #203d49 · ground #101f2a
//   shadow #091720 · moon #a9b8ac · shirt #d88b73 · trousers #28303e
//   skin #ead7b4 · signal #e7bb80
//
// World units, y down. Player x/y is feet centre (body 22x52), ground ~y420,
// world height 540. Coordinates are CSS pixels; the caller applies the DPR
// transform. All geometry is deterministic (integer hashes) — nothing depends
// on Math.random, so there is no flicker between frames.

const SKY = '#254b59'
const FAR = '#356372'
const MID = '#203d49'
const GROUND = '#101f2a'
const SHADOW = '#091720'
const MOON = '#a9b8ac'
const SHIRT = '#d88b73'
const TROUSER = '#28303e'
const SKIN = '#ead7b4'
const SIGNAL = '#e7bb80'

const GROUND_Y = 420

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

// Deterministic 0..1 hash of an integer. Pure function of the index, so
// parallax scenery slides continuously and never pops or shimmers.
function hash(n: number): number {
  let x = (n | 0) * 2654435761
  x ^= x >>> 15
  x = (x * 2246822519) | 0
  x ^= x >>> 13
  return (x >>> 0) / 4294967296
}

export function drawWorld(
  ctx: CanvasRenderingContext2D,
  world: World,
  width: number,
  height: number,
): void {
  if (width <= 0 || height <= 0) return
  const p = world.player

  // Uniform scale from viewport height: the visible strip is always 560
  // world units tall, so ground sits near 75% of the screen with room above
  // for jumps. Capped so huge monitors don't blow up and tiny landscape
  // phones don't shrink into nothing.
  const s = clamp(height / 560, 0.55, 1.6)
  const visW = width / s
  const visH = height / s

  // Horizontal camera with lookahead: the player sits off-centre toward the
  // side they face/move, leaving ~60% of a narrow phone screen ahead so the
  // next landing stays visible. World-space, so portrait just crops width —
  // the game always stays horizontal.
  const vx = p.vx || 0
  const facing = p.facing < 0 ? -1 : 1
  // Velocity-based lookahead changes continuously when the player reverses.
  const anchor = 0.5 - clamp(vx / 250, -1, 1) * 0.16
  let camX = p.x - visW * anchor
  if (world.width > visW) camX = clamp(camX, -80, world.width - visW + 80)
  else camX = (world.width - visW) / 2

  // Keep the landing line fixed during jumps, above the phone controls.
  // Camera bobbing would hide the next landing behind the touch buttons.
  const camY = GROUND_Y - visH * 0.72

  const X = (wx: number): number => (wx - camX) * s
  const Y = (wy: number): number => (wy - camY) * s
  const groundScreenY = Y(GROUND_Y)

  ctx.save()
  ctx.lineJoin = 'miter'
  ctx.lineCap = 'butt'

  // --- Sky: vast petrol field ---
  ctx.fillStyle = SKY
  ctx.fillRect(0, 0, width, height)

  // --- Sparse flat stars, screen-fixed, upper sky only ---
  ctx.fillStyle = MOON
  for (let i = 0; i < 26; i++) {
    const sx = hash(i * 2 + 1) * width
    const sy = hash(i * 2 + 2) * height * 0.42
    const r = i % 5 === 0 ? 3 : 2
    ctx.fillRect(sx, sy, r, r)
  }

  // --- Oversized pale moon, off to the right ---
  const moonR = clamp(Math.min(width, height) * 0.17, 40, 170)
  const moonX = width * 0.74
  const moonY = height * (width < height ? 0.45 : 0.2)
  poly(ctx, disc(moonX, moonY, moonR, 28), MOON)

  const focusU = camX + visW / 2 // camera centre in world units

  // --- Far layer: eroded angular spires and arches (parallax 0.22) ---
  const f1 = 0.22
  const farBase = groundScreenY - height * 0.07
  const lx1 = (u: number): number => width / 2 + (u - focusU) * f1 * s
  const ly1 = (wy: number): number => farBase + (wy - GROUND_Y) * 0.6 * s
  drawFarSpires(ctx, lx1, ly1, focusU, visW / f1, s * f1)

  // --- Still sea: flat mass with horizontal strips + moon reflection ---
  const seaTop = farBase - 12 * s
  const seaBot = groundScreenY - height * 0.015
  if (seaBot > seaTop) {
    ctx.fillStyle = MID
    ctx.fillRect(0, seaTop, width, seaBot - seaTop)
    ctx.fillStyle = FAR
    const strips = 4
    for (let k = 0; k < strips; k++) {
      const yy = seaTop + ((seaBot - seaTop) * (0.2 + k * 0.2) + hash(950 + k) * 4)
      ctx.fillRect(0, yy, width, Math.max(2, 2.5 * s * 0.5))
    }
    // Moon reflection: short horizontal bars under the moon, narrowing down.
    const reflW = moonR * 1.5
    ctx.fillStyle = MOON
    for (let k = 0; k < 3; k++) {
      const w = reflW * (1 - k * 0.28)
      const yy = seaTop + (seaBot - seaTop) * (0.3 + k * 0.22)
      ctx.fillRect(moonX - w / 2, yy, w, Math.max(2, 2 * s * 0.5))
    }
  }

  // --- Middle layer: closer leaning slabs (parallax 0.5) ---
  const f2 = 0.5
  const midBase = groundScreenY - height * 0.015
  const lx2 = (u: number): number => width / 2 + (u - focusU) * f2 * s
  const ly2 = (wy: number): number => midBase + (wy - GROUND_Y) * f2 * s
  drawMidSlabs(ctx, lx2, ly2, focusU, visW / f2, s * f2)

  // --- Platforms: actual collision rects from world state ---
  const viewBot = camY + visH + 80
  for (let i = 0; i < world.platforms.length; i++) {
    drawPlatform(ctx, world.platforms[i], i, X, Y, viewBot, s)
  }

  // --- Hazards: jagged dark shards exactly inside their rects ---
  for (let i = 0; i < world.hazards.length; i++) {
    drawHazard(ctx, world.hazards[i], i, X, Y, s)
  }

  // --- Beacons: slender old signal pylons, amber when lit ---
  for (let i = 0; i < world.beacons.length; i++) {
    drawBeacon(ctx, world.beacons[i].x, world.beacons[i].y, world.beacons[i].lit, X, Y, s)
  }

  // --- Parallax foreground: sharp dark slabs along the bottom ---
  drawForeground(ctx, world.width, X, Y, viewBot, s)

  // --- Player: angular coral-shirt runner, 22x52, feet centre ---
  drawShadow(ctx, p.x, p.y, p.grounded, X, Y, s)
  drawPlayer(ctx, p.x, p.y, facing, p.grounded, Math.abs(vx) > 30, world.time, X, Y, s)

  ctx.restore()
}

// Eroded far towers: stepped sides, broken or pointed crowns; every fifth
// cell is a freestanding arch. Pure function of the cell index.
function drawFarSpires(
  ctx: CanvasRenderingContext2D,
  lx: (u: number) => number,
  ly: (wy: number) => number,
  focusU: number,
  span: number,
  k: number,
): void {
  const spacing = 190
  const i0 = Math.floor((focusU - span / 2) / spacing) - 1
  const i1 = Math.floor((focusU + span / 2) / spacing) + 1
  ctx.fillStyle = FAR
  for (let i = i0; i <= i1; i++) {
    const cx = (i + 0.5 + (hash(i * 3 + 1) - 0.5) * 0.5) * spacing
    const r1 = hash(i * 3 + 2)
    const r2 = hash(i * 3 + 3)
    const r3 = hash(i * 5 + 7)
    if (r1 < 0.2) {
      // Arch: two legs and a lintel, eroded inner corners.
      const wLeg = 26 + r2 * 20
      const gap = 60 + r3 * 50
      const h = 130 + r2 * 90
      const yB = GROUND_Y
      const x0 = cx - gap / 2 - wLeg
      path(ctx, [
        [lx(x0), ly(yB)],
        [lx(x0), ly(yB - h)],
        [lx(x0 + wLeg), ly(yB - h)],
        [lx(x0 + wLeg), ly(yB - h * 0.35)],
        [lx(x0 + wLeg + gap), ly(yB - h * 0.35)],
        [lx(x0 + wLeg + gap), ly(yB - h)],
        [lx(x0 + wLeg * 2 + gap), ly(yB - h)],
        [lx(x0 + wLeg * 2 + gap), ly(yB)],
        [lx(x0 + wLeg * 2 + gap - 14), ly(yB)],
        [lx(x0 + wLeg * 2 + gap - 14), ly(yB - h * 0.35 + 16)],
        [lx(x0 + wLeg + 14), ly(yB - h * 0.35 + 16)],
        [lx(x0 + wLeg + 14), ly(yB)],
      ])
      ctx.fill()
    } else {
      // Tower with stepped, eroded flanks.
      const w = 44 + r2 * 52
      const h = 120 + r3 * 150
      const lean = (r2 - 0.5) * 60
      const yB = GROUND_Y
      const steps = 3 + Math.floor(r3 * 3)
      const left: Array<[number, number]> = []
      const right: Array<[number, number]> = []
      for (let st = 0; st <= steps; st++) {
        const t = st / steps
        const wy = yB - h * t
        const inset = t * (10 + r1 * 26)
        const bite = (st % 2 === 0 ? 1 : -1) * (4 + r2 * 10) * t
        left.push([cx - w / 2 + inset + bite * 0.4 + lean * t, wy])
        right.push([cx + w / 2 - inset + bite + lean * t, wy])
      }
      // Broken crown: notch or single point.
      const crown: Array<[number, number]> = []
      if (r1 < 0.55) {
        const tipX = cx + lean + (r3 - 0.5) * 30
        crown.push([left[steps][0], left[steps][1]], [tipX, left[steps][1] - 26 - r2 * 30], [right[steps][0], right[steps][1]])
      } else {
        crown.push(
          [left[steps][0], left[steps][1]],
          [left[steps][0] + 8, left[steps][1] - 12],
          [right[steps][0] - 14, right[steps][1] - 4],
          [right[steps][0], right[steps][1]],
        )
      }
      const pts: Array<[number, number]> = []
      pts.push([lx(left[0][0]), ly(left[0][1])])
      for (let st = 1; st <= steps; st++) pts.push([lx(left[st][0]), ly(left[st][1])])
      for (const c of crown) pts.push([lx(c[0]), ly(c[1])])
      for (let st = steps; st >= 0; st--) pts.push([lx(right[st][0]), ly(right[st][1])])
      path(ctx, pts)
      ctx.fill()
      // Narrow sea-stack needle beside some towers.
      if (r3 > 0.55) {
        const nx = cx + w / 2 + 26 + r1 * 40
        const nh = h * (0.4 + r2 * 0.3)
        path(ctx, [
          [lx(nx - 9), ly(yB)],
          [lx(nx - 4), ly(yB - nh)],
          [lx(nx + 6), ly(yB - nh * 0.7)],
          [lx(nx + 9), ly(yB)],
        ])
        ctx.fill()
      }
    }
  }
  void k
}

// Closer slabs: tall leaning shards with notched tops, darker rock.
function drawMidSlabs(
  ctx: CanvasRenderingContext2D,
  lx: (u: number) => number,
  ly: (wy: number) => number,
  focusU: number,
  span: number,
  k: number,
): void {
  const spacing = 260
  const i0 = Math.floor((focusU - span / 2) / spacing) - 1
  const i1 = Math.floor((focusU + span / 2) / spacing) + 1
  ctx.fillStyle = MID
  for (let i = i0; i <= i1; i++) {
    const r1 = hash(i * 7 + 11)
    const r2 = hash(i * 7 + 12)
    if (r1 < 0.25) continue // gaps keep the sky vast
    const cx = (i + 0.5 + (r1 - 0.5) * 0.6) * spacing
    const w = 60 + r2 * 80
    const h = 70 + r1 * 130
    const lean = (r2 - 0.5) * 110
    const yB = GROUND_Y + 30 // feet sink behind the sea/ground line
    const notch = r2 > 0.5
    const top = yB - h
    const pts: Array<[number, number]> = [
      [lx(cx - w / 2), ly(yB)],
      [lx(cx - w / 2 + 12 + lean * 0.5), ly(top + h * 0.25)],
    ]
    if (notch) {
      pts.push(
        [lx(cx - w * 0.1 + lean * 0.8), ly(top)],
        [lx(cx + w * 0.05 + lean * 0.8), ly(top + 22)],
        [lx(cx + w * 0.2 + lean), ly(top)],
      )
    } else {
      pts.push([lx(cx + w * 0.05 + lean), ly(top - 14)])
    }
    pts.push(
      [lx(cx + w / 2 + lean), ly(top + h * 0.3)],
      [lx(cx + w / 2), ly(yB)],
    )
    path(ctx, pts)
    ctx.fill()
  }
  void k
}

// Platform body runs well below the viewport so sides read as cliffs; the
// top cap is a varied flat plane whose upper edge is exactly the collision
// line. Small pale ticks mark the corners so gaps read clearly.
function drawPlatform(
  ctx: CanvasRenderingContext2D,
  pl: { x: number; y: number; w: number; h: number },
  index: number,
  X: (wx: number) => number,
  Y: (wy: number) => number,
  viewBot: number,
  s: number,
): void {
  if (pl.w <= 0 || pl.h <= 0) return
  const x0 = X(pl.x)
  const x1 = X(pl.x + pl.w)
  const yT = Y(pl.y)
  const yB = Y(Math.max(pl.y + pl.h, viewBot))
  ctx.fillStyle = GROUND
  ctx.fillRect(x0, yT, x1 - x0, yB - yT)
  // Varied top plane: alternate the two rock tones, vary depth by hash.
  const capH = (5 + hash(index * 13 + 3) * 4) * s
  ctx.fillStyle = hash(index * 13 + 5) < 0.5 ? MID : FAR
  ctx.fillRect(x0, yT, x1 - x0, capH)
  // Inset angular facets below the edge — decoration only, corners crisp.
  ctx.fillStyle = SHADOW
  const facets = 1 + Math.floor(hash(index * 13 + 7) * 3)
  for (let f = 0; f < facets; f++) {
    const fx = x0 + (x1 - x0) * (0.15 + 0.7 * hash(index * 29 + f * 3 + 1))
    const fw = (10 + hash(index * 29 + f * 3 + 2) * 26) * s
    const fh = (8 + hash(index * 29 + f * 3 + 3) * 18) * s
    const fy = yT + capH + 3 * s
    ctx.beginPath()
    ctx.moveTo(fx, fy)
    ctx.lineTo(fx + fw, fy)
    ctx.lineTo(fx + fw * 0.6, fy + fh)
    ctx.closePath()
    ctx.fill()
  }
  // Pale corner ticks: the readable collision edge.
  ctx.fillStyle = MOON
  const tickW = Math.min(7 * s, (x1 - x0) / 2)
  const tickH = Math.max(2, 2.5 * s)
  ctx.fillRect(x0, yT, tickW, tickH)
  ctx.fillRect(x1 - tickW, yT, tickW, tickH)
}

// Hazard shard cluster, contained exactly in its rect: dark teeth with a
// pale glint on one flank each so the danger reads at a glance.
function drawHazard(
  ctx: CanvasRenderingContext2D,
  hz: { x: number; y: number; w: number; h: number },
  index: number,
  X: (wx: number) => number,
  Y: (wy: number) => number,
  s: number,
): void {
  if (hz.w <= 0 || hz.h <= 0) return
  const x0 = X(hz.x)
  const x1 = X(hz.x + hz.w)
  const yT = Y(hz.y)
  const yB = Y(hz.y + hz.h)
  ctx.fillStyle = SHADOW
  ctx.fillRect(x0, yT, x1 - x0, yB - yT)
  const n = Math.max(2, Math.round(hz.w / 26))
  for (let k = 0; k < n; k++) {
    const bx0 = hz.x + (hz.w * k) / n
    const bx1 = hz.x + (hz.w * (k + 1)) / n
    const apex = hz.x + (hz.w * (k + 0.3 + hash(index * 17 + k) * 0.4)) / n
    const tipY = hz.y + 2 + hash(index * 31 + k * 2) * hz.h * 0.25
    poly(ctx, [
      [X(bx0), Y(hz.y + hz.h)],
      [X(apex), Y(tipY)],
      [X(bx1), Y(hz.y + hz.h)],
    ], SHADOW)
    // Pale glint on the left flank.
    poly(ctx, [
      [X(bx0), Y(hz.y + hz.h)],
      [X(apex), Y(tipY)],
      [X(apex - (apex - bx0) * 0.35), Y(tipY + (hz.h - 2) * 0.55)],
      [X(bx0 + (bx1 - bx0) * 0.22), Y(hz.y + hz.h)],
    ], MOON)
  }
  void s
}

// Slender old signal pylon rising from its base point: tapered legs, a
// crossarm, an antenna rod, and a diamond lamp — amber when lit, pale when
// dark — plus an amber pennant on a lit tower. Steady, no blinking.
function drawBeacon(
  ctx: CanvasRenderingContext2D,
  bx: number,
  by: number,
  lit: boolean,
  X: (wx: number) => number,
  Y: (wy: number) => number,
  s: number,
): void {
  const H = 104 // pylon height in world units
  const top = by - H
  // Base plate.
  ctx.fillStyle = SHADOW
  ctx.fillRect(X(bx - 13), Y(by - 6), 26 * s, 6 * s)
  // Tapered legs.
  poly(ctx, [
    [X(bx - 9), Y(by - 6)],
    [X(bx - 2.5), Y(top + 18)],
    [X(bx + 2.5), Y(top + 18)],
    [X(bx + 9), Y(by - 6)],
  ], GROUND)
  // Cross braces.
  ctx.fillStyle = GROUND
  const braceH = Math.max(2, 3 * s)
  ctx.fillRect(X(bx - 6), Y(by - 44), 12 * s, braceH)
  ctx.fillRect(X(bx - 4.5), Y(by - 72), 9 * s, braceH)
  // Crossarm.
  ctx.fillRect(X(bx - 15), Y(top + 26), 30 * s, braceH)
  // Antenna rod up to the lamp.
  ctx.fillRect(X(bx - 1.2), Y(top), 2.4 * s, (18) * s)
  // Lamp diamond.
  const lr = (lit ? 8 : 6) * s
  const cx = X(bx)
  const cy = Y(top - 4)
  poly(ctx, [
    [cx, cy - lr],
    [cx + lr * 0.7, cy],
    [cx, cy + lr],
    [cx - lr * 0.7, cy],
  ], lit ? SIGNAL : MOON)
  // Lamp housing cap.
  ctx.fillStyle = GROUND
  ctx.fillRect(X(bx - 3), Y(top - 4) - lr - 3 * s, 6 * s, 3 * s)
  if (lit) {
    // Amber pennant streaming right, and a small mast dot.
    poly(ctx, [
      [X(bx + 1), Y(top + 8)],
      [X(bx + 26), Y(top + 13)],
      [X(bx + 1), Y(top + 18)],
    ], SIGNAL)
    ctx.fillStyle = SIGNAL
    const dr = 2.2 * s
    ctx.fillRect(cx - dr / 2, Y(by - 60) - dr / 2, dr, dr)
  }
  void s
}

// Sharp near-black slabs world-anchored along the bottom: they frame the
// shot and glide past faster than the playfield. Kept below y~470 so they
// never cover the player; drawn before the player anyway.
function drawForeground(
  ctx: CanvasRenderingContext2D,
  worldWidth: number,
  X: (wx: number) => number,
  Y: (wy: number) => number,
  viewBot: number,
  s: number,
): void {
  const spacing = 430
  const i0 = Math.floor((X(0) / s - spacing) / spacing) - 1
  void i0
  const n = Math.ceil(worldWidth / spacing) + 3
  const start = -spacing
  ctx.fillStyle = SHADOW
  for (let i = 0; i < n; i++) {
    const r1 = hash(i * 11 + 21)
    const r2 = hash(i * 11 + 22)
    const r3 = hash(i * 11 + 23)
    if (r1 < 0.3) continue
    const sx = start + i * spacing + r2 * 160
    const w = 130 + r3 * 110
    const topY = 468 + r1 * 34
    const peak = topY - 14 - r2 * 26
    const px = sx + w * (0.3 + r3 * 0.4)
    path(ctx, [
      [X(sx), Y(viewBot)],
      [X(sx + 10), Y(topY)],
      [X(px), Y(peak)],
      [X(sx + w - 14), Y(topY + 8)],
      [X(sx + w), Y(viewBot)],
    ])
    ctx.fill()
  }
}

// Soft contact shadow: a flat dark ellipse exactly at the feet when grounded.
function drawShadow(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  grounded: boolean,
  X: (wx: number) => number,
  Y: (wy: number) => number,
  s: number,
): void {
  if (!grounded) return
  ctx.fillStyle = SHADOW
  ctx.beginPath()
  ctx.ellipse(X(px), Y(py) - 1.5 * s, 13 * s, 3.2 * s, 0, 0, Math.PI * 2)
  ctx.fill()
}

// Angular human, 22 wide x 52 tall, feet at (px, py). Coral shirt torso,
// dark trousers, skin head and hands. Limbs are two-segment flat quads
// driven by a stride phase from world.time when running; tucked when
// airborne; quiet standing pose otherwise. Mirrored by facing.
function drawPlayer(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  facing: number,
  grounded: boolean,
  running: boolean,
  time: number,
  X: (wx: number) => number,
  Y: (wy: number) => number,
  s: number,
): void {
  const f = facing < 0 ? -1 : 1
  const t = Number.isFinite(time) ? time : 0
  const phase = running && grounded ? t * 11 : 0
  // Local frame: u right (pre-mirror), v up from the feet.
  const U = (u: number): number => X(px + u * f)
  const V = (v: number): number => Y(py - v)

  const bob = !running && grounded ? Math.sin(t * 2) * 0.8 : 0
  const lean = running ? 3 : grounded ? 1 : 4
  const hipY = 26 + bob * 0.4
  const shoY = 42 + bob

  // Back limbs first (darker), then torso, head, then front limbs.
  const swingA = running && grounded ? Math.sin(phase) : 0
  const swingB = running && grounded ? Math.sin(phase + Math.PI) : 0

  if (!grounded) {
    // Airborne: front leg driving forward-up, back leg trailing, arms out.
    leg(ctx, U, V, s, -3, hipY, 7, 20, 12, 12, TROUSER, true)
    leg(ctx, U, V, s, 3, hipY, -6, 16, -11, 8, TROUSER, true)
    arm(ctx, U, V, s, -4, shoY, -10, shoY - 8, -14, shoY - 2, true)
  } else if (running) {
    leg(ctx, U, V, s, -3.5, hipY, swingA * 10, 13 + Math.max(0, swingB) * 8, swingA * 12, 0, TROUSER, true)
    arm(ctx, U, V, s, -5, shoY, swingB * 8, shoY - 9, swingB * 11, shoY - 16, true)
  } else {
    leg(ctx, U, V, s, -3.5, hipY, -3.5, 13, -3.5, 0, TROUSER, true)
    arm(ctx, U, V, s, -5, shoY, -6, shoY - 10, -6, shoY - 18, true)
  }

  // Torso: angular coral shirt, leaning into the run.
  poly(ctx, [
    [U(-5), V(hipY)],
    [U(5), V(hipY)],
    [U(7 + lean), V(shoY)],
    [U(-6 + lean), V(shoY)],
  ], SHIRT)
  // Shirt skirt wedge over the hips.
  poly(ctx, [
    [U(-5), V(hipY)],
    [U(5), V(hipY)],
    [U(4 + lean * 0.4), V(hipY - 6)],
    [U(-4 + lean * 0.4), V(hipY - 6)],
  ], SHIRT)

  // Head: angular skin profile looking forward, dark hair cap.
  const hx = 1.5 + lean * 0.7
  const hy = shoY + 5.5
  poly(ctx, [
    [U(hx - 4.5), V(hy - 4)],
    [U(hx - 4), V(hy + 3)],
    [U(hx - 1), V(hy + 5)],
    [U(hx + 3.5), V(hy + 3.5)],
    [U(hx + 5.5), V(hy + 0.5)],
    [U(hx + 3), V(hy - 1.5)],
    [U(hx + 2), V(hy - 4)],
  ], SKIN)
  poly(ctx, [
    [U(hx - 4.5), V(hy - 1)],
    [U(hx - 4), V(hy + 3.5)],
    [U(hx - 0.5), V(hy + 5.2)],
    [U(hx + 2.5), V(hy + 2.5)],
    [U(hx - 1), V(hy + 1)],
    [U(hx - 3), V(hy - 3.5)],
  ], SHADOW)

  // Front limbs over the torso.
  if (!grounded) {
    arm(ctx, U, V, s, 5, shoY, 11, shoY + 2, 9, shoY - 8, false)
  } else if (running) {
    arm(ctx, U, V, s, 5, shoY, swingA * 8, shoY - 9, swingA * 11, shoY - 16, false)
  } else {
    arm(ctx, U, V, s, 5, shoY, 6, shoY - 10, 6, shoY - 18, false)
  }
  if (grounded) {
    if (running) {
      leg(ctx, U, V, s, 3.5, hipY, swingB * 10, 13 + Math.max(0, swingA) * 8, swingB * 12, 0, TROUSER, false)
    } else {
      leg(ctx, U, V, s, 3.5, hipY, 3.5, 13, 3.5, 0, TROUSER, false)
    }
  }
}

// Two-segment leg: hip (hu,hv) -> knee (ku,kv) -> foot (fu,fv) in local
// units. Drawn as flat angular quads (trousers) plus a dark boot wedge.
function leg(
  ctx: CanvasRenderingContext2D,
  U: (u: number) => number,
  V: (v: number) => number,
  s: number,
  hu: number, hv: number,
  ku: number, kv: number,
  fu: number, fv: number,
  color: string,
  back: boolean,
): void {
  void back
  const w1 = 3.1 * s
  const w2 = 2.5 * s
  ctx.strokeStyle = color
  ctx.lineCap = 'butt'
  ctx.lineWidth = w1
  ctx.beginPath()
  ctx.moveTo(U(hu), V(hv))
  ctx.lineTo(U(ku), V(kv))
  ctx.stroke()
  ctx.lineWidth = w2
  ctx.beginPath()
  ctx.moveTo(U(ku), V(kv))
  ctx.lineTo(U(fu), V(Math.max(0.5, fv)))
  ctx.stroke()
  // Boot: small dark wedge at the foot, pointing forward.
  const fwd = 4
  poly(ctx, [
    [U(fu - 2), V(Math.max(0.5, fv))],
    [U(fu + fwd), V(Math.max(0.5, fv))],
    [U(fu + fwd), V(Math.max(0.5, fv) + 3)],
    [U(fu - 2), V(Math.max(0.5, fv) + 3)],
  ], SHADOW)
}

// Two-segment arm: shoulder -> elbow -> hand. Upper arm shirt sleeve, flat
// skin quad for the forearm, square skin hand.
function arm(
  ctx: CanvasRenderingContext2D,
  U: (u: number) => number,
  V: (v: number) => number,
  s: number,
  su: number, sv: number,
  eu: number, ev: number,
  hu: number, hv: number,
  back: boolean,
): void {
  void back
  ctx.strokeStyle = SHIRT
  ctx.lineCap = 'butt'
  ctx.lineWidth = 2.8 * s
  ctx.beginPath()
  ctx.moveTo(U(su), V(sv))
  ctx.lineTo(U(eu), V(ev))
  ctx.stroke()
  ctx.strokeStyle = SKIN
  ctx.lineWidth = 2.2 * s
  ctx.beginPath()
  ctx.moveTo(U(eu), V(ev))
  ctx.lineTo(U(hu), V(hv))
  ctx.stroke()
  ctx.fillStyle = SKIN
  const hr = 1.8 * s
  ctx.fillRect(U(hu) - hr / 2, V(hv) - hr / 2, hr, hr)
}

// Flat polygon fill from mixed world/screen points (already transformed).
function poly(ctx: CanvasRenderingContext2D, pts: Array<[number, number]>, color: string): void {
  if (pts.length < 3) return
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.closePath()
  ctx.fill()
}

function path(ctx: CanvasRenderingContext2D, pts: Array<[number, number]>): void {
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.closePath()
}

// Flat n-sided disc (no arcs-as-curves styling issue: fill only, no glow).
function disc(cx: number, cy: number, r: number, n: number): Array<[number, number]> {
  const pts: Array<[number, number]> = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r])
  }
  return pts
}
