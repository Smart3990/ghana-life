# Makes the paint colours of each car from one texture: finds the body paint (the most common
# colour), then repaints those pixels in other colours, keeping the shading, dirt and edges.
# Also makes the Accra taxi look: a body colour with yellow front and back corners.
# Usage: python3 paint.py <source folder> <out folder>
import sys, os, colorsys
from collections import Counter
from PIL import Image

SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)

# (model folder, texture file, output name, [colours])
JOBS = [
    ('Car 01', 'car.png', 'wagon', ['#f2f2ee', '#b9bec3', '#7c1c1c', '#1e3f73', '#2b2e33', '#556b3a']),
    ('Car 02', 'car2.png', 'sedan', ['#f4f4f0', '#c3c7cb', '#202327', '#8e1b1b', '#24508f', '#6d6f73']),
    ('Car 03', 'car3.png', 'hatch', ['#f2f2ee', '#b9bec3', '#a11d1d', '#2a5ca8', '#e0b21e']),
    ('Car 04', 'car4_lightgrey.png', 'van', None),  # trotro: kept white-grey as painted
    ('Car 08', 'Car8.png', 'boxtruck', None),
]
TAXI = ('Car 02', 'car2.png', 'taxi', ['#8e1b1b', '#1f4f8a', '#2f6b3f', '#f2f2ee', '#3a3d42'])
YELLOW = (232, 178, 34)

def hexrgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))

def body_colour(img):
    px = [img.getpixel((x, y))[:3] for y in range(img.height) for x in range(img.width)]
    q = Counter((r // 16, g // 16, b // 16) for r, g, b in px)
    (r, g, b), _ = q.most_common(1)[0]
    near = [p for p in px if (p[0] // 16, p[1] // 16, p[2] // 16) == (r, g, b)]
    return tuple(sum(c[i] for c in near) / len(near) for i in range(3))

def is_body(p, body):
    # Same colour family as the paint (hue and saturation), any shade of it.
    h1, l1, s1 = colorsys.rgb_to_hls(*[c / 255 for c in p[:3]])
    h2, l2, s2 = colorsys.rgb_to_hls(*[c / 255 for c in body])
    dh = min(abs(h1 - h2), 1 - abs(h1 - h2))
    return dh < 0.07 and abs(s1 - s2) < 0.3 and 0.45 < (l1 + 0.02) / (l2 + 0.02) < 1.9

def repaint(img, body, colour, mask_fn=None):
    out = img.copy()
    w, h = img.size
    lb = sum(body) / 3 + 1
    tgt = hexrgb(colour)
    pix = img.load()
    o = out.load()
    for y in range(h):
        for x in range(w):
            p = pix[x, y]
            if not is_body(p, body):
                continue
            c = YELLOW if mask_fn and mask_fn(x, y, w, h) else tgt
            k = (sum(p[:3]) / 3 + 1) / lb  # keep the shading
            o[x, y] = tuple(max(0, min(255, int(c[i] * k))) for i in range(3)) + ((p[3],) if len(p) > 3 else ())
    return out

def save(img, name):
    img.convert('RGB').save(os.path.join(OUT, name + '.png'))

for folder, tex, name, colours in JOBS:
    img = Image.open(os.path.join(SRC, folder, tex)).convert('RGBA')
    if colours is None:
        save(img, f'{name}-0')
        continue
    body = body_colour(img)
    for i, c in enumerate(colours):
        save(repaint(img, body, c), f'{name}-{i}')

# Accra taxi: yellow on the front and back corners of the side view (the bottom strip of the
# texture), the rest in the body colour.
folder, tex, name, colours = TAXI
img = Image.open(os.path.join(SRC, folder, tex)).convert('RGBA')
body = body_colour(img)
side = lambda x, y, w, h: y > h * 0.66 and (x < w * 0.27 or x > w * 0.73)
for i, c in enumerate(colours):
    save(repaint(img, body, c, side), f'{name}-{i}')
print('painted')
