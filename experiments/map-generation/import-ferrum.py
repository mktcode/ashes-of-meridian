#!/usr/bin/env python3
"""Import only user-provided STRATA Ferrum into the standalone terrain lab.

Requires Pillow for this offline authoring step, not for viewing the lab.
Albedo stays 2048; normal/material data use 1024. WebP RGB quality is 80;
alpha stores height/AO. No gallery renderer, other materials or emission.
"""
import argparse
import base64
import hashlib
import io
import json
from pathlib import Path
import re

from PIL import Image

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("gallery", type=Path)
args = parser.parse_args()
source = args.gallery.read_text(encoding="utf-8")
match = re.search(r"const LAB_ASSETS\s*=\s*(\{.*?\});", source, re.S)
if not match:
    raise ValueError("Gallery has no LAB_ASSETS object")
rock = json.loads(match[1])["rock"]
images, hashes = {}, {}
for name in ("basecolor", "normal", "data"):
    raw = base64.b64decode(rock[name].split(",", 1)[1], validate=True)
    images[name] = Image.open(io.BytesIO(raw)).convert("RGB")
    hashes[name] = hashlib.sha256(raw).hexdigest()
if any(image.size != (2048, 2048) for image in images.values()):
    raise ValueError("Ferrum source maps must be matching 2048-square images")
albedo = images["basecolor"].copy()
albedo.putalpha(images["data"].getchannel("R"))
normal = images["normal"].resize((1024, 1024), Image.Resampling.LANCZOS)
data = images["data"].resize((1024, 1024), Image.Resampling.LANCZOS)
detail = Image.merge("RGBA", (normal.getchannel("R"), normal.getchannel("G"),
                              data.getchannel("G"), data.getchannel("B")))
assets = {"material": "Ferrum", "source": args.gallery.name,
          "sourceSHA256": hashes, "quality": 80,
          "packing": {"albedo": "RGB=sRGB color,A=linear height",
                      "detail": "RG=OpenGL normal XY,B=roughness,A=AO"}, "maps": {}}
for name, image in (("albedo", albedo), ("detail", detail)):
    output = io.BytesIO()
    image.save(output, format="WEBP", quality=80, method=4)
    raw = output.getvalue()
    assets["maps"][name] = {"width": image.width, "height": image.height,
        "bytes": len(raw), "uri": "data:image/webp;base64," + base64.b64encode(raw).decode("ascii")}
    print(f"Ferrum {name}: {image.width}x{image.height}, {len(raw)} bytes, WebP Q80")
path = Path(__file__).with_name("index.html")
html = path.read_text(encoding="utf-8")
pattern = r'(<script id="terrain-ferrum-assets" type="application/json">).*?(</script>)'
html, count = re.subn(pattern, lambda m: m[1] + "\n" + json.dumps(assets, separators=(",", ":")) + "\n" + m[2], html, flags=re.S)
if count != 1:
    raise ValueError("Expected exactly one terrain-ferrum-assets block")
path.write_text(html, encoding="utf-8")
