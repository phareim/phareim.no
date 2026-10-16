#!/usr/bin/env python3
"""The tappable boxes of the three rooms of the Deep Dish, in the shipped 240 x 180 bitmaps
(public/voyagers2/room-*.png): (x, y, w, h). Writes scripts/voyagers2-lab/art/rooms.json, which
the game reads, and an enlargement of each room with its boxes drawn over it for the eye
(tmp/voyagers2-art/b2/look/boxes-<room>.png):

    ~/.cache/nova-art-venv/bin/python scripts/voyagers2-lab/art/rooms.py

How they were measured (2026-10-16): the boards and the television screen by their colour
(measure.py, then each box checked to hold that one colour; finish.py paints the same boxes
flat); the people and the things by eye on a 4x grid (grid.py), each box from the top of the
head or hat down and across the arms.

Which box a tap hits: people first, then among things the smallest box. No person's box
reaches over a thing that stands in front of them: Nonna's ends at the counter (the pizza is
on it), Dougie's at his scooter's top, Duo's before the television (his boots, on the couch's
arm, are left out), Marge's right of the arcade cabinet's strip (her elbow on it is left out).
A person's box does reach over things behind them (Mei over the radio's right part, Tiny over
the Calzone's tail and the door), and things overlap things (the Calzone stands in the door).

- board: the part of the chalkboard clear of every head (code draws the map or the killboard
  there). The kitchen's whole board is (52, 12, 75, 44): Nonna's bun covers its lower right
  corner from row 46. The break room's whole board is (81, 26, 81, 38): Ridley's hair and
  Duo's cap reach row 61 and the top row is the frame's shadow.
- tv: the television's screen, painted one flat dark colour; its rounded corners are squared.
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))

ROOMS = {
    "room-kitchen": {
        "nonna": [68, 46, 86, 73],      # behind the counter, from her bun to the counter's top, hand to hand
        "mei": [18, 52, 48, 118],       # on her stool at the radio, from her hair to her shoes
        "board": [52, 12, 75, 34],
        "oven": [164, 0, 76, 112],      # the brick oven, its flue and its mouth
        "radio": [0, 54, 40, 46],       # the dispatch radio set on its desk
        "pizza": [70, 119, 74, 16],     # the pizza on its peel on the counter
        "porthole": [3, 9, 40, 35],
    },
    "room-hangar": {
        "tiny": [144, 58, 96, 122],     # from his goggles down, cut by the bottom edge
        "dougie": [0, 63, 44, 59],      # from his cap down to his scooter's top
        "calzone": [40, 34, 148, 66],   # the ship on its struts, canopy to struts
        "moped": [10, 122, 110, 50],    # Dougie's little red scooter-fighter, the pizza box on it
        "door": [44, 14, 154, 82],      # the oven-door mouth onto space (launch)
    },
    "room-breakroom": {
        "marge": [14, 30, 56, 137],     # leaning on the arcade cabinet, cap to boots
        "ridley": [72, 61, 42, 107],    # on the couch, the cat on her shoulder in the box
        "duo": [124, 61, 56, 75],       # lounging: cap, jacket and knees
        "board": [81, 28, 81, 33],
        "tv": [180, 68, 24, 21],
        "arcade": [0, 22, 14, 138],     # the arcade cabinet's strip left of Marge
        "vending": [210, 20, 30, 126],
    },
}


def main():
    out = os.path.join(HERE, "rooms.json")
    with open(out, "w") as f:
        f.write("{\n" + ",\n".join(
            f'  "{room}": {{ ' + ", ".join(f'"{k}": {json.dumps(v)}' for k, v in boxes.items()) + " }"
            for room, boxes in ROOMS.items()) + "\n}\n")
    json.load(open(out))
    print(f"rooms: {os.path.relpath(out, ROOT)}")
    for room in ROOMS:
        for name, (x, y, w, h) in ROOMS[room].items():
            if x < 0 or y < 0 or x + w > 240 or y + h > 180:
                print(f"rooms: {room} {name} reaches outside 240 x 180")
        subprocess.run([sys.executable, os.path.join(HERE, "grid.py"),
                        os.path.join(ROOT, "public", "voyagers2", room + ".png"),
                        os.path.join(ROOT, "tmp", "voyagers2-art", "b2", "look", f"boxes-{room}.png"),
                        "--scale", "3", "--boxes", f"{out}:{room}"], check=True)


if __name__ == "__main__":
    main()
