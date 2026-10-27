#!/usr/bin/env python3
"""Verify formfit output files with Pillow.

Usage
  python3 tests/verify_outputs.py                    # verify every tests/.tmp/out/*.json expectation
  python3 tests/verify_outputs.py FILE --size 200x230 --dpi 200 --kb 20-50 [--format JPEG] [--white-bg]

For each file this checks: decodes fully (not just the header), format, pixel size, DPI read back
from the file (JFIF density / PNG pHYs), and the KB window using the strict rule the app uses
(max = KB*1000 bytes, min = KB*1024 bytes), so a checker using either 1000 or 1024 passes.
"""
import argparse
import glob
import json
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, ".tmp", "out")


def check_output(path, size=None, dpi=None, kb=None, fmt=None, white_bg=False, ink=False, square=False,
                 size_range=None, min_ratio=None, sharp=False):
    """Return a list of failure strings (empty list = pass)."""
    fails = []
    if not os.path.exists(path):
        return [f"missing file {path}"]
    nbytes = os.path.getsize(path)
    try:
        with Image.open(path) as im:
            im.verify()
        im = Image.open(path)
        im.load()  # full decode
    except Exception as e:  # noqa: BLE001
        return [f"does not decode: {e!r}"]
    if fmt and im.format != fmt:
        fails.append(f"format {im.format} != {fmt}")
    if size and im.size != tuple(size):
        fails.append(f"size {im.size} != {tuple(size)}")
    if size_range:
        (mnw, mnh), (mxw, mxh) = size_range
        if not (mnw <= im.width <= mxw and mnh <= im.height <= mxh):
            fails.append(f"size {im.size} outside {size_range}")
    if square and im.width != im.height:
        fails.append(f"not square {im.size}")
    if dpi:
        got = im.info.get("dpi")
        if not got or abs(got[0] - dpi) > 0.6 or abs(got[1] - dpi) > 0.6:
            fails.append(f"dpi {got} != {dpi}")
        if im.format == "JPEG" and im.info.get("jfif_unit") != 1:
            fails.append(f"jfif_unit {im.info.get('jfif_unit')} != 1")
    if kb:
        lo, hi = kb
        if hi is not None and nbytes > hi * 1000:
            fails.append(f"{nbytes} bytes > max {hi} KB ({hi * 1000})")
        if lo is not None and nbytes < lo * 1024:
            fails.append(f"{nbytes} bytes < min {lo} KB ({lo * 1024})")
    if min_ratio:
        raw = im.width * im.height * 3
        if raw / nbytes > min_ratio:
            fails.append(f"compression ratio {raw / nbytes:.1f}:1 exceeds {min_ratio}:1")
    rgb = im.convert("RGB")
    if sharp:
        # a crisp picture has at least one hard edge: neighbouring pixels (2px apart) differ a lot
        import numpy as np
        g = np.asarray(rgb.convert("L"), dtype=np.int16)
        edge = max(np.abs(g[:, 2:] - g[:, :-2]).max(), np.abs(g[2:, :] - g[:-2, :]).max())
        if edge < 40:
            fails.append(f"looks blurry (sharpest edge step {edge})")
    if white_bg:
        w, h = rgb.size
        for (x, y) in [(2, 2), (w - 3, 2), (2, h - 3), (w - 3, h - 3)]:
            if min(rgb.getpixel((x, y))) < 245:
                fails.append(f"corner {(x, y)} not white: {rgb.getpixel((x, y))}")
                break
    if ink:
        gray = rgb.convert("L")
        if gray.getextrema()[0] > 90:
            fails.append(f"no dark ink found (darkest {gray.getextrema()[0]})")
    return fails


def verify_all():
    total, bad = 0, 0
    for js in sorted(glob.glob(os.path.join(OUT_DIR, "*.json"))):
        exp = json.load(open(js))
        path = js[:-5]
        for k in ("size", "kb"):
            if exp.get(k) is not None:
                exp[k] = tuple(exp[k])
        if exp.get("size_range"):
            exp["size_range"] = tuple(tuple(x) for x in exp["size_range"])
        fails = check_output(path, **exp)
        total += 1
        status = "PASS" if not fails else "FAIL"
        info = ""
        if os.path.exists(path):
            with Image.open(path) as im:
                info = f"{im.size[0]}x{im.size[1]} {os.path.getsize(path) / 1024:.1f}KB dpi={im.info.get('dpi')} {im.format}"
        print(f"{status}  {os.path.basename(path):34s} {info}")
        for f in fails:
            print("      -", f)
        bad += bool(fails)
    print(f"\n{total - bad}/{total} files OK")
    return bad == 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("file", nargs="?")
    ap.add_argument("--size")
    ap.add_argument("--dpi", type=float)
    ap.add_argument("--kb", help="min-max, either side may be empty, e.g. 20-50 or -50")
    ap.add_argument("--format")
    ap.add_argument("--white-bg", action="store_true")
    ap.add_argument("--ink", action="store_true")
    a = ap.parse_args()
    if not a.file:
        sys.exit(0 if verify_all() else 1)
    size = tuple(int(x) for x in a.size.lower().split("x")) if a.size else None
    kb = None
    if a.kb:
        lo, _, hi = a.kb.partition("-")
        kb = (float(lo) if lo else None, float(hi) if hi else None)
    fails = check_output(a.file, size=size, dpi=a.dpi, kb=kb, fmt=a.format, white_bg=a.white_bg, ink=a.ink)
    print("PASS" if not fails else "FAIL: " + "; ".join(fails))
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
