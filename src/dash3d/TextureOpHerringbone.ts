import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type PacketT from '#/io/PacketT';
import { intDivide, intRemainder } from '#/util/IntUtils';
import { arrayAtI32, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import TextureOp from './TextureOp';
import { loadLocType, loadWorld } from '#/util/GamepackClasses';

// vi
export default class TextureOpHerringbone extends TextureOp {
    // HD f.f(B)V
    static releaseTextureOpHerringboneStatics(guard: number): void {
        try {
            const LocType = loadLocType();
            releaseReferences(LocType, 'recolPalette');
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- WordPack stays deferred until f.f(B)V in TextureOpHerringbone.releaseTextureOpHerringboneStatics.
            const WordPack = (require('#/io/WordPack') as typeof import('#/io/WordPack')).default;
            releaseReferences(WordPack, 'codec');
            if (guard < 30) {
                return;
            }
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- HD gi stays deferred until f.f(B)V in TextureOpHerringbone.releaseTextureOpHerringboneStatics.
            const StaticPointLight = (require('./StaticPointLight') as typeof import('./StaticPointLight')).default;
            releaseReferences(StaticPointLight, 'mPerlinNoise');
            const world = loadWorld();
            releaseReferences(world, 'waterSpriteKeys');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'f.C(' + guard + ')');
        }
    }

    private repeatsY = 1; // vi.R:I
    private lineWidth: number; // vi.Q:I
    private repeatsX: number; // vi.N:I

    // vi.<init>()V
    constructor() {
        super(0, true);
        this.lineWidth = 204;
        this.repeatsX = 1;
    }

    // vi.a(IB)[I
    override getMonochromeOutput(row: number): Int32Array | null {
        const output = requireNonNull(this.monochromeImageCache).get(row);
        if (requireNonNull(this.monochromeImageCache).invalid) {
            for (let x = 0; x < TextureOp.width; x++) {
                const px = arrayAtI32(TextureOp.normalisedX, x);
                let cellX = Math.imul(px, this.repeatsX) >> 12;
                const py = arrayAtI32(TextureOp.normalisedY, row);
                const cellY = Math.imul(this.repeatsY, py) >> 12;
                const localY = Math.imul(intRemainder(py, intDivide(4096, this.repeatsY)), this.repeatsY);
                const localX = Math.imul(intRemainder(px, intDivide(4096, this.repeatsX)), this.repeatsX);
                if (this.lineWidth > localY) {
                    cellX = (cellX - cellY) | 0;
                    while (cellX < 0) cellX += 4;
                    while (cellX > 3) cellX -= 4;
                    if (cellX !== 1 || localX < this.lineWidth) {
                        arrayPutI32(output, x, 0);
                        continue;
                    }
                }
                if (this.lineWidth <= localX) {
                    arrayPutI32(output, x, 4096);
                } else {
                    cellX = (cellX - cellY) | 0;
                    while (cellX < 0) cellX += 4;
                    while (cellX > 3) cellX -= 4;
                    arrayPutI32(output, x, cellX > 0 ? 0 : 4096);
                }
            }
        }
        return output;
    }

    // vi.a(Lgd;ZI)V
    override decode(packet: PacketT | null, code: number): void {
        if (code === 0) this.repeatsX = requireNonNull(packet).g1();
        else if (code === 1) this.repeatsY = requireNonNull(packet).g1();
        else if (code === 2) this.lineWidth = requireNonNull(packet).g2();
    }
}
