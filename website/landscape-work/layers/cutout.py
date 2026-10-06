"""Cut the paraglider out of its plain cream background. The white stripe in the wing has the background's colour,
so the wing's filled outline is kept opaque; everywhere else opacity follows the distance from the background colour."""
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
a = np.asarray(Image.open('layers/src/schirm.png').convert('RGB')).astype(np.float32)
bg = np.median(np.concatenate([a[:40].reshape(-1, 3), a[-40:].reshape(-1, 3), a[:, :40].reshape(-1, 3), a[:, -40:].reshape(-1, 3)]), 0)
dist = np.sqrt(((a - bg) ** 2).sum(2))
alpha = np.clip((dist - 14) / 46, 0, 1)
orange = (a[..., 0] > 180) & (a[..., 0] - a[..., 2] > 90)
wing = ndi.binary_fill_holes(ndi.binary_closing(orange, iterations=9))
wing = ndi.binary_opening(wing, iterations=3)
alpha = np.maximum(alpha, ndi.gaussian_filter(wing.astype(np.float32), 1.0))
al = np.clip(alpha, 1e-3, 1)[..., None]
fg = np.where(alpha[..., None] > .02, (a - (1 - al) * bg) / al, a).clip(0, 255)   # remove the cream tint from soft edges
rgba = np.dstack([fg, alpha * 255]).astype(np.uint8)
ys, xs = np.nonzero(alpha > .05)
box = (int(xs.min()) - 6, int(ys.min()) - 6, int(xs.max()) + 7, int(ys.max()) + 7)
im = Image.fromarray(rgba, 'RGBA').crop(box)
im = im.resize((640, round(640 * im.height / im.width)), Image.LANCZOS)
im.save('layers/web/schirm.webp', 'WEBP', quality=90, method=6)
# feet of the pilot = lowest opaque point, as a fraction of the cropped box (the page lands the glider on this point)
b = np.asarray(im)[..., 3] > 120; yy, xx = np.nonzero(b)
low = yy.max(); fx = xx[yy > low - 6].mean() / im.width
print('background', bg.astype(int), 'size', im.size, 'feet at', round(float(fx), 3), round(low / im.height, 3))
chk = Image.new('RGB', (im.width * 2, im.height), (60, 110, 190)); chk.paste((20, 38, 42), (im.width, 0, im.width * 2, im.height))
chk.paste(im, (0, 0), im); chk.paste(im, (im.width, 0), im); chk.resize((chk.width // 2, chk.height // 2), Image.LANCZOS).save('layers/out/_schirm-check.png')
