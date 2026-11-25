import Js5 from '#/cache/Js5.js';
import Js5Index from '#/cache/Js5Index.js';
import TextureCache from '#/dash3d/TextureCache.js';
import Crc32 from '#/io/Crc32.js';

// GameProtocolOracle.EmptyAssets: one group with one file containing a zero-entry materials table.
export function emptyTextureCache(archive: Js5 | null = null): TextureCache {
    const bytes = Buffer.from('0000000012050000010000000000000000000000010000', 'hex');
    const index = new Js5Index(bytes, Crc32.prefix(bytes, bytes.length));
    const materials = new Js5(
        {
            index: () => index,
            group: () => Uint8Array.of(0, 0, 0, 0, 2, 0, 0),
            prefetchGroup() {},
            GetGroupLoadPercentage: () => 100
        },
        false,
        false
    );
    return new TextureCache(archive, materials, archive, 4, false);
}
