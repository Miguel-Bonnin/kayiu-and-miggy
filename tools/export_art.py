# Export Codex's art (art/out, outside the repo) to web-sized WebP cut-outs in assets/.
# Crops each image to its visible pixels, caps the long side, renames kayius -> kayiu.
import json, os
from PIL import Image

CAP = {'backdrop': 1400, 'card': 1200, 'pose': 900, 'character': 800, 'prop': 800, 'ground': 1536}
m = json.load(open('art/out/../manifest.json'))
os.makedirs('assets/art', exist_ok=True)
for it in m:
    src = it['file'] if it['file'].startswith('art/') else 'art/' + it['file']
    name = os.path.basename(src).replace('kayius', 'kayiu').replace('.png', '.webp')
    dst = 'assets/art/' + name
    if not os.path.exists(src) or (os.path.exists(dst) and os.path.getmtime(dst) > os.path.getmtime(src)): continue   # missing or already exported
    im = Image.open(src).convert('RGBA')
    if it['kind'] != 'ground':   # grounds are opaque rectangles: keep them whole
        im = im.crop(im.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox())
    cap = CAP.get(it['kind'], 900)
    if it['spread'] == 4 and it['kind'] == 'character': cap = 420
    if name.startswith(('leaf-gold-hero',)): cap = 2048
    if name.startswith(('leaf-gold-1', 'leaf-gold-2', 'leaf-gold-3', 'prop-minnow')): cap = 256
    if max(im.size) > cap:
        k = cap / max(im.size); im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    im.save(dst, 'WEBP', quality=86, method=4)
    print(f"{name:34s} {im.size}")
