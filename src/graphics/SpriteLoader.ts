import type Js5 from '#/cache/Js5';
import { glJar } from '#/client/ClientVariant';
import JagString, { fromLiteral } from '#/datastruct/JagString';
import { byteAt, putByte } from '#/io/JavaByteArray';
import PacketT from '#/io/PacketT';
import { arrayAtI32, arrayAtObj, arrayPutI32, arrayPutObj, requireNonNull } from '#/util/JavaArray';
import type AbstractIndexedSprite from './AbstractIndexedSprite';
import type AbstractSprite from './AbstractSprite';
import type PixfontGeneric from './PixfontGeneric';
import SoftwareAlphaSprite from './SoftwareAlphaSprite';
import SoftwareFont from './SoftwareFont';
import Pix8 from './Pix8';
import Pix32 from './Pix32';
import GlRenderer from '#/gl/GlRenderer';
import { loadGlAlphaSprite, loadGlSprite } from '#/util/GamepackClasses';

// tf.w (GlRenderer.active). Only the GL gamepack has the flag; with the software gamepack (glJar false) the GL modules
// are never loaded. The GL classes are required lazily because they import GlRenderer, whose module graph reaches back
// into the shared graphics classes.
function glActive(): boolean {
    return glJar && GlRenderer.active;
}

function glSprite(): typeof import('#/gl/GlSprite').default {
    return loadGlSprite();
}

function glAlphaSprite(): typeof import('#/gl/GlAlphaSprite').default {
    return loadGlAlphaSprite();
}

function glIndexedSprite(): typeof import('#/gl/GlIndexedSprite').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- HD oh stays deferred until SpriteLoader.glIndexedSprite.
    return (require('#/gl/GlIndexedSprite') as typeof import('#/gl/GlIndexedSprite')).default;
}

function glFont(): typeof import('#/gl/GlFont').default {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- HD mb stays deferred until SpriteLoader.glFont.
    return (require('#/gl/GlFont') as typeof import('#/gl/GlFont')).default;
}

// SpriteLoader: a logical class with no obfuscated counterpart. The obfuscator scattered the archive-8 sprite
// decoder over many classes. og.a decodes a group into the shared staging statics (count, canvas size, offsets,
// sizes, palette, index and alpha planes). The builders turn the staged frames into rh/vh/ch sprites or an fg
// font, then call mk.c, which drops six of the staging arrays (c.v and tb.d stay). The loaders fetch a file with ja.a
// or hl.a and then call a builder. Also kept here: the archive-8 group ids that ld.a looks up and the HUD sprite arrays
// that the stage-80 loader uf.a fills.
// There are no instance members or constructor. Stripped: invocation counters, dummy parameters and their guard
// branches (call-site constants are given on each method), od.a wrappers and client.wb opaque branches.
export default class SpriteLoader {
    // lc.q:I
    static count = 0;
    // c.v:[Z
    static hasAlpha: boolean[] | null = null;
    // ff.s:[I
    static yOffsets: Int32Array | null = null;
    // jh.l:[I
    static widths: Int32Array | null = null;
    // tb.d:[[B
    static alphas: (Uint8Array | null)[] | null = null;
    // vg.hb:[[B
    static pixels: (Uint8Array | null)[] | null = null;
    // df.H:[I
    static innerHeights: Int32Array | null = null;
    // qj.B:[I
    static xOffsets: Int32Array | null = null;
    // ad.g:I
    static canvasWidth = 0;
    // lh.g:I
    static height = 0;
    // ke.m:[I
    static palette: Int32Array | null = null;

    // di.l:I
    static headiconsPkId = 0;
    // ef.w:I
    static hitmarksId = 0;
    // gg.E:I
    static mapdotsGroupId = 0;
    // mi.D:I
    static compassId = 0;
    // mj.a:I
    static floorShadowsId = 0;

    // di.c:Lid;
    static readonly mapdotsName: JagString = fromLiteral('mapdots');
    // ed.n:Lid;
    static readonly compassName: JagString = fromLiteral('compass');
    // gi.l:Lid;
    static readonly hitbarDefaultName: JagString = fromLiteral('hitbar_default');
    // me.k:Lid;
    static readonly mapflagName: JagString = fromLiteral('mapflag');

    // di.m:[Lvc;
    static cross: (AbstractSprite | null)[] | null = null;
    // gf.cb:[Lvc;
    static hintMapEdge: (AbstractSprite | null)[] | null = null;
    // gg.H:[Lvc;
    static hitbarDefault: (AbstractSprite | null)[] | null = null;
    // gh.N:[Lvc;
    static mapfunctionsRecoloured: (AbstractSprite | null)[] | null = null;
    // me.L:[Lsi;
    static scrollbars: (AbstractIndexedSprite | null)[] | null = null;

    // og.a(B[B)V (dummy byte stripped with its `< 25` guard; hl.a passes 50, ja.a passes 55)
    static decode(data: Uint8Array | null): void {
        const packet = new PacketT(data);
        packet.m_pos = (requireNonNull(data).length - 2) | 0;
        SpriteLoader.count = packet.g2();
        SpriteLoader.hasAlpha = new Array<boolean>(SpriteLoader.count).fill(false);
        SpriteLoader.yOffsets = new Int32Array(SpriteLoader.count);
        SpriteLoader.widths = new Int32Array(SpriteLoader.count);
        SpriteLoader.alphas = new Array<Uint8Array | null>(SpriteLoader.count).fill(null);
        SpriteLoader.pixels = new Array<Uint8Array | null>(SpriteLoader.count).fill(null);
        SpriteLoader.innerHeights = new Int32Array(SpriteLoader.count);
        SpriteLoader.xOffsets = new Int32Array(SpriteLoader.count);
        packet.m_pos = (-Math.imul(SpriteLoader.count, 8) + requireNonNull(data).length - 7) | 0;
        SpriteLoader.canvasWidth = packet.g2();
        SpriteLoader.height = packet.g2();
        const paletteSize = ((packet.g1() & 255) + 1) | 0;
        for (let i = 0; i < SpriteLoader.count; i++) {
            arrayPutI32(SpriteLoader.xOffsets, i, packet.g2());
        }
        for (let i = 0; SpriteLoader.count > i; i++) {
            arrayPutI32(SpriteLoader.yOffsets, i, packet.g2());
        }
        for (let i = 0; SpriteLoader.count > i; i++) {
            arrayPutI32(SpriteLoader.widths, i, packet.g2());
        }
        for (let i = 0; i < SpriteLoader.count; i++) {
            arrayPutI32(SpriteLoader.innerHeights, i, packet.g2());
        }
        packet.m_pos = (3 - Math.imul(paletteSize, 3) + (-Math.imul(8, SpriteLoader.count) + (requireNonNull(data).length - 7))) | 0;
        SpriteLoader.palette = new Int32Array(paletteSize);
        for (let i = 1; i < paletteSize; i++) {
            arrayPutI32(SpriteLoader.palette, i, packet.g3());
            if (arrayAtI32(SpriteLoader.palette, i) === 0) {
                arrayPutI32(SpriteLoader.palette, i, 1);
            }
        }
        packet.m_pos = 0;
        for (let i = 0; SpriteLoader.count > i; i++) {
            const width = arrayAtI32(SpriteLoader.widths, i);
            const height = arrayAtI32(SpriteLoader.innerHeights, i);
            const len = Math.imul(height, width);
            const pixels = new Uint8Array(len);
            arrayPutObj(SpriteLoader.pixels, i, pixels);
            const alphas = new Uint8Array(len);
            arrayPutObj(SpriteLoader.alphas, i, alphas);
            const flags = packet.g1();
            let hasAlpha = false;
            if ((flags & 1) === 0) {
                for (let j = 0; j < len; j++) {
                    pixels[j] = packet.g1s();
                }
                if ((2 & flags) !== 0) {
                    for (let j = 0; j < len; j++) {
                        const alpha = packet.g1s();
                        alphas[j] = alpha;
                        hasAlpha = hasAlpha || alpha !== -1;
                    }
                }
            } else {
                for (let x = 0; x < width; x++) {
                    for (let y = 0; height > y; y++) {
                        putByte(pixels, (x + Math.imul(width, y)) | 0, packet.g1s());
                    }
                }
                if ((2 & flags) !== 0) {
                    for (let x = 0; width > x; x++) {
                        for (let y = 0; y < height; y++) {
                            const index = (x + Math.imul(width, y)) | 0;
                            const alpha = packet.g1s();
                            putByte(alphas, index, alpha);
                            hasAlpha = hasAlpha || alpha !== -1;
                        }
                    }
                }
            }
            arrayPutObj(SpriteLoader.hasAlpha, i, hasAlpha);
        }
    }

    // mk.c(Z)V (dummy false stripped with its `!= false` guard that called mk.a(ILid;)V; all eleven callers pass false)
    static clear(): void {
        // HD g.a(B)V releases the same six arrays in a different order.
        if (glJar) {
            SpriteLoader.widths = null;
            SpriteLoader.yOffsets = null;
            SpriteLoader.innerHeights = null;
            SpriteLoader.pixels = null;
            SpriteLoader.xOffsets = null;
            SpriteLoader.palette = null;
            return;
        }
        SpriteLoader.pixels = null;
        SpriteLoader.xOffsets = null;
        SpriteLoader.widths = null;
        SpriteLoader.palette = null;
        SpriteLoader.innerHeights = null;
        SpriteLoader.yOffsets = null;
    }

    // Dummy byte stripped with its `44 % ((b - 24) / 40)` guard: callers pass -26, -77, 79, -86, 122, -72, 77 and -119,
    // none of which divides by zero.
    // ja.a(BIILal;)Z
    static load(file: number, group: number, archive: Js5 | null): boolean {
        const data = requireNonNull(archive).GetFile(file, group);
        if (data === null) {
            return false;
        }
        SpriteLoader.decode(data);
        return true;
    }

    // Dummy int stripped with its `-106 / ((i + 43) / 44)` guard: callers pass 101, -116, 58 and 104, none of which
    // divides by zero.
    // hl.a(Lal;II)Z
    static loadGroup(archive: Js5 | null, id: number): boolean {
        const data = requireNonNull(archive).GetFile2(id);
        if (data === null) {
            return false;
        }
        SpriteLoader.decode(data);
        return true;
    }

    // df.d(B)Lrh; (dummy byte stripped with its `< 9` guard; callers pass 73 and 125)
    static toSoftwareSprite(): Pix32 {
        const indices = arrayAtObj(SpriteLoader.pixels, 0);
        const len = Math.imul(arrayAtI32(SpriteLoader.widths, 0), arrayAtI32(SpriteLoader.innerHeights, 0));
        const argb = new Int32Array(len);
        for (let i = 0; len > i; i++) {
            argb[i] = arrayAtI32(SpriteLoader.palette, 255 & ((byteAt(indices, i) << 24) >> 24));
        }
        const sprite = new Pix32(SpriteLoader.canvasWidth, SpriteLoader.height, arrayAtI32(SpriteLoader.xOffsets, 0), arrayAtI32(SpriteLoader.yOffsets, 0), arrayAtI32(SpriteLoader.widths, 0), arrayAtI32(SpriteLoader.innerHeights, 0), argb);
        SpriteLoader.clear();
        return sprite;
    }

    // ed.a(I)[Lrh; (dummy 17100 stripped with its early `return null` guard)
    static toSoftwareSprites(): (Pix32 | null)[] {
        const sprites = new Array<Pix32 | null>(SpriteLoader.count).fill(null);
        for (let i = 0; i < SpriteLoader.count; i++) {
            const indices = arrayAtObj(SpriteLoader.pixels, i);
            const len = Math.imul(arrayAtI32(SpriteLoader.innerHeights, i), arrayAtI32(SpriteLoader.widths, i));
            const argb = new Int32Array(len);
            for (let j = 0; j < len; j++) {
                argb[j] = arrayAtI32(SpriteLoader.palette, ((byteAt(indices, j) << 24) >> 24) & 255);
            }
            arrayPutObj(
                sprites,
                i,
                new Pix32(SpriteLoader.canvasWidth, SpriteLoader.height, arrayAtI32(SpriteLoader.xOffsets, i), arrayAtI32(SpriteLoader.yOffsets, i), arrayAtI32(SpriteLoader.widths, i), arrayAtI32(SpriteLoader.innerHeights, i), argb)
            );
        }
        SpriteLoader.clear();
        return sprites;
    }

    // SD oc.a(B)[Lvc; / HD cj.a(I)[Lqf;. SD: dummy -62 stripped with its `return null` guard. HD: dummy -5 (its loader
    // passes -1 ^ 4) stripped with its `!= -5` guard that called cj.a(JB)Lna;. HD builds a cf (GlSprite) in place of
    // the mm (Pix32) while tf.w is set; the TS name follows the software build.
    static createSoftwareSprites(): (AbstractSprite | null)[] {
        const sprites = new Array<AbstractSprite | null>(SpriteLoader.count).fill(null);
        for (let i = 0; i < SpriteLoader.count; i++) {
            const len = glJar ? Math.imul(arrayAtI32(SpriteLoader.widths, i), arrayAtI32(SpriteLoader.innerHeights, i)) : Math.imul(arrayAtI32(SpriteLoader.innerHeights, i), arrayAtI32(SpriteLoader.widths, i));
            const indices = arrayAtObj(SpriteLoader.pixels, i);
            const argb = new Int32Array(len);
            for (let j = 0; len > j; j++) {
                argb[j] = arrayAtI32(SpriteLoader.palette, 255 & ((byteAt(indices, j) << 24) >> 24));
            }
            arrayPutObj(
                sprites,
                i,
                !glActive()
                    ? new Pix32(SpriteLoader.canvasWidth, SpriteLoader.height, arrayAtI32(SpriteLoader.xOffsets, i), arrayAtI32(SpriteLoader.yOffsets, i), arrayAtI32(SpriteLoader.widths, i), arrayAtI32(SpriteLoader.innerHeights, i), argb)
                    : new (glSprite())(SpriteLoader.canvasWidth, SpriteLoader.height, arrayAtI32(SpriteLoader.xOffsets, i), arrayAtI32(SpriteLoader.yOffsets, i), arrayAtI32(SpriteLoader.widths, i), arrayAtI32(SpriteLoader.innerHeights, i), argb)
            );
        }
        SpriteLoader.clear();
        return sprites;
    }

    // SD p.a(B)[Lvc; / HD re.b(I)[Lqf;. The SD caller passes -10. HD builds an el (GlAlphaSprite) in place of the am (SoftwareAlphaSprite)
    // and a cf (GlSprite) in place of the mm (Pix32) while tf.w is set.
    static createSprites(): (AbstractSprite | null)[];
    static createSprites(hdGuard: number): (AbstractSprite | null)[] | null;
    static createSprites(hdGuard = -26802): (AbstractSprite | null)[] | null {
        if (hdGuard !== -26802) return null;
        const sprites = new Array<AbstractSprite | null>(SpriteLoader.count).fill(null);
        for (let i = 0; i < SpriteLoader.count; i++) {
            let len = 0;
            if (!glJar) len = Math.imul(arrayAtI32(SpriteLoader.innerHeights, i), arrayAtI32(SpriteLoader.widths, i));
            const indices = arrayAtObj(SpriteLoader.pixels, i);
            if (glJar) len = Math.imul(arrayAtI32(SpriteLoader.innerHeights, i), arrayAtI32(SpriteLoader.widths, i));
            if (!arrayAtObj(SpriteLoader.hasAlpha, i)) {
                const argb = new Int32Array(len);
                for (let j = 0; j < len; j++) {
                    argb[j] = arrayAtI32(SpriteLoader.palette, ((byteAt(indices, j) << 24) >> 24) & 255);
                }
                arrayPutObj(
                    sprites,
                    i,
                    glActive()
                        ? new (glSprite())(SpriteLoader.canvasWidth, SpriteLoader.height, arrayAtI32(SpriteLoader.xOffsets, i), arrayAtI32(SpriteLoader.yOffsets, i), arrayAtI32(SpriteLoader.widths, i), arrayAtI32(SpriteLoader.innerHeights, i), argb)
                        : new Pix32(SpriteLoader.canvasWidth, SpriteLoader.height, arrayAtI32(SpriteLoader.xOffsets, i), arrayAtI32(SpriteLoader.yOffsets, i), arrayAtI32(SpriteLoader.widths, i), arrayAtI32(SpriteLoader.innerHeights, i), argb)
                );
            } else {
                const argb = new Int32Array(len);
                const alphas = arrayAtObj(SpriteLoader.alphas, i);
                if (glJar) {
                    for (let j = 0; j < len; j++) {
                        argb[j] = arrayAtI32(SpriteLoader.palette, byteAt(indices, j) & 255) | (byteAt(alphas, j) << 24);
                    }
                } else {
                    for (let j = 0; j < len; j++) {
                        argb[j] = (byteAt(alphas, j) << 24) | arrayAtI32(SpriteLoader.palette, byteAt(indices, j) & 255);
                    }
                }
                if (!glActive()) {
                    arrayPutObj(
                        sprites,
                        i,
                        new SoftwareAlphaSprite(
                            SpriteLoader.canvasWidth,
                            SpriteLoader.height,
                            arrayAtI32(SpriteLoader.xOffsets, i),
                            arrayAtI32(SpriteLoader.yOffsets, i),
                            arrayAtI32(SpriteLoader.widths, i),
                            arrayAtI32(SpriteLoader.innerHeights, i),
                            argb
                        )
                    );
                } else {
                    arrayPutObj(
                        sprites,
                        i,
                        new (glAlphaSprite())(
                            SpriteLoader.canvasWidth,
                            SpriteLoader.height,
                            arrayAtI32(SpriteLoader.xOffsets, i),
                            arrayAtI32(SpriteLoader.yOffsets, i),
                            arrayAtI32(SpriteLoader.widths, i),
                            arrayAtI32(SpriteLoader.innerHeights, i),
                            argb
                        )
                    );
                }
            }
        }
        SpriteLoader.clear();
        return sprites;
    }

    // pk.b(I)Lrh; (dummy 255 stripped with its `return null` guard, which ran after the first two reads below)
    static toSprite(): Pix32 {
        const indices = arrayAtObj(SpriteLoader.pixels, 0);
        const len = Math.imul(arrayAtI32(SpriteLoader.innerHeights, 0), arrayAtI32(SpriteLoader.widths, 0));
        let sprite: Pix32;
        if (!arrayAtObj(SpriteLoader.hasAlpha, 0)) {
            const argb = new Int32Array(len);
            for (let i = 0; i < len; i++) {
                argb[i] = arrayAtI32(SpriteLoader.palette, ((byteAt(indices, i) << 24) >> 24) & 255);
            }
            sprite = new Pix32(SpriteLoader.canvasWidth, SpriteLoader.height, arrayAtI32(SpriteLoader.xOffsets, 0), arrayAtI32(SpriteLoader.yOffsets, 0), arrayAtI32(SpriteLoader.widths, 0), arrayAtI32(SpriteLoader.innerHeights, 0), argb);
        } else {
            const argb = new Int32Array(len);
            const alphas = arrayAtObj(SpriteLoader.alphas, 0);
            for (let i = 0; len > i; i++) {
                argb[i] = arrayAtI32(SpriteLoader.palette, ((byteAt(indices, i) << 24) >> 24) & 255) | ((((byteAt(alphas, i) << 24) >> 24) & 255) << 24);
            }
            sprite = new SoftwareAlphaSprite(
                SpriteLoader.canvasWidth,
                SpriteLoader.height,
                arrayAtI32(SpriteLoader.xOffsets, 0),
                arrayAtI32(SpriteLoader.yOffsets, 0),
                arrayAtI32(SpriteLoader.widths, 0),
                arrayAtI32(SpriteLoader.innerHeights, 0),
                argb
            );
        }
        SpriteLoader.clear();
        return sprite;
    }

    // SD ud.a(B)Lvc; / HD gi.b(I)Lqf;. SD: dummy 57 stripped with its self-call guard; both callers pass 57. HD: dummy
    // stripped with its `< 70` self-call guard; the callers pass 99 and -18 + 103. HD builds a cf (GlSprite) in place of
    // the mm (Pix32) while tf.w is set.
    static createSprite(): AbstractSprite {
        let len = 0;
        if (!glJar) len = Math.imul(arrayAtI32(SpriteLoader.widths, 0), arrayAtI32(SpriteLoader.innerHeights, 0));
        const indices = arrayAtObj(SpriteLoader.pixels, 0);
        if (glJar) len = Math.imul(arrayAtI32(SpriteLoader.widths, 0), arrayAtI32(SpriteLoader.innerHeights, 0));
        const argb = new Int32Array(len);
        for (let i = 0; i < len; i++) {
            argb[i] = arrayAtI32(SpriteLoader.palette, 255 & ((byteAt(indices, i) << 24) >> 24));
        }
        const sprite: AbstractSprite = !glActive()
            ? new Pix32(SpriteLoader.canvasWidth, SpriteLoader.height, arrayAtI32(SpriteLoader.xOffsets, 0), arrayAtI32(SpriteLoader.yOffsets, 0), arrayAtI32(SpriteLoader.widths, 0), arrayAtI32(SpriteLoader.innerHeights, 0), argb)
            : new (glSprite())(SpriteLoader.canvasWidth, SpriteLoader.height, arrayAtI32(SpriteLoader.xOffsets, 0), arrayAtI32(SpriteLoader.yOffsets, 0), arrayAtI32(SpriteLoader.widths, 0), arrayAtI32(SpriteLoader.innerHeights, 0), argb);
        SpriteLoader.clear();
        return sprite;
    }

    // SD qd.b(I)[Lsi; / HD ui.h(I)[Lok;. SD: dummy 86 stripped with its self-call guard `< 8`. HD: dummy 1854847236
    // stripped with its `!= 1854847236 -> ui.ab = null` guard after the loop. HD builds an oh (GlIndexedSprite) in
    // place of the ek (Pix8) while tf.w is set.
    static toIndexedSprites(): (AbstractIndexedSprite | null)[] {
        const sprites = new Array<AbstractIndexedSprite | null>(SpriteLoader.count).fill(null);
        for (let i = 0; i < SpriteLoader.count; i++) {
            if (!glActive()) {
                arrayPutObj(
                    sprites,
                    i,
                    new Pix8(
                        SpriteLoader.canvasWidth,
                        SpriteLoader.height,
                        arrayAtI32(SpriteLoader.xOffsets, i),
                        arrayAtI32(SpriteLoader.yOffsets, i),
                        arrayAtI32(SpriteLoader.widths, i),
                        arrayAtI32(SpriteLoader.innerHeights, i),
                        arrayAtObj(SpriteLoader.pixels, i),
                        SpriteLoader.palette
                    )
                );
            } else {
                arrayPutObj(
                    sprites,
                    i,
                    new (glIndexedSprite())(
                        SpriteLoader.canvasWidth,
                        SpriteLoader.height,
                        arrayAtI32(SpriteLoader.xOffsets, i),
                        arrayAtI32(SpriteLoader.yOffsets, i),
                        arrayAtI32(SpriteLoader.widths, i),
                        arrayAtI32(SpriteLoader.innerHeights, i),
                        arrayAtObj(SpriteLoader.pixels, i),
                        SpriteLoader.palette
                    )
                );
            }
        }
        SpriteLoader.clear();
        return sprites;
    }

    // vi.e(I)[Lch; (dummy 74 stripped with its `<= 18` guard that called vi.c(II)V; lc.a passes 74)
    static createIndexedSprites(): (Pix8 | null)[] {
        const sprites = new Array<Pix8 | null>(SpriteLoader.count).fill(null);
        for (let i = 0; SpriteLoader.count > i; i++) {
            arrayPutObj(
                sprites,
                i,
                new Pix8(
                    SpriteLoader.canvasWidth,
                    SpriteLoader.height,
                    arrayAtI32(SpriteLoader.xOffsets, i),
                    arrayAtI32(SpriteLoader.yOffsets, i),
                    arrayAtI32(SpriteLoader.widths, i),
                    arrayAtI32(SpriteLoader.innerHeights, i),
                    arrayAtObj(SpriteLoader.pixels, i),
                    SpriteLoader.palette
                )
            );
        }
        SpriteLoader.clear();
        return sprites;
    }

    // SD rk.b(B)Lsi; / HD wh.b(B)Lok;. SD: dummy 120 stripped with its `<= 118` guard. HD: dummy -40 stripped with its
    // `!= -40 -> wh.a(83)` guard after the construction. HD builds an oh (GlIndexedSprite) in place of the ek (Pix8)
    // while tf.w is set.
    static createIndexedSprite(): AbstractIndexedSprite {
        let sprite: AbstractIndexedSprite;
        if (glActive()) {
            sprite = new (glIndexedSprite())(
                SpriteLoader.canvasWidth,
                SpriteLoader.height,
                arrayAtI32(SpriteLoader.xOffsets, 0),
                arrayAtI32(SpriteLoader.yOffsets, 0),
                arrayAtI32(SpriteLoader.widths, 0),
                arrayAtI32(SpriteLoader.innerHeights, 0),
                arrayAtObj(SpriteLoader.pixels, 0),
                SpriteLoader.palette
            );
        } else {
            sprite = new Pix8(
                SpriteLoader.canvasWidth,
                SpriteLoader.height,
                arrayAtI32(SpriteLoader.xOffsets, 0),
                arrayAtI32(SpriteLoader.yOffsets, 0),
                arrayAtI32(SpriteLoader.widths, 0),
                arrayAtI32(SpriteLoader.innerHeights, 0),
                arrayAtObj(SpriteLoader.pixels, 0),
                SpriteLoader.palette
            );
        }
        SpriteLoader.clear();
        return sprite;
    }

    // The int is not a dummy: it indexes df.H while every other array uses frame 0. The one caller, qc.a, passes 0.
    // uk.b(I)Lch;
    static createIndexedSprite2(heightIndex: number): Pix8 {
        const sprite = new Pix8(
            SpriteLoader.canvasWidth,
            SpriteLoader.height,
            arrayAtI32(SpriteLoader.xOffsets, 0),
            arrayAtI32(SpriteLoader.yOffsets, 0),
            arrayAtI32(SpriteLoader.widths, 0),
            arrayAtI32(SpriteLoader.innerHeights, heightIndex),
            arrayAtObj(SpriteLoader.pixels, 0),
            SpriteLoader.palette
        );
        SpriteLoader.clear();
        return sprite;
    }

    // SD tf.a([BI)Lmb; / HD ce.a(I[B)Lrk;. SD: dummy 174 stripped with its `!= 174` guard. HD: dummy -22376 stripped
    // with its `!= -22376` `return null` after the null test. HD builds an mb (GlFont) in place of the dd (SoftwareFont)
    // while tf.w is set.
    static createFont(data: Uint8Array | null): PixfontGeneric | null {
        if (data === null) {
            return null;
        }
        const font: PixfontGeneric = !glActive()
            ? new SoftwareFont(data, SpriteLoader.xOffsets, SpriteLoader.yOffsets, SpriteLoader.widths, SpriteLoader.innerHeights, SpriteLoader.pixels)
            : new (glFont())(data, SpriteLoader.xOffsets, SpriteLoader.yOffsets, SpriteLoader.widths, SpriteLoader.innerHeights, SpriteLoader.pixels);
        SpriteLoader.clear();
        return font;
    }

    // fa.a(ILal;II)Lrh; (dummy var0 stripped with its `var0 > -117` return-null guard: the callers pass -119, -121
    // and -123). Always a plain rh (df.d), unlike gi.a below.
    static loadSoftwareSprite(archive: Js5 | null, group: number, file: number): Pix32 | null {
        if (!SpriteLoader.load(file, group, archive)) {
            return null;
        }

        return SpriteLoader.toSoftwareSprite();
    }

    // sb.a(Lal;IIILal;)Lmb; (dummy int, always 0, and its guard stripped)
    static loadFont(sprites: Js5 | null, group: number, file: number, metrics: Js5 | null): PixfontGeneric | null {
        if (!SpriteLoader.load(file, group, sprites)) {
            return null;
        }

        return SpriteLoader.createFont(requireNonNull(metrics).GetFile(file, group));
    }

    // gi.a(ILal;ZI)Lrh; (dummy false stripped with its early `return null` guard; all seven callers pass false).
    // pk.b builds a vh (SoftwareAlphaSprite) when the alpha flag is set, otherwise an rh.
    static loadSoftwareSpriteWithAlpha(file: number, archive: Js5 | null, group: number): Pix32 | null {
        if (!SpriteLoader.load(file, group, archive)) {
            return null;
        }
        return SpriteLoader.toSprite();
    }

    // ha.a(ZILal;I)[Lrh; (dummy true stripped with its `!= true` guard that called ha.a(B)I; both callers pass true)
    static loadSoftwareSprites(group: number, archive: Js5 | null, file: number): (Pix32 | null)[] | null {
        if (!SpriteLoader.load(file, group, archive)) {
            return null;
        }
        return SpriteLoader.toSoftwareSprites();
    }

    // ii.a(IILal;)Lrh; (dummy int stripped with its `123 % ((56 - i) / 57)` guard; la.f passes -21347 + 21293 = -54)
    static loadSprite(id: number, archive: Js5 | null): Pix32 | null {
        if (!SpriteLoader.loadGroup(archive, id)) {
            return null;
        }
        return SpriteLoader.toSoftwareSprite();
    }

    // lc.a(Lal;II)[Lch; (dummy -110 stripped with its `> -96` guard; od.a passes -110)
    static loadIndexedSprites(archive: Js5 | null, id: number): (Pix8 | null)[] | null {
        if (!SpriteLoader.loadGroup(archive, id)) {
            return null;
        }
        return SpriteLoader.createIndexedSprites();
    }

    // ml.a(Lal;III)Lvc; (dummy -13886 stripped with its `!= -13886` guard; both callers pass -13886)
    static loadSprite2(archive: Js5 | null, group: number, file: number): AbstractSprite | null {
        if (!SpriteLoader.load(file, group, archive)) {
            return null;
        }
        return SpriteLoader.createSprite();
    }

    // Dummy 2048 stripped with its `return null` guard: all seven callers pass 2048 (uf.a as -7058 + 9106).
    // nh.a(ILal;II)[Lvc;
    static loadSprites(group: number, archive: Js5 | null, file: number): (AbstractSprite | null)[] | null {
        if (!SpriteLoader.load(file, group, archive)) {
            return null;
        }
        return SpriteLoader.createSprites();
    }

    // oh.a(ILal;BI)[Lvc; (dummy byte stripped with its `< 43` guard that called oh.a(I)V; callers pass 75 and 70)
    static loadSprites2(file: number, archive: Js5 | null, group: number): (AbstractSprite | null)[] | null {
        if (!SpriteLoader.load(file, group, archive)) {
            return null;
        }
        return SpriteLoader.createSoftwareSprites();
    }

    // qc.a(ILal;II)Lch; (dummy 3576 stripped with its `!= 3576` guard; both callers pass 3576)
    static loadIndexedSprite(group: number, archive: Js5 | null, file: number): Pix8 | null {
        if (!SpriteLoader.load(file, group, archive)) {
            return null;
        }
        return SpriteLoader.createIndexedSprite2(0);
    }

    // sj.a(IBLal;)Lvc; (dummy byte stripped with its `<= 96` guard; the caller passes 113)
    static loadSprite3(id: number, archive: Js5 | null): AbstractSprite | null {
        if (!SpriteLoader.loadGroup(archive, id)) {
            return null;
        }
        return SpriteLoader.createSprite();
    }

    // u.a(ILal;I)Lsi; (dummy int stripped with its early `<= 88` guard; the caller passes 106)
    static loadIndexedSprite2(id: number, archive: Js5 | null): AbstractIndexedSprite | null {
        if (!SpriteLoader.loadGroup(archive, id)) {
            return null;
        }
        return SpriteLoader.createIndexedSprite();
    }

    // Dummy -1006411924 stripped with its early `return null` guard: uf.a passes -7058 + -1006404866.
    // wb.a(IIILal;)[Lsi;
    static loadIndexedSprites2(group: number, file: number, archive: Js5 | null): (AbstractIndexedSprite | null)[] | null {
        if (!SpriteLoader.load(file, group, archive)) {
            return null;
        }
        return SpriteLoader.toIndexedSprites();
    }

    // wh.b(Z)I (dummy true stripped with its `!= true` guard that called wh.a(Lid;B)I; client.f passes true)
    static total(): number {
        return 15;
    }
}
