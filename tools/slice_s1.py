# Slice the Staines sheet into separate cut-outs (Block 1). Codex's art/out will replace these later.
import numpy as np
from PIL import Image
from scipy import ndimage
im = Image.open('art/ref/sheet-s1-staines.png').convert('RGBA')
a = np.array(im)
lab, k = ndimage.label(a[:, :, 3] > 40)
for i, sl in enumerate(ndimage.find_objects(lab), 1):
    ys, xs = sl
    n = int((lab[sl] == i).sum())
    if n < 2000: continue
    piece = a[ys, xs].copy()
    piece[lab[sl] != i, 3] = 0
    out = Image.fromarray(piece)
    out.save(f'assets/s1/piece-{xs.start:04d}-{ys.start:04d}.png')
    print(i, n, 'x', xs.start, xs.stop, 'y', ys.start, ys.stop)
