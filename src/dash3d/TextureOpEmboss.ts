import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type PacketT from '#/io/PacketT';
import { doubleToInt, intDivide } from '#/util/IntUtils';
import { arrayAtI32, arrayAtI8, arrayPutI32, arrayPutI8, requireNonNull } from '#/util/JavaArray';
import TextureOp from './TextureOp';
import { loadClient, loadLocalisedText, loadMinimenu, loadPlayerModel, loadWorld } from '#/util/GamepackClasses';

// ab
export default class TextureOpEmboss extends TextureOp {
    // HD pk.h(I)V
    static releaseTextureOpEmbossStatics(guard: number): void {
        try {
            const Minimenu = loadMinimenu();
            releaseReferences(Minimenu, 'walkHere');
            if (guard <= 6) {
                const LocalisedText = loadLocalisedText();
                releaseReferences(LocalisedText, 'frenchChateffect5');
            }
            const PlayerModel = loadPlayerModel();
            releaseReferences(PlayerModel, 'recolourSources2Rs');
            const world = loadWorld();
            releaseReferences(world, 'underwaterTerrainBatches');
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'germanAttack', 'frenchChateffect5');
            const Client = loadClient();
            releaseReferences(Client, 'texturesArchive');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'pk.F(' + guard + ')');
        }
    }

    static inverseNormalLength: Int8Array | null = new Int8Array(32896); // je.Q:[B

    // je.<clinit>()V
    static {
        let index = 0;
        for (let y = 0; y < 256; y++) {
            for (let x = 0; x <= y; x++) {
                const square = Math.fround((65535 + x * x + y * y) / 65535.0);
                arrayPutI8(this.inverseNormalLength, index++, (255.0 / Math.sqrt(square)) | 0);
            }
        }
    }

    private light: Int32Array | null = new Int32Array(3); // ab.P:[I
    private elevation = 3216; // ab.W:I
    private azimuth = 3216; // ab.X:I
    private depth = 4096; // ab.Z:I

    // ab.<init>()V
    constructor() {
        super(1, true);
    }

    // ab.b(I)V
    override postDecode(): void {
        this.updateLight();
    }

    // ab.a(Lgd;ZI)V
    override decode(packet: PacketT | null, code: number): void {
        if (code === 0) this.depth = requireNonNull(packet).g2();
        else if (code === 1) this.azimuth = requireNonNull(packet).g2();
        else if (code === 2) this.elevation = requireNonNull(packet).g2();
    }

    // ab.e(B)V
    private updateLight(): void {
        const cosine = Math.cos(Math.fround(this.elevation) / 4096.0);
        arrayPutI32(this.light, 0, doubleToInt(cosine * Math.sin(Math.fround(this.azimuth) / 4096.0) * 4096.0));
        arrayPutI32(this.light, 1, doubleToInt(cosine * Math.cos(Math.fround(this.azimuth) / 4096.0) * 4096.0));
        arrayPutI32(this.light, 2, doubleToInt(4096.0 * Math.sin(Math.fround(this.elevation) / 4096.0)));
        const xx = Math.imul(arrayAtI32(this.light, 0), arrayAtI32(this.light, 0)) >> 12;
        const yy = Math.imul(arrayAtI32(this.light, 1), arrayAtI32(this.light, 1)) >> 12;
        const zz = Math.imul(arrayAtI32(this.light, 2), arrayAtI32(this.light, 2)) >> 12;
        const length = doubleToInt(4096.0 * Math.sqrt((zz + yy + xx) >> 12));
        if (length !== 0) {
            arrayPutI32(this.light, 2, intDivide(arrayAtI32(this.light, 2) << 12, length));
            arrayPutI32(this.light, 0, intDivide(arrayAtI32(this.light, 0) << 12, length));
            arrayPutI32(this.light, 1, intDivide(arrayAtI32(this.light, 1) << 12, length));
        }
    }

    // ab.a(IB)[I
    override getMonochromeOutput(row: number): Int32Array | null {
        const dest = requireNonNull(this.monochromeImageCache).get(row);
        if (requireNonNull(this.monochromeImageCache).invalid) {
            const scale = Math.imul(this.depth, TextureOp.sizeScale) >> 12;
            const previous = this.getChildMonochromeOutput(0, (row - 1) & TextureOp.heightMask);
            const current = this.getChildMonochromeOutput(0, row);
            const next = this.getChildMonochromeOutput(0, (row + 1) & TextureOp.heightMask);
            const width = TextureOp.width;
            const mask = TextureOp.widthMask;
            const normals = TextureOpEmboss.inverseNormalLength;
            const light = this.light;
            // The largest triangular lookup index is 255 * 256 / 2 + 255.
            if (
                dest !== null &&
                dest.length >= width &&
                previous !== null &&
                previous.length >= width &&
                next !== null &&
                next.length >= width &&
                current !== null &&
                mask >= 0 &&
                mask < current.length &&
                normals !== null &&
                normals.length >= 32896 &&
                light !== null &&
                light.length >= 3
            ) {
                for (let x = 0; x < width; x++) {
                    const dy = Math.imul(next[x] - previous[x], scale) >> 12;
                    const dx = Math.imul(current[(x - 1) & mask] - current[(x + 1) & mask], scale) >> 12;
                    const ix = Math.min(255, Math.abs(dx >> 4));
                    const iy = Math.min(255, Math.abs(dy >> 4));
                    const inverse = normals[(((iy + 1) * iy) >> 1) + ix] & 255;
                    const nx = Math.imul(Math.imul(dx, inverse) >> 8, light[0]) >> 12;
                    const ny = Math.imul(light[1], Math.imul(inverse, dy) >> 8) >> 12;
                    const nz = Math.imul(light[2], inverse << 4) >> 12;
                    dest[x] = nz + (nx + ny);
                }
                return dest;
            }
            for (let x = 0; x < TextureOp.width; x++) {
                const dy = Math.imul(arrayAtI32(next, x) - arrayAtI32(previous, x), scale) >> 12;
                const dx = Math.imul(-arrayAtI32(current, (x + 1) & TextureOp.widthMask) + arrayAtI32(current, TextureOp.widthMask & (x - 1)), scale) >> 12;
                let ix = dx >> 4,
                    iy = dy >> 4;
                if (ix < 0) ix = -ix;
                if (iy < 0) iy = -iy;
                if (ix > 255) ix = 255;
                if (iy > 255) iy = 255;
                const inverse = arrayAtI8(TextureOpEmboss.inverseNormalLength, (((iy + 1) * iy) >> 1) + ix) & 255;
                let nx = Math.imul(dx, inverse) >> 8;
                nx = Math.imul(nx, arrayAtI32(this.light, 0)) >> 12;
                let nz = (inverse * 4096) >> 8;
                let ny = Math.imul(inverse, dy) >> 8;
                ny = Math.imul(arrayAtI32(this.light, 1), ny) >> 12;
                nz = Math.imul(arrayAtI32(this.light, 2), nz) >> 12;
                arrayPutI32(dest, x, (nz + (nx + ny)) | 0);
            }
        }
        return dest;
    }
}
