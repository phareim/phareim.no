# Rerun Estates' kit (frontierArt/rerun.ts -> rerunData.ts): one suburban house per era on the same footprint, drawn
# by day with its windows UNLIT (the `_night` house is the same drawing with the windows lit: lamplight, the west front
# window a TV's cold blue, a line of light under the garage door), and the lawn things: mailbox, phone booth (ice-blue
# light), station wagon, flamingo, the sprinkler's two frames, the lawnmower.
from head import HEAD  # noqa: F401

REFS = {'concept.png': 'docs/worlds/img/concept-rerun.jpg', 'style.png': 'scripts/zelda-lab/codex/style.png'}
SUBURB = """A dreamlike looping suburb at dusk, as in concept.png: neat lawns, pastel houses, low sun, a faint neon glow."""
WINDOWS = """The windows (where the guide has its window panes: two on the front of the house facing the viewer's lower left, one on the side facing the viewer's lower right) are UNLIT: dark blue glass (#14183a, #222a5a, #34427a) with a faint pale-blue sky reflection in one corner, in window frames with mullions as in the guide. No light behind them."""
HOUSE = """The house: a one-storey suburban ranch house exactly the guide's shape: the long main block on the left, the attached garage block on the right with its wide roll-up garage door facing the viewer's lower left, the front door in the main block's front wall, a concrete footing round it, a short concrete path from the front door, as in the guide."""
GARAGE = """The garage door: horizontal pale panels (#a8a4b8, #c8c4d8, #6e6a84 seams), closed."""

def house(name, era_desc):
    return dict(size=(1536, 1024), pitch=8, ids=[name], n='one object', every='the house', what='a suburban ranch house',
                desc=f"""{SUBURB}
{HOUSE}
{era_desc}
{WINDOWS}
{GARAGE}""")

SHEETS = {
 'house1958': house('rerun_house_1958', """Era: 1958, FRESH PAINT. Siding of horizontal clapboards freshly painted warm cream-yellow (#7a5a2a shade, #c8a050, #e8c878, #fff0b0 lit), crisp white trim and window frames, a brown shingle roof (#3a2216, #5a3622, #7a4a2e, #9a6a40 lit) in neat courses, a red brick chimney (#5a1e14, #8a3222, #b04a30) where the guide has its chimney, a mint-green front door; the garage is an open-fronted CARPORT: a flat roof on slim white posts over the garage's footprint, so the dark carport floor shows between them (keep the guide's outline)."""),
 'house1986': house('rerun_house_1986', """Era: 1986, NEON-TRIMMED. Siding of horizontal boards painted raspberry red (#4a0e22 shade, #7a1a36, #a8264a, #cc4466 lit) with a thin hot-pink neon trim tube along the roof's eaves (unlit by day: a pale rose-grey tube, #8a5a78, #b08aa0), a deep indigo-violet shingle roof (#1a1438, #2a2258, #3c3478, #5a50a0 lit ridges), a SATELLITE DISH (a white dish on a short mast, #c8c4d8, #e8e4f4, #8a86a0) on the roof where the guide has its aerial, a teal front door."""),
 'house2086': house('rerun_house_2086', """Era: 2086, SLEEK WHITE. Smooth white composite panels (#8a88a4 shade, #c4c2d8, #e4e2f2, #ffffff lit) with fine seams, a low flat roof of deep indigo, the big pale slab on the roof (where the guide has it) a field of SOLAR TILES: dark blue-black glass tiles (#0e1430, #1a2450, #2a3a78) in a neat grid with thin silver lines and a sky-blue sheen, a thin cyan light strip (#2ff3ff) along the solar field's front edge, the only light on the house; a sleek dark front door; the garage door a smooth white panel door."""),
 'house0': house('rerun_house_0', """An ordinary house of the Estates: siding of horizontal boards painted brick red (#4a1418 shade, #7a2428, #a03a3a, #c45a54 lit), white trim, a deep indigo-violet shingle roof (#1a1438, #2a2258, #3c3478, #5a50a0 lit ridges), a TV aerial on the roof where the guide has it, a pale blue front door, a little flower bed by the door."""),
 'house1': house('rerun_house_1', """An ordinary house of the Estates with a hipped roof: siding of horizontal boards painted sea-green (#0e3a34 shade, #1a5e52, #2a8a74, #5ab89a lit), white trim, a pale lilac-grey shingle roof (#4a4668 shade, #6e6a90, #9490b8, #bcb8dc lit) stepping in on every side, a TV aerial on the roof where the guide has it, a yellow front door."""),
 'lawn': dict(size=(1536, 1024), pitch=12, ids=['rerun_mailbox', 'rerun_flamingo', 'rerun_lawnmower', 'rerun_phone_booth'], n='four objects', every='all four objects',
   what='a mailbox, a lawn flamingo, a lawnmower and a phone booth',
   names={'rerun_mailbox': 'mailbox', 'rerun_flamingo': 'flamingo', 'rerun_lawnmower': 'lawnmower', 'rerun_phone_booth': 'phone booth'},
   desc=f"""{SUBURB}
1: a classic rounded-top suburban mailbox of pale silver-grey metal (#5a5872, #8e8ca8, #c4c2d8, #eceaf8 lit) on a wooden post (#4a2a1a, #6a4228, #8e5e38), its little red flag (#8a1a2a, #c8304a) raised.
2: a pink plastic lawn flamingo (#8a1a5a, #d0407a, #ff7ab0, #ffc0dc lit) standing on two thin wire legs, black beak tip.
3: a red push lawnmower (#5a1010, #9a1e1e, #d03a30, #ff6a50 lit) with a silver motor housing, four small black wheels and a tall chrome handle.
4: a telephone booth: a tall booth of glossy hot-pink painted metal (#5a0e3a, #9a1a5e, #d0307e, #ff6aa8 lit), its glass panes ice-blue (#2a6a8a, #5ab4d8, #a8e4ff, #e0f8ff), lit from inside by a cold ice-blue light: the panes glow, a black phone inside seen through the glass; a sign box on top reading PHONE in pale glowing letters (that word is part of the booth; no other text); a small gold coin plate by the door."""),
 'wagon': dict(size=(1536, 1024), pitch=11, ids=['rerun_station_wagon', 'rerun_sprinkler_0', 'rerun_sprinkler_1'], n='three objects', every='all three objects',
   what='a station wagon and two frames of a lawn sprinkler', names={'rerun_station_wagon': 'station wagon', 'rerun_sprinkler_0': 'first sprinkler frame', 'rerun_sprinkler_1': 'second sprinkler frame'},
   desc=f"""{SUBURB}
Left: a 1970s American station wagon: a long body painted burnt orange (#5a2410, #9a4220, #d06a34, #f09a5a lit) with wood-grain side panels (#4a2a16, #7a4a26, #a0703a), a pale tan roof with a chrome roof rack, dark-tinted windows with a pale sky reflection (unlit), chrome bumpers, round gold headlights at the front (lower right), four black tyres with silver hubcaps.
Middle and right: two frames of ONE oscillating lawn sprinkler: a small dark base on the grass, a silver pipe with a gold sprinkler bar on top, and thin arcs of water drops spraying out of it (pale water: #6ab4d8, #a8e0ff, #e8faff, single drops and short dashes) exactly where the guide has its drops: in the left frame the arcs spray out wide to the left and right, in the right frame they spray towards and away from the viewer. The water does not glow."""),
 # Round 4 (2026-11-26): THE DRIVE-IN's screen (5 tiles long, 4 tall). Drawn twice to choose: at the game's px on a small
 # pitch ('screen') and on the half-size guide at 2 x 2 game px an art px ('screenhalf', kitscale.py).
 'screen': dict(size=(1024, 1536), pitch=4.8, ids=['rerun_screen'], n='one object', every='the screen', what='a big outdoor drive-in movie screen on a timber frame', names={'rerun_screen': 'screen'},
   desc=f"""{SUBURB}
THE DRIVE-IN's big outdoor movie screen, a 1950s American drive-in theatre screen, exactly the guide's shape and angle: a long wide pale SCREEN standing upright on a timber frame, its long face toward the viewer's lower right.
The screen face: pale off-white painted canvas panels (#8a88a4 shade, #c4c2d8, #e4e2f2, #f8f6ff lit) with faint seams between the panels, a little weathered. On it, inside a pale margin where the guide has its violet picture, a FAINT PROJECTED MOVIE PICTURE in washed-out soft colours as if lit by a projector at dusk (pale lilac, rose and blue, #b8a8e0, #d0b8f0, #a8c8f0, #f0d0e8): a small stage with FOUR musicians standing on it (a singer at a microphone, a guitarist, a bass player, a drummer behind his kit), simple pale silhouettes where the guide has its four cyan bars, a darker stage floor at the bottom of the picture. Soft, light, faint: the picture is light on the screen, not paint.
The frame: weathered timber (#2a160e seams, #4a2a1a, #6a4228, #8e5e38, #b48250 lit edges) all round the screen's edge; under the screen a timber trestle of upright legs with two horizontal rails, and a diagonal brace at the left end, exactly where the guide has them.
On the screen's top, in the middle: a little MARQUEE box painted red (#5a0e1e, #9a1a34, #d03050), its front facing the viewer's lower right a hot-pink panel framed by a row of small round marquee BULBS lit warm white-gold (#ffd23f, #fff1b0, #ffffff), reading DRIVE-IN in bold dark-red letters on the pink panel (that word is part of the marquee; no other text)."""),
 'screenhalf': dict(size=(1024, 1536), pitch=9.5, ids=['rerun_screen'], guide={'rerun_screen': 'rerun_screen_half'}, n='one object', every='the screen', what='a big outdoor drive-in movie screen on a timber frame', names={'rerun_screen': 'screen'},
   desc=f"""{SUBURB}
THE DRIVE-IN's big outdoor movie screen, a 1950s American drive-in theatre screen, exactly the guide's shape and angle: a long wide pale SCREEN standing upright on a timber frame, its long face toward the viewer's lower right.
The screen face: pale off-white painted canvas panels (#8a88a4 shade, #c4c2d8, #e4e2f2, #f8f6ff lit) with faint seams between the panels, a little weathered. On it, inside a pale margin where the guide has its violet picture, a FAINT PROJECTED MOVIE PICTURE in washed-out soft colours as if lit by a projector at dusk (pale lilac, rose and blue, #b8a8e0, #d0b8f0, #a8c8f0, #f0d0e8): a small stage with FOUR musicians standing on it (a singer at a microphone, a guitarist, a bass player, a drummer behind his kit), simple pale silhouettes where the guide has its four cyan bars, a darker stage floor at the bottom of the picture. Soft, light, faint: the picture is light on the screen, not paint.
The frame: weathered timber (#2a160e seams, #4a2a1a, #6a4228, #8e5e38, #b48250 lit edges) all round the screen's edge; under the screen a timber trestle of upright legs with two horizontal rails, and a diagonal brace at the left end, exactly where the guide has them.
On the screen's top, in the middle: a little MARQUEE box painted red (#5a0e1e, #9a1a34, #d03050), its front facing the viewer's lower right a hot-pink panel framed by a row of small round marquee BULBS lit warm white-gold (#ffd23f, #fff1b0, #ffffff), reading DRIVE-IN in bold dark-red letters on the pink panel (that word is part of the marquee; no other text)."""),
}
