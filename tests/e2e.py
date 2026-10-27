#!/usr/bin/env python3
"""End-to-end test for formfit with Playwright (Chromium).

Serves site/ from a temporary http.server under the sub-path /formfit/ (like GitHub Pages),
drives the UI at mobile (390x844) and desktop (1280x800) in light and dark mode, uploads
generated images, exports, downloads, verifies the files with Pillow, takes screenshots into
docs/img/, and finally checks that the app reloads while offline.

Run:  python3 tests/e2e.py [--no-shots]
"""
import json
import os
import socket
import subprocess
import sys
import tempfile
import time

from playwright.sync_api import sync_playwright, expect

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import make_images  # noqa: E402
import verify_outputs  # noqa: E402

OUT_DIR = os.path.join(HERE, ".tmp", "out")
SHOT_DIR = os.path.join(ROOT, "docs", "img")
SHOTS = "--no-shots" not in sys.argv

RESULTS = []


def log(ok, name, detail=""):
    RESULTS.append((ok, name, detail))
    print(("PASS " if ok else "FAIL ") + name + (f"  [{detail}]" if detail else ""), flush=True)


def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


def start_server():
    tmp = tempfile.mkdtemp(prefix="formfit-serve-")
    os.symlink(os.path.join(ROOT, "site"), os.path.join(tmp, "formfit"))
    port = free_port()
    proc = subprocess.Popen([sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1", "--directory", tmp],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(50):
        try:
            socket.create_connection(("127.0.0.1", port), timeout=0.2).close()
            break
        except OSError:
            time.sleep(0.1)
    return proc, f"http://127.0.0.1:{port}/formfit/"


def shot(page, name, enabled=True, full=False):
    if not (SHOTS and enabled):
        return
    os.makedirs(SHOT_DIR, exist_ok=True)
    page.wait_for_timeout(250)
    page.screenshot(path=os.path.join(SHOT_DIR, name + ".png"), full_page=full)


def save_expect(fname, **exp):
    os.makedirs(OUT_DIR, exist_ok=True)
    with open(os.path.join(OUT_DIR, fname + ".json"), "w") as f:
        json.dump({k: v for k, v in exp.items()}, f)


def pick_preset(page, query, name):
    page.fill("#q", query)
    head = page.locator(".preset-head", has_text=name).first
    head.click()
    page.locator(".preset-body .btn-primary").first.click()
    expect(page.locator("#step2")).to_be_visible()


def upload(page, path):
    page.set_input_files("#inFile", path)
    expect(page.locator("#step3")).to_be_visible(timeout=15000)
    page.wait_for_function("document.getElementById('previewImg').src.startsWith('data:')", timeout=10000)


def make_and_download(page, prefix, exp):
    page.click("#btnMake")
    expect(page.locator("#result")).to_be_visible(timeout=60000)
    with page.expect_download() as dl:
        page.click("#btnDownload")
    d = dl.value
    name = d.suggested_filename
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, f"{prefix}__{name}")
    d.save_as(path)
    save_expect(os.path.basename(path), **exp)
    fails = verify_outputs.check_output(path, **{k: (tuple(v) if k in ("size", "kb") and v else v) for k, v in exp.items()})
    log(not fails, f"{prefix}: {name}", "; ".join(fails))
    ticks_bad = page.locator("#ticks .tick-bad").count()
    log(ticks_bad == 0, f"{prefix}: no red ticks on result screen", f"{ticks_bad} red")
    return name


def full_flow(browser, base, label, ctx_args, scheme, inputs, shots=True):
    ctx = browser.new_context(color_scheme=scheme, accept_downloads=True, **ctx_args)
    page = ctx.new_page()
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(base)
    expect(page.locator("#presetList .preset").first).to_be_visible()
    # no horizontal scroll
    sw = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
    log(sw <= 0, f"{label}: no horizontal scroll on step 1", f"overflow {sw}px")
    shot(page, f"{label}-1-choose", shots)

    # ---- SBI photo (exact 200x230, 20-50 KB, 200 dpi)
    page.fill("#q", "sbi")
    page.locator(".preset-head", has_text="SBI PO / Clerk - Photograph").click()
    shot(page, f"{label}-1-choose-expanded", shots)
    expect(page.locator(".alert-warn", has_text="Check the official notice")).to_be_visible()
    page.locator(".preset-body .btn-primary").click()
    expect(page.locator("#step2")).to_be_visible()
    shot(page, f"{label}-2-add", shots)
    upload(page, inputs["photo"])
    # play with the editor: slider zoom, straighten, rotate x4, fit, then zoom/straighten
    for _ in range(4):
        page.click("#btnRotate")
    page.click("#btnFit")
    page.fill("#zoom", "120")
    page.dispatch_event("#zoom", "input")
    page.fill("#straighten", "15")
    page.dispatch_event("#straighten", "input")
    page.wait_for_timeout(400)
    shot(page, f"{label}-3-adjust", shots)
    # whiten background (preview), brightness
    page.check("#chkWhiten")
    page.wait_for_timeout(400)
    shot(page, f"{label}-3-adjust-whiten", shots, full=True)
    name = make_and_download(page, f"{label}-sbi-photo", dict(size=[200, 230], dpi=200, kb=[20, 50], fmt="JPEG"))
    log(name.startswith("photo_200x230_") and name.endswith("KB.jpg"), f"{label}: filename pattern", name)
    shot(page, f"{label}-4-result", shots)
    shot(page, f"{label}-4-result-full", shots, full=True)

    # ---- do the signature next
    page.click("#btnNext")
    expect(page.locator("#step2")).to_be_visible()
    upload(page, inputs["sign"])
    page.wait_for_timeout(500)
    shot(page, f"{label}-3-signature", shots, full=True)
    make_and_download(page, f"{label}-sbi-sign", dict(size=[140, 60], dpi=200, kb=[10, 20], fmt="JPEG", white_bg=True, ink=True))
    shot(page, f"{label}-4-signature-result", shots, full=True)

    # ---- next: thumb + declaration reuse the signature scan (ink pipeline)
    page.click("#btnNext")
    upload(page, inputs["sign"])
    make_and_download(page, f"{label}-sbi-thumb", dict(size=[240, 240], dpi=200, kb=[20, 50], fmt="JPEG", white_bg=True))
    page.click("#btnNext")
    upload(page, inputs["sign"])
    make_and_download(page, f"{label}-sbi-decl", dict(size=[800, 400], dpi=200, kb=[50, 100], fmt="JPEG", white_bg=True))
    log(page.locator("#filesMade").is_visible(), f"{label}: 'files made' list shown after several files")

    # ---- US visa: range 600-1200 square, <=240KB, ratio <=20:1
    page.click("#btnStartOver")
    pick_preset(page, "us visa", "US visa")
    upload(page, inputs["photo"])
    make_and_download(page, f"{label}-us-visa", dict(size_range=[[600, 600], [1200, 1200]], square=True, kb=[None, 240], fmt="JPEG", min_ratio=20, sharp=True))

    # ---- JEE Main photo (suggested dims, 10-200 KB) + pad toggle exists
    page.click("#btnStartOver")
    pick_preset(page, "jee main", "JEE Main - Photograph")
    upload(page, inputs["photo"])
    make_and_download(page, f"{label}-jee-photo", dict(size=[413, 531], kb=[10, 200], fmt="JPEG", dpi=300, sharp=True))

    # ---- Under 20 KB free preset (shape picker)
    page.click("#btnStartOver")
    pick_preset(page, "under 20", "Under 20 KB")
    upload(page, inputs["photo"])
    page.locator("#shapeRow .gchip", has_text="Square").click()
    make_and_download(page, f"{label}-under20", dict(size=[800, 800], kb=[None, 20], fmt="JPEG", sharp=True))

    # ---- Custom: 3.5 x 4.5 cm @ 300 dpi, max 30 KB
    page.click("#btnStartOver")
    page.fill("#q", "custom")
    page.locator(".preset-head", has_text="Custom size").click()
    page.select_option("#c-unit", "cm")
    page.fill("#c-w", "3.5"); page.fill("#c-h", "4.5"); page.fill("#c-dpi", "300")
    page.fill("#c-min", ""); page.fill("#c-max", "30")
    page.locator("#pb-custom button[type=submit]").click()
    expect(page.locator("#step2")).to_be_visible()
    upload(page, inputs["photo"])
    make_and_download(page, f"{label}-custom", dict(size=[413, 531], kb=[None, 30], dpi=300, fmt="JPEG"))

    # ---- impossible case: exact 1000x1000 with max 3 KB on a noisy picture -> clear message
    page.click("#btnStartOver")
    page.fill("#q", "custom")
    page.locator(".preset-head", has_text="Custom size").click()
    page.select_option("#c-unit", "px")
    page.fill("#c-w", "1000"); page.fill("#c-h", "1000"); page.fill("#c-max", "3"); page.fill("#c-min", "")
    page.locator("#pb-custom button[type=submit]").click()
    upload(page, inputs["noisy"])
    page.click("#btnMake")
    expect(page.locator("#result")).to_be_visible(timeout=60000)
    txt = page.locator("#resultNotes").inner_text()
    log("above the 3 KB limit" in txt and page.locator("#ticks .tick-bad").count() >= 1, f"{label}: too-big case explained clearly", txt[:120])
    shot(page, f"{label}-4-too-big", shots, full=True)

    # ---- HEIC fallback message
    page.click("#btnStartOver")
    pick_preset(page, "jee main", "JEE Main - Photograph")
    page.set_input_files("#inFile", inputs["heic"])
    expect(page.locator("#addError")).to_be_visible()
    log("Most Compatible" in page.locator("#addError").inner_text(), f"{label}: HEIC guidance shown")

    # ---- Hindi toggle
    page.click("#langBtn")
    h = page.locator("#h2").inner_text()
    log(any("ऀ" <= c <= "ॿ" for c in h), f"{label}: Hindi UI", h)
    shot(page, f"{label}-hindi-2-add", shots)
    page.click("#langBtn")

    # ---- JS errors
    errs = [e for e in errors if "favicon" not in e.lower()]
    log(not errs, f"{label}: no console errors", "; ".join(errs[:3]))
    ctx.close()


def keyboard_and_wheel(browser, base, inputs):
    ctx = browser.new_context(viewport={"width": 1280, "height": 800}, accept_downloads=True)
    page = ctx.new_page()
    page.goto(base)
    pick_preset(page, "pan", "PAN card (NSDL / UTIITSL) - Photograph")
    upload(page, inputs["photo"])
    before = page.evaluate("window.__formfit.S.editor.view.scale")
    box = page.locator("#stage").bounding_box()
    page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    page.mouse.wheel(0, -400)
    page.wait_for_timeout(200)
    after = page.evaluate("window.__formfit.S.editor.view.scale")
    log(after > before, "desktop: mouse wheel zooms the crop", f"{before:.3f} -> {after:.3f}")
    cx0 = page.evaluate("window.__formfit.S.editor.view.cx")
    page.focus("#stage")
    for _ in range(5):
        page.keyboard.press("ArrowLeft")
    cx1 = page.evaluate("window.__formfit.S.editor.view.cx")
    log(cx1 != cx0, "desktop: arrow keys pan the crop", f"{cx0:.1f} -> {cx1:.1f}")
    # drag with mouse
    page.mouse.move(box["x"] + 200, box["y"] + 200)
    page.mouse.down(); page.mouse.move(box["x"] + 260, box["y"] + 230, steps=5); page.mouse.up()
    cx2 = page.evaluate("window.__formfit.S.editor.view.cx")
    log(cx2 != cx1, "desktop: mouse drag pans the crop")
    # drag-and-drop file onto the drop zone is covered by paste/drop handler; test paste:
    page.click("#back3")
    page.evaluate("""async (b64) => {
        const bin = atob(b64); const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const file = new File([bytes], 'pasted.png', { type: 'image/png' });
        const dt = new DataTransfer(); dt.items.add(file);
        const ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
        document.dispatchEvent(ev);
    }""", PNG_B64)
    expect(page.locator("#step3")).to_be_visible(timeout=10000)
    log(True, "desktop: paste an image from the clipboard")
    ctx.close()


# 1x1... slightly bigger red png (24x32)
def _png_b64():
    from PIL import Image
    import io, base64
    buf = io.BytesIO()
    Image.new("RGB", (240, 320), (200, 150, 120)).save(buf, "PNG")
    return base64.b64encode(buf.getvalue()).decode()


PNG_B64 = _png_b64()


def offline_test(browser, base, inputs):
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, accept_downloads=True)
    page = ctx.new_page()
    page.goto(base)
    expect(page.locator("#offlineChip")).to_be_visible(timeout=15000)
    # ensure the SW controls the page (reload once)
    page.reload()
    page.wait_for_function("navigator.serviceWorker.controller !== null", timeout=15000)
    keys = page.evaluate("caches.keys()")
    log(any(k.startswith("formfit-") for k in keys), "offline: versioned cache exists", str(keys))
    ctx.set_offline(True)
    page.reload()
    expect(page.locator("#h1")).to_be_visible(timeout=10000)
    log(True, "offline: page reloads with the network off")
    # full export while offline
    pick_preset(page, "gate", "GATE 2027 - Photograph")
    upload(page, inputs["photo"])
    make_and_download(page, "offline-gate-photo", dict(size_range=[[200, 260], [530, 690]], kb=[5, 600], fmt="JPEG"))
    shot(page, "mobile-offline-result", True, full=True)
    ctx.close()


def main():
    inputs = make_images.make_all()
    for f in os.listdir(OUT_DIR) if os.path.isdir(OUT_DIR) else []:
        os.remove(os.path.join(OUT_DIR, f))
    proc, base = start_server()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            mobile = dict(viewport={"width": 390, "height": 844}, device_scale_factor=3, is_mobile=True, has_touch=True)
            desktop = dict(viewport={"width": 1280, "height": 800}, device_scale_factor=1)
            full_flow(browser, base, "mobile-light", mobile, "light", inputs)
            full_flow(browser, base, "mobile-dark", mobile, "dark", inputs)
            full_flow(browser, base, "desktop-light", desktop, "light", inputs)
            full_flow(browser, base, "desktop-dark", desktop, "dark", inputs)
            keyboard_and_wheel(browser, base, inputs)
            offline_test(browser, base, inputs)
            browser.close()
    finally:
        proc.terminate()
    print("\n--- Pillow verification of every downloaded file ---")
    ok_files = verify_outputs.verify_all()
    bad = [r for r in RESULTS if not r[0]]
    print(f"\n{len(RESULTS) - len(bad)}/{len(RESULTS)} e2e checks passed")
    sys.exit(0 if (not bad and ok_files) else 1)


if __name__ == "__main__":
    main()
