# The meadow kit (frontierArt/meadow.ts -> the meadow art pack): the mill (its sails turn: one drawing, the tower drawn
# alone behind them), the waystone, the haystacks, the bus stop and the cart.
from head import HEAD  # noqa: F401

REFS = {'concept.png': 'docs/worlds/img/concept-seterfell.jpg', 'style.png': 'scripts/zelda-lab/codex/style.png'}
WOOD = """Wood: weathered brown and grey-brown planks (#3a2418 seams, #5a3a26, #7a5434, #9a7048 lit)."""

SHEETS = {
 'mill': dict(size=(1536, 1024), pitch=10, key='magenta', ids=['meadow_mill_0', 'meadow_mill_tower'], n='two objects',
   every='both objects', what='a small wooden windmill (left) and the same windmill without its sails (right)',
   names={'meadow_mill_0': 'windmill with sails', 'meadow_mill_tower': 'windmill without sails'},
   desc=f"""A small old Nordic wooden windmill on a meadow, drawn twice: on the left with its sails, on the right the SAME mill without the sails (only the bare axle stub showing), identical pixel for pixel everywhere else. The mill: a low footing of grey stones; a square tower of horizontal tarred plank courses that steps in a little at each of four storeys, a narrow dark doorway at the foot of the wall facing the viewer's lower left, a small yellow-painted shutter window high up on that wall; a rounded dark blue-violet shingled cap on top (#2a2450, #3a3470, #5a50a0 lit). The sails (left mill only): four long lattice sails in a cross on a wooden stock, each a frame of pale grey-white slats (#c8c2d0, #e8e4ee, dark #5a5470 gaps) on a dark wooden spar, the cross lying flat on the wall facing the viewer's lower left, turning on a small golden hub (#ffd23f, #c4861c).
{WOOD}"""),
 'hay': dict(size=(1536, 1024), pitch=16, key='magenta', ids=['meadow_hay_small', 'meadow_hay_medium', 'meadow_hay_large', 'meadow_waystone'], n='four objects',
   every='all four objects', what='three haystacks of different sizes and a standing waystone',
   names={'meadow_hay_small': 'small haystack', 'meadow_hay_medium': 'middle haystack', 'meadow_hay_large': 'large haystack', 'meadow_waystone': 'waystone'},
   desc="""Left three: round haystacks drying on a meadow, small, middle and large, each a domed heap of golden straw (#7a5020 shade, #b07a30, #d8a848, #f0d070 sunlit, single loose straws sticking out), a darker rope or pole band low around it, a little tuft on top.
Right: a waystone: an upright slab of grey-violet fell stone (#3a3450, #5a5470, #7e7890, #a8a2b8) on a low stone base, a rounded cap stone, a little moss and yellow lichen, with a glowing cyan rune (a vertical stroke with a chevron, #2ff3ff, #c4fbff core) carved into its face toward the viewer's lower left."""),
 'stop': dict(size=(1536, 1024), pitch=16, key='magenta', ids=['meadow_bus_stop', 'meadow_cart'], n='two objects', every='both objects',
   what='a country bus stop shelter and a wooden hand cart', names={'meadow_bus_stop': 'bus stop', 'meadow_cart': 'cart'},
   desc=f"""Left: a small country bus stop by a meadow road: two thin metal posts at the front and two at the back, a flat roof of red-brown painted wood (#7a3826, #b0543a, #e07a4e lit edge) with a dark trim, a dark back wall panel with a timetable board (a few pale lines, no readable words), a wooden bench inside, and the word BUS in small pale capital letters on a sign at the top of the back wall.
Right: a small wooden hand cart: a shallow plank box with low sides, two big spoked wooden wheels with dark iron rims, two long handles reaching toward the viewer's lower right, a little straw in the box.
{WOOD}"""),
 'hay2': dict(size=(1536, 1024), pitch=20, key='magenta', ids=['meadow_hay_small', 'meadow_hay_medium', 'meadow_hay_large'], n='three objects',
   every='all three haystacks', what='three haystacks of different sizes',
   names={'meadow_hay_small': 'small haystack', 'meadow_hay_medium': 'middle haystack', 'meadow_hay_large': 'large haystack'},
   desc="""Three round haystacks drying on a meadow, small, middle and large: each a domed heap of golden straw piled on the ground, rounded like a loaf with a slightly pointed top, built of overlapping layers of straw (#7a5020 deep shade at the bottom and in the hollows, #b07a30, #d8a848, #f0d070 sunlit top), single loose straws sticking out along the edges, a darker damp band of older straw near the ground. NO rope, NO band, NO face, NO eyes or mouth: only straw. A small tuft of straw on top."""),
}
