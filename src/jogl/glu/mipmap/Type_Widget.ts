import ByteBuffer from '#/util/nio/ByteBuffer';

// com.sun.opengl.impl.mipmap.Type_Widget (shipped jogl.jar, JOGL 1.1.x, shrunk by ProGuard to the members below):
// a 4-byte big-endian scratch buffer that Image.fill_image fills byte by byte (swapped or not) and reads back as a
// short, int or float. ProGuard kept the four byte setters and the five readers fill_image calls.
export default class Type_Widget {
    // com.sun.opengl.impl.mipmap.Type_Widget.buffer:Ljava/nio/ByteBuffer; (package-private)
    buffer: ByteBuffer;

    // com.sun.opengl.impl.mipmap.Type_Widget.<init>()V
    constructor() {
        this.buffer = ByteBuffer.allocate(4);
    }

    // com.sun.opengl.impl.mipmap.Type_Widget.setUB0(B)V
    setUB0(b: number): void {
        this.buffer.position(0);
        this.buffer.put(b);
    }

    // com.sun.opengl.impl.mipmap.Type_Widget.setUB1(B)V
    setUB1(b: number): void {
        this.buffer.position(1);
        this.buffer.put(b);
    }

    // com.sun.opengl.impl.mipmap.Type_Widget.setUB2(B)V
    setUB2(b: number): void {
        this.buffer.position(2);
        this.buffer.put(b);
    }

    // com.sun.opengl.impl.mipmap.Type_Widget.setUB3(B)V
    setUB3(b: number): void {
        this.buffer.position(3);
        this.buffer.put(b);
    }

    // com.sun.opengl.impl.mipmap.Type_Widget.getUS0()S
    getUS0(): number {
        this.buffer.position(0);
        return this.buffer.getShort();
    }

    // com.sun.opengl.impl.mipmap.Type_Widget.getUI()I
    getUI(): number {
        this.buffer.position(0);
        return this.buffer.getInt();
    }

    // com.sun.opengl.impl.mipmap.Type_Widget.getS0()S
    getS0(): number {
        this.buffer.position(0);
        return this.buffer.getShort();
    }

    // com.sun.opengl.impl.mipmap.Type_Widget.getI()I
    getI(): number {
        this.buffer.position(0);
        return this.buffer.getInt();
    }

    // com.sun.opengl.impl.mipmap.Type_Widget.getF()F
    getF(): number {
        this.buffer.position(0);
        return this.buffer.getFloat();
    }
}
