# Modern vehicles

The street's cars, taxis, SUVs, pickups, trotros, buses and trucks come from the free **Low Poly Vehicles
Pack** by Rgsdev (CC0): https://opengameart.org/content/free-low-poly-vehicles-pack

To rebuild them (only needed to change sizes or add a vehicle):

1. Download the pack's zip from the page above and unzip it into a new empty folder, for example `~/rgs`.
2. Models (needs Blender 4.2): `blender -b --python scripts/vehicles/build_modern.py -- "~/rgs/Free Low Poly Vehicles Pack by Rgsdev" ~/vehicles-raw`
3. Make them small (first `npm install` in `scripts/vehicles`): `node scripts/vehicles/optimise-vehicles.mjs ~/vehicles-raw apps/web/public/models/vehicles`

`build_modern.py` squeezes each model to the real size of the car it stands for (a sedan is 4.6 by 1.8 m),
and splits it into the paint (repainted per vehicle in the game) and everything else (glass, lights,
tyres). The game paints Accra taxis' yellow corners itself.
