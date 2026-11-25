import { arrayAtI32, arrayAtObj } from '#/util/JavaArray';
import IntArrayPages from '#/util/IntArrayPages';

// A shaped tile retains nine or ten small int[] fields. Each gets its own
// zeroed, nonoverlapping view. A surviving view can retain at most one 4 KiB page.
const groundArrays = new IntArrayPages(1024);

// kb in the revision 530 SD gamepack (NXT jag::oldscape::dash3d::Ground): a shaped (overlay) tile. The constructor
// expands one of 13 shapes, rotated, into vertex and face tables with per-face underlay/overlay colours and an
// optional texture; world.drawTileOverlay projects the vertices into the static draw arrays below and fills the
// faces. Field names follow the rev 225 Ground.
//
// Locals keep the decompiler's varN names, so the constructor can be diffed against kb.java line by line. Int
// arithmetic is Java's: Math.imul for *, | 0 after + and -, (a / b) | 0 for the constant divisions. The obfuscator
// left kb clean (no counters, dummy arguments or wrappers).
export default class Ground {
    // kb.<clinit>()V
    // The whole static initializer: the field initializers below, in its store order (f, i, q, t, r, u, v).

    // kb.f:[I
    // Screen y of each vertex (dc.b + (y << 9) / z), written by world.drawTileOverlay.
    static drawVertexY: Int32Array | null = new Int32Array(6);
    // kb.i:[[I
    // Per shape, four entries per face: colour select (0 underlay, 1 overlay) and three vertex indices.
    private static shapeFaces: Int32Array[] | null = [
        Int32Array.of(0, 1, 2, 3, 0, 0, 1, 3),
        Int32Array.of(1, 1, 2, 3, 1, 0, 1, 3),
        Int32Array.of(0, 1, 2, 3, 1, 0, 1, 3),
        Int32Array.of(0, 0, 1, 2, 0, 0, 2, 4, 1, 0, 4, 3),
        Int32Array.of(0, 0, 1, 4, 0, 0, 4, 3, 1, 1, 2, 4),
        Int32Array.of(0, 0, 4, 3, 1, 0, 1, 2, 1, 0, 2, 4),
        Int32Array.of(0, 1, 2, 4, 1, 0, 1, 4, 1, 0, 4, 3),
        Int32Array.of(0, 4, 1, 2, 0, 4, 2, 5, 1, 0, 4, 5, 1, 0, 5, 3),
        Int32Array.of(0, 4, 1, 2, 0, 4, 2, 3, 0, 4, 3, 5, 1, 0, 4, 5),
        Int32Array.of(0, 0, 4, 5, 1, 4, 1, 2, 1, 4, 2, 3, 1, 4, 3, 5),
        Int32Array.of(0, 0, 1, 5, 0, 1, 4, 5, 0, 1, 2, 4, 1, 0, 5, 3, 1, 5, 4, 3, 1, 4, 2, 3),
        Int32Array.of(1, 0, 1, 5, 1, 1, 4, 5, 1, 1, 2, 4, 0, 0, 5, 3, 0, 5, 4, 3, 0, 4, 2, 3),
        Int32Array.of(1, 0, 5, 4, 1, 0, 1, 5, 0, 0, 4, 3, 0, 4, 5, 3, 0, 5, 2, 3, 0, 1, 2, 5)
    ];
    // kb.q:[I
    // Camera-space y of each vertex for textured tiles, written by world.drawTileOverlay.
    static drawTextureVertexY: Int32Array | null = new Int32Array(6);
    // kb.t:[[I
    // Per shape, the vertex positions (1..8 tile edge points, 9..16 inner points; see the constructor).
    private static shapePoints: Int32Array[] | null = [
        Int32Array.of(1, 3, 5, 7),
        Int32Array.of(1, 3, 5, 7),
        Int32Array.of(1, 3, 5, 7),
        Int32Array.of(1, 3, 5, 7, 6),
        Int32Array.of(1, 3, 5, 7, 6),
        Int32Array.of(1, 3, 5, 7, 6),
        Int32Array.of(1, 3, 5, 7, 6),
        Int32Array.of(1, 3, 5, 7, 2, 6),
        Int32Array.of(1, 3, 5, 7, 2, 8),
        Int32Array.of(1, 3, 5, 7, 2, 8),
        Int32Array.of(1, 3, 5, 7, 11, 12),
        Int32Array.of(1, 3, 5, 7, 11, 12),
        Int32Array.of(1, 3, 5, 7, 13, 14)
    ];
    // kb.r:[I
    // Camera-space z of each vertex for textured tiles, written by world.drawTileOverlay.
    static drawTextureVertexZ: Int32Array | null = new Int32Array(6);
    // kb.u:[I
    // Camera-space x of each vertex for textured tiles, written by world.drawTileOverlay.
    static drawTextureVertexX: Int32Array | null = new Int32Array(6);
    // kb.v:[I
    // Screen x of each vertex (dc.f + (x << 9) / z), written by world.drawTileOverlay.
    static drawVertexX: Int32Array | null = new Int32Array(6);

    // kb.a:I
    rotation: number;
    // kb.b:[I
    faceVertexB: Int32Array;
    // kb.c:[I
    vertexY: Int32Array;
    // kb.d:[I
    vertexX: Int32Array;
    // kb.e:[I
    faceColourA: Int32Array;
    // kb.g:[I
    faceColourB: Int32Array;
    // kb.h:Z
    // All four corner heights equal.
    flat: boolean;
    // kb.j:[I
    faceVertexC: Int32Array;
    // kb.k:[I
    // Per face: -1 (underlay face) or the texture id (overlay face); null when the tile has no texture.
    faceTexture: Int32Array | null = null;
    // kb.l:I
    // The underlay's minimap colour (uk.a passes the same var18 as the minimap colour of a plain-underlay
    // QuickGround; world.Render2DGround paints the minimap shape's 0 pixels with it). The name is the legacy port's
    // and is swapped; see the constructor comment.
    minimapOverlay: number;
    // kb.m:I
    shape: number;
    // kb.n:I
    // The overlay's minimap colour (uk.a's var19, also the minimap colour of a full-overlay QuickGround). The name is
    // the legacy port's and is swapped; see the constructor comment.
    minimapUnderlay: number;
    // kb.o:[I
    faceVertexA: Int32Array;
    // kb.p:[I
    faceColourC: Int32Array;
    // kb.s:[I
    vertexZ: Int32Array;

    // kb.<init>(IIIIIIIIIIIIIIIIIII)V
    // var1 = shape, var2 = rotation, var3 = texture (-1 for none), var4/var5 = tile x/z,
    // var6..var9 = heights SW/SE/NE/NW, var10..var13 = underlay colours SW/SE/NE/NW,
    // var14..var17 = overlay colours SW/SE/NE/NW, var18 = the underlay's minimap colour (stored in l, named
    // minimapOverlay), var19 = the overlay's minimap colour (stored in n, named minimapUnderlay). The two field names
    // are swapped relative to what they hold: the legacy rev 225 port names its arg 18 overlay and arg 19 underlay
    // (src/dash3d/Ground.ts) although its caller (src/client/ClientBuild.ts) passes the underlay and overlay minimap
    // colours in that order. world.Render2DGround reads them under these names, so they stay until that file is
    // renamed with them.
    constructor(
        var1: number,
        var2: number,
        var3: number,
        var4: number,
        var5: number,
        var6: number,
        var7: number,
        var8: number,
        var9: number,
        var10: number,
        var11: number,
        var12: number,
        var13: number,
        var14: number,
        var15: number,
        var16: number,
        var17: number,
        var18: number,
        var19: number
    ) {
        // The h = true field initializer runs first.
        this.flat = true;
        if (var6 !== var7 || var6 !== var8 || var6 !== var9) {
            this.flat = false;
        }

        this.shape = var1;
        this.rotation = var2;
        this.minimapOverlay = var18;
        this.minimapUnderlay = var19;
        const var20 = 128;
        const var21 = (var20 / 2) | 0;
        const var22 = (var20 / 4) | 0;
        const var23 = ((var20 * 3) / 4) | 0;
        const var24 = arrayAtObj(Ground.shapePoints, var1);
        const var25 = var24.length;
        this.vertexX = groundArrays.allocate(var25);
        this.vertexY = groundArrays.allocate(var25);
        this.vertexZ = groundArrays.allocate(var25);
        const var26 = new Int32Array(var25);
        const var27 = new Int32Array(var25);
        const var28 = Math.imul(var4, var20);
        const var29 = Math.imul(var5, var20);

        for (let var30 = 0; var30 < var25; var30++) {
            let var31 = var24[var30];
            if ((var31 & 1) === 0 && var31 <= 8) {
                var31 = ((var31 - var2 - var2 - 1) & 7) + 1;
            }

            if (var31 > 8 && var31 <= 12) {
                var31 = ((var31 - 9 - var2) & 3) + 9;
            }

            if (var31 > 12 && var31 <= 16) {
                var31 = ((var31 - 13 - var2) & 3) + 13;
            }

            let var32: number;
            let var33: number;
            let var34: number;
            let var35: number;
            let var36: number;
            if (var31 === 1) {
                var32 = var28;
                var33 = var29;
                var34 = var6;
                var35 = var10;
                var36 = var14;
            } else if (var31 === 2) {
                var32 = (var28 + var21) | 0;
                var33 = var29;
                var34 = (var6 + var7) >> 1;
                var35 = (var10 + var11) >> 1;
                var36 = (var14 + var15) >> 1;
            } else if (var31 === 3) {
                var32 = (var28 + var20) | 0;
                var33 = var29;
                var34 = var7;
                var35 = var11;
                var36 = var15;
            } else if (var31 === 4) {
                var32 = (var28 + var20) | 0;
                var33 = (var29 + var21) | 0;
                var34 = (var7 + var8) >> 1;
                var35 = (var11 + var12) >> 1;
                var36 = (var15 + var16) >> 1;
            } else if (var31 === 5) {
                var32 = (var28 + var20) | 0;
                var33 = (var29 + var20) | 0;
                var34 = var8;
                var35 = var12;
                var36 = var16;
            } else if (var31 === 6) {
                var32 = (var28 + var21) | 0;
                var33 = (var29 + var20) | 0;
                var34 = (var8 + var9) >> 1;
                var35 = (var12 + var13) >> 1;
                var36 = (var16 + var17) >> 1;
            } else if (var31 === 7) {
                var32 = var28;
                var33 = (var29 + var20) | 0;
                var34 = var9;
                var35 = var13;
                var36 = var17;
            } else if (var31 === 8) {
                var32 = var28;
                var33 = (var29 + var21) | 0;
                var34 = (var9 + var6) >> 1;
                var35 = (var13 + var10) >> 1;
                var36 = (var17 + var14) >> 1;
            } else if (var31 === 9) {
                var32 = (var28 + var21) | 0;
                var33 = (var29 + var22) | 0;
                var34 = (var6 + var7) >> 1;
                var35 = (var10 + var11) >> 1;
                var36 = (var14 + var15) >> 1;
            } else if (var31 === 10) {
                var32 = (var28 + var23) | 0;
                var33 = (var29 + var21) | 0;
                var34 = (var7 + var8) >> 1;
                var35 = (var11 + var12) >> 1;
                var36 = (var15 + var16) >> 1;
            } else if (var31 === 11) {
                var32 = (var28 + var21) | 0;
                var33 = (var29 + var23) | 0;
                var34 = (var8 + var9) >> 1;
                var35 = (var12 + var13) >> 1;
                var36 = (var16 + var17) >> 1;
            } else if (var31 === 12) {
                var32 = (var28 + var22) | 0;
                var33 = (var29 + var21) | 0;
                var34 = (var9 + var6) >> 1;
                var35 = (var13 + var10) >> 1;
                var36 = (var17 + var14) >> 1;
            } else if (var31 === 13) {
                var32 = (var28 + var22) | 0;
                var33 = (var29 + var22) | 0;
                var34 = var6;
                var35 = var10;
                var36 = var14;
            } else if (var31 === 14) {
                var32 = (var28 + var23) | 0;
                var33 = (var29 + var22) | 0;
                var34 = var7;
                var35 = var11;
                var36 = var15;
            } else if (var31 === 15) {
                var32 = (var28 + var23) | 0;
                var33 = (var29 + var23) | 0;
                var34 = var8;
                var35 = var12;
                var36 = var16;
            } else {
                var32 = (var28 + var22) | 0;
                var33 = (var29 + var23) | 0;
                var34 = var9;
                var35 = var13;
                var36 = var17;
            }

            // var30 < var25, the length of all five arrays.
            this.vertexX[var30] = var32;
            this.vertexY[var30] = var34;
            this.vertexZ[var30] = var33;
            var26[var30] = var35;
            var27[var30] = var36;
        }

        const var39 = arrayAtObj(Ground.shapeFaces, var1);
        const var40 = (var39.length / 4) | 0;
        this.faceVertexA = groundArrays.allocate(var40);
        this.faceVertexB = groundArrays.allocate(var40);
        this.faceVertexC = groundArrays.allocate(var40);
        this.faceColourA = groundArrays.allocate(var40);
        this.faceColourB = groundArrays.allocate(var40);
        this.faceColourC = groundArrays.allocate(var40);
        if (var3 !== -1) {
            this.faceTexture = groundArrays.allocate(var40);
        }

        let var41 = 0;

        for (let var42 = 0; var42 < var40; var42++) {
            // var41 + 3 < 4 * var40 <= var39.length.
            const var43 = var39[var41];
            let var46 = var39[var41 + 1];
            let var37 = var39[var41 + 2];
            let var38 = var39[var41 + 3];
            var41 += 4;
            if (var46 < 4) {
                var46 = (var46 - var2) & 3;
            }

            if (var37 < 4) {
                var37 = (var37 - var2) & 3;
            }

            if (var38 < 4) {
                var38 = (var38 - var2) & 3;
            }

            this.faceVertexA[var42] = var46;
            this.faceVertexB[var42] = var37;
            this.faceVertexC[var42] = var38;
            if (var43 === 0) {
                this.faceColourA[var42] = arrayAtI32(var26, var46);
                this.faceColourB[var42] = arrayAtI32(var26, var37);
                this.faceColourC[var42] = arrayAtI32(var26, var38);
                if (this.faceTexture !== null) {
                    this.faceTexture[var42] = -1;
                }
            } else {
                this.faceColourA[var42] = arrayAtI32(var27, var46);
                this.faceColourB[var42] = arrayAtI32(var27, var37);
                this.faceColourC[var42] = arrayAtI32(var27, var38);
                if (this.faceTexture !== null) {
                    this.faceTexture[var42] = var3;
                }
            }
        }

        // Dead in the jar as well: a min/max of the four corner heights divided by 14 into locals that are never read.
        // The second test compares var7 with var47 (local 36, which still holds var7); the decompiler prints var7 > var7.
        let var44 = var6;
        let var47 = var7;
        if (var7 < var44) {
            var44 = var7;
        }

        if (var7 > var47) {
            var47 = var7;
        }

        if (var8 < var44) {
            var44 = var8;
        }

        if (var8 > var47) {
            var47 = var8;
        }

        if (var9 < var44) {
            var44 = var9;
        }

        if (var9 > var47) {
            var47 = var9;
        }

        var44 = (var44 / 14) | 0;
        var47 = (var47 / 14) | 0;
    }

    // kb.a()V
    // Applet-shutdown unload (client.a(Z)); nulls every kb static in this order.
    static unload(): void {
        Ground.drawVertexX = null;
        Ground.drawVertexY = null;
        Ground.drawTextureVertexX = null;
        Ground.drawTextureVertexY = null;
        Ground.drawTextureVertexZ = null;
        Ground.shapePoints = null;
        Ground.shapeFaces = null;
    }
}
