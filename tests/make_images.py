"""Generate synthetic test inputs: a portrait-photo-like JPEG (with EXIF rotation) and a
scanned-signature-like JPEG on grey paper. No real faces: shapes only."""
import math
import os
import random
import sys

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, ".tmp", "inputs")


def noise_layer(size, amount, seed):
    rnd = random.Random(seed)
    small = Image.effect_noise((size[0] // 2 + 1, size[1] // 2 + 1), amount)
    return small.resize(size, Image.BILINEAR)


def make_portrait(path, w=3024, h=4032, seed=1):
    """Portrait photo-like: light grey wall with gradient + noise, shoulders, neck, head."""
    rnd = random.Random(seed)
    # draw at 1/4 res then upscale for speed, add noise at full res
    sw, sh = w // 4, h // 4
    im = Image.new("RGB", (sw, sh))
    px = im.load()
    for y in range(sh):
        for x in range(sw):
            g = 214 + int(14 * (x / sw)) - int(18 * (y / sh)) - int(30 * ((x / sw - .5) ** 2 + (y / sh - .45) ** 2))
            px[x, y] = (g, g, max(0, g - 6))
    d = ImageDraw.Draw(im)
    cx = sw // 2 + 6
    # shoulders / shirt
    d.ellipse((cx - sw * .42, sh * .74, cx + sw * .42, sh * 1.35), fill=(36, 52, 98))
    # neck
    d.rectangle((cx - sw * .09, sh * .6, cx + sw * .09, sh * .8), fill=(176, 120, 92))
    # hair back
    d.ellipse((cx - sw * .25, sh * .22, cx + sw * .25, sh * .66), fill=(28, 22, 20))
    # face
    d.ellipse((cx - sw * .21, sh * .27, cx + sw * .21, sh * .66), fill=(196, 140, 108))
    # hair fringe
    d.pieslice((cx - sw * .22, sh * .25, cx + sw * .22, sh * .50), 180, 360, fill=(28, 22, 20))
    # eyes, brows, nose, mouth
    ey = sh * .44
    for ex in (-sw * .08, sw * .08):
        d.ellipse((cx + ex - sw * .028, ey - sh * .008, cx + ex + sw * .028, ey + sh * .008), fill=(245, 245, 245))
        d.ellipse((cx + ex - sw * .012, ey - sh * .008, cx + ex + sw * .012, ey + sh * .008), fill=(40, 28, 20))
        d.line((cx + ex - sw * .04, ey - sh * .028, cx + ex + sw * .04, ey - sh * .03), fill=(40, 30, 24), width=max(1, sw // 120))
    d.line((cx, ey + sh * .01, cx - sw * .015, ey + sh * .07), fill=(150, 98, 74), width=max(1, sw // 150))
    d.arc((cx - sw * .07, sh * .53, cx + sw * .07, sh * .60), 20, 160, fill=(120, 50, 50), width=max(1, sw // 100))
    im = im.filter(ImageFilter.GaussianBlur(1.2)).resize((w, h), Image.BICUBIC)
    n = noise_layer((w, h), 18, seed).convert("RGB")
    im = Image.blend(im, n, 0.05)
    # Store LANDSCAPE with EXIF orientation 6 (rotate 90 CW to view) so a phone-style file
    # must be re-oriented by the app.
    stored = im.rotate(90, expand=True)  # 90 CCW; viewer applies 6 (90 CW) to restore
    exif = Image.Exif()
    exif[0x0112] = 6
    stored.save(path, "JPEG", quality=90, exif=exif.tobytes())
    return path


def make_signature_scan(path, w=2000, h=1000, seed=3):
    """Grey uneven paper with a scribbly dark-blue signature, slightly rotated, with scan shadow."""
    rnd = random.Random(seed)
    S = 2
    big = Image.new("L", (w * S, h * S), 255)
    d = ImageDraw.Draw(big)

    def stroke(points, width):
        pts = []
        # catmull-rom-ish smoothing via sampled bezier through points
        for i in range(len(points) - 3):
            p0, p1, p2, p3 = points[i:i + 4]
            for t in [k / 24 for k in range(25)]:
                t2, t3 = t * t, t * t * t
                x = .5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
                y = .5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
                pts.append((x, y))
        for a, b in zip(pts, pts[1:]):
            d.line((a, b), fill=0, width=width)
            d.ellipse((b[0] - width / 2, b[1] - width / 2, b[0] + width / 2, b[1] + width / 2), fill=0)

    base_x, base_y = w * S * .30, h * S * .52
    wid = 11 * S
    stroke([(base_x + dx * S, base_y + dy * S) for dx, dy in
            [(-40, 60), (0, -120), (60, 120), (120, -150), (170, 100), (260, -60), (330, 60), (420, -90), (520, 40), (640, -20), (760, 20), (840, 0)]], wid)
    stroke([(base_x + dx * S, base_y + dy * S) for dx, dy in
            [(-60, 130), (100, 150), (300, 120), (500, 160), (720, 130), (900, 150)]], 7 * S)
    ink = big.resize((w, h), Image.LANCZOS)
    # paper: grey gradient + fibres + a scanner shadow on the left edge
    paper = Image.new("RGB", (w, h))
    pp = paper.load()
    for y in range(0, h):
        for x in range(0, w):
            g = 178 + int(36 * (x / w)) - int(16 * (y / h))
            if x < 140:
                g -= int(60 * (1 - x / 140))
            pp[x, y] = (g, g, g - 4)
    n = noise_layer((w, h), 25, seed + 1).convert("RGB")
    paper = Image.blend(paper, n, 0.07)
    # composite: ink darkens the paper with a blue tint
    inkmask = ink.point(lambda v: 255 - v)
    blue = Image.new("RGB", (w, h), (24, 28, 92))
    paper.paste(blue, (0, 0), inkmask)
    paper = paper.rotate(2.5, resample=Image.BICUBIC, fillcolor=(120, 120, 118))
    paper.save(path, "JPEG", quality=88)
    return path


def make_noisy(path, w=1600, h=2000, seed=9):
    """Hard-to-compress picture (for the 'cannot reach the KB limit' case)."""
    rnd = random.Random(seed)
    im = Image.effect_noise((w, h), 80).convert("RGB")
    im.save(path, "JPEG", quality=92)
    return path


def make_all():
    os.makedirs(OUT, exist_ok=True)
    out = {
        "photo": make_portrait(os.path.join(OUT, "portrait.jpg")),
        "sign": make_signature_scan(os.path.join(OUT, "signature_scan.jpg")),
        "noisy": make_noisy(os.path.join(OUT, "noisy.jpg")),
        "tiny": None,
    }
    tiny = os.path.join(OUT, "small.png")
    Image.new("RGB", (160, 200), (200, 120, 90)).save(tiny)
    out["tiny"] = tiny
    junk = os.path.join(OUT, "iphone.heic")
    with open(junk, "wb") as f:
        f.write(b"\x00\x00\x00\x18ftypheic" + os.urandom(2000))
    out["heic"] = junk
    return out


if __name__ == "__main__":
    for k, v in make_all().items():
        print(k, v, os.path.getsize(v))
