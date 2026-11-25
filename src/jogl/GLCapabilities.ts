// javax.media.opengl.GLCapabilities implements java.lang.Cloneable (shipped jogl.jar, JOGL 1.1.x).
// This is a complete 1:1 port of the shipped class, which is pure Java. The gamepack uses only <init>,
// setSampleBuffers and setNumSamples (tf.a(Ljava/awt/Canvas;I)I); the other members are what a platform
// factory reads when it chooses a pixel format.
export default class GLCapabilities {
    private doubleBuffered: boolean; // javax.media.opengl.GLCapabilities.doubleBuffered:Z
    private stereo: boolean; // javax.media.opengl.GLCapabilities.stereo:Z
    private hardwareAccelerated: boolean; // javax.media.opengl.GLCapabilities.hardwareAccelerated:Z
    private depthBits: number; // javax.media.opengl.GLCapabilities.depthBits:I
    private stencilBits: number; // javax.media.opengl.GLCapabilities.stencilBits:I
    private redBits: number; // javax.media.opengl.GLCapabilities.redBits:I
    private greenBits: number; // javax.media.opengl.GLCapabilities.greenBits:I
    private blueBits: number; // javax.media.opengl.GLCapabilities.blueBits:I
    private alphaBits: number; // javax.media.opengl.GLCapabilities.alphaBits:I
    private accumRedBits: number; // javax.media.opengl.GLCapabilities.accumRedBits:I
    private accumGreenBits: number; // javax.media.opengl.GLCapabilities.accumGreenBits:I
    private accumBlueBits: number; // javax.media.opengl.GLCapabilities.accumBlueBits:I
    private accumAlphaBits: number; // javax.media.opengl.GLCapabilities.accumAlphaBits:I
    private sampleBuffers: boolean; // javax.media.opengl.GLCapabilities.sampleBuffers:Z
    private numSamples: number; // javax.media.opengl.GLCapabilities.numSamples:I
    private pbufferFloatingPointBuffers: boolean = false; // javax.media.opengl.GLCapabilities.pbufferFloatingPointBuffers:Z

    // javax.media.opengl.GLCapabilities.<init>()V
    constructor() {
        this.doubleBuffered = true;
        this.stereo = false;
        this.hardwareAccelerated = true;
        this.depthBits = 24;
        this.stencilBits = 0;
        this.redBits = 8;
        this.greenBits = 8;
        this.blueBits = 8;
        this.alphaBits = 0;
        this.accumRedBits = 0;
        this.accumGreenBits = 0;
        this.accumBlueBits = 0;
        this.accumAlphaBits = 0;
        this.sampleBuffers = false;
        this.numSamples = 2;
    }

    // javax.media.opengl.GLCapabilities.clone()Ljava/lang/Object;
    clone(): GLCapabilities {
        // Object.clone(): a shallow copy of every field, without running a constructor. The class is
        // Cloneable, so the catch (CloneNotSupportedException) -> throw new GLException(e) arm cannot run.
        return Object.assign(Object.create(GLCapabilities.prototype) as GLCapabilities, this);
    }

    // javax.media.opengl.GLCapabilities.getDoubleBuffered()Z
    getDoubleBuffered(): boolean {
        return this.doubleBuffered;
    }

    // javax.media.opengl.GLCapabilities.setDoubleBuffered(Z)V
    setDoubleBuffered(doubleBuffered: boolean): void {
        this.doubleBuffered = doubleBuffered;
    }

    // javax.media.opengl.GLCapabilities.getStereo()Z
    getStereo(): boolean {
        return this.stereo;
    }

    // javax.media.opengl.GLCapabilities.setStereo(Z)V
    setStereo(stereo: boolean): void {
        this.stereo = stereo;
    }

    // javax.media.opengl.GLCapabilities.getHardwareAccelerated()Z
    getHardwareAccelerated(): boolean {
        return this.hardwareAccelerated;
    }

    // javax.media.opengl.GLCapabilities.setHardwareAccelerated(Z)V
    setHardwareAccelerated(hardwareAccelerated: boolean): void {
        this.hardwareAccelerated = hardwareAccelerated;
    }

    // javax.media.opengl.GLCapabilities.getDepthBits()I
    getDepthBits(): number {
        return this.depthBits;
    }

    // javax.media.opengl.GLCapabilities.setDepthBits(I)V
    setDepthBits(depthBits: number): void {
        this.depthBits = depthBits;
    }

    // javax.media.opengl.GLCapabilities.getStencilBits()I
    getStencilBits(): number {
        return this.stencilBits;
    }

    // javax.media.opengl.GLCapabilities.setStencilBits(I)V
    setStencilBits(stencilBits: number): void {
        this.stencilBits = stencilBits;
    }

    // javax.media.opengl.GLCapabilities.getRedBits()I
    getRedBits(): number {
        return this.redBits;
    }

    // javax.media.opengl.GLCapabilities.setRedBits(I)V
    setRedBits(redBits: number): void {
        this.redBits = redBits;
    }

    // javax.media.opengl.GLCapabilities.getGreenBits()I
    getGreenBits(): number {
        return this.greenBits;
    }

    // javax.media.opengl.GLCapabilities.setGreenBits(I)V
    setGreenBits(greenBits: number): void {
        this.greenBits = greenBits;
    }

    // javax.media.opengl.GLCapabilities.getBlueBits()I
    getBlueBits(): number {
        return this.blueBits;
    }

    // javax.media.opengl.GLCapabilities.setBlueBits(I)V
    setBlueBits(blueBits: number): void {
        this.blueBits = blueBits;
    }

    // javax.media.opengl.GLCapabilities.getAlphaBits()I
    getAlphaBits(): number {
        return this.alphaBits;
    }

    // javax.media.opengl.GLCapabilities.setAlphaBits(I)V
    setAlphaBits(alphaBits: number): void {
        this.alphaBits = alphaBits;
    }

    // javax.media.opengl.GLCapabilities.getAccumRedBits()I
    getAccumRedBits(): number {
        return this.accumRedBits;
    }

    // javax.media.opengl.GLCapabilities.setAccumRedBits(I)V
    setAccumRedBits(accumRedBits: number): void {
        this.accumRedBits = accumRedBits;
    }

    // javax.media.opengl.GLCapabilities.getAccumGreenBits()I
    getAccumGreenBits(): number {
        return this.accumGreenBits;
    }

    // javax.media.opengl.GLCapabilities.setAccumGreenBits(I)V
    setAccumGreenBits(accumGreenBits: number): void {
        this.accumGreenBits = accumGreenBits;
    }

    // javax.media.opengl.GLCapabilities.getAccumBlueBits()I
    getAccumBlueBits(): number {
        return this.accumBlueBits;
    }

    // javax.media.opengl.GLCapabilities.setAccumBlueBits(I)V
    setAccumBlueBits(accumBlueBits: number): void {
        this.accumBlueBits = accumBlueBits;
    }

    // javax.media.opengl.GLCapabilities.getAccumAlphaBits()I
    getAccumAlphaBits(): number {
        return this.accumAlphaBits;
    }

    // javax.media.opengl.GLCapabilities.setAccumAlphaBits(I)V
    setAccumAlphaBits(accumAlphaBits: number): void {
        this.accumAlphaBits = accumAlphaBits;
    }

    // javax.media.opengl.GLCapabilities.setSampleBuffers(Z)V
    setSampleBuffers(sampleBuffers: boolean): void {
        this.sampleBuffers = sampleBuffers;
    }

    // javax.media.opengl.GLCapabilities.getSampleBuffers()Z
    getSampleBuffers(): boolean {
        return this.sampleBuffers;
    }

    // javax.media.opengl.GLCapabilities.setNumSamples(I)V
    setNumSamples(numSamples: number): void {
        this.numSamples = numSamples;
    }

    // javax.media.opengl.GLCapabilities.getNumSamples()I
    getNumSamples(): number {
        return this.numSamples;
    }

    // javax.media.opengl.GLCapabilities.setPbufferFloatingPointBuffers(Z)V
    setPbufferFloatingPointBuffers(pbufferFloatingPointBuffers: boolean): void {
        this.pbufferFloatingPointBuffers = pbufferFloatingPointBuffers;
    }

    // javax.media.opengl.GLCapabilities.toString()Ljava/lang/String;
    toString(): string {
        return (
            'GLCapabilities [DoubleBuffered: ' +
            this.doubleBuffered +
            ', Stereo: ' +
            this.stereo +
            ', HardwareAccelerated: ' +
            this.hardwareAccelerated +
            ', DepthBits: ' +
            this.depthBits +
            ', StencilBits: ' +
            this.stencilBits +
            ', Red: ' +
            this.redBits +
            ', Green: ' +
            this.greenBits +
            ', Blue: ' +
            this.blueBits +
            ', Alpha: ' +
            this.alphaBits +
            ', Red Accum: ' +
            this.accumRedBits +
            ', Green Accum: ' +
            this.accumGreenBits +
            ', Blue Accum: ' +
            this.accumBlueBits +
            ', Alpha Accum: ' +
            this.accumAlphaBits +
            ', Multisample: ' +
            this.sampleBuffers +
            (this.sampleBuffers ? ', Num samples: ' + this.numSamples : '') +
            ' ]'
        );
    }
}
