#!/usr/bin/env node
// Draw calls and triangles per model-lab page (renderer.info after a frame).
//   flock /tmp/claude-1000/chrome.lock node scripts/starfox-lab/info.mjs <query> [query …]
import { launch } from '../zelda-lab/cdp.mjs'
const base = process.env.BASE ?? 'http://127.0.0.1:3041'
const b = await launch({ width: 1280, height: 800 })
try {
  for (const q of process.argv.slice(2)) {
    await b.goto(`${base}/?theme=starfox&lab=models&${q}`)
    await b.sleep(5000)
    const r = await b.eval(`(() => {
      const L = window.__lab; if (!L) return 'no lab'
      L.renderer.info.autoReset = false; L.renderer.info.reset()
      return new Promise(res => requestAnimationFrame(() => requestAnimationFrame(() => {
        const i = L.renderer.info.render
        // per top-level model: meshes + triangles
        const per = []
        for (const o of L.scene.children) {
          let meshes = 0, tris = 0
          o.traverse(m => { if (m.isMesh && m.geometry) { meshes++; const g = m.geometry; const n = g.index ? g.index.count : g.attributes.position.count; tris += n / 3 * (m.isInstancedMesh ? 1 : 1) } })
          if (meshes && (o.name || o.type === 'Group')) per.push((o.name || o.type) + ':' + meshes + 'm/' + tris + 't')
        }
        res({ calls: i.calls / 2, triangles: Math.round(i.triangles / 2), fps: 0, per: per.slice(0, 40).join(' ') })
      })))
    })()`)
    console.log(q, JSON.stringify(r))
  }
} finally { await b.close() }
