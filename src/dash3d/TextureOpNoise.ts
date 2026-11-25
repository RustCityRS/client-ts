import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import { intDivide } from '#/util/IntUtils';
import { arrayAtI32, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import TextureOp from './TextureOp';
import { loadClient, loadProtocol } from '#/util/GamepackClasses';

// sk
export default class TextureOpNoise extends TextureOp {
    // HD rj.h(I)V
    static releaseTextureOpNoiseStatics(guard: number): void {
        try {
            const Client = loadClient();
            releaseReferences(Client, 'projectiles', 'mapNpcRegionIds');
            if (guard !== -15028) {
                releaseReferences(Client, 'projectiles');
            }
            const Protocol = loadProtocol();
            releaseReferences(Protocol, 'clanRequestSuffix');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'rj.B(' + guard + ')');
        }
    }

    // sk.<init>()V
    constructor() {
        super(0, true);
    }

    // sk.a(IB)[I
    override getMonochromeOutput(row: number): Int32Array | null {
        const output = requireNonNull(this.monochromeImageCache).get(row);
        if (requireNonNull(this.monochromeImageCache).invalid) {
            const y = arrayAtI32(TextureOp.normalisedY, row);
            for (let x = 0; x < TextureOp.width; x++) {
                arrayPutI32(output, x, this.noise(arrayAtI32(TextureOp.normalisedX, x), 57, y) % 4096);
            }
        }
        return output;
    }

    // sk.a(III)I
    private noise(x: number, stride: number, y: number): number {
        let n = (Math.imul(stride, y) + x) | 0;
        n = (n << 1) ^ n;
        const hash = 1376312589 + Math.imul(789221 + Math.imul(Math.imul(n, n), 15731), n);
        return 4096 - intDivide(hash & 0x7fffffff, 262144);
    }
}
