# RuneScape 530 TypeScript client

This branch ports the revision 530 SD and HD clients to TypeScript for Rust City Majula. The browser entry point is `src/Client.ts`. It fetches the cache and world list from the engine and uses the 530 login and game protocols.

## Run with Majula

```sh
bun install --frozen-lockfile
bun run build:majula /path/to/rs-majula
```

## Source checks

```sh
bunx tsc --noEmit
bunx eslint . --max-warnings 0
bunx prettier --check src
```

## License

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT). See the [license](LICENSE.md) file for details.
