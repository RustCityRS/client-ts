import { intRemainder } from '#/util/IntUtils';
import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type PacketT from '#/io/PacketT';
import { doubleToInt, intDivide } from '#/util/IntUtils';
import { arrayAtI32, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import TextureOp from './TextureOp';
import { loadClient, loadLocalisedText, loadMinimenu, loadProtocol, loadWorld } from '#/util/GamepackClasses';

// r
export default class TextureOpEdgeDetector extends TextureOp {
    // HD pg.f(B)V
    static releaseTextureOpEdgeDetectorStatics(guard: number): void {
        try {
            const Client = loadClient();
            releaseReferences(Client, 'chatHeight', 'chatY');
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'germanChatcol9');
            releaseReferences(Client, 'chatMessage');
            releaseReferences(LocalisedText, 'englishChateffect2');
            const Minimenu = loadMinimenu();
            releaseReferences(Minimenu, 'playerCursor');
            const Protocol = loadProtocol();
            releaseReferences(Protocol, 'assistReqSuffix');
            releaseReferences(LocalisedText, 'germanLoggedIn');
            releaseReferences(Client, 'chatX', 'mapBuildNpcData', 'chatWidth');
            releaseReferences(LocalisedText, 'chateffect2');
            releaseReferences(Client, 'chatEffect');
            intRemainder(-62, intDivide((-59 - guard) | 0, 47));
            const world = loadWorld();
            releaseReferences(world, 'postTab');
            releaseReferences(Client, 'chatTimer', 'chatColour');
            releaseReferences(LocalisedText, 'defaultChateffect2');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'pg.B(' + guard + ')');
        }
    }

    private scale = 4096; // r.Q:I

    // r.<init>()V
    constructor() {
        super(1, true);
    }

    // r.a(IB)[I
    override getMonochromeOutput(row: number): Int32Array | null {
        const dest = requireNonNull(this.monochromeImageCache).get(row);
        if (requireNonNull(this.monochromeImageCache).invalid) {
            const previous = this.getChildMonochromeOutput(0, TextureOp.heightMask & (row - 1));
            const current = this.getChildMonochromeOutput(0, row);
            const next = this.getChildMonochromeOutput(0, TextureOp.heightMask & (row + 1));
            for (let x = 0; x < TextureOp.width; x++) {
                const dx = Math.imul(arrayAtI32(current, TextureOp.widthMask & (x + 1)) - arrayAtI32(current, TextureOp.widthMask & (x - 1)), this.scale) >> 12;
                const xx = Math.imul(dx, dx) >> 12;
                const dy = Math.imul(arrayAtI32(next, x) - arrayAtI32(previous, x), this.scale) >> 12;
                const yy = Math.imul(dy, dy) >> 12;
                const length = doubleToInt(Math.sqrt(Math.fround((4096 + xx + yy) | 0) / 4096.0) * 4096.0);
                const inverse = length === 0 ? 0 : intDivide(0x1000000, length);
                arrayPutI32(dest, x, 4096 - inverse);
            }
        }
        return dest;
    }

    // r.a(Lgd;ZI)V
    override decode(packet: PacketT | null, code: number): void {
        if (code === 0) this.scale = requireNonNull(packet).g2();
    }
}
