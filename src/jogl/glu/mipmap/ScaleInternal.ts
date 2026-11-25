import type ByteBuffer from '#/util/nio/ByteBuffer';
import type FloatBuffer from '#/util/nio/FloatBuffer';
import type IntBuffer from '#/util/nio/IntBuffer';
import type ShortBuffer from '#/util/nio/ShortBuffer';
import { JavaError } from '#/util/JavaException';
import { doubleToInt, intRemainder } from '#/util/IntUtils';
import { arrayAtF32, arrayPutF32 } from '#/util/JavaArray';
import type Extract from './Extract';
import HalveImage from './HalveImage';
import Mipmap from './Mipmap';

// com.sun.opengl.impl.mipmap.ScaleInternal (shipped jogl.jar, JOGL 1.1.x): box-filter resampling to the
// power-of-two size chosen by Mipmap.closestFit, one routine per GL pixel type (GL_SHORT has none: BuildMipmap
// scales it with scale_internal_ushort), plus scale_internal over the GL_BITMAP path's shorts. Each falls back to
// the matching HalveImage routine for an exact 2:1 reduction on both axes.
// BuildMipmap calls them whenever closestFit returns a size other than the input size: a non-power-of-two input,
// a proxy probe that refuses the full size, or the GL_MAX_TEXTURE_SIZE fallback clamping it.
// Every member the shipped class keeps is ported 1:1, including JOGL's slips that change the output:
// - scale_internal_uint: the single-sample branch makes two unused reads of each sample (an absolute getInt and a
//   relative one) before the accumulated read, and the store tests `value >= -1.0f` (both arms store (int)).
// - scaleInternalPackedPixel: highy_float starts at convx_float; the last sample of the last row reuses the previous
//   extract (the buffer is positioned but not read); body samples are weighted by the last `percent`.
// - Mipmap.GLU_SWAP_4_BYTES_F returns its input, so the float swap branches read unswapped values.
// Float arithmetic follows the bytecode: every float operation is rounded with Math.fround; long locals are bigint.
// Known host divergence (GLTRACE.md section 19): scale_internal_float writes the canonical NaN 7fc00000 for every
// NaN result, because a JS number cannot carry a NaN payload (JavaScriptCore canonicalizes it), where jogl.jar on
// HotSpot keeps a NaN operand's sign and (quieted) payload. Every other value is bit-exact. Unreachable from the
// client, which builds GL_RGBA/GL_UNSIGNED_BYTE mipmaps only; glu-mipmap-full.test.ts pins the divergence.
export default class ScaleInternal {
    // com.sun.opengl.impl.mipmap.ScaleInternal.$assertionsDisabled:Z
    // ScaleInternal.<clinit>()V sets it to !desiredAssertionStatus() (through the synthetic class$(String) and the
    // class$com$sun$opengl$impl$mipmap$ScaleInternal cache); true on the client JVM (no -ea), so the assert in
    // scaleInternalPackedPixel never evaluates its condition.
    static readonly $assertionsDisabled: boolean = true;

    // com.sun.opengl.impl.mipmap.ScaleInternal.<init>()V
    constructor() {}

    // com.sun.opengl.impl.mipmap.ScaleInternal.scale_internal(IIILjava/nio/ShortBuffer;IILjava/nio/ShortBuffer;)V
    // The GL_BITMAP path's resampler (BuildMipmap.bitmapBuild2DMipmaps), over tightly packed shorts: a box filter
    // with wrap-around indexing ((index + size) % size) and absolute ShortBuffer reads and writes.
    static scale_internal(components: number, widthin: number, heightin: number, datain: ShortBuffer, widthout: number, heightout: number, dataout: ShortBuffer): void {
        const f = Math.fround;
        let x: number, lowx: number, highx: number;
        let y: number, lowy: number, highy: number;
        let xpercent: number, ypercent: number;
        let percent: number;
        // Max components in a format is 4, so...
        const totals = new Float32Array(4);
        let area: number;
        let i: number, j: number, k: number, yint: number, xint: number, xindex: number, yindex: number;
        let temp: number;

        if (widthin === Math.imul(widthout, 2) && heightin === Math.imul(heightout, 2)) {
            HalveImage.halveImage(components, widthin, heightin, datain, dataout);
            return;
        }
        const convy = f(f(heightin) / f(heightout));
        const convx = f(f(widthin) / f(widthout));
        const halfconvx = f(convx / 2);
        const halfconvy = f(convy / 2);
        for (i = 0; i < heightout; i++) {
            y = f(convy * f(f(i) + 0.5));
            if (heightin > heightout) {
                highy = f(y + halfconvy);
                lowy = f(y - halfconvy);
            } else {
                highy = f(y + 0.5);
                lowy = f(y - 0.5);
            }
            for (j = 0; j < widthout; j++) {
                x = f(convx * f(f(j) + 0.5));
                if (widthin > widthout) {
                    highx = f(x + halfconvx);
                    lowx = f(x - halfconvx);
                } else {
                    highx = f(x + 0.5);
                    lowx = f(x - 0.5);
                }

                // Ok, now apply box filter to box that goes from (lowx, lowy)
                // to (highx, highy) on input data into this pixel on output
                // data.
                // totals[0] = totals[1] = totals[2] = totals[3] = 0.0f; (javac stores index 3 first)
                arrayPutF32(totals, 3, 0);
                arrayPutF32(totals, 2, 0);
                arrayPutF32(totals, 1, 0);
                arrayPutF32(totals, 0, 0);
                area = 0;

                y = lowy;
                yint = doubleToInt(Math.floor(y));
                while (y < highy) {
                    yindex = intRemainder((yint + heightin) | 0, heightin);
                    if (highy < f((yint + 1) | 0)) {
                        ypercent = f(highy - y);
                    } else {
                        ypercent = f(f((yint + 1) | 0) - y);
                    }

                    x = lowx;
                    xint = doubleToInt(Math.floor(x));

                    while (x < highx) {
                        xindex = intRemainder((xint + widthin) | 0, widthin);
                        if (highx < f((xint + 1) | 0)) {
                            xpercent = f(highx - x);
                        } else {
                            xpercent = f(f((xint + 1) | 0) - x);
                        }

                        percent = f(xpercent * ypercent);
                        area = f(area + percent);
                        temp = Math.imul((xindex + Math.imul(yindex, widthin)) | 0, components);
                        for (k = 0; k < components; k++) {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(datain.get((temp + k) | 0)) * percent)));
                        }

                        xint = (xint + 1) | 0;
                        x = f(xint);
                    }
                    yint = (yint + 1) | 0;
                    y = f(yint);
                }

                temp = Math.imul((j + Math.imul(i, widthout)) | 0, components);
                for (k = 0; k < components; k++) {
                    // totals[] should be rounded in the case of enlarging an RGB
                    // ramp when the type is 332 or 4444
                    dataout.put((temp + k) | 0, (doubleToInt(f(f(arrayAtF32(totals, k) + 0.5) / area)) << 16) >> 16);
                }
            }
        }
    }

    // com.sun.opengl.impl.mipmap.ScaleInternal.scale_internal_ubyte(IIILjava/nio/ByteBuffer;IILjava/nio/ByteBuffer;III)V
    static scale_internal_ubyte(components: number, widthin: number, heightin: number, datain: ByteBuffer, widthout: number, heightout: number, dataout: ByteBuffer, element_size: number, ysize: number, group_size: number): void {
        const f = Math.fround;

        let percent: number;
        // Max components in a format is 4, so...
        const totals = new Float32Array(4);

        let i: number, j: number, k: number, xindex: number;

        let temp: number, temp0: number;
        let temp_index: number;
        let outindex: number;

        let lowx_int: number, highx_int: number, lowy_int: number, highy_int: number;
        let x_percent: number, y_percent: number;
        let lowx_float: number, highx_float: number, lowy_float: number, highy_float: number;

        let l: number, m: number;
        let left: number, right: number;

        if (widthin === Math.imul(widthout, 2) && heightin === Math.imul(heightout, 2)) {
            HalveImage.halveImage_ubyte(components, widthin, heightin, datain, dataout, element_size, ysize, group_size);
            return;
        }
        const convy = f(f(heightin) / f(heightout));
        const convx = f(f(widthin) / f(widthout));
        const convy_int = doubleToInt(Math.floor(convy));
        const convy_float = f(convy - f(convy_int));
        const convx_int = doubleToInt(Math.floor(convx));
        const convx_float = f(convx - f(convx_int));

        const area = f(convx * convy);

        lowy_int = 0;
        lowy_float = 0;
        highy_int = convy_int;
        highy_float = convy_float;

        for (i = 0; i < heightout; i++) {
            // Clamp here to be sure we don't read beyond input buffer.
            if (highy_int >= heightin) {
                highy_int = (heightin - 1) | 0;
            }
            lowx_int = 0;
            lowx_float = 0;
            highx_int = convx_int;
            highx_float = convx_float;

            for (j = 0; j < widthout; j++) {
                // Ok, now apply box filter to box that goes from (lowx, lowy)
                // to (highx, highy) on input data into this pixel on output
                // data.
                // totals[0] = totals[1] = totals[2] = totals[3] = 0.0f; (javac stores index 3 first)
                arrayPutF32(totals, 3, 0);
                arrayPutF32(totals, 2, 0);
                arrayPutF32(totals, 1, 0);
                arrayPutF32(totals, 0, 0);

                // caulate the value for pixels in the 1st row
                xindex = Math.imul(lowx_int, group_size);
                if (highy_int > lowy_int && highx_int > lowx_int) {
                    y_percent = f(1 - lowy_float);
                    temp = (xindex + Math.imul(lowy_int, ysize)) | 0;
                    percent = f(y_percent * f(1 - lowx_float));
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f((0xff & datain.get()) * percent)));
                    }
                    left = temp;
                    for (l = (lowx_int + 1) | 0; l < highx_int; l++) {
                        temp = (temp + group_size) | 0;
                        for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                            datain.position(temp_index);
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f((0xff & datain.get()) * y_percent)));
                        }
                    }
                    temp = (temp + group_size) | 0;
                    right = temp;
                    percent = f(y_percent * highx_float);
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f((0xff & datain.get()) * percent)));
                    }

                    // calculate the value for pixels in the last row
                    y_percent = highy_float;
                    percent = f(y_percent * f(1 - lowx_float));
                    temp = (xindex + Math.imul(highy_int, ysize)) | 0;
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f((0xff & datain.get()) * percent)));
                    }
                    for (l = (lowx_int + 1) | 0; l < highx_int; l++) {
                        temp = (temp + group_size) | 0;
                        for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                            datain.position(temp_index);
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f((0xff & datain.get()) * y_percent)));
                        }
                    }
                    temp = (temp + group_size) | 0;
                    percent = f(y_percent * highx_float);
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f((0xff & datain.get()) * percent)));
                    }

                    // calculate the value for the pixels in the 1st and last column
                    for (m = (lowy_int + 1) | 0; m < highy_int; m++) {
                        left = (left + ysize) | 0;
                        right = (right + ysize) | 0;
                        for (k = 0; k < components; k++, left = (left + element_size) | 0, right = (right + element_size) | 0) {
                            let fv = 0;
                            datain.position(left);
                            fv = f((0xff & datain.get()) * f(1 - lowx_float));
                            datain.position(right);
                            fv = f(fv + f((0xff & datain.get()) * highx_float));
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + fv));
                        }
                    }
                } else if (highy_int > lowy_int) {
                    x_percent = f(highx_float - lowx_float);
                    percent = f(f(1 - lowy_float) * x_percent);
                    temp = (xindex + Math.imul(lowy_int, ysize)) | 0;
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f((0xff & datain.get()) * percent)));
                    }
                    for (m = (lowy_int + 1) | 0; m < highy_int; m++) {
                        temp = (temp + ysize) | 0;
                        for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                            datain.position(temp_index);
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f((0xff & datain.get()) * x_percent)));
                        }
                    }
                    percent = f(x_percent * highy_float);
                    temp = (temp + ysize) | 0;
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f((0xff & datain.get()) * percent)));
                    }
                } else if (highx_int > lowx_int) {
                    y_percent = f(highy_float - lowy_float);
                    percent = f(f(1 - lowx_float) * y_percent);
                    temp = (xindex + Math.imul(lowy_int, ysize)) | 0;
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f((0xff & datain.get()) * percent)));
                    }
                    for (l = (lowx_int + 1) | 0; l < highx_int; l++) {
                        temp = (temp + group_size) | 0;
                        for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                            datain.position(temp_index);
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f((0xff & datain.get()) * y_percent)));
                        }
                    }
                    temp = (temp + group_size) | 0;
                    percent = f(y_percent * highx_float);
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f((0xff & datain.get()) * percent)));
                    }
                } else {
                    percent = f(f(highy_float - lowy_float) * f(highx_float - lowx_float));
                    temp = (xindex + Math.imul(lowy_int, ysize)) | 0;
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f((0xff & datain.get()) * percent)));
                    }
                }

                // this is for the pixels in the body
                temp0 = (xindex + group_size + Math.imul((lowy_int + 1) | 0, ysize)) | 0;
                for (m = (lowy_int + 1) | 0; m < highy_int; m++) {
                    temp = temp0;
                    for (l = (lowx_int + 1) | 0; l < highx_int; l++) {
                        for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                            datain.position(temp_index);
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + (0xff & datain.get())));
                        }
                        temp = (temp + group_size) | 0;
                    }
                    temp0 = (temp0 + ysize) | 0;
                }

                outindex = Math.imul((j + Math.imul(i, widthout)) | 0, components);
                for (k = 0; k < components; k++) {
                    dataout.position((outindex + k) | 0);
                    dataout.put((doubleToInt(f(arrayAtF32(totals, k) / area)) << 24) >> 24);
                }
                lowx_int = highx_int;
                lowx_float = highx_float;
                highx_int = (highx_int + convx_int) | 0;
                highx_float = f(highx_float + convx_float);
                if (highx_float > 1) {
                    highx_float = f(highx_float - 1);
                    highx_int = (highx_int + 1) | 0;
                }

                // Clamp to make sure we don't run off the right edge
                if (highx_int > ((widthin - 1) | 0)) {
                    const delta = (((highx_int - widthin) | 0) + 1) | 0;
                    lowx_int = (lowx_int - delta) | 0;
                    highx_int = (highx_int - delta) | 0;
                }
            }
            lowy_int = highy_int;
            lowy_float = highy_float;
            highy_int = (highy_int + convy_int) | 0;
            highy_float = f(highy_float + convy_float);
            if (highy_float > 1) {
                highy_float = f(highy_float - 1);
                highy_int = (highy_int + 1) | 0;
            }
        }
    }

    // com.sun.opengl.impl.mipmap.ScaleInternal.scale_internal_byte(IIILjava/nio/ByteBuffer;IILjava/nio/ByteBuffer;III)V
    static scale_internal_byte(components: number, widthin: number, heightin: number, datain: ByteBuffer, widthout: number, heightout: number, dataout: ByteBuffer, element_size: number, ysize: number, group_size: number): void {
        const f = Math.fround;

        let percent: number;
        // Max components in a format is 4, so...
        const totals = new Float32Array(4);

        let i: number, j: number, k: number, xindex: number;

        let temp: number, temp0: number;
        let temp_index: number;
        let outindex: number;

        let lowx_int: number, highx_int: number, lowy_int: number, highy_int: number;
        let x_percent: number, y_percent: number;
        let lowx_float: number, highx_float: number, lowy_float: number, highy_float: number;

        let l: number, m: number;
        let left: number, right: number;

        if (widthin === Math.imul(widthout, 2) && heightin === Math.imul(heightout, 2)) {
            HalveImage.halveImage_byte(components, widthin, heightin, datain, dataout, element_size, ysize, group_size);
            return;
        }
        const convy = f(f(heightin) / f(heightout));
        const convx = f(f(widthin) / f(widthout));
        const convy_int = doubleToInt(Math.floor(convy));
        const convy_float = f(convy - f(convy_int));
        const convx_int = doubleToInt(Math.floor(convx));
        const convx_float = f(convx - f(convx_int));

        const area = f(convx * convy);

        lowy_int = 0;
        lowy_float = 0;
        highy_int = convy_int;
        highy_float = convy_float;

        for (i = 0; i < heightout; i++) {
            // Clamp here to be sure we don't read beyond input buffer.
            if (highy_int >= heightin) {
                highy_int = (heightin - 1) | 0;
            }
            lowx_int = 0;
            lowx_float = 0;
            highx_int = convx_int;
            highx_float = convx_float;

            for (j = 0; j < widthout; j++) {
                // Ok, now apply box filter to box that goes from (lowx, lowy)
                // to (highx, highy) on input data into this pixel on output
                // data.
                // totals[0] = totals[1] = totals[2] = totals[3] = 0.0f; (javac stores index 3 first)
                arrayPutF32(totals, 3, 0);
                arrayPutF32(totals, 2, 0);
                arrayPutF32(totals, 1, 0);
                arrayPutF32(totals, 0, 0);

                // calculate the value for pixels in the 1st row
                xindex = Math.imul(lowx_int, group_size);
                if (highy_int > lowy_int && highx_int > lowx_int) {
                    y_percent = f(1 - lowy_float);
                    temp = (xindex + Math.imul(lowy_int, ysize)) | 0;
                    percent = f(y_percent * f(1 - lowx_float));
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(datain.get()) * percent)));
                    }
                    left = temp;
                    for (l = (lowx_int + 1) | 0; l < highx_int; l++) {
                        temp = (temp + group_size) | 0;
                        for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                            datain.position(temp_index);
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(datain.get()) * y_percent)));
                        }
                    }
                    temp = (temp + group_size) | 0;
                    right = temp;
                    percent = f(y_percent * highx_float);
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(datain.get()) * percent)));
                    }

                    // calculate the value for pixels in the last row
                    y_percent = highy_float;
                    percent = f(y_percent * f(1 - lowx_float));
                    temp = (xindex + Math.imul(highy_int, ysize)) | 0;
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(datain.get()) * percent)));
                    }
                    for (l = (lowx_int + 1) | 0; l < highx_int; l++) {
                        temp = (temp + group_size) | 0;
                        for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                            datain.position(temp_index);
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(datain.get()) * y_percent)));
                        }
                    }
                    temp = (temp + group_size) | 0;
                    percent = f(y_percent * highx_float);
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(datain.get()) * percent)));
                    }

                    // calculate the value for the pixels in the 1st and last column
                    for (m = (lowy_int + 1) | 0; m < highy_int; m++) {
                        left = (left + ysize) | 0;
                        right = (right + ysize) | 0;
                        for (k = 0; k < components; k++, left = (left + element_size) | 0, right = (right + element_size) | 0) {
                            let fv = 0;
                            datain.position(left);
                            fv = f(f(datain.get()) * f(1 - lowx_float));
                            datain.position(right);
                            fv = f(fv + f(f(datain.get()) * highx_float));
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + fv));
                        }
                    }
                } else if (highy_int > lowy_int) {
                    x_percent = f(highx_float - lowx_float);
                    percent = f(f(1 - lowy_float) * x_percent);
                    temp = (xindex + Math.imul(lowy_int, ysize)) | 0;
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(datain.get()) * percent)));
                    }
                    for (m = (lowy_int + 1) | 0; m < highy_int; m++) {
                        temp = (temp + ysize) | 0;
                        for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                            datain.position(temp_index);
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(datain.get()) * x_percent)));
                        }
                    }
                    percent = f(x_percent * highy_float);
                    temp = (temp + ysize) | 0;
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(datain.get()) * percent)));
                    }
                } else if (highx_int > lowx_int) {
                    y_percent = f(highy_float - lowy_float);
                    percent = f(f(1 - lowx_float) * y_percent);
                    temp = (xindex + Math.imul(lowy_int, ysize)) | 0;
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(datain.get()) * percent)));
                    }
                    for (l = (lowx_int + 1) | 0; l < highx_int; l++) {
                        temp = (temp + group_size) | 0;
                        for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                            datain.position(temp_index);
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(datain.get()) * y_percent)));
                        }
                    }
                    temp = (temp + group_size) | 0;
                    percent = f(y_percent * highx_float);
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(datain.get()) * percent)));
                    }
                } else {
                    percent = f(f(highy_float - lowy_float) * f(highx_float - lowx_float));
                    temp = (xindex + Math.imul(lowy_int, ysize)) | 0;
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(datain.get()) * percent)));
                    }
                }

                // this is for the pixels in the body
                temp0 = (xindex + group_size + Math.imul((lowy_int + 1) | 0, ysize)) | 0;
                for (m = (lowy_int + 1) | 0; m < highy_int; m++) {
                    temp = temp0;
                    for (l = (lowx_int + 1) | 0; l < highx_int; l++) {
                        for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                            datain.position(temp_index);
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(datain.get())));
                        }
                        temp = (temp + group_size) | 0;
                    }
                    temp0 = (temp0 + ysize) | 0;
                }

                outindex = Math.imul((j + Math.imul(i, widthout)) | 0, components);
                for (k = 0; k < components; k++) {
                    dataout.position((outindex + k) | 0);
                    dataout.put((doubleToInt(f(arrayAtF32(totals, k) / area)) << 24) >> 24);
                }
                lowx_int = highx_int;
                lowx_float = highx_float;
                highx_int = (highx_int + convx_int) | 0;
                highx_float = f(highx_float + convx_float);
                if (highx_float > 1) {
                    highx_float = f(highx_float - 1);
                    highx_int = (highx_int + 1) | 0;
                }

                // Clamp to make sure we don't run off the right edge
                if (highx_int > ((widthin - 1) | 0)) {
                    const delta = (((highx_int - widthin) | 0) + 1) | 0;
                    lowx_int = (lowx_int - delta) | 0;
                    highx_int = (highx_int - delta) | 0;
                }
            }
            lowy_int = highy_int;
            lowy_float = highy_float;
            highy_int = (highy_int + convy_int) | 0;
            highy_float = f(highy_float + convy_float);
            if (highy_float > 1) {
                highy_float = f(highy_float - 1);
                highy_int = (highy_int + 1) | 0;
            }
        }
    }

    // com.sun.opengl.impl.mipmap.ScaleInternal.scale_internal_ushort(IIILjava/nio/ByteBuffer;IILjava/nio/ShortBuffer;IIIZ)V
    static scale_internal_ushort(
        components: number,
        widthin: number,
        heightin: number,
        datain: ByteBuffer,
        widthout: number,
        heightout: number,
        dataout: ShortBuffer,
        element_size: number,
        ysize: number,
        group_size: number,
        myswap_bytes: boolean
    ): void {
        const f = Math.fround;

        let percent: number;
        // Max components in a format is 4, so...
        const totals = new Float32Array(4);

        let i: number, j: number, k: number, xindex: number;

        let temp: number, temp0: number;
        let temp_index: number;
        let outindex: number;

        let lowx_int: number, highx_int: number, lowy_int: number, highy_int: number;
        let x_percent: number, y_percent: number;
        let lowx_float: number, highx_float: number, lowy_float: number, highy_float: number;

        let l: number, m: number;
        let left: number, right: number;

        if (widthin === Math.imul(widthout, 2) && heightin === Math.imul(heightout, 2)) {
            HalveImage.halveImage_ushort(components, widthin, heightin, datain, dataout, element_size, ysize, group_size, myswap_bytes);
            return;
        }
        const convy = f(f(heightin) / f(heightout));
        const convx = f(f(widthin) / f(widthout));
        const convy_int = doubleToInt(Math.floor(convy));
        const convy_float = f(convy - f(convy_int));
        const convx_int = doubleToInt(Math.floor(convx));
        const convx_float = f(convx - f(convx_int));

        const area = f(convx * convy);

        lowy_int = 0;
        lowy_float = 0;
        highy_int = convy_int;
        highy_float = convy_float;

        for (i = 0; i < heightout; i++) {
            // Clamp here to be sure we don't read beyond input buffer.
            if (highy_int >= heightin) {
                highy_int = (heightin - 1) | 0;
            }
            lowx_int = 0;
            lowx_float = 0;
            highx_int = convx_int;
            highx_float = convx_float;

            for (j = 0; j < widthout; j++) {
                // Ok, now apply box filter to box that goes from (lowx, lowy)
                // to (highx, highy) on input data into this pixel on output
                // data.
                // totals[0] = totals[1] = totals[2] = totals[3] = 0.0f; (javac stores index 3 first)
                arrayPutF32(totals, 3, 0);
                arrayPutF32(totals, 2, 0);
                arrayPutF32(totals, 1, 0);
                arrayPutF32(totals, 0, 0);

                // calculate the value for pixels in the 1st row
                xindex = Math.imul(lowx_int, group_size);
                if (highy_int > lowy_int && highx_int > lowx_int) {
                    y_percent = f(1 - lowy_float);
                    temp = (xindex + Math.imul(lowy_int, ysize)) | 0;
                    percent = f(y_percent * f(1 - lowx_float));
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        if (myswap_bytes) {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(0x0000ffff & Mipmap.GLU_SWAP_2_BYTES(datain.getShort())) * percent)));
                        } else {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(0x0000ffff & datain.getShort()) * percent)));
                        }
                    }
                    left = temp;
                    for (l = (lowx_int + 1) | 0; l < highx_int; l++) {
                        temp = (temp + group_size) | 0;
                        for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                            datain.position(temp_index);
                            if (myswap_bytes) {
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(0x0000ffff & Mipmap.GLU_SWAP_2_BYTES(datain.getShort())) * y_percent)));
                            } else {
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(0x0000ffff & datain.getShort()) * y_percent)));
                            }
                        }
                    }
                    temp = (temp + group_size) | 0;
                    right = temp;
                    percent = f(y_percent * highx_float);
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        if (myswap_bytes) {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(0x0000ffff & Mipmap.GLU_SWAP_2_BYTES(datain.getShort())) * percent)));
                        } else {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(0x0000ffff & datain.getShort()) * percent)));
                        }
                    }

                    // calculate the value for pixels in the last row
                    y_percent = highy_float;
                    percent = f(y_percent * f(1 - lowx_float));
                    temp = (xindex + Math.imul(highy_int, ysize)) | 0;
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        if (myswap_bytes) {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(0x0000ffff & Mipmap.GLU_SWAP_2_BYTES(datain.getShort())) * percent)));
                        } else {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(0x0000ffff & datain.getShort()) * percent)));
                        }
                    }
                    for (l = (lowx_int + 1) | 0; l < highx_int; l++) {
                        temp = (temp + group_size) | 0;
                        for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                            datain.position(temp_index);
                            if (myswap_bytes) {
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(0x0000ffff & Mipmap.GLU_SWAP_2_BYTES(datain.getShort())) * y_percent)));
                            } else {
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(0x0000ffff & datain.getShort()) * y_percent)));
                            }
                        }
                    }
                    temp = (temp + group_size) | 0;
                    percent = f(y_percent * highx_float);
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        if (myswap_bytes) {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(0x0000ffff & Mipmap.GLU_SWAP_2_BYTES(datain.getShort())) * percent)));
                        } else {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(0x0000ffff & datain.getShort()) * percent)));
                        }
                    }

                    // calculate the value for the pixels in the 1st and last column
                    for (m = (lowy_int + 1) | 0; m < highy_int; m++) {
                        left = (left + ysize) | 0;
                        right = (right + ysize) | 0;
                        for (k = 0; k < components; k++, left = (left + element_size) | 0, right = (right + element_size) | 0) {
                            if (myswap_bytes) {
                                datain.position(left);
                                let fv = f(f(0x0000ffff & Mipmap.GLU_SWAP_2_BYTES(datain.getShort())) * f(1 - lowx_float));
                                datain.position(right);
                                fv = f(fv + f(f(0x0000ffff & Mipmap.GLU_SWAP_2_BYTES(datain.getShort())) * highx_float));
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + fv));
                            } else {
                                datain.position(left);
                                let fv = f(f(0x0000ffff & datain.getShort()) * f(1 - lowx_float));
                                datain.position(right);
                                fv = f(fv + f(f(0x0000ffff & datain.getShort()) * highx_float));
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + fv));
                            }
                        }
                    }
                } else if (highy_int > lowy_int) {
                    x_percent = f(highx_float - lowx_float);
                    percent = f(f(1 - lowy_float) * x_percent);
                    temp = (xindex + Math.imul(lowy_int, ysize)) | 0;
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        if (myswap_bytes) {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(0x0000ffff & Mipmap.GLU_SWAP_2_BYTES(datain.getShort())) * percent)));
                        } else {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(0x0000ffff & datain.getShort()) * percent)));
                        }
                    }
                    for (m = (lowy_int + 1) | 0; m < highy_int; m++) {
                        temp = (temp + ysize) | 0;
                        for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                            datain.position(temp_index);
                            if (myswap_bytes) {
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(0x0000ffff & Mipmap.GLU_SWAP_2_BYTES(datain.getShort())) * x_percent)));
                            } else {
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(0x0000ffff & datain.getShort()) * x_percent)));
                            }
                        }
                    }
                    percent = f(x_percent * highy_float);
                    temp = (temp + ysize) | 0;
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        if (myswap_bytes) {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(0x0000ffff & Mipmap.GLU_SWAP_2_BYTES(datain.getShort())) * percent)));
                        } else {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(0x0000ffff & datain.getShort()) * percent)));
                        }
                    }
                } else if (highx_int > lowx_int) {
                    y_percent = f(highy_float - lowy_float);
                    percent = f(f(1 - lowx_float) * y_percent);
                    temp = (xindex + Math.imul(lowy_int, ysize)) | 0;
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        if (myswap_bytes) {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(0x0000ffff & Mipmap.GLU_SWAP_2_BYTES(datain.getShort())) * percent)));
                        } else {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(0x0000ffff & datain.getShort()) * percent)));
                        }
                    }
                    for (l = (lowx_int + 1) | 0; l < highx_int; l++) {
                        temp = (temp + group_size) | 0;
                        for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                            datain.position(temp_index);
                            if (myswap_bytes) {
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(0x0000ffff & Mipmap.GLU_SWAP_2_BYTES(datain.getShort())) * y_percent)));
                            } else {
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(0x0000ffff & datain.getShort()) * y_percent)));
                            }
                        }
                    }
                    temp = (temp + group_size) | 0;
                    percent = f(y_percent * highx_float);
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        if (myswap_bytes) {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(0x0000ffff & Mipmap.GLU_SWAP_2_BYTES(datain.getShort())) * percent)));
                        } else {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(0x0000ffff & datain.getShort()) * percent)));
                        }
                    }
                } else {
                    percent = f(f(highy_float - lowy_float) * f(highx_float - lowx_float));
                    temp = (xindex + Math.imul(lowy_int, ysize)) | 0;
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        if (myswap_bytes) {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(0x0000ffff & Mipmap.GLU_SWAP_2_BYTES(datain.getShort())) * percent)));
                        } else {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(0x0000ffff & datain.getShort()) * percent)));
                        }
                    }
                }

                // this is for the pixels in the body
                temp0 = (xindex + group_size + Math.imul((lowy_int + 1) | 0, ysize)) | 0;
                for (m = (lowy_int + 1) | 0; m < highy_int; m++) {
                    temp = temp0;
                    for (l = (lowx_int + 1) | 0; l < highx_int; l++) {
                        for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                            datain.position(temp_index);
                            if (myswap_bytes) {
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(0x0000ffff & Mipmap.GLU_SWAP_2_BYTES(datain.getShort()))));
                            } else {
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(0x0000ffff & datain.getShort())));
                            }
                        }
                        temp = (temp + group_size) | 0;
                    }
                    temp0 = (temp0 + ysize) | 0;
                }

                outindex = Math.imul((j + Math.imul(i, widthout)) | 0, components);
                for (k = 0; k < components; k++) {
                    dataout.position((outindex + k) | 0);
                    dataout.put((doubleToInt(f(arrayAtF32(totals, k) / area)) << 16) >> 16);
                }
                lowx_int = highx_int;
                lowx_float = highx_float;
                highx_int = (highx_int + convx_int) | 0;
                highx_float = f(highx_float + convx_float);
                if (highx_float > 1) {
                    highx_float = f(highx_float - 1);
                    highx_int = (highx_int + 1) | 0;
                }

                // Clamp to make sure we don't run off the right edge
                if (highx_int > ((widthin - 1) | 0)) {
                    const delta = (((highx_int - widthin) | 0) + 1) | 0;
                    lowx_int = (lowx_int - delta) | 0;
                    highx_int = (highx_int - delta) | 0;
                }
            }
            lowy_int = highy_int;
            lowy_float = highy_float;
            highy_int = (highy_int + convy_int) | 0;
            highy_float = f(highy_float + convy_float);
            if (highy_float > 1) {
                highy_float = f(highy_float - 1);
                highy_int = (highy_int + 1) | 0;
            }
        }
    }

    // com.sun.opengl.impl.mipmap.ScaleInternal.scale_internal_uint(IIILjava/nio/ByteBuffer;IILjava/nio/IntBuffer;IIIZ)V
    static scale_internal_uint(components: number, widthin: number, heightin: number, datain: ByteBuffer, widthout: number, heightout: number, dataout: IntBuffer, element_size: number, ysize: number, group_size: number, myswap_bytes: boolean): void {
        const f = Math.fround;

        let percent: number;
        // Max components in a format is 4, so...
        const totals = new Float32Array(4);

        let i: number, j: number, k: number, xindex: number;

        let temp: number, temp0: number;
        let temp_index: number;
        let outindex: number;

        let lowx_int: number, highx_int: number, lowy_int: number, highy_int: number;
        let x_percent: number, y_percent: number;
        let lowx_float: number, highx_float: number, lowy_float: number, highy_float: number;

        let l: number, m: number;
        let left: number, right: number;

        if (widthin === Math.imul(widthout, 2) && heightin === Math.imul(heightout, 2)) {
            HalveImage.halveImage_uint(components, widthin, heightin, datain, dataout, element_size, ysize, group_size, myswap_bytes);
            return;
        }
        const convy = f(f(heightin) / f(heightout));
        const convx = f(f(widthin) / f(widthout));
        const convy_int = doubleToInt(Math.floor(convy));
        const convy_float = f(convy - f(convy_int));
        const convx_int = doubleToInt(Math.floor(convx));
        const convx_float = f(convx - f(convx_int));

        const area = f(convx * convy);

        lowy_int = 0;
        lowy_float = 0;
        highy_int = convy_int;
        highy_float = convy_float;

        for (i = 0; i < heightout; i++) {
            // Clamp here to be sure we don't read beyond input buffer.
            if (highy_int >= heightin) {
                highy_int = (heightin - 1) | 0;
            }
            lowx_int = 0;
            lowx_float = 0;
            highx_int = convx_int;
            highx_float = convx_float;

            for (j = 0; j < widthout; j++) {
                // Ok, now apply box filter to box that goes from (lowx, lowy)
                // to (highx, highy) on input data into this pixel on output
                // data.
                // totals[0] = totals[1] = totals[2] = totals[3] = 0.0f; (javac stores index 3 first)
                arrayPutF32(totals, 3, 0);
                arrayPutF32(totals, 2, 0);
                arrayPutF32(totals, 1, 0);
                arrayPutF32(totals, 0, 0);

                // calculate the value for pixels in the 1st row
                xindex = Math.imul(lowx_int, group_size);
                if (highy_int > lowy_int && highx_int > lowx_int) {
                    y_percent = f(1 - lowy_float);
                    temp = (xindex + Math.imul(lowy_int, ysize)) | 0;
                    percent = f(y_percent * f(1 - lowx_float));
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        if (myswap_bytes) {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(-1 & Mipmap.GLU_SWAP_4_BYTES(datain.getInt())) * percent)));
                        } else {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(-1 & datain.getInt()) * percent)));
                        }
                    }
                    left = temp;
                    for (l = (lowx_int + 1) | 0; l < highx_int; l++) {
                        temp = (temp + group_size) | 0;
                        for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                            datain.position(temp_index);
                            if (myswap_bytes) {
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(-1 & Mipmap.GLU_SWAP_4_BYTES(datain.getInt())) * y_percent)));
                            } else {
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(-1 & datain.getInt()) * y_percent)));
                            }
                        }
                    }
                    temp = (temp + group_size) | 0;
                    right = temp;
                    percent = f(y_percent * highx_float);
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        if (myswap_bytes) {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(-1 & Mipmap.GLU_SWAP_4_BYTES(datain.getInt())) * percent)));
                        } else {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(-1 & datain.getInt()) * percent)));
                        }
                    }

                    // calculate the value for pixels in the last row
                    y_percent = highy_float;
                    percent = f(y_percent * f(1 - lowx_float));
                    temp = (xindex + Math.imul(highy_int, ysize)) | 0;
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        if (myswap_bytes) {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(-1 & Mipmap.GLU_SWAP_4_BYTES(datain.getInt())) * percent)));
                        } else {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(-1 & datain.getInt()) * percent)));
                        }
                    }
                    for (l = (lowx_int + 1) | 0; l < highx_int; l++) {
                        temp = (temp + group_size) | 0;
                        for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                            datain.position(temp_index);
                            if (myswap_bytes) {
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(-1 & Mipmap.GLU_SWAP_4_BYTES(datain.getInt())) * y_percent)));
                            } else {
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(-1 & datain.getInt()) * y_percent)));
                            }
                        }
                    }
                    temp = (temp + group_size) | 0;
                    percent = f(y_percent * highx_float);
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        if (myswap_bytes) {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(-1 & Mipmap.GLU_SWAP_4_BYTES(datain.getInt())) * percent)));
                        } else {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(-1 & datain.getInt()) * percent)));
                        }
                    }

                    // calculate the value for the pixels in the 1st and last column
                    for (m = (lowy_int + 1) | 0; m < highy_int; m++) {
                        left = (left + ysize) | 0;
                        right = (right + ysize) | 0;
                        for (k = 0; k < components; k++, left = (left + element_size) | 0, right = (right + element_size) | 0) {
                            if (myswap_bytes) {
                                datain.position(left);
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(-1 & Mipmap.GLU_SWAP_4_BYTES(datain.getInt())) * f(1 - lowx_float))));
                                datain.position(right);
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(-1 & Mipmap.GLU_SWAP_4_BYTES(datain.getInt())) * highx_float)));
                            } else {
                                datain.position(left);
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(-1 & datain.getInt()) * f(1 - lowx_float))));
                                datain.position(right);
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(-1 & datain.getInt()) * highx_float)));
                            }
                        }
                    }
                } else if (highy_int > lowy_int) {
                    x_percent = f(highx_float - lowx_float);
                    percent = f(f(1 - lowy_float) * x_percent);
                    temp = (xindex + Math.imul(lowy_int, ysize)) | 0;
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        if (myswap_bytes) {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(-1 & Mipmap.GLU_SWAP_4_BYTES(datain.getInt())) * percent)));
                        } else {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(-1 & datain.getInt()) * percent)));
                        }
                    }
                    for (m = (lowy_int + 1) | 0; m < highy_int; m++) {
                        temp = (temp + ysize) | 0;
                        for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                            datain.position(temp_index);
                            if (myswap_bytes) {
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(-1 & Mipmap.GLU_SWAP_4_BYTES(datain.getInt())) * x_percent)));
                            } else {
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(-1 & datain.getInt()) * x_percent)));
                            }
                        }
                    }
                    percent = f(x_percent * highy_float);
                    temp = (temp + ysize) | 0;
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        if (myswap_bytes) {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(-1 & Mipmap.GLU_SWAP_4_BYTES(datain.getInt())) * percent)));
                        } else {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(-1 & datain.getInt()) * percent)));
                        }
                    }
                } else if (highx_int > lowx_int) {
                    y_percent = f(highy_float - lowy_float);
                    percent = f(f(1 - lowx_float) * y_percent);
                    temp = (xindex + Math.imul(lowy_int, ysize)) | 0;
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        if (myswap_bytes) {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(-1 & Mipmap.GLU_SWAP_4_BYTES(datain.getInt())) * percent)));
                        } else {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(-1 & datain.getInt()) * percent)));
                        }
                    }
                    for (l = (lowx_int + 1) | 0; l < highx_int; l++) {
                        temp = (temp + group_size) | 0;
                        for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                            datain.position(temp_index);
                            if (myswap_bytes) {
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(-1 & Mipmap.GLU_SWAP_4_BYTES(datain.getInt())) * y_percent)));
                            } else {
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(-1 & datain.getInt()) * y_percent)));
                            }
                        }
                    }
                    temp = (temp + group_size) | 0;
                    percent = f(y_percent * highx_float);
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        if (myswap_bytes) {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(-1 & Mipmap.GLU_SWAP_4_BYTES(datain.getInt())) * percent)));
                        } else {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(-1 & datain.getInt()) * percent)));
                        }
                    }
                } else {
                    percent = f(f(highy_float - lowy_float) * f(highx_float - lowx_float));
                    temp = (xindex + Math.imul(lowy_int, ysize)) | 0;
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        // (sic) two unused long reads of the sample (absolute, then relative) before the accumulated one
                        void (0x00000000ffffffffn & BigInt(datain.getInt(temp_index)));
                        datain.position(temp_index);
                        void (0x00000000ffffffffn & BigInt(datain.getInt()));
                        datain.position(temp_index);
                        if (myswap_bytes) {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(-1 & Mipmap.GLU_SWAP_4_BYTES(datain.getInt())) * percent)));
                        } else {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(-1 & datain.getInt()) * percent)));
                        }
                    }
                }

                // this is for the pixels in the body
                temp0 = (xindex + group_size + Math.imul((lowy_int + 1) | 0, ysize)) | 0;
                for (m = (lowy_int + 1) | 0; m < highy_int; m++) {
                    temp = temp0;
                    for (l = (lowx_int + 1) | 0; l < highx_int; l++) {
                        for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                            datain.position(temp_index);
                            if (myswap_bytes) {
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(-1 & Mipmap.GLU_SWAP_4_BYTES(datain.getInt()))));
                            } else {
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(-1 & datain.getInt())));
                            }
                        }
                        temp = (temp + group_size) | 0;
                    }
                    temp0 = (temp0 + ysize) | 0;
                }

                outindex = Math.imul((j + Math.imul(i, widthout)) | 0, components);
                let value = 0; // float
                for (k = 0; k < components; k++) {
                    value = f(arrayAtF32(totals, k) / area);
                    dataout.position((outindex + k) | 0);
                    if (value >= -1) {
                        dataout.put(doubleToInt(value));
                    } else {
                        dataout.put(doubleToInt(f(arrayAtF32(totals, k) / area)));
                    }
                }
                lowx_int = highx_int;
                lowx_float = highx_float;
                highx_int = (highx_int + convx_int) | 0;
                highx_float = f(highx_float + convx_float);
                if (highx_float > 1) {
                    highx_float = f(highx_float - 1);
                    highx_int = (highx_int + 1) | 0;
                }

                // Clamp to make sure we don't run off the right edge
                if (highx_int > ((widthin - 1) | 0)) {
                    const delta = (((highx_int - widthin) | 0) + 1) | 0;
                    lowx_int = (lowx_int - delta) | 0;
                    highx_int = (highx_int - delta) | 0;
                }
            }
            lowy_int = highy_int;
            lowy_float = highy_float;
            highy_int = (highy_int + convy_int) | 0;
            highy_float = f(highy_float + convy_float);
            if (highy_float > 1) {
                highy_float = f(highy_float - 1);
                highy_int = (highy_int + 1) | 0;
            }
        }
    }

    // com.sun.opengl.impl.mipmap.ScaleInternal.scale_internal_int(IIILjava/nio/ByteBuffer;IILjava/nio/IntBuffer;IIIZ)V
    static scale_internal_int(components: number, widthin: number, heightin: number, datain: ByteBuffer, widthout: number, heightout: number, dataout: IntBuffer, element_size: number, ysize: number, group_size: number, myswap_bytes: boolean): void {
        const f = Math.fround;

        let percent: number;
        // Max components in a format is 4, so...
        const totals = new Float32Array(4);

        let i: number, j: number, k: number, xindex: number;

        let temp: number, temp0: number;
        let temp_index: number;
        let outindex: number;

        let lowx_int: number, highx_int: number, lowy_int: number, highy_int: number;
        let x_percent: number, y_percent: number;
        let lowx_float: number, highx_float: number, lowy_float: number, highy_float: number;

        let l: number, m: number;
        let left: number, right: number;

        if (widthin === Math.imul(widthout, 2) && heightin === Math.imul(heightout, 2)) {
            HalveImage.halveImage_int(components, widthin, heightin, datain, dataout, element_size, ysize, group_size, myswap_bytes);
            return;
        }
        const convy = f(f(heightin) / f(heightout));
        const convx = f(f(widthin) / f(widthout));
        const convy_int = doubleToInt(Math.floor(convy));
        const convy_float = f(convy - f(convy_int));
        const convx_int = doubleToInt(Math.floor(convx));
        const convx_float = f(convx - f(convx_int));

        const area = f(convx * convy);

        lowy_int = 0;
        lowy_float = 0;
        highy_int = convy_int;
        highy_float = convy_float;

        for (i = 0; i < heightout; i++) {
            // Clamp here to be sure we don't read beyond input buffer.
            if (highy_int >= heightin) {
                highy_int = (heightin - 1) | 0;
            }
            lowx_int = 0;
            lowx_float = 0;
            highx_int = convx_int;
            highx_float = convx_float;

            for (j = 0; j < widthout; j++) {
                // Ok, now apply box filter to box that goes from (lowx, lowy)
                // to (highx, highy) on input data into this pixel on output
                // data.
                // totals[0] = totals[1] = totals[2] = totals[3] = 0.0f; (javac stores index 3 first)
                arrayPutF32(totals, 3, 0);
                arrayPutF32(totals, 2, 0);
                arrayPutF32(totals, 1, 0);
                arrayPutF32(totals, 0, 0);

                // calculate the value for pixels in the 1st row
                xindex = Math.imul(lowx_int, group_size);
                if (highy_int > lowy_int && highx_int > lowx_int) {
                    y_percent = f(1 - lowy_float);
                    temp = (xindex + Math.imul(lowy_int, ysize)) | 0;
                    percent = f(y_percent * f(1 - lowx_float));
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        if (myswap_bytes) {
                            const swapbuf: bigint = BigInt(Mipmap.GLU_SWAP_4_BYTES(datain.getInt()));
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(Number(swapbuf)) * percent)));
                        } else {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(datain.getInt()) * percent)));
                        }
                    }
                    left = temp;
                    for (l = (lowx_int + 1) | 0; l < highx_int; l++) {
                        temp = (temp + group_size) | 0;
                        for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                            datain.position(temp_index);
                            if (myswap_bytes) {
                                const swapbuf: bigint = BigInt(Mipmap.GLU_SWAP_4_BYTES(datain.getInt()));
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(Number(swapbuf)) * y_percent)));
                            } else {
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(datain.getInt()) * y_percent)));
                            }
                        }
                    }
                    temp = (temp + group_size) | 0;
                    right = temp;
                    percent = f(y_percent * highx_float);
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        if (myswap_bytes) {
                            const swapbuf: bigint = BigInt(Mipmap.GLU_SWAP_4_BYTES(datain.getInt()));
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(Number(swapbuf)) * percent)));
                        } else {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(datain.getInt()) * percent)));
                        }
                    }

                    // calculate the value for pixels in the last row
                    y_percent = highy_float;
                    percent = f(y_percent * f(1 - lowx_float));
                    temp = (xindex + Math.imul(highy_int, ysize)) | 0;
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        if (myswap_bytes) {
                            const swapbuf: bigint = BigInt(Mipmap.GLU_SWAP_4_BYTES(datain.getInt()));
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(Number(swapbuf)) * percent)));
                        } else {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(datain.getInt()) * percent)));
                        }
                    }
                    for (l = (lowx_int + 1) | 0; l < highx_int; l++) {
                        temp = (temp + group_size) | 0;
                        for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                            datain.position(temp_index);
                            if (myswap_bytes) {
                                const swapbuf: bigint = BigInt(Mipmap.GLU_SWAP_4_BYTES(datain.getInt()));
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(Number(swapbuf)) * y_percent)));
                            } else {
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(datain.getInt()) * y_percent)));
                            }
                        }
                    }
                    temp = (temp + group_size) | 0;
                    percent = f(y_percent * highx_float);
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        if (myswap_bytes) {
                            const swapbuf: bigint = BigInt(Mipmap.GLU_SWAP_4_BYTES(datain.getInt()));
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(Number(swapbuf)) * percent)));
                        } else {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(datain.getInt()) * percent)));
                        }
                    }

                    // calculate the value for the pixels in the 1st and last column
                    for (m = (lowy_int + 1) | 0; m < highy_int; m++) {
                        left = (left + ysize) | 0;
                        right = (right + ysize) | 0;
                        for (k = 0; k < components; k++, left = (left + element_size) | 0, right = (right + element_size) | 0) {
                            if (myswap_bytes) {
                                datain.position(left);
                                let swapbuf: bigint = BigInt(Mipmap.GLU_SWAP_4_BYTES(datain.getInt()));
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(Number(swapbuf)) * f(1 - lowx_float))));
                                datain.position(right);
                                swapbuf = BigInt(Mipmap.GLU_SWAP_4_BYTES(datain.getInt()));
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(Number(swapbuf)) * highx_float)));
                            } else {
                                datain.position(left);
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(datain.getInt()) * f(1 - lowx_float))));
                                datain.position(right);
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(datain.getInt()) * highx_float)));
                            }
                        }
                    }
                } else if (highy_int > lowy_int) {
                    x_percent = f(highx_float - lowx_float);
                    percent = f(f(1 - lowy_float) * x_percent);
                    temp = (xindex + Math.imul(lowy_int, ysize)) | 0;
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        if (myswap_bytes) {
                            const swapbuf: bigint = BigInt(Mipmap.GLU_SWAP_4_BYTES(datain.getInt()));
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(Number(swapbuf)) * percent)));
                        } else {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(datain.getInt()) * percent)));
                        }
                    }
                    for (m = (lowy_int + 1) | 0; m < highy_int; m++) {
                        temp = (temp + ysize) | 0;
                        for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                            datain.position(temp_index);
                            if (myswap_bytes) {
                                const swapbuf: bigint = BigInt(Mipmap.GLU_SWAP_4_BYTES(datain.getInt()));
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(Number(swapbuf)) * x_percent)));
                            } else {
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(datain.getInt()) * x_percent)));
                            }
                        }
                    }
                    percent = f(x_percent * highy_float);
                    temp = (temp + ysize) | 0;
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        if (myswap_bytes) {
                            const swapbuf: bigint = BigInt(Mipmap.GLU_SWAP_4_BYTES(datain.getInt()));
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(Number(swapbuf)) * percent)));
                        } else {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(datain.getInt()) * percent)));
                        }
                    }
                } else if (highx_int > lowx_int) {
                    y_percent = f(highy_float - lowy_float);
                    percent = f(f(1 - lowx_float) * y_percent);
                    temp = (xindex + Math.imul(lowy_int, ysize)) | 0;
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        if (myswap_bytes) {
                            const swapbuf: bigint = BigInt(Mipmap.GLU_SWAP_4_BYTES(datain.getInt()));
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(Number(swapbuf)) * percent)));
                        } else {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(datain.getInt()) * percent)));
                        }
                    }
                    for (l = (lowx_int + 1) | 0; l < highx_int; l++) {
                        temp = (temp + group_size) | 0;
                        for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                            datain.position(temp_index);
                            if (myswap_bytes) {
                                const swapbuf: bigint = BigInt(Mipmap.GLU_SWAP_4_BYTES(datain.getInt()));
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(Number(swapbuf)) * y_percent)));
                            } else {
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(datain.getInt()) * y_percent)));
                            }
                        }
                    }
                    temp = (temp + group_size) | 0;
                    percent = f(y_percent * highx_float);
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        if (myswap_bytes) {
                            const swapbuf: bigint = BigInt(Mipmap.GLU_SWAP_4_BYTES(datain.getInt()));
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(Number(swapbuf)) * percent)));
                        } else {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(datain.getInt()) * percent)));
                        }
                    }
                } else {
                    percent = f(f(highy_float - lowy_float) * f(highx_float - lowx_float));
                    temp = (xindex + Math.imul(lowy_int, ysize)) | 0;
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        if (myswap_bytes) {
                            const swapbuf: bigint = BigInt(Mipmap.GLU_SWAP_4_BYTES(datain.getInt()));
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(Number(swapbuf)) * percent)));
                        } else {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(datain.getInt()) * percent)));
                        }
                    }
                }

                // this is for the pixels in the body
                temp0 = (xindex + group_size + Math.imul((lowy_int + 1) | 0, ysize)) | 0;
                for (m = (lowy_int + 1) | 0; m < highy_int; m++) {
                    temp = temp0;
                    for (l = (lowx_int + 1) | 0; l < highx_int; l++) {
                        for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                            datain.position(temp_index);
                            if (myswap_bytes) {
                                const swapbuf: bigint = BigInt(Mipmap.GLU_SWAP_4_BYTES(datain.getInt()));
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(Number(swapbuf))));
                            } else {
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(datain.getInt())));
                            }
                        }
                        temp = (temp + group_size) | 0;
                    }
                    temp0 = (temp0 + ysize) | 0;
                }

                outindex = Math.imul((j + Math.imul(i, widthout)) | 0, components);
                for (k = 0; k < components; k++) {
                    dataout.position((outindex + k) | 0);
                    dataout.put(doubleToInt(f(arrayAtF32(totals, k) / area)));
                }
                lowx_int = highx_int;
                lowx_float = highx_float;
                highx_int = (highx_int + convx_int) | 0;
                highx_float = f(highx_float + convx_float);
                if (highx_float > 1) {
                    highx_float = f(highx_float - 1);
                    highx_int = (highx_int + 1) | 0;
                }

                // Clamp to make sure we don't run off the right edge
                if (highx_int > ((widthin - 1) | 0)) {
                    const delta = (((highx_int - widthin) | 0) + 1) | 0;
                    lowx_int = (lowx_int - delta) | 0;
                    highx_int = (highx_int - delta) | 0;
                }
            }
            lowy_int = highy_int;
            lowy_float = highy_float;
            highy_int = (highy_int + convy_int) | 0;
            highy_float = f(highy_float + convy_float);
            if (highy_float > 1) {
                highy_float = f(highy_float - 1);
                highy_int = (highy_int + 1) | 0;
            }
        }
    }

    // com.sun.opengl.impl.mipmap.ScaleInternal.scale_internal_float(IIILjava/nio/ByteBuffer;IILjava/nio/FloatBuffer;IIIZ)V
    static scale_internal_float(
        components: number,
        widthin: number,
        heightin: number,
        datain: ByteBuffer,
        widthout: number,
        heightout: number,
        dataout: FloatBuffer,
        element_size: number,
        ysize: number,
        group_size: number,
        myswap_bytes: boolean
    ): void {
        const f = Math.fround;

        let percent: number;
        // Max components in a format is 4, so...
        const totals = new Float32Array(4);

        let i: number, j: number, k: number, xindex: number;

        let temp: number, temp0: number;
        let temp_index: number;
        let outindex: number;

        let lowx_int: number, highx_int: number, lowy_int: number, highy_int: number;
        let x_percent: number, y_percent: number;
        let lowx_float: number, highx_float: number, lowy_float: number, highy_float: number;

        let l: number, m: number;
        let left: number, right: number;

        if (widthin === Math.imul(widthout, 2) && heightin === Math.imul(heightout, 2)) {
            HalveImage.halveImage_float(components, widthin, heightin, datain, dataout, element_size, ysize, group_size, myswap_bytes);
            return;
        }
        const convy = f(f(heightin) / f(heightout));
        const convx = f(f(widthin) / f(widthout));
        const convy_int = doubleToInt(Math.floor(convy));
        const convy_float = f(convy - f(convy_int));
        const convx_int = doubleToInt(Math.floor(convx));
        const convx_float = f(convx - f(convx_int));

        const area = f(convx * convy);

        lowy_int = 0;
        lowy_float = 0;
        highy_int = convy_int;
        highy_float = convy_float;

        for (i = 0; i < heightout; i++) {
            // Clamp here to be sure we don't read beyond input buffer.
            if (highy_int >= heightin) {
                highy_int = (heightin - 1) | 0;
            }
            lowx_int = 0;
            lowx_float = 0;
            highx_int = convx_int;
            highx_float = convx_float;

            for (j = 0; j < widthout; j++) {
                // Ok, now apply box filter to box that goes from (lowx, lowy)
                // to (highx, highy) on input data into this pixel on output
                // data.
                // totals[0] = totals[1] = totals[2] = totals[3] = 0.0f; (javac stores index 3 first)
                arrayPutF32(totals, 3, 0);
                arrayPutF32(totals, 2, 0);
                arrayPutF32(totals, 1, 0);
                arrayPutF32(totals, 0, 0);

                // calculate the value for pixels in the 1st row
                xindex = Math.imul(lowx_int, group_size);
                if (highy_int > lowy_int && highx_int > lowx_int) {
                    y_percent = f(1 - lowy_float);
                    temp = (xindex + Math.imul(lowy_int, ysize)) | 0;
                    percent = f(y_percent * f(1 - lowx_float));
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        if (myswap_bytes) {
                            const swapbuf = Mipmap.GLU_SWAP_4_BYTES_F(datain.getFloat());
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(swapbuf * percent)));
                        } else {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(datain.getFloat() * percent)));
                        }
                    }
                    left = temp;
                    for (l = (lowx_int + 1) | 0; l < highx_int; l++) {
                        temp = (temp + group_size) | 0;
                        for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                            datain.position(temp_index);
                            if (myswap_bytes) {
                                const swapbuf = Mipmap.GLU_SWAP_4_BYTES_F(datain.getFloat());
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(swapbuf * y_percent)));
                            } else {
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(datain.getFloat() * y_percent)));
                            }
                        }
                    }
                    temp = (temp + group_size) | 0;
                    right = temp;
                    percent = f(y_percent * highx_float);
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        if (myswap_bytes) {
                            const swapbuf = Mipmap.GLU_SWAP_4_BYTES_F(datain.getFloat());
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(swapbuf * percent)));
                        } else {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(datain.getFloat() * percent)));
                        }
                    }

                    // calculate the value for pixels in the last row
                    y_percent = highy_float;
                    percent = f(y_percent * f(1 - lowx_float));
                    temp = (xindex + Math.imul(highy_int, ysize)) | 0;
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        if (myswap_bytes) {
                            const swapbuf = Mipmap.GLU_SWAP_4_BYTES_F(datain.getFloat());
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(swapbuf * percent)));
                        } else {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(datain.getFloat() * percent)));
                        }
                    }
                    for (l = (lowx_int + 1) | 0; l < highx_int; l++) {
                        temp = (temp + group_size) | 0;
                        for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                            datain.position(temp_index);
                            if (myswap_bytes) {
                                const swapbuf = Mipmap.GLU_SWAP_4_BYTES_F(datain.getFloat());
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(swapbuf * y_percent)));
                            } else {
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(datain.getFloat() * y_percent)));
                            }
                        }
                    }
                    temp = (temp + group_size) | 0;
                    percent = f(y_percent * highx_float);
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        if (myswap_bytes) {
                            const swapbuf = Mipmap.GLU_SWAP_4_BYTES_F(datain.getFloat());
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(swapbuf * percent)));
                        } else {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(datain.getFloat() * percent)));
                        }
                    }

                    // calculate the value for the pixels in the 1st and last column
                    for (m = (lowy_int + 1) | 0; m < highy_int; m++) {
                        left = (left + ysize) | 0;
                        right = (right + ysize) | 0;
                        for (k = 0; k < components; k++, left = (left + element_size) | 0, right = (right + element_size) | 0) {
                            if (myswap_bytes) {
                                datain.position(left);
                                let swapbuf = Mipmap.GLU_SWAP_4_BYTES_F(datain.getFloat());
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(swapbuf * f(1 - lowx_float))));
                                datain.position(right);
                                swapbuf = Mipmap.GLU_SWAP_4_BYTES_F(datain.getFloat());
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(swapbuf * highx_float)));
                            } else {
                                datain.position(left);
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(datain.getFloat() * f(1 - lowx_float))));
                                datain.position(right);
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(datain.getFloat() * highx_float)));
                            }
                        }
                    }
                } else if (highy_int > lowy_int) {
                    x_percent = f(highx_float - lowx_float);
                    percent = f(f(1 - lowy_float) * x_percent);
                    temp = (xindex + Math.imul(lowy_int, ysize)) | 0;
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        if (myswap_bytes) {
                            const swapbuf = Mipmap.GLU_SWAP_4_BYTES_F(datain.getFloat());
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(swapbuf * percent)));
                        } else {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(datain.getFloat() * percent)));
                        }
                    }
                    for (m = (lowy_int + 1) | 0; m < highy_int; m++) {
                        temp = (temp + ysize) | 0;
                        for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                            datain.position(temp_index);
                            if (myswap_bytes) {
                                const swapbuf = Mipmap.GLU_SWAP_4_BYTES_F(datain.getFloat());
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(swapbuf * x_percent)));
                            } else {
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(datain.getFloat() * x_percent)));
                            }
                        }
                    }
                    percent = f(x_percent * highy_float);
                    temp = (temp + ysize) | 0;
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        if (myswap_bytes) {
                            const swapbuf = Mipmap.GLU_SWAP_4_BYTES_F(datain.getFloat());
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(swapbuf * percent)));
                        } else {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(datain.getFloat() * percent)));
                        }
                    }
                } else if (highx_int > lowx_int) {
                    y_percent = f(highy_float - lowy_float);
                    percent = f(f(1 - lowx_float) * y_percent);
                    temp = (xindex + Math.imul(lowy_int, ysize)) | 0;
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        if (myswap_bytes) {
                            const swapbuf = Mipmap.GLU_SWAP_4_BYTES_F(datain.getFloat());
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(swapbuf * percent)));
                        } else {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(datain.getFloat() * percent)));
                        }
                    }
                    for (l = (lowx_int + 1) | 0; l < highx_int; l++) {
                        temp = (temp + group_size) | 0;
                        for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                            datain.position(temp_index);
                            if (myswap_bytes) {
                                const swapbuf = Mipmap.GLU_SWAP_4_BYTES_F(datain.getFloat());
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(swapbuf * y_percent)));
                            } else {
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(datain.getFloat() * y_percent)));
                            }
                        }
                    }
                    temp = (temp + group_size) | 0;
                    percent = f(y_percent * highx_float);
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        if (myswap_bytes) {
                            const swapbuf = Mipmap.GLU_SWAP_4_BYTES_F(datain.getFloat());
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(swapbuf * percent)));
                        } else {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(datain.getFloat() * percent)));
                        }
                    }
                } else {
                    percent = f(f(highy_float - lowy_float) * f(highx_float - lowx_float));
                    temp = (xindex + Math.imul(lowy_int, ysize)) | 0;
                    for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                        datain.position(temp_index);
                        if (myswap_bytes) {
                            const swapbuf = Mipmap.GLU_SWAP_4_BYTES_F(datain.getFloat());
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(swapbuf * percent)));
                        } else {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(datain.getFloat() * percent)));
                        }
                    }
                }

                // this is for the pixels in the body
                temp0 = (xindex + group_size + Math.imul((lowy_int + 1) | 0, ysize)) | 0;
                for (m = (lowy_int + 1) | 0; m < highy_int; m++) {
                    temp = temp0;
                    for (l = (lowx_int + 1) | 0; l < highx_int; l++) {
                        for (k = 0, temp_index = temp; k < components; k++, temp_index = (temp_index + element_size) | 0) {
                            datain.position(temp_index);
                            if (myswap_bytes) {
                                const swapbuf = Mipmap.GLU_SWAP_4_BYTES_F(datain.getFloat());
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + swapbuf));
                            } else {
                                arrayPutF32(totals, k, f(arrayAtF32(totals, k) + datain.getFloat()));
                            }
                        }
                        temp = (temp + group_size) | 0;
                    }
                    temp0 = (temp0 + ysize) | 0;
                }

                outindex = Math.imul((j + Math.imul(i, widthout)) | 0, components);
                for (k = 0; k < components; k++) {
                    dataout.position((outindex + k) | 0);
                    dataout.put(f(arrayAtF32(totals, k) / area));
                }
                lowx_int = highx_int;
                lowx_float = highx_float;
                highx_int = (highx_int + convx_int) | 0;
                highx_float = f(highx_float + convx_float);
                if (highx_float > 1) {
                    highx_float = f(highx_float - 1);
                    highx_int = (highx_int + 1) | 0;
                }

                // Clamp to make sure we don't run off the right edge
                if (highx_int > ((widthin - 1) | 0)) {
                    const delta = (((highx_int - widthin) | 0) + 1) | 0;
                    lowx_int = (lowx_int - delta) | 0;
                    highx_int = (highx_int - delta) | 0;
                }
            }
            lowy_int = highy_int;
            lowy_float = highy_float;
            highy_int = (highy_int + convy_int) | 0;
            highy_float = f(highy_float + convy_float);
            if (highy_float > 1) {
                highy_float = f(highy_float - 1);
                highy_int = (highy_int + 1) | 0;
            }
        }
    }

    // com.sun.opengl.impl.mipmap.ScaleInternal.scaleInternalPackedPixel(ILcom/sun/opengl/impl/mipmap/Extract;IILjava/nio/ByteBuffer;IILjava/nio/ByteBuffer;IIZ)V
    // (sic) highy_float starts at convx_float, the last sample of the last row reuses the previous extract, and body
    // samples are weighted by the last `percent`.
    static scaleInternalPackedPixel(
        components: number,
        extract: Extract,
        widthIn: number,
        heightIn: number,
        dataIn: ByteBuffer,
        widthOut: number,
        heightOut: number,
        dataOut: ByteBuffer,
        pixelSizeInBytes: number,
        rowSizeInBytes: number,
        isSwap: boolean
    ): void {
        const f = Math.fround;

        let percent: number;

        // Max components in a format is 4, so...
        const totals = new Float32Array(4);
        const extractTotals = new Float32Array(4);
        const extractMoreTotals = new Float32Array(4);
        const shoveTotals = new Float32Array(4);

        let i: number, j: number, k: number, xindex: number;

        let temp: number, temp0: number;
        let outIndex = 0;

        let lowx_int: number, highx_int: number, lowy_int: number, highy_int: number;
        let x_percent: number, y_percent: number;
        let lowx_float: number, highx_float: number, lowy_float: number, highy_float: number;

        let l: number, m: number;
        let left: number, right: number;

        if (widthIn === Math.imul(widthOut, 2) && heightIn === Math.imul(heightOut, 2)) {
            HalveImage.halveImagePackedPixel(components, extract, widthIn, heightIn, dataIn, dataOut, pixelSizeInBytes, rowSizeInBytes, isSwap);
            return;
        }
        const convy = f(f(heightIn) / f(heightOut));
        const convx = f(f(widthIn) / f(widthOut));
        const convy_int = doubleToInt(Math.floor(convy));
        const convy_float = f(convy - f(convy_int));
        const convx_int = doubleToInt(Math.floor(convx));
        const convx_float = f(convx - f(convx_int));

        const area = f(convx * convy);

        lowy_int = 0;
        lowy_float = 0;
        highy_int = convy_int;
        highy_float = convx_float; // (sic)

        for (i = 0; i < heightOut; i++) {
            // Clamp here to be sure we don't read beyond input buffer.
            if (highy_int >= heightIn) {
                highy_int = (heightIn - 1) | 0;
            }
            lowx_int = 0;
            lowx_float = 0;
            highx_int = convx_int;
            highx_float = convx_float;

            for (j = 0; j < widthOut; j++) {
                // Ok, now apply box filter to box that goes from (lowx, lowy)
                // to (highx, highy) on input data into this pixel on output
                // data.
                // totals[0] = totals[1] = totals[2] = totals[3] = 0.0f; (javac stores index 3 first)
                arrayPutF32(totals, 3, 0);
                arrayPutF32(totals, 2, 0);
                arrayPutF32(totals, 1, 0);
                arrayPutF32(totals, 0, 0);

                // calculate the value for pixels in the 1st row
                xindex = Math.imul(lowx_int, pixelSizeInBytes);
                if (highy_int > lowy_int && highx_int > lowx_int) {
                    y_percent = f(1 - lowy_float);
                    temp = (xindex + Math.imul(lowy_int, rowSizeInBytes)) | 0;
                    percent = f(y_percent * f(1 - lowx_float));
                    dataIn.position(temp);
                    extract.extract(isSwap, dataIn, extractTotals);
                    for (k = 0; k < components; k++) {
                        arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(arrayAtF32(extractTotals, k) * percent)));
                    }
                    left = temp;
                    for (l = (lowx_int + 1) | 0; l < highx_int; l++) {
                        temp = (temp + pixelSizeInBytes) | 0;
                        dataIn.position(temp);
                        extract.extract(isSwap, dataIn, extractTotals);
                        for (k = 0; k < components; k++) {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(arrayAtF32(extractTotals, k) * y_percent)));
                        }
                    }
                    temp = (temp + pixelSizeInBytes) | 0;
                    right = temp;
                    percent = f(y_percent * highx_float);
                    dataIn.position(temp);
                    extract.extract(isSwap, dataIn, extractTotals);
                    for (k = 0; k < components; k++) {
                        arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(arrayAtF32(extractTotals, k) * percent)));
                    }
                    // calculate the value for pixels in the last row
                    y_percent = highy_float;
                    percent = f(y_percent * f(1 - lowx_float));
                    temp = (xindex + Math.imul(highy_int, rowSizeInBytes)) | 0;
                    dataIn.position(temp);
                    extract.extract(isSwap, dataIn, extractTotals);
                    for (k = 0; k < components; k++) {
                        arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(arrayAtF32(extractTotals, k) * percent)));
                    }
                    for (l = (lowx_int + 1) | 0; l < highx_int; l++) {
                        temp = (temp + pixelSizeInBytes) | 0;
                        dataIn.position(temp);
                        extract.extract(isSwap, dataIn, extractTotals);
                        for (k = 0; k < components; k++) {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(arrayAtF32(extractTotals, k) * y_percent)));
                        }
                    }
                    temp = (temp + pixelSizeInBytes) | 0;
                    percent = f(y_percent * highx_float);
                    dataIn.position(temp);
                    // (sic) no extract here: the previous sample's components are weighted again
                    for (k = 0; k < components; k++) {
                        arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(arrayAtF32(extractTotals, k) * percent)));
                    }

                    // calculate the value for pixels in the 1st and last column
                    for (m = (lowy_int + 1) | 0; m < highy_int; m++) {
                        left = (left + rowSizeInBytes) | 0;
                        right = (right + rowSizeInBytes) | 0;
                        dataIn.position(left);
                        extract.extract(isSwap, dataIn, extractTotals);
                        dataIn.position(right);
                        extract.extract(isSwap, dataIn, extractMoreTotals);
                        for (k = 0; k < components; k++) {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(f(arrayAtF32(extractTotals, k) * f(1 - lowx_float)) + f(arrayAtF32(extractMoreTotals, k) * highx_float))));
                        }
                    }
                } else if (highy_int > lowy_int) {
                    x_percent = f(highx_float - lowx_float);
                    percent = f(f(1 - lowy_float) * x_percent);
                    temp = (xindex + Math.imul(lowy_int, rowSizeInBytes)) | 0;
                    dataIn.position(temp);
                    extract.extract(isSwap, dataIn, extractTotals);
                    for (k = 0; k < components; k++) {
                        arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(arrayAtF32(extractTotals, k) * percent)));
                    }
                    for (m = (lowy_int + 1) | 0; m < highy_int; m++) {
                        temp = (temp + rowSizeInBytes) | 0;
                        dataIn.position(temp);
                        extract.extract(isSwap, dataIn, extractTotals);
                        for (k = 0; k < components; k++) {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(arrayAtF32(extractTotals, k) * x_percent)));
                        }
                    }
                    percent = f(x_percent * highy_float);
                    temp = (temp + rowSizeInBytes) | 0;
                    dataIn.position(temp);
                    extract.extract(isSwap, dataIn, extractTotals);
                    for (k = 0; k < components; k++) {
                        arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(arrayAtF32(extractTotals, k) * percent)));
                    }
                } else if (highx_int > lowx_int) {
                    y_percent = f(highy_float - lowy_float);
                    percent = f(f(1 - lowx_float) * y_percent);
                    temp = (xindex + Math.imul(lowy_int, rowSizeInBytes)) | 0;
                    dataIn.position(temp);
                    extract.extract(isSwap, dataIn, extractTotals);
                    for (k = 0; k < components; k++) {
                        arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(arrayAtF32(extractTotals, k) * percent)));
                    }
                    for (l = (lowx_int + 1) | 0; l < highx_int; l++) {
                        temp = (temp + pixelSizeInBytes) | 0;
                        dataIn.position(temp);
                        extract.extract(isSwap, dataIn, extractTotals);
                        for (k = 0; k < components; k++) {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(arrayAtF32(extractTotals, k) * y_percent)));
                        }
                    }
                    temp = (temp + pixelSizeInBytes) | 0;
                    percent = f(y_percent * highx_float);
                    dataIn.position(temp);
                    extract.extract(isSwap, dataIn, extractTotals);
                    for (k = 0; k < components; k++) {
                        arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(arrayAtF32(extractTotals, k) * percent)));
                    }
                } else {
                    percent = f(f(highy_float - lowy_float) * f(highx_float - lowx_float));
                    temp = (xindex + Math.imul(lowy_int, rowSizeInBytes)) | 0;
                    dataIn.position(temp);
                    extract.extract(isSwap, dataIn, extractTotals);
                    for (k = 0; k < components; k++) {
                        arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(arrayAtF32(extractTotals, k) * percent)));
                    }
                }

                // this is for the pixels in the body
                temp0 = (xindex + pixelSizeInBytes + Math.imul((lowy_int + 1) | 0, rowSizeInBytes)) | 0;
                for (m = (lowy_int + 1) | 0; m < highy_int; m++) {
                    temp = temp0;
                    for (l = (lowx_int + 1) | 0; l < highx_int; l++) {
                        dataIn.position(temp);
                        extract.extract(isSwap, dataIn, extractTotals);
                        for (k = 0; k < components; k++) {
                            arrayPutF32(totals, k, f(arrayAtF32(totals, k) + f(arrayAtF32(extractTotals, k) * percent)));
                        }
                        temp = (temp + pixelSizeInBytes) | 0;
                    }
                    temp0 = (temp0 + rowSizeInBytes) | 0;
                }

                outIndex = (j + Math.imul(i, widthOut)) | 0;
                for (k = 0; k < components; k++) {
                    arrayPutF32(shoveTotals, k, f(arrayAtF32(totals, k) / area));
                }
                extract.shove(shoveTotals, outIndex, dataOut);
                lowx_int = highx_int;
                lowx_float = highx_float;
                highx_int = (highx_int + convx_int) | 0;
                highx_float = f(highx_float + convx_float);
                if (highx_float > 1) {
                    highx_float = f(highx_float - 1);
                    highx_int = (highx_int + 1) | 0;
                }

                // Clamp to make sure we don't run off the right edge
                if (highx_int > ((widthIn - 1) | 0)) {
                    const delta = (((highx_int - widthIn) | 0) + 1) | 0;
                    lowx_int = (lowx_int - delta) | 0;
                    highx_int = (highx_int - delta) | 0;
                }
            }
            lowy_int = highy_int;
            lowy_float = highy_float;
            highy_int = (highy_int + convy_int) | 0;
            highy_float = f(highy_float + convy_float);
            if (highy_float > 1) {
                highy_float = f(highy_float - 1);
                highy_int = (highy_int + 1) | 0;
            }
        }
        if (!ScaleInternal.$assertionsDisabled && outIndex !== ((Math.imul(widthOut, heightOut) - 1) | 0)) throw new JavaError('AssertionError');
    }
}
