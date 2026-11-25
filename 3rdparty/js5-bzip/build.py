"""Build the 530 output-stage accelerator from the original libbzip2 release."""
import argparse
import hashlib
from pathlib import Path
import subprocess
import tarfile
from urllib.request import urlopen

here = Path(__file__).resolve().parent
root = here.parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--zig', default='zig', help='path to Zig 0.13.0')
args = parser.parse_args()
if subprocess.check_output([args.zig, 'version'], text=True).strip() != '0.13.0':
    raise SystemExit('Use Zig 0.13.0 to reproduce js5-bzip.wasm.')
build = root / 'out' / 'js5-bzip'
build.mkdir(parents=True, exist_ok=True)
archive = build / 'bzip2-1.0.8.tar.gz'
if not archive.exists():
    with urlopen('https://sourceware.org/pub/bzip2/' + archive.name) as response:
        archive.write_bytes(response.read())
if hashlib.sha256(archive.read_bytes()).hexdigest() != 'ab5a03176ee106d3f0fa90e381da478ddae405918153cca248e682cd0c4a2269':
    raise SystemExit('bzip2 source SHA-256 mismatch')
with tarfile.open(archive) as tar:
    tar.extractall(build, filter='data')
src = build / 'bzip2-1.0.8'
output = root / 'src' / '3rdparty' / 'js5-bzip' / 'js5-bzip.wasm'
output.parent.mkdir(parents=True, exist_ok=True)
obj = build / 'output.o'
subprocess.run([args.zig, 'cc', '-target', 'wasm32-wasi', '-O3', '-flto', '-fno-ident', '-DBZ_NO_STDIO',
                '-I', str(src), '-c', str(here / 'output.c'), '-o', str(obj)], check=True)
subprocess.run([
    args.zig, 'cc', '-target', 'wasm32-freestanding', '-O3', '-flto', '-nostdlib',
    '-Wl,--no-entry', '-Wl,--strip-all', '-Wl,-z,stack-size=8192',
    '-Wl,--export-memory', '-Wl,--export=staging', '-Wl,--export=output_state', '-Wl,--export=write_output',
    str(obj), '-o', str(output)
], check=True)
print(output.name, output.stat().st_size, hashlib.sha256(output.read_bytes()).hexdigest())
