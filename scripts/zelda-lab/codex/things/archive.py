# archive.py: archive/neon-shrine-<thing>/ per thing: the Codex drawing (image.png) and its sheet's guide and classic,
# the prompt, params.json, model.glb (the guide's solids as a mesh), mesh-params.json, guide.png/.npz, the shipped
# frames (build/*.png and .json), ships-in.txt.
import sys, json, os, shutil
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from kitlib import REPO, work
R = work('things')   # Part 23's work dir: tmp/codex-kits/things (guides/, sheets/, build/, classic/, archive/)
A = {  # thing: (sheet, guide frames, shipped frames, glb)
 'van': ('van', ['van'], ['van'], 'van'), 'tent': ('tent', ['tent'], ['tent'], 'tent'), 'fort': ('fort', ['fort'], ['fort'], 'fort'),
 'bike': ('tent', ['bike'], ['bike'], 'bike'), 'mast': ('mast', ['mast', 'mast_on'], ['mast', 'mast_on'], 'mast'),
 'tank': ('lights', ['tank_0', 'tank_1'], ['tank_0', 'tank_1'], 'tank_0'), 'campfire': ('fires', [f'campfire_{i}' for i in range(3)], [f'campfire_{i}' for i in range(3)], 'campfire_0'),
 'bonfire': ('fires2', [f'bonfire_{i}' for i in range(3)], [f'bonfire_{i}' for i in range(3)], 'bonfire_0'), 'torch': ('torch', [f'torch_{i}' for i in range(3)], [f'torch_{i}' for i in range(3)], 'torch_1'),
 'booth-speaker': ('fort', ['speaker'], ['speaker'], 'speaker'), 'booth-tables': ('tables', ['table_mixer', 'table_records'], ['table_mixer', 'table_records'], 'table_mixer'),
 'booth-lights': ('lights', ['lights'], [f'lights_{i}' for i in range(4)], 'lights'),
 'bookshelf': ('shelves', ['shelf_2', 'shelf_1'], ['shelf_2', 'shelf_1'], 'shelf_2'), 'sofa': ('sofa', ['sofa_3'], ['sofa_3'], 'sofa_3'), 'desk': ('desk', ['desk_2'], ['desk_2'], 'desk_2'),
 'glass-table': ('glass', ['glass_2'], ['glass_2'], 'glass_2'), 'plant': ('glass', ['plant'], ['plant'], 'plant'), 'bed': ('bed', ['bed'], ['bed'], 'bed'), 'table': ('table', ['table'], ['table'], 'table'),
 'lab-console': ('lab', ['console'], ['console_0', 'console_1'], 'console'), 'lab-bench': ('lab', ['bench_2'], ['bench_2'], 'bench_2'), 'lab-terminal': ('lab2', ['terminal'], ['terminal'], 'terminal'),
 'screen-machine': ('lab2', ['machine'], [f'machine_{i}' for i in range(3)], 'machine'), 'fountain': ('fountain', ['fountain_0', 'fountain_1'], ['fountain_0', 'fountain_1'], 'fountain_0'),
}
EXTRA = {'bike': ['prop_bike'], 'tank': ['labTiles.ts (lab tile I)', 'wild.ts (prop tank)'], 'bonfire': ['renderer.ts (npc look bonfire)'], 'torch': ['view.ts (sandy t tiles)']}
for thing, (sheet, guides, shipped, glb) in A.items():
    d = f'{R}/archive/neon-shrine-{thing}'; os.makedirs(d + '/frames', exist_ok=True)
    sd = f'{R}/sheets/{sheet}'
    shutil.copy(f'{sd}/raw/out-1.png', f'{d}/image.png'); shutil.copy(f'{sd}/guide.png', f'{d}/sheet-guide.png'); shutil.copy(f'{sd}/classic.png', f'{d}/sheet-classic.png')
    shutil.copy(f'{sd}/prompt.txt', f'{d}/prompt.txt'); shutil.copy(f'{sd}/raw/codex-1.log', f'{d}/codex.log')
    cut = json.load(open(f'{sd}/cut1/cut.json'))
    json.dump({'tool': 'codex exec, built-in image_gen', 'size': json.load(open(f'{sd}/cells.json'))['size'], 'attached': ['guide.png', 'classic.png', 'style.png (part 22)'],
               'guide_px_per_scene_px': 10, 'cut_pitch': round(cut['pitch'], 3), 'cells': json.load(open(f'{sd}/cells.json'))['cells']}, open(f'{d}/params.json', 'w'), indent=1)
    shutil.copy(f'{R}/blender/glb/{glb}.glb', f'{d}/model.glb')
    json.dump({'kind': 'solids (no Pixal3D, no sculpt): boxes, cylinders and cones, ellipsoids, tubes, a ridge, a ring', 'script': 'tools/solids.py + tools/things.py',
               'things': guides, 'glb': 'blender/solids_glb.py from blender/solids.json (1 unit = a tile, 32 scene px, z up)',
               'projection': "props.ts's: line of sight along (1,1,1); (x, y, z) lands at (x - y, (x + y)/2 - z), scene px"}, open(f'{d}/mesh-params.json', 'w'), indent=1)
    for g in guides:
        shutil.copy(f'{R}/guides/{g}.png', f'{d}/guide-{g}.png'); shutil.copy(f'{R}/guides/{g}.npz', f'{d}/guide-{g}.npz')
    for s in shipped:
        shutil.copy(f'{R}/build/{s}.png', f'{d}/frames/{s}.png'); shutil.copy(f'{R}/build/{s}.json', f'{d}/frames/{s}.json')
    open(f'{d}/ships-in.txt', 'w').write('themes/zelda/render/iso/thingArt.ts (THING_ART: ' + ', '.join(shipped) + '), stood by themes/zelda/render/iso/things.ts and view.ts\n')
print(len(A), 'folders')
