# The pictures of Nova & Rex' Drive to the Mountains

Everything in `public/outrun/` is made here, the way the places of Nova's Solo Rescue are
made (`~/github/nova/tools/art/README.md` is the recipe; read it before ordering anything):
a picture is ordered from gpt-image-2.5 over a layout canvas that sets its size, with a
finished picture beside it for the style, then snapped to its own pixel grid, cut out and
written as an indexed PNG. Nothing is resampled. Made 2026-10-13: fifteen pictures ordered
(`log.jsonl`, about $0.60), all fifteen used.

## What is here

| File | What it is |
|---|---|
| `gen.py NAME --prompt-file F [--format 1:1] [--images CANVAS STYLE]` | Orders one picture with `wave` (WaveSpeed, `flare` / `flare-edit`, paid, about $0.04). The picture lands in `tmp/outrun-art/raw/` (git-ignored); the prompt, inputs and time go to `log.jsonl`. Needs `WAVESPEED_KEY` in the environment. Stops at 90 pictures |
| `layouts.py [name …]` | The layout canvases, written to `tmp/outrun-art/ref/`: flat blocks on magenta that say where a subject stands and how large it is, in game pixels |
| `prompts/*.txt`, `prompts/blocks/*.txt` | The prompts. `{name}` in a prompt is replaced by `blocks/name.txt`; `style`, `clusters`, `key`, `leave` and the rest are copies of nova's, so both games order with the same words |
| `snap.sh NAME [options]` | One raw picture to `tmp/outrun-art/snap/` through nova's `art snap` |
| `make.sh` | Everything: snap, split the sheets, then `finish.py` |
| `finish.py` | Stray cut-out colour cleared, the backdrop bands cropped, the number plate lettered NOVA 89, the ending card cut to 384 × 216, the portraits copied from nova, all written to `public/outrun/`, and a contact sheet to `tmp/outrun-art/sheet.png` |

`make.sh` needs nova's `tools/art` and a Python environment for it outside the nova repo:

```sh
python3 -m venv ~/.cache/nova-art-venv
~/.cache/nova-art-venv/bin/pip install -r ~/github/nova/tools/art/requirements.txt
sh scripts/outrun-lab/art/make.sh
```

The raw generations are not in git. To rebuild `public/outrun/` from nothing, order them
again from the log (each line has the prompt file and the input pictures); a picture that
comes back differs from the one that was used, so look at it before it ships.

## What was learned

- **The car.** The first order (`car.txt`, the layout `car`, nova's ending card for the
  style: it shows the two of them from behind) came back right at once but 156 wide for a
  canvas that asked for 120. The second pass (`car-size.txt`: the first picture laid on a
  canvas at 128 and redrawn) held the size one time in two (131 × 110). Order two.
- **The steering frames** (`car-turn-left.txt`, `car-turn-right.txt`) are the straight frame
  given back as the reference with the turn described in words. Both came back at the same
  size and with the same people, bag and box. Steering right shows the car's right side.
- **Sheets of things** (`props-*.txt`, `traffic.txt`) work at four to nine things a sheet. A
  sheet comes back in cells of 2.8 to 3.5 px whatever the canvas says; the sizes in
  `renderer.ts` (`propArt`) are world sizes, so that does not matter.
- **Backdrop bands** (`skyline`, `mountains`, `hills`) are ordered as a band along the foot
  of a 16:9 canvas with magenta above. The game sets each beside its mirror image to make
  it repeat (`art.band`), so the ends need not match.
- **Lettering** survives at the size of a billboard (SLOP'S PIZZA, DINER, MOTEL) and not at
  the size of a number plate, which `finish.py` letters itself.
- `split` names things in reading order; a sheet whose second row has things of two heights
  is read in an order of its own. Look at the contact sheet after naming.
