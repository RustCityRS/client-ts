# RuneScape 530 TypeScript client

This branch ports the revision 530 SD and HD clients to TypeScript for Rust City Majula. The browser entry point is `src/Client.ts`. It fetches the cache and world list from the engine and uses the 530 login and game protocols. The port is in progress.

## Run with Majula

```sh
bun install --frozen-lockfile
bun run build:majula /path/to/rs-majula
```

This builds the client in live mode and copies `out/client.js` into Majula’s `public/530/`. The bundle includes the PCM audio worklet. Start or restart the revision 530 world to load the bundle. Open its HTTP port, for example `http://localhost:8080/` on node 10. The world serves the page and script and accepts the game WebSocket on that port.

For a standalone build, run `bun run build`. The diagnostic source map is in `out/client.js.map`. The gzip inflater and BZip2 output-stage WebAssembly modules are embedded in `client.js`. Their source build scripts and pinned upstream hashes are in [3rdparty/js5-zlib](3rdparty/js5-zlib) and [3rdparty/js5-bzip](3rdparty/js5-bzip).

The browser supports HD WebGPU, SD WebGPU and SD CPU drawing. The shared WGSL modules are in [src/gl/driver/shaders](src/gl/driver/shaders).

On a touchscreen, tap for a left click or hold for half a second and release for a right click. Swipe the game world to turn the camera, or drag items in the inventory. Tap a login or chat field to type. The client uses the device keyboard in a window and a draggable on-screen keyboard in fullscreen. To choose one for both modes, set `localStorage.mobileKeyboardMode` to `'native'` or `'canvas'`. Delete the setting to restore automatic selection.

To stress-test HD, log in and type `::stress on` in chat. This unlocks rendering, selects 4× AA and high-detail graphics, and extends visibility across the loaded 104×104-tile scene. During a camera turn the GPU draws additional views between game ticks, estimating camera motion up to 20 ms ahead. Actors, culling, picking and interface updates follow the original 50 Hz clock. `Fps` counts submitted frames and `Game draws/s` counts fresh game draws. Monitor refresh limits how many frames you see. Type `::stress off` to restore your graphics settings and the stock 28-tile radius.

## Source checks

```sh
bunx tsc --noEmit
bunx eslint . --max-warnings 0
bunx prettier --check src
```

> [!NOTE]
> Learn about our history and ethos on our forum: https://lostcity.rs/t/faq-what-is-lost-city/16

## License

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT). See the [license](LICENSE.md) file for details.
