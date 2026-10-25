# Modern vehicles for the street, from the free "Low Poly Vehicles Pack" by Rgsdev (CC0,
# opengameart.org/content/free-low-poly-vehicles-pack). For each vehicle it writes one model file
# with two parts: "paint" (the body colour, which the game repaints for every car) and "fixed"
# (glass, lights, tyres, trim, with their colours baked in). Sized in real metres, on the ground,
# facing +Y in Blender (forward in the game).
# Usage: blender -b --python build_modern.py -- <pack folder> <out folder> [preview.png]
import bpy, sys, os, bmesh
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT = args[0], args[1]
PREVIEW = args[2] if len(args) > 2 else None
os.makedirs(OUT, exist_ok=True)
# name: (file, length, width, height in metres, the body material that is the paint). The pack's
# cars are drawn chunky; they are squeezed to the real size of the cars they stand for.
MODELS = {
    'sedan': ('Sedan/Sedan.fbx', 4.6, 1.8, 1.45, 'body grey'),  # Corolla / Elantra size
    'hatch': ('Hatchback/Hatchback.fbx', 3.9, 1.7, 1.5, 'body dark yellow'),  # Vitz / Picanto size
    'suv': ('SUV/SUV.fbx', 4.6, 1.85, 1.7, 'body dark purple'),  # RAV4 size
    'pickup': ('Pickup/Pickup.fbx', 5.3, 1.85, 1.8, 'body dark green'),  # Hilux size
    'van': ('Van/Van.fbx', 5.4, 1.95, 2.25, 'body dark blue'),  # trotro: Hiace / Sprinter size
    'bus': ('Bus/Bus.fbx', 11.0, 2.5, 3.1, 'body light blue'),
    'truck': ('Truck/Truck.fbx', 8.0, 2.45, 3.2, 'body dark green'),
}
# Colours for the parts that are not repainted.
FIXED = {'body black': (0.05, 0.05, 0.055), 'body white': (0.85, 0.85, 0.83), 'body grey': (0.45, 0.46, 0.48),
         'windows': (0.07, 0.1, 0.13), 'headlights': (1.0, 0.97, 0.85), 'rear lights': (0.7, 0.04, 0.04),
         'tires': (0.06, 0.06, 0.06), 'wheels': (0.62, 0.63, 0.65)}

for name, (path, length, width, height, paint) in MODELS.items():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=os.path.join(SRC, path))
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    for o in bpy.data.objects:
        o.select_set(o in meshes)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    me = obj.data
    # Which way is long? Make length run along Y, up along Z.
    vs = [v.co for v in me.vertices]
    mn = Vector([min(v[i] for v in vs) for i in range(3)])
    mx = Vector([max(v[i] for v in vs) for i in range(3)])
    size = mx - mn
    if size.x > size.y:
        for v in me.vertices:
            v.co = Vector((-v.co.y, v.co.x, v.co.z))
        vs = [v.co for v in me.vertices]
        mn = Vector([min(v[i] for v in vs) for i in range(3)])
        mx = Vector([max(v[i] for v in vs) for i in range(3)])
    k = length / (mx.y - mn.y)
    kx = width / (mx.x - mn.x)
    kz = height / (mx.z - mn.z)
    for v in me.vertices:
        v.co = Vector(((v.co.x - (mn.x + mx.x) / 2) * kx, (v.co.y - (mn.y + mx.y) / 2) * k, (v.co.z - mn.z) * kz))
    # Bake colours into vertex colours, and split paint from the rest.
    names = [m.name if m else '' for m in me.materials]
    # The paint is the body material covering the most surface (the pack's colour names vary).
    area = {}
    for poly in me.polygons:
        n = names[poly.material_index]
        if n.startswith('body'):
            area[n] = area.get(n, 0) + poly.area
    paint = max(area, key=area.get)
    print('paint', name, paint, {k: round(v, 1) for k, v in area.items()})
    col = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
    for poly in me.polygons:
        n = names[poly.material_index]
        c = (1, 1, 1) if n == paint else FIXED.get(n, (0.5, 0.5, 0.5))
        for li in poly.loop_indices:
            col.data[li].color = (*c, 1)
    bpy.ops.object.mode_set(mode='EDIT')
    bm = bmesh.from_edit_mesh(me)
    paint_idx = names.index(paint)
    for f in bm.faces:
        f.select = f.material_index == paint_idx
    bmesh.update_edit_mesh(me)
    bpy.ops.mesh.separate(type='SELECTED')
    bpy.ops.object.mode_set(mode='OBJECT')
    parts = [o for o in bpy.data.objects if o.type == 'MESH']
    # The separated piece is the one whose faces all use the paint material.
    for o in parts:
        mats = {o.data.polygons[i].material_index for i in range(len(o.data.polygons))}
        o.name = 'paint' if mats == {o.data.materials.find(paint)} else 'fixed'
        o.data.materials.clear()
        o.data.materials.append(bpy.data.materials.new('vc'))
    for o in parts:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, name + '.glb'), export_format='GLB', use_selection=True, export_materials='PLACEHOLDER', export_vertex_color='ACTIVE', export_normals=True, export_texcoords=False)
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in parts)
    print('built', name, 'tris', tris, 'parts', sorted(o.name for o in parts))
