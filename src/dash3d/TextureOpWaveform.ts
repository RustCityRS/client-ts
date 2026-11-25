import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type PacketT from '#/io/PacketT';
import { doubleToInt } from '#/util/IntUtils';
import { arrayAtI32, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import TextureOp from './TextureOp';
import { loadClient, loadJagString, loadMinimenu, loadNpcType } from '#/util/GamepackClasses';

// nh
export default class TextureOpWaveform extends TextureOp {
    // HD ag.i(I)V
    static releaseTextureOpWaveformStatics(guard: number): void {
        try {
            const Minimenu = loadMinimenu();
            releaseReferences(Minimenu, 'lime');
            if (guard !== -1771542303) {
                const NpcType = loadNpcType();
                releaseReferences(NpcType, 'layerFramesets');
            }
            const NpcType = loadNpcType();
            releaseReferences(NpcType, 'layerFramesets');
            const JagString = loadJagString();
            releaseReferences(JagString, 'zero');
            const Client = loadClient();
            releaseReferences(Client, 'out');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ag.F(' + guard + ')');
        }
    }

    private waveform = 0; // nh.Q:I
    private frequency = 1; // nh.T:I
    private radial = 0; // nh.cb:I

    // nh.<init>()V
    constructor() {
        super(0, true);
    }

    // nh.b(I)V
    override postDecode(): void {
        TextureOp.initTrigTables();
    }

    // nh.a(Lgd;ZI)V
    override decode(packet: PacketT | null, code: number): void {
        if (code === 0) this.radial = requireNonNull(packet).g1();
        else if (code === 1) this.waveform = requireNonNull(packet).g1();
        else if (code === 3) this.frequency = requireNonNull(packet).g1();
    }

    // nh.a(IB)[I
    override getMonochromeOutput(row: number): Int32Array | null {
        const output = requireNonNull(this.monochromeImageCache).get(row);
        if (requireNonNull(this.monochromeImageCache).invalid) {
            const y = arrayAtI32(TextureOp.normalisedY, row);
            const dy = (y - 2048) >> 1;
            for (let x = 0; x < TextureOp.width; x++) {
                const px = arrayAtI32(TextureOp.normalisedX, x);
                const dx = (px - 2048) >> 1;
                let phase: number;
                if (this.radial !== 0) {
                    const distanceSquared = (Math.imul(dy, dy) + Math.imul(dx, dx)) >> 12;
                    phase = doubleToInt(Math.sqrt(Math.fround(Math.fround(distanceSquared) / 4096)) * 4096);
                    phase = doubleToInt(Math.imul(phase, this.frequency) * Math.PI);
                } else {
                    phase = Math.imul(this.frequency, px - y);
                }
                phase = (phase - (phase & -4096)) | 0;
                if (this.waveform === 0) {
                    phase = (4096 + arrayAtI32(TextureOp.sinTable, (phase & 4082) >> 4)) >> 1;
                } else if (this.waveform === 2) {
                    phase -= 2048;
                    if (phase < 0) phase = -phase;
                    phase = (2048 - phase) << 1;
                }
                arrayPutI32(output, x, phase);
            }
        }
        return output;
    }
}
