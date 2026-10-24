# Building the 3D people (`apps/web/public/models/person.glb` and `person-female.glb`)

The player (and later the crowds) come from two free packs by Quaternius, both **CC0** (public domain):

- **Universal Base Characters [Standard]**: https://quaternius.itch.io/universal-base-characters
- **Universal Animation Library [Standard]**: https://quaternius.itch.io/universal-animation-library

What the build does:

1. Takes the male body with short "Buzzed" hair, or the female body with "Buns" hair.
2. Paints a T-shirt, trousers and trainers onto the body texture. For the woman, it adds a flared midi skirt as a real shape, skinned to the hips and thighs so it swings as she walks. The texture's alpha channel records which part each texel is: skin 16, shirt 76, trousers 136, shoes 196, soles 255. The game then colours skin and clothes in the shader (`apps/web/src/game/person.ts`), so every person can look different with one file.
3. Lifts and smooths the clothed areas slightly, so they look like fabric, and slims the bare arms a little.
4. Keeps the animations the game needs and leaves out the weapon ones: idle, walk, jog, sprint, ride, sit, talk, dance, interact, jump, punch and hit.
5. Shrinks it for the web: WebP textures, sparse animation keys, meshopt compression. The result is about 550 KB.

## Steps

You need Blender 4.2 LTS (free, https://www.blender.org) and Node.js.

```
# 1. Download the two packs (free; "name your price" with 0) into a folder of your choice
./download-itch-free.sh quaternius universal-base-characters ~/person-src/ubc
./download-itch-free.sh quaternius universal-animation-library ~/person-src/ual
cd ~/person-src/ubc && unzip *.zip -d x && cd ~/person-src/ual && unzip *.zip -d x
# The male model's file names two textures that the pack ships under other names:
cd "$HOME/person-src/ubc/x/Universal Base Characters[Standard]/Base Characters/Godot - UE"
cp T_Hair_1_Normal.png T_Hair_1_Normal_png.png && cp T_Eye_Normal.png T_Eye_Normal_png.png

# 2. Build in Blender (about 20 seconds)
U="$HOME/person-src/ubc/x/Universal Base Characters[Standard]"
blender -b --python build_person.py -- \
  "$U/Base Characters/Godot - UE/Superhero_Male_FullBody.gltf" \
  "$U/Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/Hair_Buzzed.gltf" \
  "$HOME/person-src/ual/x/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb" \
  /tmp/person_raw.glb /tmp male
# The woman: Superhero_Female_FullBody.gltf, Hair_Buns.gltf, and "female" as the last word

# 3. Shrink for the web
npm install
node optimise-person.mjs /tmp/person_raw.glb ../../apps/web/public/models/person.glb
# (the woman goes to person-female.glb)
```

Check the result at `/person-test.html` (several outfits side by side) and `/street-test.html`.

## Light versions

```
node make-crowd.mjs ../../apps/web/public/models/person.glb ../../apps/web/public/models/person-crowd.glb
node make-crowd.mjs ../../apps/web/public/models/person-female.glb ../../apps/web/public/models/person-female-crowd.glb
node make-crowd.mjs ../../apps/web/public/models/person.glb ../../apps/web/public/models/person-lite.glb lite
node make-crowd.mjs ../../apps/web/public/models/person-female.glb ../../apps/web/public/models/person-female-lite.glb lite
```

The "crowd" files are for people in the street: about a sixth of the triangles, with only idle, walk and talk. The "lite" files are for the player on Light phones: about a third of the triangles, with every move.
