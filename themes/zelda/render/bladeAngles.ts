/** Blade angles in screen space. The atlas's intermediate shapes point up and right. */
const SHAPES = ['h', 'e1', 'd', 'e2', 'v'] as const

export function bladeHeading(angle: number) {
  const step = ((Math.round(angle / (Math.PI / 8)) % 16) + 16) % 16
  const half = step % 8
  return {
    name: `sword_${SHAPES[Math.min(half, 8 - half)]}`,
    fh: step >= 4 && step < 12,
    fv: step > 0 && step < 8,
  }
}

function blade(angle: number, density: number, arc: boolean) {
  // Draw the grip, guard, fuller and facets in blade coordinates directly on
  // each target grid. A steep blade gets a portrait cell to keep its reach.
  const shallow = angle < Math.PI / 4
  const w = shallow ? 13 : 10
  const h = shallow ? 10 : 13
  const dx = Math.cos(angle)
  const dy = -Math.sin(angle)
  const pale = density > 1 ? (arc ? 'Q' : 'L') : arc ? 'y' : 'c'
  const light = arc ? 'y' : 'c'
  const shade = arc ? 'v' : 'C'
  const dark = density > 1 ? (arc ? 'V' : 'D') : shade
  const pixel = (x: number, y: number) => {
    const u = x * dx + y * dy
    const v = -x * dy + y * dx
    const across = Math.abs(v)
    if (u >= -5.95 && u < -4.7 && across <= 1.2) return across < 0.6 ? 'y' : 'k'
    if (u >= -4.7 && u < -3.5 && across <= 0.62) return 'n'
    if (u >= -3.6 && u < -2.35 && across <= 2.75 - Math.abs(u + 2.9) * 0.95) {
      return across < 0.55 || across > 2 ? 'y' : 'Y'
    }
    if (u >= -2.35 && u < 6.15 && across <= Math.min(1.5, 0.25 + (6.15 - u) * 0.74)) {
      if (across < 0.51) return 'w'
      if (v < 0) return across < 1.02 ? pale : light
      return across < 1.02 ? shade : dark
    }
    return '.'
  }
  return Array.from({ length: h * density }, (_, y) =>
    Array.from({ length: w * density }, (_, x) =>
      pixel((x + 0.5) / density - w / 2, (y + 0.5) / density - h / 2)).join(''))
}

export function intermediateBlades(density: number): Record<string, string[]> {
  return {
    sword_e1: blade(Math.PI / 8, density, false),
    sword_e2: blade(Math.PI * 3 / 8, density, false),
    sword2_e1: blade(Math.PI / 8, density, true),
    sword2_e2: blade(Math.PI * 3 / 8, density, true),
  }
}
