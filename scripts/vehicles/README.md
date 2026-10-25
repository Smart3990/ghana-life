# Real-looking vehicles

The street's cars, taxis, trotros and trucks are small textured models from the free **PSX Style Cars**
pack by GGBotNet (CC0): https://opengameart.org/content/psx-style-cars

To rebuild them (only needed if you change colours or sizes):

1. Download the pack's zip from the page above and unzip it into a new empty folder, for example `~/psx`.
2. Paint colours (needs Python with Pillow): `python3 scripts/vehicles/paint.py ~/psx apps/web/public/models/vehicles`
3. Models (needs Blender 4.2): `blender -b --python scripts/vehicles/build_vehicles.py -- ~/psx apps/web/public/models/vehicles`

`paint.py` finds each car's paint and repaints it in other colours, keeping the shading. It also makes the
Accra taxi: a body colour with yellow front and back corners. `build_vehicles.py` sizes each model in
real metres (a sedan is 4.6 m) and stands it on the ground.
