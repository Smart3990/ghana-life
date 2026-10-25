# Turns the PSX Style Cars (CC0, by GGBotNet, opengameart.org/content/psx-style-cars) into small
# model files for the street: real size in metres, standing on the ground, centred, no textures
# inside (the paint textures are separate files made by paint.py, so one model has many colours).
# Usage: blender -b --python build_vehicles.py -- <psx folder> <out folder>
import bpy, sys, os

args = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT = args[0], args[1]
os.makedirs(OUT, exist_ok=True)
# name: (blend file, length in metres, width in metres or None to keep the shape)
MODELS = {
    'wagon': ('Car 01/Car.blend', 4.5, None),
    'sedan': ('Car 02/Car2.blend', 4.6, 1.8),
    'hatch': ('Car 03/Car3.blend', 4.0, None),
    'van': ('Car 04/Car4.blend', 5.4, 2.0),
    'boxtruck': ('Car 08/Car8.blend', 6.8, 2.4),
}
for name, (blend, length, width) in MODELS.items():
    bpy.ops.wm.open_mainfile(filepath=os.path.join(SRC, blend))
    obj = [o for o in bpy.data.objects if o.type == 'MESH'][0]
    for o in list(bpy.data.objects):
        if o is not obj:
            bpy.data.objects.remove(o)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    vs = [v.co for v in obj.data.vertices]
    mn = [min(v[i] for v in vs) for i in range(3)]
    mx = [max(v[i] for v in vs) for i in range(3)]
    k = length / (mx[1] - mn[1])
    kx = width / (mx[0] - mn[0]) if width else k
    cx, cy = (mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2
    for v in obj.data.vertices:
        v.co.x = (v.co.x - cx) * kx
        v.co.y = (v.co.y - cy) * k
        v.co.z = (v.co.z - mn[2]) * k
    # Keep the UVs, drop the material's picture (it is loaded separately).
    for m in obj.data.materials:
        if m and m.use_nodes:
            for n in list(m.node_tree.nodes):
                if n.type == 'TEX_IMAGE':
                    m.node_tree.nodes.remove(n)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, name + '.glb'), export_format='GLB', use_selection=True, export_materials='PLACEHOLDER', export_normals=True, export_texcoords=True)
    print('built', name, 'tris', sum(len(p.vertices) - 2 for p in obj.data.polygons), 'height', round((mx[2] - mn[2]) * k, 2))
