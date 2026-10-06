"""Contact sheets for the school handbook screenshots and Word-rendered pages."""
from pathlib import Path
import sys
import json
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.handbook-tools'))
from PIL import Image, ImageDraw
pages='--pages' in sys.argv
source=ROOT/('.handbook-preview/school' if pages else 'docs/handbook/school-mobile')
out=ROOT/'.handbook-preview/school'
out.mkdir(parents=True,exist_ok=True)
if pages:
    index=json.loads((source/'v1.5-pages.json').read_text(encoding='utf-8-sig'))
    files=[source/f"page{entry['page']:02d}.emf" for entry in index]
else:
    index=json.loads((source/'manifest.json').read_text(encoding='utf-8'))
    files=[source/(entry['name']+'.png') for entry in index['screenshots']]
w,h=(235,332) if pages else (195,422)
for start in range(0,len(files),12):
    sheet=Image.new('RGB',(6*w,2*(h+28)),'#e5e7eb');draw=ImageDraw.Draw(sheet)
    for index,path in enumerate(files[start:start+12]):
        with Image.open(path) as im:
            im.load()
            if pages: im.resize((1200,1697)).convert('RGB').save(out/(path.stem+'.png'))
            thumb=im.convert('RGB').resize((w,h))
        x=(index%6)*w;y=(index//6)*(h+28)
        sheet.paste(thumb,(x,y));draw.text((x+4,y+h+4),path.stem,fill='black')
    sheet.save(out/f'{"pages" if pages else "screens"}-{start//12+1}.jpg')
print(f'{len(files)} images checked')
