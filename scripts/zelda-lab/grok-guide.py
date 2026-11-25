"""Render the four GROK rig poses that guide the sprite bake.

node scripts/zelda-lab/frontier-people.mjs /tmp/grok-rig.json
blender-run -b -t 2 --python scripts/zelda-lab/grok-guide.py -- /tmp/grok-rig.json /tmp/grok-guide
"""
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector

rig, destination = map(Path, sys.argv[sys.argv.index("--") + 1:])
destination.mkdir(parents=True, exist_ok=True)
colors = {
    "carve": (0.18, 0.15, 0.32), "pole": (0.11, 0.07, 0.24),
    "chrome": (0.52, 0.47, 0.65), "stone": (0.3, 0.27, 0.48),
    "shrine": (0.24, 0.16, 0.46), "glassCyan": (0.06, 0.95, 0.99),
    "bandPink": (0.91, 0.13, 0.47), "gold": (0.99, 0.66, 0.15),
    "rock": (0.38, 0.34, 0.54),
}


def primitive(shape, materials):
    a = shape["args"]
    if shape["kind"] == "box":
        location = tuple((a[i] + a[i + 3]) / 2 for i in range(3))
        bpy.ops.mesh.primitive_cube_add(size=2, location=location)
        bpy.context.object.scale = tuple((a[i + 3] - a[i]) / 2 for i in range(3))
    elif shape["kind"] == "ball":
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, location=a[:3])
        bpy.context.object.scale = a[3:]
    else:
        x, y, z0, z1, radius = a
        bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=radius, depth=z1 - z0, location=(x, y, (z0 + z1) / 2))
    bpy.context.object.data.materials.append(materials[shape["mat"]])


bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 256
scene.render.resolution_y = 224
scene.render.resolution_percentage = 100
scene.render.pixel_aspect_y = 2 / (3 ** 0.5)
scene.render.film_transparent = True
scene.world = bpy.data.worlds.new("Dusk")
scene.world.color = (0.24, 0.20, 0.34)
scene.view_settings.view_transform = "Standard"

bpy.ops.object.camera_add(location=(95, 95, 105))
camera = bpy.context.object
camera.rotation_euler = (Vector((0, 0, 10)) - camera.location).to_track_quat("-Z", "Y").to_euler()
camera.data.type = "ORTHO"
camera.data.ortho_scale = 90
scene.camera = camera
for position, energy, color in [((-30, 45, 85), 58000, (0.82, 0.92, 1.0)), ((45, 15, 45), 24000, (1.0, 0.61, 0.69))]:
    bpy.ops.object.light_add(type="AREA", location=position)
    light = bpy.context.object
    light.data.energy = energy
    light.data.color = color
    light.data.shape = "DISK"
    light.data.size = 50
    light.rotation_euler = (Vector((0, 0, 12)) - light.location).to_track_quat("-Z", "Y").to_euler()

materials = {}
for key, color in colors.items():
    mat = bpy.data.materials.new(key)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = 0.78
    materials[key] = mat

for pose, shapes in json.loads(rig.read_text()).items():
    for obj in tuple(scene.objects):
        if obj.type == "MESH":
            bpy.data.objects.remove(obj, do_unlink=True)
    for shape in shapes:
        primitive(shape, materials)
    scene.render.filepath = str(destination / (pose + ".png"))
    bpy.ops.render.render(write_still=True)
