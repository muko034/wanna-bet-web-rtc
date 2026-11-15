#!/usr/bin/env python3
"""Generate new challenges for the bank, one `claude -p` call per challenge.

Each call sends the prompt in scripts/prompts/generate-challenges.md (as the system prompt,
with no tools), plus a brief: a type and a focus. A run splits the types evenly (unless
--type is given) and cycles through the focuses of each type, so the calls do not all return
the same idea. Each call gets one challenge back as JSON. The script checks the reply
(including its length), retries a bad reply up to 3 times, and writes the challenge to
src/challenge-bank/data/NNN.yaml with the next free ID. The type, focus and "why" line of each
challenge go to out/challenge-generation-log.txt. The script commits nothing and does not
regenerate src/challenge-bank/challenge-bank.ts (run `npm run generate:challenge-bank` after
review).

Example:
    python3 scripts/generate_challenges.py --count 10
    python3 scripts/generate_challenges.py --count 5 --type MENTAL --model opus
    python3 scripts/generate_challenges.py --dry-run --count 4
"""

import argparse
import json
import random
import re
import subprocess
import sys
import tempfile
from collections import Counter
from pathlib import Path

import yaml

SCRIPTS_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPTS_DIR.parent
DATA_DIR = ROOT_DIR / "src" / "challenge-bank" / "data"
PROMPT_FILE = SCRIPTS_DIR / "prompts" / "generate-challenges.md"
LOG_FILE = ROOT_DIR / "out" / "challenge-generation-log.txt"

MAX_ATTEMPTS = 3
MAX_LINES = 4
MAX_WORDS = 50
LANGUAGES = ("pl", "en")
TYPES = ("PHYSICAL", "MENTAL")
# Each call gets a random focus of its type, so the calls do not all return the model's favourite idea.
FOCUSES = {
    "PHYSICAL": (
        "aim: throw, flick, roll or drop an object onto or into a target",
        "balance: keep the body or an object steady",
        "fine dexterity: fingers and small objects",
        "speed: fast hands or feet against the clock",
        "strength or endurance: hold, lift, carry or keep going",
        "flexibility: reach, bend or twist",
        "coordination: two different movements at once, or a rhythm",
        "building: stack or assemble something that must stay up",
    ),
    "MENTAL": (
        "memory: remember and repeat a sequence, a list or details",
        "wordplay: letters, rhymes, spelling, words backwards",
        "general knowledge: facts, people, places, dates",
        "pop culture: films, TV series, music, sport, brands",
        "mental maths: calculate in the head",
        "estimation: guess a time, length, weight or count within a margin",
        "observation: notice or recall details of the room or the other players",
        "speech: tongue twisters, talking under a constraint, avoiding a word",
        "logic: a riddle, a pattern or a quick puzzle",
    ),
}
TIME_LIMIT_SECONDS = {"NONE": None, "QUARTER_MINUTE": 15, "HALF_MINUTE": 30, "ONE_MINUTE": 60}
DURATION = re.compile(r"(\d+)\s*(seconds?|secs?|s|minutes?|mins?)\b", re.IGNORECASE)


def next_id() -> int:
    ids = [int(yaml.safe_load(path.read_text(encoding="utf-8"))["id"]) for path in DATA_DIR.glob("*.yaml")]
    return max(ids, default=0) + 1


def clean_text(text: object) -> str:
    lines = [line.strip() for line in str(text or "").strip().splitlines()]
    return "\n".join(line for line in lines if line)


def one_line(text: object) -> str:
    return " ".join(str(text or "").split())


def numbers_in(text: str) -> Counter:
    return Counter(number.replace(",", ".") for number in re.findall(r"\d+(?:[.,]\d+)?", text))


def durations_in(text: str) -> list[int]:
    return [int(amount) * (60 if unit.lower().startswith("m") else 1) for amount, unit in DURATION.findall(text)]


def extract_json(raw: str) -> dict:
    """Return the first JSON object in the reply; tolerate code fences and text around it."""
    decoder = json.JSONDecoder(strict=False)  # allow raw line breaks inside strings
    for match in re.finditer(r"\{", raw):
        try:
            value, _ = decoder.raw_decode(raw, match.start())
        except json.JSONDecodeError:
            continue
        if isinstance(value, dict):
            return value
    raise ValueError(f"no JSON object in reply: {raw[:200]!r}")


def check_time(en: str, time_limit: str) -> None:
    durations = durations_in(en)
    limit = TIME_LIMIT_SECONDS[time_limit]
    if limit is None:
        if durations:
            raise ValueError(f"timeLimit is NONE but the text has a duration: {durations} s")
        return
    if limit not in durations:
        raise ValueError(f"timeLimit is {time_limit} but the text does not say {limit} s: {durations} s")
    longer = [seconds for seconds in durations if seconds > limit]
    if longer:
        raise ValueError(f"the text has a duration longer than timeLimit {time_limit}: {longer} s")


def check_length(en: str) -> None:
    lines, words = len(en.splitlines()), len(en.split())
    if lines > MAX_LINES or words > MAX_WORDS:
        raise ValueError(f"too long: {lines} lines, {words} words (max {MAX_LINES} lines, {MAX_WORDS} words)")


def build_user_prompt(challenge_type: str, focus: str) -> str:
    return f"Write one new challenge card.\nType: {challenge_type}\nFocus: {focus}"


def parse_reply(raw: str, expected_type: str) -> dict:
    reply = extract_json(raw)
    challenge_type = reply.get("type")
    if challenge_type != expected_type:
        raise ValueError(f"type {challenge_type!r} is not the requested {expected_type!r}")
    time_limit = reply.get("timeLimit")
    if time_limit not in TIME_LIMIT_SECONDS:
        raise ValueError(f"bad timeLimit: {time_limit!r}")
    texts = {language: clean_text(reply.get(language)) for language in LANGUAGES}
    for language, text in texts.items():
        if not text:
            raise ValueError(f"empty {language!r} text")
    if numbers_in(texts["en"]) != numbers_in(texts["pl"]):
        raise ValueError(
            f"numbers differ: en {sorted(numbers_in(texts['en']).elements())}"
            f" vs pl {sorted(numbers_in(texts['pl']).elements())}"
        )
    check_time(texts["en"], time_limit)
    check_length(texts["en"])
    return {"type": challenge_type, "timeLimit": time_limit, **texts, "why": one_line(reply.get("why"))}


def ask_claude(system_prompt: str, challenge_type: str, focus: str, model: str | None) -> dict:
    command = [
        "claude", "-p", build_user_prompt(challenge_type, focus),
        "--output-format", "json",
        "--system-prompt", system_prompt,
        "--tools", "",
        "--no-session-persistence",
        "--disable-slash-commands",
        "--strict-mcp-config",
    ]
    if model:
        command += ["--model", model]
    with tempfile.TemporaryDirectory() as neutral_cwd:
        result = subprocess.run(command, cwd=neutral_cwd, capture_output=True, text=True, timeout=300)
    if result.returncode != 0:
        raise RuntimeError(f"claude exited with {result.returncode}: {result.stderr.strip()[:300]}")
    envelope = json.loads(result.stdout)
    if envelope.get("is_error"):
        raise RuntimeError(f"claude reported an error: {str(envelope.get('result'))[:300]}")
    return parse_reply(envelope["result"], challenge_type)


def ask_with_retries(system_prompt: str, challenge_type: str, focus: str, model: str | None) -> dict:
    last_error: Exception | None = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            return ask_claude(system_prompt, challenge_type, focus, model)
        except (RuntimeError, ValueError, subprocess.TimeoutExpired) as error:
            last_error = error
            print(f"  attempt {attempt} failed: {error}", file=sys.stderr)
    raise RuntimeError(str(last_error))


def to_yaml(number: int, challenge: dict) -> str:
    lines = [f"id: {number}", f"type: {challenge['type']}", "content:"]
    for language in LANGUAGES:
        lines.append(f"  {language}: |-")
        lines.extend(f"    {line}" for line in challenge[language].splitlines())
    lines.append(f"timeLimit: {challenge['timeLimit']}")
    return "\n".join(lines) + "\n"


def write_challenge(number: int, challenge: dict) -> Path:
    path = DATA_DIR / f"{number:03d}.yaml"
    if path.exists():
        raise RuntimeError(f"{path.name} already exists")
    text = to_yaml(number, challenge)
    data = yaml.safe_load(text)
    expected = {
        "id": number,
        "type": challenge["type"],
        "content": {language: challenge[language] for language in LANGUAGES},
        "timeLimit": challenge["timeLimit"],
    }
    if data != expected:
        raise RuntimeError(f"YAML for {path.name} does not round-trip")
    path.write_text(text, encoding="utf-8")
    return path


def log_why(number: int, challenge_type: str, focus: str, why: str) -> None:
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    focus_name = focus.split(":")[0]
    with LOG_FILE.open("a", encoding="utf-8") as log:
        log.write(f"{number:03d}: [{challenge_type} / {focus_name}] {why or 'no reason given'}\n")


def plan_briefs(count: int, only_type: str | None) -> list[tuple[str, str]]:
    """Pick a (type, focus) per call: types split evenly, focuses cycled so a run repeats none early."""
    types = [only_type] * count if only_type else [TYPES[index % len(TYPES)] for index in range(count)]
    random.shuffle(types)
    queues: dict[str, list[str]] = {challenge_type: [] for challenge_type in TYPES}
    briefs = []
    for challenge_type in types:
        if not queues[challenge_type]:
            queues[challenge_type] = random.sample(FOCUSES[challenge_type], len(FOCUSES[challenge_type]))
        briefs.append((challenge_type, queues[challenge_type].pop()))
    return briefs


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--count", type=int, default=1, help="Number of challenges to generate (default: 1)")
    p.add_argument("--type", choices=TYPES, help="Generate only this type (default: half PHYSICAL, half MENTAL)")
    p.add_argument("--model", help="Model passed to `claude --model` (default: Claude Code's own default)")
    p.add_argument("--dry-run", action="store_true", help="Print the prompts and the next ID, then exit")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    system_prompt = PROMPT_FILE.read_text(encoding="utf-8")
    briefs = plan_briefs(args.count, args.type)

    if args.dry_run:
        print(f"--- next ID: {next_id():03d} ---\n--- system prompt ---\n{system_prompt}")
        for challenge_type, focus in briefs:
            print(f"--- user prompt ---\n{build_user_prompt(challenge_type, focus)}")
        return

    written, failed = [], 0
    for index, (challenge_type, focus) in enumerate(briefs, start=1):
        print(f"[{index}/{args.count}] {challenge_type} / {focus.split(':')[0]}...", flush=True)
        try:
            challenge = ask_with_retries(system_prompt, challenge_type, focus, args.model)
            number = next_id()
            path = write_challenge(number, challenge)
        except RuntimeError as error:
            failed += 1
            print(f"  FAILED: {error}", file=sys.stderr)
            continue
        log_why(number, challenge_type, focus, challenge["why"])
        written.append(number)
        first_line = challenge["en"].splitlines()[0]
        print(f"  {path.name} [{challenge['type']}, {challenge['timeLimit']}] {first_line}")

    print(f"Done: {len(written)} written, {failed} failed.")
    if written:
        print(f"Review the new files and {LOG_FILE.relative_to(ROOT_DIR)}.")
        print("Run `npm run generate:challenge-bank` after review.")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
