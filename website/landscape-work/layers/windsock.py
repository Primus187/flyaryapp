"""Cut the windsock out of its plain cream background and plant it on the landing meadow (the nearest layer of the valley
scene), so every version of the page shows it. Run after split.py and before export.py / extras.py.
The white bands have the background's colour, so the sock's filled outline is kept opaque."""
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
COL, ROW, HEIGHT = 610, 1205, 122   # foot of the pole and height of the windsock, in rows of the 1024-wide painting
a = np.asarray(Image.open('layers/src/windsack.png').convert('RGB')).astype(np.float32)
bg = np.median(np.concatenate([a[:30].reshape(-1, 3), a[-30:].reshape(-1, 3), a[:, :30].reshape(-1, 3), a[:, -30:].reshape(-1, 3)]), 0)
dist = np.sqrt(((a - bg) ** 2).sum(2))
alpha = np.clip((dist - 14) / 40, 0, 1)
solid = dist > 34
# the sock: everything coloured right of the pole in the upper half, with the cream bands between closed
ys, xs = np.nonzero(solid)
pole_x = int(np.median(xs[ys > a.shape[0] * .6]))
sock = solid.copy(); sock[:, :pole_x + 14] = False; sock[int(a.shape[0] * .5):] = False
sock = ndi.binary_fill_holes(ndi.binary_closing(sock, structure=np.ones((5, 5), bool), iterations=22))
sock = ndi.binary_opening(sock, iterations=2)
alpha = np.maximum(alpha, ndi.gaussian_filter(sock.astype(np.float32), .8))
al = np.clip(alpha, 1e-3, 1)[..., None]
fg = np.where((alpha[..., None] > .02) & ~sock[..., None], (a - (1 - al) * bg) / al, a).clip(0, 255)
rgba = np.dstack([fg, alpha * 255]).astype(np.uint8)
ys, xs = np.nonzero(alpha > .05)
cut = Image.fromarray(rgba, 'RGBA').crop((xs.min() - 4, ys.min() - 4, xs.max() + 5, ys.max() + 5))
foot_x = (pole_x - (xs.min() - 4)) / cut.width
cut.save('layers/out/_windsack.png')
meadow = Image.open('layers/out/tal-4-wiese.png').convert('RGBA'); k = meadow.width / 1024
h = round(HEIGHT * k); w = round(cut.width * h / cut.height)
small = cut.resize((w, h), Image.LANCZOS)
x, y = round(COL * k - foot_x * w), round(ROW * k) - h
below = np.asarray(meadow)[round(ROW * k) - 2, round(COL * k), 3]
meadow.alpha_composite(small, (x, y)); meadow.save('layers/out/tal-4-wiese.png')
print('pole at x', pole_x, 'cut', cut.size, 'pasted', (w, h), 'at', (x, y), 'meadow opaque under the foot:', below)
view = Image.new('RGB', meadow.size, (116, 167, 236)); view.paste(meadow, (0, 0), meadow)
view.crop((round(250 * k), round(1000 * k), round(1000 * k), round(1330 * k))).resize((1125, 495), Image.LANCZOS).save('layers/out/_windsack-check.png')
