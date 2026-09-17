"""Contact sheet: python sheet.py out.png 03.70 04.20 ... (stills/tXX.XX.png, rendered by stills.sh)."""
import sys
from PIL import Image

out, times = sys.argv[1], sys.argv[2:]
ims = [Image.open(f'stills/t{t}.png') for t in times]
w, h = ims[0].size
sheet = Image.new('RGB', (len(ims) * (w + 20) - 20, h), (27, 26, 23))
for i, im in enumerate(ims):
    sheet.paste(im, (i * (w + 20), 0))
sheet.save(out)
print(out)
