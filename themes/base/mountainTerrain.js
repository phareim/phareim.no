/** Deterministic heightfield, projected through a small perspective camera.
 * Canvas consumers share real XYZ terrain without needing a WebGL context.
 */
export function createMountainTerrain() {
  const cols = 96, rows = 14
  const vertices = []
  const faces = []
  const hash = (x, z) => {
    const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
    return n - Math.floor(n)
  }
  for (let row = 0; row <= rows; row++) {
    const z = 5 + row * (23.8 / rows)
    for (let col = 0; col <= cols; col++) {
      // Staggered, irregular vertices avoid a regular sawtooth skyline.
      const x = (col / cols - .5) * 110 + (hash(col, row) - .5) * .65
      const envelope = Math.sin(Math.PI * row / rows) ** .85
      const peak = hash(col + 19, row + 7)
      const ridge = Math.max(0, 1 - Math.abs(Math.sin(x * .39 + z * .27)))
      const y = .12 + envelope * (.45 + ridge * 2.2 + peak ** 3 * 4.8)
      vertices.push({ x, y, z })
    }
  }
  // Back to front: opaque dark faces hide rear edges; violet lines reveal the mesh.
  for (let row = rows - 1; row >= 0; row--) {
    for (let col = 0; col < cols; col++) {
      const a = row * (cols + 1) + col, b = a + 1, c = a + cols + 1, d = c + 1
      for (const ids of [[a, c, b], [b, c, d]]) {
        const [p, q, r] = ids.map(i => vertices[i])
        const ux = q.x - p.x, uy = q.y - p.y, uz = q.z - p.z
        const vx = r.x - p.x, vy = r.y - p.y, vz = r.z - p.z
        const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
        const light = Math.max(0, (nx * .55 + ny * .75 + nz * .35) / Math.hypot(nx, ny, nz))
        const haze = row / rows
        faces.push({ ids, edge: `rgba(177,105,245,${.22 + light * .26 - haze * .12})`, color: `rgb(${Math.round(9 + light * 5 + haze * 5)},${Math.round(5 + light * 3 + haze * 2)},${Math.round(20 + light * 9 + haze * 9)})` })
      }
    }
  }
  const projected = vertices.map(() => ({ x: 0, y: 0 }))
  return {
    // Highest tip across the middle of the sun, in screen pixels above ground.
    // Use the resting camera so steering never makes the sun bob up and down.
    crestHeight(width, height, centerX, radius) {
      const focal = Math.max(width * .7, height * .65)
      const vertical = Math.min(height * .5, width * .7)
      let crest = 0
      for (const v of vertices) {
        const x = width / 2 + v.x * focal / v.z
        if (Math.abs(x - centerX) < radius * .8) crest = Math.max(crest, v.y * vertical / v.z)
      }
      return crest
    },
    draw(ctx, width, height, horizon, viewX, viewY) {
      const focal = Math.max(width * .7, height * .65)
      const vertical = Math.min(height * .5, width * .7)
      for (let i = 0; i < vertices.length; i++) {
        const v = vertices[i], p = projected[i]
        p.x = width / 2 + (v.x - viewX * .65) * focal / v.z
        p.y = horizon - (v.y + viewY * .12) * vertical / v.z
      }
      ctx.save()
      ctx.beginPath(); ctx.rect(0, 0, width, horizon); ctx.clip()
      for (const face of faces) {
        const a = projected[face.ids[0]], b = projected[face.ids[1]], c = projected[face.ids[2]]
        if (Math.max(a.x, b.x, c.x) < 0 || Math.min(a.x, b.x, c.x) > width) continue
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.closePath()
        ctx.fillStyle = face.color
        ctx.fill()
        // Fine edges keep the triangulation legible without glow or bright filled facets.
        ctx.strokeStyle = face.edge; ctx.lineWidth = .75; ctx.stroke()
      }
      ctx.restore()
    },
  }
}
