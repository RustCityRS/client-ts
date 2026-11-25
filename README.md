# RuneScape 530 TypeScript client

This branch ports the revision 530 SD and HD clients to TypeScript for Rust City Majula. The browser entry point is `src/Client.ts`. It fetches the cache and world list from the engine and uses the 530 login and game protocols.

## Run with Majula

```sh
bun install --frozen-lockfile
bun run build:majula /path/to/rs-majula
```

## HD stress mode

Type `::stress on` in chat to select the 104-tile benchmark preset. The overlay's `Game draws/s` counts full scene redraws on the original 50 Hz game loop. `Fps` also counts presentations that reuse the latest scene between ticks. To check camera smoothness, hold a turn through a full revolution and measure the displayed frame intervals in a browser performance trace.

## Source checks

```sh
bunx tsc --noEmit
bunx eslint src bundle.ts bundleProperties.ts identifier.js eslint.config.ts --max-warnings 0
bunx prettier --check src
```

## Client tests

The suite compares the TypeScript client with the stock 530 gamepacks and cache. CI uses Bun 1.2.14, Node 24, Python 3.12 and JDK 21. On Windows, use Temurin `21.0.7+6` for `java` and `javac` to match the AWT glyph pixels captured for the client. The reference helper uses JDK 8 to unpack the archived HD gamepack on Windows or Linux x64. The full local suite requires Windows x64, Chrome, and a GPU with WebGPU and native OpenGL 2× and 4× multisampling.

Prepare the reference inputs once from Bash.

```sh
bun install --frozen-lockfile
mkdir -p out
python tools/ci/references.py out/references --full --jdk8 "/path/to/jdk8" > out/test.env
```

Run the CPU and GPU tests in separate processes per file to isolate the original client's static state. The last command runs just the HD model animation oracle.

```sh
bun --env-file=out/test.env run test:cpu
bun --env-file=out/test.env run test:gpu
bun --env-file=out/test.env test ./test/hd/gl-model-animation.test.ts
```

### GitHub Actions

Pushes and pull requests targeting `530` trigger the production build, source checks, six Windows CPU test shards, and the portable WebGPU tests on Ubuntu with Chrome’s SwiftShader. Each shard uploads its JUnit reports. CI downloads and verifies the original gamepacks and cache from OpenRS2.

For native GPU coverage, set the repository Actions variable `RS530_WINDOWS_GPU_RUNNER` to the label of a Windows x64 GPU runner with Chrome, Git Bash and a working graphics driver. On pushes to `530`, that runner executes the Windows pixel comparisons and the Chrome hardware and fallback checks. Without that variable, the build summary flags the missing coverage. Manual runs require the variable and become available when the workflow also exists on the default branch. [GitHub manual run requirements](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow)

## License

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT). See the [license](LICENSE.md) file for details.
