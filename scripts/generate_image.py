#!/usr/bin/env python3
"""Generate an image with Qwen-Image-2.1 from a prompt file.

Example:
    python3 scripts/generate_image.py \
        --model /home/jziec/ai-models/Qwen-Image-2.1 \
        --prompt prompts/hero.txt \
        --output out/hero.png

Memory: the weights are ~32 GB. On small GPUs (e.g. 8 GB) use the default
`--offload sequential` and make sure WSL has enough RAM (see .wslconfig).
"""

import argparse
import random
import sys
import time
from datetime import timedelta
from pathlib import Path

TRANSPARENT_PREFIX = "This is an RGBA image with transparency. "
TRANSPARENT_SUFFIX = " The image has alpha channel and the background is transparent."


def read_prompt(path: Path) -> str:
    if not path.is_file():
        sys.exit(f"Prompt file not found: {path}")
    return path.read_text(encoding="utf-8").strip()


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--model", required=True, type=Path, help="Model directory")
    p.add_argument("--prompt", required=True, type=Path, help="Prompt file")
    p.add_argument("--output", required=True, type=Path, help="Output image path (.png by default)")
    p.add_argument("--width", type=int, default=512)
    p.add_argument("--height", type=int, default=512)
    p.add_argument("--steps", type=int, default=30)
    p.add_argument("--seed", type=int, default=None, help="Random if omitted")
    p.add_argument("--transparent", action="store_true", help="Generate an RGBA image with transparent background")
    p.add_argument(
        "--offload",
        choices=["model", "sequential", "none"],
        default="sequential",
        help="sequential: lowest VRAM, slowest (default); model: needs ~14 GB VRAM; none: needs ~32 GB VRAM",
    )
    return p.parse_args()


def main() -> None:
    args = parse_args()

    if not args.model.is_dir():
        sys.exit(f"Model directory not found: {args.model}")

    prompt = read_prompt(args.prompt)
    if args.transparent:
        prompt = TRANSPARENT_PREFIX + prompt + TRANSPARENT_SUFFIX

    output = args.output
    if not output.suffix:
        output = output.with_suffix(".png")
    output.parent.mkdir(parents=True, exist_ok=True)

    seed = args.seed if args.seed is not None else random.randrange(2**32)

    import torch
    from diffusers import QwenImage21Pipeline

    pipe = QwenImage21Pipeline.from_pretrained(
        str(args.model), dtype=torch.bfloat16, low_cpu_mem_usage=True
    )
    if args.offload == "sequential":
        pipe.enable_sequential_cpu_offload()
    elif args.offload == "model":
        pipe.enable_model_cpu_offload()
    else:
        pipe.to("cuda")

    print(f"Seed: {seed}  Size: {args.width}x{args.height}  Steps: {args.steps}")
    start = time.perf_counter()
    image = pipe(
        prompt=prompt,
        width=args.width,
        height=args.height,
        num_inference_steps=args.steps,
        generator=torch.Generator("cpu").manual_seed(seed),
    ).images[0]
    print(f"Generation took {timedelta(seconds=round(time.perf_counter() - start))}")

    image.save(output)
    print(f"Saved: {output}")


if __name__ == "__main__":
    main()
