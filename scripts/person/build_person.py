# Blender (headless): builds the Ghanaverse person model (apps/web/public/models/person.glb) from Quaternius' CC0 Universal Base Characters
# and Universal Animation Library.
#  - male base body, short buzzed hair, dark eyebrows
#  - clothes painted onto the body texture: T-shirt, trousers, trainers. The texture's alpha
#    channel marks each texel as skin (16), shirt (76), trousers (136), shoes (196) or soles (255), so the game
#    can recolour skin and clothes cheaply in the shader (many different people, one texture).
#  - the animations the game needs (no weapon ones)
# Usage: blender -b --python build_person.py -- <body.gltf> <hair.gltf> <animations.glb> <out.glb> <texdir>
import bpy, sys, math, re
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
BODY, HAIR, ANIMS, OUT, TEXDIR = argv[:5]
KEEP = ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Driving_Loop', 'Sitting_Idle_Loop',
        'Jump_Start', 'Jump_Loop', 'Jump_Land', 'Idle_Talking_Loop', 'Interact', 'Dance_Loop', 'Punch_Jab', 'Hit_Chest']

bpy.ops.wm.read_factory_settings(use_empty=True)

def imported(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path, merge_vertices=True)  # one vertex per point, so reshaping never opens cracks at UV seams
    return [o for o in bpy.data.objects if o not in before]

def drop(objs):
    for o in objs:
        bpy.data.objects.remove(o, do_unlink=True)

body_objs = imported(BODY)
arm = next(o for o in body_objs if o.type == 'ARMATURE')
body = next(o for o in body_objs if o.type == 'MESH' and o.name.startswith('SuperHero'))
drop([o for o in body_objs if o.type == 'MESH' and o.parent is None])  # stray helper sphere

hair_objs = imported(HAIR)
hair = next(o for o in hair_objs if o.type == 'MESH' and o.parent is not None)
hair.parent = arm
for m in hair.modifiers:
    if m.type == 'ARMATURE':
        m.object = arm
drop([o for o in hair_objs if o is not hair])

anim_objs = imported(ANIMS)
drop(anim_objs)
for a in list(bpy.data.actions):
    base = a.name.split('_Armature')[0]
    if base in KEEP:
        a.name = base
        a.use_fake_user = True
    else:
        bpy.data.actions.remove(a)
print('ACTIONS', sorted(a.name for a in bpy.data.actions))

# Dark hair and eyebrows: the hair texture is pale and meant to be tinted.
for o in bpy.data.objects:
    if o.type != 'MESH' or o is body:
        continue
    for mat in o.data.materials:
        if mat and 'Hair' in mat.name and mat.use_nodes:
            bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
            link = bsdf.inputs['Base Color'].links
            src = link[0].from_socket if link else None
            mix = mat.node_tree.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'
            mix.inputs['Factor'].default_value = 1.0
            mix.inputs['B'].default_value = (0.05, 0.04, 0.035, 1)
            if src:
                mat.node_tree.links.new(src, mix.inputs['A'])
            mat.node_tree.links.new(mix.outputs['Result'], bsdf.inputs['Base Color'])

# ---------- Where the clothes go, from the rest pose ----------
bones = {b.name: (arm.matrix_world @ b.head_local, arm.matrix_world @ b.tail_local) for b in arm.data.bones}
z_ankle = bones['foot_l'][0].z
z_waist = bones['pelvis'][0].z + 0.11
z_neck = bones['neck_01'][0].z - 0.015
sh = bones['upperarm_l'][0]
el = bones['lowerarm_l'][0]
sleeve_x = abs(sh.x) + 0.5 * (abs(el.x) - abs(sh.x))
print('cuts', round(z_ankle, 3), round(z_waist, 3), round(z_neck, 3), round(abs(sh.x), 3), round(sleeve_x, 3))

mesh = body.data
mw = body.matrix_world
print('body matrix scale', [round(v, 3) for v in mw.to_scale()])
SKIN, SHIRT, TROUSERS, SHOES, SOLE = 0, 1, 2, 3, 4
z_shoe = z_ankle + 0.035
shoulder_x = abs(sh.x) + 0.02
neck_pt = bones['neck_01'][0]
z_collar = neck_pt.z - 0.03
NECK_R = 0.1
print('neck', [round(v, 3) for v in neck_pt])

def regions(P):
    """Region of each rest-pose point (N x 3, Blender world space: x right/left, -y front, z up)."""
    x, y, z = np.abs(P[:, 0]), P[:, 1], P[:, 2]
    # Crew neck: around the neck the shirt stops at the collarbones (a little lower in front);
    # further out it covers the tops of the shoulders.
    r_neck = np.hypot(P[:, 0] - neck_pt.x, P[:, 1] - neck_pt.y)
    front = P[:, 1] < neck_pt.y
    dip = 0.045 * np.clip(1 - (x / 0.1) ** 2, 0, 1)  # round dip at the front
    collar = np.where(front, z_collar + 0.01 - dip, z_collar + 0.01)
    neck = np.where((r_neck < NECK_R) | (x < 0.09), collar, z_neck + 0.12)  # x < 0.09 keeps the chin bare
    shirt = (z >= z_waist) & (z < neck) & ((x < shoulder_x) | ((x < sleeve_x) & (z > sh.z - 0.2)))
    r = np.full(len(P), SKIN, dtype=np.int16)
    r[shirt] = SHIRT
    r[(z < z_waist) & (z >= z_shoe)] = TROUSERS
    r[z < z_shoe] = SHOES
    # How far each point is from the edge of its piece of clothing (for hems, collar and belt).
    edge = np.full(len(P), 1.0)
    e_shirt = np.minimum(np.minimum(z - z_waist, np.where(r_neck < NECK_R + 0.01, neck - z, 1.0)), np.where(x < shoulder_x, 1.0, sleeve_x - x))
    edge = np.where(r == SHIRT, e_shirt, edge)
    edge = np.where(r == TROUSERS, np.minimum(z_waist - z, z - z_shoe), edge)
    edge = np.where(r == SHOES, z_shoe - z, edge)
    return r, edge

# Some faces of the source body point inwards; make them all point out (the game draws one side only).
import bmesh
_bm = bmesh.new()
_bm.from_mesh(body.data)
bmesh.ops.recalc_face_normals(_bm, faces=_bm.faces)
_bm.to_mesh(body.data)
_bm.free()
body.data.update()

# 1. Clothes stand slightly off the body, so they read as fabric and hide the muscles.
vco = np.array([tuple(mw @ v.co) for v in mesh.vertices])
vreg, _ = regions(vco)
LIFT = {SHIRT: 0.022, TROUSERS: 0.017, SHOES: 0.012}
scale = mw.to_scale().x
for i, v in enumerate(mesh.vertices):
    lift = LIFT.get(int(vreg[i]))
    if lift:
        v.co += v.normal * (lift / scale)
# Smooth the clothed parts: fabric drapes over the muscles instead of showing every one.
import bmesh
bm = bmesh.new()
bm.from_mesh(mesh)
bm.verts.ensure_lookup_table()
neighbours = [[e.other_vert(v).index for e in v.link_edges] for v in bm.verts]
bm.free()
P = np.array([tuple(v.co) for v in mesh.vertices])
smooth = np.array([vreg[i] != SKIN and all(vreg[j] == vreg[i] for j in neighbours[i]) for i in range(len(P))])
STRENGTH = {SHIRT: 0.7, TROUSERS: 0.55, SHOES: 0.8}
amount = np.array([STRENGTH.get(int(r), 0.0) for r in vreg])[:, None] * smooth[:, None]
for _ in range(14):
    avg = np.array([P[n].mean(0) if n else P[i] for i, n in enumerate(neighbours)])
    P = P + (avg - P) * amount
for i, v in enumerate(mesh.vertices):
    if smooth[i]:
        v.co = P[i]
# Slightly slimmer bare arms (the base body is a bodybuilder).
for i, v in enumerate(mesh.vertices):
    if vreg[i] == SKIN and abs(vco[i][0]) > shoulder_x + 0.03 and vco[i][2] > z_waist:
        v.co -= v.normal * (0.007 / scale)
# The imported normals were made for the old shape: work them out again for the new one.
bpy.context.view_layer.objects.active = body
body.select_set(True)
bpy.ops.mesh.customdata_custom_splitnormals_clear()
for poly in mesh.polygons:
    poly.use_smooth = True
mesh.update()

# 2. Paint every texel by the exact rest-pose point it shows, so the edges are clean lines.
uv = mesh.uv_layers.active.data
SIZE = 2048
pos = np.zeros((SIZE, SIZE, 3), dtype=np.float32)
covered = np.zeros((SIZE, SIZE), dtype=bool)

def raster(tri_uv, tri_pos):
    pts = np.array(tri_uv) * SIZE
    x0, y0 = np.floor(pts.min(0)).astype(int)
    x1, y1 = np.ceil(pts.max(0)).astype(int)
    x0, y0 = max(x0, 0), max(y0, 0)
    x1, y1 = min(x1, SIZE - 1), min(y1, SIZE - 1)
    if x1 < x0 or y1 < y0:
        return
    xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
    (ax, ay), (bx, by), (cx, cy) = pts
    d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
    if abs(d) < 1e-9:
        return
    w0 = ((by - cy) * (xs - cx) + (cx - bx) * (ys - cy)) / d
    w1 = ((cy - ay) * (xs - cx) + (ax - cx) * (ys - cy)) / d
    w2 = 1 - w0 - w1
    inside = (w0 >= -0.02) & (w1 >= -0.02) & (w2 >= -0.02)
    p = w0[..., None] * tri_pos[0] + w1[..., None] * tri_pos[1] + w2[..., None] * tri_pos[2]
    pos[y0:y1 + 1, x0:x1 + 1][inside] = p[inside]
    covered[y0:y1 + 1, x0:x1 + 1][inside] = True

for poly in mesh.polygons:
    loops = list(poly.loop_indices)
    verts = list(poly.vertices)
    uvs = [(uv[i].uv[0], 1 - uv[i].uv[1]) for i in loops]  # image rows run top to bottom
    ps = vco[verts]
    for k in range(1, len(loops) - 1):
        tri = np.array([uvs[0], uvs[k], uvs[k + 1]])
        # Some UVs lie outside 0-1 and the texture repeats: paint where they really land.
        tri = tri - np.floor(tri.mean(0))
        lo, hi = tri.min(0), tri.max(0)
        shifts_x = [0] + ([-1] if hi[0] > 1 else []) + ([1] if lo[0] < 0 else [])
        shifts_y = [0] + ([-1] if hi[1] > 1 else []) + ([1] if lo[1] < 0 else [])
        for sx in shifts_x:
            for sy in shifts_y:
                raster(list(tri + (sx, sy)), [ps[0], ps[k], ps[k + 1]])

# Grow the islands a few texels so seams never show the wrong colour.
for _ in range(6):
    grown_pos, grown_cov = pos.copy(), covered.copy()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        sp = np.roll(np.roll(pos, dy, 0), dx, 1)
        sc = np.roll(np.roll(covered, dy, 0), dx, 1)
        fill = ~grown_cov & sc
        grown_pos[fill] = sp[fill]
        grown_cov[fill] = True
    pos, covered = grown_pos, grown_cov


flat_reg, flat_edge = regions(pos.reshape(-1, 3))
mask = flat_reg.reshape(SIZE, SIZE)
edge = flat_edge.reshape(SIZE, SIZE)
zz = pos[..., 2]
mask[~covered] = SKIN

# ---------- Paint the texture ----------
def load(name):
    img = bpy.data.images.get(name) or next(i for i in bpy.data.images if name.lower() in i.name.lower())
    px = np.array(img.pixels[:], dtype=np.float32).reshape(img.size[1], img.size[0], img.channels)
    return img, px[::-1].copy()  # Blender stores rows bottom to top

base_img, base = load('T_Superhero_Male_Dark')
norm_img, norm = load('T_Superhero_Male_Normal')
assert base.shape[0] == SIZE, base.shape
rng = np.random.default_rng(7)

def blurred(n, passes):
    for _ in range(passes):
        for ax in (0, 1):
            n = (np.roll(n, 1, ax) + n + np.roll(n, -1, ax)) / 3
    return n

knit = blurred(rng.normal(0, 1, (SIZE, SIZE)).astype(np.float32), 1) * 0.05
folds = blurred(rng.normal(0, 1, (SIZE // 16, SIZE // 16)).astype(np.float32), 2)
folds = np.kron(folds, np.ones((16, 16), np.float32))
folds = blurred(folds, 6) * 0.12

out = base[..., :3].copy()
cloth = mask != SKIN
fabric = 0.86 + knit + folds
fabric = np.where(cloth & (mask != SHOES) & (edge < 0.012), fabric * 0.78, fabric)                              # hems and collar
fabric = np.where((mask == TROUSERS) & (z_waist - zz < 0.04), fabric * 0.45, fabric)          # belt
sole = (mask == SHOES) & (zz < 0.028)
fabric = np.where(sole, 0.93, fabric)                                                          # rubber sole
fabric = np.where((mask == SHOES) & ~sole, np.minimum(fabric, 0.86) * 0.92, fabric)
mask = np.where(sole, SOLE, mask)
out[cloth] = np.clip(fabric[cloth], 0, 1)[:, None]
# Normal map: no muscles under the clothes.
flat = np.array([0.5, 0.5, 1.0], dtype=np.float32)
n3 = norm[..., :3]
n3[cloth] = n3[cloth] * 0.05 + flat * 0.95

# Skin is 16, not 0: image writers throw away the colour of fully transparent texels.
alpha = np.choose(mask, [16 / 255, 76 / 255, 136 / 255, 196 / 255, 1.0]).astype(np.float32)

def save(img, rgb, a, path):
    h, w = rgb.shape[:2]
    rgba = np.concatenate([rgb, a[..., None]], axis=2)[::-1].astype(np.float32)
    fresh = bpy.data.images.new(img.name + '_new', w, h, alpha=True)
    fresh.colorspace_settings.name = img.colorspace_settings.name
    fresh.alpha_mode = 'CHANNEL_PACKED'
    fresh.pixels.foreach_set(rgba.ravel())
    fresh.filepath_raw = path
    fresh.file_format = 'PNG'
    fresh.save()
    img.user_remap(fresh)
    fresh.name = img.name.replace('T_Superhero_Male_Dark', 'player_base').replace('T_Superhero_Male_Normal', 'player_normal')

save(base_img, np.clip(out, 0, 1), alpha, f'{TEXDIR}/player_base.png')
save(norm_img, np.clip(n3, 0, 1), np.ones((SIZE, SIZE), np.float32), f'{TEXDIR}/player_normal.png')

# The game sets roughness per region in the shader, so the roughness texture is not needed.
for mat in body.data.materials:
    for n in list(mat.node_tree.nodes):
        if n.type == 'TEX_IMAGE' and 'Rough' in (n.image.name if n.image else ''):
            mat.node_tree.nodes.remove(n)
    bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Roughness'].default_value = 0.7
    # Alpha holds the region codes, not transparency.
    if bsdf.inputs['Alpha'].links:
        mat.node_tree.links.remove(bsdf.inputs['Alpha'].links[0])
    mat.blend_method = 'OPAQUE'

# ---------- Export ----------
for a in bpy.data.actions:
    track = arm.animation_data_create().nla_tracks.new()
    track.name = a.name
    track.strips.new(a.name, 0, a)
arm.animation_data.action = None
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB', export_animation_mode='NLA_TRACKS', export_force_sampling=True,
    export_frame_step=2, export_image_format='AUTO', export_keep_originals=False, export_yup=True,
    export_extras=False, export_cameras=False, export_lights=False,
)
print('EXPORTED', OUT)
