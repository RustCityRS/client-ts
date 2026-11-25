import { releaseReferences } from '#/util/StaticReferences';
import type PacketT from '#/io/PacketT';
import { intDivide } from '#/util/IntUtils';
import { isJavaRuntimeException } from '#/util/JavaException';
import WrappedException from '#/util/WrappedException';
import { arrayAtI32, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import TextureOp from './TextureOp';
import { loadClient, loadGameShell, loadLocalisedText, loadOrbitCamera } from '#/util/GamepackClasses';

// od
export default class TextureOpWeave extends TextureOp {
    // HD sa.h(I)V
    static releaseTextureOpWeaveStatics(guard: number): void {
        try {
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'englishUse');
            const OrbitCamera = loadOrbitCamera();
            releaseReferences(OrbitCamera, 'shakeRandom');
            const GameShell = loadGameShell();
            releaseReferences(GameShell, 'progressFont');
            releaseReferences(LocalisedText, 'use');
            if (guard !== -21136) {
                TextureOpWeave.divideFloor(-38, -96, -102);
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'sa.B(' + guard + ')');
        }
    }

    // HD sa.c(III)I
    static divideFloor(value: number, guard: number, divisor: number): number {
        try {
            if (guard >= -99) {
                const Client = loadClient();
                Client.forceImmediateEnvironmentUpdate = true;
            }
            const sign = value >>> 31;
            return (intDivide((value + sign) | 0, divisor) - sign) | 0;
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'sa.E(' + value + ',' + guard + ',' + divisor + ')');
        }
    }

    private lineWidth = 585; // od.W:I

    // od.<init>()V
    constructor() {
        super(0, true);
    }

    // od.a(IB)[I
    override getMonochromeOutput(row: number): Int32Array | null {
        const output = requireNonNull(this.monochromeImageCache).get(row);
        if (requireNonNull(this.monochromeImageCache).invalid) {
            const y = arrayAtI32(TextureOp.normalisedY, row);
            for (let x = 0; x < TextureOp.width; x++) {
                const px = arrayAtI32(TextureOp.normalisedX, x);
                if (this.lineWidth < px && px < ((4096 - this.lineWidth) | 0) && ((2048 - this.lineWidth) | 0) < y && y < ((this.lineWidth + 2048) | 0)) {
                    const distance = Math.abs((2048 - px) | 0) << 12;
                    arrayPutI32(output, x, (4096 - intDivide(distance, (2048 - this.lineWidth) | 0)) | 0);
                } else if (px > ((2048 - this.lineWidth) | 0) && px < ((2048 + this.lineWidth) | 0)) {
                    const distance = (Math.abs((y - 2048) | 0) - this.lineWidth) << 12;
                    arrayPutI32(output, x, intDivide(distance, (2048 - this.lineWidth) | 0));
                } else if (y < this.lineWidth || y > ((4096 - this.lineWidth) | 0)) {
                    const distance = (Math.abs((px - 2048) | 0) - this.lineWidth) << 12;
                    arrayPutI32(output, x, intDivide(distance, (2048 - this.lineWidth) | 0));
                } else if (this.lineWidth <= px && px <= ((4096 - this.lineWidth) | 0)) {
                    arrayPutI32(output, x, 0);
                } else {
                    const distance = Math.abs((2048 - y) | 0) << 12;
                    arrayPutI32(output, x, (4096 - intDivide(distance, (2048 - this.lineWidth) | 0)) | 0);
                }
            }
        }
        return output;
    }

    // od.a(Lgd;ZI)V
    override decode(packet: PacketT | null, code: number): void {
        if (code === 0) this.lineWidth = requireNonNull(packet).g2();
    }
}
