import { GL } from '#/jogl/GL';
import type ByteBuffer from '#/util/nio/ByteBuffer';
import type ShortBuffer from '#/util/nio/ShortBuffer';
import { JavaError } from '#/util/JavaException';
import { doubleToInt, intRemainder } from '#/util/IntUtils';
import { arrayAtF32, requireNonNull } from '#/util/JavaArray';
import type Extract from './Extract';
import Extract1010102 from './Extract1010102';
import Extract1555rev from './Extract1555rev';
import Extract2101010rev from './Extract2101010rev';
import Extract233rev from './Extract233rev';
import Extract332 from './Extract332';
import Extract4444 from './Extract4444';
import Extract4444rev from './Extract4444rev';
import Extract5551 from './Extract5551';
import Extract565 from './Extract565';
import Extract565rev from './Extract565rev';
import Extract8888 from './Extract8888';
import Extract8888rev from './Extract8888rev';
import Mipmap from './Mipmap';
import type PixelStorageModes from './PixelStorageModes';
import Type_Widget from './Type_Widget';

// com.sun.opengl.impl.mipmap.Image (shipped jogl.jar, JOGL 1.1.x, shrunk by ProGuard to fill_image): unpacks the
// caller's pixels, under the unpack pixel-store modes, into one short per component.
// BuildMipmap.bitmapBuild2DMipmaps is its only caller and passes type GL_BITMAP, so the non-bitmap branch (with
// Type_Widget and the Extract classes) is reachable only by calling fill_image directly; it is ported 1:1 anyway.
// JOGL details kept: the MSB-first bitmap branch reads the next byte for every bit (only LSB-first re-positions at
// `iter`); GL_UNSIGNED_BYTE expands as 255 & (byte * 257) and GL_BYTE as byte * 516; the 3_3_2 and 2_3_3_REV
// extracts never swap. `extract` is set for every packed type, so requireNonNull(extract) (Java: the checkcast and
// invokeinterface on it) never throws.
export default class Image {
    // com.sun.opengl.impl.mipmap.Image.$assertionsDisabled:Z
    // Image.<clinit>()V sets it to !desiredAssertionStatus() (through the synthetic class$(String) and the
    // class$com$sun$opengl$impl$mipmap$Image cache); true on the client JVM (no -ea), so the asserts at the end of
    // fill_image never evaluate their conditions.
    static readonly $assertionsDisabled: boolean = true;

    // com.sun.opengl.impl.mipmap.Image.<init>()V
    constructor() {}

    // com.sun.opengl.impl.mipmap.Image.fill_image(Lcom/sun/opengl/impl/mipmap/PixelStorageModes;IIIIZLjava/nio/ByteBuffer;Ljava/nio/ShortBuffer;)V
    static fill_image(psm: PixelStorageModes, width: number, height: number, format: number, type: number, index_format: boolean, userdata: ByteBuffer | null, newimage: ShortBuffer): void {
        const f = Math.fround;
        let element_size: number, rowsize: number, padding: number, groups_per_line: number;
        let group_size: number, elements_per_line: number;
        let start: number;
        let iter = 0;
        let iter2: number;
        let i: number, j: number, k: number;
        let myswap_bytes: boolean;

        // Create a Extract interface object
        let extract: Extract | null = null;
        switch (type) {
            case GL.GL_UNSIGNED_BYTE_3_3_2:
                extract = new Extract332();
                break;
            case GL.GL_UNSIGNED_BYTE_2_3_3_REV:
                extract = new Extract233rev();
                break;
            case GL.GL_UNSIGNED_SHORT_5_6_5:
                extract = new Extract565();
                break;
            case GL.GL_UNSIGNED_SHORT_5_6_5_REV:
                extract = new Extract565rev();
                break;
            case GL.GL_UNSIGNED_SHORT_4_4_4_4:
                extract = new Extract4444();
                break;
            case GL.GL_UNSIGNED_SHORT_4_4_4_4_REV:
                extract = new Extract4444rev();
                break;
            case GL.GL_UNSIGNED_SHORT_5_5_5_1:
                extract = new Extract5551();
                break;
            case GL.GL_UNSIGNED_SHORT_1_5_5_5_REV:
                extract = new Extract1555rev();
                break;
            case GL.GL_UNSIGNED_INT_8_8_8_8:
                extract = new Extract8888();
                break;
            case GL.GL_UNSIGNED_INT_8_8_8_8_REV:
                extract = new Extract8888rev();
                break;
            case GL.GL_UNSIGNED_INT_10_10_10_2:
                extract = new Extract1010102();
                break;
            case GL.GL_UNSIGNED_INT_2_10_10_10_REV:
                extract = new Extract2101010rev();
                break;
        }

        myswap_bytes = psm.getUnpackSwapBytes();
        const components = Mipmap.elements_per_group(format, type);
        if (psm.getUnpackRowLength() > 0) {
            groups_per_line = psm.getUnpackRowLength();
        } else {
            groups_per_line = width;
        }

        // All formats except GL_BITMAP fall out trivially
        if (type === GL.GL_BITMAP) {
            let bit_offset: number;
            let current_bit: number;

            rowsize = (((Math.imul(groups_per_line, components) + 7) | 0) / 8) | 0;
            padding = intRemainder(rowsize, psm.getUnpackAlignment());
            if (padding !== 0) {
                rowsize = (rowsize + ((psm.getUnpackAlignment() - padding) | 0)) | 0;
            }
            start = (Math.imul(psm.getUnpackSkipRows(), rowsize) + ((Math.imul(psm.getUnpackSkipPixels(), components) / 8) | 0)) | 0;
            elements_per_line = Math.imul(width, components);
            iter2 = 0;
            for (i = 0; i < height; i++) {
                iter = start;
                // the first dereference of userdata (Java: NullPointerException here when it is null)
                const data = requireNonNull(userdata);
                data.position(iter); // ****************************************
                bit_offset = (Math.imul(psm.getUnpackSkipPixels(), components) % 8) | 0;
                for (j = 0; j < elements_per_line; j++) {
                    // Retrieve bit
                    if (psm.getUnpackLsbFirst()) {
                        data.position(iter);
                        current_bit = data.get() & 0x000000ff & (1 << bit_offset);
                    } else {
                        current_bit = data.get() & 0x000000ff & (1 << ((7 - bit_offset) | 0));
                    }
                    if (current_bit !== 0) {
                        if (index_format) {
                            newimage.position(iter2);
                            newimage.put(1);
                        } else {
                            newimage.position(iter2);
                            newimage.put(-1); // (short)65535
                        }
                    } else {
                        newimage.position(iter2);
                        newimage.put(0);
                    }
                    bit_offset = (bit_offset + 1) | 0;
                    if (bit_offset === 8) {
                        bit_offset = 0;
                        iter = (iter + 1) | 0;
                    }
                    iter2 = (iter2 + 1) | 0;
                }
                start = (start + rowsize) | 0;
            }
        } else {
            element_size = Mipmap.bytes_per_element(type);
            group_size = Math.imul(element_size, components);
            if (element_size === 1) {
                myswap_bytes = false;
            }

            rowsize = Math.imul(groups_per_line, group_size);
            padding = intRemainder(rowsize, psm.getUnpackAlignment());
            if (padding !== 0) {
                rowsize = (rowsize + ((psm.getUnpackAlignment() - padding) | 0)) | 0;
            }
            start = (Math.imul(psm.getUnpackSkipRows(), rowsize) + Math.imul(psm.getUnpackSkipPixels(), group_size)) | 0;
            elements_per_line = Math.imul(width, components);

            iter2 = 0;
            for (i = 0; i < height; i++) {
                iter = start;
                // the first dereference of userdata (Java: NullPointerException here when it is null)
                const data = requireNonNull(userdata);
                data.position(iter); // ****************************************
                for (j = 0; j < elements_per_line; j++) {
                    const widget = new Type_Widget();
                    const extractComponents = new Float32Array(4);
                    data.position(iter);
                    switch (type) {
                        case GL.GL_UNSIGNED_BYTE_3_3_2:
                            requireNonNull(extract).extract(false, data, extractComponents);
                            for (k = 0; k < 3; k++) {
                                newimage.put(iter2++, (doubleToInt(f(arrayAtF32(extractComponents, k) * 65535)) << 16) >> 16);
                            }
                            break;
                        case GL.GL_UNSIGNED_BYTE_2_3_3_REV:
                            requireNonNull(extract).extract(false, data, extractComponents);
                            for (k = 0; k < 3; k++) {
                                newimage.put(iter2++, (doubleToInt(f(arrayAtF32(extractComponents, k) * 65535)) << 16) >> 16);
                            }
                            break;
                        case GL.GL_UNSIGNED_BYTE:
                            if (index_format) {
                                newimage.put(iter2++, ((0x000000ff & data.get()) << 16) >> 16);
                            } else {
                                newimage.put(iter2++, ((0x000000ff & Math.imul(data.get(), 257)) << 16) >> 16);
                            }
                            break;
                        case GL.GL_BYTE:
                            if (index_format) {
                                newimage.put(iter2++, (data.get() << 16) >> 16);
                            } else {
                                newimage.put(iter2++, (Math.imul(data.get(), 516) << 16) >> 16);
                            }
                            break;
                        case GL.GL_UNSIGNED_SHORT_5_6_5:
                            requireNonNull(extract).extract(myswap_bytes, data, extractComponents);
                            for (k = 0; k < 3; k++) {
                                newimage.put(iter2++, (doubleToInt(f(arrayAtF32(extractComponents, k) * 65535)) << 16) >> 16);
                            }
                            break;
                        case GL.GL_UNSIGNED_SHORT_5_6_5_REV:
                            requireNonNull(extract).extract(myswap_bytes, data, extractComponents);
                            for (k = 0; k < 3; k++) {
                                newimage.put(iter2++, (doubleToInt(f(arrayAtF32(extractComponents, k) * 65535)) << 16) >> 16);
                            }
                            break;
                        case GL.GL_UNSIGNED_SHORT_4_4_4_4:
                            requireNonNull(extract).extract(myswap_bytes, data, extractComponents);
                            for (k = 0; k < 4; k++) {
                                newimage.put(iter2++, (doubleToInt(f(arrayAtF32(extractComponents, k) * 65535)) << 16) >> 16);
                            }
                            break;
                        case GL.GL_UNSIGNED_SHORT_4_4_4_4_REV:
                            requireNonNull(extract).extract(myswap_bytes, data, extractComponents);
                            for (k = 0; k < 4; k++) {
                                newimage.put(iter2++, (doubleToInt(f(arrayAtF32(extractComponents, k) * 65535)) << 16) >> 16);
                            }
                            break;
                        case GL.GL_UNSIGNED_SHORT_5_5_5_1:
                            requireNonNull(extract).extract(myswap_bytes, data, extractComponents);
                            for (k = 0; k < 4; k++) {
                                newimage.put(iter2++, (doubleToInt(f(arrayAtF32(extractComponents, k) * 65535)) << 16) >> 16);
                            }
                            break;
                        case GL.GL_UNSIGNED_SHORT_1_5_5_5_REV:
                            requireNonNull(extract).extract(myswap_bytes, data, extractComponents);
                            for (k = 0; k < 4; k++) {
                                newimage.put(iter2++, (doubleToInt(f(arrayAtF32(extractComponents, k) * 65535)) << 16) >> 16);
                            }
                            break;
                        case GL.GL_UNSIGNED_SHORT:
                        case GL.GL_SHORT:
                            if (myswap_bytes) {
                                widget.setUB1(data.get());
                                widget.setUB0(data.get());
                            } else {
                                widget.setUB0(data.get());
                                widget.setUB1(data.get());
                            }
                            if (type === GL.GL_SHORT) {
                                if (index_format) {
                                    newimage.put(iter2++, widget.getS0());
                                } else {
                                    newimage.put(iter2++, (Math.imul(widget.getS0(), 2) << 16) >> 16);
                                }
                            } else {
                                newimage.put(iter2++, widget.getUS0());
                            }
                            break;
                        case GL.GL_UNSIGNED_INT_8_8_8_8:
                            requireNonNull(extract).extract(myswap_bytes, data, extractComponents);
                            for (k = 0; k < 4; k++) {
                                newimage.put(iter2++, (doubleToInt(f(arrayAtF32(extractComponents, k) * 65535)) << 16) >> 16);
                            }
                            break;
                        case GL.GL_UNSIGNED_INT_8_8_8_8_REV:
                            requireNonNull(extract).extract(myswap_bytes, data, extractComponents);
                            for (k = 0; k < 4; k++) {
                                newimage.put(iter2++, (doubleToInt(f(arrayAtF32(extractComponents, k) * 65535)) << 16) >> 16);
                            }
                            break;
                        case GL.GL_UNSIGNED_INT_10_10_10_2:
                            requireNonNull(extract).extract(myswap_bytes, data, extractComponents);
                            for (k = 0; k < 4; k++) {
                                newimage.put(iter2++, (doubleToInt(f(arrayAtF32(extractComponents, k) * 65535)) << 16) >> 16);
                            }
                            break;
                        case GL.GL_UNSIGNED_INT_2_10_10_10_REV:
                            requireNonNull(extract).extract(myswap_bytes, data, extractComponents);
                            for (k = 0; k < 4; k++) {
                                newimage.put(iter2++, (doubleToInt(f(arrayAtF32(extractComponents, k) * 65535)) << 16) >> 16);
                            }
                            break;
                        case GL.GL_INT:
                        case GL.GL_UNSIGNED_INT:
                        case GL.GL_FLOAT:
                            if (myswap_bytes) {
                                widget.setUB3(data.get());
                                widget.setUB2(data.get());
                                widget.setUB1(data.get());
                                widget.setUB0(data.get());
                            } else {
                                widget.setUB0(data.get());
                                widget.setUB1(data.get());
                                widget.setUB2(data.get());
                                widget.setUB3(data.get());
                            }
                            if (type === GL.GL_FLOAT) {
                                if (index_format) {
                                    newimage.put(iter2++, (doubleToInt(widget.getF()) << 16) >> 16);
                                } else {
                                    newimage.put(iter2++, (doubleToInt(f(widget.getF() * 65535)) << 16) >> 16);
                                }
                            } else if (type === GL.GL_UNSIGNED_INT) {
                                if (index_format) {
                                    newimage.put(iter2++, (widget.getUI() << 16) >> 16);
                                } else {
                                    newimage.put(iter2++, ((widget.getUI() >> 16) << 16) >> 16);
                                }
                            } else {
                                if (index_format) {
                                    newimage.put(iter2++, (widget.getI() << 16) >> 16);
                                } else {
                                    newimage.put(iter2++, ((widget.getI() >> 15) << 16) >> 16);
                                }
                            }
                            break;
                    }
                    iter = (iter + element_size) | 0;
                } // for j
                start = (start + rowsize) | 0;
                // want iter pointing at start, not within, row for assertion purposes
                iter = start;
            } // for i

            // iterators should be one byte past end
            if (!Mipmap.isTypePackedPixel(type)) {
                if (!Image.$assertionsDisabled && iter2 !== Math.imul(Math.imul(width, height), components)) throw new JavaError('AssertionError');
            } else {
                if (!Image.$assertionsDisabled && iter2 !== Math.imul(Math.imul(width, height), Mipmap.elements_per_group(format, 0))) throw new JavaError('AssertionError');
            }
            if (!Image.$assertionsDisabled && iter !== ((Math.imul(rowsize, height) + Math.imul(psm.getUnpackSkipRows(), rowsize) + Math.imul(psm.getUnpackSkipPixels(), group_size)) | 0)) throw new JavaError('AssertionError');
        }
    }
}
