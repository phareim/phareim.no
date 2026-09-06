# Another World (1991) — research brief (2026-09-06, web research summary)

## Rendering
- Amiga 500, 320×200, 16 colours per palette (deliberately, for Atari ST parity). Indices 0–7 are base hues, 8–15 are the *lit* variants of the same hues: a built-in shade ramp. Index 0x10 = "add 8 to whatever is in the framebuffer" (translucency/light overlay).
- Several palettes per scene; palette swaps are how lighting events happen ("a cheap palette swap is enough to evoke a lightning strike" — Sanglard).
- Everything is flat-filled polygons. No dithering, no gradients, no outlines, no texture. First-level background ≈ 981 polygons. Painter's algorithm; static background composed once into a buffer, blitted each frame — which is why screens never scroll.
- Palette economy: Lester's red hair is the single saturated accent against a blue-grey world. His flesh tone doubles as the sunset highlight. The beast is ~3 colours (black, red eyes, off-white teeth).
- Fan-extracted approximate colours: steel blue #318CAF, arylide yellow #E5C96D, teal #79B8AA, blue #4DAAC5, pastel grey #D7C9BB, dark blue #305A8E (illustrative, not canonical).

## Cinematography
- Fixed, authored composition per screen. Hard cut between screens, never a pan. Horizon, vanishing point, negative space chosen per shot.
- Extreme long shots: Lester tiny against caves, alien cityscapes, a creature silhouette against lit sky.
- No text, no intelligible dialogue; story by blocking, silhouette, timing. ~90 s prologue before control.
- Chahi: subvert the expected next beat (hold Lester underwater one beat longer than expected).

## Movement
- Rotoscoped from Chahi filming himself: heavy, grounded cadence. Run, standing jump vs running long jump, crouch, later the pistol (shot / shield / charged beam).
- One hit kills; each death a distinct vignette. Death is *information* (contrast with Dragon's Lair spectacle). Checkpoints frequent; fatal geometry visible before it is lethal: "show the threat's shape before its motion".

## Sound
- Freitas: < 20 min of music total. Mostly silence + ambience. Music is an event.

## Kin
- Prince of Persia (1989, rotoscoping origin) → Another World (1991) → Flashback (1992, painted bitmaps, rotoscoped Conrad) → Blackthorne (1994) → Oddworld (1997) → Heart of Darkness (1998, "each screen like a painting", silhouette + directional light) → Limbo (2010) / Inside (2016) (value contrast instead of colour ramps).
- Chahi GDC 2011: "the real medium is the player's memory and imagination"; "polygons and only polygons"; "what would the player expect, and how do I subvert it"; colour is a shared scarce resource.
- cyxx/another_js runs the original bytecode on Canvas 2D: vertex lists, flat fill, 16-entry palette, cached background — the pipeline works natively in a <canvas>.

## Principles for a homage
1. Fixed screens, hard cuts. 2. ≤ 16 colours per scene. 3. Palette = base + lit ramp. 4. No outlines/dithering/gradients; a gradient is 2–3 flat bands. 5. Light = palette swap. 6. Silhouette character + one accent. 7. Character small; close framing only for a beat. 8. No HUD. 9. One hit kills, readable death, threat visible first. 10. Cheap checkpoints. 11. Weighty, key-posed motion. 12. Silence by default. 13. Cached background canvas. 14. Reuse palette entries across character/environment. 15. Cinematic via composition (low horizon, negative space, off-centre figure), not letterbox bars; on portrait phones author a tall composition, do not crop.

Sources: fabiensanglard.net/another_world_polygons, fabiensanglard.net/anotherWorld_code_review, gamedeveloper.com GDC 2011 postmortem, cheesetalks.net/anotherworld.php, cinematicplatformers.com, github.com/cyxx/another_js.
