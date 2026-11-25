import Pix2D from '#/graphics/Pix2D';
import { bitCeil, doubleToInt, intDivide, intRemainder } from '#/util/IntUtils';
import { arrayAtI32, arrayPutI32, arrayPutU8, requireNonNull } from '#/util/JavaArray';
import { mathRandom } from '#/util/JavaRandom';
import type SdRasterSpans from './SdRasterSpans';
import type TextureProvider from './TextureProvider';

// dc in the revision 530 SD gamepack: the static software triangle rasterizer.
// It draws flat, Gouraud (through the HSL colour table) and perspective-textured
// triangles into Pix2D.pixels, one scanline call per row. The obfuscator left this
// class clean (no counters, dummy arguments or wrappers). The four clip mirrors
// oj.j/vf.X/p.l/fl.m live in other classes in the JAR and are written only here.
//
// Locals keep the decompiler's varN names, so every method can be diffed against
// dc.java line by line. Block layout follows the bytecode where the decompiler
// restructured it: the guards compiled as `if (...) return;` stay early returns, and
// the twelve `a != b && s < t || a == b && s > u` edge-order tests keep their original
// condition and arm order (dc.java negates them and swaps the arms).
// Int arithmetic is Java's: Math.imul for *, | 0 after + and -,
// (a / b) | 0 for / (each divisor below is provably non-zero unless intDivide is used),
// and arrayAt/arrayPut wherever Java's iaload/iastore could throw.
export default class Pix3D {
    // Optional WebGPU backend at the four dc scanline boundaries.
    static spanTarget: SdRasterSpans | null = null;

    // Static fields in dc.<clinit> store order.

    // dc.c:[I
    private static divTable: Int32Array | null = new Int32Array(512);
    // dc.a:Z
    static lowDetail: boolean = true;
    // dc.h:Z
    static textureFallback: boolean = false;
    // dc.g:[I
    static cosTable: Int32Array | null = new Int32Array(2048);
    // dc.k:[I
    static divTable2: Int32Array | null = new Int32Array(2048);
    // dc.m:Z
    private static lowMemTexture: boolean = false;
    // dc.n:Z
    private static opaque: boolean = false;
    // dc.l:[I
    static sinTable: Int32Array | null = new Int32Array(2048);
    // dc.d:[I
    private static scanline: Int32Array | null = new Int32Array(1024);
    // dc.e:I
    static trans: number = 0;
    // dc.o:[I
    static colourTable: Int32Array | null = new Int32Array(65536);
    // dc.i:F
    private static brightness: number = 1.0;

    // Read access for the legacy renderer bridge (scene/RasterTables.ts). Not in dc, where i stays private.
    static get legacyBrightness(): number {
        return Pix3D.brightness;
    }

    // The stress profile can restore the exact palette without consuming another Java random value.
    static setRenderBrightness(brightness: number): void {
        if (Pix3D.brightness === Math.fround(brightness)) return;
        Pix3D.brightness = Math.fround(brightness);
        Pix3D.initColourTable(0, 512);
    }
    // dc.j:Z
    static hclip: boolean = false;

    // Not stored by dc.<clinit>.

    // dc.b:I
    static originY: number = 0;
    // dc.f:I
    static originX: number = 0;
    // dc.p:I
    static width: number = 0;
    // dc.q:I
    private static height: number = 0;
    // dc.r:Lpc;
    static textureProvider: TextureProvider | null = null;
    // oj.j:I
    static clipMinX: number = 0;
    // vf.X:I
    static clipMaxX: number = 0;
    // p.l:I
    static clipMinY: number = 0;
    // fl.m:I
    static clipMaxY: number = 0;

    // The loops that follow the field stores in the static initializer.
    // dc.<clinit>()V
    static {
        for (let var0 = 1; var0 < 512; var0++) {
            arrayPutI32(Pix3D.divTable, var0, (32768 / var0) | 0);
        }

        for (let var1 = 1; var1 < 2048; var1++) {
            arrayPutI32(Pix3D.divTable2, var1, (65536 / var1) | 0);
        }

        for (let var2 = 0; var2 < 2048; var2++) {
            // |65536 * sin| <= 65536, so the d2i cannot saturate.
            arrayPutI32(Pix3D.sinTable, var2, (65536.0 * Math.sin(var2 * 0.0030679615)) | 0);
            arrayPutI32(Pix3D.cosTable, var2, (65536.0 * Math.cos(var2 * 0.0030679615)) | 0);
        }
    }

    // dc.a(F)V
    static setBrightness(var0: number): void {
        Pix3D.setRandomBrightness(var0);
        Pix3D.initColourTable(0, 512);
    }

    // dc.a()V
    static resetOrigin(): void {
        Pix3D.originX = (Pix3D.width / 2) | 0;
        Pix3D.originY = (Pix3D.height / 2) | 0;
        Pix3D.clipMinX = -Pix3D.originX | 0;
        Pix3D.clipMaxX = (Pix3D.width - Pix3D.originX) | 0;
        Pix3D.clipMinY = -Pix3D.originY | 0;
        Pix3D.clipMaxY = (Pix3D.height - Pix3D.originY) | 0;
    }

    // dc.a([IIIIIIII)V
    // var1 = row offset, var4/var5 = x span, var6/var7 = colour-table index and step (8.8 fixed point).
    // var2 and var3 are scratch registers the callers pass as 0.
    private static gouraudRaster(var0: Int32Array | null, var1: number, var2: number, var3: number, var4: number, var5: number, var6: number, var7: number): void {
        if (Pix3D.hclip) {
            if (var5 > Pix3D.width) {
                var5 = Pix3D.width;
            }

            if (var4 < 0) {
                var4 = 0;
            }
        }

        if (var4 >= var5) {
            return;
        }

        const palette = Pix3D.colourTable,
            trans = Pix3D.trans,
            lowDetail = Pix3D.lowDetail;
        const target = Pix3D.spanTarget;
        const count = var5 - var4;
        if (target === null && lowDetail && trans === 0) {
            const first = (var1 + var4) | 0;
            if (var0 !== null && palette !== null && first >= 0 && count <= 0x7fffffff && first + count <= var0.length) {
                // dc loads one palette entry for up to four successive pixels. A missing entry
                // faults at that load, after all stores from preceding groups, including an aliased palette.
                const end = first + count;
                let colour = (var6 + Math.imul(var7, var4)) | 0;
                const step = var7 << 2;
                let i = first;
                while (true) {
                    const shade = colour >> 8;
                    const rgb = palette[shade] ?? arrayAtI32(palette, shade);
                    if (end - i >= 4) colour = (colour + step) | 0;
                    var0[i++] = rgb;
                    if (i === end) return;
                    var0[i++] = rgb;
                    if (i === end) return;
                    var0[i++] = rgb;
                    if (i === end) return;
                    var0[i++] = rgb;
                    if (i === end) return;
                }
            }
        }
        Pix3D.gouraudRasterChecked(var0, var1, var2, var3, var4, var5, var6, var7, palette, trans, lowDetail, target);
    }

    // Continuation of dc.a([IIIIIIII)V for checked writes, blending and the WebGPU span target.
    private static gouraudRasterChecked(
        var0: Int32Array | null,
        var1: number,
        var2: number,
        var3: number,
        var4: number,
        var5: number,
        var6: number,
        var7: number,
        palette: Int32Array | null,
        trans: number,
        lowDetail: boolean,
        target: SdRasterSpans | null
    ): void {
        if (target !== null && target.gouraud(var0, var1, var4, var5, var6, var7, trans, lowDetail ? 1 : 0, palette, true)) return;

        var1 = (var1 + var4) | 0;
        var6 = (var6 + Math.imul(var7, var4)) | 0;
        if (lowDetail) {
            var3 = (var5 - var4) >> 2;
            var7 <<= 2;
            if (trans === 0) {
                if (var3 > 0) {
                    do {
                        var2 = arrayAtI32(palette, var6 >> 8);
                        var6 = (var6 + var7) | 0;
                        arrayPutI32(var0, var1++, var2);
                        arrayPutI32(var0, var1++, var2);
                        arrayPutI32(var0, var1++, var2);
                        arrayPutI32(var0, var1++, var2);
                    } while (--var3 > 0);
                }

                var3 = (var5 - var4) & 3;
                if (var3 > 0) {
                    var2 = arrayAtI32(palette, var6 >> 8);

                    do {
                        arrayPutI32(var0, var1++, var2);
                    } while (--var3 > 0);

                    return;
                }
            } else {
                const var32 = trans;
                const var33 = (256 - trans) | 0;
                if (var3 > 0) {
                    do {
                        var2 = arrayAtI32(palette, var6 >> 8);
                        var6 = (var6 + var7) | 0;
                        var2 = (((Math.imul(var2 & 16711935, var33) >> 8) & 16711935) + ((Math.imul(var2 & 0xff00, var33) >> 8) & 0xff00)) | 0;
                        let var34 = arrayAtI32(var0, var1);
                        arrayPutI32(var0, var1++, (var2 + ((Math.imul(var34 & 16711935, var32) >> 8) & 16711935) + ((Math.imul(var34 & 0xff00, var32) >> 8) & 0xff00)) | 0);
                        var34 = arrayAtI32(var0, var1);
                        arrayPutI32(var0, var1++, (var2 + ((Math.imul(var34 & 16711935, var32) >> 8) & 16711935) + ((Math.imul(var34 & 0xff00, var32) >> 8) & 0xff00)) | 0);
                        var34 = arrayAtI32(var0, var1);
                        arrayPutI32(var0, var1++, (var2 + ((Math.imul(var34 & 16711935, var32) >> 8) & 16711935) + ((Math.imul(var34 & 0xff00, var32) >> 8) & 0xff00)) | 0);
                        var34 = arrayAtI32(var0, var1);
                        arrayPutI32(var0, var1++, (var2 + ((Math.imul(var34 & 16711935, var32) >> 8) & 16711935) + ((Math.imul(var34 & 0xff00, var32) >> 8) & 0xff00)) | 0);
                    } while (--var3 > 0);
                }

                var3 = (var5 - var4) & 3;
                if (var3 > 0) {
                    var2 = arrayAtI32(palette, var6 >> 8);
                    var2 = (((Math.imul(var2 & 16711935, var33) >> 8) & 16711935) + ((Math.imul(var2 & 0xff00, var33) >> 8) & 0xff00)) | 0;

                    do {
                        const var38 = arrayAtI32(var0, var1);
                        arrayPutI32(var0, var1++, (var2 + ((Math.imul(var38 & 16711935, var32) >> 8) & 16711935) + ((Math.imul(var38 & 0xff00, var32) >> 8) & 0xff00)) | 0);
                    } while (--var3 > 0);
                }
            }
        } else {
            var3 = (var5 - var4) | 0;
            if (trans === 0) {
                do {
                    arrayPutI32(var0, var1++, arrayAtI32(palette, var6 >> 8));
                    var6 = (var6 + var7) | 0;
                } while (--var3 > 0);
            } else {
                const var8 = trans;
                const var9 = (256 - trans) | 0;

                do {
                    var2 = arrayAtI32(palette, var6 >> 8);
                    var6 = (var6 + var7) | 0;
                    var2 = (((Math.imul(var2 & 16711935, var9) >> 8) & 16711935) + ((Math.imul(var2 & 0xff00, var9) >> 8) & 0xff00)) | 0;
                    const var10 = arrayAtI32(var0, var1);
                    arrayPutI32(var0, var1++, (var2 + ((Math.imul(var10 & 16711935, var8) >> 8) & 16711935) + ((Math.imul(var10 & 0xff00, var8) >> 8) & 0xff00)) | 0);
                } while (--var3 > 0);
            }
        }
    }

    // dc.a([I[IIIIIIIIIIIIII)V
    // var0 = destination, var1 = texels, var4 = row offset, var5/var6 = x span, var7/var8 = shade and step,
    // var9..var11 = perspective numerators at the row origin, var12..var14 = their x steps.
    // var2 and var3 are scratch registers the callers pass as 0.
    private static terrainTextureRaster(
        var0: Int32Array | null,
        var1: Int32Array | null,
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
        var14: number
    ): void {
        if (Pix3D.hclip) {
            if (var6 > Pix3D.width) {
                var6 = Pix3D.width;
            }

            if (var5 < 0) {
                var5 = 0;
            }
        }

        if (var5 >= var6) {
            return;
        }

        if (Pix3D.spanTarget !== null && Pix3D.spanTarget.record(var0, 2, var4, var5, var6, var7, var8, 0, (Pix3D.lowMemTexture ? 1 : 0) | (Pix3D.opaque ? 2 : 0), var1, Pix3D.originX, var9, var10, var11, var12, var13, var14)) return;

        var4 = (var4 + var5) | 0;
        var7 = (var7 + Math.imul(var8, var5)) | 0;
        let var17 = (var6 - var5) | 0;
        if (Pix3D.lowMemTexture) {
            const var23 = (var5 - Pix3D.originX) | 0;
            var9 = (var9 + Math.imul(var12, var23)) | 0;
            var10 = (var10 + Math.imul(var13, var23)) | 0;
            var11 = (var11 + Math.imul(var14, var23)) | 0;
            let var22 = var11 >> 12;
            let var18: number;
            let var19: number;
            if (var22 !== 0) {
                var18 = (var9 / var22) | 0;
                var19 = (var10 / var22) | 0;
            } else {
                var18 = 0;
                var19 = 0;
            }

            var9 = (var9 + Math.imul(var12, var17)) | 0;
            var10 = (var10 + Math.imul(var13, var17)) | 0;
            var11 = (var11 + Math.imul(var14, var17)) | 0;
            var22 = var11 >> 12;
            let var20: number;
            let var21: number;
            if (var22 !== 0) {
                var20 = (var9 / var22) | 0;
                var21 = (var10 / var22) | 0;
            } else {
                var20 = 0;
                var21 = 0;
            }

            var2 = ((var18 << 20) + var19) | 0;
            const var16 = ((((((var20 - var18) | 0) / var17) | 0) << 20) + ((((var21 - var19) | 0) / var17) | 0)) | 0;
            var17 >>= 3;
            var8 <<= 3;
            let var15 = var7 >> 8;
            if (Pix3D.opaque) {
                if (var17 > 0) {
                    do {
                        var3 = arrayAtI32(var1, (var2 & 4032) + (var2 >>> 26));
                        arrayPutI32(var0, var4++, ((Math.imul(var3 & 16711935, var15) & -16711936) + (Math.imul(var3 & 0xff00, var15) & 0xff0000)) >> 8);
                        var2 = (var2 + var16) | 0;
                        var3 = arrayAtI32(var1, (var2 & 4032) + (var2 >>> 26));
                        arrayPutI32(var0, var4++, ((Math.imul(var3 & 16711935, var15) & -16711936) + (Math.imul(var3 & 0xff00, var15) & 0xff0000)) >> 8);
                        var2 = (var2 + var16) | 0;
                        var3 = arrayAtI32(var1, (var2 & 4032) + (var2 >>> 26));
                        arrayPutI32(var0, var4++, ((Math.imul(var3 & 16711935, var15) & -16711936) + (Math.imul(var3 & 0xff00, var15) & 0xff0000)) >> 8);
                        var2 = (var2 + var16) | 0;
                        var3 = arrayAtI32(var1, (var2 & 4032) + (var2 >>> 26));
                        arrayPutI32(var0, var4++, ((Math.imul(var3 & 16711935, var15) & -16711936) + (Math.imul(var3 & 0xff00, var15) & 0xff0000)) >> 8);
                        var2 = (var2 + var16) | 0;
                        var3 = arrayAtI32(var1, (var2 & 4032) + (var2 >>> 26));
                        arrayPutI32(var0, var4++, ((Math.imul(var3 & 16711935, var15) & -16711936) + (Math.imul(var3 & 0xff00, var15) & 0xff0000)) >> 8);
                        var2 = (var2 + var16) | 0;
                        var3 = arrayAtI32(var1, (var2 & 4032) + (var2 >>> 26));
                        arrayPutI32(var0, var4++, ((Math.imul(var3 & 16711935, var15) & -16711936) + (Math.imul(var3 & 0xff00, var15) & 0xff0000)) >> 8);
                        var2 = (var2 + var16) | 0;
                        var3 = arrayAtI32(var1, (var2 & 4032) + (var2 >>> 26));
                        arrayPutI32(var0, var4++, ((Math.imul(var3 & 16711935, var15) & -16711936) + (Math.imul(var3 & 0xff00, var15) & 0xff0000)) >> 8);
                        var2 = (var2 + var16) | 0;
                        var3 = arrayAtI32(var1, (var2 & 4032) + (var2 >>> 26));
                        arrayPutI32(var0, var4++, ((Math.imul(var3 & 16711935, var15) & -16711936) + (Math.imul(var3 & 0xff00, var15) & 0xff0000)) >> 8);
                        var2 = (var2 + var16) | 0;
                        var7 = (var7 + var8) | 0;
                        var15 = var7 >> 8;
                    } while (--var17 > 0);
                }

                var17 = (var6 - var5) & 7;
                if (var17 > 0) {
                    do {
                        var3 = arrayAtI32(var1, (var2 & 4032) + (var2 >>> 26));
                        arrayPutI32(var0, var4++, ((Math.imul(var3 & 16711935, var15) & -16711936) + (Math.imul(var3 & 0xff00, var15) & 0xff0000)) >> 8);
                        var2 = (var2 + var16) | 0;
                    } while (--var17 > 0);

                    return;
                }

                return;
            }

            if (var17 > 0) {
                do {
                    if ((var3 = arrayAtI32(var1, (var2 & 4032) + (var2 >>> 26))) !== 0) {
                        arrayPutI32(var0, var4, ((Math.imul(var3 & 16711935, var15) & -16711936) + (Math.imul(var3 & 0xff00, var15) & 0xff0000)) >> 8);
                    }

                    var4++;
                    var2 = (var2 + var16) | 0;
                    if ((var3 = arrayAtI32(var1, (var2 & 4032) + (var2 >>> 26))) !== 0) {
                        arrayPutI32(var0, var4, ((Math.imul(var3 & 16711935, var15) & -16711936) + (Math.imul(var3 & 0xff00, var15) & 0xff0000)) >> 8);
                    }

                    var4++;
                    var2 = (var2 + var16) | 0;
                    if ((var3 = arrayAtI32(var1, (var2 & 4032) + (var2 >>> 26))) !== 0) {
                        arrayPutI32(var0, var4, ((Math.imul(var3 & 16711935, var15) & -16711936) + (Math.imul(var3 & 0xff00, var15) & 0xff0000)) >> 8);
                    }

                    var4++;
                    var2 = (var2 + var16) | 0;
                    if ((var3 = arrayAtI32(var1, (var2 & 4032) + (var2 >>> 26))) !== 0) {
                        arrayPutI32(var0, var4, ((Math.imul(var3 & 16711935, var15) & -16711936) + (Math.imul(var3 & 0xff00, var15) & 0xff0000)) >> 8);
                    }

                    var4++;
                    var2 = (var2 + var16) | 0;
                    if ((var3 = arrayAtI32(var1, (var2 & 4032) + (var2 >>> 26))) !== 0) {
                        arrayPutI32(var0, var4, ((Math.imul(var3 & 16711935, var15) & -16711936) + (Math.imul(var3 & 0xff00, var15) & 0xff0000)) >> 8);
                    }

                    var4++;
                    var2 = (var2 + var16) | 0;
                    if ((var3 = arrayAtI32(var1, (var2 & 4032) + (var2 >>> 26))) !== 0) {
                        arrayPutI32(var0, var4, ((Math.imul(var3 & 16711935, var15) & -16711936) + (Math.imul(var3 & 0xff00, var15) & 0xff0000)) >> 8);
                    }

                    var4++;
                    var2 = (var2 + var16) | 0;
                    if ((var3 = arrayAtI32(var1, (var2 & 4032) + (var2 >>> 26))) !== 0) {
                        arrayPutI32(var0, var4, ((Math.imul(var3 & 16711935, var15) & -16711936) + (Math.imul(var3 & 0xff00, var15) & 0xff0000)) >> 8);
                    }

                    var4++;
                    var2 = (var2 + var16) | 0;
                    if ((var3 = arrayAtI32(var1, (var2 & 4032) + (var2 >>> 26))) !== 0) {
                        arrayPutI32(var0, var4, ((Math.imul(var3 & 16711935, var15) & -16711936) + (Math.imul(var3 & 0xff00, var15) & 0xff0000)) >> 8);
                    }

                    var4++;
                    var2 = (var2 + var16) | 0;
                    var7 = (var7 + var8) | 0;
                    var15 = var7 >> 8;
                } while (--var17 > 0);
            }

            var17 = (var6 - var5) & 7;
            if (var17 > 0) {
                do {
                    if ((var3 = arrayAtI32(var1, (var2 & 4032) + (var2 >>> 26))) !== 0) {
                        arrayPutI32(var0, var4, ((Math.imul(var3 & 16711935, var15) & -16711936) + (Math.imul(var3 & 0xff00, var15) & 0xff0000)) >> 8);
                    }

                    var4++;
                    var2 = (var2 + var16) | 0;
                } while (--var17 > 0);

                return;
            }
        } else {
            const var149 = (var5 - Pix3D.originX) | 0;
            var9 = (var9 + Math.imul(var12, var149)) | 0;
            var10 = (var10 + Math.imul(var13, var149)) | 0;
            var11 = (var11 + Math.imul(var14, var149)) | 0;
            let var147 = var11 >> 14;
            let var142: number;
            let var143: number;
            if (var147 !== 0) {
                var142 = (var9 / var147) | 0;
                var143 = (var10 / var147) | 0;
            } else {
                var142 = 0;
                var143 = 0;
            }

            var9 = (var9 + Math.imul(var12, var17)) | 0;
            var10 = (var10 + Math.imul(var13, var17)) | 0;
            var11 = (var11 + Math.imul(var14, var17)) | 0;
            var147 = var11 >> 14;
            let var144: number;
            let var145: number;
            if (var147 !== 0) {
                var144 = (var9 / var147) | 0;
                var145 = (var10 / var147) | 0;
            } else {
                var144 = 0;
                var145 = 0;
            }

            var2 = ((var142 << 18) + var143) | 0;
            const var135 = ((((((var144 - var142) | 0) / var17) | 0) << 18) + ((((var145 - var143) | 0) / var17) | 0)) | 0;
            var17 >>= 3;
            var8 <<= 3;
            let var134 = var7 >> 8;
            if (Pix3D.opaque) {
                if (var17 > 0) {
                    do {
                        var3 = arrayAtI32(var1, (var2 & 16256) + (var2 >>> 25));
                        arrayPutI32(var0, var4++, ((Math.imul(var3 & 16711935, var134) & -16711936) + (Math.imul(var3 & 0xff00, var134) & 0xff0000)) >> 8);
                        var2 = (var2 + var135) | 0;
                        var3 = arrayAtI32(var1, (var2 & 16256) + (var2 >>> 25));
                        arrayPutI32(var0, var4++, ((Math.imul(var3 & 16711935, var134) & -16711936) + (Math.imul(var3 & 0xff00, var134) & 0xff0000)) >> 8);
                        var2 = (var2 + var135) | 0;
                        var3 = arrayAtI32(var1, (var2 & 16256) + (var2 >>> 25));
                        arrayPutI32(var0, var4++, ((Math.imul(var3 & 16711935, var134) & -16711936) + (Math.imul(var3 & 0xff00, var134) & 0xff0000)) >> 8);
                        var2 = (var2 + var135) | 0;
                        var3 = arrayAtI32(var1, (var2 & 16256) + (var2 >>> 25));
                        arrayPutI32(var0, var4++, ((Math.imul(var3 & 16711935, var134) & -16711936) + (Math.imul(var3 & 0xff00, var134) & 0xff0000)) >> 8);
                        var2 = (var2 + var135) | 0;
                        var3 = arrayAtI32(var1, (var2 & 16256) + (var2 >>> 25));
                        arrayPutI32(var0, var4++, ((Math.imul(var3 & 16711935, var134) & -16711936) + (Math.imul(var3 & 0xff00, var134) & 0xff0000)) >> 8);
                        var2 = (var2 + var135) | 0;
                        var3 = arrayAtI32(var1, (var2 & 16256) + (var2 >>> 25));
                        arrayPutI32(var0, var4++, ((Math.imul(var3 & 16711935, var134) & -16711936) + (Math.imul(var3 & 0xff00, var134) & 0xff0000)) >> 8);
                        var2 = (var2 + var135) | 0;
                        var3 = arrayAtI32(var1, (var2 & 16256) + (var2 >>> 25));
                        arrayPutI32(var0, var4++, ((Math.imul(var3 & 16711935, var134) & -16711936) + (Math.imul(var3 & 0xff00, var134) & 0xff0000)) >> 8);
                        var2 = (var2 + var135) | 0;
                        var3 = arrayAtI32(var1, (var2 & 16256) + (var2 >>> 25));
                        arrayPutI32(var0, var4++, ((Math.imul(var3 & 16711935, var134) & -16711936) + (Math.imul(var3 & 0xff00, var134) & 0xff0000)) >> 8);
                        var2 = (var2 + var135) | 0;
                        var7 = (var7 + var8) | 0;
                        var134 = var7 >> 8;
                    } while (--var17 > 0);
                }

                var17 = (var6 - var5) & 7;
                if (var17 > 0) {
                    do {
                        var3 = arrayAtI32(var1, (var2 & 16256) + (var2 >>> 25));
                        arrayPutI32(var0, var4++, ((Math.imul(var3 & 16711935, var134) & -16711936) + (Math.imul(var3 & 0xff00, var134) & 0xff0000)) >> 8);
                        var2 = (var2 + var135) | 0;
                    } while (--var17 > 0);

                    return;
                }
            } else {
                if (var17 > 0) {
                    do {
                        if ((var3 = arrayAtI32(var1, (var2 & 16256) + (var2 >>> 25))) !== 0) {
                            arrayPutI32(var0, var4, ((Math.imul(var3 & 16711935, var134) & -16711936) + (Math.imul(var3 & 0xff00, var134) & 0xff0000)) >> 8);
                        }

                        var4++;
                        var2 = (var2 + var135) | 0;
                        if ((var3 = arrayAtI32(var1, (var2 & 16256) + (var2 >>> 25))) !== 0) {
                            arrayPutI32(var0, var4, ((Math.imul(var3 & 16711935, var134) & -16711936) + (Math.imul(var3 & 0xff00, var134) & 0xff0000)) >> 8);
                        }

                        var4++;
                        var2 = (var2 + var135) | 0;
                        if ((var3 = arrayAtI32(var1, (var2 & 16256) + (var2 >>> 25))) !== 0) {
                            arrayPutI32(var0, var4, ((Math.imul(var3 & 16711935, var134) & -16711936) + (Math.imul(var3 & 0xff00, var134) & 0xff0000)) >> 8);
                        }

                        var4++;
                        var2 = (var2 + var135) | 0;
                        if ((var3 = arrayAtI32(var1, (var2 & 16256) + (var2 >>> 25))) !== 0) {
                            arrayPutI32(var0, var4, ((Math.imul(var3 & 16711935, var134) & -16711936) + (Math.imul(var3 & 0xff00, var134) & 0xff0000)) >> 8);
                        }

                        var4++;
                        var2 = (var2 + var135) | 0;
                        if ((var3 = arrayAtI32(var1, (var2 & 16256) + (var2 >>> 25))) !== 0) {
                            arrayPutI32(var0, var4, ((Math.imul(var3 & 16711935, var134) & -16711936) + (Math.imul(var3 & 0xff00, var134) & 0xff0000)) >> 8);
                        }

                        var4++;
                        var2 = (var2 + var135) | 0;
                        if ((var3 = arrayAtI32(var1, (var2 & 16256) + (var2 >>> 25))) !== 0) {
                            arrayPutI32(var0, var4, ((Math.imul(var3 & 16711935, var134) & -16711936) + (Math.imul(var3 & 0xff00, var134) & 0xff0000)) >> 8);
                        }

                        var4++;
                        var2 = (var2 + var135) | 0;
                        if ((var3 = arrayAtI32(var1, (var2 & 16256) + (var2 >>> 25))) !== 0) {
                            arrayPutI32(var0, var4, ((Math.imul(var3 & 16711935, var134) & -16711936) + (Math.imul(var3 & 0xff00, var134) & 0xff0000)) >> 8);
                        }

                        var4++;
                        var2 = (var2 + var135) | 0;
                        if ((var3 = arrayAtI32(var1, (var2 & 16256) + (var2 >>> 25))) !== 0) {
                            arrayPutI32(var0, var4, ((Math.imul(var3 & 16711935, var134) & -16711936) + (Math.imul(var3 & 0xff00, var134) & 0xff0000)) >> 8);
                        }

                        var4++;
                        var2 = (var2 + var135) | 0;
                        var7 = (var7 + var8) | 0;
                        var134 = var7 >> 8;
                    } while (--var17 > 0);
                }

                var17 = (var6 - var5) & 7;
                if (var17 > 0) {
                    do {
                        if ((var3 = arrayAtI32(var1, (var2 & 16256) + (var2 >>> 25))) !== 0) {
                            arrayPutI32(var0, var4, ((Math.imul(var3 & 16711935, var134) & -16711936) + (Math.imul(var3 & 0xff00, var134) & 0xff0000)) >> 8);
                        }

                        var4++;
                        var2 = (var2 + var135) | 0;
                    } while (--var17 > 0);
                }
            }
        }
    }

    // dc.a(IIIIIIIIIIIIIIIIIII)V
    // var0..var2 = y, var3..var5 = x, var6..var8 = HSL colours, var9..var17 = view-space texture
    // basis (origin, u and v points), var18 = texture id.
    static terrainTextureTriangle(
        var0: number,
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
        var18: number
    ): void {
        const var19 = requireNonNull(Pix3D.textureProvider).getTextureData(var18, Pix3D.brightness);
        if (var19 === null) {
            const var105 = requireNonNull(Pix3D.textureProvider).getTextureColour(var18);
            Pix3D.gouraudTriangle(var0, var1, var2, var3, var4, var5, Pix3D.adjustLightness(var105, var6), Pix3D.adjustLightness(var105, var7), Pix3D.adjustLightness(var105, var8));
            return;
        }

        Pix3D.lowMemTexture = requireNonNull(Pix3D.textureProvider).getTextureSmall(var18);
        Pix3D.opaque = requireNonNull(Pix3D.textureProvider).getTextureSolid(var18);

        const var20 = (var4 - var3) | 0;
        const var21 = (var1 - var0) | 0;
        const var22 = (var5 - var3) | 0;
        const var23 = (var2 - var0) | 0;
        const var24 = (var7 - var6) | 0;
        const var25 = (var8 - var6) | 0;
        let var26 = 0;
        if (var1 !== var0) {
            var26 = (((var4 - var3) << 16) / ((var1 - var0) | 0)) | 0;
        }

        let var27 = 0;
        if (var2 !== var1) {
            var27 = (((var5 - var4) << 16) / ((var2 - var1) | 0)) | 0;
        }

        let var28 = 0;
        if (var2 !== var0) {
            var28 = (((var3 - var5) << 16) / ((var0 - var2) | 0)) | 0;
        }

        const var29 = (Math.imul(var20, var23) - Math.imul(var22, var21)) | 0;
        if (var29 === 0) {
            return;
        }

        const var30 = (((Math.imul(var24, var23) - Math.imul(var25, var21)) << 9) / var29) | 0;
        const var31 = (((Math.imul(var25, var20) - Math.imul(var24, var22)) << 9) / var29) | 0;
        var10 = (var9 - var10) | 0;
        var13 = (var12 - var13) | 0;
        var16 = (var15 - var16) | 0;
        var11 = (var11 - var9) | 0;
        var14 = (var14 - var12) | 0;
        var17 = (var17 - var15) | 0;
        let var32 = (Math.imul(var11, var12) - Math.imul(var14, var9)) << 14;
        const var33 = (Math.imul(var14, var15) - Math.imul(var17, var12)) << 5;
        const var34 = (Math.imul(var17, var9) - Math.imul(var11, var15)) << 5;
        let var35 = (Math.imul(var10, var12) - Math.imul(var13, var9)) << 14;
        const var36 = (Math.imul(var13, var15) - Math.imul(var16, var12)) << 5;
        const var37 = (Math.imul(var16, var9) - Math.imul(var10, var15)) << 5;
        let var38 = (Math.imul(var13, var11) - Math.imul(var10, var14)) << 14;
        const var39 = (Math.imul(var16, var14) - Math.imul(var13, var17)) << 5;
        const var40 = (Math.imul(var10, var17) - Math.imul(var16, var11)) << 5;
        if (var0 <= var1 && var0 <= var2) {
            if (var0 >= Pix3D.height) {
                return;
            }

            if (var1 > Pix3D.height) {
                var1 = Pix3D.height;
            }

            if (var2 > Pix3D.height) {
                var2 = Pix3D.height;
            }

            var6 = ((var6 << 9) - Math.imul(var30, var3) + var30) | 0;
            if (var1 < var2) {
                let var83: number;
                var5 = var83 = var3 << 16;
                if (var0 < 0) {
                    var5 = (var5 - Math.imul(var28, var0)) | 0;
                    var83 = (var83 - Math.imul(var26, var0)) | 0;
                    var6 = (var6 - Math.imul(var31, var0)) | 0;
                    var0 = 0;
                }

                var4 <<= 16;
                if (var1 < 0) {
                    var4 = (var4 - Math.imul(var27, var1)) | 0;
                    var1 = 0;
                }

                const var128 = (var0 - Pix3D.originY) | 0;
                var32 = (var32 + Math.imul(var34, var128)) | 0;
                var35 = (var35 + Math.imul(var37, var128)) | 0;
                var38 = (var38 + Math.imul(var40, var128)) | 0;
                if ((var0 !== var1 && var28 < var26) || (var0 === var1 && var28 > var27)) {
                    var2 = (var2 - var1) | 0;
                    var1 = (var1 - var0) | 0;

                    for (var0 = arrayAtI32(Pix3D.scanline, var0); --var1 >= 0; var38 = (var38 + var40) | 0) {
                        Pix3D.terrainTextureRaster(Pix2D.pixels, var19, 0, 0, var0, var5 >> 16, var83 >> 16, var6, var30, var32, var35, var38, var33, var36, var39);
                        var5 = (var5 + var28) | 0;
                        var83 = (var83 + var26) | 0;
                        var6 = (var6 + var31) | 0;
                        var0 = (var0 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                    }

                    while (--var2 >= 0) {
                        Pix3D.terrainTextureRaster(Pix2D.pixels, var19, 0, 0, var0, var5 >> 16, var4 >> 16, var6, var30, var32, var35, var38, var33, var36, var39);
                        var5 = (var5 + var28) | 0;
                        var4 = (var4 + var27) | 0;
                        var6 = (var6 + var31) | 0;
                        var0 = (var0 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                        var38 = (var38 + var40) | 0;
                    }
                } else {
                    var2 = (var2 - var1) | 0;
                    var1 = (var1 - var0) | 0;

                    for (var0 = arrayAtI32(Pix3D.scanline, var0); --var1 >= 0; var38 = (var38 + var40) | 0) {
                        Pix3D.terrainTextureRaster(Pix2D.pixels, var19, 0, 0, var0, var83 >> 16, var5 >> 16, var6, var30, var32, var35, var38, var33, var36, var39);
                        var5 = (var5 + var28) | 0;
                        var83 = (var83 + var26) | 0;
                        var6 = (var6 + var31) | 0;
                        var0 = (var0 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                    }

                    while (--var2 >= 0) {
                        Pix3D.terrainTextureRaster(Pix2D.pixels, var19, 0, 0, var0, var4 >> 16, var5 >> 16, var6, var30, var32, var35, var38, var33, var36, var39);
                        var5 = (var5 + var28) | 0;
                        var4 = (var4 + var27) | 0;
                        var6 = (var6 + var31) | 0;
                        var0 = (var0 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                        var38 = (var38 + var40) | 0;
                    }
                }
            } else {
                let var82: number;
                var4 = var82 = var3 << 16;
                if (var0 < 0) {
                    var4 = (var4 - Math.imul(var28, var0)) | 0;
                    var82 = (var82 - Math.imul(var26, var0)) | 0;
                    var6 = (var6 - Math.imul(var31, var0)) | 0;
                    var0 = 0;
                }

                var5 <<= 16;
                if (var2 < 0) {
                    var5 = (var5 - Math.imul(var27, var2)) | 0;
                    var2 = 0;
                }

                const var127 = (var0 - Pix3D.originY) | 0;
                var32 = (var32 + Math.imul(var34, var127)) | 0;
                var35 = (var35 + Math.imul(var37, var127)) | 0;
                var38 = (var38 + Math.imul(var40, var127)) | 0;
                if ((var0 !== var2 && var28 < var26) || (var0 === var2 && var27 > var26)) {
                    var1 = (var1 - var2) | 0;
                    var2 = (var2 - var0) | 0;

                    for (var0 = arrayAtI32(Pix3D.scanline, var0); --var2 >= 0; var38 = (var38 + var40) | 0) {
                        Pix3D.terrainTextureRaster(Pix2D.pixels, var19, 0, 0, var0, var4 >> 16, var82 >> 16, var6, var30, var32, var35, var38, var33, var36, var39);
                        var4 = (var4 + var28) | 0;
                        var82 = (var82 + var26) | 0;
                        var6 = (var6 + var31) | 0;
                        var0 = (var0 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                    }

                    while (--var1 >= 0) {
                        Pix3D.terrainTextureRaster(Pix2D.pixels, var19, 0, 0, var0, var5 >> 16, var82 >> 16, var6, var30, var32, var35, var38, var33, var36, var39);
                        var5 = (var5 + var27) | 0;
                        var82 = (var82 + var26) | 0;
                        var6 = (var6 + var31) | 0;
                        var0 = (var0 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                        var38 = (var38 + var40) | 0;
                    }
                } else {
                    var1 = (var1 - var2) | 0;
                    var2 = (var2 - var0) | 0;

                    for (var0 = arrayAtI32(Pix3D.scanline, var0); --var2 >= 0; var38 = (var38 + var40) | 0) {
                        Pix3D.terrainTextureRaster(Pix2D.pixels, var19, 0, 0, var0, var82 >> 16, var4 >> 16, var6, var30, var32, var35, var38, var33, var36, var39);
                        var4 = (var4 + var28) | 0;
                        var82 = (var82 + var26) | 0;
                        var6 = (var6 + var31) | 0;
                        var0 = (var0 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                    }

                    while (--var1 >= 0) {
                        Pix3D.terrainTextureRaster(Pix2D.pixels, var19, 0, 0, var0, var82 >> 16, var5 >> 16, var6, var30, var32, var35, var38, var33, var36, var39);
                        var5 = (var5 + var27) | 0;
                        var82 = (var82 + var26) | 0;
                        var6 = (var6 + var31) | 0;
                        var0 = (var0 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                        var38 = (var38 + var40) | 0;
                    }
                }
            }
        } else if (var1 <= var2) {
            if (var1 >= Pix3D.height) {
                return;
            }

            if (var2 > Pix3D.height) {
                var2 = Pix3D.height;
            }

            if (var0 > Pix3D.height) {
                var0 = Pix3D.height;
            }

            var7 = ((var7 << 9) - Math.imul(var30, var4) + var30) | 0;
            if (var2 < var0) {
                let var87: number;
                var3 = var87 = var4 << 16;
                if (var1 < 0) {
                    var3 = (var3 - Math.imul(var26, var1)) | 0;
                    var87 = (var87 - Math.imul(var27, var1)) | 0;
                    var7 = (var7 - Math.imul(var31, var1)) | 0;
                    var1 = 0;
                }

                var5 <<= 16;
                if (var2 < 0) {
                    var5 = (var5 - Math.imul(var28, var2)) | 0;
                    var2 = 0;
                }

                const var126 = (var1 - Pix3D.originY) | 0;
                var32 = (var32 + Math.imul(var34, var126)) | 0;
                var35 = (var35 + Math.imul(var37, var126)) | 0;
                var38 = (var38 + Math.imul(var40, var126)) | 0;
                if ((var1 !== var2 && var26 < var27) || (var1 === var2 && var26 > var28)) {
                    var0 = (var0 - var2) | 0;
                    var2 = (var2 - var1) | 0;

                    for (var1 = arrayAtI32(Pix3D.scanline, var1); --var2 >= 0; var38 = (var38 + var40) | 0) {
                        Pix3D.terrainTextureRaster(Pix2D.pixels, var19, 0, 0, var1, var3 >> 16, var87 >> 16, var7, var30, var32, var35, var38, var33, var36, var39);
                        var3 = (var3 + var26) | 0;
                        var87 = (var87 + var27) | 0;
                        var7 = (var7 + var31) | 0;
                        var1 = (var1 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                    }

                    while (--var0 >= 0) {
                        Pix3D.terrainTextureRaster(Pix2D.pixels, var19, 0, 0, var1, var3 >> 16, var5 >> 16, var7, var30, var32, var35, var38, var33, var36, var39);
                        var3 = (var3 + var26) | 0;
                        var5 = (var5 + var28) | 0;
                        var7 = (var7 + var31) | 0;
                        var1 = (var1 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                        var38 = (var38 + var40) | 0;
                    }
                } else {
                    var0 = (var0 - var2) | 0;
                    var2 = (var2 - var1) | 0;

                    for (var1 = arrayAtI32(Pix3D.scanline, var1); --var2 >= 0; var38 = (var38 + var40) | 0) {
                        Pix3D.terrainTextureRaster(Pix2D.pixels, var19, 0, 0, var1, var87 >> 16, var3 >> 16, var7, var30, var32, var35, var38, var33, var36, var39);
                        var3 = (var3 + var26) | 0;
                        var87 = (var87 + var27) | 0;
                        var7 = (var7 + var31) | 0;
                        var1 = (var1 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                    }

                    while (--var0 >= 0) {
                        Pix3D.terrainTextureRaster(Pix2D.pixels, var19, 0, 0, var1, var5 >> 16, var3 >> 16, var7, var30, var32, var35, var38, var33, var36, var39);
                        var3 = (var3 + var26) | 0;
                        var5 = (var5 + var28) | 0;
                        var7 = (var7 + var31) | 0;
                        var1 = (var1 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                        var38 = (var38 + var40) | 0;
                    }
                }
            } else {
                let var86: number;
                var5 = var86 = var4 << 16;
                if (var1 < 0) {
                    var5 = (var5 - Math.imul(var26, var1)) | 0;
                    var86 = (var86 - Math.imul(var27, var1)) | 0;
                    var7 = (var7 - Math.imul(var31, var1)) | 0;
                    var1 = 0;
                }

                var3 <<= 16;
                if (var0 < 0) {
                    var3 = (var3 - Math.imul(var28, var0)) | 0;
                    var0 = 0;
                }

                const var125 = (var1 - Pix3D.originY) | 0;
                var32 = (var32 + Math.imul(var34, var125)) | 0;
                var35 = (var35 + Math.imul(var37, var125)) | 0;
                var38 = (var38 + Math.imul(var40, var125)) | 0;
                if (var26 < var27) {
                    var2 = (var2 - var0) | 0;
                    var0 = (var0 - var1) | 0;

                    for (var1 = arrayAtI32(Pix3D.scanline, var1); --var0 >= 0; var38 = (var38 + var40) | 0) {
                        Pix3D.terrainTextureRaster(Pix2D.pixels, var19, 0, 0, var1, var5 >> 16, var86 >> 16, var7, var30, var32, var35, var38, var33, var36, var39);
                        var5 = (var5 + var26) | 0;
                        var86 = (var86 + var27) | 0;
                        var7 = (var7 + var31) | 0;
                        var1 = (var1 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                    }

                    while (--var2 >= 0) {
                        Pix3D.terrainTextureRaster(Pix2D.pixels, var19, 0, 0, var1, var3 >> 16, var86 >> 16, var7, var30, var32, var35, var38, var33, var36, var39);
                        var3 = (var3 + var28) | 0;
                        var86 = (var86 + var27) | 0;
                        var7 = (var7 + var31) | 0;
                        var1 = (var1 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                        var38 = (var38 + var40) | 0;
                    }
                } else {
                    var2 = (var2 - var0) | 0;
                    var0 = (var0 - var1) | 0;

                    for (var1 = arrayAtI32(Pix3D.scanline, var1); --var0 >= 0; var38 = (var38 + var40) | 0) {
                        Pix3D.terrainTextureRaster(Pix2D.pixels, var19, 0, 0, var1, var86 >> 16, var5 >> 16, var7, var30, var32, var35, var38, var33, var36, var39);
                        var5 = (var5 + var26) | 0;
                        var86 = (var86 + var27) | 0;
                        var7 = (var7 + var31) | 0;
                        var1 = (var1 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                    }

                    while (--var2 >= 0) {
                        Pix3D.terrainTextureRaster(Pix2D.pixels, var19, 0, 0, var1, var86 >> 16, var3 >> 16, var7, var30, var32, var35, var38, var33, var36, var39);
                        var3 = (var3 + var28) | 0;
                        var86 = (var86 + var27) | 0;
                        var7 = (var7 + var31) | 0;
                        var1 = (var1 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                        var38 = (var38 + var40) | 0;
                    }
                }
            }
        } else {
            if (var2 >= Pix3D.height) {
                return;
            }

            if (var0 > Pix3D.height) {
                var0 = Pix3D.height;
            }

            if (var1 > Pix3D.height) {
                var1 = Pix3D.height;
            }

            var8 = ((var8 << 9) - Math.imul(var30, var5) + var30) | 0;
            if (var0 < var1) {
                let var91: number;
                var4 = var91 = var5 << 16;
                if (var2 < 0) {
                    var4 = (var4 - Math.imul(var27, var2)) | 0;
                    var91 = (var91 - Math.imul(var28, var2)) | 0;
                    var8 = (var8 - Math.imul(var31, var2)) | 0;
                    var2 = 0;
                }

                var3 <<= 16;
                if (var0 < 0) {
                    var3 = (var3 - Math.imul(var26, var0)) | 0;
                    var0 = 0;
                }

                const var124 = (var2 - Pix3D.originY) | 0;
                var32 = (var32 + Math.imul(var34, var124)) | 0;
                var35 = (var35 + Math.imul(var37, var124)) | 0;
                var38 = (var38 + Math.imul(var40, var124)) | 0;
                if (var27 < var28) {
                    var1 = (var1 - var0) | 0;
                    var0 = (var0 - var2) | 0;

                    for (var2 = arrayAtI32(Pix3D.scanline, var2); --var0 >= 0; var38 = (var38 + var40) | 0) {
                        Pix3D.terrainTextureRaster(Pix2D.pixels, var19, 0, 0, var2, var4 >> 16, var91 >> 16, var8, var30, var32, var35, var38, var33, var36, var39);
                        var4 = (var4 + var27) | 0;
                        var91 = (var91 + var28) | 0;
                        var8 = (var8 + var31) | 0;
                        var2 = (var2 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                    }

                    while (--var1 >= 0) {
                        Pix3D.terrainTextureRaster(Pix2D.pixels, var19, 0, 0, var2, var4 >> 16, var3 >> 16, var8, var30, var32, var35, var38, var33, var36, var39);
                        var4 = (var4 + var27) | 0;
                        var3 = (var3 + var26) | 0;
                        var8 = (var8 + var31) | 0;
                        var2 = (var2 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                        var38 = (var38 + var40) | 0;
                    }
                } else {
                    var1 = (var1 - var0) | 0;
                    var0 = (var0 - var2) | 0;

                    for (var2 = arrayAtI32(Pix3D.scanline, var2); --var0 >= 0; var38 = (var38 + var40) | 0) {
                        Pix3D.terrainTextureRaster(Pix2D.pixels, var19, 0, 0, var2, var91 >> 16, var4 >> 16, var8, var30, var32, var35, var38, var33, var36, var39);
                        var4 = (var4 + var27) | 0;
                        var91 = (var91 + var28) | 0;
                        var8 = (var8 + var31) | 0;
                        var2 = (var2 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                    }

                    while (--var1 >= 0) {
                        Pix3D.terrainTextureRaster(Pix2D.pixels, var19, 0, 0, var2, var3 >> 16, var4 >> 16, var8, var30, var32, var35, var38, var33, var36, var39);
                        var4 = (var4 + var27) | 0;
                        var3 = (var3 + var26) | 0;
                        var8 = (var8 + var31) | 0;
                        var2 = (var2 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                        var38 = (var38 + var40) | 0;
                    }
                }
            } else {
                let var90: number;
                var3 = var90 = var5 << 16;
                if (var2 < 0) {
                    var3 = (var3 - Math.imul(var27, var2)) | 0;
                    var90 = (var90 - Math.imul(var28, var2)) | 0;
                    var8 = (var8 - Math.imul(var31, var2)) | 0;
                    var2 = 0;
                }

                var4 <<= 16;
                if (var1 < 0) {
                    var4 = (var4 - Math.imul(var26, var1)) | 0;
                    var1 = 0;
                }

                const var41 = (var2 - Pix3D.originY) | 0;
                var32 = (var32 + Math.imul(var34, var41)) | 0;
                var35 = (var35 + Math.imul(var37, var41)) | 0;
                var38 = (var38 + Math.imul(var40, var41)) | 0;
                if (var27 < var28) {
                    var0 = (var0 - var1) | 0;
                    var1 = (var1 - var2) | 0;

                    for (var2 = arrayAtI32(Pix3D.scanline, var2); --var1 >= 0; var38 = (var38 + var40) | 0) {
                        Pix3D.terrainTextureRaster(Pix2D.pixels, var19, 0, 0, var2, var3 >> 16, var90 >> 16, var8, var30, var32, var35, var38, var33, var36, var39);
                        var3 = (var3 + var27) | 0;
                        var90 = (var90 + var28) | 0;
                        var8 = (var8 + var31) | 0;
                        var2 = (var2 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                    }

                    while (--var0 >= 0) {
                        Pix3D.terrainTextureRaster(Pix2D.pixels, var19, 0, 0, var2, var4 >> 16, var90 >> 16, var8, var30, var32, var35, var38, var33, var36, var39);
                        var4 = (var4 + var26) | 0;
                        var90 = (var90 + var28) | 0;
                        var8 = (var8 + var31) | 0;
                        var2 = (var2 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                        var38 = (var38 + var40) | 0;
                    }
                } else {
                    var0 = (var0 - var1) | 0;
                    var1 = (var1 - var2) | 0;

                    for (var2 = arrayAtI32(Pix3D.scanline, var2); --var1 >= 0; var38 = (var38 + var40) | 0) {
                        Pix3D.terrainTextureRaster(Pix2D.pixels, var19, 0, 0, var2, var90 >> 16, var3 >> 16, var8, var30, var32, var35, var38, var33, var36, var39);
                        var3 = (var3 + var27) | 0;
                        var90 = (var90 + var28) | 0;
                        var8 = (var8 + var31) | 0;
                        var2 = (var2 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                    }

                    while (--var0 >= 0) {
                        Pix3D.terrainTextureRaster(Pix2D.pixels, var19, 0, 0, var2, var90 >> 16, var4 >> 16, var8, var30, var32, var35, var38, var33, var36, var39);
                        var4 = (var4 + var26) | 0;
                        var90 = (var90 + var28) | 0;
                        var8 = (var8 + var31) | 0;
                        var2 = (var2 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                        var38 = (var38 + var40) | 0;
                    }
                }
            }
        }
    }

    // dc.b([I[IIIIIIIIIIIIII)V
    // Same parameters as terrainTextureRaster; the perspective divide is done every 8 pixels.
    private static textureRaster(
        var0: Int32Array | null,
        var1: Int32Array | null,
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
        var14: number
    ): void {
        if (Pix3D.hclip) {
            if (var6 > Pix3D.width) {
                var6 = Pix3D.width;
            }

            if (var5 < 0) {
                var5 = 0;
            }
        }

        if (var5 >= var6) {
            return;
        }

        if (Pix3D.spanTarget !== null && Pix3D.spanTarget.record(var0, 3, var4, var5, var6, var7, var8, 0, (Pix3D.lowMemTexture ? 1 : 0) | (Pix3D.opaque ? 2 : 0), var1, Pix3D.originX, var9, var10, var11, var12, var13, var14)) return;

        var4 = (var4 + var5) | 0;
        var7 = (var7 + Math.imul(var8, var5)) | 0;
        let var17 = (var6 - var5) | 0;
        if (Pix3D.lowMemTexture) {
            const var23 = (var5 - Pix3D.originX) | 0;
            var9 = (var9 + Math.imul(var12 >> 3, var23)) | 0;
            var10 = (var10 + Math.imul(var13 >> 3, var23)) | 0;
            var11 = (var11 + Math.imul(var14 >> 3, var23)) | 0;
            let var22 = var11 >> 12;
            let var18: number;
            let var19: number;
            if (var22 !== 0) {
                var18 = (var9 / var22) | 0;
                var19 = (var10 / var22) | 0;
            } else {
                var18 = 0;
                var19 = 0;
            }

            var9 = (var9 + var12) | 0;
            var10 = (var10 + var13) | 0;
            var11 = (var11 + var14) | 0;
            var22 = var11 >> 12;
            let var20: number;
            let var21: number;
            if (var22 !== 0) {
                var20 = (var9 / var22) | 0;
                var21 = (var10 / var22) | 0;
            } else {
                var20 = 0;
                var21 = 0;
            }

            var2 = ((var18 << 20) + var19) | 0;
            let var16 = ((((var20 - var18) >> 3) << 20) + ((var21 - var19) >> 3)) | 0;
            var17 >>= 3;
            var8 <<= 3;
            let var15 = var7 >> 8;
            if (Pix3D.opaque) {
                if (var17 > 0) {
                    do {
                        var3 = arrayAtI32(var1, (var2 & 4032) + (var2 >>> 26));
                        arrayPutI32(var0, var4++, ((Math.imul(var3 & 16711935, var15) & -16711936) + (Math.imul(var3 & 0xff00, var15) & 0xff0000)) >> 8);
                        var2 = (var2 + var16) | 0;
                        var3 = arrayAtI32(var1, (var2 & 4032) + (var2 >>> 26));
                        arrayPutI32(var0, var4++, ((Math.imul(var3 & 16711935, var15) & -16711936) + (Math.imul(var3 & 0xff00, var15) & 0xff0000)) >> 8);
                        var2 = (var2 + var16) | 0;
                        var3 = arrayAtI32(var1, (var2 & 4032) + (var2 >>> 26));
                        arrayPutI32(var0, var4++, ((Math.imul(var3 & 16711935, var15) & -16711936) + (Math.imul(var3 & 0xff00, var15) & 0xff0000)) >> 8);
                        var2 = (var2 + var16) | 0;
                        var3 = arrayAtI32(var1, (var2 & 4032) + (var2 >>> 26));
                        arrayPutI32(var0, var4++, ((Math.imul(var3 & 16711935, var15) & -16711936) + (Math.imul(var3 & 0xff00, var15) & 0xff0000)) >> 8);
                        var2 = (var2 + var16) | 0;
                        var3 = arrayAtI32(var1, (var2 & 4032) + (var2 >>> 26));
                        arrayPutI32(var0, var4++, ((Math.imul(var3 & 16711935, var15) & -16711936) + (Math.imul(var3 & 0xff00, var15) & 0xff0000)) >> 8);
                        var2 = (var2 + var16) | 0;
                        var3 = arrayAtI32(var1, (var2 & 4032) + (var2 >>> 26));
                        arrayPutI32(var0, var4++, ((Math.imul(var3 & 16711935, var15) & -16711936) + (Math.imul(var3 & 0xff00, var15) & 0xff0000)) >> 8);
                        var2 = (var2 + var16) | 0;
                        var3 = arrayAtI32(var1, (var2 & 4032) + (var2 >>> 26));
                        arrayPutI32(var0, var4++, ((Math.imul(var3 & 16711935, var15) & -16711936) + (Math.imul(var3 & 0xff00, var15) & 0xff0000)) >> 8);
                        var2 = (var2 + var16) | 0;
                        var3 = arrayAtI32(var1, (var2 & 4032) + (var2 >>> 26));
                        arrayPutI32(var0, var4++, ((Math.imul(var3 & 16711935, var15) & -16711936) + (Math.imul(var3 & 0xff00, var15) & 0xff0000)) >> 8);
                        var2 = (var2 + var16) | 0;
                        var18 = var20;
                        var19 = var21;
                        var9 = (var9 + var12) | 0;
                        var10 = (var10 + var13) | 0;
                        var11 = (var11 + var14) | 0;
                        var22 = var11 >> 12;
                        if (var22 !== 0) {
                            var20 = (var9 / var22) | 0;
                            var21 = (var10 / var22) | 0;
                        } else {
                            var20 = 0;
                            var21 = 0;
                        }

                        var2 = ((var18 << 20) + var19) | 0;
                        var16 = ((((var20 - var18) >> 3) << 20) + ((var21 - var19) >> 3)) | 0;
                        var7 = (var7 + var8) | 0;
                        var15 = var7 >> 8;
                    } while (--var17 > 0);
                }

                var17 = (var6 - var5) & 7;
                if (var17 > 0) {
                    do {
                        var3 = arrayAtI32(var1, (var2 & 4032) + (var2 >>> 26));
                        arrayPutI32(var0, var4++, ((Math.imul(var3 & 16711935, var15) & -16711936) + (Math.imul(var3 & 0xff00, var15) & 0xff0000)) >> 8);
                        var2 = (var2 + var16) | 0;
                    } while (--var17 > 0);

                    return;
                }

                return;
            }

            if (var17 > 0) {
                do {
                    if ((var3 = arrayAtI32(var1, (var2 & 4032) + (var2 >>> 26))) !== 0) {
                        arrayPutI32(var0, var4, ((Math.imul(var3 & 16711935, var15) & -16711936) + (Math.imul(var3 & 0xff00, var15) & 0xff0000)) >> 8);
                    }

                    var4++;
                    var2 = (var2 + var16) | 0;
                    if ((var3 = arrayAtI32(var1, (var2 & 4032) + (var2 >>> 26))) !== 0) {
                        arrayPutI32(var0, var4, ((Math.imul(var3 & 16711935, var15) & -16711936) + (Math.imul(var3 & 0xff00, var15) & 0xff0000)) >> 8);
                    }

                    var4++;
                    var2 = (var2 + var16) | 0;
                    if ((var3 = arrayAtI32(var1, (var2 & 4032) + (var2 >>> 26))) !== 0) {
                        arrayPutI32(var0, var4, ((Math.imul(var3 & 16711935, var15) & -16711936) + (Math.imul(var3 & 0xff00, var15) & 0xff0000)) >> 8);
                    }

                    var4++;
                    var2 = (var2 + var16) | 0;
                    if ((var3 = arrayAtI32(var1, (var2 & 4032) + (var2 >>> 26))) !== 0) {
                        arrayPutI32(var0, var4, ((Math.imul(var3 & 16711935, var15) & -16711936) + (Math.imul(var3 & 0xff00, var15) & 0xff0000)) >> 8);
                    }

                    var4++;
                    var2 = (var2 + var16) | 0;
                    if ((var3 = arrayAtI32(var1, (var2 & 4032) + (var2 >>> 26))) !== 0) {
                        arrayPutI32(var0, var4, ((Math.imul(var3 & 16711935, var15) & -16711936) + (Math.imul(var3 & 0xff00, var15) & 0xff0000)) >> 8);
                    }

                    var4++;
                    var2 = (var2 + var16) | 0;
                    if ((var3 = arrayAtI32(var1, (var2 & 4032) + (var2 >>> 26))) !== 0) {
                        arrayPutI32(var0, var4, ((Math.imul(var3 & 16711935, var15) & -16711936) + (Math.imul(var3 & 0xff00, var15) & 0xff0000)) >> 8);
                    }

                    var4++;
                    var2 = (var2 + var16) | 0;
                    if ((var3 = arrayAtI32(var1, (var2 & 4032) + (var2 >>> 26))) !== 0) {
                        arrayPutI32(var0, var4, ((Math.imul(var3 & 16711935, var15) & -16711936) + (Math.imul(var3 & 0xff00, var15) & 0xff0000)) >> 8);
                    }

                    var4++;
                    var2 = (var2 + var16) | 0;
                    if ((var3 = arrayAtI32(var1, (var2 & 4032) + (var2 >>> 26))) !== 0) {
                        arrayPutI32(var0, var4, ((Math.imul(var3 & 16711935, var15) & -16711936) + (Math.imul(var3 & 0xff00, var15) & 0xff0000)) >> 8);
                    }

                    var4++;
                    var2 = (var2 + var16) | 0;
                    var18 = var20;
                    var19 = var21;
                    var9 = (var9 + var12) | 0;
                    var10 = (var10 + var13) | 0;
                    var11 = (var11 + var14) | 0;
                    var22 = var11 >> 12;
                    if (var22 !== 0) {
                        var20 = (var9 / var22) | 0;
                        var21 = (var10 / var22) | 0;
                    } else {
                        var20 = 0;
                        var21 = 0;
                    }

                    var2 = ((var18 << 20) + var19) | 0;
                    var16 = ((((var20 - var18) >> 3) << 20) + ((var21 - var19) >> 3)) | 0;
                    var7 = (var7 + var8) | 0;
                    var15 = var7 >> 8;
                } while (--var17 > 0);
            }

            var17 = (var6 - var5) & 7;
            if (var17 > 0) {
                do {
                    if ((var3 = arrayAtI32(var1, (var2 & 4032) + (var2 >>> 26))) !== 0) {
                        arrayPutI32(var0, var4, ((Math.imul(var3 & 16711935, var15) & -16711936) + (Math.imul(var3 & 0xff00, var15) & 0xff0000)) >> 8);
                    }

                    var4++;
                    var2 = (var2 + var16) | 0;
                } while (--var17 > 0);

                return;
            }
        } else {
            const var165 = (var5 - Pix3D.originX) | 0;
            var9 = (var9 + Math.imul(var12 >> 3, var165)) | 0;
            var10 = (var10 + Math.imul(var13 >> 3, var165)) | 0;
            var11 = (var11 + Math.imul(var14 >> 3, var165)) | 0;
            let var161 = var11 >> 14;
            let var148: number;
            let var153: number;
            if (var161 !== 0) {
                var148 = (var9 / var161) | 0;
                var153 = (var10 / var161) | 0;
            } else {
                var148 = 0;
                var153 = 0;
            }

            var9 = (var9 + var12) | 0;
            var10 = (var10 + var13) | 0;
            var11 = (var11 + var14) | 0;
            var161 = var11 >> 14;
            let var156: number;
            let var157: number;
            if (var161 !== 0) {
                var156 = (var9 / var161) | 0;
                var157 = (var10 / var161) | 0;
            } else {
                var156 = 0;
                var157 = 0;
            }

            var2 = ((var148 << 18) + var153) | 0;
            let var139 = ((((var156 - var148) >> 3) << 18) + ((var157 - var153) >> 3)) | 0;
            var17 >>= 3;
            var8 <<= 3;
            let var138 = var7 >> 8;
            if (Pix3D.opaque) {
                if (var17 > 0) {
                    do {
                        var3 = arrayAtI32(var1, (var2 & 16256) + (var2 >>> 25));
                        arrayPutI32(var0, var4++, ((Math.imul(var3 & 16711935, var138) & -16711936) + (Math.imul(var3 & 0xff00, var138) & 0xff0000)) >> 8);
                        var2 = (var2 + var139) | 0;
                        var3 = arrayAtI32(var1, (var2 & 16256) + (var2 >>> 25));
                        arrayPutI32(var0, var4++, ((Math.imul(var3 & 16711935, var138) & -16711936) + (Math.imul(var3 & 0xff00, var138) & 0xff0000)) >> 8);
                        var2 = (var2 + var139) | 0;
                        var3 = arrayAtI32(var1, (var2 & 16256) + (var2 >>> 25));
                        arrayPutI32(var0, var4++, ((Math.imul(var3 & 16711935, var138) & -16711936) + (Math.imul(var3 & 0xff00, var138) & 0xff0000)) >> 8);
                        var2 = (var2 + var139) | 0;
                        var3 = arrayAtI32(var1, (var2 & 16256) + (var2 >>> 25));
                        arrayPutI32(var0, var4++, ((Math.imul(var3 & 16711935, var138) & -16711936) + (Math.imul(var3 & 0xff00, var138) & 0xff0000)) >> 8);
                        var2 = (var2 + var139) | 0;
                        var3 = arrayAtI32(var1, (var2 & 16256) + (var2 >>> 25));
                        arrayPutI32(var0, var4++, ((Math.imul(var3 & 16711935, var138) & -16711936) + (Math.imul(var3 & 0xff00, var138) & 0xff0000)) >> 8);
                        var2 = (var2 + var139) | 0;
                        var3 = arrayAtI32(var1, (var2 & 16256) + (var2 >>> 25));
                        arrayPutI32(var0, var4++, ((Math.imul(var3 & 16711935, var138) & -16711936) + (Math.imul(var3 & 0xff00, var138) & 0xff0000)) >> 8);
                        var2 = (var2 + var139) | 0;
                        var3 = arrayAtI32(var1, (var2 & 16256) + (var2 >>> 25));
                        arrayPutI32(var0, var4++, ((Math.imul(var3 & 16711935, var138) & -16711936) + (Math.imul(var3 & 0xff00, var138) & 0xff0000)) >> 8);
                        var2 = (var2 + var139) | 0;
                        var3 = arrayAtI32(var1, (var2 & 16256) + (var2 >>> 25));
                        arrayPutI32(var0, var4++, ((Math.imul(var3 & 16711935, var138) & -16711936) + (Math.imul(var3 & 0xff00, var138) & 0xff0000)) >> 8);
                        var2 = (var2 + var139) | 0;
                        var148 = var156;
                        var153 = var157;
                        var9 = (var9 + var12) | 0;
                        var10 = (var10 + var13) | 0;
                        var11 = (var11 + var14) | 0;
                        var161 = var11 >> 14;
                        if (var161 !== 0) {
                            var156 = (var9 / var161) | 0;
                            var157 = (var10 / var161) | 0;
                        } else {
                            var156 = 0;
                            var157 = 0;
                        }

                        var2 = ((var148 << 18) + var153) | 0;
                        var139 = ((((var156 - var148) >> 3) << 18) + ((var157 - var153) >> 3)) | 0;
                        var7 = (var7 + var8) | 0;
                        var138 = var7 >> 8;
                    } while (--var17 > 0);
                }

                var17 = (var6 - var5) & 7;
                if (var17 > 0) {
                    do {
                        var3 = arrayAtI32(var1, (var2 & 16256) + (var2 >>> 25));
                        arrayPutI32(var0, var4++, ((Math.imul(var3 & 16711935, var138) & -16711936) + (Math.imul(var3 & 0xff00, var138) & 0xff0000)) >> 8);
                        var2 = (var2 + var139) | 0;
                    } while (--var17 > 0);

                    return;
                }
            } else {
                if (var17 > 0) {
                    do {
                        if ((var3 = arrayAtI32(var1, (var2 & 16256) + (var2 >>> 25))) !== 0) {
                            arrayPutI32(var0, var4, ((Math.imul(var3 & 16711935, var138) & -16711936) + (Math.imul(var3 & 0xff00, var138) & 0xff0000)) >> 8);
                        }

                        var4++;
                        var2 = (var2 + var139) | 0;
                        if ((var3 = arrayAtI32(var1, (var2 & 16256) + (var2 >>> 25))) !== 0) {
                            arrayPutI32(var0, var4, ((Math.imul(var3 & 16711935, var138) & -16711936) + (Math.imul(var3 & 0xff00, var138) & 0xff0000)) >> 8);
                        }

                        var4++;
                        var2 = (var2 + var139) | 0;
                        if ((var3 = arrayAtI32(var1, (var2 & 16256) + (var2 >>> 25))) !== 0) {
                            arrayPutI32(var0, var4, ((Math.imul(var3 & 16711935, var138) & -16711936) + (Math.imul(var3 & 0xff00, var138) & 0xff0000)) >> 8);
                        }

                        var4++;
                        var2 = (var2 + var139) | 0;
                        if ((var3 = arrayAtI32(var1, (var2 & 16256) + (var2 >>> 25))) !== 0) {
                            arrayPutI32(var0, var4, ((Math.imul(var3 & 16711935, var138) & -16711936) + (Math.imul(var3 & 0xff00, var138) & 0xff0000)) >> 8);
                        }

                        var4++;
                        var2 = (var2 + var139) | 0;
                        if ((var3 = arrayAtI32(var1, (var2 & 16256) + (var2 >>> 25))) !== 0) {
                            arrayPutI32(var0, var4, ((Math.imul(var3 & 16711935, var138) & -16711936) + (Math.imul(var3 & 0xff00, var138) & 0xff0000)) >> 8);
                        }

                        var4++;
                        var2 = (var2 + var139) | 0;
                        if ((var3 = arrayAtI32(var1, (var2 & 16256) + (var2 >>> 25))) !== 0) {
                            arrayPutI32(var0, var4, ((Math.imul(var3 & 16711935, var138) & -16711936) + (Math.imul(var3 & 0xff00, var138) & 0xff0000)) >> 8);
                        }

                        var4++;
                        var2 = (var2 + var139) | 0;
                        if ((var3 = arrayAtI32(var1, (var2 & 16256) + (var2 >>> 25))) !== 0) {
                            arrayPutI32(var0, var4, ((Math.imul(var3 & 16711935, var138) & -16711936) + (Math.imul(var3 & 0xff00, var138) & 0xff0000)) >> 8);
                        }

                        var4++;
                        var2 = (var2 + var139) | 0;
                        if ((var3 = arrayAtI32(var1, (var2 & 16256) + (var2 >>> 25))) !== 0) {
                            arrayPutI32(var0, var4, ((Math.imul(var3 & 16711935, var138) & -16711936) + (Math.imul(var3 & 0xff00, var138) & 0xff0000)) >> 8);
                        }

                        var4++;
                        var2 = (var2 + var139) | 0;
                        var148 = var156;
                        var153 = var157;
                        var9 = (var9 + var12) | 0;
                        var10 = (var10 + var13) | 0;
                        var11 = (var11 + var14) | 0;
                        var161 = var11 >> 14;
                        if (var161 !== 0) {
                            var156 = (var9 / var161) | 0;
                            var157 = (var10 / var161) | 0;
                        } else {
                            var156 = 0;
                            var157 = 0;
                        }

                        var2 = ((var148 << 18) + var153) | 0;
                        var139 = ((((var156 - var148) >> 3) << 18) + ((var157 - var153) >> 3)) | 0;
                        var7 = (var7 + var8) | 0;
                        var138 = var7 >> 8;
                    } while (--var17 > 0);
                }

                var17 = (var6 - var5) & 7;
                if (var17 > 0) {
                    do {
                        if ((var3 = arrayAtI32(var1, (var2 & 16256) + (var2 >>> 25))) !== 0) {
                            arrayPutI32(var0, var4, ((Math.imul(var3 & 16711935, var138) & -16711936) + (Math.imul(var3 & 0xff00, var138) & 0xff0000)) >> 8);
                        }

                        var4++;
                        var2 = (var2 + var139) | 0;
                    } while (--var17 > 0);
                }
            }
        }
    }

    // dc.a([IIIIII)V
    // var1 = row offset, var2 = RGB, var4/var5 = x span. var3 is a scratch register the callers pass as 0.
    private static flatRaster(var0: Int32Array | null, var1: number, var2: number, var3: number, var4: number, var5: number): void {
        if (Pix3D.hclip) {
            if (var5 > Pix3D.width) {
                var5 = Pix3D.width;
            }

            if (var4 < 0) {
                var4 = 0;
            }
        }

        if (var4 >= var5) {
            return;
        }

        if (Pix3D.spanTarget !== null && Pix3D.spanTarget.record(var0, 0, var1, var4, var5, var2, 0, Pix3D.trans, 0, null)) return;

        var1 = (var1 + var4) | 0;
        var3 = (var5 - var4) >> 2;
        if (Pix3D.trans === 0) {
            while (--var3 >= 0) {
                arrayPutI32(var0, var1++, var2);
                arrayPutI32(var0, var1++, var2);
                arrayPutI32(var0, var1++, var2);
                arrayPutI32(var0, var1++, var2);
            }

            var3 = (var5 - var4) & 3;

            while (--var3 >= 0) {
                arrayPutI32(var0, var1++, var2);
            }
        } else if (Pix3D.trans === 254) {
            while (--var3 >= 0) {
                arrayPutI32(var0, var1++, arrayAtI32(var0, var1));
                arrayPutI32(var0, var1++, arrayAtI32(var0, var1));
                arrayPutI32(var0, var1++, arrayAtI32(var0, var1));
                arrayPutI32(var0, var1++, arrayAtI32(var0, var1));
            }

            var3 = (var5 - var4) & 3;

            while (--var3 >= 0) {
                arrayPutI32(var0, var1++, arrayAtI32(var0, var1));
            }
        } else {
            const var6 = Pix3D.trans;
            const var7 = (256 - Pix3D.trans) | 0;
            var2 = (((Math.imul(var2 & 16711935, var7) >> 8) & 16711935) + ((Math.imul(var2 & 0xff00, var7) >> 8) & 0xff00)) | 0;

            while (--var3 >= 0) {
                let var8 = arrayAtI32(var0, var1);
                arrayPutI32(var0, var1++, (var2 + ((Math.imul(var8 & 16711935, var6) >> 8) & 16711935) + ((Math.imul(var8 & 0xff00, var6) >> 8) & 0xff00)) | 0);
                var8 = arrayAtI32(var0, var1);
                arrayPutI32(var0, var1++, (var2 + ((Math.imul(var8 & 16711935, var6) >> 8) & 16711935) + ((Math.imul(var8 & 0xff00, var6) >> 8) & 0xff00)) | 0);
                var8 = arrayAtI32(var0, var1);
                arrayPutI32(var0, var1++, (var2 + ((Math.imul(var8 & 16711935, var6) >> 8) & 16711935) + ((Math.imul(var8 & 0xff00, var6) >> 8) & 0xff00)) | 0);
                var8 = arrayAtI32(var0, var1);
                arrayPutI32(var0, var1++, (var2 + ((Math.imul(var8 & 16711935, var6) >> 8) & 16711935) + ((Math.imul(var8 & 0xff00, var6) >> 8) & 0xff00)) | 0);
            }

            var3 = (var5 - var4) & 3;

            while (--var3 >= 0) {
                const var27 = arrayAtI32(var0, var1);
                arrayPutI32(var0, var1++, (var2 + ((Math.imul(var27 & 16711935, var6) >> 8) & 16711935) + ((Math.imul(var27 & 0xff00, var6) >> 8) & 0xff00)) | 0);
            }
        }
    }

    // dc.b()V
    static unload(): void {
        Pix3D.scanline = null;
        Pix3D.colourTable = null;
        Pix3D.textureProvider = null;
        Pix3D.divTable = null;
        Pix3D.divTable2 = null;
        Pix3D.sinTable = null;
        Pix3D.cosTable = null;
    }

    // dc.c()I
    static getOffsetY(): number {
        return intDivide(arrayAtI32(Pix3D.scanline, 0), Pix2D.width);
    }

    // dc.d()V
    static setRenderClipping(): void {
        Pix3D.setBounds(Pix2D.clipMinX, Pix2D.clipMinY, Pix2D.clipMaxX, Pix2D.clipMaxY);
    }

    // dc.a(II)I
    private static adjustLightness(var0: number, var1: number): number {
        var1 = Math.imul(var1, var0 & 127) >> 7;
        if (var1 < 2) {
            var1 = 2;
        } else if (var1 > 126) {
            var1 = 126;
        }

        return ((var0 & 65408) + var1) | 0;
    }

    // dc.b(IIIIIIIIIIIIIIIIIII)V
    // Same parameters as terrainTextureTriangle.
    static textureTriangle(
        var0: number,
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
        var18: number
    ): void {
        const var19 = requireNonNull(Pix3D.textureProvider).getTextureData(var18, Pix3D.brightness);
        if (var19 === null || Pix3D.trans > 10) {
            const var20 = requireNonNull(Pix3D.textureProvider).getTextureColour(var18);
            Pix3D.textureFallback = true;
            Pix3D.gouraudTriangle(var0, var1, var2, var3, var4, var5, Pix3D.adjustLightness(var20, var6), Pix3D.adjustLightness(var20, var7), Pix3D.adjustLightness(var20, var8));
            return;
        }

        Pix3D.lowMemTexture = requireNonNull(Pix3D.textureProvider).getTextureSmall(var18);
        Pix3D.opaque = requireNonNull(Pix3D.textureProvider).getTextureSolid(var18);

        const var105 = (var4 - var3) | 0;
        const var21 = (var1 - var0) | 0;
        const var22 = (var5 - var3) | 0;
        const var23 = (var2 - var0) | 0;
        const var24 = (var7 - var6) | 0;
        const var25 = (var8 - var6) | 0;
        let var26 = 0;
        if (var1 !== var0) {
            var26 = (((var4 - var3) << 16) / ((var1 - var0) | 0)) | 0;
        }

        let var27 = 0;
        if (var2 !== var1) {
            var27 = (((var5 - var4) << 16) / ((var2 - var1) | 0)) | 0;
        }

        let var28 = 0;
        if (var2 !== var0) {
            var28 = (((var3 - var5) << 16) / ((var0 - var2) | 0)) | 0;
        }

        const var29 = (Math.imul(var105, var23) - Math.imul(var22, var21)) | 0;
        if (var29 === 0) {
            return;
        }

        const var30 = (((Math.imul(var24, var23) - Math.imul(var25, var21)) << 9) / var29) | 0;
        const var31 = (((Math.imul(var25, var105) - Math.imul(var24, var22)) << 9) / var29) | 0;
        var10 = (var9 - var10) | 0;
        var13 = (var12 - var13) | 0;
        var16 = (var15 - var16) | 0;
        var11 = (var11 - var9) | 0;
        var14 = (var14 - var12) | 0;
        var17 = (var17 - var15) | 0;
        let var32 = (Math.imul(var11, var12) - Math.imul(var14, var9)) << 14;
        const var33 = (Math.imul(var14, var15) - Math.imul(var17, var12)) << 8;
        const var34 = (Math.imul(var17, var9) - Math.imul(var11, var15)) << 5;
        let var35 = (Math.imul(var10, var12) - Math.imul(var13, var9)) << 14;
        const var36 = (Math.imul(var13, var15) - Math.imul(var16, var12)) << 8;
        const var37 = (Math.imul(var16, var9) - Math.imul(var10, var15)) << 5;
        let var38 = (Math.imul(var13, var11) - Math.imul(var10, var14)) << 14;
        const var39 = (Math.imul(var16, var14) - Math.imul(var13, var17)) << 8;
        const var40 = (Math.imul(var10, var17) - Math.imul(var16, var11)) << 5;
        if (var0 <= var1 && var0 <= var2) {
            if (var0 >= Pix3D.height) {
                return;
            }

            if (var1 > Pix3D.height) {
                var1 = Pix3D.height;
            }

            if (var2 > Pix3D.height) {
                var2 = Pix3D.height;
            }

            var6 = ((var6 << 9) - Math.imul(var30, var3) + var30) | 0;
            if (var1 < var2) {
                let var83: number;
                var5 = var83 = var3 << 16;
                if (var0 < 0) {
                    var5 = (var5 - Math.imul(var28, var0)) | 0;
                    var83 = (var83 - Math.imul(var26, var0)) | 0;
                    var6 = (var6 - Math.imul(var31, var0)) | 0;
                    var0 = 0;
                }

                var4 <<= 16;
                if (var1 < 0) {
                    var4 = (var4 - Math.imul(var27, var1)) | 0;
                    var1 = 0;
                }

                const var128 = (var0 - Pix3D.originY) | 0;
                var32 = (var32 + Math.imul(var34, var128)) | 0;
                var35 = (var35 + Math.imul(var37, var128)) | 0;
                var38 = (var38 + Math.imul(var40, var128)) | 0;
                if ((var0 !== var1 && var28 < var26) || (var0 === var1 && var28 > var27)) {
                    var2 = (var2 - var1) | 0;
                    var1 = (var1 - var0) | 0;

                    for (var0 = arrayAtI32(Pix3D.scanline, var0); --var1 >= 0; var38 = (var38 + var40) | 0) {
                        Pix3D.textureRaster(Pix2D.pixels, var19, 0, 0, var0, var5 >> 16, var83 >> 16, var6, var30, var32, var35, var38, var33, var36, var39);
                        var5 = (var5 + var28) | 0;
                        var83 = (var83 + var26) | 0;
                        var6 = (var6 + var31) | 0;
                        var0 = (var0 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                    }

                    while (--var2 >= 0) {
                        Pix3D.textureRaster(Pix2D.pixels, var19, 0, 0, var0, var5 >> 16, var4 >> 16, var6, var30, var32, var35, var38, var33, var36, var39);
                        var5 = (var5 + var28) | 0;
                        var4 = (var4 + var27) | 0;
                        var6 = (var6 + var31) | 0;
                        var0 = (var0 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                        var38 = (var38 + var40) | 0;
                    }
                } else {
                    var2 = (var2 - var1) | 0;
                    var1 = (var1 - var0) | 0;

                    for (var0 = arrayAtI32(Pix3D.scanline, var0); --var1 >= 0; var38 = (var38 + var40) | 0) {
                        Pix3D.textureRaster(Pix2D.pixels, var19, 0, 0, var0, var83 >> 16, var5 >> 16, var6, var30, var32, var35, var38, var33, var36, var39);
                        var5 = (var5 + var28) | 0;
                        var83 = (var83 + var26) | 0;
                        var6 = (var6 + var31) | 0;
                        var0 = (var0 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                    }

                    while (--var2 >= 0) {
                        Pix3D.textureRaster(Pix2D.pixels, var19, 0, 0, var0, var4 >> 16, var5 >> 16, var6, var30, var32, var35, var38, var33, var36, var39);
                        var5 = (var5 + var28) | 0;
                        var4 = (var4 + var27) | 0;
                        var6 = (var6 + var31) | 0;
                        var0 = (var0 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                        var38 = (var38 + var40) | 0;
                    }
                }
            } else {
                let var82: number;
                var4 = var82 = var3 << 16;
                if (var0 < 0) {
                    var4 = (var4 - Math.imul(var28, var0)) | 0;
                    var82 = (var82 - Math.imul(var26, var0)) | 0;
                    var6 = (var6 - Math.imul(var31, var0)) | 0;
                    var0 = 0;
                }

                var5 <<= 16;
                if (var2 < 0) {
                    var5 = (var5 - Math.imul(var27, var2)) | 0;
                    var2 = 0;
                }

                const var127 = (var0 - Pix3D.originY) | 0;
                var32 = (var32 + Math.imul(var34, var127)) | 0;
                var35 = (var35 + Math.imul(var37, var127)) | 0;
                var38 = (var38 + Math.imul(var40, var127)) | 0;
                if ((var0 !== var2 && var28 < var26) || (var0 === var2 && var27 > var26)) {
                    var1 = (var1 - var2) | 0;
                    var2 = (var2 - var0) | 0;

                    for (var0 = arrayAtI32(Pix3D.scanline, var0); --var2 >= 0; var38 = (var38 + var40) | 0) {
                        Pix3D.textureRaster(Pix2D.pixels, var19, 0, 0, var0, var4 >> 16, var82 >> 16, var6, var30, var32, var35, var38, var33, var36, var39);
                        var4 = (var4 + var28) | 0;
                        var82 = (var82 + var26) | 0;
                        var6 = (var6 + var31) | 0;
                        var0 = (var0 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                    }

                    while (--var1 >= 0) {
                        Pix3D.textureRaster(Pix2D.pixels, var19, 0, 0, var0, var5 >> 16, var82 >> 16, var6, var30, var32, var35, var38, var33, var36, var39);
                        var5 = (var5 + var27) | 0;
                        var82 = (var82 + var26) | 0;
                        var6 = (var6 + var31) | 0;
                        var0 = (var0 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                        var38 = (var38 + var40) | 0;
                    }
                } else {
                    var1 = (var1 - var2) | 0;
                    var2 = (var2 - var0) | 0;

                    for (var0 = arrayAtI32(Pix3D.scanline, var0); --var2 >= 0; var38 = (var38 + var40) | 0) {
                        Pix3D.textureRaster(Pix2D.pixels, var19, 0, 0, var0, var82 >> 16, var4 >> 16, var6, var30, var32, var35, var38, var33, var36, var39);
                        var4 = (var4 + var28) | 0;
                        var82 = (var82 + var26) | 0;
                        var6 = (var6 + var31) | 0;
                        var0 = (var0 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                    }

                    while (--var1 >= 0) {
                        Pix3D.textureRaster(Pix2D.pixels, var19, 0, 0, var0, var82 >> 16, var5 >> 16, var6, var30, var32, var35, var38, var33, var36, var39);
                        var5 = (var5 + var27) | 0;
                        var82 = (var82 + var26) | 0;
                        var6 = (var6 + var31) | 0;
                        var0 = (var0 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                        var38 = (var38 + var40) | 0;
                    }
                }
            }
        } else if (var1 <= var2) {
            if (var1 >= Pix3D.height) {
                return;
            }

            if (var2 > Pix3D.height) {
                var2 = Pix3D.height;
            }

            if (var0 > Pix3D.height) {
                var0 = Pix3D.height;
            }

            var7 = ((var7 << 9) - Math.imul(var30, var4) + var30) | 0;
            if (var2 < var0) {
                let var87: number;
                var3 = var87 = var4 << 16;
                if (var1 < 0) {
                    var3 = (var3 - Math.imul(var26, var1)) | 0;
                    var87 = (var87 - Math.imul(var27, var1)) | 0;
                    var7 = (var7 - Math.imul(var31, var1)) | 0;
                    var1 = 0;
                }

                var5 <<= 16;
                if (var2 < 0) {
                    var5 = (var5 - Math.imul(var28, var2)) | 0;
                    var2 = 0;
                }

                const var126 = (var1 - Pix3D.originY) | 0;
                var32 = (var32 + Math.imul(var34, var126)) | 0;
                var35 = (var35 + Math.imul(var37, var126)) | 0;
                var38 = (var38 + Math.imul(var40, var126)) | 0;
                if ((var1 !== var2 && var26 < var27) || (var1 === var2 && var26 > var28)) {
                    var0 = (var0 - var2) | 0;
                    var2 = (var2 - var1) | 0;

                    for (var1 = arrayAtI32(Pix3D.scanline, var1); --var2 >= 0; var38 = (var38 + var40) | 0) {
                        Pix3D.textureRaster(Pix2D.pixels, var19, 0, 0, var1, var3 >> 16, var87 >> 16, var7, var30, var32, var35, var38, var33, var36, var39);
                        var3 = (var3 + var26) | 0;
                        var87 = (var87 + var27) | 0;
                        var7 = (var7 + var31) | 0;
                        var1 = (var1 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                    }

                    while (--var0 >= 0) {
                        Pix3D.textureRaster(Pix2D.pixels, var19, 0, 0, var1, var3 >> 16, var5 >> 16, var7, var30, var32, var35, var38, var33, var36, var39);
                        var3 = (var3 + var26) | 0;
                        var5 = (var5 + var28) | 0;
                        var7 = (var7 + var31) | 0;
                        var1 = (var1 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                        var38 = (var38 + var40) | 0;
                    }
                } else {
                    var0 = (var0 - var2) | 0;
                    var2 = (var2 - var1) | 0;

                    for (var1 = arrayAtI32(Pix3D.scanline, var1); --var2 >= 0; var38 = (var38 + var40) | 0) {
                        Pix3D.textureRaster(Pix2D.pixels, var19, 0, 0, var1, var87 >> 16, var3 >> 16, var7, var30, var32, var35, var38, var33, var36, var39);
                        var3 = (var3 + var26) | 0;
                        var87 = (var87 + var27) | 0;
                        var7 = (var7 + var31) | 0;
                        var1 = (var1 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                    }

                    while (--var0 >= 0) {
                        Pix3D.textureRaster(Pix2D.pixels, var19, 0, 0, var1, var5 >> 16, var3 >> 16, var7, var30, var32, var35, var38, var33, var36, var39);
                        var3 = (var3 + var26) | 0;
                        var5 = (var5 + var28) | 0;
                        var7 = (var7 + var31) | 0;
                        var1 = (var1 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                        var38 = (var38 + var40) | 0;
                    }
                }
            } else {
                let var86: number;
                var5 = var86 = var4 << 16;
                if (var1 < 0) {
                    var5 = (var5 - Math.imul(var26, var1)) | 0;
                    var86 = (var86 - Math.imul(var27, var1)) | 0;
                    var7 = (var7 - Math.imul(var31, var1)) | 0;
                    var1 = 0;
                }

                var3 <<= 16;
                if (var0 < 0) {
                    var3 = (var3 - Math.imul(var28, var0)) | 0;
                    var0 = 0;
                }

                const var125 = (var1 - Pix3D.originY) | 0;
                var32 = (var32 + Math.imul(var34, var125)) | 0;
                var35 = (var35 + Math.imul(var37, var125)) | 0;
                var38 = (var38 + Math.imul(var40, var125)) | 0;
                if (var26 < var27) {
                    var2 = (var2 - var0) | 0;
                    var0 = (var0 - var1) | 0;

                    for (var1 = arrayAtI32(Pix3D.scanline, var1); --var0 >= 0; var38 = (var38 + var40) | 0) {
                        Pix3D.textureRaster(Pix2D.pixels, var19, 0, 0, var1, var5 >> 16, var86 >> 16, var7, var30, var32, var35, var38, var33, var36, var39);
                        var5 = (var5 + var26) | 0;
                        var86 = (var86 + var27) | 0;
                        var7 = (var7 + var31) | 0;
                        var1 = (var1 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                    }

                    while (--var2 >= 0) {
                        Pix3D.textureRaster(Pix2D.pixels, var19, 0, 0, var1, var3 >> 16, var86 >> 16, var7, var30, var32, var35, var38, var33, var36, var39);
                        var3 = (var3 + var28) | 0;
                        var86 = (var86 + var27) | 0;
                        var7 = (var7 + var31) | 0;
                        var1 = (var1 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                        var38 = (var38 + var40) | 0;
                    }
                } else {
                    var2 = (var2 - var0) | 0;
                    var0 = (var0 - var1) | 0;

                    for (var1 = arrayAtI32(Pix3D.scanline, var1); --var0 >= 0; var38 = (var38 + var40) | 0) {
                        Pix3D.textureRaster(Pix2D.pixels, var19, 0, 0, var1, var86 >> 16, var5 >> 16, var7, var30, var32, var35, var38, var33, var36, var39);
                        var5 = (var5 + var26) | 0;
                        var86 = (var86 + var27) | 0;
                        var7 = (var7 + var31) | 0;
                        var1 = (var1 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                    }

                    while (--var2 >= 0) {
                        Pix3D.textureRaster(Pix2D.pixels, var19, 0, 0, var1, var86 >> 16, var3 >> 16, var7, var30, var32, var35, var38, var33, var36, var39);
                        var3 = (var3 + var28) | 0;
                        var86 = (var86 + var27) | 0;
                        var7 = (var7 + var31) | 0;
                        var1 = (var1 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                        var38 = (var38 + var40) | 0;
                    }
                }
            }
        } else {
            if (var2 >= Pix3D.height) {
                return;
            }

            if (var0 > Pix3D.height) {
                var0 = Pix3D.height;
            }

            if (var1 > Pix3D.height) {
                var1 = Pix3D.height;
            }

            var8 = ((var8 << 9) - Math.imul(var30, var5) + var30) | 0;
            if (var0 < var1) {
                let var91: number;
                var4 = var91 = var5 << 16;
                if (var2 < 0) {
                    var4 = (var4 - Math.imul(var27, var2)) | 0;
                    var91 = (var91 - Math.imul(var28, var2)) | 0;
                    var8 = (var8 - Math.imul(var31, var2)) | 0;
                    var2 = 0;
                }

                var3 <<= 16;
                if (var0 < 0) {
                    var3 = (var3 - Math.imul(var26, var0)) | 0;
                    var0 = 0;
                }

                const var124 = (var2 - Pix3D.originY) | 0;
                var32 = (var32 + Math.imul(var34, var124)) | 0;
                var35 = (var35 + Math.imul(var37, var124)) | 0;
                var38 = (var38 + Math.imul(var40, var124)) | 0;
                if (var27 < var28) {
                    var1 = (var1 - var0) | 0;
                    var0 = (var0 - var2) | 0;

                    for (var2 = arrayAtI32(Pix3D.scanline, var2); --var0 >= 0; var38 = (var38 + var40) | 0) {
                        Pix3D.textureRaster(Pix2D.pixels, var19, 0, 0, var2, var4 >> 16, var91 >> 16, var8, var30, var32, var35, var38, var33, var36, var39);
                        var4 = (var4 + var27) | 0;
                        var91 = (var91 + var28) | 0;
                        var8 = (var8 + var31) | 0;
                        var2 = (var2 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                    }

                    while (--var1 >= 0) {
                        Pix3D.textureRaster(Pix2D.pixels, var19, 0, 0, var2, var4 >> 16, var3 >> 16, var8, var30, var32, var35, var38, var33, var36, var39);
                        var4 = (var4 + var27) | 0;
                        var3 = (var3 + var26) | 0;
                        var8 = (var8 + var31) | 0;
                        var2 = (var2 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                        var38 = (var38 + var40) | 0;
                    }
                } else {
                    var1 = (var1 - var0) | 0;
                    var0 = (var0 - var2) | 0;

                    for (var2 = arrayAtI32(Pix3D.scanline, var2); --var0 >= 0; var38 = (var38 + var40) | 0) {
                        Pix3D.textureRaster(Pix2D.pixels, var19, 0, 0, var2, var91 >> 16, var4 >> 16, var8, var30, var32, var35, var38, var33, var36, var39);
                        var4 = (var4 + var27) | 0;
                        var91 = (var91 + var28) | 0;
                        var8 = (var8 + var31) | 0;
                        var2 = (var2 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                    }

                    while (--var1 >= 0) {
                        Pix3D.textureRaster(Pix2D.pixels, var19, 0, 0, var2, var3 >> 16, var4 >> 16, var8, var30, var32, var35, var38, var33, var36, var39);
                        var4 = (var4 + var27) | 0;
                        var3 = (var3 + var26) | 0;
                        var8 = (var8 + var31) | 0;
                        var2 = (var2 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                        var38 = (var38 + var40) | 0;
                    }
                }
            } else {
                let var90: number;
                var3 = var90 = var5 << 16;
                if (var2 < 0) {
                    var3 = (var3 - Math.imul(var27, var2)) | 0;
                    var90 = (var90 - Math.imul(var28, var2)) | 0;
                    var8 = (var8 - Math.imul(var31, var2)) | 0;
                    var2 = 0;
                }

                var4 <<= 16;
                if (var1 < 0) {
                    var4 = (var4 - Math.imul(var26, var1)) | 0;
                    var1 = 0;
                }

                const var41 = (var2 - Pix3D.originY) | 0;
                var32 = (var32 + Math.imul(var34, var41)) | 0;
                var35 = (var35 + Math.imul(var37, var41)) | 0;
                var38 = (var38 + Math.imul(var40, var41)) | 0;
                if (var27 < var28) {
                    var0 = (var0 - var1) | 0;
                    var1 = (var1 - var2) | 0;

                    for (var2 = arrayAtI32(Pix3D.scanline, var2); --var1 >= 0; var38 = (var38 + var40) | 0) {
                        Pix3D.textureRaster(Pix2D.pixels, var19, 0, 0, var2, var3 >> 16, var90 >> 16, var8, var30, var32, var35, var38, var33, var36, var39);
                        var3 = (var3 + var27) | 0;
                        var90 = (var90 + var28) | 0;
                        var8 = (var8 + var31) | 0;
                        var2 = (var2 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                    }

                    while (--var0 >= 0) {
                        Pix3D.textureRaster(Pix2D.pixels, var19, 0, 0, var2, var4 >> 16, var90 >> 16, var8, var30, var32, var35, var38, var33, var36, var39);
                        var4 = (var4 + var26) | 0;
                        var90 = (var90 + var28) | 0;
                        var8 = (var8 + var31) | 0;
                        var2 = (var2 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                        var38 = (var38 + var40) | 0;
                    }
                } else {
                    var0 = (var0 - var1) | 0;
                    var1 = (var1 - var2) | 0;

                    for (var2 = arrayAtI32(Pix3D.scanline, var2); --var1 >= 0; var38 = (var38 + var40) | 0) {
                        Pix3D.textureRaster(Pix2D.pixels, var19, 0, 0, var2, var90 >> 16, var3 >> 16, var8, var30, var32, var35, var38, var33, var36, var39);
                        var3 = (var3 + var27) | 0;
                        var90 = (var90 + var28) | 0;
                        var8 = (var8 + var31) | 0;
                        var2 = (var2 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                    }

                    while (--var0 >= 0) {
                        Pix3D.textureRaster(Pix2D.pixels, var19, 0, 0, var2, var90 >> 16, var4 >> 16, var8, var30, var32, var35, var38, var33, var36, var39);
                        var4 = (var4 + var26) | 0;
                        var90 = (var90 + var28) | 0;
                        var8 = (var8 + var31) | 0;
                        var2 = (var2 + Pix2D.width) | 0;
                        var32 = (var32 + var34) | 0;
                        var35 = (var35 + var37) | 0;
                        var38 = (var38 + var40) | 0;
                    }
                }
            }
        }
    }

    // dc.a(Lpc;)V
    static setTextures(var0: TextureProvider | null): void {
        Pix3D.textureProvider = var0;
    }

    // dc.b(F)V
    // var0 is a Java float.
    private static setRandomBrightness(var0: number): void {
        Pix3D.brightness = Math.fround(var0);
        Pix3D.brightness = Math.fround(Pix3D.brightness + (mathRandom.nextDouble() * 0.03 - 0.015));
    }

    // dc.a(IIIIIIIII)V
    // var0..var2 = y, var3..var5 = x, var6..var8 = colour-table indices.
    static gouraudTriangle(var0: number, var1: number, var2: number, var3: number, var4: number, var5: number, var6: number, var7: number, var8: number): void {
        // The software raster only writes destination pixels while walking these edges.
        const pixels = Pix2D.pixels,
            stride = Pix2D.width,
            height = Pix3D.height,
            scanline = Pix3D.scanline;
        const capture = Pix3D.spanTarget;
        if (capture !== null && capture.projectedGouraud(pixels, stride, scanline, height, Pix3D.hclip ? Math.max(0, Pix3D.width) : -1, Pix3D.lowDetail, Pix3D.trans, Pix3D.colourTable, var0, var1, var2, var3, var4, var5, var6, var7, var8)) return;
        const var9 = (var4 - var3) | 0;
        const var10 = (var1 - var0) | 0;
        const var11 = (var5 - var3) | 0;
        const var12 = (var2 - var0) | 0;
        const var13 = (var7 - var6) | 0;
        const var14 = (var8 - var6) | 0;
        let var15: number;
        if (var2 !== var1) {
            var15 = (((var5 - var4) << 16) / ((var2 - var1) | 0)) | 0;
        } else {
            var15 = 0;
        }

        let var16: number;
        if (var1 !== var0) {
            var16 = ((var9 << 16) / var10) | 0;
        } else {
            var16 = 0;
        }

        let var17: number;
        if (var2 !== var0) {
            var17 = ((var11 << 16) / var12) | 0;
        } else {
            var17 = 0;
        }

        const var18 = (Math.imul(var9, var12) - Math.imul(var11, var10)) | 0;
        if (var18 === 0) {
            return;
        }

        const var19 = (((Math.imul(var13, var12) - Math.imul(var14, var10)) << 8) / var18) | 0;
        const var20 = (((Math.imul(var14, var9) - Math.imul(var13, var11)) << 8) / var18) | 0;
        if (var0 <= var1 && var0 <= var2) {
            if (var0 >= height) {
                return;
            }

            if (var1 > height) {
                var1 = height;
            }

            if (var2 > height) {
                var2 = height;
            }

            var6 = ((var6 << 8) - Math.imul(var19, var3) + var19) | 0;
            if (var1 < var2) {
                let var62: number;
                var5 = var62 = var3 << 16;
                if (var0 < 0) {
                    var5 = (var5 - Math.imul(var17, var0)) | 0;
                    var62 = (var62 - Math.imul(var16, var0)) | 0;
                    var6 = (var6 - Math.imul(var20, var0)) | 0;
                    var0 = 0;
                }

                var4 <<= 16;
                if (var1 < 0) {
                    var4 = (var4 - Math.imul(var15, var1)) | 0;
                    var1 = 0;
                }

                if ((var0 !== var1 && var17 < var16) || (var0 === var1 && var17 > var15)) {
                    var2 = (var2 - var1) | 0;
                    var1 = (var1 - var0) | 0;

                    var0 = scanline !== null && var0 >>> 0 < scanline.length ? scanline[var0] : arrayAtI32(scanline, var0);
                    if (
                        capture !== null &&
                        capture.gouraudEdges(pixels, var0, stride, var1, var2, var5, var17, var62, var16, var4, var15, true, var6, var20, var19, Pix3D.hclip ? Math.max(0, Pix3D.width) : -1, Pix3D.lowDetail, Pix3D.trans, Pix3D.colourTable)
                    )
                        return;
                    for (; --var1 >= 0; var0 = (var0 + stride) | 0) {
                        Pix3D.gouraudRaster(pixels, var0, 0, 0, var5 >> 16, var62 >> 16, var6, var19);
                        var5 = (var5 + var17) | 0;
                        var62 = (var62 + var16) | 0;
                        var6 = (var6 + var20) | 0;
                    }

                    while (--var2 >= 0) {
                        Pix3D.gouraudRaster(pixels, var0, 0, 0, var5 >> 16, var4 >> 16, var6, var19);
                        var5 = (var5 + var17) | 0;
                        var4 = (var4 + var15) | 0;
                        var6 = (var6 + var20) | 0;
                        var0 = (var0 + stride) | 0;
                    }
                } else {
                    var2 = (var2 - var1) | 0;
                    var1 = (var1 - var0) | 0;

                    var0 = scanline !== null && var0 >>> 0 < scanline.length ? scanline[var0] : arrayAtI32(scanline, var0);
                    if (
                        capture !== null &&
                        capture.gouraudEdges(pixels, var0, stride, var1, var2, var5, var17, var62, var16, var4, var15, false, var6, var20, var19, Pix3D.hclip ? Math.max(0, Pix3D.width) : -1, Pix3D.lowDetail, Pix3D.trans, Pix3D.colourTable)
                    )
                        return;
                    for (; --var1 >= 0; var0 = (var0 + stride) | 0) {
                        Pix3D.gouraudRaster(pixels, var0, 0, 0, var62 >> 16, var5 >> 16, var6, var19);
                        var5 = (var5 + var17) | 0;
                        var62 = (var62 + var16) | 0;
                        var6 = (var6 + var20) | 0;
                    }

                    while (--var2 >= 0) {
                        Pix3D.gouraudRaster(pixels, var0, 0, 0, var4 >> 16, var5 >> 16, var6, var19);
                        var5 = (var5 + var17) | 0;
                        var4 = (var4 + var15) | 0;
                        var6 = (var6 + var20) | 0;
                        var0 = (var0 + stride) | 0;
                    }
                }
            } else {
                let var61: number;
                var4 = var61 = var3 << 16;
                if (var0 < 0) {
                    var4 = (var4 - Math.imul(var17, var0)) | 0;
                    var61 = (var61 - Math.imul(var16, var0)) | 0;
                    var6 = (var6 - Math.imul(var20, var0)) | 0;
                    var0 = 0;
                }

                var5 <<= 16;
                if (var2 < 0) {
                    var5 = (var5 - Math.imul(var15, var2)) | 0;
                    var2 = 0;
                }

                if ((var0 !== var2 && var17 < var16) || (var0 === var2 && var15 > var16)) {
                    var1 = (var1 - var2) | 0;
                    var2 = (var2 - var0) | 0;

                    var0 = scanline !== null && var0 >>> 0 < scanline.length ? scanline[var0] : arrayAtI32(scanline, var0);
                    if (
                        capture !== null &&
                        capture.gouraudEdges(pixels, var0, stride, var2, var1, var61, var16, var4, var17, var5, var15, false, var6, var20, var19, Pix3D.hclip ? Math.max(0, Pix3D.width) : -1, Pix3D.lowDetail, Pix3D.trans, Pix3D.colourTable)
                    )
                        return;
                    for (; --var2 >= 0; var0 = (var0 + stride) | 0) {
                        Pix3D.gouraudRaster(pixels, var0, 0, 0, var4 >> 16, var61 >> 16, var6, var19);
                        var4 = (var4 + var17) | 0;
                        var61 = (var61 + var16) | 0;
                        var6 = (var6 + var20) | 0;
                    }

                    while (--var1 >= 0) {
                        Pix3D.gouraudRaster(pixels, var0, 0, 0, var5 >> 16, var61 >> 16, var6, var19);
                        var5 = (var5 + var15) | 0;
                        var61 = (var61 + var16) | 0;
                        var6 = (var6 + var20) | 0;
                        var0 = (var0 + stride) | 0;
                    }
                } else {
                    var1 = (var1 - var2) | 0;
                    var2 = (var2 - var0) | 0;

                    var0 = scanline !== null && var0 >>> 0 < scanline.length ? scanline[var0] : arrayAtI32(scanline, var0);
                    if (
                        capture !== null &&
                        capture.gouraudEdges(pixels, var0, stride, var2, var1, var61, var16, var4, var17, var5, var15, true, var6, var20, var19, Pix3D.hclip ? Math.max(0, Pix3D.width) : -1, Pix3D.lowDetail, Pix3D.trans, Pix3D.colourTable)
                    )
                        return;
                    for (; --var2 >= 0; var0 = (var0 + stride) | 0) {
                        Pix3D.gouraudRaster(pixels, var0, 0, 0, var61 >> 16, var4 >> 16, var6, var19);
                        var4 = (var4 + var17) | 0;
                        var61 = (var61 + var16) | 0;
                        var6 = (var6 + var20) | 0;
                    }

                    while (--var1 >= 0) {
                        Pix3D.gouraudRaster(pixels, var0, 0, 0, var61 >> 16, var5 >> 16, var6, var19);
                        var5 = (var5 + var15) | 0;
                        var61 = (var61 + var16) | 0;
                        var6 = (var6 + var20) | 0;
                        var0 = (var0 + stride) | 0;
                    }
                }
            }
        } else if (var1 <= var2) {
            if (var1 >= height) {
                return;
            }

            if (var2 > height) {
                var2 = height;
            }

            if (var0 > height) {
                var0 = height;
            }

            var7 = ((var7 << 8) - Math.imul(var19, var4) + var19) | 0;
            if (var2 < var0) {
                let var66: number;
                var3 = var66 = var4 << 16;
                if (var1 < 0) {
                    var3 = (var3 - Math.imul(var16, var1)) | 0;
                    var66 = (var66 - Math.imul(var15, var1)) | 0;
                    var7 = (var7 - Math.imul(var20, var1)) | 0;
                    var1 = 0;
                }

                var5 <<= 16;
                if (var2 < 0) {
                    var5 = (var5 - Math.imul(var17, var2)) | 0;
                    var2 = 0;
                }

                if ((var1 !== var2 && var16 < var15) || (var1 === var2 && var16 > var17)) {
                    var0 = (var0 - var2) | 0;
                    var2 = (var2 - var1) | 0;

                    var1 = scanline !== null && var1 >>> 0 < scanline.length ? scanline[var1] : arrayAtI32(scanline, var1);
                    if (
                        capture !== null &&
                        capture.gouraudEdges(pixels, var1, stride, var2, var0, var3, var16, var66, var15, var5, var17, true, var7, var20, var19, Pix3D.hclip ? Math.max(0, Pix3D.width) : -1, Pix3D.lowDetail, Pix3D.trans, Pix3D.colourTable)
                    )
                        return;
                    for (; --var2 >= 0; var1 = (var1 + stride) | 0) {
                        Pix3D.gouraudRaster(pixels, var1, 0, 0, var3 >> 16, var66 >> 16, var7, var19);
                        var3 = (var3 + var16) | 0;
                        var66 = (var66 + var15) | 0;
                        var7 = (var7 + var20) | 0;
                    }

                    while (--var0 >= 0) {
                        Pix3D.gouraudRaster(pixels, var1, 0, 0, var3 >> 16, var5 >> 16, var7, var19);
                        var3 = (var3 + var16) | 0;
                        var5 = (var5 + var17) | 0;
                        var7 = (var7 + var20) | 0;
                        var1 = (var1 + stride) | 0;
                    }
                } else {
                    var0 = (var0 - var2) | 0;
                    var2 = (var2 - var1) | 0;

                    var1 = scanline !== null && var1 >>> 0 < scanline.length ? scanline[var1] : arrayAtI32(scanline, var1);
                    if (
                        capture !== null &&
                        capture.gouraudEdges(pixels, var1, stride, var2, var0, var3, var16, var66, var15, var5, var17, false, var7, var20, var19, Pix3D.hclip ? Math.max(0, Pix3D.width) : -1, Pix3D.lowDetail, Pix3D.trans, Pix3D.colourTable)
                    )
                        return;
                    for (; --var2 >= 0; var1 = (var1 + stride) | 0) {
                        Pix3D.gouraudRaster(pixels, var1, 0, 0, var66 >> 16, var3 >> 16, var7, var19);
                        var3 = (var3 + var16) | 0;
                        var66 = (var66 + var15) | 0;
                        var7 = (var7 + var20) | 0;
                    }

                    while (--var0 >= 0) {
                        Pix3D.gouraudRaster(pixels, var1, 0, 0, var5 >> 16, var3 >> 16, var7, var19);
                        var3 = (var3 + var16) | 0;
                        var5 = (var5 + var17) | 0;
                        var7 = (var7 + var20) | 0;
                        var1 = (var1 + stride) | 0;
                    }
                }
            } else {
                let var65: number;
                var5 = var65 = var4 << 16;
                if (var1 < 0) {
                    var5 = (var5 - Math.imul(var16, var1)) | 0;
                    var65 = (var65 - Math.imul(var15, var1)) | 0;
                    var7 = (var7 - Math.imul(var20, var1)) | 0;
                    var1 = 0;
                }

                var3 <<= 16;
                if (var0 < 0) {
                    var3 = (var3 - Math.imul(var17, var0)) | 0;
                    var0 = 0;
                }

                if (var16 < var15) {
                    var2 = (var2 - var0) | 0;
                    var0 = (var0 - var1) | 0;

                    var1 = scanline !== null && var1 >>> 0 < scanline.length ? scanline[var1] : arrayAtI32(scanline, var1);
                    if (
                        capture !== null &&
                        capture.gouraudEdges(pixels, var1, stride, var0, var2, var65, var15, var5, var16, var3, var17, false, var7, var20, var19, Pix3D.hclip ? Math.max(0, Pix3D.width) : -1, Pix3D.lowDetail, Pix3D.trans, Pix3D.colourTable)
                    )
                        return;
                    for (; --var0 >= 0; var1 = (var1 + stride) | 0) {
                        Pix3D.gouraudRaster(pixels, var1, 0, 0, var5 >> 16, var65 >> 16, var7, var19);
                        var5 = (var5 + var16) | 0;
                        var65 = (var65 + var15) | 0;
                        var7 = (var7 + var20) | 0;
                    }

                    while (--var2 >= 0) {
                        Pix3D.gouraudRaster(pixels, var1, 0, 0, var3 >> 16, var65 >> 16, var7, var19);
                        var3 = (var3 + var17) | 0;
                        var65 = (var65 + var15) | 0;
                        var7 = (var7 + var20) | 0;
                        var1 = (var1 + stride) | 0;
                    }
                } else {
                    var2 = (var2 - var0) | 0;
                    var0 = (var0 - var1) | 0;

                    var1 = scanline !== null && var1 >>> 0 < scanline.length ? scanline[var1] : arrayAtI32(scanline, var1);
                    if (
                        capture !== null &&
                        capture.gouraudEdges(pixels, var1, stride, var0, var2, var65, var15, var5, var16, var3, var17, true, var7, var20, var19, Pix3D.hclip ? Math.max(0, Pix3D.width) : -1, Pix3D.lowDetail, Pix3D.trans, Pix3D.colourTable)
                    )
                        return;
                    for (; --var0 >= 0; var1 = (var1 + stride) | 0) {
                        Pix3D.gouraudRaster(pixels, var1, 0, 0, var65 >> 16, var5 >> 16, var7, var19);
                        var5 = (var5 + var16) | 0;
                        var65 = (var65 + var15) | 0;
                        var7 = (var7 + var20) | 0;
                    }

                    while (--var2 >= 0) {
                        Pix3D.gouraudRaster(pixels, var1, 0, 0, var65 >> 16, var3 >> 16, var7, var19);
                        var3 = (var3 + var17) | 0;
                        var65 = (var65 + var15) | 0;
                        var7 = (var7 + var20) | 0;
                        var1 = (var1 + stride) | 0;
                    }
                }
            }
        } else {
            if (var2 >= height) {
                return;
            }

            if (var0 > height) {
                var0 = height;
            }

            if (var1 > height) {
                var1 = height;
            }

            var8 = ((var8 << 8) - Math.imul(var19, var5) + var19) | 0;
            if (var0 < var1) {
                let var70: number;
                var4 = var70 = var5 << 16;
                if (var2 < 0) {
                    var4 = (var4 - Math.imul(var15, var2)) | 0;
                    var70 = (var70 - Math.imul(var17, var2)) | 0;
                    var8 = (var8 - Math.imul(var20, var2)) | 0;
                    var2 = 0;
                }

                var3 <<= 16;
                if (var0 < 0) {
                    var3 = (var3 - Math.imul(var16, var0)) | 0;
                    var0 = 0;
                }

                if (var15 < var17) {
                    var1 = (var1 - var0) | 0;
                    var0 = (var0 - var2) | 0;

                    var2 = scanline !== null && var2 >>> 0 < scanline.length ? scanline[var2] : arrayAtI32(scanline, var2);
                    if (
                        capture !== null &&
                        capture.gouraudEdges(pixels, var2, stride, var0, var1, var4, var15, var70, var17, var3, var16, true, var8, var20, var19, Pix3D.hclip ? Math.max(0, Pix3D.width) : -1, Pix3D.lowDetail, Pix3D.trans, Pix3D.colourTable)
                    )
                        return;
                    for (; --var0 >= 0; var2 = (var2 + stride) | 0) {
                        Pix3D.gouraudRaster(pixels, var2, 0, 0, var4 >> 16, var70 >> 16, var8, var19);
                        var4 = (var4 + var15) | 0;
                        var70 = (var70 + var17) | 0;
                        var8 = (var8 + var20) | 0;
                    }

                    while (--var1 >= 0) {
                        Pix3D.gouraudRaster(pixels, var2, 0, 0, var4 >> 16, var3 >> 16, var8, var19);
                        var4 = (var4 + var15) | 0;
                        var3 = (var3 + var16) | 0;
                        var8 = (var8 + var20) | 0;
                        var2 = (var2 + stride) | 0;
                    }
                } else {
                    var1 = (var1 - var0) | 0;
                    var0 = (var0 - var2) | 0;

                    var2 = scanline !== null && var2 >>> 0 < scanline.length ? scanline[var2] : arrayAtI32(scanline, var2);
                    if (
                        capture !== null &&
                        capture.gouraudEdges(pixels, var2, stride, var0, var1, var4, var15, var70, var17, var3, var16, false, var8, var20, var19, Pix3D.hclip ? Math.max(0, Pix3D.width) : -1, Pix3D.lowDetail, Pix3D.trans, Pix3D.colourTable)
                    )
                        return;
                    for (; --var0 >= 0; var2 = (var2 + stride) | 0) {
                        Pix3D.gouraudRaster(pixels, var2, 0, 0, var70 >> 16, var4 >> 16, var8, var19);
                        var4 = (var4 + var15) | 0;
                        var70 = (var70 + var17) | 0;
                        var8 = (var8 + var20) | 0;
                    }

                    while (--var1 >= 0) {
                        Pix3D.gouraudRaster(pixels, var2, 0, 0, var3 >> 16, var4 >> 16, var8, var19);
                        var4 = (var4 + var15) | 0;
                        var3 = (var3 + var16) | 0;
                        var8 = (var8 + var20) | 0;
                        var2 = (var2 + stride) | 0;
                    }
                }
            } else {
                let var69: number;
                var3 = var69 = var5 << 16;
                if (var2 < 0) {
                    var3 = (var3 - Math.imul(var15, var2)) | 0;
                    var69 = (var69 - Math.imul(var17, var2)) | 0;
                    var8 = (var8 - Math.imul(var20, var2)) | 0;
                    var2 = 0;
                }

                var4 <<= 16;
                if (var1 < 0) {
                    var4 = (var4 - Math.imul(var16, var1)) | 0;
                    var1 = 0;
                }

                if (var15 < var17) {
                    var0 = (var0 - var1) | 0;
                    var1 = (var1 - var2) | 0;

                    var2 = scanline !== null && var2 >>> 0 < scanline.length ? scanline[var2] : arrayAtI32(scanline, var2);
                    if (
                        capture !== null &&
                        capture.gouraudEdges(pixels, var2, stride, var1, var0, var69, var17, var3, var15, var4, var16, false, var8, var20, var19, Pix3D.hclip ? Math.max(0, Pix3D.width) : -1, Pix3D.lowDetail, Pix3D.trans, Pix3D.colourTable)
                    )
                        return;
                    for (; --var1 >= 0; var2 = (var2 + stride) | 0) {
                        Pix3D.gouraudRaster(pixels, var2, 0, 0, var3 >> 16, var69 >> 16, var8, var19);
                        var3 = (var3 + var15) | 0;
                        var69 = (var69 + var17) | 0;
                        var8 = (var8 + var20) | 0;
                    }

                    while (--var0 >= 0) {
                        Pix3D.gouraudRaster(pixels, var2, 0, 0, var4 >> 16, var69 >> 16, var8, var19);
                        var4 = (var4 + var16) | 0;
                        var69 = (var69 + var17) | 0;
                        var8 = (var8 + var20) | 0;
                        var2 = (var2 + stride) | 0;
                    }
                } else {
                    var0 = (var0 - var1) | 0;
                    var1 = (var1 - var2) | 0;

                    var2 = scanline !== null && var2 >>> 0 < scanline.length ? scanline[var2] : arrayAtI32(scanline, var2);
                    if (
                        capture !== null &&
                        capture.gouraudEdges(pixels, var2, stride, var1, var0, var69, var17, var3, var15, var4, var16, true, var8, var20, var19, Pix3D.hclip ? Math.max(0, Pix3D.width) : -1, Pix3D.lowDetail, Pix3D.trans, Pix3D.colourTable)
                    )
                        return;
                    for (; --var1 >= 0; var2 = (var2 + stride) | 0) {
                        Pix3D.gouraudRaster(pixels, var2, 0, 0, var69 >> 16, var3 >> 16, var8, var19);
                        var3 = (var3 + var15) | 0;
                        var69 = (var69 + var17) | 0;
                        var8 = (var8 + var20) | 0;
                    }

                    while (--var0 >= 0) {
                        Pix3D.gouraudRaster(pixels, var2, 0, 0, var69 >> 16, var4 >> 16, var8, var19);
                        var4 = (var4 + var16) | 0;
                        var69 = (var69 + var17) | 0;
                        var8 = (var8 + var20) | 0;
                        var2 = (var2 + stride) | 0;
                    }
                }
            }
        }
    }

    // dc.b(II)V
    private static initColourTable(var0: number, var1: number): void {
        Pix3D.spanTarget?.invalidate(Pix3D.colourTable);
        let var2 = Math.imul(var0, 128);

        for (let var3 = var0; var3 < var1; var3++) {
            const var4 = (var3 >> 3) / 64.0 + 0.0078125;
            const var6 = (var3 & 7) / 8.0 + 0.0625;

            for (let var8 = 0; var8 < 128; var8++) {
                const var9 = var8 / 128.0;
                let var11 = var9;
                let var13 = var9;
                let var15 = var9;
                if (var6 !== 0.0) {
                    let var17: number;
                    if (var9 < 0.5) {
                        var17 = var9 * (1.0 + var6);
                    } else {
                        var17 = var9 + var6 - var9 * var6;
                    }

                    const var19 = 2.0 * var9 - var17;
                    let var21 = var4 + 0.3333333333333333;
                    if (var21 > 1.0) {
                        var21--;
                    }

                    // The bytecode copies the hue into a second local (dstore 23) for the green channel.
                    const var23 = var4;
                    let var25 = var4 - 0.3333333333333333;
                    if (var25 < 0.0) {
                        var25++;
                    }

                    if (6.0 * var21 < 1.0) {
                        var11 = var19 + (var17 - var19) * 6.0 * var21;
                    } else if (2.0 * var21 < 1.0) {
                        var11 = var17;
                    } else if (3.0 * var21 < 2.0) {
                        var11 = var19 + (var17 - var19) * (0.6666666666666666 - var21) * 6.0;
                    } else {
                        var11 = var19;
                    }

                    if (6.0 * var23 < 1.0) {
                        var13 = var19 + (var17 - var19) * 6.0 * var23;
                    } else if (2.0 * var23 < 1.0) {
                        var13 = var17;
                    } else if (3.0 * var23 < 2.0) {
                        var13 = var19 + (var17 - var19) * (0.6666666666666666 - var23) * 6.0;
                    } else {
                        var13 = var19;
                    }

                    if (6.0 * var25 < 1.0) {
                        var15 = var19 + (var17 - var19) * 6.0 * var25;
                    } else if (2.0 * var25 < 1.0) {
                        var15 = var17;
                    } else if (3.0 * var25 < 2.0) {
                        var15 = var19 + (var17 - var19) * (0.6666666666666666 - var25) * 6.0;
                    } else {
                        var15 = var19;
                    }
                }

                var11 = Math.pow(var11, Pix3D.brightness);
                var13 = Math.pow(var13, Pix3D.brightness);
                var15 = Math.pow(var15, Pix3D.brightness);
                // d2i: brightness is unconstrained, so pow can give Infinity or NaN.
                const var30 = doubleToInt(var11 * 256.0);
                const var18 = doubleToInt(var13 * 256.0);
                const var31 = doubleToInt(var15 * 256.0);
                let var20 = ((var30 << 16) + (var18 << 8) + var31) | 0;
                if (var20 === 0) {
                    var20 = 1;
                }

                arrayPutI32(Pix3D.colourTable, var2++, var20);
            }
        }
    }

    // dc.e()I
    static getOffsetX(): number {
        return intRemainder(arrayAtI32(Pix3D.scanline, 0), Pix2D.width);
    }

    // dc.a(III)V
    static testHclip(var0: number, var1: number, var2: number): void {
        Pix3D.hclip = var0 < 0 || var0 > Pix3D.width || var1 < 0 || var1 > Pix3D.width || var2 < 0 || var2 > Pix3D.width;
    }

    // dc.a(IIII)V
    private static setBounds(var0: number, var1: number, var2: number, var3: number): void {
        Pix3D.width = (var2 - var0) | 0;
        Pix3D.height = (var3 - var1) | 0;
        Pix3D.resetOrigin();
        if (requireNonNull(Pix3D.scanline).length < Pix3D.height) {
            Pix3D.scanline = new Int32Array(bitCeil(Pix3D.height));
        }

        let var4 = (Math.imul(var1, Pix2D.width) + var0) | 0;

        for (let var5 = 0; var5 < Pix3D.height; var5++) {
            arrayPutI32(Pix3D.scanline, var5, var4);
            var4 = (var4 + Pix2D.width) | 0;
        }
    }

    // dc.a(IIIIIII)V
    // var0..var2 = y, var3..var5 = x, var6 = RGB.
    static flatTriangle(var0: number, var1: number, var2: number, var3: number, var4: number, var5: number, var6: number): void {
        let var7 = 0;
        if (var1 !== var0) {
            var7 = (((var4 - var3) << 16) / ((var1 - var0) | 0)) | 0;
        }

        let var8 = 0;
        if (var2 !== var1) {
            var8 = (((var5 - var4) << 16) / ((var2 - var1) | 0)) | 0;
        }

        let var9 = 0;
        if (var2 !== var0) {
            var9 = (((var3 - var5) << 16) / ((var0 - var2) | 0)) | 0;
        }

        if (var0 <= var1 && var0 <= var2) {
            if (var0 >= Pix3D.height) {
                return;
            }

            if (var1 > Pix3D.height) {
                var1 = Pix3D.height;
            }

            if (var2 > Pix3D.height) {
                var2 = Pix3D.height;
            }

            if (var1 < var2) {
                let var51: number;
                var5 = var51 = var3 << 16;
                if (var0 < 0) {
                    var5 = (var5 - Math.imul(var9, var0)) | 0;
                    var51 = (var51 - Math.imul(var7, var0)) | 0;
                    var0 = 0;
                }

                var4 <<= 16;
                if (var1 < 0) {
                    var4 = (var4 - Math.imul(var8, var1)) | 0;
                    var1 = 0;
                }

                if ((var0 !== var1 && var9 < var7) || (var0 === var1 && var9 > var8)) {
                    var2 = (var2 - var1) | 0;
                    var1 = (var1 - var0) | 0;

                    for (var0 = arrayAtI32(Pix3D.scanline, var0); --var1 >= 0; var0 = (var0 + Pix2D.width) | 0) {
                        Pix3D.flatRaster(Pix2D.pixels, var0, var6, 0, var5 >> 16, var51 >> 16);
                        var5 = (var5 + var9) | 0;
                        var51 = (var51 + var7) | 0;
                    }

                    while (--var2 >= 0) {
                        Pix3D.flatRaster(Pix2D.pixels, var0, var6, 0, var5 >> 16, var4 >> 16);
                        var5 = (var5 + var9) | 0;
                        var4 = (var4 + var8) | 0;
                        var0 = (var0 + Pix2D.width) | 0;
                    }
                } else {
                    var2 = (var2 - var1) | 0;
                    var1 = (var1 - var0) | 0;

                    for (var0 = arrayAtI32(Pix3D.scanline, var0); --var1 >= 0; var0 = (var0 + Pix2D.width) | 0) {
                        Pix3D.flatRaster(Pix2D.pixels, var0, var6, 0, var51 >> 16, var5 >> 16);
                        var5 = (var5 + var9) | 0;
                        var51 = (var51 + var7) | 0;
                    }

                    while (--var2 >= 0) {
                        Pix3D.flatRaster(Pix2D.pixels, var0, var6, 0, var4 >> 16, var5 >> 16);
                        var5 = (var5 + var9) | 0;
                        var4 = (var4 + var8) | 0;
                        var0 = (var0 + Pix2D.width) | 0;
                    }
                }
            } else {
                let var50: number;
                var4 = var50 = var3 << 16;
                if (var0 < 0) {
                    var4 = (var4 - Math.imul(var9, var0)) | 0;
                    var50 = (var50 - Math.imul(var7, var0)) | 0;
                    var0 = 0;
                }

                var5 <<= 16;
                if (var2 < 0) {
                    var5 = (var5 - Math.imul(var8, var2)) | 0;
                    var2 = 0;
                }

                if ((var0 !== var2 && var9 < var7) || (var0 === var2 && var8 > var7)) {
                    var1 = (var1 - var2) | 0;
                    var2 = (var2 - var0) | 0;

                    for (var0 = arrayAtI32(Pix3D.scanline, var0); --var2 >= 0; var0 = (var0 + Pix2D.width) | 0) {
                        Pix3D.flatRaster(Pix2D.pixels, var0, var6, 0, var4 >> 16, var50 >> 16);
                        var4 = (var4 + var9) | 0;
                        var50 = (var50 + var7) | 0;
                    }

                    while (--var1 >= 0) {
                        Pix3D.flatRaster(Pix2D.pixels, var0, var6, 0, var5 >> 16, var50 >> 16);
                        var5 = (var5 + var8) | 0;
                        var50 = (var50 + var7) | 0;
                        var0 = (var0 + Pix2D.width) | 0;
                    }
                } else {
                    var1 = (var1 - var2) | 0;
                    var2 = (var2 - var0) | 0;

                    for (var0 = arrayAtI32(Pix3D.scanline, var0); --var2 >= 0; var0 = (var0 + Pix2D.width) | 0) {
                        Pix3D.flatRaster(Pix2D.pixels, var0, var6, 0, var50 >> 16, var4 >> 16);
                        var4 = (var4 + var9) | 0;
                        var50 = (var50 + var7) | 0;
                    }

                    while (--var1 >= 0) {
                        Pix3D.flatRaster(Pix2D.pixels, var0, var6, 0, var50 >> 16, var5 >> 16);
                        var5 = (var5 + var8) | 0;
                        var50 = (var50 + var7) | 0;
                        var0 = (var0 + Pix2D.width) | 0;
                    }
                }
            }
        } else if (var1 <= var2) {
            if (var1 >= Pix3D.height) {
                return;
            }

            if (var2 > Pix3D.height) {
                var2 = Pix3D.height;
            }

            if (var0 > Pix3D.height) {
                var0 = Pix3D.height;
            }

            if (var2 < var0) {
                let var55: number;
                var3 = var55 = var4 << 16;
                if (var1 < 0) {
                    var3 = (var3 - Math.imul(var7, var1)) | 0;
                    var55 = (var55 - Math.imul(var8, var1)) | 0;
                    var1 = 0;
                }

                var5 <<= 16;
                if (var2 < 0) {
                    var5 = (var5 - Math.imul(var9, var2)) | 0;
                    var2 = 0;
                }

                if ((var1 !== var2 && var7 < var8) || (var1 === var2 && var7 > var9)) {
                    var0 = (var0 - var2) | 0;
                    var2 = (var2 - var1) | 0;

                    for (var1 = arrayAtI32(Pix3D.scanline, var1); --var2 >= 0; var1 = (var1 + Pix2D.width) | 0) {
                        Pix3D.flatRaster(Pix2D.pixels, var1, var6, 0, var3 >> 16, var55 >> 16);
                        var3 = (var3 + var7) | 0;
                        var55 = (var55 + var8) | 0;
                    }

                    while (--var0 >= 0) {
                        Pix3D.flatRaster(Pix2D.pixels, var1, var6, 0, var3 >> 16, var5 >> 16);
                        var3 = (var3 + var7) | 0;
                        var5 = (var5 + var9) | 0;
                        var1 = (var1 + Pix2D.width) | 0;
                    }
                } else {
                    var0 = (var0 - var2) | 0;
                    var2 = (var2 - var1) | 0;

                    for (var1 = arrayAtI32(Pix3D.scanline, var1); --var2 >= 0; var1 = (var1 + Pix2D.width) | 0) {
                        Pix3D.flatRaster(Pix2D.pixels, var1, var6, 0, var55 >> 16, var3 >> 16);
                        var3 = (var3 + var7) | 0;
                        var55 = (var55 + var8) | 0;
                    }

                    while (--var0 >= 0) {
                        Pix3D.flatRaster(Pix2D.pixels, var1, var6, 0, var5 >> 16, var3 >> 16);
                        var3 = (var3 + var7) | 0;
                        var5 = (var5 + var9) | 0;
                        var1 = (var1 + Pix2D.width) | 0;
                    }
                }
            } else {
                let var54: number;
                var5 = var54 = var4 << 16;
                if (var1 < 0) {
                    var5 = (var5 - Math.imul(var7, var1)) | 0;
                    var54 = (var54 - Math.imul(var8, var1)) | 0;
                    var1 = 0;
                }

                var3 <<= 16;
                if (var0 < 0) {
                    var3 = (var3 - Math.imul(var9, var0)) | 0;
                    var0 = 0;
                }

                if (var7 < var8) {
                    var2 = (var2 - var0) | 0;
                    var0 = (var0 - var1) | 0;

                    for (var1 = arrayAtI32(Pix3D.scanline, var1); --var0 >= 0; var1 = (var1 + Pix2D.width) | 0) {
                        Pix3D.flatRaster(Pix2D.pixels, var1, var6, 0, var5 >> 16, var54 >> 16);
                        var5 = (var5 + var7) | 0;
                        var54 = (var54 + var8) | 0;
                    }

                    while (--var2 >= 0) {
                        Pix3D.flatRaster(Pix2D.pixels, var1, var6, 0, var3 >> 16, var54 >> 16);
                        var3 = (var3 + var9) | 0;
                        var54 = (var54 + var8) | 0;
                        var1 = (var1 + Pix2D.width) | 0;
                    }
                } else {
                    var2 = (var2 - var0) | 0;
                    var0 = (var0 - var1) | 0;

                    for (var1 = arrayAtI32(Pix3D.scanline, var1); --var0 >= 0; var1 = (var1 + Pix2D.width) | 0) {
                        Pix3D.flatRaster(Pix2D.pixels, var1, var6, 0, var54 >> 16, var5 >> 16);
                        var5 = (var5 + var7) | 0;
                        var54 = (var54 + var8) | 0;
                    }

                    while (--var2 >= 0) {
                        Pix3D.flatRaster(Pix2D.pixels, var1, var6, 0, var54 >> 16, var3 >> 16);
                        var3 = (var3 + var9) | 0;
                        var54 = (var54 + var8) | 0;
                        var1 = (var1 + Pix2D.width) | 0;
                    }
                }
            }
        } else {
            if (var2 >= Pix3D.height) {
                return;
            }

            if (var0 > Pix3D.height) {
                var0 = Pix3D.height;
            }

            if (var1 > Pix3D.height) {
                var1 = Pix3D.height;
            }

            if (var0 < var1) {
                let var59: number;
                var4 = var59 = var5 << 16;
                if (var2 < 0) {
                    var4 = (var4 - Math.imul(var8, var2)) | 0;
                    var59 = (var59 - Math.imul(var9, var2)) | 0;
                    var2 = 0;
                }

                var3 <<= 16;
                if (var0 < 0) {
                    var3 = (var3 - Math.imul(var7, var0)) | 0;
                    var0 = 0;
                }

                if (var8 < var9) {
                    var1 = (var1 - var0) | 0;
                    var0 = (var0 - var2) | 0;

                    for (var2 = arrayAtI32(Pix3D.scanline, var2); --var0 >= 0; var2 = (var2 + Pix2D.width) | 0) {
                        Pix3D.flatRaster(Pix2D.pixels, var2, var6, 0, var4 >> 16, var59 >> 16);
                        var4 = (var4 + var8) | 0;
                        var59 = (var59 + var9) | 0;
                    }

                    while (--var1 >= 0) {
                        Pix3D.flatRaster(Pix2D.pixels, var2, var6, 0, var4 >> 16, var3 >> 16);
                        var4 = (var4 + var8) | 0;
                        var3 = (var3 + var7) | 0;
                        var2 = (var2 + Pix2D.width) | 0;
                    }
                } else {
                    var1 = (var1 - var0) | 0;
                    var0 = (var0 - var2) | 0;

                    for (var2 = arrayAtI32(Pix3D.scanline, var2); --var0 >= 0; var2 = (var2 + Pix2D.width) | 0) {
                        Pix3D.flatRaster(Pix2D.pixels, var2, var6, 0, var59 >> 16, var4 >> 16);
                        var4 = (var4 + var8) | 0;
                        var59 = (var59 + var9) | 0;
                    }

                    while (--var1 >= 0) {
                        Pix3D.flatRaster(Pix2D.pixels, var2, var6, 0, var3 >> 16, var4 >> 16);
                        var4 = (var4 + var8) | 0;
                        var3 = (var3 + var7) | 0;
                        var2 = (var2 + Pix2D.width) | 0;
                    }
                }
            } else {
                let var58: number;
                var3 = var58 = var5 << 16;
                if (var2 < 0) {
                    var3 = (var3 - Math.imul(var8, var2)) | 0;
                    var58 = (var58 - Math.imul(var9, var2)) | 0;
                    var2 = 0;
                }

                var4 <<= 16;
                if (var1 < 0) {
                    var4 = (var4 - Math.imul(var7, var1)) | 0;
                    var1 = 0;
                }

                if (var8 < var9) {
                    var0 = (var0 - var1) | 0;
                    var1 = (var1 - var2) | 0;

                    for (var2 = arrayAtI32(Pix3D.scanline, var2); --var1 >= 0; var2 = (var2 + Pix2D.width) | 0) {
                        Pix3D.flatRaster(Pix2D.pixels, var2, var6, 0, var3 >> 16, var58 >> 16);
                        var3 = (var3 + var8) | 0;
                        var58 = (var58 + var9) | 0;
                    }

                    while (--var0 >= 0) {
                        Pix3D.flatRaster(Pix2D.pixels, var2, var6, 0, var4 >> 16, var58 >> 16);
                        var4 = (var4 + var7) | 0;
                        var58 = (var58 + var9) | 0;
                        var2 = (var2 + Pix2D.width) | 0;
                    }
                } else {
                    var0 = (var0 - var1) | 0;
                    var1 = (var1 - var2) | 0;

                    for (var2 = arrayAtI32(Pix3D.scanline, var2); --var1 >= 0; var2 = (var2 + Pix2D.width) | 0) {
                        Pix3D.flatRaster(Pix2D.pixels, var2, var6, 0, var58 >> 16, var3 >> 16);
                        var3 = (var3 + var8) | 0;
                        var58 = (var58 + var9) | 0;
                    }

                    while (--var0 >= 0) {
                        Pix3D.flatRaster(Pix2D.pixels, var2, var6, 0, var58 >> 16, var4 >> 16);
                        var4 = (var4 + var7) | 0;
                        var58 = (var58 + var9) | 0;
                        var2 = (var2 + Pix2D.width) | 0;
                    }
                }
            }
        }
    }

    // HD hf.a([BIIIIIII)V. The shadow sprite's 16.16 edges are clipped at the top only.
    static fillShadowTriangle(pixels: Uint8Array | null, y1: number, y2: number, y3: number, x1: number, x2: number, x3: number, stride: number): void {
        let slope12 = 0;
        if (y2 !== y1) {
            slope12 = intDivide((x2 - x1) << 16, (y2 - y1) | 0);
        }

        let slope23 = 0;
        if (y3 !== y2) {
            slope23 = intDivide((x3 - x2) << 16, (y3 - y2) | 0);
        }

        let slope31 = 0;
        if (y3 !== y1) {
            slope31 = intDivide((x1 - x3) << 16, (y1 - y3) | 0);
        }

        if (y1 <= y2 && y1 <= y3) {
            if (y2 < y3) {
                let edgeX: number;
                x3 = edgeX = x1 << 16;
                if (y1 < 0) {
                    x3 = (x3 - Math.imul(slope31, y1)) | 0;
                    edgeX = (edgeX - Math.imul(slope12, y1)) | 0;
                    y1 = 0;
                }

                x2 <<= 16;
                if (y2 < 0) {
                    x2 = (x2 - Math.imul(slope23, y2)) | 0;
                    y2 = 0;
                }

                if ((y1 === y2 || slope31 >= slope12) && (y1 !== y2 || slope31 <= slope23)) {
                    y3 = (y3 - y2) | 0;
                    y2 = (y2 - y1) | 0;

                    for (y1 = Math.imul(y1, stride); (y2 = (y2 - 1) | 0) >= 0; y1 = (y1 + stride) | 0) {
                        Pix3D.fillShadowRow(pixels, y1, 0, edgeX >> 16, x3 >> 16);
                        x3 = (x3 + slope31) | 0;
                        edgeX = (edgeX + slope12) | 0;
                    }

                    while ((y3 = (y3 - 1) | 0) >= 0) {
                        Pix3D.fillShadowRow(pixels, y1, 0, x2 >> 16, x3 >> 16);
                        x3 = (x3 + slope31) | 0;
                        x2 = (x2 + slope23) | 0;
                        y1 = (y1 + stride) | 0;
                    }
                } else {
                    y3 = (y3 - y2) | 0;
                    y2 = (y2 - y1) | 0;

                    for (y1 = Math.imul(y1, stride); (y2 = (y2 - 1) | 0) >= 0; y1 = (y1 + stride) | 0) {
                        Pix3D.fillShadowRow(pixels, y1, 0, x3 >> 16, edgeX >> 16);
                        x3 = (x3 + slope31) | 0;
                        edgeX = (edgeX + slope12) | 0;
                    }

                    while ((y3 = (y3 - 1) | 0) >= 0) {
                        Pix3D.fillShadowRow(pixels, y1, 0, x3 >> 16, x2 >> 16);
                        x3 = (x3 + slope31) | 0;
                        x2 = (x2 + slope23) | 0;
                        y1 = (y1 + stride) | 0;
                    }
                }
            } else {
                let edgeX: number;
                x2 = edgeX = x1 << 16;
                if (y1 < 0) {
                    x2 = (x2 - Math.imul(slope31, y1)) | 0;
                    edgeX = (edgeX - Math.imul(slope12, y1)) | 0;
                    y1 = 0;
                }

                x3 <<= 16;
                if (y3 < 0) {
                    x3 = (x3 - Math.imul(slope23, y3)) | 0;
                    y3 = 0;
                }

                if ((y1 === y3 || slope31 >= slope12) && (y1 !== y3 || slope23 <= slope12)) {
                    y2 = (y2 - y3) | 0;
                    y3 = (y3 - y1) | 0;

                    for (y1 = Math.imul(y1, stride); (y3 = (y3 - 1) | 0) >= 0; y1 = (y1 + stride) | 0) {
                        Pix3D.fillShadowRow(pixels, y1, 0, edgeX >> 16, x2 >> 16);
                        x2 = (x2 + slope31) | 0;
                        edgeX = (edgeX + slope12) | 0;
                    }

                    while ((y2 = (y2 - 1) | 0) >= 0) {
                        Pix3D.fillShadowRow(pixels, y1, 0, edgeX >> 16, x3 >> 16);
                        x3 = (x3 + slope23) | 0;
                        edgeX = (edgeX + slope12) | 0;
                        y1 = (y1 + stride) | 0;
                    }
                } else {
                    y2 = (y2 - y3) | 0;
                    y3 = (y3 - y1) | 0;

                    for (y1 = Math.imul(y1, stride); (y3 = (y3 - 1) | 0) >= 0; y1 = (y1 + stride) | 0) {
                        Pix3D.fillShadowRow(pixels, y1, 0, x2 >> 16, edgeX >> 16);
                        x2 = (x2 + slope31) | 0;
                        edgeX = (edgeX + slope12) | 0;
                    }

                    while ((y2 = (y2 - 1) | 0) >= 0) {
                        Pix3D.fillShadowRow(pixels, y1, 0, x3 >> 16, edgeX >> 16);
                        x3 = (x3 + slope23) | 0;
                        edgeX = (edgeX + slope12) | 0;
                        y1 = (y1 + stride) | 0;
                    }
                }
            }
        } else if (y2 <= y3) {
            if (y3 < y1) {
                let edgeX: number;
                x1 = edgeX = x2 << 16;
                if (y2 < 0) {
                    x1 = (x1 - Math.imul(slope12, y2)) | 0;
                    edgeX = (edgeX - Math.imul(slope23, y2)) | 0;
                    y2 = 0;
                }

                x3 <<= 16;
                if (y3 < 0) {
                    x3 = (x3 - Math.imul(slope31, y3)) | 0;
                    y3 = 0;
                }

                if ((y2 === y3 || slope12 >= slope23) && (y2 !== y3 || slope12 <= slope31)) {
                    y1 = (y1 - y3) | 0;
                    y3 = (y3 - y2) | 0;

                    for (y2 = Math.imul(y2, stride); (y3 = (y3 - 1) | 0) >= 0; y2 = (y2 + stride) | 0) {
                        Pix3D.fillShadowRow(pixels, y2, 0, edgeX >> 16, x1 >> 16);
                        x1 = (x1 + slope12) | 0;
                        edgeX = (edgeX + slope23) | 0;
                    }

                    while ((y1 = (y1 - 1) | 0) >= 0) {
                        Pix3D.fillShadowRow(pixels, y2, 0, x3 >> 16, x1 >> 16);
                        x1 = (x1 + slope12) | 0;
                        x3 = (x3 + slope31) | 0;
                        y2 = (y2 + stride) | 0;
                    }
                } else {
                    y1 = (y1 - y3) | 0;
                    y3 = (y3 - y2) | 0;

                    for (y2 = Math.imul(y2, stride); (y3 = (y3 - 1) | 0) >= 0; y2 = (y2 + stride) | 0) {
                        Pix3D.fillShadowRow(pixels, y2, 0, x1 >> 16, edgeX >> 16);
                        x1 = (x1 + slope12) | 0;
                        edgeX = (edgeX + slope23) | 0;
                    }

                    while ((y1 = (y1 - 1) | 0) >= 0) {
                        Pix3D.fillShadowRow(pixels, y2, 0, x1 >> 16, x3 >> 16);
                        x1 = (x1 + slope12) | 0;
                        x3 = (x3 + slope31) | 0;
                        y2 = (y2 + stride) | 0;
                    }
                }
            } else {
                let edgeX: number;
                x3 = edgeX = x2 << 16;
                if (y2 < 0) {
                    x3 = (x3 - Math.imul(slope12, y2)) | 0;
                    edgeX = (edgeX - Math.imul(slope23, y2)) | 0;
                    y2 = 0;
                }

                x1 <<= 16;
                if (y1 < 0) {
                    x1 = (x1 - Math.imul(slope31, y1)) | 0;
                    y1 = 0;
                }

                if (slope12 < slope23) {
                    y3 = (y3 - y1) | 0;
                    y1 = (y1 - y2) | 0;

                    for (y2 = Math.imul(y2, stride); (y1 = (y1 - 1) | 0) >= 0; y2 = (y2 + stride) | 0) {
                        Pix3D.fillShadowRow(pixels, y2, 0, x3 >> 16, edgeX >> 16);
                        x3 = (x3 + slope12) | 0;
                        edgeX = (edgeX + slope23) | 0;
                    }

                    while ((y3 = (y3 - 1) | 0) >= 0) {
                        Pix3D.fillShadowRow(pixels, y2, 0, x1 >> 16, edgeX >> 16);
                        x1 = (x1 + slope31) | 0;
                        edgeX = (edgeX + slope23) | 0;
                        y2 = (y2 + stride) | 0;
                    }
                } else {
                    y3 = (y3 - y1) | 0;
                    y1 = (y1 - y2) | 0;

                    for (y2 = Math.imul(y2, stride); (y1 = (y1 - 1) | 0) >= 0; y2 = (y2 + stride) | 0) {
                        Pix3D.fillShadowRow(pixels, y2, 0, edgeX >> 16, x3 >> 16);
                        x3 = (x3 + slope12) | 0;
                        edgeX = (edgeX + slope23) | 0;
                    }

                    while ((y3 = (y3 - 1) | 0) >= 0) {
                        Pix3D.fillShadowRow(pixels, y2, 0, edgeX >> 16, x1 >> 16);
                        x1 = (x1 + slope31) | 0;
                        edgeX = (edgeX + slope23) | 0;
                        y2 = (y2 + stride) | 0;
                    }
                }
            }
        } else if (y1 < y2) {
            let edgeX: number;
            x2 = edgeX = x3 << 16;
            if (y3 < 0) {
                x2 = (x2 - Math.imul(slope23, y3)) | 0;
                edgeX = (edgeX - Math.imul(slope31, y3)) | 0;
                y3 = 0;
            }

            x1 <<= 16;
            if (y1 < 0) {
                x1 = (x1 - Math.imul(slope12, y1)) | 0;
                y1 = 0;
            }

            if (slope23 < slope31) {
                y2 = (y2 - y1) | 0;
                y1 = (y1 - y3) | 0;

                for (y3 = Math.imul(y3, stride); (y1 = (y1 - 1) | 0) >= 0; y3 = (y3 + stride) | 0) {
                    Pix3D.fillShadowRow(pixels, y3, 0, x2 >> 16, edgeX >> 16);
                    x2 = (x2 + slope23) | 0;
                    edgeX = (edgeX + slope31) | 0;
                }

                while ((y2 = (y2 - 1) | 0) >= 0) {
                    Pix3D.fillShadowRow(pixels, y3, 0, x2 >> 16, x1 >> 16);
                    x2 = (x2 + slope23) | 0;
                    x1 = (x1 + slope12) | 0;
                    y3 = (y3 + stride) | 0;
                }
            } else {
                y2 = (y2 - y1) | 0;
                y1 = (y1 - y3) | 0;

                for (y3 = Math.imul(y3, stride); (y1 = (y1 - 1) | 0) >= 0; y3 = (y3 + stride) | 0) {
                    Pix3D.fillShadowRow(pixels, y3, 0, edgeX >> 16, x2 >> 16);
                    x2 = (x2 + slope23) | 0;
                    edgeX = (edgeX + slope31) | 0;
                }

                while ((y2 = (y2 - 1) | 0) >= 0) {
                    Pix3D.fillShadowRow(pixels, y3, 0, x1 >> 16, x2 >> 16);
                    x2 = (x2 + slope23) | 0;
                    x1 = (x1 + slope12) | 0;
                    y3 = (y3 + stride) | 0;
                }
            }
        } else {
            let edgeX: number;
            x1 = edgeX = x3 << 16;
            if (y3 < 0) {
                x1 = (x1 - Math.imul(slope23, y3)) | 0;
                edgeX = (edgeX - Math.imul(slope31, y3)) | 0;
                y3 = 0;
            }

            x2 <<= 16;
            if (y2 < 0) {
                x2 = (x2 - Math.imul(slope12, y2)) | 0;
                y2 = 0;
            }

            if (slope23 < slope31) {
                y1 = (y1 - y2) | 0;
                y2 = (y2 - y3) | 0;

                for (y3 = Math.imul(y3, stride); (y2 = (y2 - 1) | 0) >= 0; y3 = (y3 + stride) | 0) {
                    Pix3D.fillShadowRow(pixels, y3, 0, x1 >> 16, edgeX >> 16);
                    x1 = (x1 + slope23) | 0;
                    edgeX = (edgeX + slope31) | 0;
                }

                while ((y1 = (y1 - 1) | 0) >= 0) {
                    Pix3D.fillShadowRow(pixels, y3, 0, x2 >> 16, edgeX >> 16);
                    x2 = (x2 + slope12) | 0;
                    edgeX = (edgeX + slope31) | 0;
                    y3 = (y3 + stride) | 0;
                }
            } else {
                y1 = (y1 - y2) | 0;
                y2 = (y2 - y3) | 0;

                for (y3 = Math.imul(y3, stride); (y2 = (y2 - 1) | 0) >= 0; y3 = (y3 + stride) | 0) {
                    Pix3D.fillShadowRow(pixels, y3, 0, edgeX >> 16, x1 >> 16);
                    x1 = (x1 + slope23) | 0;
                    edgeX = (edgeX + slope31) | 0;
                }

                while ((y1 = (y1 - 1) | 0) >= 0) {
                    Pix3D.fillShadowRow(pixels, y3, 0, edgeX >> 16, x2 >> 16);
                    x2 = (x2 + slope12) | 0;
                    edgeX = (edgeX + slope31) | 0;
                    y3 = (y3 + stride) | 0;
                }
            }
        }
    }

    // HD hf.a([BIIII)V. Four byte stores per group, with the fault occurring at the first invalid pixel.
    private static fillShadowRow(pixels: Uint8Array | null, row: number, count: number, start: number, end: number): void {
        if (start < end) {
            row = (row + start) | 0;
            count = (end - start) >> 2;
            while (--count >= 0) {
                arrayPutU8(pixels, row++, 1);
                arrayPutU8(pixels, row++, 1);
                arrayPutU8(pixels, row++, 1);
                arrayPutU8(pixels, row++, 1);
            }
            count = (end - start) & 3;
            while (--count >= 0) {
                arrayPutU8(pixels, row++, 1);
            }
        }
    }

    // dc.c(II)V
    static setOrigin(var0: number, var1: number): void {
        const var2 = arrayAtI32(Pix3D.scanline, 0);
        const var3 = intDivide(var2, Pix2D.width);
        const var4 = (var2 - Math.imul(var3, Pix2D.width)) | 0;
        Pix3D.originX = (var0 - var4) | 0;
        Pix3D.originY = (var1 - var3) | 0;
        Pix3D.clipMinX = -Pix3D.originX | 0;
        Pix3D.clipMaxX = (Pix3D.width - Pix3D.originX) | 0;
        Pix3D.clipMinY = -Pix3D.originY | 0;
        Pix3D.clipMaxY = (Pix3D.height - Pix3D.originY) | 0;
    }
}
