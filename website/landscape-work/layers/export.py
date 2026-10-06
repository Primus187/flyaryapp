"""Crop the split layers to the rows each scene uses (sky uncropped) and save them as WebP in two widths:
1024 for phones and the full painted width for large screens. Also writes a small JSON with the geometry."""
import glob, json, os
import numpy as np
from PIL import Image
CROP = {'gipfel': 380, 'wald': 400, 'huegel': 360, 'tal': 200}  # in rows of a 1024-wide scene
os.makedirs('layers/web', exist_ok=True)
for f in glob.glob('layers/web/*.webp'):
    if 'schirm' not in f: os.remove(f)
meta, total = {}, {'1024': 0, 'full': 0}
per = {}
for n, y0 in CROP.items():
    files = [f'layers/out/{n}-himmel.png'] + sorted(glob.glob(f'layers/out/{n}-[1-4]-*.png'))
    for f in files:
        im = Image.open(f); k = im.width / 1024
        crop = 0 if f.endswith('himmel.png') else y0
        im = im.crop((0, int(crop * k), im.width, im.height))
        name = os.path.basename(f).replace('.png', '')
        small = im.resize((1024, round(im.height * 1024 / im.width)), Image.LANCZOS)
        sizes = {}
        for tag, pic in (('1024', small), (str(im.width), im)):
            out = f'layers/web/{name}-{tag}.webp'
            pic.save(out, 'WEBP', quality=80, method=6)
            sizes[tag] = os.path.getsize(out)
        total['1024'] += sizes['1024']; total['full'] += sizes[str(im.width)]
        per.setdefault(n, [0, 0]); per[n][0] += sizes['1024']; per[n][1] += sizes[str(im.width)]
        meta[name] = dict(crop=crop, widths=[1024, im.width], ratio=round(im.height / im.width, 5))
json.dump(meta, open('layers/web/layers.json', 'w'), indent=1)
for n, (a, b) in per.items(): print(f'{n:7s} phone {a // 1024:4d} KB   large {b // 1024:4d} KB')
print(f'all     phone {total["1024"] // 1024:4d} KB   large {total["full"] // 1024:4d} KB')
