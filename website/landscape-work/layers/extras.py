"""Extra files for the page: a 1x1 placeholder, and the summit scene as one flat picture for visitors without the moving stage."""
import glob, os
import numpy as np
from PIL import Image
Image.new('RGBA', (1, 1), (0, 0, 0, 0)).save('layers/web/blank.webp', 'WEBP', lossless=True)
comp = Image.open('layers/out/gipfel-himmel.png').convert('RGBA')
for f in sorted(glob.glob('layers/out/gipfel-[1-4]-*.png')): comp.alpha_composite(Image.open(f))
k = comp.width / 1024
flat = comp.convert('RGB').crop((0, int(300 * k), comp.width, int(1320 * k)))
for w in (1024, 2048):
    flat.resize((w, round(w * flat.height / flat.width)), Image.LANCZOS).save(f'layers/web/gipfel-flach-{w}.webp', 'WEBP', quality=78, method=6)
    print('gipfel-flach', w, os.path.getsize(f'layers/web/gipfel-flach-{w}.webp') // 1024, 'KB')
a = np.asarray(comp.convert('RGB')).astype(float)
print('sky colour near the top of the first view: #%02x%02x%02x' % tuple(int(v) for v in a[int(430 * k):int(470 * k)].mean((0, 1))))
