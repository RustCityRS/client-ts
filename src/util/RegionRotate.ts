export default class RegionRotate {
    // g.a(IIII)I
    static RegionRotateX(rotation: number, reverseRotation: number, z: number, x: number): number {
        rotation &= 3;
        if (rotation === 0) return x;
        if (rotation === 1) return z;
        return rotation === reverseRotation ? (7 - x) | 0 : (7 - z) | 0;
    }

    // bf.a(IIBI)I
    static RegionRotateZ(rotation: number, z: number, x: number): number {
        rotation &= 3;
        if (rotation === 0) return z;
        if (rotation === 1) return (7 - x) | 0;
        return rotation === 2 ? (7 - z) | 0 : x;
    }

    // ca.a(IIIIIII)I
    static RegionRotateLocationX(z: number, x: number, length: number, locAngle: number, width: number, rotation: number): number {
        if ((locAngle & 1) === 1) {
            const swap = width;
            width = length;
            length = swap;
        }
        rotation &= 3;
        if (rotation === 0) return x;
        if (rotation === 1) return z;
        return rotation === 2 ? (8 - width - x) | 0 : (8 - z - length) | 0;
    }

    // qd.a(IIIIIII)I
    static RegionRotateLocationZ(rotation: number, width: number, z: number, length: number, locAngle: number, x: number): number {
        rotation &= 3;
        if ((locAngle & 1) === 1) {
            const swap = width;
            width = length;
            length = swap;
        }
        if (rotation === 0) return z;
        if (rotation === 1) return (8 - width - x) | 0;
        return rotation === 2 ? (8 - z - length) | 0 : x;
    }
}
