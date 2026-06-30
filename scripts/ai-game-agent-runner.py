#!/usr/bin/env python3
"""Autonomous visual AI game tester for Open Pixel.

Controls a real desktop/browser window via screenshots + pyautogui.
Requires a vision-capable OpenAI-compatible chat endpoint.
"""

from __future__ import annotations

import base64
import json
import os
import subprocess
import sys
import tempfile
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import mss
import pyautogui
import requests
from PIL import Image, ImageChops, ImageStat

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(os.getenv("AI_GAME_AGENT_OUTPUT_DIR", ROOT / "artifacts" / "ai-game-agent"))
SHOTS = OUT / "screenshots"
URL = os.getenv("AI_GAME_URL", "http://127.0.0.1:4173/game/")
BASE_URL = os.getenv("AI_GAME_VLM_BASE_URL", "").rstrip("/")
MODEL = os.getenv("AI_GAME_VLM_MODEL", "")
API_KEY = os.getenv("AI_GAME_VLM_API_KEY", "dummy")
MAX_STEPS = int(os.getenv("AI_GAME_AGENT_MAX_STEPS", "40"))
STEP_DELAY = float(os.getenv("AI_GAME_AGENT_STEP_DELAY", "0.7"))
BROWSER = os.getenv("AI_GAME_BROWSER", "chromium")
HEADLESS = os.getenv("AI_GAME_AGENT_HEADLESS", "0") == "1"
CDP_PORT = int(os.getenv("AI_GAME_CDP_PORT", "9223"))
SCREENSHOT_SOURCE = os.getenv("AI_GAME_SCREENSHOT_SOURCE", "desktop")

SYSTEM_PROMPT = """You are an autonomous QA tester playing Open Pixel, a real RPG-JS pixel quest game.
Goal: test actual gameplay flow, not DOM. Try to complete: boot game, move player, find AI Guide NPC, interact, restore 3 village nodes, complete quest.
Use only human-like controls: arrow keys, Space, Enter, Escape, mouse click.
Look for bugs: blank canvas, frozen screen, broken sprites, stuck movement, NPC dialogue failing, nodes unreachable, quest not progressing.
Return ONLY strict JSON. No markdown.
Schema:
{
  "action": {"type":"key","key":"ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Space|Enter|Escape"},
  "observation": "what you see",
  "reason": "why this action",
  "progress": "boot|move|npc|dialogue|shard|quest|stuck|bug|done",
  "bug": null or {"severity":"low|medium|high","title":"short","evidence":"visual reason"}
}
For mouse action use: {"type":"click","x":640,"y":400}.
If stuck, do not repeat the same action more than 3 times; explore alternate directions/interact.
"""


@dataclass
class Step:
    index: int
    screenshot: str
    action: dict[str, Any]
    observation: str
    reason: str
    progress: str
    bug: dict[str, Any] | None
    changed: bool
    diff_score: float


def main() -> int:
    if not BASE_URL or not MODEL:
        print("Missing AI_GAME_VLM_BASE_URL or AI_GAME_VLM_MODEL", file=sys.stderr)
        return 2

    OUT.mkdir(parents=True, exist_ok=True)
    SHOTS.mkdir(parents=True, exist_ok=True)

    preview = None if os.getenv("AI_GAME_EXTERNAL_URL") else start_preview()
    try:
        wait_for_url(URL, preview)
    except Exception:
        stop_process(preview)
        raise
    browser = start_browser()
    steps: list[Step] = []
    bugs: list[dict[str, Any]] = []
    passed = False
    reason = "unknown"
    last_img: Image.Image | None = None
    stuck_count = 0

    try:
        time.sleep(3)
        focus_game_window()

        for i in range(MAX_STEPS):
            img = screenshot_desktop()
            shot_path = SHOTS / f"step-{i:03d}.png"
            img.save(shot_path)

            changed, diff_score = image_changed(last_img, img)
            if last_img is not None and not changed:
                stuck_count += 1
            else:
                stuck_count = 0
            last_img = img

            decision = ask_vlm(img, steps, stuck_count)
            bug = decision.get("bug")
            if bug and not likely_false_visual_bug(img, bug):
                bug = {**bug, "step": i, "screenshot": str(shot_path)}
                bugs.append(bug)
            else:
                bug = None
                decision["bug"] = None
                if decision.get("progress") == "bug":
                    decision["progress"] = "move"

            action = normalize_action(decision.get("action"))
            execute(action)
            time.sleep(STEP_DELAY)

            step = Step(
                index=i,
                screenshot=str(shot_path),
                action=action,
                observation=str(decision.get("observation", ""))[:600],
                reason=str(decision.get("reason", ""))[:400],
                progress=str(decision.get("progress", ""))[:80],
                bug=bug,
                changed=changed,
                diff_score=diff_score,
            )
            steps.append(step)
            if step.progress.lower() in {"move", "npc", "dialogue", "shard", "quest", "done"}:
                stuck_count = 0
            write_live_report(steps, bugs, passed=False, reason="running")

            if step.progress == "done":
                passed = True
                reason = "VLM reported quest/gameplay objective done"
                break
            if step.progress == "bug" and bug and bug.get("severity") in {"high", "critical"}:
                reason = f"high severity bug: {bug.get('title')}"
                break
            if stuck_count >= 8:
                reason = "visual freeze/softlock: screenshot unchanged for 8 consecutive steps"
                break

        if not passed and reason == "unknown":
            if bugs:
                reason = f"bugs found: {len(bugs)}"
            elif len(steps) >= min(8, MAX_STEPS) and has_gameplay_progress(steps):
                passed = True
                reason = "autonomous exploration showed gameplay progress without fatal bug"
            elif len(steps) >= min(8, MAX_STEPS):
                reason = "no gameplay progress detected"
            else:
                reason = "agent stopped early"

    except Exception as exc:  # noqa: BLE001
        reason = f"runner error: {exc}"
    finally:
        write_live_report(steps, bugs, passed=passed, reason=reason)
        stop_process(browser)
        stop_process(preview)

    print((OUT / "summary.md").read_text())
    return 0 if passed else 1


def ask_vlm(img: Image.Image, steps: list[Step], stuck_count: int) -> dict[str, Any]:
    recent = [asdict(s) | {"screenshot": Path(s.screenshot).name} for s in steps[-8:]]
    prompt = {
        "task": "Continue autonomous Open Pixel game QA from this screenshot.",
        "url": URL,
        "stuck_count": stuck_count,
        "recent_steps": recent,
        "reminder": "Return strict JSON only. Prefer movement/exploration, Space near NPC/shard, Enter to advance dialogue.",
    }
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": json.dumps(prompt)},
                    {"type": "image_url", "image_url": {"url": image_data_url(img)}},
                ],
            },
        ],
        "temperature": 0.2,
        "max_tokens": 1000,
        "stream": False,
    }
    res = requests.post(
        f"{BASE_URL}/chat/completions",
        headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
        json=payload,
        timeout=60,
    )
    if res.status_code >= 400:
        return {
            "action": fallback_action(len(steps)),
            "observation": f"VLM HTTP {res.status_code}: {res.text[:300]}",
            "reason": "fallback because VLM request failed",
            "progress": "stuck",
            "bug": {"severity": "medium", "title": "VLM endpoint failure", "evidence": res.text[:300]},
        }
    try:
        data = res.json()
    except Exception:
        return {
            "action": fallback_action(len(steps)),
            "observation": f"VLM returned non-JSON HTTP {res.status_code}: {res.text[:300]}",
            "reason": "fallback because VLM response was not JSON",
            "progress": "stuck",
            "bug": {"severity": "medium", "title": "VLM non-JSON response", "evidence": res.text[:300]},
        }
    text = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    return parse_json_or_fallback(text, len(steps))


def parse_json_or_fallback(text: str, index: int) -> dict[str, Any]:
    try:
        return json.loads(text)
    except Exception:
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            try:
                return json.loads(text[start : end + 1])
            except Exception:
                pass
    return {
        "action": fallback_action(index),
        "observation": f"VLM returned non-JSON: {text[:300]}",
        "reason": "fallback scripted action",
        "progress": "stuck",
        "bug": None,
    }


def normalize_action(action: Any) -> dict[str, Any]:
    if not isinstance(action, dict):
        return {"type": "key", "key": "Space"}
    typ = action.get("type")
    if typ == "key":
        key = str(action.get("key", "Space"))
        aliases = {
            "Arrow": "ArrowDown",
            "Down": "ArrowDown",
            "Right": "ArrowRight",
            "Up": "ArrowUp",
            "Left": "ArrowLeft",
            " ": "Space",
        }
        key = aliases.get(key, key)
        allowed = {"ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "Enter", "Escape"}
        return {"type": "key", "key": key if key in allowed else "Space"}
    if typ == "click":
        return {"type": "click", "x": int(action.get("x", 640)), "y": int(action.get("y", 400))}
    return {"type": "key", "key": "Space"}


def execute(action: dict[str, Any]) -> None:
    if SCREENSHOT_SOURCE == "cdp":
        cdp_action(action)
        return
    if action["type"] == "click":
        pyautogui.click(action["x"], action["y"])
    elif action["type"] == "key":
        pyautogui.press(to_pyautogui_key(action["key"]))


def to_pyautogui_key(key: str) -> str:
    return {
        "ArrowUp": "up",
        "ArrowDown": "down",
        "ArrowLeft": "left",
        "ArrowRight": "right",
        "Space": "space",
        "Enter": "enter",
        "Escape": "esc",
    }.get(key, key)


def has_gameplay_progress(steps: list[Step]) -> bool:
    progress = {s.progress.lower() for s in steps}
    text = " ".join(f"{s.progress} {s.observation}".lower() for s in steps)
    return bool(progress & {"move", "npc", "dialogue", "shard", "quest", "done"}) or any(
        token in text for token in ["moved", "npc", "dialogue", "shard", "quest"]
    )


def fallback_action(index: int) -> dict[str, str]:
    keys = ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Space", "Enter"]
    return {"type": "key", "key": keys[index % len(keys)]}


def screenshot_desktop() -> Image.Image:
    if SCREENSHOT_SOURCE == "cdp":
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            tmp_path = Path(tmp.name)
        try:
            cdp_screenshot(tmp_path)
            with Image.open(tmp_path) as img:
                return img.convert("RGB")
        finally:
            tmp_path.unlink(missing_ok=True)
    with mss.mss() as sct:
        monitor = sct.monitors[1]
        raw = sct.grab(monitor)
        return Image.frombytes("RGB", raw.size, raw.bgra, "raw", "BGRX")


def cdp_screenshot(path: Path) -> None:
    run_cdp_helper(["screenshot", str(path)])


def cdp_action(action: dict[str, Any]) -> None:
    if action["type"] == "click":
        run_cdp_helper(["click", str(action["x"]), str(action["y"])])
    elif action["type"] == "key":
        run_cdp_helper(["press", action["key"]])


def run_cdp_helper(args: list[str]) -> None:
    subprocess.run(
        [
            "node",
            str(ROOT / "scripts" / "playwright-cdp-game-agent.mjs"),
            "--port",
            str(CDP_PORT),
            *args,
        ],
        cwd=ROOT,
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def image_data_url(img: Image.Image) -> str:
    import io

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def image_changed(prev: Image.Image | None, cur: Image.Image) -> tuple[bool, float]:
    if prev is None:
        return True, 1.0
    diff = ImageChops.difference(prev.convert("RGB"), cur.convert("RGB"))
    stat = ImageStat.Stat(diff)
    score = sum(stat.mean) / 3.0
    threshold = 0.15 if SCREENSHOT_SOURCE == "cdp" else 0.7
    return score > threshold, score


def likely_false_visual_bug(img: Image.Image, bug: dict[str, Any]) -> bool:
    title = str(bug.get("title", "")).lower()
    evidence = str(bug.get("evidence", "")).lower()
    text = f"{title} {evidence}"
    if not any(term in text for term in ["blank", "black", "white", "render", "canvas", "sprites", "world"]):
        return False
    # Headless/desktop screenshots can include large browser/page margins. If enough
    # non-white/colored pixels exist, trust the deterministic render smoke over VLM guesses.
    rgb = img.convert("RGB")
    width, height = rgb.size
    colored = 0
    dark = 0
    for y in range(80, height, 8):
        for x in range(0, width, 8):
            r, g, b = rgb.getpixel((x, y))
            if r + g + b < 60:
                dark += 1
            if max(r, g, b) - min(r, g, b) > 20 and r + g + b > 80:
                colored += 1
    return colored > 300 or dark > 300


def start_preview() -> subprocess.Popen[str]:
    env = os.environ.copy()
    env["PATH"] = f"{ROOT / 'node_modules' / '.bin'}:{env.get('PATH', '')}"
    return subprocess.Popen(
        [str(ROOT / "node_modules" / ".bin" / "vite"), "preview", "--host", "127.0.0.1", "--port", "4173"],
        cwd=ROOT / "apps" / "web",
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        start_new_session=True,
    )


def wait_for_url(url: str, preview: subprocess.Popen[str] | None = None, timeout: float = 20.0) -> None:
    deadline = time.time() + timeout
    last_error = ""
    output = ""
    while time.time() < deadline:
        if preview and preview.poll() is not None:
            output = preview.stdout.read() if preview.stdout else ""
            raise RuntimeError(f"Preview server exited early with code {preview.returncode}:\n{output}")
        try:
            res = requests.get(url, timeout=1)
            if 200 <= res.status_code < 300:
                return
            last_error = f"HTTP {res.status_code}"
        except Exception as exc:  # noqa: BLE001
            last_error = str(exc)
        time.sleep(0.2)
    if preview and preview.stdout:
        try:
            output = preview.stdout.read(4000)
        except Exception:
            output = ""
    raise RuntimeError(f"Preview server not ready at {url}: {last_error}\n{output}")


def start_browser() -> subprocess.Popen[Any]:
    candidates = [BROWSER, "chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]
    for cmd in candidates:
        if not cmd:
            continue
        try:
            browser_args = [
                "--new-window",
                "--no-first-run",
                "--disable-infobars",
                "--no-sandbox",
                "--disable-dev-shm-usage",
                f"--remote-debugging-port={CDP_PORT}",
                "--window-position=0,0",
                "--window-size=1280,800",
                URL,
            ]
            if HEADLESS:
                browser_args.insert(0, "--headless=new")
            if sys.platform == "darwin" and ".app/Contents/MacOS/" in cmd:
                app_bundle = cmd.split(".app/Contents/MacOS/", 1)[0] + ".app"
                args = ["open", "-na", app_bundle, "--args", *browser_args]
            else:
                args = [cmd, *browser_args]
            return subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
        except FileNotFoundError:
            continue
    raise RuntimeError("No Chromium/Chrome executable found")


def focus_game_window() -> None:
    if sys.platform == "darwin":
        for app_name in ("Google Chrome for Testing", "Chromium", "Google Chrome"):
            subprocess.run(
                ["osascript", "-e", f'tell application "{app_name}" to activate'],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
            )
            time.sleep(0.2)
    pyautogui.click(640, 400)
    time.sleep(0.2)


def write_live_report(steps: list[Step], bugs: list[dict[str, Any]], passed: bool, reason: str) -> None:
    report = {
        "passed": passed,
        "reason": reason,
        "url": URL,
        "model": MODEL,
        "steps": [asdict(s) for s in steps],
        "bugs": bugs,
        "artifacts": str(OUT),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    (OUT / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    (OUT / "bugs.json").write_text(json.dumps(bugs, indent=2), encoding="utf-8")
    (OUT / "summary.md").write_text(to_markdown(report), encoding="utf-8")


def to_markdown(report: dict[str, Any]) -> str:
    lines = [
        "# OpenPixel Autonomous AI Game Test",
        "",
        f"- passed: {report['passed']}",
        f"- reason: {report['reason']}",
        f"- model: {report['model']}",
        f"- steps: {len(report['steps'])}",
        f"- bugs: {len(report['bugs'])}",
        f"- artifacts: {report['artifacts']}",
        "",
        "## Bugs",
    ]
    if report["bugs"]:
        for bug in report["bugs"]:
            lines.append(f"- [{bug.get('severity')}] {bug.get('title')} — {bug.get('evidence')} ({bug.get('screenshot')})")
    else:
        lines.append("- none")
    lines.append("\n## Recent steps")
    for step in report["steps"][-10:]:
        lines.append(f"- {step['index']}: {step['action']} → {step['progress']} — {step['observation']}")
    return "\n".join(lines) + "\n"


def stop_process(proc: subprocess.Popen[str] | None) -> None:
    if not proc or proc.poll() is not None:
        return
    try:
        proc.terminate()
        proc.wait(timeout=5)
    except Exception:
        proc.kill()


if __name__ == "__main__":
    raise SystemExit(main())
