"""Run an exhaustive shard of the Bun suite, isolating the game's static state per file."""

import argparse
import os
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
TEST_DIR = ROOT / "test"
TEST_NAME = re.compile(r"[._](?:test|spec)\.(?:[cm]?[jt]s|[jt]sx)$")

# These require the original Windows JOGL driver or Windows AWT glyph pixels.
# CI runs the other WebGPU tests against the SwiftShader Vulkan driver.
WINDOWS_GPU_TESTS = {
    "hd/antialias.test.ts",
    "hd/driver-title-terrain.test.ts",
    "hd/driver-water.test.ts",
    "hd/gl-readback.test.ts",
    "hd/world-map-viewport.test.ts",
}

GPU_TESTS = WINDOWS_GPU_TESTS | {
    "hd/driver-gpu.test.ts",
    "hd/driver-parity.test.ts",
    "hd/driver-title-2d.test.ts",
    "hd/east-market-scene.test.ts",
    "hd/h1-init.test.ts",
    "hd/repaint-flames.test.ts",
    "render/sd-browser-display.test.ts",
    "render/sd-canvas-presenter.test.ts",
    "render/sd-gouraud-faults.test.ts",
    "render/sd-gouraud-projection.test.ts",
    "render/sd-gouraud-triangles.test.ts",
    "render/sd-mixed-canvas.test.ts",
    "render/sd-primitives.test.ts",
    "render/sd-root.test.ts",
    "render/sd-scans.test.ts",
    "render/sd-scene-ui.test.ts",
    "render/sd-world.test.ts",
    "title-flames.test.ts",
}


def checked_cases(report):
    suite = ET.parse(report).getroot()
    cases = suite.findall(".//testcase")
    if not cases or int(suite.attrib["tests"]) != len(cases):
        raise ValueError("missing or inconsistent JUnit test cases")
    for outcome in ("skipped", "failures", "errors"):
        count = int(suite.get(outcome, "0"))
        if count:
            raise ValueError(f"JUnit reports {count} {outcome}")
    return len(cases)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("lane", choices=("cpu", "gpu"))
    parser.add_argument(
        "--gpu-backend", choices=("all", "portable", "native"), default="all",
        help="run all GPU tests, the portable WebGPU tests, or the Windows reference tests",
    )
    parser.add_argument("--shard", type=int, default=1, help="one-based shard number")
    parser.add_argument("--shards", type=int, default=1, help="total shards in this lane")
    parser.add_argument("--list", action="store_true", help="print the assigned files without running Bun")
    parser.add_argument("--junit-dir", type=Path, default=ROOT / "out/test-results", help="JUnit output directory (default: out/test-results)")
    args = parser.parse_args()

    discovered = sorted(
        path.relative_to(TEST_DIR).as_posix()
        for path in TEST_DIR.rglob("*")
        if TEST_NAME.search(path.name) and path.is_file()
    )
    missing = GPU_TESTS.difference(discovered)
    if missing:
        parser.error("GPU test files missing from discovery: " + ", ".join(sorted(missing)))
    lane = [name for name in discovered if (name in GPU_TESTS) == (args.lane == "gpu")]
    if args.gpu_backend != "all":
        if args.lane != "gpu":
            parser.error("--gpu-backend is only available for the gpu lane")
        lane = [name for name in lane if (name in WINDOWS_GPU_TESTS) == (args.gpu_backend == "native")]
    if not 1 <= args.shard <= args.shards <= len(lane):
        parser.error(f"expected 1 <= shard <= shards <= {len(lane)} for the {args.lane} lane")
    selected = lane[args.shard - 1 :: args.shards]
    print(
        f"{args.lane} shard {args.shard}/{args.shards}: {len(selected)} of {len(lane)} files; "
        f"{len(discovered)} total Bun test files",
        flush=True,
    )
    if args.list:
        for name in selected:
            print(f"test/{name}")
        return 0

    failed = []
    passed_cases = 0
    env = os.environ.copy()
    if args.lane == "gpu":
        env["RS530_NATIVE_GL_TRACE"] = "1"
    for i, name in enumerate(selected, 1):
        print(f"[{i}/{len(selected)}] test/{name}", flush=True)
        # A few gamepack fixtures compile Java inside tests that use Bun's default
        # five-second timeout. Keep their explicit longer timeouts for corpus runs.
        report = (args.junit_dir / (name + ".xml")).resolve()
        report.parent.mkdir(parents=True, exist_ok=True)
        report.unlink(missing_ok=True)
        result = subprocess.run(
            ["bun", "test", "--timeout", "60000", "--reporter=junit", f"--reporter-outfile={report}", f"./test/{name}"],
            cwd=ROOT,
            env=env,
        )
        if result.returncode != 0:
            failed.append(f"test/{name} (exit {result.returncode})")
        else:
            try:
                passed_cases += checked_cases(report)
            except (OSError, ET.ParseError, KeyError, ValueError) as error:
                failed.append(f"test/{name} ({error})")

    print(f"{len(selected) - len(failed)} files passed ({passed_cases} cases), {len(failed)} files failed", flush=True)
    for failure in failed:
        print(failure, file=sys.stderr)
    return int(bool(failed))


if __name__ == "__main__":
    sys.exit(main())
