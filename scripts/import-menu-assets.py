"""Import selected UI demo motifs as local WebP assets (requires Pillow)."""
import argparse
import base64
import io
import json
from pathlib import Path
import re
import shutil

from PIL import Image

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("demo", type=Path, help="Path to Ashes-of-Meridian-Demo.html")
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
source = args.demo.read_text()
match = re.search(r"window\.AOM_ASSETS=(\{[^\n]+\});?", source)
if not match:
    raise ValueError("Demo asset dictionary not found")
assets = json.loads(match[1])
selected = {
    "logo-emblem": "emblem", "logo-ashes": "logo-ashes",
    "logo-of": "logo-of", "logo-meridian": "logo-meridian",
    "checkpoint": "checkpoint", "score": "expedition",
    "settings": "settings",
    "aether-hero": "echo-reward", "aether": "echo", "alloy": "cinder",
    "supply": "supply", "energy": "energy", "shield": "shield", "skull": "skull",
    "scan": "scan", "repair": "repair", "strike": "orbital", "reinforce": "drop",
    "buildings": "buildings", "infantry": "infantry", "vehicles": "vehicles", "aircraft": "aircraft",
    "home": "home", "plus": "plus", "minus": "minus", "pause": "pause",
    "back": "back", "close": "close",
    "starting-alloy": "starting-cinder", "workers": "workers", "evacuation": "evacuation",
    "logistics": "logistics", "repair-logistics": "repair-logistics", "construction": "construction",
    "crate": "crate", "survey": "survey", "pioneers": "pioneers", "workshop": "workshop",
}
output = root / "assets" / "ui"
output.mkdir(parents=True, exist_ok=True)
for key, name in selected.items():
    url = assets[key]
    if not url.startswith(("data:image/png;base64,", "data:image/webp;base64,")):
        raise ValueError(f"Unexpected source format for {key}")
    with Image.open(io.BytesIO(base64.b64decode(url.split(",", 1)[1], validate=True))) as image:
        image.convert("RGBA").save(output / f"{name}.webp", "WEBP", quality=80)
font = args.demo.parent / "06-fonts" / "aldrich"
font_output = root / "assets" / "fonts" / "aldrich"
font_output.mkdir(parents=True, exist_ok=True)
shutil.copyfile(font / "Aldrich-Regular.ttf", font_output / "Aldrich-Regular.ttf")
# Keep the license text, normalizing trailing whitespace for repository checks.
license_text = (font / "OFL.txt").read_text()
(font_output / "OFL.txt").write_text("\n".join(line.rstrip() for line in license_text.splitlines()) + "\n")
print(f"Imported {len(selected)} UI motifs and Aldrich with its license")
