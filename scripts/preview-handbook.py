"""Contact sheets for the pilot handbook; --school selects the school handbook."""
from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.handbook-tools'))
from PIL import Image, ImageDraw

school = '--school' in sys.argv
pages = '--pages' in sys.argv
version = '1.4' if school else '1.5'
rendered = ROOT / ('.handbook-preview/school' if school else '.handbook-preview')
source = rendered if pages else ROOT / ('docs/handbook/school-mobile' if school else 'docs/handbook/mobile')
out = ROOT / ('.handbook-preview/school-review' if school else '.handbook-preview/pilot-review')
out.mkdir(parents=True, exist_ok=True)
if pages:
    index = json.loads((source / f'v{version}-pages.json').read_text(encoding='utf-8-sig'))
    files = [source / f"page{entry['page']:02d}.emf" for entry in index]
else:
    index = json.loads((source / 'manifest.json').read_text(encoding='utf-8'))
    files = [source / (entry['name'] + '.png') for entry in index['screenshots']]
w, h = (235, 332) if pages else (195, 422)
for start in range(0, len(files), 12):
    sheet = Image.new('RGB', (6*w, 2*(h+28)), '#e5e7eb')
    draw = ImageDraw.Draw(sheet)
    for index, path in enumerate(files[start:start+12]):
        with Image.open(path) as im:
            im.load()
            if pages:
                im.resize((1200, 1697)).convert('RGB').save(out / (path.stem + '.png'))
            thumb = im.convert('RGB').resize((w, h))
        x, y = (index % 6)*w, (index // 6)*(h+28)
        sheet.paste(thumb, (x, y))
        draw.text((x+4, y+h+4), path.stem, fill='black')
    sheet.save(out / f"{'pages' if pages else 'screens'}-{start//12+1}.jpg")
print(f'{len(files)} images checked')
