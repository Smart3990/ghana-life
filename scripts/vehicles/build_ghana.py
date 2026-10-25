# Our own models of the vehicles you see at Circle, shaped after the real ones (no badges or brand
# names): the classic trotro (a Hiace-type minibus, cab over the front wheels, sliding door on the
# right) and the Accra taxi / saloon (a Corolla-type four-door). Built from cross-sections along the
# length, so the shapes are smooth but light (about 1,500 triangles), with a "paint" part (repainted
# per vehicle in the game) and a "fixed" part (glass, lights, tyres, bumpers) with colours baked in.
# Front faces -Y in Blender (forward in the game), ground at z = 0.
# Usage: blender -b --python build_ghana.py -- <out folder>
import bpy, bmesh, sys, os, math

OUT = sys.argv[sys.argv.index('--') + 1]
os.makedirs(OUT, exist_ok=True)

COL = {
    'paint': (1, 1, 1), 'glass': (0.07, 0.09, 0.11), 'trim': (0.06, 0.06, 0.065), 'bumper': (0.2, 0.2, 0.21),
    'chrome': (0.72, 0.74, 0.76), 'head': (1.0, 0.97, 0.86), 'tail': (0.75, 0.05, 0.04), 'amber': (1.0, 0.55, 0.08),
    'tyre': (0.05, 0.05, 0.05), 'hub': (0.65, 0.67, 0.7), 'plate': (0.9, 0.88, 0.8), 'rack': (0.12, 0.12, 0.12),
}


def lerp(a, b, t):
    return a + (b - a) * t


def curve(points, u):
    """Piecewise-linear value at u from [(u, value), ...]."""
    for (u1, v1), (u2, v2) in zip(points, points[1:]):
        if u1 <= u <= u2:
            return lerp(v1, v2, (u - u1) / (u2 - u1 or 1))
    return points[-1][1] if u > points[-1][0] else points[0][1]


class Builder:
    def __init__(self):
        self.verts = []
        self.faces = []  # (indices, colour name, a point inside the shape: faces are turned to face away from it)
        self.inside = (0, 0, 0)

    def quad(self, a, b, c, d, col):
        i = len(self.verts)
        self.verts += [a, b, c, d]
        self.faces.append(((i, i + 1, i + 2, i + 3), col, self.inside))

    def tri(self, a, b, c, col):
        i = len(self.verts)
        self.verts += [a, b, c]
        self.faces.append(((i, i + 1, i + 2), col, self.inside))

    def box(self, cx, cy, cz, sx, sy, sz, col):
        self.inside = (cx, cy, cz)
        x0, x1, y0, y1, z0, z1 = cx - sx / 2, cx + sx / 2, cy - sy / 2, cy + sy / 2, cz - sz / 2, cz + sz / 2
        P = lambda x, y, z: (x, y, z)
        self.quad(P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1), col)  # top
        self.quad(P(x0, y1, z0), P(x1, y1, z0), P(x1, y0, z0), P(x0, y0, z0), col)  # bottom
        self.quad(P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1), col)  # front
        self.quad(P(x1, y1, z0), P(x0, y1, z0), P(x0, y1, z1), P(x1, y1, z1), col)  # back
        self.quad(P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1), col)  # right
        self.quad(P(x0, y1, z0), P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), col)  # left

    def wheel(self, x, y, r, w, hubcap=True):
        n = 14
        side = 1 if x > 0 else -1
        for k in range(n):
            a1 = 2 * math.pi * k / n
            a2 = 2 * math.pi * (k + 1) / n
            p = lambda a, dx: (x + dx, y + math.cos(a) * r, r + math.sin(a) * r)
            self.inside = (x - side * w, y, r)
            self.quad(p(a1, -w / 2), p(a2, -w / 2), p(a2, w / 2), p(a1, w / 2), 'tyre')
            # Outer face: tyre ring and hub.
            c = (x + side * w / 2, y, r)
            q = lambda a, rr: (x + side * w / 2, y + math.cos(a) * rr, r + math.sin(a) * rr)
            if side > 0:
                self.quad(q(a1, r), q(a1, r * 0.62), q(a2, r * 0.62), q(a2, r), 'tyre')
                self.tri(c, q(a2, r * 0.62), q(a1, r * 0.62), 'hub' if hubcap else 'trim')
            else:
                self.quad(q(a2, r), q(a2, r * 0.62), q(a1, r * 0.62), q(a1, r), 'tyre')
                self.tri(c, q(a1, r * 0.62), q(a2, r * 0.62), 'hub' if hubcap else 'trim')

    def body(self, length, stations, ring):
        """Loft: stations = list of u (0 front .. 1 back); ring(u) -> [(x, z, kind)] going round the
        section; the face kind between point k and k+1 at stations i, i+1 comes from kind_at(u, kind)."""
        rings = [(u, ring(u)) for u in stations]
        for (u1, r1), (u2, r2) in zip(rings, rings[1:]):
            y1 = (u1 - 0.5) * length
            y2 = (u2 - 0.5) * length
            um = (u1 + u2) / 2
            n = len(r1)
            for k in range(n):
                a1, a2 = r1[k], r1[(k + 1) % n]
                b1, b2 = r2[k], r2[(k + 1) % n]
                col = self.kind_at(um, a1[2])
                self.inside = (0, (y1 + y2) / 2, sum(q[1] for q in r1 + r2) / (2 * n))
                # Winding so the normal points out (ring goes anticlockwise seen from the front).
                self.quad((a1[0], y1, a1[1]), (a2[0], y1, a2[1]), (b2[0], y2, b2[1]), (b1[0], y2, b1[1]), col)
        # Caps front and back (fans from the centre).
        for (u, r), flip in ((rings[0], True), (rings[-1], False)):
            y = (u - 0.5) * length
            self.inside = (0, y + (0.5 if flip else -0.5), sum(q[1] for q in r) / len(r))
            cx = sum(p[0] for p in r) / len(r)
            cz = sum(p[1] for p in r) / len(r)
            for k in range(len(r)):
                a, b = r[k], r[(k + 1) % len(r)]
                if flip:
                    self.tri((cx, y, cz), (b[0], y, b[1]), (a[0], y, a[1]), 'paint')
                else:
                    self.tri((cx, y, cz), (a[0], y, a[1]), (b[0], y, b[1]), 'paint')

    def write(self, name):
        me = bpy.data.meshes.new(name)
        bm = bmesh.new()
        vs = [bm.verts.new(v) for v in self.verts]
        layer = bm.loops.layers.float_color.new('Col')
        made = []
        for idx, col, inside in self.faces:
            # Turn the face so it looks away from the inside of its part.
            pts = [self.verts[i] for i in idx]
            ax, ay, az = (pts[1][k] - pts[0][k] for k in range(3))
            bx, by, bz = (pts[2][k] - pts[0][k] for k in range(3))
            n = (ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx)
            if n == (0, 0, 0) and len(pts) == 4:
                bx, by, bz = (pts[3][k] - pts[0][k] for k in range(3))
                n = (ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx)
            c = [sum(p[k] for p in pts) / len(pts) for k in range(3)]
            if sum(n[k] * (c[k] - inside[k]) for k in range(3)) < 0:
                idx = tuple(reversed(idx))
            try:
                f = bm.faces.new([vs[i] for i in idx])
            except ValueError:
                continue
            made.append((f, col))
        bm.normal_update()
        for f, col in made:
            c = COL[col]
            for loop in f.loops:
                loop[layer] = (*c, 1)
        bm.to_mesh(me)
        bm.free()
        # Two objects: the paint, and everything else.
        paint_ids = {i for i, (f, col) in enumerate(made) if col == 'paint'}
        objs = []
        for part in ('paint', 'fixed'):
            m2 = me.copy()
            bm2 = bmesh.new()
            bm2.from_mesh(m2)
            bm2.faces.ensure_lookup_table()
            drop = [f for f in bm2.faces if (f.index in paint_ids) != (part == 'paint')]
            bmesh.ops.delete(bm2, geom=drop, context='FACES')
            bmesh.ops.remove_doubles(bm2, verts=bm2.verts, dist=0.0005)
            bm2.to_mesh(m2)
            bm2.free()
            for poly in m2.polygons:
                poly.use_smooth = part == 'paint'
            o = bpy.data.objects.new(part, m2)
            bpy.context.scene.collection.objects.link(o)
            o.data.materials.append(bpy.data.materials.new('vc'))
            objs.append(o)
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs:
            o.select_set(True)
        bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, name + '.glb'), export_format='GLB', use_selection=True, export_materials='PLACEHOLDER', export_vertex_color='ACTIVE', export_normals=True, export_texcoords=False)
        tris = sum(len(p.vertices) - 2 for o in objs for p in o.data.polygons)
        print('built', name, 'triangles', tris)
        for o in objs:
            bpy.data.objects.remove(o)


# ---------- The trotro: a high-roof minibus, cab over the front wheels ----------
def trotro():
    L, W, H = 5.0, 1.75, 2.15
    b = Builder()
    belt = 1.08
    glass_top = 1.88

    def kind_at(u, kind):
        if kind == 'windshield':
            return 'glass' if u < 0.075 else 'paint'
        if kind == 'window':
            # A row of side windows with pillars between them; the front door window and the back.
            pillars = [0.075, 0.24, 0.42, 0.6, 0.78, 0.95]
            if u < 0.08 or u > 0.96:
                return 'paint'
            return 'paint' if any(abs(u - p) < 0.018 for p in pillars) else 'glass'
        return 'paint'
    b.kind_at = kind_at

    def ring(u):
        # The front leans back a little at the top (the windscreen); the back is straight.
        w = W / 2 * curve([(0, 0.9), (0.03, 0.98), (0.97, 1.0), (1, 0.97)], u)
        top = curve([(0, 1.05), (0.075, H - 0.06), (0.12, H), (0.985, H), (1, H - 0.08)], u)
        low = curve([(0, 0.34), (0.03, 0.3), (0.97, 0.3), (1, 0.36)], u)
        gt = min(glass_top, top - 0.12)
        r = 0.09
        pts = [
            (w, low, 'side'), (w, belt, 'window'), (w * 0.985, gt, 'side'),
            (w * 0.97 - r, top, 'windshield'), (-w * 0.97 + r, top, 'side'),
            (-w * 0.985, gt, 'window'), (-w, belt, 'side'), (-w, low, 'bottom'),
        ]
        # Low front (below the windscreen): the windscreen is the sloped top between u 0 and 0.075.
        if top < belt + 0.1:
            pts = [(w, low, 'side'), (w, top - 0.05, 'side'), (w - r, top, 'windshield'), (-w + r, top, 'side'), (-w, top - 0.05, 'side'), (-w, low, 'bottom')]
        return pts
    pillar_edges = sorted({round(p + d, 3) for p in [0.24, 0.42, 0.6, 0.78] for d in (-0.018, 0.018)})
    stations = sorted({0, 0.012, 0.03, 0.05, 0.075, 0.08, 0.12, 0.96, 0.985, 1.0, *pillar_edges})
    # Keep every ring the same length (the low front ones are padded by repeating points).
    def ring_fixed(u):
        p = ring(u)
        while len(p) < 8:
            p.insert(len(p) // 2, p[len(p) // 2 - 1])
        return p
    b.body(L, stations, ring_fixed)
    y0, y1 = -L / 2, L / 2
    # Front: big bumper, grille, rectangular headlights, indicators.
    b.box(0, y0 - 0.06, 0.42, W * 0.98, 0.12, 0.2, 'bumper')
    b.box(0, y0 - 0.01, 0.78, 0.8, 0.03, 0.22, 'trim')
    for s in (1, -1):
        b.box(s * 0.62, y0 - 0.01, 0.8, 0.3, 0.03, 0.16, 'head')
        b.box(s * 0.82, y0 - 0.01, 0.6, 0.08, 0.03, 0.08, 'amber')
        b.box(s * 0.92, y0 + 0.25, 1.55, 0.12, 0.05, 0.16, 'trim')  # mirrors
        # Tail lights up the back corners.
        b.box(s * 0.8, y1 + 0.005, 0.95, 0.14, 0.03, 0.45, 'tail')
    b.box(0, y1 + 0.06, 0.42, W * 0.98, 0.12, 0.18, 'bumper')
    b.box(0, y1 + 0.01, 0.62, 0.42, 0.02, 0.14, 'plate')
    b.box(0, y1 + 0.006, 1.5, 1.3, 0.02, 0.55, 'glass')  # rear window
    # The sliding door's line on the right (passenger side, Ghana drives on the right).
    b.box(W / 2 + 0.004, -0.15, 0.95, 0.01, 0.02, 1.25, 'trim')
    b.box(W / 2 + 0.004, 0.55, 0.95, 0.01, 0.02, 1.25, 'trim')
    # Roof rack with a load.
    for yy in (-1.6, -0.4, 0.8, 1.9):
        b.box(0, yy, H + 0.09, W * 0.9, 0.05, 0.05, 'rack')
    for s in (1, -1):
        b.box(s * W * 0.45, 0.15, H + 0.14, 0.05, 3.7, 0.05, 'rack')
    b.box(0.3, -0.6, H + 0.3, 0.7, 0.9, 0.35, 'trim')  # a covered load
    # Wheels (front under the cab).
    for s in (1, -1):
        b.wheel(s * (W / 2 - 0.12), -L / 2 + 0.68, 0.33, 0.2)
        b.wheel(s * (W / 2 - 0.12), L / 2 - 1.05, 0.33, 0.2)
        # Dark wheel arches.
        b.box(s * (W / 2 + 0.003), -L / 2 + 0.68, 0.5, 0.01, 0.8, 0.36, 'trim')
        b.box(s * (W / 2 + 0.003), L / 2 - 1.05, 0.5, 0.01, 0.8, 0.36, 'trim')
    b.write('trotro')


# ---------- The Accra taxi / saloon: a Corolla-type four-door ----------
def saloon():
    L, W, H = 4.4, 1.7, 1.42
    b = Builder()
    belt = 0.9

    def kind_at(u, kind):
        if kind == 'roof':
            # Windscreen and rear window are the sloping parts of the top.
            return 'glass' if 0.3 < u < 0.41 or 0.69 < u < 0.79 else 'paint'
        if kind == 'window':
            if u < 0.4 or u > 0.72:
                return 'paint'
            return 'paint' if 0.535 < u < 0.565 else 'glass'  # the middle pillar
        return 'paint'
    b.kind_at = kind_at

    def ring(u):
        w = W / 2 * curve([(0, 0.86), (0.04, 0.97), (0.12, 1.0), (0.88, 1.0), (0.96, 0.96), (1, 0.88)], u)
        top = curve([(0, 0.72), (0.05, 0.8), (0.3, 0.88), (0.41, H), (0.69, H - 0.02), (0.79, 0.98), (0.95, 0.96), (1, 0.84)], u)
        low = curve([(0, 0.25), (0.06, 0.2), (0.94, 0.2), (1, 0.26)], u)
        if top <= belt + 0.05:
            # Bonnet and boot: rounded box.
            return [(w, low, 'side'), (w, top - 0.06, 'side'), (w * 0.95, top, 'roof'), (-w * 0.95, top, 'side'), (-w, top - 0.06, 'side'), (-w, low, 'bottom'), (-w, low, 'bottom'), (w, low, 'bottom')]
        g = curve([(0.3, 1.0), (0.41, 0.8), (0.69, 0.8), (0.79, 1.0)], u)  # the cabin is narrower than the body
        return [(w, low, 'side'), (w, belt, 'window'), (w * g, top - 0.05, 'roof'), (w * g * 0.9, top, 'roof'), (-w * g * 0.9, top, 'side'),
                (-w * g, top - 0.05, 'window'), (-w, belt, 'side'), (-w, low, 'bottom')]
    stations = [0, 0.02, 0.05, 0.1, 0.2, 0.3, 0.33, 0.37, 0.41, 0.48, 0.535, 0.565, 0.62, 0.69, 0.72, 0.74, 0.79, 0.85, 0.92, 0.97, 1.0]
    b.body(L, stations, ring)
    y0, y1 = -L / 2, L / 2
    for s in (1, -1):
        b.box(s * 0.58, y0 + 0.01, 0.66, 0.34, 0.03, 0.12, 'head')
        b.box(s * 0.62, y1 - 0.0, 0.74, 0.34, 0.03, 0.13, 'tail')
        b.box(s * 0.86, y0 + 1.5, 0.98, 0.1, 0.05, 0.08, 'trim')  # mirrors
    b.box(0, y0 + 0.005, 0.62, 0.5, 0.03, 0.12, 'trim')  # grille
    b.box(0, y0 - 0.03, 0.36, W * 0.96, 0.06, 0.16, 'bumper')
    b.box(0, y1 + 0.03, 0.4, W * 0.96, 0.06, 0.16, 'bumper')
    b.box(0, y1 + 0.005, 0.58, 0.4, 0.02, 0.11, 'plate')
    for s in (1, -1):
        b.wheel(s * (W / 2 - 0.11), -L / 2 + 0.85, 0.3, 0.19)
        b.wheel(s * (W / 2 - 0.11), L / 2 - 0.88, 0.3, 0.19)
        b.box(s * (W / 2 + 0.003), -L / 2 + 0.85, 0.42, 0.01, 0.72, 0.3, 'trim')
        b.box(s * (W / 2 + 0.003), L / 2 - 0.88, 0.42, 0.01, 0.72, 0.3, 'trim')
    b.write('saloon')


bpy.ops.wm.read_factory_settings(use_empty=True)
trotro()
saloon()
