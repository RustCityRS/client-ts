"""Build the browser's raw inflater from the zlib version in the JDK 21.0.7 oracle."""
import argparse
import hashlib
from pathlib import Path
import subprocess
import tarfile
from tempfile import TemporaryDirectory
from urllib.request import urlopen

here = Path(__file__).resolve().parent
root = here.parents[1]
version = '1.3.1'
digest = '9a93b2b7dfdac77ceba5a558a580e74667dd6fede4585b91eefb60f03b72df23'
parser = argparse.ArgumentParser()
parser.add_argument('--zig', default='zig', help='path to Zig 0.13.0')
args = parser.parse_args()
if subprocess.check_output([args.zig, 'version'], text=True).strip() != '0.13.0':
    raise SystemExit('Use Zig 0.13.0 to reproduce js5-inflate.wasm.')
build = root / 'out' / 'js5-zlib'
build.mkdir(parents=True, exist_ok=True)
archive = build / ('zlib-' + version + '.tar.gz')
source = build / ('zlib-' + version)
if not archive.exists():
    with urlopen('https://zlib.net/fossils/' + archive.name) as response:
        archive.write_bytes(response.read())
if hashlib.sha256(archive.read_bytes()).hexdigest() != digest:
    raise SystemExit('zlib source SHA-256 mismatch')
with tarfile.open(archive) as tar:
    tar.extractall(build, filter='data')
output = root / 'src' / '3rdparty' / 'js5-zlib' / 'js5-inflate.wasm'
output.parent.mkdir(parents=True, exist_ok=True)
with TemporaryDirectory(dir=build) as temp:
    binary = Path(temp) / output.name
    subprocess.run([
        args.zig, 'cc', '-target', 'wasm32-freestanding', '-O3', '-nostdlib', '-DZ_SOLO', '-DNO_GZIP',
        '-DZLIB_CONST', '-fno-ident', '-Wl,--no-entry', '-Wl,--strip-all', '-Wl,-z,stack-size=16384',
        *['-Wl,--export=' + symbol for symbol in ('init', 'staging', 'inflate_raw', 'written', 'reset')],
        '-Wl,--export-memory', '-I', str(source), str(here / 'inflater.c'),
        *[str(source / name) for name in ('inflate.c', 'inftrees.c', 'inffast.c', 'adler32.c', 'zutil.c')],
        '-o', str(binary)
    ], check=True)
    binary.replace(output)
print(output.name, output.stat().st_size, hashlib.sha256(output.read_bytes()).hexdigest())
