import { GL } from '#/jogl/GL';
import ByteBuffer from '#/util/nio/ByteBuffer';
import ByteOrder from '#/util/nio/ByteOrder';
import type ShortBuffer from '#/util/nio/ShortBuffer';
import { JavaError } from '#/util/JavaException';
import { intRemainder } from '#/util/IntUtils';
import { arrayAtI32, arrayPutI32, requireNonNull } from '#/util/JavaArray';
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
import HalveImage from './HalveImage';
import Image from './Image';
import Mipmap from './Mipmap';
import PixelStorageModes from './PixelStorageModes';
import ScaleInternal from './ScaleInternal';

// catch (java.lang.OutOfMemoryError): java.nio.ByteBuffer.allocateDirect fails when the host cannot reserve the
// memory. In the port that is the RangeError of the typed-array allocation (a negative size is an
// IllegalArgumentException from the nio port instead, as in Java), or a JavaError('OutOfMemoryError') if a port
// helper raises one (io/ReflectionCheck.ts uses that convention).
function isOutOfMemoryError(e: unknown): boolean {
    return e instanceof RangeError || (e instanceof JavaError && e.message === 'OutOfMemoryError');
}

// com.sun.opengl.impl.mipmap.BuildMipmap (shipped jogl.jar, JOGL 1.1.x): the mipmap level builder behind
// Mipmap.gluBuild2DMipmaps.
// The GL calls, their order and the scratch-buffer handling are ported 1:1, including the stale bytes past each
// level in the reused direct buffers: glTexImage2D receives the whole rewound buffer, as in Java. The 530 HD client
// reaches only the GL_UNSIGNED_BYTE arms (GL_RGBA, uh.a(Lve;Lm;IZ)Z pc461); every other type's arm, and the GL_BITMAP
// path, is ported as well (the shipped class keeps them).
// GLU error codes are literals, as javac inlined them: 100900 GLU_INVALID_ENUM, 100902 GLU_OUT_OF_MEMORY.
export default class BuildMipmap {
    // com.sun.opengl.impl.mipmap.BuildMipmap.$assertionsDisabled:Z
    // BuildMipmap.<clinit>()V sets it to !desiredAssertionStatus() (through the synthetic class$(String) and the
    // class$com$sun$opengl$impl$mipmap$BuildMipmap cache). The client JVM runs without -ea, so it is true and the
    // assert statements below never evaluate their conditions.
    static readonly $assertionsDisabled: boolean = true;

    // com.sun.opengl.impl.mipmap.BuildMipmap.<init>()V
    constructor() {}

    // com.sun.opengl.impl.mipmap.BuildMipmap.bitmapBuild2DMipmaps(Ljavax/media/opengl/GL;IIIIIILjava/nio/ByteBuffer;)I
    // The GL_BITMAP path: Image.fill_image expands the bits to one short per component, and each level is uploaded
    // as GL_UNSIGNED_SHORT from a ShortBuffer view (rescaled by ScaleInternal.scale_internal when closestFit's size
    // differs). JOGL details kept: closestFit runs again here, the level loop stops at levels - 1 (`level <
    // levels`), and the halving tests heightPowerOf2 for both axes.
    static bitmapBuild2DMipmaps(gl: GL, target: number, internalFormat: number, width: number, height: number, format: number, type: number, data: ByteBuffer | null): number {
        const newwidth = new Int32Array(1);
        const newheight = new Int32Array(1);
        let level: number, levels: number;
        let newImage: ShortBuffer | null = null;
        let newImage_width: number;
        let newImage_height: number;
        let otherImage: ShortBuffer | null = null;
        let tempImage: ShortBuffer | null = null;
        let memReq: number;

        const psm = new PixelStorageModes();

        Mipmap.retrieveStoreModes(gl, psm);

        Mipmap.closestFit(gl, target, width, height, internalFormat, format, type, newwidth, newheight);

        levels = Mipmap.computeLog(arrayAtI32(newwidth, 0));
        level = Mipmap.computeLog(arrayAtI32(newheight, 0));
        if (level > levels) {
            levels = level;
        }

        try {
            newImage = ByteBuffer.allocateDirect(Mipmap.image_size(width, height, format, GL.GL_UNSIGNED_SHORT))
                .order(ByteOrder.nativeOrder())
                .asShortBuffer();
        } catch (e) {
            if (!isOutOfMemoryError(e)) throw e;
            return 100902; // GLU.GLU_OUT_OF_MEMORY
        }
        newImage_width = width;
        newImage_height = height;

        Image.fill_image(psm, width, height, format, type, Mipmap.is_index(format), data, newImage);

        const cmpts = Mipmap.elements_per_group(format, type);
        gl.glPixelStorei(GL.GL_UNPACK_ALIGNMENT, 2);
        gl.glPixelStorei(GL.GL_UNPACK_SKIP_ROWS, 0);
        gl.glPixelStorei(GL.GL_UNPACK_SKIP_PIXELS, 0);
        gl.glPixelStorei(GL.GL_UNPACK_ROW_LENGTH, 0);
        gl.glPixelStorei(GL.GL_UNPACK_SWAP_BYTES, 0); // GL_FALSE

        for (level = 0; level < levels; level++) {
            if (newImage_width === arrayAtI32(newwidth, 0) && newImage_height === arrayAtI32(newheight, 0)) {
                newImage.rewind();
                // Use newImage for this level
                gl.glTexImage2D(target, level, internalFormat, newImage_width, newImage_height, 0, format, GL.GL_UNSIGNED_SHORT, newImage);
            } else {
                if (otherImage === null) {
                    memReq = Mipmap.image_size(arrayAtI32(newwidth, 0), arrayAtI32(newheight, 0), format, GL.GL_UNSIGNED_SHORT);
                    try {
                        otherImage = ByteBuffer.allocateDirect(memReq).order(ByteOrder.nativeOrder()).asShortBuffer();
                    } catch (e) {
                        if (!isOutOfMemoryError(e)) throw e;
                        gl.glPixelStorei(GL.GL_UNPACK_ALIGNMENT, psm.getUnpackAlignment());
                        gl.glPixelStorei(GL.GL_UNPACK_SKIP_ROWS, psm.getUnpackSkipRows());
                        gl.glPixelStorei(GL.GL_UNPACK_SKIP_PIXELS, psm.getUnpackSkipPixels());
                        gl.glPixelStorei(GL.GL_UNPACK_ROW_LENGTH, psm.getUnpackRowLength());
                        gl.glPixelStorei(GL.GL_UNPACK_SWAP_BYTES, psm.getUnpackSwapBytes() ? 1 : 0);
                        return 100902; // GLU.GLU_OUT_OF_MEMORY
                    }
                }
                ScaleInternal.scale_internal(cmpts, newImage_width, newImage_height, newImage, arrayAtI32(newwidth, 0), arrayAtI32(newheight, 0), otherImage);
                // Swap newImage and otherImage
                tempImage = otherImage;
                otherImage = newImage;
                newImage = tempImage;

                newImage_width = arrayAtI32(newwidth, 0);
                newImage_height = arrayAtI32(newheight, 0);
                newImage.rewind();
                gl.glTexImage2D(target, level, internalFormat, newImage_width, newImage_height, 0, format, GL.GL_UNSIGNED_SHORT, newImage);
            }
            // (sic) both tests read newheight[0]
            if (arrayAtI32(newheight, 0) > 1) {
                arrayPutI32(newwidth, 0, (arrayAtI32(newwidth, 0) / 2) | 0);
            }
            if (arrayAtI32(newheight, 0) > 1) {
                arrayPutI32(newheight, 0, (arrayAtI32(newheight, 0) / 2) | 0);
            }
        }
        gl.glPixelStorei(GL.GL_UNPACK_ALIGNMENT, psm.getUnpackAlignment());
        gl.glPixelStorei(GL.GL_UNPACK_SKIP_ROWS, psm.getUnpackSkipRows());
        gl.glPixelStorei(GL.GL_UNPACK_SKIP_PIXELS, psm.getUnpackSkipPixels());
        gl.glPixelStorei(GL.GL_UNPACK_ROW_LENGTH, psm.getUnpackRowLength());
        gl.glPixelStorei(GL.GL_UNPACK_SWAP_BYTES, psm.getUnpackSwapBytes() ? 1 : 0);

        return 0;
    }

    // com.sun.opengl.impl.mipmap.BuildMipmap.gluBuild2DMipmapLevelsCore(Ljavax/media/opengl/GL;IIIIIIIIIIILjava/nio/ByteBuffer;)I
    static gluBuild2DMipmapLevelsCore(
        gl: GL,
        target: number,
        internalFormat: number,
        width: number,
        height: number,
        widthPowerOf2: number,
        heightPowerOf2: number,
        format: number,
        type: number,
        userLevel: number,
        baseLevel: number,
        maxLevel: number,
        data: ByteBuffer | null
    ): number {
        let newwidth: number, newheight: number;
        let level: number, levels: number;
        let srcImage: ByteBuffer | null = null;
        let dstImage: ByteBuffer | null = null;
        let tempImage: ByteBuffer | null = null;
        let memreq: number;

        let myswap_bytes: boolean;
        let groups_per_line: number;
        let rowsize: number;
        // javac keeps this unused local (aconst_null, astore 23)

        const psm = new PixelStorageModes();

        if (!BuildMipmap.$assertionsDisabled && Mipmap.checkMipmapArgs(internalFormat, format, type) !== 0) throw new JavaError('AssertionError');
        if (!BuildMipmap.$assertionsDisabled && !(width >= 1 && height >= 1)) throw new JavaError('AssertionError');

        if (type === GL.GL_BITMAP) {
            return BuildMipmap.bitmapBuild2DMipmaps(gl, target, internalFormat, width, height, format, type, data);
        }

        newwidth = widthPowerOf2;
        newheight = heightPowerOf2;
        levels = Mipmap.computeLog(newwidth);
        level = Mipmap.computeLog(newheight);
        if (level > levels) {
            levels = level;
        }

        levels = (levels + userLevel) | 0;

        Mipmap.retrieveStoreModes(gl, psm);
        myswap_bytes = psm.getUnpackSwapBytes();
        const cmpts = Mipmap.elements_per_group(format, type);
        if (psm.getUnpackRowLength() > 0) {
            groups_per_line = psm.getUnpackRowLength();
        } else {
            groups_per_line = width;
        }

        const element_size = Mipmap.bytes_per_element(type);
        const group_size = Math.imul(element_size, cmpts);
        if (element_size === 1) {
            myswap_bytes = false;
        }

        rowsize = Math.imul(groups_per_line, group_size);
        const padding = intRemainder(rowsize, psm.getUnpackAlignment());
        if (padding !== 0) {
            rowsize = (rowsize + ((psm.getUnpackAlignment() - padding) | 0)) | 0;
        }

        // The first dereference of data (Java: NullPointerException here when it is null).
        const userImage = requireNonNull(data);
        userImage.position((Math.imul(psm.getUnpackSkipRows(), rowsize) + Math.imul(psm.getUnpackSkipPixels(), group_size)) | 0);
        userImage.mark();

        gl.glPixelStorei(GL.GL_UNPACK_SKIP_ROWS, 0);
        gl.glPixelStorei(GL.GL_UNPACK_SKIP_PIXELS, 0);
        gl.glPixelStorei(GL.GL_UNPACK_ROW_LENGTH, 0);

        level = userLevel;

        // already power of two square
        if (width === newwidth && height === newheight) {
            // use usersImage for level userLevel
            if (baseLevel <= level && level <= maxLevel) {
                userImage.rewind();
                gl.glTexImage2D(target, level, internalFormat, width, height, 0, format, type, userImage);
            }
            if (levels === 0) {
                // we're done. clean up and return
                gl.glPixelStorei(GL.GL_UNPACK_ALIGNMENT, psm.getUnpackAlignment());
                gl.glPixelStorei(GL.GL_UNPACK_SKIP_ROWS, psm.getUnpackSkipRows());
                gl.glPixelStorei(GL.GL_UNPACK_SKIP_PIXELS, psm.getUnpackSkipPixels());
                gl.glPixelStorei(GL.GL_UNPACK_ROW_LENGTH, psm.getUnpackRowLength());
                gl.glPixelStorei(GL.GL_UNPACK_SWAP_BYTES, psm.getUnpackSwapBytes() ? 1 : 0);
                return 0;
            }
            let nextWidth = (newwidth / 2) | 0;
            let nextHeight = (newheight / 2) | 0;
            // clamp to 1
            if (nextWidth < 1) {
                nextWidth = 1;
            }
            if (nextHeight < 1) {
                nextHeight = 1;
            }
            memreq = Mipmap.image_size(nextWidth, nextHeight, format, type);

            try {
                switch (type) {
                    case GL.GL_BYTE:
                    case GL.GL_UNSIGNED_BYTE:
                    case GL.GL_SHORT:
                    case GL.GL_UNSIGNED_SHORT:
                    case GL.GL_INT:
                    case GL.GL_UNSIGNED_INT:
                    case GL.GL_FLOAT:
                    case GL.GL_UNSIGNED_BYTE_3_3_2:
                    case GL.GL_UNSIGNED_SHORT_4_4_4_4:
                    case GL.GL_UNSIGNED_SHORT_5_5_5_1:
                    case GL.GL_UNSIGNED_INT_8_8_8_8:
                    case GL.GL_UNSIGNED_INT_10_10_10_2:
                    case GL.GL_UNSIGNED_BYTE_2_3_3_REV:
                    case GL.GL_UNSIGNED_SHORT_5_6_5:
                    case GL.GL_UNSIGNED_SHORT_5_6_5_REV:
                    case GL.GL_UNSIGNED_SHORT_4_4_4_4_REV:
                    case GL.GL_UNSIGNED_SHORT_1_5_5_5_REV:
                    case GL.GL_UNSIGNED_INT_8_8_8_8_REV:
                    case GL.GL_UNSIGNED_INT_2_10_10_10_REV:
                        dstImage = ByteBuffer.allocateDirect(memreq).order(ByteOrder.nativeOrder());
                        break;
                    default:
                        return 100900; // GLU.GLU_INVALID_ENUM
                }
            } catch (e) {
                if (!isOutOfMemoryError(e)) throw e;
                gl.glPixelStorei(GL.GL_UNPACK_ALIGNMENT, psm.getUnpackAlignment());
                gl.glPixelStorei(GL.GL_UNPACK_SKIP_ROWS, psm.getUnpackSkipRows());
                gl.glPixelStorei(GL.GL_UNPACK_SKIP_PIXELS, psm.getUnpackSkipPixels());
                gl.glPixelStorei(GL.GL_UNPACK_ROW_LENGTH, psm.getUnpackRowLength());
                gl.glPixelStorei(GL.GL_UNPACK_SWAP_BYTES, psm.getUnpackSwapBytes() ? 1 : 0);
                return 100902; // GLU.GLU_OUT_OF_MEMORY
            }
            if (dstImage !== null) {
                switch (type) {
                    case GL.GL_UNSIGNED_BYTE:
                        HalveImage.halveImage_ubyte(cmpts, width, height, userImage, dstImage, element_size, rowsize, group_size);
                        break;
                    case GL.GL_BYTE:
                        HalveImage.halveImage_byte(cmpts, width, height, userImage, dstImage, element_size, rowsize, group_size);
                        break;
                    case GL.GL_UNSIGNED_SHORT:
                        HalveImage.halveImage_ushort(cmpts, width, height, userImage, dstImage.asShortBuffer(), element_size, rowsize, group_size, myswap_bytes);
                        break;
                    case GL.GL_SHORT:
                        HalveImage.halveImage_short(cmpts, width, height, userImage, dstImage.asShortBuffer(), element_size, rowsize, group_size, myswap_bytes);
                        break;
                    case GL.GL_UNSIGNED_INT:
                        HalveImage.halveImage_uint(cmpts, width, height, userImage, dstImage.asIntBuffer(), element_size, rowsize, group_size, myswap_bytes);
                        break;
                    case GL.GL_INT:
                        HalveImage.halveImage_int(cmpts, width, height, userImage, dstImage.asIntBuffer(), element_size, rowsize, group_size, myswap_bytes);
                        break;
                    case GL.GL_FLOAT:
                        HalveImage.halveImage_float(cmpts, width, height, userImage, dstImage.asFloatBuffer(), element_size, rowsize, group_size, myswap_bytes);
                        break;
                    case GL.GL_UNSIGNED_BYTE_3_3_2:
                        if (!BuildMipmap.$assertionsDisabled && format !== GL.GL_RGB) throw new JavaError('AssertionError');
                        HalveImage.halveImagePackedPixel(3, new Extract332(), width, height, userImage, dstImage, element_size, rowsize, myswap_bytes);
                        break;
                    case GL.GL_UNSIGNED_BYTE_2_3_3_REV:
                        if (!BuildMipmap.$assertionsDisabled && format !== GL.GL_RGB) throw new JavaError('AssertionError');
                        HalveImage.halveImagePackedPixel(3, new Extract233rev(), width, height, userImage, dstImage, element_size, rowsize, myswap_bytes);
                        break;
                    case GL.GL_UNSIGNED_SHORT_5_6_5:
                        HalveImage.halveImagePackedPixel(3, new Extract565(), width, height, userImage, dstImage, element_size, rowsize, myswap_bytes);
                        break;
                    case GL.GL_UNSIGNED_SHORT_5_6_5_REV:
                        HalveImage.halveImagePackedPixel(3, new Extract565rev(), width, height, userImage, dstImage, element_size, rowsize, myswap_bytes);
                        break;
                    case GL.GL_UNSIGNED_SHORT_4_4_4_4:
                        HalveImage.halveImagePackedPixel(4, new Extract4444(), width, height, userImage, dstImage, element_size, rowsize, myswap_bytes);
                        break;
                    case GL.GL_UNSIGNED_SHORT_4_4_4_4_REV:
                        HalveImage.halveImagePackedPixel(4, new Extract4444rev(), width, height, userImage, dstImage, element_size, rowsize, myswap_bytes);
                        break;
                    case GL.GL_UNSIGNED_SHORT_5_5_5_1:
                        HalveImage.halveImagePackedPixel(4, new Extract5551(), width, height, userImage, dstImage, element_size, rowsize, myswap_bytes);
                        break;
                    case GL.GL_UNSIGNED_SHORT_1_5_5_5_REV:
                        HalveImage.halveImagePackedPixel(4, new Extract1555rev(), width, height, userImage, dstImage, element_size, rowsize, myswap_bytes);
                        break;
                    case GL.GL_UNSIGNED_INT_8_8_8_8:
                        HalveImage.halveImagePackedPixel(4, new Extract8888(), width, height, userImage, dstImage, element_size, rowsize, myswap_bytes);
                        break;
                    case GL.GL_UNSIGNED_INT_8_8_8_8_REV:
                        HalveImage.halveImagePackedPixel(4, new Extract8888rev(), width, height, userImage, dstImage, element_size, rowsize, myswap_bytes);
                        break;
                    case GL.GL_UNSIGNED_INT_10_10_10_2:
                        HalveImage.halveImagePackedPixel(4, new Extract1010102(), width, height, userImage, dstImage, element_size, rowsize, myswap_bytes);
                        break;
                    case GL.GL_UNSIGNED_INT_2_10_10_10_REV:
                        HalveImage.halveImagePackedPixel(4, new Extract2101010rev(), width, height, userImage, dstImage, element_size, rowsize, myswap_bytes);
                        break;
                    default:
                        if (!BuildMipmap.$assertionsDisabled) throw new JavaError('AssertionError');
                        break;
                }
            }
            newwidth = (width / 2) | 0;
            newheight = (height / 2) | 0;
            // clamp to 1
            if (newwidth < 1) {
                newwidth = 1;
            }
            if (newheight < 1) {
                newheight = 1;
            }

            myswap_bytes = false;
            rowsize = Math.imul(newwidth, group_size);
            memreq = Mipmap.image_size(newwidth, newheight, format, type);
            // swap srcImage and dstImage
            tempImage = srcImage;
            srcImage = dstImage;
            dstImage = tempImage;
            try {
                switch (type) {
                    case GL.GL_BYTE:
                    case GL.GL_UNSIGNED_BYTE:
                    case GL.GL_SHORT:
                    case GL.GL_UNSIGNED_SHORT:
                    case GL.GL_INT:
                    case GL.GL_UNSIGNED_INT:
                    case GL.GL_FLOAT:
                    case GL.GL_UNSIGNED_BYTE_3_3_2:
                    case GL.GL_UNSIGNED_SHORT_4_4_4_4:
                    case GL.GL_UNSIGNED_SHORT_5_5_5_1:
                    case GL.GL_UNSIGNED_INT_8_8_8_8:
                    case GL.GL_UNSIGNED_INT_10_10_10_2:
                    case GL.GL_UNSIGNED_BYTE_2_3_3_REV:
                    case GL.GL_UNSIGNED_SHORT_5_6_5:
                    case GL.GL_UNSIGNED_SHORT_5_6_5_REV:
                    case GL.GL_UNSIGNED_SHORT_4_4_4_4_REV:
                    case GL.GL_UNSIGNED_SHORT_1_5_5_5_REV:
                    case GL.GL_UNSIGNED_INT_8_8_8_8_REV:
                    case GL.GL_UNSIGNED_INT_2_10_10_10_REV:
                        dstImage = ByteBuffer.allocateDirect(memreq).order(ByteOrder.nativeOrder());
                        break;
                    default:
                        return 100900; // GLU.GLU_INVALID_ENUM
                }
            } catch (e) {
                if (!isOutOfMemoryError(e)) throw e;
                gl.glPixelStorei(GL.GL_UNPACK_ALIGNMENT, psm.getUnpackAlignment());
                gl.glPixelStorei(GL.GL_UNPACK_SKIP_ROWS, psm.getUnpackSkipRows());
                gl.glPixelStorei(GL.GL_UNPACK_SKIP_PIXELS, psm.getUnpackSkipPixels());
                gl.glPixelStorei(GL.GL_UNPACK_ROW_LENGTH, psm.getUnpackRowLength());
                gl.glPixelStorei(GL.GL_UNPACK_SWAP_BYTES, psm.getUnpackSwapBytes() ? 1 : 0);
                return 100902; // GLU.GLU_OUT_OF_MEMORY
            }
            // level userLevel+1 is in srcImage; level userLevel already saved
            level = (userLevel + 1) | 0;
        } else {
            // user's image is not nice powerof2 size square
            memreq = Mipmap.image_size(newwidth, newheight, format, type);
            try {
                switch (type) {
                    case GL.GL_BYTE:
                    case GL.GL_UNSIGNED_BYTE:
                    case GL.GL_SHORT:
                    case GL.GL_UNSIGNED_SHORT:
                    case GL.GL_INT:
                    case GL.GL_UNSIGNED_INT:
                    case GL.GL_FLOAT:
                    case GL.GL_UNSIGNED_BYTE_3_3_2:
                    case GL.GL_UNSIGNED_SHORT_4_4_4_4:
                    case GL.GL_UNSIGNED_SHORT_5_5_5_1:
                    case GL.GL_UNSIGNED_INT_8_8_8_8:
                    case GL.GL_UNSIGNED_INT_10_10_10_2:
                    case GL.GL_UNSIGNED_BYTE_2_3_3_REV:
                    case GL.GL_UNSIGNED_SHORT_5_6_5:
                    case GL.GL_UNSIGNED_SHORT_5_6_5_REV:
                    case GL.GL_UNSIGNED_SHORT_4_4_4_4_REV:
                    case GL.GL_UNSIGNED_SHORT_1_5_5_5_REV:
                    case GL.GL_UNSIGNED_INT_8_8_8_8_REV:
                    case GL.GL_UNSIGNED_INT_2_10_10_10_REV:
                        dstImage = ByteBuffer.allocateDirect(memreq).order(ByteOrder.nativeOrder());
                        break;
                    default:
                        return 100900; // GLU.GLU_INVALID_ENUM
                }
            } catch (e) {
                if (!isOutOfMemoryError(e)) throw e;
                gl.glPixelStorei(GL.GL_UNPACK_ALIGNMENT, psm.getUnpackAlignment());
                gl.glPixelStorei(GL.GL_UNPACK_SKIP_ROWS, psm.getUnpackSkipRows());
                gl.glPixelStorei(GL.GL_UNPACK_SKIP_PIXELS, psm.getUnpackSkipPixels());
                gl.glPixelStorei(GL.GL_UNPACK_ROW_LENGTH, psm.getUnpackRowLength());
                gl.glPixelStorei(GL.GL_UNPACK_SWAP_BYTES, psm.getUnpackSwapBytes() ? 1 : 0);
                return 100902; // GLU.GLU_OUT_OF_MEMORY
            }

            userImage.reset();
            switch (type) {
                case GL.GL_UNSIGNED_BYTE:
                    ScaleInternal.scale_internal_ubyte(cmpts, width, height, userImage, newwidth, newheight, dstImage, element_size, rowsize, group_size);
                    break;
                case GL.GL_BYTE:
                    ScaleInternal.scale_internal_byte(cmpts, width, height, userImage, newwidth, newheight, dstImage, element_size, rowsize, group_size);
                    break;
                case GL.GL_UNSIGNED_SHORT:
                    ScaleInternal.scale_internal_ushort(cmpts, width, height, userImage, newwidth, newheight, dstImage.asShortBuffer(), element_size, rowsize, group_size, myswap_bytes);
                    break;
                case GL.GL_SHORT:
                    // (sic) JOGL scales GL_SHORT with the unsigned-short routine
                    ScaleInternal.scale_internal_ushort(cmpts, width, height, userImage, newwidth, newheight, dstImage.asShortBuffer(), element_size, rowsize, group_size, myswap_bytes);
                    break;
                case GL.GL_UNSIGNED_INT:
                    ScaleInternal.scale_internal_uint(cmpts, width, height, userImage, newwidth, newheight, dstImage.asIntBuffer(), element_size, rowsize, group_size, myswap_bytes);
                    break;
                case GL.GL_INT:
                    ScaleInternal.scale_internal_int(cmpts, width, height, userImage, newwidth, newheight, dstImage.asIntBuffer(), element_size, rowsize, group_size, myswap_bytes);
                    break;
                case GL.GL_FLOAT:
                    ScaleInternal.scale_internal_float(cmpts, width, height, userImage, newwidth, newheight, dstImage.asFloatBuffer(), element_size, rowsize, group_size, myswap_bytes);
                    break;
                case GL.GL_UNSIGNED_BYTE_3_3_2:
                    ScaleInternal.scaleInternalPackedPixel(3, new Extract332(), width, height, userImage, newwidth, newheight, dstImage, element_size, rowsize, myswap_bytes);
                    break;
                case GL.GL_UNSIGNED_BYTE_2_3_3_REV:
                    ScaleInternal.scaleInternalPackedPixel(3, new Extract233rev(), width, height, userImage, newwidth, newheight, dstImage, element_size, rowsize, myswap_bytes);
                    break;
                case GL.GL_UNSIGNED_SHORT_5_6_5:
                    ScaleInternal.scaleInternalPackedPixel(3, new Extract565(), width, height, userImage, newwidth, newheight, dstImage, element_size, rowsize, myswap_bytes);
                    break;
                case GL.GL_UNSIGNED_SHORT_5_6_5_REV:
                    ScaleInternal.scaleInternalPackedPixel(3, new Extract565rev(), width, height, userImage, newwidth, newheight, dstImage, element_size, rowsize, myswap_bytes);
                    break;
                case GL.GL_UNSIGNED_SHORT_4_4_4_4:
                    ScaleInternal.scaleInternalPackedPixel(4, new Extract4444(), width, height, userImage, newwidth, newheight, dstImage, element_size, rowsize, myswap_bytes);
                    break;
                case GL.GL_UNSIGNED_SHORT_4_4_4_4_REV:
                    ScaleInternal.scaleInternalPackedPixel(4, new Extract4444rev(), width, height, userImage, newwidth, newheight, dstImage, element_size, rowsize, myswap_bytes);
                    break;
                case GL.GL_UNSIGNED_SHORT_5_5_5_1:
                    ScaleInternal.scaleInternalPackedPixel(4, new Extract5551(), width, height, userImage, newwidth, newheight, dstImage, element_size, rowsize, myswap_bytes);
                    break;
                case GL.GL_UNSIGNED_SHORT_1_5_5_5_REV:
                    ScaleInternal.scaleInternalPackedPixel(4, new Extract1555rev(), width, height, userImage, newwidth, newheight, dstImage, element_size, rowsize, myswap_bytes);
                    break;
                case GL.GL_UNSIGNED_INT_8_8_8_8:
                    ScaleInternal.scaleInternalPackedPixel(4, new Extract8888(), width, height, userImage, newwidth, newheight, dstImage, element_size, rowsize, myswap_bytes);
                    break;
                case GL.GL_UNSIGNED_INT_8_8_8_8_REV:
                    ScaleInternal.scaleInternalPackedPixel(4, new Extract8888rev(), width, height, userImage, newwidth, newheight, dstImage, element_size, rowsize, myswap_bytes);
                    break;
                case GL.GL_UNSIGNED_INT_10_10_10_2:
                    ScaleInternal.scaleInternalPackedPixel(4, new Extract1010102(), width, height, userImage, newwidth, newheight, dstImage, element_size, rowsize, myswap_bytes);
                    break;
                case GL.GL_UNSIGNED_INT_2_10_10_10_REV:
                    ScaleInternal.scaleInternalPackedPixel(4, new Extract2101010rev(), width, height, userImage, newwidth, newheight, dstImage, element_size, rowsize, myswap_bytes);
                    break;
                default:
                    if (!BuildMipmap.$assertionsDisabled) throw new JavaError('AssertionError');
                    break;
            }
            myswap_bytes = false;
            rowsize = Math.imul(newwidth, group_size);
            // swap dstImage and srcImage
            tempImage = srcImage;
            srcImage = dstImage;
            dstImage = tempImage;

            if (levels !== 0) {
                // use as little memory as possible
                let nextWidth = (newwidth / 2) | 0;
                let nextHeight = (newheight / 2) | 0;
                if (nextWidth < 1) {
                    nextWidth = 1;
                }
                if (nextHeight < 1) {
                    nextHeight = 1;
                }

                memreq = Mipmap.image_size(nextWidth, nextHeight, format, type);
                try {
                    switch (type) {
                        case GL.GL_BYTE:
                        case GL.GL_UNSIGNED_BYTE:
                        case GL.GL_SHORT:
                        case GL.GL_UNSIGNED_SHORT:
                        case GL.GL_INT:
                        case GL.GL_UNSIGNED_INT:
                        case GL.GL_FLOAT:
                        case GL.GL_UNSIGNED_BYTE_3_3_2:
                        case GL.GL_UNSIGNED_SHORT_4_4_4_4:
                        case GL.GL_UNSIGNED_SHORT_5_5_5_1:
                        case GL.GL_UNSIGNED_INT_8_8_8_8:
                        case GL.GL_UNSIGNED_INT_10_10_10_2:
                        case GL.GL_UNSIGNED_BYTE_2_3_3_REV:
                        case GL.GL_UNSIGNED_SHORT_5_6_5:
                        case GL.GL_UNSIGNED_SHORT_5_6_5_REV:
                        case GL.GL_UNSIGNED_SHORT_4_4_4_4_REV:
                        case GL.GL_UNSIGNED_SHORT_1_5_5_5_REV:
                        case GL.GL_UNSIGNED_INT_8_8_8_8_REV:
                        case GL.GL_UNSIGNED_INT_2_10_10_10_REV:
                            dstImage = ByteBuffer.allocateDirect(memreq).order(ByteOrder.nativeOrder());
                            break;
                        default:
                            return 100900; // GLU.GLU_INVALID_ENUM
                    }
                } catch (e) {
                    if (!isOutOfMemoryError(e)) throw e;
                    gl.glPixelStorei(GL.GL_UNPACK_ALIGNMENT, psm.getUnpackAlignment());
                    gl.glPixelStorei(GL.GL_UNPACK_SKIP_ROWS, psm.getUnpackSkipRows());
                    gl.glPixelStorei(GL.GL_UNPACK_SKIP_PIXELS, psm.getUnpackSkipPixels());
                    gl.glPixelStorei(GL.GL_UNPACK_ROW_LENGTH, psm.getUnpackRowLength());
                    gl.glPixelStorei(GL.GL_UNPACK_SWAP_BYTES, psm.getUnpackSwapBytes() ? 1 : 0);
                    return 100902; // GLU.GLU_OUT_OF_MEMORY
                }
            }
            // level userLevel is in srcImage; nothing saved yet
            level = userLevel;
        }

        gl.glPixelStorei(GL.GL_UNPACK_SWAP_BYTES, 0); // GL_FALSE
        if (baseLevel <= level && level <= maxLevel) {
            requireNonNull(srcImage).rewind();
            gl.glTexImage2D(target, level, internalFormat, newwidth, newheight, 0, format, type, srcImage);
        }

        level = (level + 1) | 0; // update current level for the loop
        for (; level <= levels; level = (level + 1) | 0) {
            const src = requireNonNull(srcImage);
            src.rewind();
            const dst = requireNonNull(dstImage);
            dst.rewind();
            switch (type) {
                case GL.GL_UNSIGNED_BYTE:
                    HalveImage.halveImage_ubyte(cmpts, newwidth, newheight, src, dst, element_size, rowsize, group_size);
                    break;
                case GL.GL_BYTE:
                    HalveImage.halveImage_byte(cmpts, newwidth, newheight, src, dst, element_size, rowsize, group_size);
                    break;
                case GL.GL_UNSIGNED_SHORT:
                    HalveImage.halveImage_ushort(cmpts, newwidth, newheight, src, dst.asShortBuffer(), element_size, rowsize, group_size, myswap_bytes);
                    break;
                case GL.GL_SHORT:
                    HalveImage.halveImage_short(cmpts, newwidth, newheight, src, dst.asShortBuffer(), element_size, rowsize, group_size, myswap_bytes);
                    break;
                case GL.GL_UNSIGNED_INT:
                    HalveImage.halveImage_uint(cmpts, newwidth, newheight, src, dst.asIntBuffer(), element_size, rowsize, group_size, myswap_bytes);
                    break;
                case GL.GL_INT:
                    HalveImage.halveImage_int(cmpts, newwidth, newheight, src, dst.asIntBuffer(), element_size, rowsize, group_size, myswap_bytes);
                    break;
                case GL.GL_FLOAT:
                    HalveImage.halveImage_float(cmpts, newwidth, newheight, src, dst.asFloatBuffer(), element_size, rowsize, group_size, myswap_bytes);
                    break;
                case GL.GL_UNSIGNED_BYTE_3_3_2:
                    if (!BuildMipmap.$assertionsDisabled && format !== GL.GL_RGB) throw new JavaError('AssertionError');
                    HalveImage.halveImagePackedPixel(3, new Extract332(), newwidth, newheight, src, dst, element_size, rowsize, myswap_bytes);
                    break;
                case GL.GL_UNSIGNED_BYTE_2_3_3_REV:
                    if (!BuildMipmap.$assertionsDisabled && format !== GL.GL_RGB) throw new JavaError('AssertionError');
                    HalveImage.halveImagePackedPixel(3, new Extract233rev(), newwidth, newheight, src, dst, element_size, rowsize, myswap_bytes);
                    break;
                case GL.GL_UNSIGNED_SHORT_5_6_5:
                    HalveImage.halveImagePackedPixel(3, new Extract565(), newwidth, newheight, src, dst, element_size, rowsize, myswap_bytes);
                    break;
                case GL.GL_UNSIGNED_SHORT_5_6_5_REV:
                    HalveImage.halveImagePackedPixel(3, new Extract565rev(), newwidth, newheight, src, dst, element_size, rowsize, myswap_bytes);
                    break;
                case GL.GL_UNSIGNED_SHORT_4_4_4_4:
                    HalveImage.halveImagePackedPixel(4, new Extract4444(), newwidth, newheight, src, dst, element_size, rowsize, myswap_bytes);
                    break;
                case GL.GL_UNSIGNED_SHORT_4_4_4_4_REV:
                    HalveImage.halveImagePackedPixel(4, new Extract4444rev(), newwidth, newheight, src, dst, element_size, rowsize, myswap_bytes);
                    break;
                case GL.GL_UNSIGNED_SHORT_5_5_5_1:
                    HalveImage.halveImagePackedPixel(4, new Extract5551(), newwidth, newheight, src, dst, element_size, rowsize, myswap_bytes);
                    break;
                case GL.GL_UNSIGNED_SHORT_1_5_5_5_REV:
                    HalveImage.halveImagePackedPixel(4, new Extract1555rev(), newwidth, newheight, src, dst, element_size, rowsize, myswap_bytes);
                    break;
                case GL.GL_UNSIGNED_INT_8_8_8_8:
                    HalveImage.halveImagePackedPixel(4, new Extract8888(), newwidth, newheight, src, dst, element_size, rowsize, myswap_bytes);
                    break;
                case GL.GL_UNSIGNED_INT_8_8_8_8_REV:
                    HalveImage.halveImagePackedPixel(4, new Extract8888rev(), newwidth, newheight, src, dst, element_size, rowsize, myswap_bytes);
                    break;
                case GL.GL_UNSIGNED_INT_10_10_10_2:
                    HalveImage.halveImagePackedPixel(4, new Extract1010102(), newwidth, newheight, src, dst, element_size, rowsize, myswap_bytes);
                    break;
                case GL.GL_UNSIGNED_INT_2_10_10_10_REV:
                    HalveImage.halveImagePackedPixel(4, new Extract2101010rev(), newwidth, newheight, src, dst, element_size, rowsize, myswap_bytes);
                    break;
                default:
                    if (!BuildMipmap.$assertionsDisabled) throw new JavaError('AssertionError');
                    break;
            }

            tempImage = srcImage;
            srcImage = dstImage;
            dstImage = tempImage;

            if (newwidth > 1) {
                newwidth = (newwidth / 2) | 0;
                rowsize = (rowsize / 2) | 0;
            }
            if (newheight > 1) {
                newheight = (newheight / 2) | 0;
            }
            {
                // compute amount to pad per row if any
                const rowPad = intRemainder(rowsize, psm.getUnpackAlignment());

                // should row be padded
                if (rowPad === 0) {
                    // call teximage with srcImage untouched since its not padded
                    if (baseLevel <= level && level <= maxLevel) {
                        requireNonNull(srcImage).rewind();
                        gl.glTexImage2D(target, level, internalFormat, newwidth, newheight, 0, format, type, srcImage);
                    }
                } else {
                    // compute length of new row in bytes, including padding
                    const newRowLength = (((rowsize + psm.getUnpackAlignment()) | 0) - rowPad) | 0;
                    let ii: number, jj: number;

                    // allocate new image for mipmap of size newRowLength x newheight
                    let newMipmapImage: ByteBuffer | null = null;
                    try {
                        newMipmapImage = ByteBuffer.allocateDirect(Math.imul(newRowLength, newheight));
                    } catch (e) {
                        if (!isOutOfMemoryError(e)) throw e;
                        // out of memory so return
                        gl.glPixelStorei(GL.GL_UNPACK_ALIGNMENT, psm.getUnpackAlignment());
                        gl.glPixelStorei(GL.GL_UNPACK_SKIP_ROWS, psm.getUnpackSkipRows());
                        gl.glPixelStorei(GL.GL_UNPACK_SKIP_PIXELS, psm.getUnpackSkipPixels());
                        gl.glPixelStorei(GL.GL_UNPACK_ROW_LENGTH, psm.getUnpackRowLength());
                        gl.glPixelStorei(GL.GL_UNPACK_SWAP_BYTES, psm.getUnpackSwapBytes() ? 1 : 0);
                        return 100902; // GLU.GLU_OUT_OF_MEMORY
                    }
                    const srcRows = requireNonNull(srcImage);
                    srcRows.rewind();
                    // copy image from srcImage into newMipmapImage by rows
                    for (ii = 0; ii < newheight; ii++) {
                        newMipmapImage.position(Math.imul(newRowLength, ii));
                        for (jj = 0; jj < rowsize; jj++) {
                            newMipmapImage.put(srcRows.get());
                        }
                    }

                    // and use this new image for mipmapping instead
                    if (baseLevel <= level && level <= maxLevel) {
                        newMipmapImage.rewind();
                        gl.glTexImage2D(target, level, internalFormat, newwidth, newheight, 0, format, type, newMipmapImage);
                    }
                }
            }
        }
        gl.glPixelStorei(GL.GL_UNPACK_ALIGNMENT, psm.getUnpackAlignment());
        gl.glPixelStorei(GL.GL_UNPACK_SKIP_ROWS, psm.getUnpackSkipRows());
        gl.glPixelStorei(GL.GL_UNPACK_SKIP_PIXELS, psm.getUnpackSkipPixels());
        gl.glPixelStorei(GL.GL_UNPACK_ROW_LENGTH, psm.getUnpackRowLength());
        gl.glPixelStorei(GL.GL_UNPACK_SWAP_BYTES, psm.getUnpackSwapBytes() ? 1 : 0);
        return 0;
    }
}
