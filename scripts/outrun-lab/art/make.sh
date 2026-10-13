#!/bin/sh
# From the raw generations (tmp/outrun-art/raw, git-ignored) to the bitmaps the game ships
# (public/outrun). Run from the repo root: sh scripts/outrun-lab/art/make.sh
# Needs nova's tools/art and its Python environment (README.md here).
set -e
PY="$HOME/.cache/nova-art-venv/bin/python"
A="$PY $HOME/github/nova/tools/art/art.py"
R=tmp/outrun-art/raw
S=tmp/outrun-art/snap
P=tmp/outrun-art/parts
mkdir -p $S $P/nature $P/country $P/city $P/traffic $P/clouds

# The car: straight, and swung to either side. 4 px cells on a 256-cell canvas.
$A snap $R/car-size-a.png       -o $S/car.png       --across 256 --key magenta --trim --colors 48
$A snap $R/car-turn-left-a.png  -o $S/car-left.png  --across 256 --key magenta --trim --colors 48
$A snap $R/car-turn-right-a.png -o $S/car-right.png --across 256 --key magenta --trim --colors 48

# Traffic and the roadside things: sheets, cut into one bitmap each (reading order).
$A snap $R/traffic-a.png       -o $S/traffic.png       --across 256 --key magenta --colors 56
$A snap $R/props-nature-a.png  -o $S/props-nature.png  --across 340 --key magenta --colors 64
$A snap $R/props-country-a.png -o $S/props-country.png --across 340 --key magenta --colors 64
$A snap $R/props-city-a.png    -o $S/props-city.png    --across 340 --key magenta --colors 64
$A split $S/traffic.png       -o $P/traffic --dir --names cab,truck,bug,wagon
$A split $S/props-nature.png  -o $P/nature  --dir --names maple,pine,snowpine,pole,lamp,bush,rock,snowrock,deer
$A split $S/props-country.png -o $P/country --dir --names barn,diner,cabin,lighthouse,motel
$A split $S/props-city.png    -o $P/city    --dir --names billboard,payphone,gas,decker,mill,screen

# Backdrops: bands that stand on the horizon. Clouds at their own (coarser) cell.
$A snap $R/skyline-a.png   -o $S/skyline.png   --across 453 --key magenta --trim --colors 48
$A snap $R/mountains-a.png -o $S/mountains.png --across 453 --key magenta --key-outside --trim --colors 40
$A snap $R/hills-a.png     -o $S/hills.png     --across 453 --key magenta --key-outside --trim --colors 40
$A snap $R/clouds-a.png    -o $S/clouds.png    --key magenta --colors 12
$A split $S/clouds.png -o $P/clouds --dir --names cloud-1,cloud-2,cloud-3,cloud-4,cloud-5,cloud-6

# The ending card: a whole frame.
$A snap $R/card-goal-a.png -o $S/card-goal.png --across 384 --colors 64

# Stray key pixels out, the number plate lettered, everything into public/outrun.
$PY scripts/outrun-lab/art/finish.py
