import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import { glJar } from '#/client/ClientVariant';
import Linkable from '#/datastruct/Linkable';
import type Decor from './Decor';
import type Ground from './Ground';
import type GroundDecor from './GroundDecor';
import type GroundObject from './GroundObject';
import type QuickGround from './QuickGround';
import type Sprite from './Sprite';
import type Wall from './Wall';
import IntArrayPages from '#/util/IntArrayPages';
import { loadLocalisedText, loadPlayerModel } from '#/util/GamepackClasses';

// JVM int[5]. Each tile keeps an independent view. Only the current unfinished page is retained here.
const spriteSpanLength = 5;
const spriteSpanPages = new IntArrayPages(128 * spriteSpanLength);

// ra in the revision 530 SD gamepack (NXT jag::oldscape::dash3d::Square): one tile of the scene graph on one level.
// It holds the tile's ground (QuickGround or Ground), wall, wall decor, ground decor, obj stack and up to five
// sprites, plus the per-frame visibility and wall-corner state the renderer (world.Fill) keeps on it. The
// renderer queues squares on world.drawTileQueue, which is why ra extends jf (Linkable).
//
// Field names follow the rev 225 Square. None of ra's statics belong here: q and s are invocation counters, ra.a(I)V
// is a null-only unload, and r/M/Q/R/T/V/W/X/Y/Z, ra.a(ZZIZI) and ra.a(II) are placed in other classes by the
// member map.
export default class Square extends Linkable {
    // HD bj.c(I)V
    static releaseSquareStatics(guard: number): void {
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD he stays deferred until bj.c(I)V in Square.releaseSquareStatics.
            const ClientInvCache = (require('#/client/ClientInvCache') as typeof import('#/client/ClientInvCache')).default;
            releaseReferences(ClientInvCache, 'm_invList');
            if (guard !== 3353893) {
                const LocalisedText = loadLocalisedText();
                releaseReferences(LocalisedText, 'PLEASEWAIT');
            }
            const PlayerModel = loadPlayerModel();
            releaseReferences(PlayerModel, 'recolourSources2Alt');
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'germanChateffect2', 'germanLoadedConfig', 'englishPleaseWait', 'PLEASEWAIT');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'bj.A(' + guard + ')');
        }
    }

    // ra.t:I
    spriteCount = 0;
    // ra.u:Lpk;
    groundDecor: GroundDecor | null = null;
    // ra.v:I
    z: number;
    // ra.w:I
    x: number;
    // ra.x:Lkb;
    ground: Ground | null = null;
    // ra.y:Lmh;
    groundObject: GroundObject | null = null;
    // ra.z:Lhk;
    wall: Wall | null = null;
    // ra.A:[I
    // The span flags (1 west, 2 north, 4 east, 8 south) of each sprite in sprites.
    declare spriteSpan: Int32Array;
    #spanSlots: Int32Array | 0 = 0;
    static #spriteSpanField: PropertyDescriptor = {
        configurable: true,
        enumerable: true,
        get(this: Square): Int32Array {
            if (this.#spanSlots === 0) this.#spanSlots = spriteSpanPages.allocate(spriteSpanLength);
            return this.#spanSlots;
        },
        set(this: Square, value: Int32Array) {
            this.#spanSlots = value;
        }
    };
    // ra.B:Z
    drawFront = false;
    // ra.C:Lnf;
    decor: Decor | null = null;
    // ra.D:I
    cornerSides = 0;
    // ra.E:Z
    drawSprites = false;
    // ra.F:Lma;
    quickGround: QuickGround | null = null;
    // ra.G:I
    backWallTypes = 0;
    // ra.H:[Lec;
    declare sprites: (Sprite | null)[];
    #spriteSlots: (Sprite | null)[] | 0 = 0;
    static #spritesField: PropertyDescriptor = {
        configurable: true,
        enumerable: true,
        get(this: Square): (Sprite | null)[] {
            if (this.#spriteSlots === 0) this.#spriteSlots = [null, null, null, null, null];
            return this.#spriteSlots;
        },
        set(this: Square, value: (Sprite | null)[]) {
            this.#spriteSlots = value;
        }
    };
    // ra.I:I
    sidesBeforeCorner = 0;
    // ra.J:Z
    // Still to be drawn this frame (the renderer pops squares until it finds one with this set).
    drawBack = false;
    // ra.K:I
    level: number;
    // ra.L:Lra;
    linkedSquare: Square | null = null;
    // ra.N:I
    // The level the square was created on; occlusion tests use it after world.PushDown lowers level.
    originalLevel: number;
    // ra.P:I
    // The OR of spriteSpan over the current sprites.
    spriteSpans: number;
    // ra.U:I
    sidesAfterCorner = 0;

    // SD ra.<init>(III)V writes H, P, A, v, w, K, N. HD bj.<init>(III)V writes D, w, P, H, W, Q, R.
    constructor(var1: number, var2: number, var3: number) {
        super();
        // Most tiles never access these arrays. Zero represents the untouched Java array until its first read.
        // A field replacement, including Java null, takes effect even before that read.
        if (glJar) {
            this.spriteSpans = 0;
            Object.defineProperty(this, 'sprites', Square.#spritesField);
        } else {
            Object.defineProperty(this, 'sprites', Square.#spritesField);
            this.spriteSpans = 0;
        }
        Object.defineProperty(this, 'spriteSpan', Square.#spriteSpanField);
        this.z = var3;
        if (glJar) {
            this.originalLevel = this.level = var1;
            this.x = var2;
        } else {
            this.x = var2;
            this.originalLevel = this.level = var1;
        }
    }
}
