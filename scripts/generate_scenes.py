#!/usr/bin/env python3
"""Write a text-to-image scene prompt for each PHYSICAL challenge that needs an illustration.

For every PHYSICAL challenge in the bank, ask Claude (one `claude -p` call) whether
the English text is enough to picture the task. If an illustration helps, the scene
prompt goes to scripts/scenes/NNN.txt. Otherwise the ID and reason go to
scripts/scenes/skipped.txt. scripts/style.md is appended to scene prompts later,
so scenes must not repeat it.

Example:
    python3 scripts/generate_scenes.py --only 1 62 --model sonnet
    python3 scripts/generate_scenes.py --dry-run --only 1
"""

import argparse
import json
import subprocess
import sys
import tempfile
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import yaml

SCRIPTS_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPTS_DIR.parent / "src" / "challenge-bank" / "data"
STYLE_FILE = SCRIPTS_DIR / "style.md"
SCENES_DIR = SCRIPTS_DIR / "scenes"
SKIPPED_FILE = SCENES_DIR / "skipped.txt"

MAX_ATTEMPTS = 3

SYSTEM_PROMPT = """\
You prepare text-to-image prompts for illustrated challenge cards in a party betting game.
Each card shows one physical challenge as short English text. You decide whether the card
needs an illustration and, if so, you describe the scene to draw.

## Step 1: decide

Skip the illustration when the text alone fully explains the physical action
(example: "Will the player jump 5 times?").
Illustrate when the setup, the props, or the body pose are hard to picture from the text
(examples: coins thrown from behind the back, threading a needle).

## Step 2: describe the scene (only when you illustrate)

The drawing style is fixed and defined below. It is appended to your scene text later.
Do not repeat, restate, or contradict it. Do not write style words
(flat, pastel, kawaii, vector, outline, white background, and so on).

Write the scene as one paragraph of plain English, about 80 to 150 words:
- Start with one sentence that introduces the character: who it is (for example a young boy,
  a girl, a grandma) and what it wears, in this form: "A young boy in a mint-green sleeveless
  top, orange-peach shorts, striped socks, and brown shoes." Choose a different character and
  outfit for each card. Use colors from the style palette for the clothes.
- Name the single frozen moment to draw: one attempt only.
- Describe the character's pose, what the hands do, and where the character looks.
- Describe each prop with its shape, size, and color. Use colors from the style palette.
  Give size by comparison ("as big as the character's hand"), not in units.
- Say where every object is, relative to the character and to the other objects.
- Say what the short motion lines or the dotted trajectory show, if the moment has motion.
- Add no scenery, no background, and no extra characters unless the challenge needs them.
- Ignore attempt counts, repeat counts, and time limits. Draw no stopwatch, clock, timer, or counter.
- Write no text in the image, with one exception: when the task is about a measured size or
  distance (for example "2 m"), describe a thin dimension line with a short label that shows
  that measurement. Never label counts or time.

Example scene (for the challenge "Will the player manage to throw 2 coins into the air from
behind their back and catch them? (2 attempts)"). The character here only shows the level of
detail; do not copy it.
A young boy in a mint-green sleeveless top, orange-peach shorts, striped socks, and brown
shoes stands in a relaxed, slightly leaning-back pose, seen from the front, with both arms
stretched out to the sides and bent upward at the elbows, mitten hands open and facing up.
Two round cream-colored coins with a small coral red star in the middle have just been thrown
from behind the boy's back and now hang in the air above and in front of his head, one
slightly higher than the other. A thin dotted brown line starts behind his right shoulder and
arcs over the head to each coin, and a few short curved motion lines sit right below each
coin. The boy looks up at the coins with a tiny surprised smile. A second, smaller dotted
arc below shows where the coins will fall back into the open hands.

## Drawing style (appended later, do not repeat)

{style}

## Output

Reply with JSON only, no code fences, no other text. Use exactly one of these shapes:
{{"illustrate": false, "reason": "<one short line>"}}
{{"illustrate": true, "scene": "<the scene paragraph>"}}
"""


def load_physical_challenges() -> dict[int, str]:
    challenges = {}
    for path in sorted(DATA_DIR.glob("*.yaml")):
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
        if data.get("type") != "PHYSICAL":
            continue
        challenges[int(data["id"])] = " ".join(str(data["content"]["en"]).split())
    return challenges


def load_skipped() -> dict[int, str]:
    if not SKIPPED_FILE.is_file():
        return {}
    skipped = {}
    for line in SKIPPED_FILE.read_text(encoding="utf-8").splitlines():
        number, _, reason = line.partition(":")
        if number.strip().isdigit():
            skipped[int(number)] = reason.strip()
    return skipped


def save_skipped(skipped: dict[int, str]) -> None:
    lines = [f"{number:03d}: {reason}" for number, reason in sorted(skipped.items())]
    SKIPPED_FILE.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")


def build_user_prompt(text: str) -> str:
    return f"Challenge text:\n{text}"


def parse_reply(raw: str) -> dict:
    start, end = raw.find("{"), raw.rfind("}")
    if start == -1 or end < start:
        raise ValueError(f"no JSON object in reply: {raw[:200]!r}")
    reply = json.loads(raw[start : end + 1])
    if reply.get("illustrate") is True and str(reply.get("scene", "")).strip():
        return {"illustrate": True, "scene": str(reply["scene"]).strip()}
    if reply.get("illustrate") is False and str(reply.get("reason", "")).strip():
        return {"illustrate": False, "reason": " ".join(str(reply["reason"]).split())}
    raise ValueError(f"unexpected reply shape: {raw[:200]!r}")


def ask_claude(system_prompt: str, text: str, model: str) -> dict:
    with tempfile.TemporaryDirectory() as neutral_cwd:
        result = subprocess.run(
            [
                "claude", "-p", build_user_prompt(text),
                "--output-format", "json",
                "--model", model,
                "--system-prompt", system_prompt,
                "--tools", "",
                "--no-session-persistence",
                "--disable-slash-commands",
                "--strict-mcp-config",
            ],
            cwd=neutral_cwd,
            capture_output=True,
            text=True,
            timeout=300,
        )
    if result.returncode != 0:
        raise RuntimeError(f"claude exited with {result.returncode}: {result.stderr.strip()[:300]}")
    envelope = json.loads(result.stdout)
    if envelope.get("is_error"):
        raise RuntimeError(f"claude reported an error: {str(envelope.get('result'))[:300]}")
    return parse_reply(envelope["result"])


def ask_with_retries(system_prompt: str, text: str, model: str) -> dict:
    last_error: Exception | None = None
    for _ in range(MAX_ATTEMPTS):
        try:
            return ask_claude(system_prompt, text, model)
        except (RuntimeError, ValueError, subprocess.TimeoutExpired) as error:
            last_error = error
    raise RuntimeError(str(last_error))


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--only", type=int, nargs="+", metavar="ID", help="Process only these challenge IDs")
    p.add_argument("--force", action="store_true", help="Redo challenges that already have a scene or a skip entry")
    p.add_argument("--model", default="sonnet", help="Claude model alias or ID (default: sonnet)")
    p.add_argument("--jobs", type=int, default=1, help="Parallel claude calls (default: 1)")
    p.add_argument("--dry-run", action="store_true", help="Print the prompt for the first selected challenge and exit")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    system_prompt = SYSTEM_PROMPT.format(style=STYLE_FILE.read_text(encoding="utf-8").strip())

    challenges = load_physical_challenges()
    if args.only:
        unknown = sorted(set(args.only) - challenges.keys())
        if unknown:
            sys.exit(f"Not PHYSICAL challenges or not found: {unknown}")
        challenges = {number: challenges[number] for number in args.only}

    SCENES_DIR.mkdir(parents=True, exist_ok=True)
    skipped = load_skipped()
    pending = {
        number: text
        for number, text in challenges.items()
        if args.force or (not (SCENES_DIR / f"{number:03d}.txt").exists() and number not in skipped)
    }

    if args.dry_run:
        if not pending:
            sys.exit("Nothing to process.")
        number, text = next(iter(pending.items()))
        print(f"--- system prompt ---\n{system_prompt}\n--- user prompt (challenge {number:03d}) ---\n{build_user_prompt(text)}")
        return

    print(f"{len(pending)} to process, {len(challenges) - len(pending)} already done.")
    lock = threading.Lock()
    written, skipped_now, failed = [], [], []

    def handle(number: int, text: str) -> None:
        try:
            reply = ask_with_retries(system_prompt, text, args.model)
        except RuntimeError as error:
            with lock:
                failed.append(number)
                print(f"{number:03d} FAILED: {error}", file=sys.stderr)
            return
        scene_path = SCENES_DIR / f"{number:03d}.txt"
        with lock:
            if reply["illustrate"]:
                scene_path.write_text(reply["scene"] + "\n", encoding="utf-8")
                if skipped.pop(number, None) is not None:
                    save_skipped(skipped)
                written.append(number)
                print(f"{number:03d} scene written")
            else:
                scene_path.unlink(missing_ok=True)
                skipped[number] = reply["reason"]
                save_skipped(skipped)
                skipped_now.append(number)
                print(f"{number:03d} skipped: {reply['reason']}")

    with ThreadPoolExecutor(max_workers=max(1, args.jobs)) as pool:
        futures = [pool.submit(handle, number, text) for number, text in pending.items()]
        for future in as_completed(futures):
            future.result()

    print(f"Done: {len(written)} written, {len(skipped_now)} skipped, {len(failed)} failed.")
    if failed:
        print(f"Failed IDs: {sorted(failed)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
