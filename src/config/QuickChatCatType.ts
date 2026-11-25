import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import { arrayAtI32 } from '#/util/JavaArray';
import type JagString from '#/datastruct/JagString';
import SecondaryNode from '#/datastruct/SecondaryNode';
import PacketT from '#/io/PacketT';
import { loadWorld } from '#/util/GamepackClasses';

export default class QuickChatCatType extends SecondaryNode {
    // HD bc.e(I)V
    static releaseQuickChatCatTypeStatics(guard: number): void {
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD pi stays deferred until bc.e(I)V in QuickChatCatType.releaseQuickChatCatTypeStatics.
            const ColourImageCache = (require('#/dash3d/ColourImageCache') as typeof import('#/dash3d/ColourImageCache')).default;
            releaseReferences(ColourImageCache, 'residentSentinel');
            if (guard !== -1667) {
                const world = loadWorld();
                world.cycleNo = 101;
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'bc.B(' + guard + ')');
        }
    }

    // pg.G:[I
    phraseKeys: Int32Array | null = null;
    // pg.I:[I
    categoryKeys: Int32Array | null = null;
    // pg.O:[I
    categories: Int32Array | null = null;
    // pg.R:[I
    phrases: Int32Array | null = null;
    // pg.U:Lid;
    description: JagString | null = null;
    // pg.<init>()V
    constructor() {
        super();
    }
    // pg.c(I)V
    markGlobal(): void {
        if (this.phrases !== null) for (let i = 0; i < this.phrases.length; i++) this.phrases[i] |= 32768;
        if (this.categories !== null) for (let i = 0; i < this.categories.length; i++) this.categories[i] |= 32768;
    }
    // pg.a(II)I
    GetSubCategoryIdByCharacter(key: number): number {
        if (this.categories !== null) for (let i = 0; i < this.categories.length; i++) if (arrayAtI32(this.categoryKeys, i) === key) return this.categories[i];
        return -1;
    }
    // pg.a(ILgd;)V
    Decode(packet: PacketT): void {
        for (;;) {
            const op = packet.g1();
            if (op === 0) return;
            this.DecodeType(packet, op);
        }
    }
    // pg.b(II)I
    GetPhraseIdByCharacter(key: number): number {
        if (this.phrases !== null) for (let i = 0; i < this.phrases.length; i++) if (arrayAtI32(this.phraseKeys, i) === key) return this.phrases[i];
        return -1;
    }
    // pg.a(Lgd;IZ)V
    private DecodeType(packet: PacketT, opcode: number): void {
        if (opcode === 1) this.description = packet.gStringNoConversion();
        else if (opcode === 2) {
            const n = packet.g1();
            this.categoryKeys = new Int32Array(n);
            this.categories = new Int32Array(n);
            for (let i = 0; i < n; i++) {
                this.categories[i] = packet.g2();
                this.categoryKeys[i] = packet.g1s() & 255;
            }
        } else if (opcode === 3) {
            const n = packet.g1();
            this.phrases = new Int32Array(n);
            this.phraseKeys = new Int32Array(n);
            for (let i = 0; i < n; i++) {
                this.phrases[i] = packet.g2();
                this.phraseKeys[i] = packet.g1s() & 255;
            }
        }
    }
}
