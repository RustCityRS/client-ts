import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type PacketT from '#/io/PacketT';
import { intDivide } from '#/util/IntUtils';
import { arrayAtI32, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import TextureOp from './TextureOp';
import { loadClient, loadLocalisedText, loadNpcType, loadWorld } from '#/util/GamepackClasses';

// fe
export default class TextureOpMandelbrot extends TextureOp {
    // HD gm.i(I)V
    static releaseTextureOpMandelbrotStatics(guard: number): void {
        try {
            if (guard !== 9423) {
                return;
            }
            const Client = loadClient();
            releaseReferences(Client, 'rsaExponent');
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'germanLoadingSprites');
            const world = loadWorld();
            releaseReferences(world, 'middep64');
            releaseReferences(Client, 'js5DiskQueue');
            const NpcType = loadNpcType();
            releaseReferences(NpcType, 'm_pModels');
            releaseReferences(Client, 'crossName');
            releaseReferences(LocalisedText, 'loadedTextures');
            releaseReferences(Client, 'mapNameSeparator');
            releaseReferences(LocalisedText, 'englishLoadedTextures', 'frenchFaceHere');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'gm.E(' + guard + ')');
        }
    }

    private scale = 1365; // fe.T:I
    private offsetX: number; // fe.Q:I
    private offsetY: number; // fe.X:I
    private iterations: number; // fe.V:I

    // fe.<init>()V
    constructor() {
        super(0, true);
        this.offsetX = 0;
        this.offsetY = 0;
        this.iterations = 20;
    }

    // fe.a(Lgd;ZI)V
    override decode(packet: PacketT | null, code: number): void {
        if (code === 0) this.scale = requireNonNull(packet).g2();
        else if (code === 1) this.iterations = requireNonNull(packet).g2();
        else if (code === 2) this.offsetX = requireNonNull(packet).g2();
        else if (code === 3) this.offsetY = requireNonNull(packet).g2();
    }

    // fe.a(IB)[I
    override getMonochromeOutput(row: number): Int32Array | null {
        const output = requireNonNull(this.monochromeImageCache).get(row);
        if (requireNonNull(this.monochromeImageCache).invalid) {
            for (let x = 0; x < TextureOp.width; x++) {
                const real = (intDivide(arrayAtI32(TextureOp.normalisedX, x) << 12, this.scale) + this.offsetX) | 0;
                const imaginary = (intDivide(arrayAtI32(TextureOp.normalisedY, row) << 12, this.scale) + this.offsetY) | 0;
                let zr = real,
                    zi = imaginary;
                let zr2 = Math.imul(real, real) >> 12;
                let zi2 = Math.imul(imaginary, imaginary) >> 12;
                let count = 0;
                while (((zi2 + zr2) | 0) < 16384 && count < this.iterations) {
                    zi = (imaginary + (Math.imul(zi, zr) >> 12) * 2) | 0;
                    zr = (real + zr2 - zi2) | 0;
                    count++;
                    zi2 = Math.imul(zi, zi) >> 12;
                    zr2 = Math.imul(zr, zr) >> 12;
                }
                arrayPutI32(output, x, count < ((this.iterations - 1) | 0) ? intDivide(count << 12, this.iterations) : 0);
            }
        }
        return output;
    }
}
