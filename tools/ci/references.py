"""Prepare the revision 530 test inputs and export their paths for GitHub Actions."""

import argparse
import hashlib
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys
from tempfile import TemporaryDirectory
import time
from urllib.error import URLError
from urllib.request import urlopen
from zipfile import ZipFile


ARCHIVE = "https://archive.openrs2.org"
SD = (31194, "3d0ea4ddb99319482356ce2b0f38ba6dc82cd351a8ba193d2c306a4c1e0fe4bd")
CACHE = ("/caches/runescape/254/disk.zip", "36ecf2fd0f4919837f03c5a294977a2943caae8cab35dba879a76269d28f2b76")
KEYS = ("/caches/runescape/254/keys.json", "43aef9b4421d5bc7688684d496e59b798377856f46fdf266b9aac86e71305f75")
LOADER = (31269, "5330f8025d5085d52b883a9dbe1025531b7b4a7629ecbfcd6766b56aa2980afb")
# The signed loader's dependency list is at https://archive.openrs2.org/clients/31269.
PACKS = {
    "runescape_gl": (
        31311,
        "d437f5a462d54f4fe40ce89c84e42ba0864c6babb2551e2d7050315af51c93d5",
        "38df9ba79fdaad00380006c2b98a272d0cc1c55399d201a268a500fbe5df4398",
    ),
    "jogl": (
        32908,
        "521cfc96fb83dc79e237f9ef41228882f7b4a7174dfa35e7aabe2ece97f741ba",
        "af1cf9a3bfc9b4ff7c3262653fda868e068b694cd3fd38849bbf04ad3c3dc79b",
    ),
}
NATIVES = {
    "win32": {
        "jogl.dll": (32890, "1dd5568e38939ad3a2134f2eff16563eec76f3ef02cf5c7b6e7ef0dd9f3404e6"),
        "jogl_awt.dll": (32891, "7739a05fb5cadf442a8458af57c88e6c8bfe3185c61aa40bc362973394cf8ea4"),
    },
    "linux": {
        "libgluegen-rt.so": (31645, "069ffbb37d1060718d3f3308d6c62b441ca76d8c587786c72cc3f9c2b6a6ade5"),
        "libjogl.so": (31647, "39e6e7c880bb24445bd8f51567c300eae921cac1806fc293fe1b38c31af46b87"),
        "libjogl_awt.so": (31646, "f9e8ec18243925b8765d4bf95e432f87be0a2e3081bcaa1f2d10ebcd57df484d"),
    },
}


def digest(path):
    with path.open("rb") as file:
        return hashlib.file_digest(file, "sha256").hexdigest()


def fetch(path, resource, expected, scratch):
    if path.is_file() and digest(path) == expected:
        return path
    route = f"/clients/{resource}.dat" if isinstance(resource, int) else resource
    url = ARCHIVE + route
    partial = scratch / path.name
    for attempt in range(3):
        try:
            with urlopen(url, timeout=90) as response, partial.open("wb") as output:
                shutil.copyfileobj(response, output)
            if digest(partial) != expected:
                raise ValueError(f"SHA-256 mismatch for {url}")
            break
        except (URLError, TimeoutError, ConnectionError):
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)
    partial.replace(path)
    return path


def hd_references(root, scratch, jdk8):
    if sys.platform not in NATIVES or platform.machine().lower() not in {"amd64", "x86_64"}:
        raise ValueError("The native 530 CI fixtures require Windows or Linux x64")
    hd = root / "hd"
    hd.mkdir(exist_ok=True)
    native_dir = hd / "natives" / ("windows-amd64" if sys.platform == "win32" else "linux-amd64")
    native_dir.mkdir(parents=True, exist_ok=True)
    for name, resource in NATIVES[sys.platform].items():
        fetch(native_dir / name, *resource, scratch)
    loader = fetch(hd / "loader_gl.jar", *LOADER, scratch)
    for name, (resource, pack_hash, jar_hash) in PACKS.items():
        jar = hd / (name + ".jar")
        if jar.is_file() and digest(jar) == jar_hash:
            continue
        packed = fetch(hd / (name + ".pack200"), resource, pack_hash, scratch)
        if not jdk8:
            raise ValueError("Set JAVA_HOME_8_X64 or pass --jdk8 to unpack the archived HD JARs")
        bin_dir = Path(jdk8) / "bin"
        suffix = ".exe" if os.name == "nt" else ""
        if not (scratch / "UnpackGamepack.class").is_file():
            subprocess.run([bin_dir / ("javac" + suffix), "-d", scratch, Path(__file__).with_name("UnpackGamepack.java")], check=True)
        result = scratch / jar.name
        subprocess.run([bin_dir / ("java" + suffix), "-Duser.timezone=UTC", "-cp", scratch, "UnpackGamepack", packed, result], check=True)
        if digest(result) != jar_hash:
            raise ValueError(f"Reconstructed {jar.name} has an unexpected SHA-256")
        result.replace(jar)
    return {
        "GAMEPACK_HD_530": hd / "runescape_gl.jar", "JOGL_530": hd / "jogl.jar",
        "LOADER_HD_530": loader, "JOGL_NATIVES_530": native_dir,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path, help="download and extraction directory")
    parser.add_argument("--full", action="store_true", help="also prepare the HD gamepack, loader, JOGL and platform natives")
    parser.add_argument("--jdk8", default=os.environ.get("JAVA_HOME_8_X64"), help="JDK 8 installation for the archived Pack200 format")
    args = parser.parse_args()
    root = args.directory.resolve()
    root.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(prefix=".prepare-", dir=root) as stage:
        scratch = Path(stage)
        jar = fetch(root / "client.jar", *SD, scratch)
        disk = fetch(root / "disk.zip", *CACHE, scratch)
        keys = fetch(root / "keys.json", *KEYS, scratch)
        cache = root / "cache"
        cache.mkdir(exist_ok=True)
        with ZipFile(disk) as archive:
            for suffix in ["dat2", "idx255", *(f"idx{i}" for i in range(28))]:
                name = "main_file_cache." + suffix
                partial = scratch / name
                with archive.open("cache/" + name) as source, partial.open("wb") as output:
                    shutil.copyfileobj(source, output)
                partial.replace(cache / name)
        paths = {"GAMEPACK_530": jar, "CACHE_530": cache, "RS530_CACHE_ZIP": disk, "XTEA_530": keys}
        if args.full:
            paths.update(hd_references(root, scratch, args.jdk8))
    values = "".join(f"{name}={value}\n" for name, value in paths.items())
    if "GITHUB_ENV" in os.environ:
        with open(os.environ["GITHUB_ENV"], "a", encoding="utf-8") as env:
            env.write(values)
    print(values, end="")


if __name__ == "__main__":
    main()
