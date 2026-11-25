// com.sun.opengl.impl.mipmap.PixelStorageModes (shipped jogl.jar, JOGL 1.1.x, shrunk by ProGuard: the shipped class
// keeps the twelve fields, the six pack setters and the six unpack getter/setter pairs below, and no pack getters).
// Mipmap.retrieveStoreModes fills it from glGetIntegerv; BuildMipmap.gluBuild2DMipmapLevelsCore reads the unpack modes.
export default class PixelStorageModes {
    private packAlignment: number = 0; // com.sun.opengl.impl.mipmap.PixelStorageModes.packAlignment:I
    private packRowLength: number = 0; // com.sun.opengl.impl.mipmap.PixelStorageModes.packRowLength:I
    private packSkipRows: number = 0; // com.sun.opengl.impl.mipmap.PixelStorageModes.packSkipRows:I
    private packSkipPixels: number = 0; // com.sun.opengl.impl.mipmap.PixelStorageModes.packSkipPixels:I
    private packLsbFirst: boolean = false; // com.sun.opengl.impl.mipmap.PixelStorageModes.packLsbFirst:Z
    private packSwapBytes: boolean = false; // com.sun.opengl.impl.mipmap.PixelStorageModes.packSwapBytes:Z
    private unpackAlignment: number = 0; // com.sun.opengl.impl.mipmap.PixelStorageModes.unpackAlignment:I
    private unpackRowLength: number = 0; // com.sun.opengl.impl.mipmap.PixelStorageModes.unpackRowLength:I
    private unpackSkipRows: number = 0; // com.sun.opengl.impl.mipmap.PixelStorageModes.unpackSkipRows:I
    private unpackSkipPixels: number = 0; // com.sun.opengl.impl.mipmap.PixelStorageModes.unpackSkipPixels:I
    private unpackLsbFirst: boolean = false; // com.sun.opengl.impl.mipmap.PixelStorageModes.unpackLsbFirst:Z
    private unpackSwapBytes: boolean = false; // com.sun.opengl.impl.mipmap.PixelStorageModes.unpackSwapBytes:Z

    // com.sun.opengl.impl.mipmap.PixelStorageModes.<init>()V
    constructor() {}

    // com.sun.opengl.impl.mipmap.PixelStorageModes.setPackAlignment(I)V
    setPackAlignment(packAlignment: number): void {
        this.packAlignment = packAlignment;
    }

    // com.sun.opengl.impl.mipmap.PixelStorageModes.setPackRowLength(I)V
    setPackRowLength(packRowLength: number): void {
        this.packRowLength = packRowLength;
    }

    // com.sun.opengl.impl.mipmap.PixelStorageModes.setPackSkipRows(I)V
    setPackSkipRows(packSkipRows: number): void {
        this.packSkipRows = packSkipRows;
    }

    // com.sun.opengl.impl.mipmap.PixelStorageModes.setPackSkipPixels(I)V
    setPackSkipPixels(packSkipPixels: number): void {
        this.packSkipPixels = packSkipPixels;
    }

    // com.sun.opengl.impl.mipmap.PixelStorageModes.setPackLsbFirst(Z)V
    setPackLsbFirst(packLsbFirst: boolean): void {
        this.packLsbFirst = packLsbFirst;
    }

    // com.sun.opengl.impl.mipmap.PixelStorageModes.setPackSwapBytes(Z)V
    setPackSwapBytes(packSwapBytes: boolean): void {
        this.packSwapBytes = packSwapBytes;
    }

    // com.sun.opengl.impl.mipmap.PixelStorageModes.getUnpackAlignment()I
    getUnpackAlignment(): number {
        return this.unpackAlignment;
    }

    // com.sun.opengl.impl.mipmap.PixelStorageModes.setUnpackAlignment(I)V
    setUnpackAlignment(unpackAlignment: number): void {
        this.unpackAlignment = unpackAlignment;
    }

    // com.sun.opengl.impl.mipmap.PixelStorageModes.getUnpackRowLength()I
    getUnpackRowLength(): number {
        return this.unpackRowLength;
    }

    // com.sun.opengl.impl.mipmap.PixelStorageModes.setUnpackRowLength(I)V
    setUnpackRowLength(unpackRowLength: number): void {
        this.unpackRowLength = unpackRowLength;
    }

    // com.sun.opengl.impl.mipmap.PixelStorageModes.getUnpackSkipRows()I
    getUnpackSkipRows(): number {
        return this.unpackSkipRows;
    }

    // com.sun.opengl.impl.mipmap.PixelStorageModes.setUnpackSkipRows(I)V
    setUnpackSkipRows(unpackSkipRows: number): void {
        this.unpackSkipRows = unpackSkipRows;
    }

    // com.sun.opengl.impl.mipmap.PixelStorageModes.getUnpackSkipPixels()I
    getUnpackSkipPixels(): number {
        return this.unpackSkipPixels;
    }

    // com.sun.opengl.impl.mipmap.PixelStorageModes.setUnpackSkipPixels(I)V
    setUnpackSkipPixels(unpackSkipPixels: number): void {
        this.unpackSkipPixels = unpackSkipPixels;
    }

    // com.sun.opengl.impl.mipmap.PixelStorageModes.getUnpackLsbFirst()Z
    getUnpackLsbFirst(): boolean {
        return this.unpackLsbFirst;
    }

    // com.sun.opengl.impl.mipmap.PixelStorageModes.setUnpackLsbFirst(Z)V
    setUnpackLsbFirst(unpackLsbFirst: boolean): void {
        this.unpackLsbFirst = unpackLsbFirst;
    }

    // com.sun.opengl.impl.mipmap.PixelStorageModes.getUnpackSwapBytes()Z
    getUnpackSwapBytes(): boolean {
        return this.unpackSwapBytes;
    }

    // com.sun.opengl.impl.mipmap.PixelStorageModes.setUnpackSwapBytes(Z)V
    setUnpackSwapBytes(unpackSwapBytes: boolean): void {
        this.unpackSwapBytes = unpackSwapBytes;
    }
}
