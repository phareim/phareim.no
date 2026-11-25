# The prompt every realm-kit sheet starts from (sheet.py fills it in from the kit's plan).
HEAD = """Use your built-in image_gen tool (not a CLI or script fallback) to make ONE image of exactly {W} x {H} pixels, then copy the generated image file to ./out.png in the current working directory. Do not write any code to draw it.

Three images are attached.
- guide.png: a {W} x {H} sheet on {key} with {n}: simple 3D block-model renders of {what}, objects from a video game, seen from the game's isometric camera (from the south-east and above; height is not foreshortened). The renders are ONLY a rotoscope guide for the shape, the angle, the position and the size. Their colours are placeholders: do not copy them.
- concept.png: a painting of the game's realm where these objects stand. This is the mood and the identity to aim for: its materials, its light and its colours.
- style.png: figures from the same game, already drawn in the target style. Match THEIR pixel art style, outlines and shading.

Redraw {every} of guide.png IN PLACE, at exactly the same position, size and angle as in the guide, as hand-placed PIXEL ART. The pixel grid matters most: one art pixel is exactly {pitch} x {pitch} pixels of the sheet; {sizes}. Count them: fill the guide's whole silhouette, do not draw the object smaller than the guide. One art pixel is never smaller or larger than {pitch} x {pitch}. 16-bit console era quality, crisp square pixels on that one even grid, like a skilled pixel artist drew it by hand. It must NOT look like a 3D render: no smooth gradients, no glossy highlights, no soft blur, no plastic look. Use clusters of flat colour with hand-placed shading and texture, light from the upper left, a dark outline (#0b0616 near-black violet or a very dark brown) around each object, in each part's darkest shade where it meets another part, as in style.png.

{desc}

No text, no labels, no frames, no ground shadow, no ground or grass under the objects. The background must stay {key} everywhere around the objects, and that exact colour never appears inside them. Many colours are welcome.
"""
