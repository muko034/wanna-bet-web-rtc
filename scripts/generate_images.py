#!/usr/bin/env python3
"""Generate an image for every scene prompt in scripts/scenes/NNN.md.

The scene text plus scripts/style.md is the prompt. Images go to out/NNN.png in the
repo root. The model loads once. Existing images are skipped unless --force is set.
Set MODEL_DIR to use another model directory.

Example:
    python3 scripts/generate_images.py
    python3 scripts/generate_images.py --only 1,5 --force
"""

import argparse
import os
import random
import re
import sys
import time
from datetime import timedelta
from pathlib import Path

from generate_image import generate, load_pipeline

SCRIPTS_DIR = Path(__file__).resolve().parent
STYLE_FILE = SCRIPTS_DIR / "style.md"
SCENES_DIR = SCRIPTS_DIR / "scenes"
OUT_DIR = SCRIPTS_DIR.parent / "out"

DEFAULT_MODEL = "/home/jziec/ai-models/Qwen-Image-2.1"
SIZE = 512
STEPS = 30
OFFLOAD = "sequential"

SCENE_FILE = re.compile(r"\d{3}\.md")


def parse_only(value: str) -> set[int]:
    try:
        return {int(part) for part in value.split(",") if part.strip()}
    except ValueError:
        raise argparse.ArgumentTypeError(f"Expected comma-separated scene numbers, got: {value}")


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--only", type=parse_only, default=None, help="Comma-separated scene numbers, e.g. 1,5")
    p.add_argument("--force", action="store_true", help="Overwrite existing images")
    return p.parse_args()


def list_scenes(only: set[int] | None) -> list[Path]:
    scenes = sorted(f for f in SCENES_DIR.iterdir() if SCENE_FILE.fullmatch(f.name))
    if only is not None:
        scenes = [f for f in scenes if int(f.stem) in only]
    return scenes


def main() -> None:
    args = parse_args()

    model = Path(os.environ.get("MODEL_DIR", DEFAULT_MODEL))
    if not model.is_dir():
        sys.exit(f"Model directory not found: {model}")

    style = STYLE_FILE.read_text(encoding="utf-8").strip()
    scenes = list_scenes(args.only)
    todo = [f for f in scenes if args.force or not (OUT_DIR / f"{f.stem}.png").exists()]
    print(f"{len(todo)} to generate, {len(scenes) - len(todo)} skipped (already exist)")
    if not todo:
        return

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    pipe = load_pipeline(model, OFFLOAD)

    import torch

    failed: list[str] = []
    for index, scene_file in enumerate(todo, start=1):
        number = scene_file.stem
        output = OUT_DIR / f"{number}.png"
        prompt = scene_file.read_text(encoding="utf-8").strip() + "\n" + style
        seed = random.randrange(2**32)
        print(f"[{index}/{len(todo)}] {number}  seed {seed}")
        start = time.perf_counter()
        try:
            image = generate(pipe, prompt, SIZE, SIZE, STEPS, seed)
            image.save(output)
        except Exception as error:
            print(f"FAILED {number}: {error}", file=sys.stderr)
            failed.append(number)
            torch.cuda.empty_cache()
            continue
        print(f"Saved {output} in {timedelta(seconds=round(time.perf_counter() - start))}")

    if failed:
        sys.exit(f"{len(failed)} failed: {', '.join(failed)}")


if __name__ == "__main__":
    main()
