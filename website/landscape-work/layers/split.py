"""Split a painted scene into depth layers (nearest first) for parallax.
Each layer is everything at or below its skyline; the part hidden behind nearer layers is filled with the layer's own colour."""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

def load(name):
    a = np.asarray(Image.open(f'layers/src/{name}.png').convert('RGB')).astype(np.float32)
    global K
    K = a.shape[1] / 1024  # all rules below are written for a 1024-wide scene
    s = ndi.gaussian_filter(a, (1.2 * K, 1.2 * K, 0))
    c = dict(R=s[..., 0], G=s[..., 1], B=s[..., 2])
    c['L'] = .299 * c['R'] + .587 * c['G'] + .114 * c['B']
    c['Y'] = np.broadcast_to(np.arange(a.shape[0])[:, None] / K, a.shape[:2])
    c['X'] = np.broadcast_to(np.arange(a.shape[1])[None, :] / K, a.shape[:2])
    c['yel'] = (c['R'] + c['G']) / 2 - c['B']
    c['br'] = c['B'] - c['R']
    c['gb'] = ndi.gaussian_filter(a[..., 1] - a[..., 2], 3 * K)
    return a, c

def region(mask, nearer, min_run=3, bridge=4, min_area=0):
    """Column-filled region: from the topmost solid pixel of the mask down, joined with the nearer region."""
    min_run = int(round(min_run * K)); bridge = int(round(bridge * K)); min_area = min_area * K * K
    m = mask.copy()
    if nearer is not None: m |= nearer
    # `bridge` lets nearby pieces (a tree crown above its trunk) count as connected
    conn = ndi.binary_dilation(m, iterations=bridge) if bridge else m
    lab, n = ndi.label(conn, structure=np.ones((3, 3)))
    keep = np.unique(lab[-1, :]); keep = keep[keep > 0]
    if not len(keep) and n: keep = [1 + int(np.argmax(ndi.sum(conn, lab, range(1, n + 1))))]  # nothing reaches the bottom edge: take the largest piece
    if min_area and n:  # also keep large pieces that do not reach the bottom edge
        areas = ndi.sum(conn, lab, range(1, n + 1)); keep = np.union1d(keep, 1 + np.flatnonzero(areas >= min_area))
    m = m & np.isin(lab, keep)
    # ignore single stray pixels at the top of a column
    run = ndi.minimum_filter1d(m.astype(np.uint8), min_run, axis=0, origin=-(min_run // 2)) > 0
    H = m.shape[0]
    top = np.where(run.any(0), run.argmax(0), H)
    return np.arange(H)[:, None] >= top[None, :], top

def fill_hidden(img, own, hidden, top_hidden):
    """Paint the hidden part of a layer with the colour found just above the occluder, smoothed along x."""
    H, W = own.shape
    cols = np.zeros((W, 3), np.float32); ok = np.zeros(W, bool)
    for x in range(W):
        y1 = min(int(top_hidden[x]), H) - int(4 * K)
        if y1 < 2: continue
        y0 = max(0, y1 - int(14 * K))
        sel = own[y0:y1, x] & ~hidden[y0:y1, x]
        if sel.sum() >= 3: cols[x] = img[y0:y1, x][sel].mean(0); ok[x] = True
    if not ok.any(): return img
    xs = np.arange(W)
    for ch in range(3): cols[:, ch] = np.interp(xs, xs[ok], cols[ok, ch])
    cols = ndi.gaussian_filter1d(cols, 18 * K, axis=0, mode='nearest')
    out = img.copy()
    fill = np.broadcast_to(cols[None, :, :], img.shape)
    out[hidden] = fill[hidden]
    return out

def split(name, specs, sky=True):
    img, c = load(name)
    H, W = img.shape[:2]
    regions, tops, nearer = [], [], None
    for spec in specs:
        r, top = region(spec['mask'](c), nearer, bridge=spec.get('bridge', 4), min_area=spec.get('min_area', 0))
        if 'ceil' in spec:  # optional hand-set upper limit: [(x, y), ...]
            px, py = zip(*[(x * K, y * K) for x, y in spec['ceil']]); lim = np.interp(np.arange(W), px, py)
            top = np.maximum(top, lim.astype(int)); r = np.arange(H)[:, None] >= top[None, :]
            if nearer is not None: r |= nearer; top = np.where(r.any(0), r.argmax(0), H)
        if 'close_gaps' in spec:  # remove notches narrower than this many columns (sunlit snow that reads like haze)
            top = ndi.grey_opening(top, size=int(spec['close_gaps'] * K) | 1); r = np.arange(H)[:, None] >= top[None, :]
            if nearer is not None: r |= nearer; top = np.where(r.any(0), r.argmax(0), H)
        if 'force' in spec:  # [(x, y), ...]: the skyline is taken from this line within its x range
            px, py = zip(*[(x * K, y * K) for x, y in spec['force']]); xs = np.arange(int(px[0]), int(px[-1]) + 1)
            top = top.copy(); top[xs] = np.interp(xs, px, py).astype(int); r = np.arange(H)[:, None] >= top[None, :]
            if nearer is not None: r |= nearer; top = np.where(r.any(0), r.argmax(0), H)
        regions.append(r); tops.append(top); nearer = r
    out = []
    for i, spec in enumerate(specs):
        own = regions[i]
        if i > 0:
            hidden = (np.arange(H)[:, None] >= (tops[i - 1] + int(6 * K))[None, :]) & own
            rgb = fill_hidden(img, own, hidden, tops[i - 1])
        else: rgb = img
        alpha = ndi.gaussian_filter(own.astype(np.float32), .6 * K)
        rgba = np.dstack([rgb, alpha * 255]).clip(0, 255).astype(np.uint8)
        Image.fromarray(rgba, 'RGBA').save(f'layers/out/{name}-{spec["name"]}.png')
        out.append(rgba)
        print(name, spec['name'], 'skyline (in 1024 units)', int(tops[i].min() / K), '..', int(tops[i].max() / K))
    if sky:
        hidden = np.arange(H)[:, None] >= (tops[-1] + int(6 * K))[None, :]
        rgb = fill_hidden(img, np.ones((H, W), bool), hidden, tops[-1])
        Image.fromarray(rgb.clip(0, 255).astype(np.uint8)).save(f'layers/out/{name}-himmel.png')
        out.append(np.dstack([rgb, np.full((H, W), 255)]).clip(0, 255).astype(np.uint8))
    return out  # nearest first, sky last

def preview(name, layers, shift=45):
    shift = int(shift * K)
    """Left: layers at rest. Right: each farther layer pushed up by `shift` more, to expose what lies behind."""
    H, W = layers[0].shape[:2]
    sheet = Image.new('RGB', (W * 2 + 20, H), (255, 0, 255))
    for col, s in enumerate((0, shift)):
        comp = Image.fromarray(layers[-1][..., :3]).convert('RGBA') if layers[-1][..., 3].min() == 255 else Image.new('RGBA', (W, H), (255, 255, 255, 255))
        for k in range(len(layers) - 2, -1, -1):
            lay = Image.fromarray(layers[k], 'RGBA')
            comp.alpha_composite(lay, (0, 0)) if s == 0 else comp.paste(lay, (0, -s * k), lay)
        sheet.paste(comp.convert('RGB'), (col * (W + 20), 0))
    sheet.resize((1034, 768), Image.LANCZOS).save(f'layers/out/_{name}-preview.png')

SCENES = {
    'wald': [
        dict(name='4-vorn', mask=lambda c: c['L'] < 45),
        dict(name='3-nah', mask=lambda c: (c['L'] < 80) | ((c['yel'] > 25) & (c['Y'] > 850))),
        dict(name='2-mitte', mask=lambda c: (c['L'] < 128) | ((c['yel'] > 25) & (c['Y'] > 650))),
        dict(name='1-fern', mask=lambda c: ((c['br'] > 8) & (c['Y'] > 500)) | ((c['br'] > -82) & (c['X'] < 330) & (c['Y'] > 580))),
    ],
    'huegel': [
        dict(name='4-wiese', mask=lambda c: (((c['yel'] > 70) | ((c['gb'] > -7) & (c['L'] < 110))) & (c['Y'] > 950)), bridge=8),
        dict(name='3-wald', mask=lambda c: (c['L'] < 78) & (c['Y'] > 740)),
        dict(name='2-weide', mask=lambda c: ((c['L'] < 78) | (c['yel'] > -5) | (c['gb'] > 0)) & (c['Y'] > 740)),
        dict(name='1-fern', mask=lambda c: (c['L'] < 140) & (c['Y'] > 560)),
    ],
    'tal': [
        dict(name='4-wiese', mask=lambda c: (c['yel'] > 68) & (c['Y'] > 1050), min_area=20000),
        dict(name='3-tannen', mask=lambda c: (c['L'] < 120) & (c['Y'] > 950)),
        dict(name='2-see', mask=lambda c: ((c['L'] < 165) & (c['Y'] > 650)) | (c['Y'] >= 895)),
        dict(name='1-fern', mask=lambda c: (c['br'] > -25) & (c['Y'] > 650)),
    ],
    'gipfel': [
        dict(name='4-nebel', mask=lambda c: (c['L'] > 140) & (c['Y'] > 1150)),
        dict(name='3-wald', mask=lambda c: ((c['L'] < 100) | (c['gb'] > 10)) & (c['Y'] > 900), ceil=[(0, 912), (190, 915), (330, 930), (480, 925), (560, 932), (700, 1000), (1024, 1112)]),
        dict(name='2-grat', mask=lambda c: ((c['L'] < 140) | ((c['br'] < 0) & (c['L'] < 180)) | ((c['br'] < -55) & (c['L'] > 205))) & (c['Y'] > 670), close_gaps=61),
        dict(name='1-fern', mask=lambda c: (c['br'] > -20) & (c['Y'] > 500)),
    ],
}
if __name__ == '__main__':
    import os; os.makedirs('layers/out', exist_ok=True)
    for n in sys.argv[1:]: preview(n, split(n, SCENES[n]))
