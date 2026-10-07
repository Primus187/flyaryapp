"""WebP copies of the app views shown on the start page (run from the website folder: python landscape-work/app-screens.py).
The views are handbook screenshots (docs/handbook), which are recaptured whenever the app changes. The manifest records
which screenshot each copy was made from; build.mjs serves a copy only while that still matches and otherwise falls back
to the PNG, so a stale copy can never be shown. Needs Pillow."""
import hashlib, json, os
from PIL import Image

SOURCES = {
    'memories.png': 'mobile/59-flight-memories.png', 'training.png': 'mobile/10-training.png',
    'school-flight.png': 'mobile/20-flight-notes.png', 'feed.png': 'mobile/22-feed.png',
    'cockpit.png': 'school-mobile/34-coaching.png',
}
out = 'assets/screens'
os.makedirs(out, exist_ok=True)
manifest = {}
for name, source in SOURCES.items():
    path = os.path.join('..', 'docs', 'handbook', source)
    data = open(path, 'rb').read()
    manifest[name] = hashlib.sha256(data).hexdigest()
    target = os.path.join(out, name.replace('.png', '.webp'))
    Image.open(path).convert('RGB').save(target, 'WEBP', quality=84, method=6)
    print(f'{name:18s} {len(data) // 1024:4d} KB -> {os.path.getsize(target) // 1024:3d} KB')
json.dump(manifest, open(os.path.join(out, 'screens.json'), 'w'), indent=1)
