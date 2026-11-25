import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type Js5 from '#/cache/Js5';
import { glJar } from '#/client/ClientVariant';
import LRUHashCache from '#/datastruct/LRUHashCache';
import PacketT from '#/io/PacketT';
import { arrayAtI32, requireNonNull } from '#/util/JavaArray';
import AnimFrameSet from '#/dash3d/AnimFrameSet';
import type ModelLit from '#/dash3d/ModelLit';
import { loadCursorType, loadGlModel, loadGlRenderer, loadLocalisedText, loadRoofModeStatics, loadTitleScreen, loadWorld } from '#/util/GamepackClasses';

// Keep the original variant's HD class initialization at first use.
let rendererClass: (typeof import('#/gl/GlRenderer'))['default'] | undefined;
let glModelClass: (typeof import('#/dash3d/GlModel'))['default'] | undefined;

export default class SeqType {
    // HD tk.a(B)V
    static releaseHdStatics(guard: number): void {
        try {
            const world = loadWorld();
            releaseReferences(world, 'dynamicSprites');
            const TitleScreen = loadTitleScreen();
            releaseReferences(TitleScreen, 'm_logo');
            releaseReferences(SeqType, 'm_pConfigClient');
            const CursorType = loadCursorType();
            releaseReferences(CursorType, 'spriteArchive');
            if (guard !== -108) {
                releaseReferences(CursorType, 'spriteArchive');
            }
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'germanAlreadyFriend');
            const RoofModeStatics = loadRoofModeStatics();
            releaseReferences(RoofModeStatics, 'hideMinZ');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'tk.F(' + guard + ')');
        }
    }

    // ag.i:Lal;
    static m_pConfigClient: Js5 | null = null;
    // ga.B:Lve;
    static m_recentUse = new LRUHashCache<SeqType>(64);

    // hf.a(Lal;Lal;ILal;)V
    static Init(archive: Js5 | null, bases: Js5 | null, frames: Js5 | null): void {
        AnimFrameSet.basesArchive = bases;
        AnimFrameSet.framesArchive = frames;
        SeqType.m_pConfigClient = archive;
    }

    // tb.b(II)Lek;
    static List(id: number): SeqType {
        let type = SeqType.m_recentUse.Find(BigInt(id));
        if (type !== null) return type;
        const archive = SeqType.m_pConfigClient;
        const file = SeqType.getFileId(id);
        const group = SeqType.getGroupId(id);
        const bytes = requireNonNull(archive).GetFile(file, group);
        type = new SeqType();
        type.id = id;
        if (bytes !== null) type.Decode(new PacketT(bytes));
        type.PostDecode();
        SeqType.m_recentUse.Put(BigInt(id), type);
        return type;
    }

    // fa.a(I)V
    static ResetCache(): void {
        SeqType.m_recentUse.Reset();
        AnimFrameSet.cache.Reset();
    }
    // pj.a(II)V
    static clean(age: number): void {
        SeqType.m_recentUse.Clean(age);
        AnimFrameSet.cache.Clean(age);
    }
    // th.a(B)V
    static removeSoft(): void {
        SeqType.m_recentUse.removeSoft();
        AnimFrameSet.cache.removeSoft();
    }

    // oe.a(II)I
    private static getFileId(id: number): number {
        return id & 127;
    }
    // bf.a(II)I
    private static getGroupId(id: number): number {
        return id >>> 7;
    }

    static forceTween = false; // qf.b:Z
    m_maxLoops: number; // ek.a:I
    m_duplicateBehaviour: number; // ek.b:I
    id = 0; // ek.f:I
    frames: Int32Array | null = null; // ek.g:[I
    m_priority: number; // ek.h:I
    flag16: boolean; // ek.j:Z
    m_postanimMove: number; // ek.k:I
    m_preanimMove: number; // ek.o:I
    m_replaceHeldRight: number; // ek.r:I
    chatFrames: Int32Array | null = null; // ek.t:[I
    mask: boolean[] | null = null; // ek.A:[Z
    tween: boolean; // ek.C:Z
    stretches: boolean; // ek.E:Z
    delays: Int32Array | null = null; // ek.F:[I
    m_loops: number; // ek.G:I
    sounds: (Int32Array | null)[] | null = null; // ek.H:[[I
    m_replaceHeldLeft: number; // ek.I:I
    special: boolean; // ek.L:Z

    // ek.<init>()V
    constructor() {
        this.m_maxLoops = 99;
        this.flag16 = false;
        this.m_postanimMove = -1;
        this.m_preanimMove = -1;
        this.m_duplicateBehaviour = 2;
        this.m_priority = 5;
        this.m_replaceHeldLeft = -1;
        this.tween = false;
        this.special = false;
        this.m_loops = -1;
        this.stretches = false;
        this.m_replaceHeldRight = -1;
    }

    // ek.b(I)V
    PostDecode(): void {
        if (this.m_preanimMove === -1) this.m_preanimMove = this.mask === null ? 0 : 2;
        if (this.m_postanimMove === -1) this.m_postanimMove = this.mask === null ? 0 : 2;
    }

    // ek.a(ILgd;I)V
    private DecodeType(opcode: number, p: PacketT): void {
        switch (opcode) {
            case 1: {
                const n = p.g2();
                this.delays = new Int32Array(n);
                for (let i = 0; i < n; i++) this.delays[i] = p.g2();
                this.frames = new Int32Array(n);
                for (let i = 0; i < n; i++) this.frames[i] = p.g2();
                for (let i = 0; i < n; i++) this.frames[i] = ((p.g2() << 16) + this.frames[i]) | 0;
                break;
            }
            case 2:
                this.m_loops = p.g2();
                break;
            case 3: {
                this.mask = new Array<boolean>(256).fill(false);
                const n = p.g1();
                for (let i = 0; i < n; i++) this.mask[p.g1()] = true;
                break;
            }
            case 4:
                this.stretches = true;
                break;
            case 5:
                this.m_priority = p.g1();
                break;
            case 6:
                this.m_replaceHeldLeft = p.g2();
                break;
            case 7:
                this.m_replaceHeldRight = p.g2();
                break;
            case 8:
                this.m_maxLoops = p.g1();
                break;
            case 9:
                this.m_preanimMove = p.g1();
                break;
            case 10:
                this.m_postanimMove = p.g1();
                break;
            case 11:
                this.m_duplicateBehaviour = p.g1();
                break;
            case 12: {
                const n = p.g1();
                this.chatFrames = new Int32Array(n);
                for (let i = 0; i < n; i++) this.chatFrames[i] = p.g2();
                for (let i = 0; i < n; i++) this.chatFrames[i] = ((p.g2() << 16) + this.chatFrames[i]) | 0;
                break;
            }
            case 13: {
                const n = p.g2();
                this.sounds = new Array<Int32Array | null>(n).fill(null);
                for (let i = 0; i < n; i++) {
                    const len = p.g1();
                    if (len > 0) {
                        const row = (this.sounds[i] = new Int32Array(len));
                        row[0] = p.g3();
                        for (let j = 1; j < len; j++) row[j] = p.g2();
                    }
                }
                break;
            }
            case 14:
                this.special = true;
                break;
            case 15:
                this.tween = true;
                break;
            case 16:
                this.flag16 = true;
                break;
        }
    }

    // ek.a(BLgd;)V
    Decode(p: PacketT): void {
        for (let opcode = p.g1(); opcode !== 0; opcode = p.g1()) this.DecodeType(opcode, p);
    }

    // Renderer methods (batch 5). Each copies var3 for animation, then applies frame var1/var4 of this sequence,
    // tweened toward the next frame when this.tween or SeqType.forceTween is set. The obfuscated shift distances are
    // written 16. Stripped from all three: the invocation counters (ek.c, ek.N, ek.M), the od.a wrappers, the client.wb
    // arms and the gb.a/hf.a dummy arguments (see AnimFrameSet). Java's non-short-circuit `!a & !b` copy flags are
    // evaluated into stack temporaries (trans*/colours*) first, so every hf.a call runs, in bytecode order, before the
    // copy dereferences var3.

    // ek.a(IILnd;IIZ)Lnd; (NXT AnimateModel90: LocType::GetTempModel calls it, as jb does here)
    // var1 = frame, var2 = rotation (& 3), var3 = model, var4 = cycle, var5 = next frame. The model is turned into the
    // frame's orientation, animated, and turned back. Stripped: the boolean dummy var6. Its only caller, jb's
    // a(IIIIII[[IIZIBLch;[[ILek;)Lwj; at 0xa8, passes iconst_0, so `if (var6) this.a((byte)106, null)` never runs.
    AnimateModel90(var1: number, var2: number, var3: ModelLit | null, var4: number, var5: number): ModelLit {
        const var7 = arrayAtI32(this.delays, var1);
        var1 = arrayAtI32(this.frames, var1);
        const var8 = AnimFrameSet.get(var1 >> 16);
        var1 &= 65535;
        if (var8 === null) {
            return requireNonNull(var3).CopyForAnimLoc(true, true, true);
        }

        var2 &= 3;
        let var9: AnimFrameSet | null = null;
        if ((this.tween || SeqType.forceTween) && var5 !== -1 && requireNonNull(this.frames).length > var5) {
            var5 = arrayAtI32(this.frames, var5);
            var9 = AnimFrameSet.get(var5 >> 16);
            var5 &= 65535;
        }

        let var10: ModelLit;
        if (var9 === null) {
            const trans1 = !var8.GetAnimateTransparencies(var1);
            const colours1 = !var8.getAnimateColours(var1);
            var10 = requireNonNull(var3).CopyForAnimLoc(trans1, colours1, !this.special);
        } else {
            const trans1 = !var8.GetAnimateTransparencies(var1);
            const trans2 = !var9.GetAnimateTransparencies(var5);
            const colours1 = !var8.getAnimateColours(var1);
            const colours2 = !var9.getAnimateColours(var5);
            var10 = requireNonNull(var3).CopyForAnimLoc(trans1 && trans2, colours1 && colours2, !this.special);
        }

        const renderer = glJar ? (rendererClass ??= loadGlRenderer()) : null;
        if (renderer?.active && this.special) {
            if (var2 !== 0) {
                const GlModel = (glModelClass ??= loadGlModel());
                if (!(var10 instanceof GlModel)) throw new TypeError('ClassCastException: not a GlModel');
                if (var2 === 1) var10.rotate270WithNormals();
                else if (var2 === 2) var10.rotate180WithNormals();
                else var10.rotate90WithNormals();
            }
        } else if (var2 === 1) {
            var10.Rotate270();
        } else if (var2 === 2) {
            var10.Rotate180();
        } else if (var2 === 3) {
            var10.Rotate90();
        }

        var10.Animate(var8, var1, var9, var5, (var4 - 1) | 0, var7, this.special);
        if (renderer?.active && this.special) {
            if (var2 !== 0) {
                const GlModel = (glModelClass ??= loadGlModel());
                if (!(var10 instanceof GlModel)) throw new TypeError('ClassCastException: not a GlModel');
                if (var2 === 1) var10.rotate90WithNormals();
                else if (var2 === 2) var10.rotate180WithNormals();
                else var10.rotate270WithNormals();
            }
        } else if (var2 === 1) {
            var10.Rotate90();
        } else if (var2 === 2) {
            var10.Rotate180();
        } else if (var2 === 3) {
            var10.Rotate270();
        }

        return var10;
    }

    // HD tk.a(IIIILak;I)Lak;, the hardware loc animation. It borrows ak.c's actor scratch slot.
    animateGlLoc(nextFrame: number, frame: number, cycle: number, angle: number, source: ModelLit | null): ModelLit {
        const GlModel = (glModelClass ??= loadGlModel());
        const GlRenderer = (rendererClass ??= loadGlRenderer());
        const delay = arrayAtI32(this.delays, frame);
        frame = arrayAtI32(this.frames, frame);
        const frames = AnimFrameSet.get(frame >> 16);
        frame &= 65535;
        if (frames === null) return requireNonNull(source).CopyForAnimActor(true, true, true);
        angle &= 3;
        let next: AnimFrameSet | null = null;
        if ((this.tween || SeqType.forceTween) && nextFrame !== -1 && nextFrame < requireNonNull(this.frames).length) {
            nextFrame = arrayAtI32(this.frames, nextFrame);
            next = AnimFrameSet.get(nextFrame >> 16);
            nextFrame &= 65535;
        }
        let result: ModelLit;
        if (next === null) {
            const alpha = !frames.GetAnimateTransparencies(frame);
            const colours = !frames.getAnimateColours(frame);
            result = requireNonNull(source).CopyForAnimActor(alpha, colours, !this.special);
        } else {
            const alpha = !frames.GetAnimateTransparencies(frame);
            const nextAlpha = !next.GetAnimateTransparencies(nextFrame);
            const colours = !frames.getAnimateColours(frame);
            const nextColours = !next.getAnimateColours(nextFrame);
            result = requireNonNull(source).CopyForAnimActor(alpha && nextAlpha, colours && nextColours, !this.special);
        }
        if (this.special && GlRenderer.active) {
            if (angle !== 0) {
                if (!(result instanceof GlModel)) throw new TypeError('ClassCastException: not a GlModel');
                if (angle === 1) result.rotate270WithNormals();
                else if (angle === 2) result.rotate180WithNormals();
                else result.rotate90WithNormals();
            }
        } else if (angle === 1) result.Rotate270();
        else if (angle === 2) result.Rotate180();
        else if (angle === 3) result.Rotate90();
        result.Animate(frames, frame, next, nextFrame, (cycle - 1) | 0, delay, this.special);
        if (this.special && GlRenderer.active) {
            if (angle !== 0) {
                if (!(result instanceof GlModel)) throw new TypeError('ClassCastException: not a GlModel');
                if (angle === 1) result.rotate90WithNormals();
                else if (angle === 2) result.rotate180WithNormals();
                else result.rotate270WithNormals();
            }
        } else if (angle === 1) result.Rotate90();
        else if (angle === 2) result.Rotate180();
        else if (angle === 3) result.Rotate270();
        return result;
    }

    // ek.a(IILnd;II)Lnd; (NXT AnimateModelWithExtra: IfType::GetTempModel calls it, as aj does here)
    // var1 = frame, var2 = next frame, var3 = model, var5 = cycle. Also applies the opcode-12 extra frame
    // chatFrames[var1] (65535 = none) on top, tweened toward chatFrames[var2]. var2 is the next frame's masked file id
    // by then when the tween branch ran, as in the bytecode. Stripped: the int dummy var4. All five callers (aj, ja, kl
    // and cl twice) pass sipush -20002, so the guard `if (var4 != -20002) this.b(-31)` is dead, var4 ^ -20095 is gb.a's
    // dummy 95 and var4 + 20003 is hf.a(II)Z's dummy 1.
    AnimateModelWithExtra(var1: number, var2: number, var3: ModelLit | null, var5: number): ModelLit {
        let var6: number;
        let var7: number;
        if (glJar) {
            // tk.a(Lak;BIII)Lak; reads the packed frame before its duration.
            var7 = arrayAtI32(this.frames, var1);
            var6 = arrayAtI32(this.delays, var1);
        } else {
            var6 = arrayAtI32(this.delays, var1);
            var7 = arrayAtI32(this.frames, var1);
        }
        const var8 = AnimFrameSet.get(var7 >> 16);
        var7 &= 65535;
        if (var8 === null) {
            return requireNonNull(var3).CopyForAnimActor(true, true, true);
        }

        let var10: AnimFrameSet | null = null;
        let var9: AnimFrameSet | null = null;
        let var11: AnimFrameSet | null = null;
        if ((this.tween || SeqType.forceTween) && var2 !== -1 && var2 < requireNonNull(this.frames).length) {
            var2 = arrayAtI32(this.frames, var2);
            var9 = AnimFrameSet.get(var2 >> 16);
            var2 &= 65535;
        }

        let var12 = 0;
        let var13 = 0;
        if (this.chatFrames !== null) {
            if (var1 < this.chatFrames.length) {
                var12 = arrayAtI32(this.chatFrames, var1);
                if (var12 !== 65535) {
                    var10 = AnimFrameSet.get(var12 >> 16);
                    var12 &= 65535;
                }
            }

            if ((this.tween || SeqType.forceTween) && var2 !== -1 && this.chatFrames.length > var2) {
                var13 = arrayAtI32(this.chatFrames, var2);
                if (var13 !== 65535) {
                    var11 = AnimFrameSet.get(var13 >> 16);
                    var13 &= 65535;
                }
            }
        }

        // `var14 &= !f()` is written `var14 = !f() && var14`: f always runs.
        let var14 = !var8.GetAnimateTransparencies(var7);
        let var15 = !var8.getAnimateColours(var7);
        if (var10 !== null) {
            var14 = !var10.GetAnimateTransparencies(var12) && var14;
            var15 = !var10.getAnimateColours(var12) && var15;
        }

        if (var9 !== null) {
            var14 = !var9.GetAnimateTransparencies(var2) && var14;
            var15 = !var9.getAnimateColours(var2) && var15;
        }

        if (var11 !== null) {
            var14 = !var11.GetAnimateTransparencies(var13) && var14;
            var15 = !var11.getAnimateColours(var13) && var15;
        }

        const var16 = requireNonNull(var3).CopyForAnimActor(var14, var15, !this.special);
        var16.Animate(var8, var7, var9, var2, (var5 - 1) | 0, var6, this.special);
        if (var10 !== null) {
            var16.Animate(var10, var12, var11, var13, (-1 + var5) | 0, var6, this.special);
        }

        return var16;
    }

    // ek.b(IILnd;II)Lnd; (NXT AnimateModel: SpotType::GetTempModel calls it, as li does here)
    // var2 = cycle, var3 = model, var4 = frame, var5 = next frame. Stripped: the int dummy var1. Its only caller,
    // li.a(IBII)Lnd; at 0xe8, passes bipush 91, so the guard `if (var1 <= 34) this.r = -120` is dead.
    AnimateModel(var2: number, var3: ModelLit | null, var4: number, var5: number): ModelLit {
        const var6 = arrayAtI32(this.delays, var4);
        var4 = arrayAtI32(this.frames, var4);
        const var7 = AnimFrameSet.get(var4 >> 16);
        var4 &= 65535;
        if (var7 === null) {
            return requireNonNull(var3).CopyForAnimSpot(true, true, true);
        }

        let var8: AnimFrameSet | null = null;
        if ((this.tween || SeqType.forceTween) && var5 !== -1 && var5 < requireNonNull(this.frames).length) {
            var5 = arrayAtI32(this.frames, var5);
            var8 = AnimFrameSet.get(var5 >> 16);
            var5 &= 65535;
        }

        let var9: ModelLit;
        if (var8 === null) {
            const trans1 = !var7.GetAnimateTransparencies(var4);
            const colours1 = !var7.getAnimateColours(var4);
            var9 = requireNonNull(var3).CopyForAnimSpot(trans1, colours1, !this.special);
        } else {
            const trans1 = !var7.GetAnimateTransparencies(var4);
            const trans2 = !var8.GetAnimateTransparencies(var5);
            const colours1 = !var7.getAnimateColours(var4);
            const colours2 = !var8.getAnimateColours(var5);
            var9 = requireNonNull(var3).CopyForAnimSpot(trans1 && trans2, colours1 && colours2, !this.special);
        }

        var9.Animate(var7, var4, var8, var5, (var2 - 1) | 0, var6, this.special);
        return var9;
    }
}
