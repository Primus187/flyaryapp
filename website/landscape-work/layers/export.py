"""Crop the split layers to the rows each scene uses (sky uncropped) and save them as WebP: 1024 wide for phones, the
full painted width for large screens, and 1536 in between so that ordinary laptops need not decode the largest files.
Also writes a small JSON with the geometry. Only replaces the layer files; the other pictures come from extras.py."""
import glob, json, os
import numpy as np
from PIL import Image
CROP = {'gipfel': 380, 'wald': 400, 'huegel': 360, 'tal': 200}  # in rows of a 1024-wide scene
os.makedirs('layers/web', exist_ok=True)
meta, total = {}, {'1024': 0, 'full': 0}
per = {}
for n, y0 in CROP.items():
    files = [f'layers/out/{n}-himmel.png'] + sorted(glob.glob(f'layers/out/{n}-[1-4]-*.png'))
    for f in files:
        im = Image.open(f); k = im.width / 1024
        crop = 0 if f.endswith('himmel.png') else y0
        im = im.crop((0, int(crop * k), im.width, im.height))
        name = os.path.basename(f).replace('.png', '')
        widths = [1024] + ([1536] if im.width >= 2048 else []) + [im.width]
        sizes = {}
        for w in widths:
            tag, pic = str(w), im if w == im.width else im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
            out = f'layers/web/{name}-{tag}.webp'
            pic.save(out, 'WEBP', quality=80, method=6)
            sizes[tag] = os.path.getsize(out)
        total['1024'] += sizes['1024']; total['full'] += sizes[str(im.width)]
        per.setdefault(n, [0, 0, 0]); per[n][0] += sizes['1024']; per[n][1] += sizes[str(im.width)]; per[n][2] += sizes.get('1536', sizes[str(im.width)])
        meta[name] = dict(crop=crop, widths=widths, ratio=round(im.height / im.width, 5))
json.dump(meta, open('layers/web/layers.json', 'w'), indent=1)
for n, (a, b, c) in per.items(): print(f'{n:7s} phone {a // 1024:4d} KB   laptop {c // 1024:4d} KB   large {b // 1024:4d} KB')
print(f'all     phone {total["1024"] // 1024:4d} KB   large {total["full"] // 1024:4d} KB')
