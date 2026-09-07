/** Deterministic heightfield, projected through a small perspective camera.
 * Canvas consumers share real XYZ terrain without needing a WebGL context.
 */
export function createMountainTerrain() {
  const cols = 112, rows = 18
  const vertices = []
  const faces = []
  const noise = (x, z) => Math.sin(x * 1.7 + z * .8) * .52 + Math.sin(x * 4.3 - z * 2.1) * .26 + Math.sin(x * 9.1 + z * 5.3) * .12
  for (let row = 0; row <= rows; row++) {
    const z = 5 + row * (23.8 / rows)
    for (let col = 0; col <= cols; col++) {
      const x = (col / cols - .5) * 110
      const ridge = Math.pow(Math.max(0, Math.sin(x * .24 + z * .31) * .5 + .5), 2)
      const envelope = Math.sin(Math.PI * row / rows) ** .7
      const y = .12 + envelope * (1.1 + ridge * 3.5 + noise(x, z) * .8)
      vertices.push({ x, y, z })
    }
  }
  // Back to front; each surface is lit from the upper right, with distant haze.
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
        faces.push({ ids, color: `rgb(${Math.round(15 + light * 33 + haze * 12)},${Math.round(8 + light * 15 + haze * 6)},${Math.round(29 + light * 40 + haze * 20)})` })
      }
    }
  }
  const projected = vertices.map(() => ({ x: 0, y: 0 }))
  return {
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
        // Same-colour hairline closes raster seams without a wireframe overlay.
        ctx.strokeStyle = face.color; ctx.lineWidth = .6; ctx.stroke()
      }
      ctx.restore()
    },
  }
}
