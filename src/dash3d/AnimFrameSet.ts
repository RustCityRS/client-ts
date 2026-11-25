import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type Js5 from '#/cache/Js5';
import LRUHashCache from '#/datastruct/LRUHashCache';
import SecondaryNode from '#/datastruct/SecondaryNode';
import SharedPtrList from '#/datastruct/SharedPtrList';
import { byteAt } from '#/io/JavaByteArray';
import { JavaError } from '#/util/ClientError';
import { arrayAtI32, arrayAtObj, arrayPutObj, requireNonNull } from '#/util/JavaArray';
import AnimBase from './AnimBase';
import AnimFrame from './AnimFrame';
import Pix2DClass from '#/graphics/Pix2D';
import { loadClient, loadCookieStatics, loadLocalisedText, loadTitleFlames } from '#/util/GamepackClasses';

// hf in the revision 530 SD gamepack (NXT jag::oldscape::dash3d::AnimFrameSet): the frames of one group of the frames
// archive (frame id = group << 16 | file). Each frame file starts with its base id; frames sharing a base share one
// AnimBase, read from the bases archive. AnimFrameSet.get caches whole sets by group.
//
// The frameset cache, the two archives and the lookup are statics of gl/ef/uk/gb in the jar, placed here by the member
// map. NXT folds the cache and lookup into SeqType::Get / m_framesetCache; they stay on AnimFrameSet in this port.
// SeqType.Init (hf.a(Lal;Lal;ILal;)V) is the only live writer of basesArchive (= bc.c, archive 1) and framesArchive
// (= uh.O, archive 0). The other writers are unload artifacts and a dead dummy guard: uk.a(I)V and ef.c(B)V null the
// archives, gl.b(B)V nulls the cache (so `cache` is readonly here), and ef.a(ILt;I)V has the dead guard.
//
// Stripped: the invocation counters (hf.F, hf.J, gb.q, bh.j), the od.a RuntimeException wrappers, the client.wb
// opaque-predicate arms (dead loop copies and gotos), and these dummy arguments with their guards:
// - hf.a(II)Z: the first argument is always 1 (iconst_1, or the caller's dummy -20002 + 20003); guard `!= 1 -> hf.B = -45`.
// - hf.a(BI)Z: every caller passes a constant byte with (b - 45) / 34 != 0; the `-96 / ((b - 45) / 34)` never throws.
// - gb.a(II)Lhf;: every caller passes 82..126 (or the caller's dummy ^ -20095 = 95); guard `< 81 -> return null`.
// - bh.a(Lal;ZLal;II)Lhf;: its only caller gb.a passes -128; guard `>= -113 -> bh.k = null`.
// The boolean of Load and the constructor is kept: it picks the bases file layout (group = base id, file 0, or
// group 0, file = base id), as in NXT AnimFrameSet::Load/TryLoad. gb.a, the only caller of Load in the jar, always
// passes false (iconst_0). The flag is still a real parameter, not an obfuscator dummy. The obfuscated shift
// distances are written 8.
//
// Not here: hf.c(B)V (AnimFrameSet.unload) is an unload artifact: it nulls hf.D (world roofMinX) and hf.G
// (ScriptRunner arrayLengths), both homed in other classes. The other hf statics belong to other classes.
export default class AnimFrameSet extends SecondaryNode {
    // HD cl.d(I)V
    static releaseAnimFrameSetStatics(guard: number): void {
        try {
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'frenchOpenedTitleScreen');
            const TitleFlames = loadTitleFlames();
            releaseReferences(TitleFlames, 'flameLineOffset');
            releaseReferences(LocalisedText, 'englishThousandsSuffix2', 'thousandsSuffix');
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD wa stays deferred until cl.d(I)V in AnimFrameSet.releaseAnimFrameSetStatics.
            const FloType = (require('#/config/FloType') as typeof import('#/config/FloType')).default;
            releaseReferences(FloType, 'm_pConfigClient');
            const Client = loadClient();
            releaseReferences(Client, 'sceneMapUnderwaterLocFile');
            if (guard !== -29679) {
                const Pix2D = Pix2DClass;
                Pix2D.fillEllipseClipped(24, -87, 58, -76, -17, -85);
            }
            releaseReferences(LocalisedText, 'frenchChatcol11', 'thousandsSuffix2');
            const CookieStatics = loadCookieStatics();
            releaseReferences(CookieStatics, 'gmtCalendar');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'cl.B(' + guard + ')');
        }
    }

    // uk.d:Lal;
    static basesArchive: Js5 | null = null;
    // ef.K:Lal;
    static framesArchive: Js5 | null = null;
    // gl.x:Lve;
    static readonly cache: LRUHashCache<AnimFrameSet> = new LRUHashCache<AnimFrameSet>(100);

    // hf.E:[Lof;. Indexed by file id; null for ids missing from the group.
    frames: (AnimFrame | null)[];

    // hf.<init>(Lal;Lal;IZ)V
    constructor(var1: Js5 | null, var2: Js5 | null, var3: number, var4: boolean) {
        super();
        const var5 = new SharedPtrList<AnimBase>();
        const var6 = requireNonNull(var1).GetFileIdLimit(var3);
        this.frames = new Array<AnimFrame | null>(var6).fill(null);
        const var7 = requireNonNull(var1).GetFileList(var3);
        let var8 = 0;

        while (var8 < requireNonNull(var7).length) {
            const var9 = requireNonNull(var1).GetFile(arrayAtI32(var7, var8), var3);
            let var10: AnimBase | null = null;
            const var11 = ((255 & byteAt(var9, 0)) << 8) | (255 & byteAt(var9, 1));
            let var12 = var5.head();

            while (var12 !== null) {
                if (var12.id === var11) {
                    var10 = var12;
                    break;
                }

                var12 = var5.next();
            }

            if (var10 === null) {
                let var13: Uint8Array | null;
                if (!var4) {
                    var13 = requireNonNull(var2).PeekFile(var11, 0);
                } else {
                    var13 = requireNonNull(var2).PeekFile(0, var11);
                }

                var10 = new AnimBase(var11, var13);
                var5.push_back(var10);
            }

            arrayPutObj(this.frames, arrayAtI32(var7, var8), new AnimFrame(var9, var10));
            var8++;
        }
    }

    // hf.a(II)Z
    getAnimateColours(var2: number): boolean {
        return requireNonNull(arrayAtObj(this.frames, var2)).animateColours;
    }

    // hf.a(BI)Z
    GetAnimateTransparencies(var2: number): boolean {
        return requireNonNull(arrayAtObj(this.frames, var2)).animateTransparencies;
    }

    // gb.a(II)Lhf;
    static get(var1: number): AnimFrameSet | null {
        let var2 = AnimFrameSet.cache.Find(BigInt(var1));
        if (var2 !== null) {
            return var2;
        }

        var2 = AnimFrameSet.Load(AnimFrameSet.basesArchive, false, AnimFrameSet.framesArchive, var1);
        if (var2 !== null) {
            AnimFrameSet.cache.Put(BigInt(var1), var2);
        }

        return var2;
    }

    // bh.a(Lal;ZLal;II)Lhf;
    // Checks that every frame file of group var4 in var2 and the base file each one names in var0 are loaded, then
    // builds the set. new hf runs inside catch (Exception): a decode failure returns null.
    static Load(var0: Js5 | null, var1: boolean, var2: Js5 | null, var4: number): AnimFrameSet | null {
        let var5 = true;
        const var6 = requireNonNull(var2).GetFileList(var4);
        let var7 = 0;

        while (requireNonNull(var6).length > var7) {
            const var8 = requireNonNull(var2).PeekFile(var4, arrayAtI32(var6, var7));
            if (var8 === null) {
                var5 = false;
            } else {
                const var9 = ((255 & byteAt(var8, 0)) << 8) | (255 & byteAt(var8, 1));
                let var10: Uint8Array | null;
                if (!var1) {
                    var10 = requireNonNull(var0).PeekFile(var9, 0);
                } else {
                    var10 = requireNonNull(var0).PeekFile(0, var9);
                }

                if (var10 === null) {
                    var5 = false;
                }
            }

            var7++;
        }

        if (!var5) {
            return null;
        }

        try {
            return new AnimFrameSet(var2, var0, var4, var1);
        } catch (e) {
            // catch (Exception): a java.lang.Error (JavaError) escapes.
            if (!(e instanceof Error) || e instanceof JavaError) throw e;
            return null;
        }
    }
}
