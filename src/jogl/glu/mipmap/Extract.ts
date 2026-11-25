import type ByteBuffer from '#/util/nio/ByteBuffer';

// com.sun.opengl.impl.mipmap.Extract: unpacks one packed pixel into float components and packs them back.
// HalveImage.halveImagePackedPixel/halve1DimagePackedPixel and ScaleInternal.scaleInternalPackedPixel run both
// directions; Image.fill_image extracts only. The twelve implementations are ported 1:1, JOGL's channel-mask slips
// included (Extract5551, Extract1555rev).
interface Extract {
    // com.sun.opengl.impl.mipmap.Extract.extract(ZLjava/nio/ByteBuffer;[F)V
    extract(isSwap: boolean, packedPixel: ByteBuffer | null, extractComponents: Float32Array | null): void;

    // com.sun.opengl.impl.mipmap.Extract.shove([FILjava/nio/ByteBuffer;)V
    shove(shoveComponents: Float32Array | null, index: number, packedPixel: ByteBuffer | null): void;
}

export type { Extract as default };
