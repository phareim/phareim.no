# Image-to-3D mesh: candidates for a local rig (research 2026-09-29)

Goal (Petter, 2026-09-29): see whether a usable image-to-3D model can run on
the M5 MacBook Pro (32 GB, Xcode 27 with Metal toolchain, 593 GB free, `uv`
present, no conda) and compare it with what we already have from WaveSpeed
(TRELLIS, run via Sleeper). Wanted: a rig where owned hardware makes the
artifacts we need. Art direction is negotiable: cosy inside the starter
village's walls, bolder Krea 2 artwork outside them.

Status: **research only, nothing installed yet.** Written on the M5 machine,
which may disappear, so this file is the record. Sources at the bottom.

Scope note (Petter, 2026-09-29): this is a hobby project, **not commercial**.
Non-commercial licence clauses (RMBG-2.0, DINOv3 terms) are therefore not
blockers. Hunyuan's regional exclusion names the EU, UK and South Korea;
Norway is in none of them, so it may be usable too, but check the licence text
before relying on that.

Install started 2026-09-29 in `~/3d-lab/image-to-3dlab` on the M5 (HF login for
`phareim` present). Test inputs: latest uploads in fixer.ink, e.g.
`https://gallery.fixer.ink/?item=i17183`.

## Candidates (all open weights, all single-image)

| Model | Mac path | Time on base M5 32 GB* | Licence | Notes |
|---|---|---|---|---|
| **Pixal3D** (TencentARC, SIGGRAPH 2026) | GGML/C++ backend in image-to-3dlab | ~6 min | MIT code + weights; DINOv3 encoder has its own licence | Paper scores well ahead of TRELLIS and Hunyuan 2.1. Keeps flat saturated colour in one pass, which suits stylised art. Described as experimental, mesh artifacts happen. Sources call it the best starting point. |
| **TRELLIS.2** (Microsoft) | `trellis-mac` (PyTorch MPS port) or image-to-3dlab | 15-35 min in the lab; ~5 min on an M4 Pro per the port's README | MIT; DINOv3 and RMBG-2.0 gated, RMBG-2.0 needs a commercial licence beyond personal use | Same family as what WaveSpeed runs, so the fairest like-for-like. Port limits: no hole-filling, unoptimised sparse attention, meshes decimated ~800K to ~200K faces before baking. Often needs a separate repaint. |
| **Hunyuan3D 2.0/2.1** (Tencent) | Hunyuan3D-MLX forks | ~9 min | Tencent Community Licence, **not licensed in EU/UK/South Korea** | Highest quality ceiling in hosted comparisons, up to 8K textures; 2mv variant takes multi-view input. The EU exclusion makes it a poor fit for a site run from Norway. |
| **Stable Fast 3D** | image-to-3dlab | seconds to a minute | Stability community licence | Lowest fidelity. Useful as a fast preview or for props. |
| Hunyuan3D 3.0, Rodin, Tripo, Meshy | hosted only | n/a | n/a | Not local. Meshy has retopo and rigging in one flow. |

*Timings from the image-to-3dlab README, which measured on a base M5 with
32 GB, the same chip and RAM as this machine.

**Wrapper worth using: [image-to-3dlab](https://github.com/Bingeljell/image-to-3dlab)**
runs Pixal3D, TRELLIS.2, Hunyuan3D-MLX and SF3D behind one CLI and a web
viewer, writes a `.provenance.json` with licences next to every GLB, and has
retopology, repaint and Blender rigging helpers. Needs full Xcode (present),
`uv`, Python 3.11/3.12, about 13 GB (Hunyuan) + 14 GB (TRELLIS) of weights.

## What "faster than the other Mac" means here

This M5 is not a GPU miracle. The lab's own numbers are minutes per asset,
not seconds, and an RTX 4090 is ~2x faster on Pixal3D. The win is that it is
a free, idle 32 GB machine: batch overnight, and no per-asset WaveSpeed cost.
Petter's own Mac already runs Krea 2 locally (`wave --local --model krea`
via `wave-mac`, mflux q4; ~4.5 min per image, see `docs/games/hall-of-fame.md`),
so GPU time on the two machines needs sharing, and the Mac's GPU measure lock
applies there. `wave` and `mflux` are not installed on this M5.

## Art-direction hypotheses to test

1. **Inside the walls (cosy):** flat colour, soft shapes, low-poly, thick
   silhouettes, one subject on a plain background, three-quarter view, no
   thin parts. Toon and low-poly inputs are where TRELLIS-family models do
   best. Pixal3D's flat-colour behaviour should suit it too.
2. **Outside the walls (bolder):** Krea 2 painterly art is the interesting
   input. Painterly shading is baked light, so expect the model to bake
   shadows into the texture. Test with and without a de-lit / flat-shaded
   Krea prompt.
3. Input rules that help every model: clean background (or pre-masked PNG),
   centred, whole subject in frame, neutral lighting, symmetrical pose,
   limbs apart from the body (A-pose), no cast shadows.

## Proposed test plan

- 6 inputs: 3 of the existing Eventyrland figures' source images (the ones
  WaveSpeed TRELLIS already made GLBs from) and 3 Krea 2 pictures.
- Runs: Pixal3D and TRELLIS.2 locally; compare with the existing WaveSpeed GLBs.
- Judge on: silhouette faithfulness, back-side plausibility, texture
  sharpness, baked-shadow contamination, face count and whether it is
  animation-ready, seconds and RAM per asset.
- Record per run: model, seed, time, peak RAM, face count, licence sidecar.
  Put results in `docs/3d-mesh-results.md` and GLBs outside git (large).

## Open questions and blockers

- HuggingFace login is needed for gated DINOv3 (and RMBG-2.0 for TRELLIS).
  This has to be Petter's own account, since it means accepting licences.
- RMBG-2.0 is non-commercial. BiRefNet (224 MB, used by image-to-3dlab) is a
  drop-in for background removal.
- Where the existing source images and WaveSpeed GLBs live (Sleeper). This
  machine cannot read them yet.
- The journal CLI (`journal`, `recall`) is not on this machine, so no
  journal note was written from here.

## Sources

- [Pixal3D repo (TencentARC)](https://github.com/TencentARC/Pixal3D) and [paper](https://arxiv.org/pdf/2605.10922)
- [image-to-3dlab](https://github.com/Bingeljell/image-to-3dlab/)
- [trellis-mac](https://github.com/shivampkumar/trellis-mac)
- [3D AI Studio: Pixal3D vs Trellis 2 vs Hunyuan 3D](https://www.3daistudio.com/blog/pixal3d-vs-trellis-2-vs-hunyuan-3d-comparison)
- [Scenario: comparing generative 3D models](https://help.scenario.com/articles/1263568892-comparing-generative-3d-models)
- [Hunyuan3D 2.1 paper](https://arxiv.org/pdf/2506.15442)
