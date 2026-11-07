# يولّد كل أيقونات التطبيق من branding/daleely-icon-source.png :  python3 branding/make_icons.py
import numpy as np
from PIL import Image
from scipy import ndimage

src = Image.open("branding/daleely-icon-source.png").convert("RGB")
W = src.size[0]
a = np.array(src)

# 1) أيقونة «any»: نجعل الزوايا السوداء خارج المربع المدوّر شفافة (تعبئة من الزوايا فقط)
dark = a.max(axis=2) < 40
lab, _ = ndimage.label(dark)
outside = np.zeros_like(dark)
for c in [(0, 0), (0, W - 1), (W - 1, 0), (W - 1, W - 1)]:
    outside |= lab == lab[c]
outside = ndimage.binary_dilation(outside, iterations=1)
alpha = np.where(outside, 0, 255).astype("uint8")
alpha = np.array(Image.fromarray(alpha).filter(__import__("PIL.ImageFilter", fromlist=["x"]).GaussianBlur(1.2)))
rgba = Image.fromarray(np.dstack([a, alpha]), "RGBA")

def save(im, name, n):
    im.resize((n, n), Image.LANCZOS).save(f"public/{name}", optimize=True)

save(rgba, "icon-192.png", 192)
save(rgba, "icon-512.png", 512)

# 2) maskable: المربع كله داخل المنطقة الآمنة (٧٤٪) فوق خلفية سوداء، فلا يُقص النص على الأيقونات الدائرية
S = 1024
canvas = Image.new("RGB", (S, S), (0, 0, 0))
inner = int(S * 0.74)
tile = rgba.resize((inner, inner), Image.LANCZOS)
canvas.paste(tile, ((S - inner) // 2, (S - inner) // 2), tile)
save(canvas, "icon-maskable-512.png", 512)

# 3) آيفون: مربع كامل بلا شفافية (iOS يقصّه بنفسه)
save(src, "apple-touch-icon.png", 180)

# 4) favicon: الدبوس والعربة فقط (النص لا يُقرأ في ١٦ بكسل) على خلفية سوداء
pin = src.crop((240, 170, 1070, 730))
sq = Image.new("RGB", (860, 860), (0, 0, 0))
sq.paste(pin, (15, (860 - 560) // 2))
save(sq, "favicon-32.png", 32)
sq.resize((48, 48), Image.LANCZOS).save("public/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
print("ok")
