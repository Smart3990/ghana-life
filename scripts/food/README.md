# Market food build

Builds `apps/web/public/models/food/food.glb` (stall goods, umbrella-table goods, head loads, the kelewele)
from the two food packs. Sources and licences: `apps/web/public/models/LICENSES.md` ("Market food").

The packs' own files must never go into Git. Unzip them somewhere outside the repository, then:

```
cd scripts/food
npm install
node build-food.mjs "<LowPolyFoodPack folder>/GLB" "<Ultimate Food Pack-glb folder>" ../../apps/web/public/models/food/food.glb
```

It prints the triangles of each piece. Keep a stall under about 1,700 and a table under about 600: Light
phones draw up to 3 stalls and 4 tables of each kind within 35 m.
