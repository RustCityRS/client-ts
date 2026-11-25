import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type PacketT from '#/io/PacketT';
import { intDivide } from '#/util/IntUtils';
import { arrayAtI32, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import TextureOp from './TextureOp';
import { loadWorldMap } from '#/util/GamepackClasses';

// ib
export default class TextureOpDiagonalWaves extends TextureOp {
    // HD mh.g(B)V
    static releaseTextureOpDiagonalWavesStatics(guard: number): void {
        try {
            if (guard !== -91) {
                TextureOpDiagonalWaves.releaseTextureOpDiagonalWavesStatics(7);
            }
            const WorldMap = loadWorldMap();
            releaseReferences(WorldMap, 'sceneArea');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'mh.R(' + guard + ')');
        }
    }

    private divisor = 8192; // ib.P:I
    private amplitude = 4096; // ib.R:I
    private firstX = 2048; // ib.Z:I
    private secondY = 2048; // ib.ab:I
    private firstY = 0; // ib.bb:I
    private frequency = 12288; // ib.cb:I
    private secondX = 0; // ib.eb:I

    // ib.<init>()V
    constructor() {
        super(0, true);
    }

    // ib.b(I)V
    override postDecode(): void {
        TextureOp.initTrigTables();
    }

    // ib.a(III)Z
    private firstWave(multiplier: number, y: number, x: number): boolean {
        const phase = Math.imul(y - x, this.frequency) >> 12;
        let bound = arrayAtI32(TextureOp.cosine, (Math.imul(phase, multiplier) >> 12) & 255);
        bound = intDivide(bound << 12, this.frequency);
        bound = intDivide(bound << 12, this.divisor);
        bound = Math.imul(bound, this.amplitude) >> 12;
        return bound > ((x + y) | 0) && ((y + x) | 0) > (-bound | 0);
    }

    // ib.a(Lgd;ZI)V
    override decode(packet: PacketT | null, code: number): void {
        if (code === 0) this.firstX = requireNonNull(packet).g2();
        else if (code === 1) this.firstY = requireNonNull(packet).g2();
        else if (code === 2) this.secondX = requireNonNull(packet).g2();
        else if (code === 3) this.secondY = requireNonNull(packet).g2();
        else if (code === 4) this.frequency = requireNonNull(packet).g2();
        else if (code === 5) this.amplitude = requireNonNull(packet).g2();
        else if (code === 6) this.divisor = requireNonNull(packet).g2();
    }

    // ib.a(IB)[I
    override getMonochromeOutput(row: number): Int32Array | null {
        const dest = requireNonNull(this.monochromeImageCache).get(row);
        if (requireNonNull(this.monochromeImageCache).invalid) {
            const y = (arrayAtI32(TextureOp.normalisedY, row) - 2048) | 0;
            for (let column = 0; column < TextureOp.width; column++) {
                const x = (arrayAtI32(TextureOp.normalisedX, column) - 2048) | 0;
                let y1 = (this.firstY + y) | 0;
                let x2 = (this.secondX + x) | 0;
                if (y1 < -2048) y1 = (4096 + y1) | 0;
                let x1 = (this.firstX + x) | 0;
                if (x1 < -2048) x1 = (4096 + x1) | 0;
                if (x2 < -2048) x2 = (4096 + x2) | 0;
                let y2 = (this.secondY + y) | 0;
                if (x1 > 2048) x1 = (x1 - 4096) | 0;
                if (x2 > 2048) x2 = (x2 - 4096) | 0;
                if (y1 > 2048) y1 = (y1 - 4096) | 0;
                if (y2 < -2048) y2 = (y2 + 4096) | 0;
                if (y2 > 2048) y2 = (y2 - 4096) | 0;
                arrayPutI32(dest, column, this.firstWave(255, y1, x1) || this.secondWave(y2, x2) ? 4096 : 0);
            }
        }
        return dest;
    }

    // ib.b(III)Z
    private secondWave(y: number, x: number): boolean {
        const phase = Math.imul(this.frequency, y + x) >> 12;
        let bound = arrayAtI32(TextureOp.cosine, (0xff96b & Math.imul(255, phase)) >> 12);
        bound = intDivide(bound << 12, this.frequency);
        bound = intDivide(bound << 12, this.divisor);
        bound = Math.imul(this.amplitude, bound) >> 12;
        return ((y - x) | 0) < bound && ((y - x) | 0) > (-bound | 0);
    }
}
