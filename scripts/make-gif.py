"""Build a shared-palette GIF from render-film.cjs output (requires Pillow)."""
import json
import sys
from pathlib import Path
from PIL import Image

source = Path(sys.argv[1])
destination = Path(sys.argv[2])
files = sorted(source.glob("*.png"))
if not files:
    raise SystemExit("No PNG frames found.")
timing = json.loads((source / "timing.json").read_text())
samples = [files[i] for i in range(0, len(files), max(1, len(files) // 16))]
montage = Image.new("RGB", (240 * len(samples), 140))
for i, file in enumerate(samples):
    with Image.open(file) as image:
        image = image.convert("RGB")
        image.thumbnail((240, 140))
        montage.paste(image, (240 * i, 0))
palette = montage.quantize(colors=80)
frames = []
durations = []
for i, file in enumerate(files):
    with Image.open(file) as image:
        frames.append(image.convert("RGB").quantize(palette=palette, dither=Image.Dither.NONE))
    # GIF uses 10 ms ticks; distribute rounding so playback speed stays correct.
    durations.append(round((i + 1) * timing["frameDurationMs"] / 10) * 10
                     - round(i * timing["frameDurationMs"] / 10) * 10)
destination.parent.mkdir(parents=True, exist_ok=True)
frames[0].save(destination, save_all=True, append_images=frames[1:],
               duration=durations, loop=0, optimize=True, disposal=1)
print(f"{len(frames)} frames, {destination.stat().st_size / 1024 / 1024:.2f} MiB: {destination}")
