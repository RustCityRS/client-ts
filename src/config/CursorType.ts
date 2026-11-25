import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type Js5 from '#/cache/Js5';
import LRUHashCache from '#/datastruct/LRUHashCache';
import PacketT from '#/io/PacketT';
import { requireNonNull } from '#/util/JavaArray';
import Pix32 from '#/graphics/Pix32';
import SpriteLoader from '#/graphics/SpriteLoader';
import { loadClient } from '#/util/GamepackClasses';

// dl
export default class CursorType {
    // HD ia.b(B)V
    static releaseHdStatics(guard: number): void {
        try {
            const Client = loadClient();
            releaseReferences(Client, 'friendWorld');
            if (guard !== -118) {
                releaseReferences(Client, 'friendWorld');
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ia.E(' + guard + ')');
        }
    }

    private sprite = 0; // dl.a:I
    hotspotY = 0; // dl.d:I
    hotspotX = 0; // dl.o:I

    static configArchive: Js5 | null = null; // ke.s:Lal;
    static spriteArchive: Js5 | null = null; // hj.e:Lal;
    static readonly types = new LRUHashCache<CursorType>(64); // r.X:Lve;
    static readonly spriteCache = new LRUHashCache<Pix32>(2); // ii.i:Lve;

    // dl.<init>()V
    constructor() {}

    // SD dl.a(I)Lrh;, HD ia.a(B)Lmm;.
    getSprite(): Pix32 | null {
        let value = CursorType.spriteCache.Find(BigInt(this.sprite));
        if (value !== null) {
            if (!(value instanceof Pix32)) throw new TypeError('ClassCastException: expected Pix32');
            return value;
        }
        value = SpriteLoader.loadSoftwareSpriteWithAlpha(0, CursorType.spriteArchive, this.sprite);
        if (value !== null) CursorType.spriteCache.Put(BigInt(this.sprite), value);
        return value;
    }

    // dl.a(IILgd;)V
    decode(packet: PacketT): void {
        for (;;) {
            const opcode = packet.g1();
            if (opcode === 0) return;
            this.decodeOpcode(opcode, packet);
        }
    }

    // dl.a(IILgd;B)V
    private decodeOpcode(opcode: number, packet: PacketT): void {
        if (opcode === 1) this.sprite = packet.g2();
        else if (opcode === 2) {
            this.hotspotX = packet.g1();
            this.hotspotY = packet.g1();
        }
    }

    // bh.a(ILal;Lal;)V
    static init(config: Js5 | null, sprites: Js5 | null): void {
        this.configArchive = config;
        this.spriteArchive = sprites;
    }

    // SD il.a(ZI)Ldl;, HD qg.d(II)Lia;.
    static get(id: number): CursorType {
        let type = this.types.Find(BigInt(id));
        if (type !== null) {
            if (!(type instanceof CursorType)) throw new TypeError('ClassCastException: expected CursorType');
            return type;
        }
        const bytes = requireNonNull(this.configArchive).GetFile(id, 33);
        type = new CursorType();
        if (bytes !== null) type.decode(new PacketT(bytes));
        this.types.Put(BigInt(id), type);
        return type;
    }

    // fa.a(B)V
    static clear(): void {
        this.types.Reset();
        this.spriteCache.Reset();
    }

    // ig.c(I)V
    static removeSoft(): void {
        this.types.removeSoft();
        this.spriteCache.removeSoft();
    }

    // vi.c(II)V
    static clean(age: number): void {
        this.types.Clean(age);
        this.spriteCache.Clean(age);
    }
}
