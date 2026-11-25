# RuneScape 530 TypeScript client

This branch ports the revision 530 SD and HD clients to TypeScript for Rust City Majula. The browser entry point is `src/Client.ts`. It fetches the cache and world list from the engine and uses the 530 login and game protocols.

## Run with Majula

```sh
bun install --frozen-lockfile
bun run build:majula /path/to/rs-majula
```

## Enhanced HD

Type `::enhanced on` in chat while playing in HD. It enables a 48-tile view radius, animation tweening, and improved terrain texture filtering. At the edge of the view distance, fog picks up colour from the terrain and blends into the regional horizon. Open water uses revision 742’s DirectX wave normals and Lumbridge reflection texture. At the shoreline, waves lap onto low ground and recede over the 530 riverbed. Sunlight shadows soften as the caster moves away from the ground. Light sources glow in the 3D scene before the interface is drawn. Camera presentation follows the display refresh rate while game logic runs at its original rate.

Use `::enhanced off` to return to your saved HD settings. `::enhanced` toggles the mode. `::stress on` selects the separate 104-tile benchmark preset.

## Source checks

```sh
bunx tsc --noEmit
bunx eslint . --max-warnings 0
bunx prettier --check src
```

## License

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT). See the [license](LICENSE.md) file for details.
