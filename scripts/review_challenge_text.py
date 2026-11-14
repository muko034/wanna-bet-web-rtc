#!/usr/bin/env python3
"""Review the spelling, wording, and clarity of each challenge text, and fix it in place.

For every challenge in the bank, ask Claude (one `claude -p` call) to check the Polish and
English text. Polish is the source: English follows it. When Claude improves the text, the
script rewrites the `content` block of the YAML file and leaves the other keys as they are.
Every result goes to scripts/challenge-text-review.txt, one line per ID, so a re-run skips
the IDs already reviewed. The script commits nothing and does not regenerate
src/challenge-bank/challenge-bank.ts (run `npm run generate:challenge-bank` after review).

Example:
    python3 scripts/review_challenge_text.py --only 11 62
    python3 scripts/review_challenge_text.py --jobs 4
    python3 scripts/review_challenge_text.py --dry-run --only 11
"""

import argparse
import json
import re
import subprocess
import sys
import tempfile
import threading
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import yaml

SCRIPTS_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPTS_DIR.parent / "src" / "challenge-bank" / "data"
REVIEW_FILE = SCRIPTS_DIR / "challenge-text-review.txt"

MAX_ATTEMPTS = 3
LANGUAGES = ("pl", "en")

SYSTEM_PROMPT = """\
You review the text of challenge cards in a party betting game. In each round one player
tries a challenge, and the other players bet on whether that player succeeds. The card shows
the challenge text in Polish ("pl") and English ("en"). The card keeps line breaks.

## What you may change

1. Spelling, grammar, and punctuation, in both languages.
2. Wording: make the text clearer, shorter, and more natural, with the same meaning.
3. Content, only when the challenge is unclear: add a missing setup detail, or remove an
   ambiguity, so the players can agree whether the player succeeded.

## What you must keep

- Every count, number of attempts, distance, size, weight, and time. Write numbers as digits,
  exactly as they are now. Do not turn "30 seconds" into "half a minute".
- The props, the task, and how hard the challenge is.
- If you find a problem you must not fix (for example a number that differs between "pl" and
  "en", a time in the text that does not match the time limit, or a challenge that seems
  unfair or impossible), leave the text as it is and describe the problem in "note".

## Polish is the source

The Polish text is the original. Fix the Polish text first, then make the English text say
the same thing as the Polish text, in natural English. Do not change the Polish text to
match the English text.

## House style

- Open with the question form used in the bank: "Czy gracz…?" or "Czy graczowi uda się…?"
  in Polish, and "Will the player…?" or "Will the player manage to…?" in English.
- Call the person who does the challenge "gracz" / "the player". Do not use "zawodnik",
  "uczestnik", "Challenger", or "contestant".
- Call everyone else "pozostali gracze" / "the other players". Do not use "osoby",
  "other people", or "bettors".
- Line layout, the same in both languages:
  1. Line 1: the main question.
  2. Next line: a short note in brackets, if any, such as "(2 próby)" / "(2 attempts)".
  3. Next lines: setup rules for the other players, if any.
  Put no empty lines and no trailing spaces.

## Do not change for the sake of change

If the text is already correct and clear, return it unchanged with "changed": false.
Do not rephrase correct text only to make it different.

## Input

You get the card as JSON: "type" (PHYSICAL or MENTAL), "timeLimit" (NONE, QUARTER_MINUTE =
15 seconds, HALF_MINUTE = 30 seconds, ONE_MINUTE = 60 seconds; a timer shows it to the
players), "pl", and "en".

## Output

Reply with JSON only, no code fences, no other text, in this shape:
{"changed": true or false, "pl": "<full Polish text>", "en": "<full English text>",
 "reason": "<one short line: what you changed and why, or empty when unchanged>",
 "note": "<one short line about a problem you did not fix, or empty>"}
Use "\\n" for line breaks inside the texts.
"""


def load_challenges() -> dict[int, dict]:
    challenges = {}
    for path in sorted(DATA_DIR.glob("*.yaml")):
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
        challenges[int(data["id"])] = {
            "path": path,
            "type": data["type"],
            "timeLimit": data["timeLimit"],
            "pl": str(data["content"]["pl"]),
            "en": str(data["content"]["en"]),
        }
    return challenges


def load_reviewed() -> dict[int, str]:
    if not REVIEW_FILE.is_file():
        return {}
    reviewed = {}
    for line in REVIEW_FILE.read_text(encoding="utf-8").splitlines():
        number, _, result = line.partition(":")
        if number.strip().isdigit():
            reviewed[int(number)] = result.strip()
    return reviewed


def save_reviewed(reviewed: dict[int, str]) -> None:
    lines = [f"{number:03d}: {result}" for number, result in sorted(reviewed.items())]
    REVIEW_FILE.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")


def build_user_prompt(challenge: dict) -> str:
    card = {key: challenge[key] for key in ("type", "timeLimit", "pl", "en")}
    return "Challenge card:\n" + json.dumps(card, ensure_ascii=False, indent=2)


def clean_text(text: str) -> str:
    lines = [line.strip() for line in str(text).strip().splitlines()]
    return "\n".join(line for line in lines if line)


def numbers_in(text: str) -> Counter:
    return Counter(number.replace(",", ".") for number in re.findall(r"\d+(?:[.,]\d+)?", text))


def one_line(text: object) -> str:
    return " ".join(str(text or "").split())


def parse_reply(raw: str, challenge: dict) -> dict:
    start, end = raw.find("{"), raw.rfind("}")
    if start == -1 or end < start:
        raise ValueError(f"no JSON object in reply: {raw[:200]!r}")
    reply = json.loads(raw[start : end + 1])
    if not isinstance(reply.get("changed"), bool):
        raise ValueError(f"unexpected reply shape: {raw[:200]!r}")
    texts = {}
    for language in LANGUAGES:
        text = clean_text(reply.get(language, ""))
        if not text:
            raise ValueError(f"empty {language!r} text in reply")
        if numbers_in(text) != numbers_in(challenge[language]):
            raise ValueError(
                f"numbers changed in {language!r}: {sorted(numbers_in(challenge[language]).elements())}"
                f" -> {sorted(numbers_in(text).elements())}"
            )
        texts[language] = text
    changed = any(texts[language] != clean_text(challenge[language]) for language in LANGUAGES)
    return {**texts, "changed": changed, "reason": one_line(reply.get("reason")), "note": one_line(reply.get("note"))}


def ask_claude(challenge: dict, model: str) -> dict:
    with tempfile.TemporaryDirectory() as neutral_cwd:
        result = subprocess.run(
            [
                "claude", "-p", build_user_prompt(challenge),
                "--output-format", "json",
                "--model", model,
                "--system-prompt", SYSTEM_PROMPT,
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
    return parse_reply(envelope["result"], challenge)


def ask_with_retries(challenge: dict, model: str) -> dict:
    last_error: Exception | None = None
    for _ in range(MAX_ATTEMPTS):
        try:
            return ask_claude(challenge, model)
        except (RuntimeError, ValueError, subprocess.TimeoutExpired) as error:
            last_error = error
    raise RuntimeError(str(last_error))


def content_block(pl: str, en: str) -> str:
    lines = ["content:"]
    for language, text in (("pl", pl), ("en", en)):
        lines.append(f"  {language}: |-")
        lines.extend(f"    {line}" for line in text.splitlines())
    return "\n".join(lines) + "\n"


def write_content(path: Path, pl: str, en: str) -> None:
    """Replace only the `content:` block; keep id, type, timeLimit, and their order."""
    original = path.read_text(encoding="utf-8")
    pattern = re.compile(r"^content:[^\n]*\n(?:[ \t]+[^\n]*\n|\n)*", re.MULTILINE)
    ends_with_newline = original.endswith("\n")
    updated, count = pattern.subn(lambda _: content_block(pl, en), original + ("" if ends_with_newline else "\n"), count=1)
    if count != 1:
        raise RuntimeError(f"no content block in {path.name}")
    if not ends_with_newline:
        updated = updated.removesuffix("\n")
    data = yaml.safe_load(updated)
    if data["content"] != {"pl": pl, "en": en}:
        raise RuntimeError(f"rewritten YAML does not round-trip in {path.name}")
    path.write_text(updated, encoding="utf-8")


def format_result(reply: dict) -> str:
    result = f"changed: {reply['reason'] or 'no reason given'}" if reply["changed"] else "unchanged"
    if reply["note"]:
        result += f" | note: {reply['note']}"
    return result


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--only", type=int, nargs="+", metavar="ID", help="Process only these challenge IDs")
    p.add_argument("--force", action="store_true", help="Redo challenges that already have a review entry")
    p.add_argument("--model", default="opus", help="Claude model alias or ID (default: opus)")
    p.add_argument("--jobs", type=int, default=1, help="Parallel claude calls (default: 1)")
    p.add_argument("--dry-run", action="store_true", help="Print the prompt for the first selected challenge and exit")
    return p.parse_args()


def main() -> None:
    args = parse_args()

    challenges = load_challenges()
    if args.only:
        unknown = sorted(set(args.only) - challenges.keys())
        if unknown:
            sys.exit(f"Challenges not found: {unknown}")
        challenges = {number: challenges[number] for number in args.only}

    reviewed = load_reviewed()
    pending = {
        number: challenge
        for number, challenge in challenges.items()
        if args.force or number not in reviewed
    }

    if args.dry_run:
        if not pending:
            sys.exit("Nothing to process.")
        number, challenge = next(iter(pending.items()))
        print(f"--- system prompt ---\n{SYSTEM_PROMPT}\n--- user prompt (challenge {number:03d}) ---\n{build_user_prompt(challenge)}")
        return

    print(f"{len(pending)} to process, {len(challenges) - len(pending)} already done.")
    lock = threading.Lock()
    changed, unchanged, noted, failed = [], [], [], []

    def handle(number: int, challenge: dict) -> None:
        try:
            reply = ask_with_retries(challenge, args.model)
        except RuntimeError as error:
            with lock:
                failed.append(number)
                print(f"{number:03d} FAILED: {error}", file=sys.stderr)
            return
        with lock:
            if reply["changed"]:
                try:
                    write_content(challenge["path"], reply["pl"], reply["en"])
                except RuntimeError as error:
                    failed.append(number)
                    print(f"{number:03d} FAILED: {error}", file=sys.stderr)
                    return
                changed.append(number)
            else:
                unchanged.append(number)
            if reply["note"]:
                noted.append(number)
            reviewed[number] = format_result(reply)
            save_reviewed(reviewed)
            print(f"{number:03d} {reviewed[number]}")

    with ThreadPoolExecutor(max_workers=max(1, args.jobs)) as pool:
        futures = [pool.submit(handle, number, challenge) for number, challenge in pending.items()]
        for future in as_completed(futures):
            future.result()

    print(
        f"Done: {len(changed)} changed, {len(unchanged)} unchanged, "
        f"{len(noted)} with notes, {len(failed)} failed."
    )
    if changed:
        print("Run `npm run generate:challenge-bank` after review.")
    if failed:
        print(f"Failed IDs: {sorted(failed)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
