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

# Flat pictures for the pages without a stage: the valley for the thank-you page, the hills as a strip on the help pages.
def flat(scene, rows, widths, name):
    comp = Image.open(f'layers/out/{scene}-himmel.png').convert('RGBA')
    for f in sorted(glob.glob(f'layers/out/{scene}-[1-4]-*.png')): comp.alpha_composite(Image.open(f))
    k = comp.width / 1024
    pic = comp.convert('RGB').crop((0, int(rows[0] * k), comp.width, int(rows[1] * k)))
    for w in widths:
        pic.resize((w, round(w * pic.height / pic.width)), Image.LANCZOS).save(f'layers/web/{name}-{w}.webp', 'WEBP', quality=78, method=6)
        print(name, w, os.path.getsize(f'layers/web/{name}-{w}.webp') // 1024, 'KB')
flat('tal', (430, 1536), (1024, 2048), 'tal-flach')
flat('huegel', (520, 1180), (1024, 1365), 'huegel-flach')

# Pictures for the version that scrolls without script (touch devices, reduced motion, no JavaScript):
# each scene without its nearest layer stands still as a picture, and the nearest layer is the painted upper edge of the
# chapter that slides over it.
def stack(scene, names, rows, name, widths, alpha=False):
    base = Image.open(f'layers/out/{scene}-{names[0]}.png').convert('RGBA')
    if alpha: base = Image.new('RGBA', base.size, (0, 0, 0, 0)); names = [None] + list(names)
    for n in names[1:]: base.alpha_composite(Image.open(glob.glob(f'layers/out/{scene}-{n}*.png')[0]))
    k = base.width / 1024
    pic = base.crop((0, int(rows[0] * k), base.width, int(rows[1] * k)))
    if not alpha: pic = pic.convert('RGB')
    for w in widths:
        out = f'layers/web/{name}-{w}.webp'
        pic.resize((w, round(w * pic.height / pic.width)), Image.LANCZOS).save(out, 'WEBP', quality=80, method=6)
        print(name, w, os.path.getsize(out) // 1024, 'KB')
def edge(layer, top, ground, rgb, name, widths):
    im = Image.open(glob.glob(f'layers/out/{layer}*.png')[0]).convert('RGBA'); k = im.width / 1024
    a = np.asarray(im).astype(np.float32)[int(top * k):int(ground[1] * k)]
    y = np.arange(a.shape[0])[:, None] / k + top
    t = np.clip((y - ground[0]) / (ground[1] - ground[0]), 0, 1)[..., None]   # the painting turns into the ground colour
    al = a[..., 3:4] / 255
    out_a = al + t * (1 - al)
    rgbv = np.array(rgb, np.float32)
    col = np.where(out_a > 0, (a[..., :3] * al * (1 - t) + rgbv * t) / np.maximum(out_a, 1e-6), a[..., :3])
    pic = Image.fromarray(np.dstack([col, out_a * 255]).clip(0, 255).astype(np.uint8), 'RGBA')
    for w in widths:
        out = f'layers/web/{name}-{w}.webp'
        pic.resize((w, round(w * pic.height / pic.width)), Image.LANCZOS).save(out, 'WEBP', quality=80, method=6)
        print(name, w, pic.height / pic.width, os.path.getsize(out) // 1024, 'KB')
stack('gipfel', ['himmel', '1-fern'], (0, 1536), 'gipfel-hinten', (1024, 2048))
stack('gipfel', ['2-grat', '3-wald'], (380, 1536), 'gipfel-vorn', (1024, 2048), alpha=True)
stack('wald', ['himmel', '1-fern', '2-mitte', '3-nah'], (250, 1536), 'wald-hinten', (1024, 2048))
stack('huegel', ['himmel', '1-fern', '2-weide', '3-wald'], (250, 1536), 'huegel-hinten', (1024, 1365))
stack('tal', ['himmel', '1-fern', '2-see', '3-tannen', '4-wiese'], (150, 1536), 'tal-hoch', (1024, 2048))
edge('gipfel-4-nebel', 1150, (1270, 1480), (233, 235, 245), 'kante-nebel', (1024, 2048))
edge('wald-4-vorn', 950, (1190, 1340), (20, 38, 42), 'kante-wald', (1024, 2048))
edge('huegel-4-wiese', 960, (1310, 1510), (44, 74, 53), 'kante-wiese', (1024, 1365))
