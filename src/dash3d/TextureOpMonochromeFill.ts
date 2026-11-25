import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type PacketT from '#/io/PacketT';
import ArrayUtils from '#/util/ArrayUtils';
import { requireNonNull } from '#/util/JavaArray';
import TextureOp from './TextureOp';
import { loadClient, loadMinimenu, loadSpriteLoader, loadWorldMap } from '#/util/GamepackClasses';

// ri
export default class TextureOpMonochromeFill extends TextureOp {
    // HD mi.h(I)V
    static releaseTextureOpMonochromeFillStatics(guard: number): void {
        try {
            const Client = loadClient();
            releaseReferences(Client, 'players');
            if (guard !== -2) {
                const WorldMap = loadWorldMap();
                releaseReferences(WorldMap, 'comma');
            }
            const WorldMap = loadWorldMap();
            releaseReferences(WorldMap, 'comma');
            const SpriteLoader = loadSpriteLoader();
            releaseReferences(SpriteLoader, 'hasAlpha');
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD mb stays deferred until mi.h(I)V in TextureOpMonochromeFill.releaseTextureOpMonochromeFillStatics.
            const PixfontGeneric = (require('#/graphics/PixfontGeneric') as typeof import('#/graphics/PixfontGeneric')).default;
            releaseReferences(PixfontGeneric, 'nameIcons');
            const Minimenu = loadMinimenu();
            releaseReferences(Minimenu, 'keys');
            releaseReferences(Client, 'groundObj');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'mi.C(' + guard + ')');
        }
    }

    // ri.O:I
    private value: number;

    // ri.<init>()V delegates to ri.<init>(I)V.
    constructor();
    constructor(value = 4096) {
        super(0, true);
        this.value = value;
    }

    // ri.a(Lgd;ZI)V
    override decode(packet: PacketT | null, code: number): void {
        if (code === 0) this.value = ((requireNonNull(packet).g1() << 12) / 255) | 0;
    }

    // ri.a(IB)[I
    override getMonochromeOutput(row: number): Int32Array | null {
        const pixels = requireNonNull(this.monochromeImageCache).get(row);
        if (requireNonNull(this.monochromeImageCache).invalid) {
            ArrayUtils.fillInts(pixels, 0, TextureOp.width, this.value);
        }
        return pixels;
    }
}
