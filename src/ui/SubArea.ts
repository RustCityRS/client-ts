import Linkable from '#/datastruct/Linkable';

export default class SubArea extends Linkable {
    maxZ: number; // ie.q:I
    maxX: number; // ie.y:I
    minX: number; // ie.B:I
    minZ: number; // ie.D:I

    // ie.<init>(IIII)V
    constructor(minX: number, minZ: number, maxX: number, maxZ: number) {
        super();
        this.maxZ = maxZ;
        this.minX = minX;
        this.maxX = maxX;
        this.minZ = minZ;
    }

    // ie.a(III)Z
    contains(z: number, x: number): boolean {
        return x >= this.minX && this.maxX >= x && z >= this.minZ && z <= this.maxZ;
    }
}
