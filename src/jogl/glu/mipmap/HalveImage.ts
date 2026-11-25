import type ByteBuffer from '#/util/nio/ByteBuffer';
import type FloatBuffer from '#/util/nio/FloatBuffer';
import type IntBuffer from '#/util/nio/IntBuffer';
import type ShortBuffer from '#/util/nio/ShortBuffer';
import { JavaError } from '#/util/JavaException';
import { doubleToInt } from '#/util/IntUtils';
import { arrayAtB64, arrayAtF32, arrayAtI16, arrayAtI32, arrayAtObj, arrayPutB64, arrayPutF32, arrayPutI16, arrayPutI32 } from '#/util/JavaArray';
import type Extract from './Extract';
import Mipmap from './Mipmap';

// com.sun.opengl.impl.mipmap.HalveImage (shipped jogl.jar, JOGL 1.1.x): 2x2 box-filter halving, one routine per
// GL pixel type, each with its 1D (width or height 1) twin. Every member the shipped class keeps is ported 1:1,
// including JOGL's slips, which change the output and so must stay:
// - halve1Dimage_byte: the width-1 branch averages but never writes (and halfHeight is computed as width / 2).
// - halve1Dimage_ushort and halve1Dimage_uint: the height-1 branch runs its component loop to halfHeight (1), and
//   the width-1 swap branch stores both samples into slot 0 (halve1Dimage_uint also reads the second at
//   + group_size instead of + ysize).
// - halveImage_uint: the swap branch sums into a second local and writes (int) of the running temp / 4 + 0.5.
// - halveImage_float: the non-swap branch sums three samples (the fourth is positioned but not read).
// - Mipmap.GLU_SWAP_4_BYTES_F returns its input, so the float swap branches read unswapped values.
// The routines position `datain` absolutely from 0: the caller's skip offset and mark are ignored, as in Java.
// Java short/byte locals narrow at each store (i2s/i2b: `<< 16 >> 16`, `<< 24 >> 24`), long locals are bigint and
// float arithmetic is rounded with Math.fround at each operation.
// Known host divergence (GLTRACE.md section 19): halveImage_float and halve1Dimage_float write the canonical NaN
// 7fc00000 for every NaN result, because a JS number cannot carry a NaN payload (JavaScriptCore canonicalizes it),
// where jogl.jar on HotSpot keeps a NaN operand's sign and (quieted) payload. Every other value is bit-exact.
// Unreachable from the client, which builds GL_RGBA/GL_UNSIGNED_BYTE mipmaps only; glu-mipmap-full.test.ts pins it.
export default class HalveImage {
    // com.sun.opengl.impl.mipmap.HalveImage.$assertionsDisabled:Z
    // HalveImage.<clinit>()V sets it to !desiredAssertionStatus() (through the synthetic class$(String) and the
    // class$com$sun$opengl$impl$mipmap$HalveImage cache). The client JVM runs without -ea, so it is true and the
    // assert statements below never evaluate their conditions.
    static readonly $assertionsDisabled: boolean = true;

    // com.sun.opengl.impl.mipmap.HalveImage.<init>()V
    constructor() {}

    // com.sun.opengl.impl.mipmap.HalveImage.halveImage(IIILjava/nio/ShortBuffer;Ljava/nio/ShortBuffer;)V
    // The GL_BITMAP path's halving (ScaleInternal.scale_internal), over tightly packed shorts.
    static halveImage(components: number, width: number, height: number, datain: ShortBuffer, dataout: ShortBuffer): void {
        let i: number, j: number, k: number;

        let t = 0;
        let temp = 0;

        const newwidth = (width / 2) | 0;
        const newheight = (height / 2) | 0;
        const delta = Math.imul(width, components);

        for (i = 0; i < newheight; i++) {
            for (j = 0; j < newwidth; j++) {
                for (k = 0; k < components; k++) {
                    datain.position(t);
                    temp = datain.get();
                    datain.position((t + components) | 0);
                    temp = ((temp + datain.get()) << 16) >> 16;
                    datain.position((t + delta) | 0);
                    temp = ((temp + datain.get()) << 16) >> 16;
                    datain.position((((t + delta) | 0) + components) | 0);
                    temp = ((temp + datain.get()) << 16) >> 16;
                    temp = ((temp + 2) << 16) >> 16;
                    temp = (((temp / 4) | 0) << 16) >> 16;
                    dataout.put(temp);
                    t = (t + 1) | 0;
                }
                t = (t + components) | 0;
            }
            t = (t + delta) | 0;
        }
    }

    // com.sun.opengl.impl.mipmap.HalveImage.halveImage_ubyte(IIILjava/nio/ByteBuffer;Ljava/nio/ByteBuffer;III)V
    static halveImage_ubyte(components: number, width: number, height: number, datain: ByteBuffer, dataout: ByteBuffer, element_size: number, ysize: number, group_size: number): void {
        let i: number, j: number, k: number;

        let t: number;

        // Handle case where there is only 1 column/row
        if (width === 1 || height === 1) {
            if (!HalveImage.$assertionsDisabled && width === 1 && height === 1) throw new JavaError('AssertionError'); // can't be 1x1
            HalveImage.halve1Dimage_ubyte(components, width, height, datain, dataout, element_size, ysize, group_size);
            return;
        }

        const newwidth = (width / 2) | 0;
        const newheight = (height / 2) | 0;
        t = 0;

        let temp = 0;
        for (i = 0; i < newheight; i++) {
            for (j = 0; j < newwidth; j++) {
                for (k = 0; k < components; k++) {
                    datain.position(t);
                    temp = 0xff & datain.getByte();
                    datain.position((t + group_size) | 0);
                    temp = (temp + (0xff & datain.getByte())) | 0;
                    datain.position((t + ysize) | 0);
                    temp = (temp + (0xff & datain.getByte())) | 0;
                    datain.position((t + ysize + group_size) | 0);
                    temp = (temp + (((0xff & datain.getByte()) + 2) | 0)) | 0;
                    dataout.putByte((((temp / 4) | 0) << 24) >> 24);
                    t = (t + element_size) | 0;
                }
                t = (t + group_size) | 0;
            }
            t = (t + ysize) | 0;
        }
    }

    // com.sun.opengl.impl.mipmap.HalveImage.halve1Dimage_ubyte(IIILjava/nio/ByteBuffer;Ljava/nio/ByteBuffer;III)V
    static halve1Dimage_ubyte(components: number, width: number, height: number, datain: ByteBuffer, dataout: ByteBuffer, element_size: number, ysize: number, group_size: number): void {
        let halfWidth = (width / 2) | 0;
        let halfHeight = (height / 2) | 0;
        let src = 0;
        let dest = 0;
        let jj: number;
        let temp = 0;

        if (!HalveImage.$assertionsDisabled && width !== 1 && height !== 1) throw new JavaError('AssertionError'); // must be 1D
        if (!HalveImage.$assertionsDisabled && width === height) throw new JavaError('AssertionError'); // can't be square

        if (height === 1) {
            // 1 row
            if (!HalveImage.$assertionsDisabled && width === 1) throw new JavaError('AssertionError'); // widthxheight can't be 1x1
            halfHeight = 1;

            for (jj = 0; jj < halfWidth; jj++) {
                let kk: number;
                for (kk = 0; kk < components; kk++) {
                    datain.position(src);
                    temp = 0xff & datain.get();
                    datain.position((src + group_size) | 0);
                    temp = (temp + (0xff & datain.get())) | 0;
                    temp = (temp / 2) | 0;
                    dataout.put((temp << 24) >> 24);
                    src = (src + element_size) | 0;
                    dest = (dest + 1) | 0;
                }
                src = (src + group_size) | 0; // skip to next 2
            }
            const padBytes = (ysize - Math.imul(width, group_size)) | 0;
            src = (src + padBytes) | 0; // for assertion only
        } else if (width === 1) {
            // 1 column
            const padBytes = (ysize - Math.imul(width, group_size)) | 0;
            if (!HalveImage.$assertionsDisabled && height === 1) throw new JavaError('AssertionError');
            halfWidth = 1;
            // one vertical column with possible pad bytes per row
            // average two at a time
            for (jj = 0; jj < halfHeight; jj++) {
                let kk: number;
                for (kk = 0; kk < components; kk++) {
                    datain.position(src);
                    temp = 0xff & datain.get();
                    datain.position((src + ysize) | 0);
                    temp = (temp + (0xff & datain.get())) | 0;
                    temp = (temp / 2) | 0;
                    dataout.put((temp << 24) >> 24);
                    src = (src + element_size) | 0;
                    dest = (dest + 1) | 0;
                }
                src = (src + padBytes) | 0; // add pad bytes, if any, to get to end of row
                src = (src + ysize) | 0;
            }
        }
        if (!HalveImage.$assertionsDisabled && src !== Math.imul(ysize, height)) throw new JavaError('AssertionError');
        if (!HalveImage.$assertionsDisabled && dest !== Math.imul(Math.imul(Math.imul(components, element_size), halfWidth), halfHeight)) throw new JavaError('AssertionError');
    }

    // com.sun.opengl.impl.mipmap.HalveImage.halveImage_byte(IIILjava/nio/ByteBuffer;Ljava/nio/ByteBuffer;III)V
    static halveImage_byte(components: number, width: number, height: number, datain: ByteBuffer, dataout: ByteBuffer, element_size: number, ysize: number, group_size: number): void {
        let i: number, j: number, k: number;

        let t = 0;
        let temp = 0;

        // handle case where there is only 1 column
        if (width === 1 || height === 1) {
            if (!HalveImage.$assertionsDisabled && width === 1 && height === 1) throw new JavaError('AssertionError');
            HalveImage.halve1Dimage_byte(components, width, height, datain, dataout, element_size, ysize, group_size);
            return;
        }

        const newwidth = (width / 2) | 0;
        const newheight = (height / 2) | 0;

        for (i = 0; i < newheight; i++) {
            for (j = 0; j < newwidth; j++) {
                for (k = 0; k < components; k++) {
                    datain.position(t);
                    temp = datain.get();
                    datain.position((t + group_size) | 0);
                    temp = ((temp + datain.get()) << 24) >> 24;
                    datain.position((t + ysize) | 0);
                    temp = ((temp + datain.get()) << 24) >> 24;
                    datain.position((((t + ysize) | 0) + group_size) | 0);
                    temp = ((temp + datain.get()) << 24) >> 24;
                    temp = ((temp + 2) << 24) >> 24;
                    temp = (((temp / 4) | 0) << 24) >> 24;
                    dataout.put(temp);
                    t = (t + element_size) | 0;
                }
                t = (t + group_size) | 0;
            }
            t = (t + ysize) | 0;
        }
    }

    // com.sun.opengl.impl.mipmap.HalveImage.halve1Dimage_byte(IIILjava/nio/ByteBuffer;Ljava/nio/ByteBuffer;III)V
    // (sic) halfHeight starts as width / 2, and the width-1 branch computes each average without writing it.
    static halve1Dimage_byte(components: number, width: number, height: number, datain: ByteBuffer, dataout: ByteBuffer, element_size: number, ysize: number, group_size: number): void {
        let halfWidth = (width / 2) | 0;
        let halfHeight = (width / 2) | 0;
        let src = 0;
        let dest = 0;
        let jj: number;
        let temp = 0;

        if (!HalveImage.$assertionsDisabled && width !== 1 && height !== 1) throw new JavaError('AssertionError'); // must be 1D
        if (!HalveImage.$assertionsDisabled && width === height) throw new JavaError('AssertionError'); // can't be square

        if (height === 1) {
            // 1 row
            if (!HalveImage.$assertionsDisabled && width === 1) throw new JavaError('AssertionError'); // widthxheight can't be 1
            halfHeight = 1;

            for (jj = 0; jj < halfWidth; jj++) {
                let kk: number;
                for (kk = 0; kk < components; kk++) {
                    datain.position(src);
                    temp = datain.get();
                    datain.position((src + group_size) | 0);
                    temp = ((temp + datain.get()) << 24) >> 24;
                    temp = (((temp / 2) | 0) << 24) >> 24;
                    dataout.put(temp);
                    src = (src + element_size) | 0;
                    dest = (dest + 1) | 0;
                }
                src = (src + group_size) | 0; // skip to next 2
            }
            const padBytes = (ysize - Math.imul(width, group_size)) | 0;
            src = (src + padBytes) | 0; // for assert only
        } else if (width === 1) {
            // 1 column
            const padBytes = (ysize - Math.imul(width, group_size)) | 0;
            if (!HalveImage.$assertionsDisabled && height === 1) throw new JavaError('AssertionError');
            halfWidth = 1;
            // one vertical column with possible pad bytes per row
            // average two at a time
            for (jj = 0; jj < halfHeight; jj++) {
                let kk: number;
                for (kk = 0; kk < components; kk++) {
                    datain.position(src);
                    temp = datain.get();
                    datain.position((src + ysize) | 0);
                    temp = ((temp + datain.get()) << 24) >> 24;
                    temp = (((temp / 2) | 0) << 24) >> 24;
                    src = (src + element_size) | 0;
                    dest = (dest + 1) | 0;
                }
                src = (src + padBytes) | 0; // add pad bytes, if any, to get to end of row
                src = (src + ysize) | 0;
            }
            if (!HalveImage.$assertionsDisabled && src !== Math.imul(ysize, height)) throw new JavaError('AssertionError');
        }
        if (!HalveImage.$assertionsDisabled && dest !== Math.imul(Math.imul(Math.imul(components, element_size), halfWidth), halfHeight)) throw new JavaError('AssertionError');
    }

    // com.sun.opengl.impl.mipmap.HalveImage.halveImage_ushort(IIILjava/nio/ByteBuffer;Ljava/nio/ShortBuffer;IIIZ)V
    static halveImage_ushort(components: number, width: number, height: number, datain: ByteBuffer, dataout: ShortBuffer, element_size: number, ysize: number, group_size: number, myswap_bytes: boolean): void {
        let i: number, j: number, k: number;

        let t = 0;
        let temp = 0;
        // handle case where there is only 1 column/row
        if (width === 1 || height === 1) {
            if (!HalveImage.$assertionsDisabled && width === 1 && height === 1) throw new JavaError('AssertionError'); // can't be 1x1
            HalveImage.halve1Dimage_ushort(components, width, height, datain, dataout, element_size, ysize, group_size, myswap_bytes);
            return;
        }

        const newwidth = (width / 2) | 0;
        const newheight = (height / 2) | 0;

        // Piece of cake
        if (!myswap_bytes) {
            for (i = 0; i < newheight; i++) {
                for (j = 0; j < newwidth; j++) {
                    for (k = 0; k < components; k++) {
                        datain.position(t);
                        temp = 0x0000ffff & datain.getShort();
                        datain.position((t + group_size) | 0);
                        temp = (temp + (0x0000ffff & datain.getShort())) | 0;
                        datain.position((t + ysize) | 0);
                        temp = (temp + (0x0000ffff & datain.getShort())) | 0;
                        datain.position((((t + ysize) | 0) + group_size) | 0);
                        temp = (temp + (0x0000ffff & datain.getShort())) | 0;
                        dataout.put((((((temp + 2) | 0) / 4) | 0) << 16) >> 16);
                        t = (t + element_size) | 0;
                    }
                    t = (t + group_size) | 0;
                }
                t = (t + ysize) | 0;
            }
        } else {
            for (i = 0; i < newheight; i++) {
                for (j = 0; j < newwidth; j++) {
                    for (k = 0; k < components; k++) {
                        datain.position(t);
                        temp = 0x0000ffff & Mipmap.GLU_SWAP_2_BYTES(datain.getShort());
                        datain.position((t + group_size) | 0);
                        temp = (temp + (0x0000ffff & Mipmap.GLU_SWAP_2_BYTES(datain.getShort()))) | 0;
                        datain.position((t + ysize) | 0);
                        temp = (temp + (0x0000ffff & Mipmap.GLU_SWAP_2_BYTES(datain.getShort()))) | 0;
                        datain.position((((t + ysize) | 0) + group_size) | 0);
                        temp = (temp + (0x0000ffff & Mipmap.GLU_SWAP_2_BYTES(datain.getShort()))) | 0;
                        dataout.put((((((temp + 2) | 0) / 4) | 0) << 16) >> 16);
                        t = (t + element_size) | 0;
                    }
                    t = (t + group_size) | 0;
                }
                t = (t + ysize) | 0;
            }
        }
    }

    // com.sun.opengl.impl.mipmap.HalveImage.halve1Dimage_ushort(IIILjava/nio/ByteBuffer;Ljava/nio/ShortBuffer;IIIZ)V
    // (sic) the 1-row branch's component loop runs to halfHeight (1), and the 1-column swap branch stores both
    // samples in ushort[0].
    static halve1Dimage_ushort(components: number, width: number, height: number, datain: ByteBuffer, dataout: ShortBuffer, element_size: number, ysize: number, group_size: number, myswap_bytes: boolean): void {
        let halfWidth = (width / 2) | 0;
        let halfHeight = (height / 2) | 0;
        let src = 0;
        let dest = 0;
        let jj: number;

        if (!HalveImage.$assertionsDisabled && width !== 1 && height !== 1) throw new JavaError('AssertionError'); // must be 1D
        if (!HalveImage.$assertionsDisabled && width === height) throw new JavaError('AssertionError'); // can't be square

        if (height === 1) {
            // 1 row
            if (!HalveImage.$assertionsDisabled && width === 1) throw new JavaError('AssertionError'); // widthxheight can't be 1
            halfHeight = 1;

            for (jj = 0; jj < halfWidth; jj++) {
                let kk: number;
                for (kk = 0; kk < halfHeight; kk++) {
                    const ushort = new Int32Array(2);
                    if (myswap_bytes) {
                        datain.position(src);
                        arrayPutI32(ushort, 0, 0x0000ffff & Mipmap.GLU_SWAP_2_BYTES(datain.getShort()));
                        datain.position((src + group_size) | 0);
                        arrayPutI32(ushort, 1, 0x0000ffff & Mipmap.GLU_SWAP_2_BYTES(datain.getShort()));
                    } else {
                        datain.position(src);
                        arrayPutI32(ushort, 0, 0x0000ffff & datain.getShort());
                        datain.position((src + group_size) | 0);
                        arrayPutI32(ushort, 1, 0x0000ffff & datain.getShort());
                    }
                    dataout.put((((((arrayAtI32(ushort, 0) + arrayAtI32(ushort, 1)) | 0) / 2) | 0) << 16) >> 16);
                    src = (src + element_size) | 0;
                    dest = (dest + 2) | 0;
                }
                src = (src + group_size) | 0; // skip to next 2
            }
            const padBytes = (ysize - Math.imul(width, group_size)) | 0;
            src = (src + padBytes) | 0; // for assertion only
        } else if (width === 1) {
            // 1 column
            const padBytes = (ysize - Math.imul(width, group_size)) | 0;
            if (!HalveImage.$assertionsDisabled && height === 1) throw new JavaError('AssertionError');
            halfWidth = 1;
            // one vertical column with possible pad bytes per row
            // average two at a time
            for (jj = 0; jj < halfHeight; jj++) {
                let kk: number;
                for (kk = 0; kk < components; kk++) {
                    const ushort = new Int32Array(2);
                    if (myswap_bytes) {
                        datain.position(src);
                        arrayPutI32(ushort, 0, 0x0000ffff & Mipmap.GLU_SWAP_2_BYTES(datain.getShort()));
                        datain.position((src + ysize) | 0);
                        arrayPutI32(ushort, 0, 0x0000ffff & Mipmap.GLU_SWAP_2_BYTES(datain.getShort()));
                    } else {
                        datain.position(src);
                        arrayPutI32(ushort, 0, 0x0000ffff & datain.getShort());
                        datain.position((src + ysize) | 0);
                        arrayPutI32(ushort, 1, 0x0000ffff & datain.getShort());
                    }
                    dataout.put((((((arrayAtI32(ushort, 0) + arrayAtI32(ushort, 1)) | 0) / 2) | 0) << 16) >> 16);
                    src = (src + element_size) | 0;
                    dest = (dest + 2) | 0;
                }
                src = (src + padBytes) | 0; // add pad bytes, if any, to get to end of row
                src = (src + ysize) | 0;
            }
            if (!HalveImage.$assertionsDisabled && src !== Math.imul(ysize, height)) throw new JavaError('AssertionError');
        }
        if (!HalveImage.$assertionsDisabled && dest !== Math.imul(Math.imul(Math.imul(components, element_size), halfWidth), halfHeight)) throw new JavaError('AssertionError');
    }

    // com.sun.opengl.impl.mipmap.HalveImage.halveImage_short(IIILjava/nio/ByteBuffer;Ljava/nio/ShortBuffer;IIIZ)V
    static halveImage_short(components: number, width: number, height: number, datain: ByteBuffer, dataout: ShortBuffer, element_size: number, ysize: number, group_size: number, myswap_bytes: boolean): void {
        let i: number, j: number, k: number;

        let t = 0;
        let temp = 0;
        // handle case where there is only 1 column/row
        if (width === 1 || height === 1) {
            if (!HalveImage.$assertionsDisabled && width === 1 && height === 1) throw new JavaError('AssertionError'); // can't be 1x1
            HalveImage.halve1Dimage_short(components, width, height, datain, dataout, element_size, ysize, group_size, myswap_bytes);
            return;
        }

        const newwidth = (width / 2) | 0;
        const newheight = (height / 2) | 0;

        // Piece of cake
        if (!myswap_bytes) {
            for (i = 0; i < newheight; i++) {
                for (j = 0; j < newwidth; j++) {
                    for (k = 0; k < components; k++) {
                        datain.position(t);
                        temp = datain.getShort();
                        datain.position((t + group_size) | 0);
                        temp = ((temp + datain.getShort()) << 16) >> 16;
                        datain.position((t + ysize) | 0);
                        temp = ((temp + datain.getShort()) << 16) >> 16;
                        datain.position((((t + ysize) | 0) + group_size) | 0);
                        temp = ((temp + datain.getShort()) << 16) >> 16;
                        temp = ((temp + 2) << 16) >> 16;
                        temp = (((temp / 4) | 0) << 16) >> 16;
                        dataout.put(temp);
                        t = (t + element_size) | 0;
                    }
                    t = (t + group_size) | 0;
                }
                t = (t + ysize) | 0;
            }
        } else {
            for (i = 0; i < newheight; i++) {
                for (j = 0; j < newwidth; j++) {
                    for (k = 0; k < components; k++) {
                        datain.position(t);
                        temp = Mipmap.GLU_SWAP_2_BYTES(datain.getShort());
                        datain.position((t + group_size) | 0);
                        temp = ((temp + Mipmap.GLU_SWAP_2_BYTES(datain.getShort())) << 16) >> 16;
                        datain.position((t + ysize) | 0);
                        temp = ((temp + Mipmap.GLU_SWAP_2_BYTES(datain.getShort())) << 16) >> 16;
                        datain.position((((t + ysize) | 0) + group_size) | 0);
                        temp = ((temp + Mipmap.GLU_SWAP_2_BYTES(datain.getShort())) << 16) >> 16;
                        temp = ((temp + 2) << 16) >> 16;
                        temp = (((temp / 4) | 0) << 16) >> 16;
                        dataout.put(temp);
                        t = (t + element_size) | 0;
                    }
                    t = (t + group_size) | 0;
                }
                t = (t + ysize) | 0;
            }
        }
    }

    // com.sun.opengl.impl.mipmap.HalveImage.halve1Dimage_short(IIILjava/nio/ByteBuffer;Ljava/nio/ShortBuffer;IIIZ)V
    static halve1Dimage_short(components: number, width: number, height: number, datain: ByteBuffer, dataout: ShortBuffer, element_size: number, ysize: number, group_size: number, myswap_bytes: boolean): void {
        let halfWidth = (width / 2) | 0;
        let halfHeight = (height / 2) | 0;
        let src = 0;
        let dest = 0;
        let jj: number;

        if (!HalveImage.$assertionsDisabled && width !== 1 && height !== 1) throw new JavaError('AssertionError'); // must be 1D
        if (!HalveImage.$assertionsDisabled && width === height) throw new JavaError('AssertionError'); // can't be square

        if (height === 1) {
            // 1 row
            if (!HalveImage.$assertionsDisabled && width === 1) throw new JavaError('AssertionError'); // can't be 1x1
            halfHeight = 1;

            for (jj = 0; jj < halfWidth; jj++) {
                let kk: number;
                for (kk = 0; kk < components; kk++) {
                    const sshort = new Int16Array(2);
                    if (myswap_bytes) {
                        datain.position(src);
                        arrayPutI16(sshort, 0, Mipmap.GLU_SWAP_2_BYTES(datain.getShort()));
                        datain.position((src + group_size) | 0);
                        arrayPutI16(sshort, 1, Mipmap.GLU_SWAP_2_BYTES(datain.getShort()));
                    } else {
                        datain.position(src);
                        arrayPutI16(sshort, 0, datain.getShort());
                        datain.position((src + group_size) | 0);
                        arrayPutI16(sshort, 1, datain.getShort());
                    }
                    dataout.put((((((arrayAtI16(sshort, 0) + arrayAtI16(sshort, 1)) | 0) / 2) | 0) << 16) >> 16);
                    src = (src + element_size) | 0;
                    dest = (dest + 2) | 0;
                }
                src = (src + group_size) | 0; // skip to next 2
            }
            const padBytes = (ysize - Math.imul(width, group_size)) | 0;
            src = (src + padBytes) | 0; // for assertion only
        } else if (width === 1) {
            const padBytes = (ysize - Math.imul(width, group_size)) | 0;
            if (!HalveImage.$assertionsDisabled && height === 1) throw new JavaError('AssertionError');
            halfWidth = 1;
            // one vertical column with possible pad bytes per row
            // average two at a time
            for (jj = 0; jj < halfHeight; jj++) {
                let kk: number;
                for (kk = 0; kk < components; kk++) {
                    const sshort = new Int16Array(2);
                    if (myswap_bytes) {
                        datain.position(src);
                        arrayPutI16(sshort, 0, Mipmap.GLU_SWAP_2_BYTES(datain.getShort()));
                        datain.position((src + ysize) | 0);
                        arrayPutI16(sshort, 1, Mipmap.GLU_SWAP_2_BYTES(datain.getShort()));
                    } else {
                        datain.position(src);
                        arrayPutI16(sshort, 0, datain.getShort());
                        datain.position((src + ysize) | 0);
                        arrayPutI16(sshort, 1, datain.getShort());
                    }
                    dataout.put((((((arrayAtI16(sshort, 0) + arrayAtI16(sshort, 1)) | 0) / 2) | 0) << 16) >> 16);
                    src = (src + element_size) | 0;
                    dest = (dest + 2) | 0;
                }
                src = (src + padBytes) | 0; // add pad bytes, if any, to get to end of row
                src = (src + ysize) | 0;
            }
            if (!HalveImage.$assertionsDisabled && src !== Math.imul(ysize, height)) throw new JavaError('AssertionError');
        }
        if (!HalveImage.$assertionsDisabled && dest !== Math.imul(Math.imul(Math.imul(components, element_size), halfWidth), halfHeight)) throw new JavaError('AssertionError');
    }

    // com.sun.opengl.impl.mipmap.HalveImage.halveImage_uint(IIILjava/nio/ByteBuffer;Ljava/nio/IntBuffer;IIIZ)V
    // (sic) the swap branch sums into `temp1` but writes (int) of the running `temp / 4 + 0.5`.
    static halveImage_uint(components: number, width: number, height: number, datain: ByteBuffer, dataout: IntBuffer, element_size: number, ysize: number, group_size: number, myswap_bytes: boolean): void {
        let i: number, j: number, k: number;

        let t = 0;
        let temp = 0; // double
        // handle case where there is only 1 column/row
        if (width === 1 || height === 1) {
            if (!HalveImage.$assertionsDisabled && width === 1 && height === 1) throw new JavaError('AssertionError'); // can't be 1x1
            HalveImage.halve1Dimage_uint(components, width, height, datain, dataout, element_size, ysize, group_size, myswap_bytes);
            return;
        }

        const newwidth = (width / 2) | 0;
        const newheight = (height / 2) | 0;

        // Piece of cake
        if (!myswap_bytes) {
            for (i = 0; i < newheight; i++) {
                for (j = 0; j < newwidth; j++) {
                    for (k = 0; k < components; k++) {
                        datain.position(t);
                        temp = Number(0x000000007fffffffn & BigInt(datain.getInt()));
                        datain.position((t + group_size) | 0);
                        temp += Number(0x000000007fffffffn & BigInt(datain.getInt()));
                        datain.position((t + ysize) | 0);
                        temp += Number(0x000000007fffffffn & BigInt(datain.getInt()));
                        datain.position((((t + ysize) | 0) + group_size) | 0);
                        temp += Number(0x000000007fffffffn & BigInt(datain.getInt()));
                        dataout.put(doubleToInt(temp / 4 + 0.5));
                        t = (t + element_size) | 0;
                    }
                    t = (t + group_size) | 0;
                }
                t = (t + ysize) | 0;
            }
        } else {
            for (i = 0; i < newheight; i++) {
                for (j = 0; j < newwidth; j++) {
                    for (k = 0; k < components; k++) {
                        datain.position(t);
                        let temp1 = -1 & Mipmap.GLU_SWAP_4_BYTES(datain.getInt()); // double (i2d)
                        datain.position((t + group_size) | 0);
                        temp1 += -1 & Mipmap.GLU_SWAP_4_BYTES(datain.getInt());
                        datain.position((t + ysize) | 0);
                        temp1 += -1 & Mipmap.GLU_SWAP_4_BYTES(datain.getInt());
                        datain.position((((t + ysize) | 0) + group_size) | 0);
                        void (temp1 + (-1 & Mipmap.GLU_SWAP_4_BYTES(datain.getInt())));
                        temp /= 4;
                        temp += 0.5;
                        dataout.put(doubleToInt(temp));
                        t = (t + element_size) | 0;
                    }
                    t = (t + group_size) | 0;
                }
                t = (t + ysize) | 0;
            }
        }
    }

    // com.sun.opengl.impl.mipmap.HalveImage.halve1Dimage_uint(IIILjava/nio/ByteBuffer;Ljava/nio/IntBuffer;IIIZ)V
    // (sic) the 1-row branch's component loop runs to halfHeight (1); the 1-column swap branch stores both samples
    // in uint[0] and reads the second at + group_size.
    static halve1Dimage_uint(components: number, width: number, height: number, datain: ByteBuffer, dataout: IntBuffer, element_size: number, ysize: number, group_size: number, myswap_bytes: boolean): void {
        let halfWidth = (width / 2) | 0;
        let halfHeight = (height / 2) | 0;
        let src = 0;
        let dest = 0;
        let jj: number;

        if (!HalveImage.$assertionsDisabled && width !== 1 && height !== 1) throw new JavaError('AssertionError'); // must be 1D
        if (!HalveImage.$assertionsDisabled && width === height) throw new JavaError('AssertionError'); // can't be square

        if (height === 1) {
            // 1 row
            if (!HalveImage.$assertionsDisabled && width === 1) throw new JavaError('AssertionError'); // widthxheight can't be 1
            halfHeight = 1;

            for (jj = 0; jj < halfWidth; jj++) {
                let kk: number;
                for (kk = 0; kk < halfHeight; kk++) {
                    const uint = new BigInt64Array(2);
                    if (myswap_bytes) {
                        datain.position(src);
                        arrayPutB64(uint, 0, BigInt(-1 & Mipmap.GLU_SWAP_4_BYTES(datain.getInt())));
                        datain.position((src + group_size) | 0);
                        arrayPutB64(uint, 1, BigInt(-1 & Mipmap.GLU_SWAP_4_BYTES(datain.getInt())));
                    } else {
                        datain.position(src);
                        arrayPutB64(uint, 0, BigInt(-1 & datain.getInt()));
                        datain.position((src + group_size) | 0);
                        arrayPutB64(uint, 1, BigInt(-1 & datain.getInt()));
                    }
                    dataout.put(doubleToInt(Number(BigInt.asIntN(64, arrayAtB64(uint, 0) + arrayAtB64(uint, 1))) / 2));
                    src = (src + element_size) | 0;
                    dest = (dest + 4) | 0;
                }
                src = (src + group_size) | 0; // skip to next 2
            }
            const padBytes = (ysize - Math.imul(width, group_size)) | 0;
            src = (src + padBytes) | 0; // for assertion only
        } else if (width === 1) {
            // 1 column
            const padBytes = (ysize - Math.imul(width, group_size)) | 0;
            if (!HalveImage.$assertionsDisabled && height === 1) throw new JavaError('AssertionError');
            halfWidth = 1;
            // one vertical column with possible pad bytes per row
            // average two at a time
            for (jj = 0; jj < halfHeight; jj++) {
                let kk: number;
                for (kk = 0; kk < components; kk++) {
                    const uint = new BigInt64Array(2);
                    if (myswap_bytes) {
                        datain.position(src);
                        arrayPutB64(uint, 0, BigInt(-1 & Mipmap.GLU_SWAP_4_BYTES(datain.getInt())));
                        datain.position((src + group_size) | 0);
                        arrayPutB64(uint, 0, BigInt(-1 & Mipmap.GLU_SWAP_4_BYTES(datain.getInt())));
                    } else {
                        datain.position(src);
                        arrayPutB64(uint, 0, BigInt(-1 & datain.getInt()));
                        datain.position((src + ysize) | 0);
                        arrayPutB64(uint, 1, BigInt(-1 & datain.getInt()));
                    }
                    dataout.put(doubleToInt(Number(BigInt.asIntN(64, arrayAtB64(uint, 0) + arrayAtB64(uint, 1))) / 2));
                    src = (src + element_size) | 0;
                    dest = (dest + 4) | 0;
                }
                src = (src + padBytes) | 0; // add pad bytes, if any, to get to end of row
                src = (src + ysize) | 0;
            }
            if (!HalveImage.$assertionsDisabled && src !== Math.imul(ysize, height)) throw new JavaError('AssertionError');
        }
        if (!HalveImage.$assertionsDisabled && dest !== Math.imul(Math.imul(Math.imul(components, element_size), halfWidth), halfHeight)) throw new JavaError('AssertionError');
    }

    // com.sun.opengl.impl.mipmap.HalveImage.halveImage_int(IIILjava/nio/ByteBuffer;Ljava/nio/IntBuffer;IIIZ)V
    static halveImage_int(components: number, width: number, height: number, datain: ByteBuffer, dataout: IntBuffer, element_size: number, ysize: number, group_size: number, myswap_bytes: boolean): void {
        const f = Math.fround;
        let i: number, j: number, k: number;

        let t = 0;
        let temp = 0;
        // handle case where there is only 1 column/row
        if (width === 1 || height === 1) {
            if (!HalveImage.$assertionsDisabled && width === 1 && height === 1) throw new JavaError('AssertionError'); // can't be 1x1
            HalveImage.halve1Dimage_int(components, width, height, datain, dataout, element_size, ysize, group_size, myswap_bytes);
            return;
        }

        const newwidth = (width / 2) | 0;
        const newheight = (height / 2) | 0;

        // Piece of cake
        if (!myswap_bytes) {
            for (i = 0; i < newheight; i++) {
                for (j = 0; j < newwidth; j++) {
                    for (k = 0; k < components; k++) {
                        datain.position(t);
                        temp = datain.getInt();
                        datain.position((t + group_size) | 0);
                        temp = (temp + datain.getInt()) | 0;
                        datain.position((t + ysize) | 0);
                        temp = (temp + datain.getInt()) | 0;
                        datain.position((((t + ysize) | 0) + group_size) | 0);
                        temp = (temp + datain.getInt()) | 0;
                        temp = doubleToInt(f(f(f(temp) / 4) + 0.5));
                        dataout.put(temp);
                        t = (t + element_size) | 0;
                    }
                    t = (t + group_size) | 0;
                }
                t = (t + ysize) | 0;
            }
        } else {
            for (i = 0; i < newheight; i++) {
                for (j = 0; j < newwidth; j++) {
                    for (k = 0; k < components; k++) {
                        let buf: bigint;
                        let temp0: number; // float
                        datain.position(t);
                        buf = BigInt(-1 & Mipmap.GLU_SWAP_4_BYTES(datain.getInt()));
                        temp0 = f(Number(buf));
                        datain.position((t + group_size) | 0);
                        buf = BigInt(-1 & Mipmap.GLU_SWAP_4_BYTES(datain.getInt()));
                        temp0 = f(temp0 + f(Number(buf)));
                        datain.position((t + ysize) | 0);
                        buf = BigInt(-1 & Mipmap.GLU_SWAP_4_BYTES(datain.getInt()));
                        temp0 = f(temp0 + f(Number(buf)));
                        datain.position((((t + ysize) | 0) + group_size) | 0);
                        buf = BigInt(-1 & Mipmap.GLU_SWAP_4_BYTES(datain.getInt()));
                        temp0 = f(temp0 + f(Number(buf)));
                        dataout.put(doubleToInt(f(f(temp0 / 4) + 0.5)));
                        t = (t + element_size) | 0;
                    }
                    t = (t + group_size) | 0;
                }
                t = (t + ysize) | 0;
            }
        }
    }

    // com.sun.opengl.impl.mipmap.HalveImage.halve1Dimage_int(IIILjava/nio/ByteBuffer;Ljava/nio/IntBuffer;IIIZ)V
    static halve1Dimage_int(components: number, width: number, height: number, datain: ByteBuffer, dataout: IntBuffer, element_size: number, ysize: number, group_size: number, myswap_bytes: boolean): void {
        const f = Math.fround;
        let halfWidth = (width / 2) | 0;
        let halfHeight = (height / 2) | 0;
        let src = 0;
        let dest = 0;
        let jj: number;

        if (!HalveImage.$assertionsDisabled && width !== 1 && height !== 1) throw new JavaError('AssertionError'); // must be 1D
        if (!HalveImage.$assertionsDisabled && width === height) throw new JavaError('AssertionError'); // can't be square

        if (height === 1) {
            // 1 row
            if (!HalveImage.$assertionsDisabled && width === 1) throw new JavaError('AssertionError'); // widthxheight can't be 1
            halfHeight = 1;

            for (jj = 0; jj < halfWidth; jj++) {
                let kk: number;
                for (kk = 0; kk < components; kk++) {
                    const uint = new BigInt64Array(2);
                    if (myswap_bytes) {
                        datain.position(src);
                        arrayPutB64(uint, 0, BigInt(-1 & Mipmap.GLU_SWAP_4_BYTES(datain.getInt())));
                        datain.position((src + group_size) | 0);
                        arrayPutB64(uint, 1, BigInt(-1 & Mipmap.GLU_SWAP_4_BYTES(datain.getInt())));
                    } else {
                        datain.position(src);
                        arrayPutB64(uint, 0, BigInt(-1 & datain.getInt()));
                        datain.position((src + group_size) | 0);
                        arrayPutB64(uint, 1, BigInt(-1 & datain.getInt()));
                    }
                    dataout.put(doubleToInt(f(f(f(Number(arrayAtB64(uint, 0))) + f(Number(arrayAtB64(uint, 1)))) / 2)));
                    src = (src + element_size) | 0;
                    dest = (dest + 4) | 0;
                }
                src = (src + group_size) | 0; // skip to next 2
            }
            const padBytes = (ysize - Math.imul(width, group_size)) | 0;
            src = (src + padBytes) | 0; // for assertion only
        } else if (width === 1) {
            // 1 column
            const padBytes = (ysize - Math.imul(width, group_size)) | 0;
            if (!HalveImage.$assertionsDisabled && height === 1) throw new JavaError('AssertionError');
            halfWidth = 1;
            // one vertical column with possible pad bytes per row
            // average two at a time
            for (jj = 0; jj < halfHeight; jj++) {
                let kk: number;
                for (kk = 0; kk < components; kk++) {
                    const uint = new BigInt64Array(2);
                    if (myswap_bytes) {
                        datain.position(src);
                        arrayPutB64(uint, 0, BigInt(-1 & Mipmap.GLU_SWAP_4_BYTES(datain.getInt())));
                        datain.position((src + ysize) | 0);
                        arrayPutB64(uint, 1, BigInt(-1 & Mipmap.GLU_SWAP_4_BYTES(datain.getInt())));
                    } else {
                        datain.position(src);
                        arrayPutB64(uint, 0, BigInt(-1 & datain.getInt()));
                        datain.position((src + ysize) | 0);
                        arrayPutB64(uint, 1, BigInt(-1 & datain.getInt()));
                    }
                    dataout.put(doubleToInt(f(f(f(Number(arrayAtB64(uint, 0))) + f(Number(arrayAtB64(uint, 1)))) / 2)));
                    src = (src + element_size) | 0;
                    dest = (dest + 4) | 0;
                }
                src = (src + padBytes) | 0; // add pad bytes, if any, to get to end of row
                src = (src + ysize) | 0;
            }
            if (!HalveImage.$assertionsDisabled && src !== Math.imul(ysize, height)) throw new JavaError('AssertionError');
        }
        if (!HalveImage.$assertionsDisabled && dest !== Math.imul(Math.imul(Math.imul(components, element_size), halfWidth), halfHeight)) throw new JavaError('AssertionError');
    }

    // com.sun.opengl.impl.mipmap.HalveImage.halveImage_float(IIILjava/nio/ByteBuffer;Ljava/nio/FloatBuffer;IIIZ)V
    // (sic) the non-swap branch positions the fourth sample but never reads it: it writes (s0 + s1 + s2) / 4.
    static halveImage_float(components: number, width: number, height: number, datain: ByteBuffer, dataout: FloatBuffer, element_size: number, ysize: number, group_size: number, myswap_bytes: boolean): void {
        const f = Math.fround;
        let i: number, j: number, k: number;

        let t = 0;
        let temp = 0;
        // handle case where there is only 1 column/row
        if (width === 1 || height === 1) {
            if (!HalveImage.$assertionsDisabled && width === 1 && height === 1) throw new JavaError('AssertionError'); // can't be 1x1
            HalveImage.halve1Dimage_float(components, width, height, datain, dataout, element_size, ysize, group_size, myswap_bytes);
            return;
        }

        const newwidth = (width / 2) | 0;
        const newheight = (height / 2) | 0;

        // Piece of cake
        if (!myswap_bytes) {
            for (i = 0; i < newheight; i++) {
                for (j = 0; j < newwidth; j++) {
                    for (k = 0; k < components; k++) {
                        datain.position(t);
                        temp = datain.getFloat();
                        datain.position((t + group_size) | 0);
                        temp = f(temp + datain.getFloat());
                        datain.position((t + ysize) | 0);
                        temp = f(temp + datain.getFloat());
                        datain.position((((t + ysize) | 0) + group_size) | 0);
                        temp = f(temp / 4);
                        dataout.put(temp);
                        t = (t + element_size) | 0;
                    }
                    t = (t + group_size) | 0;
                }
                t = (t + ysize) | 0;
            }
        } else {
            for (i = 0; i < newheight; i++) {
                for (j = 0; j < newwidth; j++) {
                    for (k = 0; k < components; k++) {
                        datain.position(t);
                        let swapbuf = Mipmap.GLU_SWAP_4_BYTES_F(datain.getFloat());
                        datain.position((t + group_size) | 0);
                        swapbuf = f(swapbuf + Mipmap.GLU_SWAP_4_BYTES_F(datain.getFloat()));
                        datain.position((t + ysize) | 0);
                        swapbuf = f(swapbuf + Mipmap.GLU_SWAP_4_BYTES_F(datain.getFloat()));
                        datain.position((((t + ysize) | 0) + group_size) | 0);
                        swapbuf = f(swapbuf + Mipmap.GLU_SWAP_4_BYTES_F(datain.getFloat()));
                        dataout.put(f(swapbuf / 4));
                        t = (t + element_size) | 0;
                    }
                    t = (t + group_size) | 0;
                }
                t = (t + ysize) | 0;
            }
        }
    }

    // com.sun.opengl.impl.mipmap.HalveImage.halve1Dimage_float(IIILjava/nio/ByteBuffer;Ljava/nio/FloatBuffer;IIIZ)V
    static halve1Dimage_float(components: number, width: number, height: number, datain: ByteBuffer, dataout: FloatBuffer, element_size: number, ysize: number, group_size: number, myswap_bytes: boolean): void {
        const f = Math.fround;
        let halfWidth = (width / 2) | 0;
        let halfHeight = (height / 2) | 0;
        let src = 0;
        let dest = 0;
        let jj: number;

        if (!HalveImage.$assertionsDisabled && width !== 1 && height !== 1) throw new JavaError('AssertionError'); // must be 1D
        if (!HalveImage.$assertionsDisabled && width === height) throw new JavaError('AssertionError'); // can't be square

        if (height === 1) {
            // 1 row
            if (!HalveImage.$assertionsDisabled && width === 1) throw new JavaError('AssertionError'); // widthxheight can't be 1
            halfHeight = 1;

            for (jj = 0; jj < halfWidth; jj++) {
                let kk: number;
                for (kk = 0; kk < components; kk++) {
                    const sfloat = new Float32Array(2);
                    if (myswap_bytes) {
                        datain.position(src);
                        arrayPutF32(sfloat, 0, Mipmap.GLU_SWAP_4_BYTES_F(datain.getFloat()));
                        datain.position((src + group_size) | 0);
                        arrayPutF32(sfloat, 1, Mipmap.GLU_SWAP_4_BYTES_F(datain.getFloat()));
                    } else {
                        datain.position(src);
                        arrayPutF32(sfloat, 0, datain.getFloat());
                        datain.position((src + group_size) | 0);
                        arrayPutF32(sfloat, 1, datain.getFloat());
                    }
                    dataout.put(f(f(arrayAtF32(sfloat, 0) + arrayAtF32(sfloat, 1)) / 2));
                    src = (src + element_size) | 0;
                    dest = (dest + 4) | 0;
                }
                src = (src + group_size) | 0; // skip to next 2
            }
            const padBytes = (ysize - Math.imul(width, group_size)) | 0;
            src = (src + padBytes) | 0; // for assertion only
        } else if (width === 1) {
            // 1 column
            const padBytes = (ysize - Math.imul(width, group_size)) | 0;
            if (!HalveImage.$assertionsDisabled && height === 1) throw new JavaError('AssertionError');
            halfWidth = 1;
            // one vertical column with possible pad bytes per row
            // average two at a time
            for (jj = 0; jj < halfHeight; jj++) {
                let kk: number;
                for (kk = 0; kk < components; kk++) {
                    const sfloat = new Float32Array(2);
                    if (myswap_bytes) {
                        datain.position(src);
                        arrayPutF32(sfloat, 0, Mipmap.GLU_SWAP_4_BYTES_F(datain.getFloat()));
                        datain.position((src + ysize) | 0);
                        arrayPutF32(sfloat, 1, Mipmap.GLU_SWAP_4_BYTES_F(datain.getFloat()));
                    } else {
                        datain.position(src);
                        arrayPutF32(sfloat, 0, datain.getFloat());
                        datain.position((src + ysize) | 0);
                        arrayPutF32(sfloat, 1, datain.getFloat());
                    }
                    dataout.put(f(f(arrayAtF32(sfloat, 0) + arrayAtF32(sfloat, 1)) / 2));
                    src = (src + element_size) | 0;
                    dest = (dest + 4) | 0;
                }
                src = (src + padBytes) | 0; // add pad bytes, if any, to get to end of row
                src = (src + ysize) | 0;
            }
            if (!HalveImage.$assertionsDisabled && src !== Math.imul(ysize, height)) throw new JavaError('AssertionError');
        }
        if (!HalveImage.$assertionsDisabled && dest !== Math.imul(Math.imul(Math.imul(components, element_size), halfWidth), halfHeight)) throw new JavaError('AssertionError');
    }

    // com.sun.opengl.impl.mipmap.HalveImage.halveImagePackedPixel(ILcom/sun/opengl/impl/mipmap/Extract;IILjava/nio/ByteBuffer;Ljava/nio/ByteBuffer;IIZ)V
    static halveImagePackedPixel(components: number, extract: Extract, width: number, height: number, packedPixel: ByteBuffer, outImage: ByteBuffer, pixelSizeInBytes: number, rowSizeInBytes: number, isSwap: boolean): void {
        const f = Math.fround;
        if (width === 1 || height === 1) {
            if (!HalveImage.$assertionsDisabled && width === 1 && height === 1) throw new JavaError('AssertionError');
            HalveImage.halve1DimagePackedPixel(components, extract, width, height, packedPixel, outImage, pixelSizeInBytes, rowSizeInBytes, isSwap);
            return;
        }
        let ii: number, jj: number;

        const halfWidth = (width / 2) | 0;
        const halfHeight = (height / 2) | 0;
        let src = 0;
        const padBytes = (rowSizeInBytes - Math.imul(width, pixelSizeInBytes)) | 0;
        let outIndex = 0;

        for (ii = 0; ii < halfHeight; ii++) {
            for (jj = 0; jj < halfWidth; jj++) {
                const totals = new Float32Array(4);
                const extractTotals: Float32Array[] = [new Float32Array(4), new Float32Array(4), new Float32Array(4), new Float32Array(4)];
                let cc: number;

                packedPixel.position(src);
                extract.extract(isSwap, packedPixel, arrayAtObj(extractTotals, 0));
                packedPixel.position((src + pixelSizeInBytes) | 0);
                extract.extract(isSwap, packedPixel, arrayAtObj(extractTotals, 1));
                packedPixel.position((src + rowSizeInBytes) | 0);
                extract.extract(isSwap, packedPixel, arrayAtObj(extractTotals, 2));
                packedPixel.position((((src + rowSizeInBytes) | 0) + pixelSizeInBytes) | 0);
                extract.extract(isSwap, packedPixel, arrayAtObj(extractTotals, 3));
                for (cc = 0; cc < components; cc++) {
                    let kk = 0;

                    // grab 4 pixels to average
                    arrayPutF32(totals, cc, 0);
                    for (kk = 0; kk < 4; kk++) {
                        arrayPutF32(totals, cc, f(arrayAtF32(totals, cc) + arrayAtF32(arrayAtObj(extractTotals, kk), cc)));
                    }
                    arrayPutF32(totals, cc, f(arrayAtF32(totals, cc) / 4));
                }
                extract.shove(totals, outIndex, outImage);
                outIndex = (outIndex + 1) | 0;
                // skip over to next square of 4
                src = (src + ((pixelSizeInBytes + pixelSizeInBytes) | 0)) | 0;
            }
            // skip past pad bytes, if any, to get to next row
            src = (src + padBytes) | 0;
            src = (src + rowSizeInBytes) | 0;
        }
        if (!HalveImage.$assertionsDisabled && src !== Math.imul(rowSizeInBytes, height)) throw new JavaError('AssertionError');
        if (!HalveImage.$assertionsDisabled && outIndex !== Math.imul(halfWidth, halfHeight)) throw new JavaError('AssertionError');
    }

    // com.sun.opengl.impl.mipmap.HalveImage.halve1DimagePackedPixel(ILcom/sun/opengl/impl/mipmap/Extract;IILjava/nio/ByteBuffer;Ljava/nio/ByteBuffer;IIZ)V
    static halve1DimagePackedPixel(components: number, extract: Extract, width: number, height: number, packedPixel: ByteBuffer, outImage: ByteBuffer, pixelSizeInBytes: number, rowSizeInBytes: number, isSwap: boolean): void {
        const f = Math.fround;
        let halfWidth = (width / 2) | 0;
        let halfHeight = (height / 2) | 0;
        let src = 0;
        let jj: number;

        if (!HalveImage.$assertionsDisabled && width !== 1 && height !== 1) throw new JavaError('AssertionError');
        if (!HalveImage.$assertionsDisabled && width === height) throw new JavaError('AssertionError');

        if (height === 1) {
            let outIndex = 0;

            if (!HalveImage.$assertionsDisabled && width === 1) throw new JavaError('AssertionError');
            halfHeight = 1;

            // one horizontal row with possible pad bytes
            for (jj = 0; jj < halfWidth; jj++) {
                const totals = new Float32Array(4);
                const extractTotals: Float32Array[] = [new Float32Array(4), new Float32Array(4)];
                let cc: number;

                packedPixel.position(src);
                extract.extract(isSwap, packedPixel, arrayAtObj(extractTotals, 0));
                packedPixel.position((src + pixelSizeInBytes) | 0);
                extract.extract(isSwap, packedPixel, arrayAtObj(extractTotals, 1));
                for (cc = 0; cc < components; cc++) {
                    let kk = 0;

                    // grab 2 pixels to average
                    arrayPutF32(totals, cc, 0);
                    for (kk = 0; kk < 2; kk++) {
                        arrayPutF32(totals, cc, f(arrayAtF32(totals, cc) + arrayAtF32(arrayAtObj(extractTotals, kk), cc)));
                    }
                    arrayPutF32(totals, cc, f(arrayAtF32(totals, cc) / 2));
                }
                extract.shove(totals, outIndex, outImage);
                outIndex = (outIndex + 1) | 0;
                // skip over to next group of 2
                src = (src + ((pixelSizeInBytes + pixelSizeInBytes) | 0)) | 0;
            }
            const padBytes = (rowSizeInBytes - Math.imul(width, pixelSizeInBytes)) | 0;
            src = (src + padBytes) | 0;

            if (!HalveImage.$assertionsDisabled && src !== rowSizeInBytes) throw new JavaError('AssertionError');
            if (!HalveImage.$assertionsDisabled && outIndex !== Math.imul(halfWidth, halfHeight)) throw new JavaError('AssertionError');
        } else if (width === 1) {
            let outIndex = 0;

            if (!HalveImage.$assertionsDisabled && height === 1) throw new JavaError('AssertionError');
            halfWidth = 1;
            // one vertical column with possible pad bytes per row
            // average two at a time

            for (jj = 0; jj < halfHeight; jj++) {
                const totals = new Float32Array(4);
                const extractTotals: Float32Array[] = [new Float32Array(4), new Float32Array(4)];
                let cc: number;
                // average two at a time, instead of four
                packedPixel.position(src);
                extract.extract(isSwap, packedPixel, arrayAtObj(extractTotals, 0));
                packedPixel.position((src + rowSizeInBytes) | 0);
                extract.extract(isSwap, packedPixel, arrayAtObj(extractTotals, 1));
                for (cc = 0; cc < components; cc++) {
                    let kk = 0;

                    // grab 2 pixels to average
                    arrayPutF32(totals, cc, 0);
                    for (kk = 0; kk < 2; kk++) {
                        arrayPutF32(totals, cc, f(arrayAtF32(totals, cc) + arrayAtF32(arrayAtObj(extractTotals, kk), cc)));
                    }
                    arrayPutF32(totals, cc, f(arrayAtF32(totals, cc) / 2));
                }
                extract.shove(totals, outIndex, outImage);
                outIndex = (outIndex + 1) | 0;
                src = (src + ((rowSizeInBytes + rowSizeInBytes) | 0)) | 0;
            }
            if (!HalveImage.$assertionsDisabled && src !== rowSizeInBytes) throw new JavaError('AssertionError');
            if (!HalveImage.$assertionsDisabled && outIndex !== Math.imul(halfWidth, halfHeight)) throw new JavaError('AssertionError');
        }
    }
}
