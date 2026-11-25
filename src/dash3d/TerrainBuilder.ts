import HashTable from '#/datastruct/HashTable';
import FluType from '#/config/FluType';
import FloType from '#/config/FloType';
import { arrayAtB64, arrayAtF32, arrayAtI32, arrayAtObj, arrayAtU8, arrayPutB64, arrayPutI32, arrayPutObj, arrayPutU8, requireNonNull } from '#/util/JavaArray';
import Pix3D from './Pix3D';
import type { HdTextureProvider } from './TextureProvider';
import TerrainBatch from './TerrainBatch';
import IntArrayPages from '#/util/IntArrayPages';
import { longFromSignedWords } from '#/util/IntUtils';

// Per-tile index arrays remain live with their material batch until the scene is released.
const polygonIndices = new IntArrayPages(1024);

// Adjacent terrain corners usually use the same material and water colour.
let previousHigh = 0;
let previousLow = 0;
let previousKey = 0n;
function materialKey(high: number, low: number): bigint {
    if (high !== previousHigh || low !== previousLow) {
        previousKey = longFromSignedWords(high, low);
        previousHigh = high;
        previousLow = low;
    }
    return previousKey;
}

// HD level terrain construction, relocated statics of pi, a, ec, eh, ql, tk, bi, fh, oj, ac and sh.
export default class TerrainBuilder {
    static readonly overlayShapes = [
        [0, 128, 0, 0, 128, 0, 128, 128],
        [0, 128, 0, 0, 128, 0],
        [0, 0, 64, 128, 0, 128],
        [128, 128, 64, 128, 128, 0],
        [0, 0, 128, 0, 128, 128, 64, 128],
        [0, 128, 0, 0, 128, 0, 64, 128],
        [64, 128, 0, 128, 0, 0, 64, 0],
        [0, 0, 64, 0, 0, 64],
        [128, 0, 128, 128, 0, 128, 0, 64, 64, 0],
        [0, 128, 0, 0, 32, 64, 64, 96, 128, 128],
        [0, 0, 128, 0, 128, 128, 64, 96, 32, 64],
        [0, 0, 128, 0, 96, 32, 32, 32]
    ].map(row => Int32Array.from(row)); // sh.i
    static readonly underlayShapes = [
        [],
        [128, 0, 128, 128, 0, 128],
        [0, 0, 128, 0, 128, 128, 64, 128],
        [0, 128, 0, 0, 128, 0, 64, 128],
        [0, 0, 64, 128, 0, 128],
        [128, 128, 64, 128, 128, 0],
        [64, 0, 128, 0, 128, 128, 64, 128],
        [128, 0, 128, 128, 0, 128, 0, 64, 64, 0],
        [0, 0, 64, 0, 0, 64],
        [0, 0, 128, 0, 128, 128, 64, 96, 32, 64],
        [0, 128, 0, 0, 32, 64, 64, 96, 128, 128],
        [0, 128, 0, 0, 32, 32, 96, 32, 128, 0, 128, 128]
    ].map(row => Int32Array.from(row)); // ec.B
    static readonly useSurfaceHeight = [
        [],
        [true, false, true],
        [true, false, false, true],
        [false, false, true, true],
        [true, true, false],
        [false, true, true],
        [true, false, false, true],
        [false, false, false, true, true],
        [false, true, true],
        [true, false, true, true, true],
        [false, true, true, true, true],
        [false, true, true, true, true, false]
    ]; // fh.U
    static readonly blendVertexCounts = Int32Array.from([0, 2, 2, 2, 1, 1, 2, 2, 1, 3, 1, 1]); // gf.S
    static readonly shapeEdges = Int32Array.from([1, 1, 1, 1, 4, 1, 1, 5, 6, 1, 5, 0, 7, 0, 4, 1, 7, 2, 1, 1, 6, 1, 1, 3, 6, 1, 7, 0, 0, 6, 7, 0, 1, 7, 6, 1, 1, 1, 5, 4, 3, 2, 1, 1, 0, 4, 1, 5]); // kc.s
    static readonly edgeVertices = [
        [true, true, true],
        [false, false],
        [false, true],
        [true, false],
        [false, true, true],
        [true, false, true],
        [false, true, false],
        [true, false, false]
    ]; // wi.hb
    // tk.a(Lsc;ZLwl;)Lhg;
    private static getOverlayBatch(batches: HashTable<TerrainBatch>, overlay: FloType): TerrainBatch {
        const low = (((overlay.m_materialID + 1) << 16) + overlay.m_textureScale) | 0;
        const key = materialKey(((overlay.m_priority << 24) + overlay.field_80) | 0, low);
        let batch = batches.get(key, low);
        if (batch === null) {
            batch = new TerrainBatch(overlay.m_materialID, overlay.m_textureScale, true, false, overlay.field_80);
            batches.put(batch, key, low);
        }
        return batch;
    }
    // sc.a([Lab;I)I
    private static copyBatches(batches: HashTable<TerrainBatch>, output: TerrainBatch[]): number {
        let count = 0;
        for (let i = 0; i < batches.capacity; i++) {
            const root = arrayAtObj(batches.buckets, i);
            for (let link = root.next; link !== root; link = requireNonNull(link).next) {
                arrayPutObj(output, count++, link as TerrainBatch);
            }
        }
        return count;
    }
    // ac.a([J[Ljava/lang/Object;I)V
    private static sort(keys: BigInt64Array, values: TerrainBatch[]): void {
        TerrainBuilder.sortRange(keys.length - 1, keys, 0, values);
    }
    // sh.a(I[JII[Ljava/lang/Object;)V
    private static sortRange(end: number, keys: BigInt64Array, start: number, values: TerrainBatch[]): void {
        if (start < end) {
            let insert = start;
            const mid = (((start + end) | 0) / 2) | 0;
            const pivot = arrayAtB64(keys, mid);
            arrayPutB64(keys, mid, arrayAtB64(keys, end));
            arrayPutB64(keys, end, pivot);
            const batch = arrayAtObj(values, mid);
            arrayPutObj(values, mid, arrayAtObj(values, end));
            arrayPutObj(values, end, batch);
            for (let i = start; i < end; i++) {
                if (BigInt.asIntN(64, pivot + BigInt(i & 1)) <= arrayAtB64(keys, i)) continue;
                const key = arrayAtB64(keys, i);
                arrayPutB64(keys, i, arrayAtB64(keys, insert));
                arrayPutB64(keys, insert, key);
                const value = arrayAtObj(values, i);
                arrayPutObj(values, i, arrayAtObj(values, insert));
                arrayPutObj(values, insert++, value);
            }
            arrayPutB64(keys, end, arrayAtB64(keys, insert));
            arrayPutB64(keys, insert, pivot);
            arrayPutObj(values, end, arrayAtObj(values, insert));
            arrayPutObj(values, insert, batch);
            TerrainBuilder.sortRange(insert - 1, keys, start, values);
            TerrainBuilder.sortRange(end, keys, insert + 1, values);
        }
    }
    // bi.a(IIBI)I
    private static colour(texture: number, hsl: number, light: number): number {
        let rgb = arrayAtI32(Pix3D.colourTable, TerrainBuilder.multiplyLightness(hsl, light));
        if (texture >= 0) {
            const greyFactor = (requireNonNull(Pix3D.textureProvider) as HdTextureProvider).grayscaleFactor(texture & 65535);
            if (greyFactor !== 0) {
                const grey = light >= 0 ? (light > 127 ? 0xffffff : 131586 * light) : 0;
                if (greyFactor === 256) rgb = grey;
                else {
                    const inv = 256 - greyFactor;
                    rgb = ((0xff0000 & (Math.imul(grey & 0xff00, greyFactor) + Math.imul(inv, rgb & 0xff00))) + (0xff00ff00 & (Math.imul(greyFactor, grey & 0xff00ff) + Math.imul(rgb & 0xff00ff, inv)))) >> 8;
                }
            }
            let luminance = (requireNonNull(Pix3D.textureProvider) as HdTextureProvider).brightness(texture & 65535);
            if (luminance !== 0) {
                luminance += 256;
                let r = ((rgb & 0xff0000) >> 16) * luminance;
                if (r > 65535) r = 65535;
                let g = ((rgb & 0xff00) >> 8) * luminance;
                if (g > 65535) g = 65535;
                let b = luminance * (rgb & 255);
                if (b > 65535) b = 65535;
                rgb = (b >> 8) + (0xff00 & g) + (0xff001f & (r << 8));
            }
        }
        return rgb;
    }
    // w.a(II)I
    private static multiplyLightness(hsl: number, light: number): number {
        light = Math.imul(light, hsl & 127) >> 7;
        if (light < 2) light = 2;
        else if (light > 126) light = 126;
        return (hsl & 0xff80) + light;
    }
    // fh.a(IIII)I
    private static blendColours(weight: number, a: number, b: number): number {
        if (a === b) return a;
        const inv = 128 - weight;
        const high = (Math.imul(weight, (b & 0xff00ff00) >>> 7) + Math.imul(inv, (a & 0xff00ff00) >>> 7)) & 0xff00ff00;
        const low = (Math.imul(inv, a & 0xff00ff) + Math.imul(b & 0xff00ff, weight)) & 0xff00ff00;
        return (high + (low >> 7)) | 0;
    }
    // oj.a(IBI[[III)I
    static height(localX: number, z: number, heights: Int32Array[], x: number, localZ: number): number {
        const near = (Math.imul(localX, arrayAtI32(arrayAtObj(heights, x + 1), z)) + Math.imul(128 - localX, arrayAtI32(arrayAtObj(heights, x), z))) >> 7;
        const far = (Math.imul(arrayAtI32(arrayAtObj(heights, x), z + 1), 128 - localX) + Math.imul(arrayAtI32(arrayAtObj(heights, x + 1), z + 1), localX)) >> 7;
        return (Math.imul(near, 128 - localZ) + Math.imul(localZ, far)) >> 7;
    }
    // ql.a(IFII[[I[[II[[FIBIZLhg;[[FII[[FI)I
    private static vertex(
        colour01: number,
        depthScale: number,
        colour00: number,
        colour10: number,
        surface: Int32Array[] | null,
        heights: Int32Array[],
        x: number,
        normalZ: Float32Array[],
        colour11: number,
        rotation: number,
        transparent: boolean,
        batch: TerrainBatch | null,
        normalX: Float32Array[],
        z: number,
        localX: number,
        normalY: Float32Array[],
        localZ: number
    ): number {
        if (rotation === 1) {
            const tmp = localX;
            localX = localZ;
            localZ = 128 - tmp;
        } else if (rotation === 2) {
            localZ = 128 - localZ;
            localX = 128 - localX;
        } else if (rotation === 3) {
            const tmp = localX;
            localX = 128 - localZ;
            localZ = tmp;
        }
        let nx: number, ny: number, nz: number, colour: number;
        if (localX === 0 && localZ === 0) {
            ny = arrayAtF32(arrayAtObj(normalY, x), z);
            nz = arrayAtF32(arrayAtObj(normalZ, x), z);
            nx = arrayAtF32(arrayAtObj(normalX, x), z);
            colour = colour00;
        } else if (localX === 128 && localZ === 0) {
            colour = colour10;
            ny = arrayAtF32(arrayAtObj(normalY, x + 1), z);
            nz = arrayAtF32(arrayAtObj(normalZ, x + 1), z);
            nx = arrayAtF32(arrayAtObj(normalX, x + 1), z);
        } else if (localX === 128 && localZ === 128) {
            nz = arrayAtF32(arrayAtObj(normalZ, x + 1), z + 1);
            nx = arrayAtF32(arrayAtObj(normalX, x + 1), z + 1);
            ny = arrayAtF32(arrayAtObj(normalY, x + 1), z + 1);
            colour = colour11;
        } else if (localX === 0 && localZ === 128) {
            nz = arrayAtF32(arrayAtObj(normalZ, x), z + 1);
            ny = arrayAtF32(arrayAtObj(normalY, x), z + 1);
            nx = arrayAtF32(arrayAtObj(normalX, x), z + 1);
            colour = colour01;
        } else {
            const f = Math.fround;
            nx = arrayAtF32(arrayAtObj(normalX, x), z);
            ny = arrayAtF32(arrayAtObj(normalY, x), z);
            const fz = f(localZ / 128);
            const fx = f(localX / 128);
            nx = f(nx + f(f(arrayAtF32(arrayAtObj(normalX, x + 1), z) - nx) * fx));
            ny = f(ny + f(f(-ny + arrayAtF32(arrayAtObj(normalY, x + 1), z)) * fx));
            let farX = arrayAtF32(arrayAtObj(normalX, x), z + 1);
            let farY = arrayAtF32(arrayAtObj(normalY, x), z + 1);
            farY = f(farY + f(f(-farY + arrayAtF32(arrayAtObj(normalY, x + 1), z + 1)) * fx));
            nz = arrayAtF32(arrayAtObj(normalZ, x), z);
            ny = f(ny + f(fz * f(-ny + farY)));
            let farZ = arrayAtF32(arrayAtObj(normalZ, x), z + 1);
            farX = f(farX + f(f(-farX + arrayAtF32(arrayAtObj(normalX, x + 1), z + 1)) * fx));
            nx = f(nx + f(fz * f(-nx + farX)));
            farZ = f(farZ + f(f(-farZ + arrayAtF32(arrayAtObj(normalZ, x + 1), z + 1)) * fx));
            nz = f(nz + f(f(-nz + arrayAtF32(arrayAtObj(normalZ, x + 1), z)) * fx));
            nz = f(nz + f(f(-nz + farZ) * fz));
            const near = TerrainBuilder.blendColours(localX, colour00, colour10);
            const far = TerrainBuilder.blendColours(localX, colour01, colour11);
            colour = TerrainBuilder.blendColours(localZ, near, far);
        }
        const vz = ((z << 7) + localZ) | 0;
        const y = TerrainBuilder.height(localX, z, heights, x, localZ);
        const vx = ((x << 7) + localX) | 0;
        return requireNonNull(batch).addVertex(vx, y, vz, nx, ny, nz, transparent ? colour & -256 : colour, surface === null ? 0 : Math.fround(Math.fround((y - TerrainBuilder.height(localX, z, surface, x, localZ)) | 0) / depthScale));
    }
    // HD ec.a
    static addUnderlayTile(
        surfaceHeights: Int32Array[] | null,
        filled00: boolean,
        rgb00: number,
        batch: TerrainBatch | null,
        shape: Int32Array,
        z: number,
        level: number,
        x: number,
        filled11: boolean,
        normalX: Float32Array[],
        filled01: boolean,
        divisor: number,
        normalY: Float32Array[],
        depthScale: number,
        rgb01: number,
        rgb11: number,
        filled10: boolean,
        heights: Int32Array[],
        normalZ: Float32Array[],
        rotation: number,
        rgb10: number,
        useSurface: boolean[] | null
    ): void {
        const var22 = ((rgb00 << 8) + (filled00 ? 255 : 0)) | 0;
        const var24 = ((!filled11 ? 0 : 255) + (rgb11 << 8)) | 0;
        const var26 = polygonIndices.allocate((shape.length / divisor) | 0);
        const var25 = ((filled01 ? 255 : 0) + (rgb01 << 8)) | 0;
        const var23 = ((rgb10 << 8) + (!filled10 ? 0 : 255)) | 0;
        for (let var27 = 0; var27 < var26.length; ++var27) {
            const var28 = arrayAtI32(shape, var27 + var27);
            const var30 = null !== surfaceHeights && useSurface !== null && arrayAtObj(useSurface, var27) ? surfaceHeights : heights;
            const var29 = arrayAtI32(shape, var27 + var27 + 1);
            arrayPutI32(var26, var27, TerrainBuilder.vertex(var25, depthScale, var22, var23, surfaceHeights, var30, x, normalZ, var24, rotation, false, batch, normalX, z, var28, normalY, var29));
        }
        requireNonNull(batch).addTile(level, x, z, var26, null, false);
    }
    // HD eh.a
    static addOverlayTile(
        rgb00: number,
        heights: Int32Array[],
        normalX: Float32Array[],
        x: number,
        normalY: Float32Array[],
        rgb10: number,
        rotation: number,
        level: number,
        rgb11: number,
        blend: boolean,
        shape: number,
        z: number,
        normalZ: Float32Array[],
        rgb01: number,
        batch: TerrainBatch
    ): void {
        const colour00 = (255 + (rgb00 << 8)) | 0;
        const colour10 = ((rgb10 << 8) + 255) | 0;
        const colour11 = ((rgb11 << 8) + 255) | 0;
        const colour01 = ((rgb01 << 8) + 255) | 0;
        const points = arrayAtObj(TerrainBuilder.overlayShapes, shape);
        const polygon = polygonIndices.allocate(points.length >> 1);
        for (let i = 0; i < polygon.length; ++i) {
            arrayPutI32(polygon, i, TerrainBuilder.vertex(colour01, 0, colour00, colour10, null, heights, x, normalZ, colour11, rotation, false, batch, normalX, z, arrayAtI32(points, i + i), normalY, arrayAtI32(points, i + i + 1)));
        }
        {
            let blendTriangles: Int32Array | null = null;
            if (blend) {
                if (1 === shape) {
                    const var28 = TerrainBuilder.vertex(colour01, 0, colour00, colour10, null, heights, x, normalZ, colour11, rotation, true, batch, normalX, z, 64, normalY, 128);
                    const var24 = TerrainBuilder.vertex(colour01, 0, colour00, colour10, null, heights, x, normalZ, colour11, rotation, true, batch, normalX, z, 128, normalY, 64);
                    blendTriangles = Int32Array.of(var24, var28, arrayAtI32(polygon, 2), var28, arrayAtI32(polygon, 0), arrayAtI32(polygon, 2));
                } else if (2 === shape) {
                    blendTriangles = polygonIndices.allocate(6);
                    const var29 = TerrainBuilder.vertex(colour01, 0, colour00, colour10, null, heights, x, normalZ, colour11, rotation, true, batch, normalX, z, 128, normalY, 128);
                    const var39 = TerrainBuilder.vertex(colour01, 0, colour00, colour10, null, heights, x, normalZ, colour11, rotation, true, batch, normalX, z, 64, normalY, 0);
                    arrayPutI32(blendTriangles, 2, var29);
                    arrayPutI32(blendTriangles, 0, arrayAtI32(polygon, 0));
                    arrayPutI32(blendTriangles, 5, arrayAtI32(polygon, 0));
                    arrayPutI32(blendTriangles, 3, var29);
                    arrayPutI32(blendTriangles, 1, var39);
                    arrayPutI32(blendTriangles, 4, arrayAtI32(polygon, 1));
                } else if (shape !== 3) {
                    if (shape === 4) {
                        blendTriangles = polygonIndices.allocate(3);
                        const var30 = TerrainBuilder.vertex(colour01, 0, colour00, colour10, null, heights, x, normalZ, colour11, rotation, true, batch, normalX, z, 0, normalY, 128);
                        arrayPutI32(blendTriangles, 0, arrayAtI32(polygon, 3));
                        arrayPutI32(blendTriangles, 2, arrayAtI32(polygon, 0));
                        arrayPutI32(blendTriangles, 1, var30);
                    } else if (shape !== 5) {
                        if (shape !== 6) {
                            if (shape === 7) {
                                blendTriangles = polygonIndices.allocate(6);
                                const var31 = TerrainBuilder.vertex(colour01, 0, colour00, colour10, null, heights, x, normalZ, colour11, rotation, true, batch, normalX, z, 0, normalY, 128);
                                const var40 = TerrainBuilder.vertex(colour01, 0, colour00, colour10, null, heights, x, normalZ, colour11, rotation, true, batch, normalX, z, 128, normalY, 0);
                                arrayPutI32(blendTriangles, 3, var31);
                                arrayPutI32(blendTriangles, 2, var31);
                                arrayPutI32(blendTriangles, 0, arrayAtI32(polygon, 1));
                                arrayPutI32(blendTriangles, 4, arrayAtI32(polygon, 2));
                                arrayPutI32(blendTriangles, 1, var40);
                                arrayPutI32(blendTriangles, 5, arrayAtI32(polygon, 1));
                            } else if (shape === 8) {
                                blendTriangles = polygonIndices.allocate(3);
                                const var32 = TerrainBuilder.vertex(colour01, 0, colour00, colour10, null, heights, x, normalZ, colour11, rotation, true, batch, normalX, z, 0, normalY, 0);
                                arrayPutI32(blendTriangles, 2, arrayAtI32(polygon, 4));
                                arrayPutI32(blendTriangles, 0, arrayAtI32(polygon, 3));
                                arrayPutI32(blendTriangles, 1, var32);
                            } else if (shape === 9) {
                                const var33 = TerrainBuilder.vertex(colour01, 0, colour00, colour10, null, heights, x, normalZ, colour11, rotation, true, batch, normalX, z, 128, normalY, 64);
                                const var41 = TerrainBuilder.vertex(colour01, 0, colour00, colour10, null, heights, x, normalZ, colour11, rotation, true, batch, normalX, z, 96, normalY, 32);
                                const var25 = TerrainBuilder.vertex(colour01, 0, colour00, colour10, null, heights, x, normalZ, colour11, rotation, true, batch, normalX, z, 64, normalY, 0);
                                blendTriangles = Int32Array.of(
                                    var41,
                                    var33,
                                    arrayAtI32(polygon, 4),
                                    var41,
                                    arrayAtI32(polygon, 4),
                                    arrayAtI32(polygon, 3),
                                    var41,
                                    arrayAtI32(polygon, 3),
                                    arrayAtI32(polygon, 2),
                                    var41,
                                    arrayAtI32(polygon, 2),
                                    arrayAtI32(polygon, 1),
                                    var41,
                                    arrayAtI32(polygon, 1),
                                    var25
                                );
                            } else if (10 !== shape) {
                                if (11 === shape) {
                                    blendTriangles = polygonIndices.allocate(12);
                                    const var34 = TerrainBuilder.vertex(colour01, 0, colour00, colour10, null, heights, x, normalZ, colour11, rotation, true, batch, normalX, z, 0, normalY, 64);
                                    const var42 = TerrainBuilder.vertex(colour01, 0, colour00, colour10, null, heights, x, normalZ, colour11, rotation, true, batch, normalX, z, 128, normalY, 64);
                                    arrayPutI32(blendTriangles, 5, var34);
                                    arrayPutI32(blendTriangles, 1, var34);
                                    arrayPutI32(blendTriangles, 8, var34);
                                    arrayPutI32(blendTriangles, 0, arrayAtI32(polygon, 3));
                                    arrayPutI32(blendTriangles, 2, arrayAtI32(polygon, 0));
                                    arrayPutI32(blendTriangles, 11, var42);
                                    arrayPutI32(blendTriangles, 6, arrayAtI32(polygon, 2));
                                    arrayPutI32(blendTriangles, 7, var42);
                                    arrayPutI32(blendTriangles, 10, arrayAtI32(polygon, 1));
                                    arrayPutI32(blendTriangles, 3, arrayAtI32(polygon, 3));
                                    arrayPutI32(blendTriangles, 4, arrayAtI32(polygon, 2));
                                    arrayPutI32(blendTriangles, 9, arrayAtI32(polygon, 2));
                                }
                            } else {
                                blendTriangles = polygonIndices.allocate(9);
                                const var35 = TerrainBuilder.vertex(colour01, 0, colour00, colour10, null, heights, x, normalZ, colour11, rotation, true, batch, normalX, z, 0, normalY, 128);
                                arrayPutI32(blendTriangles, 0, arrayAtI32(polygon, 2));
                                arrayPutI32(blendTriangles, 8, arrayAtI32(polygon, 0));
                                arrayPutI32(blendTriangles, 1, var35);
                                arrayPutI32(blendTriangles, 4, var35);
                                arrayPutI32(blendTriangles, 2, arrayAtI32(polygon, 3));
                                arrayPutI32(blendTriangles, 7, var35);
                                arrayPutI32(blendTriangles, 3, arrayAtI32(polygon, 3));
                                arrayPutI32(blendTriangles, 5, arrayAtI32(polygon, 4));
                                arrayPutI32(blendTriangles, 6, arrayAtI32(polygon, 4));
                            }
                        } else {
                            blendTriangles = polygonIndices.allocate(6);
                            const var36 = TerrainBuilder.vertex(colour01, 0, colour00, colour10, null, heights, x, normalZ, colour11, rotation, true, batch, normalX, z, 128, normalY, 0);
                            const var43 = TerrainBuilder.vertex(colour01, 0, colour00, colour10, null, heights, x, normalZ, colour11, rotation, true, batch, normalX, z, 128, normalY, 128);
                            arrayPutI32(blendTriangles, 1, var36);
                            arrayPutI32(blendTriangles, 0, arrayAtI32(polygon, 3));
                            arrayPutI32(blendTriangles, 2, var43);
                            arrayPutI32(blendTriangles, 4, arrayAtI32(polygon, 0));
                            arrayPutI32(blendTriangles, 3, var43);
                            arrayPutI32(blendTriangles, 5, arrayAtI32(polygon, 3));
                        }
                    } else {
                        blendTriangles = polygonIndices.allocate(3);
                        const var37 = TerrainBuilder.vertex(colour01, 0, colour00, colour10, null, heights, x, normalZ, colour11, rotation, true, batch, normalX, z, 128, normalY, 128);
                        arrayPutI32(blendTriangles, 1, var37);
                        arrayPutI32(blendTriangles, 0, arrayAtI32(polygon, 2));
                        arrayPutI32(blendTriangles, 2, arrayAtI32(polygon, 3));
                    }
                } else {
                    blendTriangles = polygonIndices.allocate(6);
                    const var38 = TerrainBuilder.vertex(colour01, 0, colour00, colour10, null, heights, x, normalZ, colour11, rotation, true, batch, normalX, z, 0, normalY, 128);
                    const var44 = TerrainBuilder.vertex(colour01, 0, colour00, colour10, null, heights, x, normalZ, colour11, rotation, true, batch, normalX, z, 64, normalY, 0);
                    arrayPutI32(blendTriangles, 4, var44);
                    arrayPutI32(blendTriangles, 1, arrayAtI32(polygon, 1));
                    arrayPutI32(blendTriangles, 0, arrayAtI32(polygon, 2));
                    arrayPutI32(blendTriangles, 3, var38);
                    arrayPutI32(blendTriangles, 2, var38);
                    arrayPutI32(blendTriangles, 5, arrayAtI32(polygon, 2));
                }
            }
            batch.addTile(level, x, z, polygon, blendTriangles, false);
        }
    }
    // HD pi.a
    static buildUnderlays(
        flags: Uint8Array[][] | null,
        shapes: Uint8Array[],
        underlays: Uint8Array[],
        lighting: Int32Array[],
        normalY: Float32Array[],
        waterColours: Int32Array[] | null,
        overlays: Uint8Array[],
        rotations: Uint8Array[],
        normalX: Float32Array[],
        level: number,
        normalZ: Float32Array[],
        hsl: Int32Array[],
        heights: Int32Array[],
        surfaceHeights: Int32Array[] | null
    ): TerrainBatch[] {
        const materials = Array.from({ length: 105 }, () => new Int32Array(105));
        for (let x = 1; x <= 103; ++x) {
            for (let z = 1; z <= 103; ++z) {
                let underlayId = (arrayAtU8(arrayAtObj(underlays, x), z) << 24) >> 24;
                if (underlayId === 0) {
                    underlayId = (arrayAtU8(arrayAtObj(underlays, x - 1), z) << 24) >> 24;
                }
                if (underlayId === 0) {
                    underlayId = (arrayAtU8(arrayAtObj(underlays, x), -1 + z) << 24) >> 24;
                }
                if (0 === underlayId) {
                    underlayId = (arrayAtU8(arrayAtObj(underlays, -1 + x), z - 1) << 24) >> 24;
                }
                if (0 !== underlayId) {
                    const underlay = FluType.List(-1 + (255 & underlayId));
                    arrayPutI32(arrayAtObj(materials, x), z, ((1 + underlay.m_materialID) << 16) + underlay.m_textureScale);
                }
            }
        }
        const batches = new HashTable<TerrainBatch>(128);
        for (let tileX = 1; 102 >= tileX; ++tileX) {
            for (let tileZ = 1; 102 >= tileZ; ++tileZ) {
                if (0 !== (arrayAtU8(arrayAtObj(underlays, tileX), tileZ) << 24) >> 24) {
                    let shapePoints: Int32Array;
                    if (0 === (arrayAtU8(arrayAtObj(overlays, tileX), tileZ) << 24) >> 24) {
                        shapePoints = arrayAtObj(TerrainBuilder.overlayShapes, 0);
                    } else {
                        shapePoints = arrayAtObj(TerrainBuilder.underlayShapes, (arrayAtU8(arrayAtObj(shapes, tileX), tileZ) << 24) >> 24);
                        if (0 === shapePoints.length) {
                            continue;
                        }
                    }
                    let waterColour = 0;
                    const material00 = arrayAtI32(arrayAtObj(materials, tileX), tileZ);
                    const material10 = arrayAtI32(arrayAtObj(materials, tileX + 1), tileZ);
                    if (null !== waterColours) {
                        waterColour = arrayAtI32(arrayAtObj(waterColours, tileX), tileZ) & 16777215;
                    }
                    const key10 = materialKey(material10, waterColour);
                    const material01 = arrayAtI32(arrayAtObj(materials, tileX), tileZ + 1);
                    const material11 = arrayAtI32(arrayAtObj(materials, tileX + 1), tileZ + 1);
                    const key01 = materialKey(material01, waterColour);
                    const pointCount = (shapePoints.length / 2) | 0;
                    const key00 = materialKey(material00, waterColour);
                    let batch: TerrainBatch | null = batches.get(key00, waterColour);
                    if (null === batch) {
                        batch = new TerrainBatch(-1 + (material00 >> 16), 65535 & material00, false, null !== surfaceHeights, waterColour);
                        batches.put(batch, key00, waterColour);
                    }
                    ++batch.tileCapacity;
                    batch.vertexCapacity += pointCount;
                    if (key10 !== key00) {
                        batch = batches.get(key10, waterColour);
                        if (batch === null) {
                            batch = new TerrainBatch((material10 >> 16) - 1, 65535 & material10, false, null !== surfaceHeights, waterColour);
                            batches.put(batch, key10, waterColour);
                        }
                        ++batch.tileCapacity;
                        batch.vertexCapacity += pointCount;
                    }
                    const key11 = materialKey(material11, waterColour);
                    if (key11 !== key00 && key11 !== key10) {
                        batch = batches.get(key11, waterColour);
                        if (batch === null) {
                            batch = new TerrainBatch((material11 >> 16) - 1, 65535 & material11, false, null !== surfaceHeights, waterColour);
                            batches.put(batch, key11, waterColour);
                        }
                        batch.vertexCapacity += pointCount;
                        ++batch.tileCapacity;
                    }
                    if (key01 !== key00 && key10 !== key01 && key01 !== key11) {
                        batch = batches.get(key01, waterColour);
                        if (null === batch) {
                            batch = new TerrainBatch((material01 >> 16) - 1, material01 & 65535, false, null !== surfaceHeights, waterColour);
                            batches.put(batch, key01, waterColour);
                        }
                        ++batch.tileCapacity;
                        batch.vertexCapacity += pointCount;
                    }
                }
            }
        }
        for (let batch: TerrainBatch | null = batches.head(); batch !== null; batch = batches.next()) {
            batch.allocate();
        }
        for (let x = 1; 102 >= x; ++x) {
            for (let z = 1; 102 >= z; ++z) {
                const underlayId = (arrayAtU8(arrayAtObj(underlays, x), z) << 24) >> 24;
                if (0 !== underlayId) {
                    let drawLevel: number;
                    if ((8 & ((arrayAtU8(arrayAtObj(arrayAtObj(flags, level), x), z) << 24) >> 24)) === 0) {
                        if ((2 & ((arrayAtU8(arrayAtObj(arrayAtObj(flags, 1), x), z) << 24) >> 24)) === 2 && 0 < level) {
                            drawLevel = level - 1;
                        } else {
                            drawLevel = level;
                        }
                    } else {
                        drawLevel = 0;
                    }
                    let waterColour = 0;
                    let useSurface: boolean[] | null = null;
                    let depthScale = 128;
                    if (null !== waterColours) {
                        depthScale = (arrayAtI32(arrayAtObj(waterColours, x), z) >>> 24) << 3;
                        waterColour = 16777215 & arrayAtI32(arrayAtObj(waterColours, x), z);
                    }
                    let shape: Int32Array;
                    let rotation: number;
                    if ((arrayAtU8(arrayAtObj(overlays, x), z) << 24) >> 24 !== 0) {
                        shape = arrayAtObj(TerrainBuilder.underlayShapes, (arrayAtU8(arrayAtObj(shapes, x), z) << 24) >> 24);
                        useSurface = arrayAtObj(TerrainBuilder.useSurfaceHeight, (arrayAtU8(arrayAtObj(shapes, x), z) << 24) >> 24);
                        rotation = (arrayAtU8(arrayAtObj(rotations, x), z) << 24) >> 24;
                        if (shape.length === 0) {
                            continue;
                        }
                    } else {
                        let var26 = 0;
                        var26 += underlayId !== (arrayAtU8(arrayAtObj(underlays, x - 1), -1 + z) << 24) >> 24 ? -1 : 1;
                        let var76 = 0;
                        shape = arrayAtObj(TerrainBuilder.overlayShapes, 0);
                        var76 += underlayId === (arrayAtU8(arrayAtObj(underlays, 1 + x), z - 1) << 24) >> 24 ? 1 : -1;
                        if ((arrayAtU8(arrayAtObj(underlays, x), z - 1) << 24) >> 24 !== underlayId) {
                            --var26;
                            --var76;
                        } else {
                            ++var76;
                            ++var26;
                        }
                        let var28 = 0;
                        var28 += underlayId === (arrayAtU8(arrayAtObj(underlays, 1 + x), 1 + z) << 24) >> 24 ? 1 : -1;
                        let var85 = 0;
                        if (underlayId !== (arrayAtU8(arrayAtObj(underlays, 1 + x), z) << 24) >> 24) {
                            --var76;
                            --var28;
                        } else {
                            ++var28;
                            ++var76;
                        }
                        var85 += underlayId === (arrayAtU8(arrayAtObj(underlays, x - 1), 1 + z) << 24) >> 24 ? 1 : -1;
                        if ((arrayAtU8(arrayAtObj(underlays, x), 1 + z) << 24) >> 24 === underlayId) {
                            ++var85;
                            ++var28;
                        } else {
                            --var28;
                            --var85;
                        }
                        if ((arrayAtU8(arrayAtObj(underlays, -1 + x), z) << 24) >> 24 !== underlayId) {
                            --var85;
                            --var26;
                        } else {
                            ++var85;
                            ++var26;
                        }
                        let var30 = (var26 - var28) | 0;
                        let var91 = (-var85 + var76) | 0;
                        if (var91 < 0) {
                            var91 = -var91;
                        }
                        if (0 > var30) {
                            var30 = -var30;
                        }
                        rotation = var91 <= var30 ? 0 : 1;
                        arrayPutU8(arrayAtObj(rotations, x), z, rotation);
                    }
                    const material00 = arrayAtI32(arrayAtObj(materials, x), z);
                    const material10 = arrayAtI32(arrayAtObj(materials, x + 1), z);
                    const material11 = arrayAtI32(arrayAtObj(materials, x + 1), z + 1);
                    const key00 = materialKey(material00, waterColour);
                    const key10 = materialKey(material10, waterColour);
                    const key11 = materialKey(material11, waterColour);
                    const hsl00 = arrayAtI32(arrayAtObj(hsl, x), z);
                    const material01 = arrayAtI32(arrayAtObj(materials, x), z + 1);
                    const hsl11 = arrayAtI32(arrayAtObj(hsl, x + 1), z + 1);
                    const hsl10 = arrayAtI32(arrayAtObj(hsl, 1 + x), z);
                    const key01 = materialKey(material01, waterColour);
                    const hsl01 = arrayAtI32(arrayAtObj(hsl, x), z + 1);
                    const light00 = arrayAtI32(arrayAtObj(lighting, x), z);
                    const light10 = arrayAtI32(arrayAtObj(lighting, x + 1), z);
                    const light11 = arrayAtI32(arrayAtObj(lighting, x + 1), z + 1);
                    const light01 = arrayAtI32(arrayAtObj(lighting, x), 1 + z);
                    const texture10 = (-1 + (material10 >> 16)) | 0;
                    const texture00 = ((material00 >> 16) - 1) | 0;
                    const texture11 = ((material11 >> 16) - 1) | 0;
                    let batch = batches.get(key00, waterColour);
                    TerrainBuilder.addUnderlayTile(
                        surfaceHeights,
                        true,
                        TerrainBuilder.colour(texture00, hsl00, light00),
                        batch,
                        shape,
                        z,
                        drawLevel,
                        x,
                        material00 <= material11,
                        normalX,
                        material01 >= material00,
                        2,
                        normalY,
                        depthScale,
                        TerrainBuilder.colour(texture00, hsl01, light01),
                        TerrainBuilder.colour(texture00, hsl11, light11),
                        material00 <= material10,
                        heights,
                        normalZ,
                        rotation,
                        TerrainBuilder.colour(texture00, hsl10, light10),
                        useSurface
                    );
                    const texture01 = ((material01 >> 16) - 1) | 0;
                    if (key10 !== key00) {
                        batch = batches.get(key10, waterColour);
                        TerrainBuilder.addUnderlayTile(
                            surfaceHeights,
                            material10 <= material00,
                            TerrainBuilder.colour(texture10, hsl00, light00),
                            batch,
                            shape,
                            z,
                            drawLevel,
                            x,
                            material11 >= material10,
                            normalX,
                            material10 <= material01,
                            2,
                            normalY,
                            depthScale,
                            TerrainBuilder.colour(texture10, hsl01, light01),
                            TerrainBuilder.colour(texture10, hsl11, light11),
                            true,
                            heights,
                            normalZ,
                            rotation,
                            TerrainBuilder.colour(texture10, hsl10, light10),
                            useSurface
                        );
                    }
                    if (key11 !== key00 && key11 !== key10) {
                        batch = batches.get(key11, waterColour);
                        TerrainBuilder.addUnderlayTile(
                            surfaceHeights,
                            material00 >= material11,
                            TerrainBuilder.colour(texture11, hsl00, light00),
                            batch,
                            shape,
                            z,
                            drawLevel,
                            x,
                            true,
                            normalX,
                            material11 <= material01,
                            2,
                            normalY,
                            depthScale,
                            TerrainBuilder.colour(texture11, hsl01, light01),
                            TerrainBuilder.colour(texture11, hsl11, light11),
                            material10 >= material11,
                            heights,
                            normalZ,
                            rotation,
                            TerrainBuilder.colour(texture11, hsl10, light10),
                            useSurface
                        );
                    }
                    if (key01 !== key00 && key01 !== key10 && key01 !== key11) {
                        batch = batches.get(key01, waterColour);
                        TerrainBuilder.addUnderlayTile(
                            surfaceHeights,
                            material01 <= material00,
                            TerrainBuilder.colour(texture01, hsl00, light00),
                            batch,
                            shape,
                            z,
                            drawLevel,
                            x,
                            material01 <= material11,
                            normalX,
                            true,
                            2,
                            normalY,
                            depthScale,
                            TerrainBuilder.colour(texture01, hsl01, light01),
                            TerrainBuilder.colour(texture01, hsl11, light11),
                            material10 >= material01,
                            heights,
                            normalZ,
                            rotation,
                            TerrainBuilder.colour(texture01, hsl10, light10),
                            useSurface
                        );
                    }
                }
            }
        }
        for (let built: TerrainBatch | null = batches.head(); built !== null; built = batches.next()) {
            if (built.vertexCount !== 0) {
                built.upload();
            } else {
                built.Unlink();
            }
        }
        const batchCount = batches.size();
        const sortedBatches = new Array<TerrainBatch>(batchCount);
        TerrainBuilder.copyBatches(batches, sortedBatches);
        const keys = new BigInt64Array(batchCount);
        for (let i = 0; batchCount > i; ++i) {
            arrayPutB64(keys, i, arrayAtObj(sortedBatches, i).key);
        }
        TerrainBuilder.sort(keys, sortedBatches);
        return sortedBatches;
    }
    // HD a.a
    static buildOverlays(
        normalY: Float32Array[],
        normalX: Float32Array[],
        heights: Int32Array[],
        level: number,
        normalZ: Float32Array[],
        rotations: Uint8Array[],
        lighting: Int32Array[],
        shapes: Uint8Array[],
        underlays: Uint8Array[],
        overlays: Uint8Array[],
        flags: Uint8Array[][] | null
    ): TerrainBatch[] {
        const batches = new HashTable<TerrainBatch>(128);
        // Both passes write each tile's unique neighbours into the prefix [0, neighbourCount).
        const neighbours = new Int32Array(8);
        for (let tileX = 1; tileX <= 102; ++tileX) {
            for (let tileZ = 1; tileZ <= 102; ++tileZ) {
                const underlayId = ((arrayAtU8(arrayAtObj(underlays, tileX), tileZ) << 24) >> 24) & 255;
                const overlayId = 255 & ((arrayAtU8(arrayAtObj(overlays, tileX), tileZ) << 24) >> 24);
                if (overlayId !== 0) {
                    const overlay = FloType.List(-1 + overlayId);
                    if (overlay.colour === -1) {
                        continue;
                    }
                    const batch = TerrainBuilder.getOverlayBatch(batches, overlay);
                    const shape = (arrayAtU8(arrayAtObj(shapes, tileX), tileZ) << 24) >> 24;
                    const shapePoints = arrayAtObj(TerrainBuilder.overlayShapes, shape);
                    batch.vertexCapacity += (shapePoints.length / 2) | 0;
                    ++batch.tileCapacity;
                    if (overlay.m_hasSmoothEdges && underlayId !== 0) {
                        batch.vertexCapacity += arrayAtI32(TerrainBuilder.blendVertexCounts, shape);
                    }
                }
                if (0 !== (((arrayAtU8(arrayAtObj(underlays, tileX), tileZ) << 24) >> 24) & 255) || (overlayId !== 0 && (arrayAtU8(arrayAtObj(shapes, tileX), tileZ) << 24) >> 24 === 0)) {
                    let neighbourCount = 0;
                    let northEdge = 0;
                    let southEdge = 0;
                    let westEdge = 0;
                    const north = 255 & ((arrayAtU8(arrayAtObj(overlays, tileX), 1 + tileZ) << 24) >> 24);
                    const south = ((arrayAtU8(arrayAtObj(overlays, tileX), tileZ - 1) << 24) >> 24) & 255;
                    const west = ((arrayAtU8(arrayAtObj(overlays, -1 + tileX), tileZ) << 24) >> 24) & 255;
                    let eastEdge = 0;
                    let northWest = 255 & ((arrayAtU8(arrayAtObj(overlays, tileX - 1), 1 + tileZ) << 24) >> 24);
                    const east = ((arrayAtU8(arrayAtObj(overlays, tileX + 1), tileZ) << 24) >> 24) & 255;
                    let southEast = 255 & ((arrayAtU8(arrayAtObj(overlays, tileX + 1), -1 + tileZ) << 24) >> 24);
                    let southWest = ((arrayAtU8(arrayAtObj(overlays, tileX - 1), -1 + tileZ) << 24) >> 24) & 255;
                    let northEast = ((arrayAtU8(arrayAtObj(overlays, 1 + tileX), tileZ + 1) << 24) >> 24) & 255;
                    if (0 !== northWest && overlayId !== northWest) {
                        const var31 = FloType.List(-1 + northWest);
                        if (var31.m_hasSmoothEdges && var31.colour !== -1) {
                            const var32 = (arrayAtU8(arrayAtObj(rotations, tileX - 1), tileZ + 1) << 24) >> 24;
                            const var33 = (arrayAtU8(arrayAtObj(shapes, -1 + tileX), tileZ + 1) << 24) >> 24;
                            const var34 = arrayAtI32(TerrainBuilder.shapeEdges, 4 * var33 + ((2 + var32) & 3));
                            const var35 = arrayAtI32(TerrainBuilder.shapeEdges, ((3 + var32) & 3) + 4 * var33);
                            if (!arrayAtObj(arrayAtObj(TerrainBuilder.edgeVertices, var35), 1) || !arrayAtObj(arrayAtObj(TerrainBuilder.edgeVertices, var34), 0)) {
                                for (let var36 = 0; 8 > var36; ++var36) {
                                    if (var36 === neighbourCount) {
                                        arrayPutI32(neighbours, neighbourCount++, northWest);
                                        break;
                                    }
                                    if (northWest === arrayAtI32(neighbours, var36)) {
                                        break;
                                    }
                                }
                            } else {
                                northWest = 0;
                            }
                        } else {
                            northWest = 0;
                        }
                    } else {
                        northWest = 0;
                    }
                    if (0 !== southWest && southWest !== overlayId) {
                        const var105 = FloType.List(-1 + southWest);
                        if (var105.m_hasSmoothEdges && -1 !== var105.colour) {
                            const var114 = (arrayAtU8(arrayAtObj(rotations, -1 + tileX), tileZ - 1) << 24) >> 24;
                            const var131 = (arrayAtU8(arrayAtObj(shapes, -1 + tileX), -1 + tileZ) << 24) >> 24;
                            const var144 = arrayAtI32(TerrainBuilder.shapeEdges, var131 * 4 + (var114 & 3));
                            const var153 = arrayAtI32(TerrainBuilder.shapeEdges, ((var114 + 3) & 3) + var131 * 4);
                            if (arrayAtObj(arrayAtObj(TerrainBuilder.edgeVertices, var144), 1) && arrayAtObj(arrayAtObj(TerrainBuilder.edgeVertices, var153), 0)) {
                                southWest = 0;
                            } else {
                                for (let var162 = 0; var162 < 8; ++var162) {
                                    if (neighbourCount === var162) {
                                        arrayPutI32(neighbours, neighbourCount++, southWest);
                                        break;
                                    }
                                    if (arrayAtI32(neighbours, var162) === southWest) {
                                        break;
                                    }
                                }
                            }
                        } else {
                            southWest = 0;
                        }
                    } else {
                        southWest = 0;
                    }
                    if (0 !== southEast && overlayId !== southEast) {
                        const var106 = FloType.List(southEast - 1);
                        if (var106.m_hasSmoothEdges && var106.colour !== -1) {
                            const var115 = (arrayAtU8(arrayAtObj(rotations, 1 + tileX), tileZ - 1) << 24) >> 24;
                            const var132 = (arrayAtU8(arrayAtObj(shapes, tileX + 1), tileZ - 1) << 24) >> 24;
                            const var154 = arrayAtI32(TerrainBuilder.shapeEdges, 4 * var132 + (3 & (1 + var115)));
                            const var145 = arrayAtI32(TerrainBuilder.shapeEdges, var132 * 4 + (var115 & 3));
                            if (!arrayAtObj(arrayAtObj(TerrainBuilder.edgeVertices, var154), 1) || !arrayAtObj(arrayAtObj(TerrainBuilder.edgeVertices, var145), 0)) {
                                for (let var163 = 0; var163 < 8; ++var163) {
                                    if (neighbourCount === var163) {
                                        arrayPutI32(neighbours, neighbourCount++, southEast);
                                        break;
                                    }
                                    if (southEast === arrayAtI32(neighbours, var163)) {
                                        break;
                                    }
                                }
                            } else {
                                southEast = 0;
                            }
                        } else {
                            southEast = 0;
                        }
                    } else {
                        southEast = 0;
                    }
                    if (northEast !== 0 && northEast !== overlayId) {
                        const var107 = FloType.List(northEast - 1);
                        if (var107.m_hasSmoothEdges && -1 !== var107.colour) {
                            const var116 = (arrayAtU8(arrayAtObj(rotations, tileX + 1), 1 + tileZ) << 24) >> 24;
                            const var133 = (arrayAtU8(arrayAtObj(shapes, tileX + 1), 1 + tileZ) << 24) >> 24;
                            const var155 = arrayAtI32(TerrainBuilder.shapeEdges, 4 * var133 + ((var116 + 1) & 3));
                            const var146 = arrayAtI32(TerrainBuilder.shapeEdges, var133 * 4 + ((var116 + 2) & 3));
                            if (!arrayAtObj(arrayAtObj(TerrainBuilder.edgeVertices, var146), 1) || !arrayAtObj(arrayAtObj(TerrainBuilder.edgeVertices, var155), 0)) {
                                for (let var164 = 0; var164 < 8; ++var164) {
                                    if (neighbourCount === var164) {
                                        arrayPutI32(neighbours, neighbourCount++, northEast);
                                        break;
                                    }
                                    if (northEast === arrayAtI32(neighbours, var164)) {
                                        break;
                                    }
                                }
                            } else {
                                northEast = 0;
                            }
                        } else {
                            northEast = 0;
                        }
                    } else {
                        northEast = 0;
                    }
                    if (0 !== north && overlayId !== north) {
                        const var108 = FloType.List(-1 + north);
                        if (var108.m_hasSmoothEdges && var108.colour !== -1) {
                            northEdge = arrayAtI32(TerrainBuilder.shapeEdges, 4 * ((arrayAtU8(arrayAtObj(shapes, tileX), tileZ + 1) << 24) >> 24) + ((((arrayAtU8(arrayAtObj(rotations, tileX), tileZ + 1) << 24) >> 24) + 2) & 3));
                            for (let var117 = 0; var117 < 8; ++var117) {
                                if (neighbourCount === var117) {
                                    arrayPutI32(neighbours, neighbourCount++, north);
                                    break;
                                }
                                if (arrayAtI32(neighbours, var117) === north) {
                                    break;
                                }
                            }
                        }
                    }
                    if (0 !== west && overlayId !== west) {
                        const var109 = FloType.List(west - 1);
                        if (var109.m_hasSmoothEdges && var109.colour !== -1) {
                            westEdge = arrayAtI32(TerrainBuilder.shapeEdges, (3 & (3 + ((arrayAtU8(arrayAtObj(rotations, tileX - 1), tileZ) << 24) >> 24))) + ((arrayAtU8(arrayAtObj(shapes, tileX - 1), tileZ) << 24) >> 24) * 4);
                            for (let var118 = 0; 8 > var118; ++var118) {
                                if (neighbourCount === var118) {
                                    arrayPutI32(neighbours, neighbourCount++, west);
                                    break;
                                }
                                if (west === arrayAtI32(neighbours, var118)) {
                                    break;
                                }
                            }
                        }
                    }
                    if (0 !== south && overlayId !== south) {
                        const var110 = FloType.List(-1 + south);
                        if (var110.m_hasSmoothEdges && var110.colour !== -1) {
                            southEdge = arrayAtI32(TerrainBuilder.shapeEdges, (3 & ((arrayAtU8(arrayAtObj(rotations, tileX), tileZ - 1) << 24) >> 24)) + ((arrayAtU8(arrayAtObj(shapes, tileX), tileZ - 1) << 24) >> 24) * 4);
                            for (let var119 = 0; var119 < 8; ++var119) {
                                if (var119 === neighbourCount) {
                                    arrayPutI32(neighbours, neighbourCount++, south);
                                    break;
                                }
                                if (south === arrayAtI32(neighbours, var119)) {
                                    break;
                                }
                            }
                        }
                    }
                    if (0 !== east && overlayId !== east) {
                        const var111 = FloType.List(east - 1);
                        if (var111.m_hasSmoothEdges && var111.colour !== -1) {
                            eastEdge = arrayAtI32(TerrainBuilder.shapeEdges, (3 & (((arrayAtU8(arrayAtObj(rotations, tileX + 1), tileZ) << 24) >> 24) + 1)) + 4 * ((arrayAtU8(arrayAtObj(shapes, 1 + tileX), tileZ) << 24) >> 24));
                            for (let var120 = 0; var120 < 8; ++var120) {
                                if (neighbourCount === var120) {
                                    arrayPutI32(neighbours, neighbourCount++, east);
                                    break;
                                }
                                if (arrayAtI32(neighbours, var120) === east) {
                                    break;
                                }
                            }
                        }
                    }
                    for (let var112 = 0; neighbourCount > var112; ++var112) {
                        const neighbourId = arrayAtI32(neighbours, var112);
                        const westVertices: boolean[] = arrayAtObj(TerrainBuilder.edgeVertices, west !== neighbourId ? 0 : westEdge);
                        const southVertices: boolean[] = arrayAtObj(TerrainBuilder.edgeVertices, neighbourId !== south ? 0 : southEdge);
                        const northVertices: boolean[] = arrayAtObj(TerrainBuilder.edgeVertices, north === neighbourId ? northEdge : 0);
                        const eastVertices: boolean[] = arrayAtObj(TerrainBuilder.edgeVertices, east === neighbourId ? eastEdge : 0);
                        const neighbour = FloType.List(-1 + neighbourId);
                        const neighbourBatch = TerrainBuilder.getOverlayBatch(batches, neighbour);
                        neighbourBatch.vertexCapacity += 5;
                        neighbourBatch.vertexCapacity += -2 + northVertices.length;
                        neighbourBatch.vertexCapacity += -2 + westVertices.length;
                        neighbourBatch.vertexCapacity += southVertices.length - 2;
                        neighbourBatch.vertexCapacity += -2 + eastVertices.length;
                        ++neighbourBatch.tileCapacity;
                    }
                }
            }
        }
        for (let batch: TerrainBatch | null = batches.head(); null !== batch; batch = batches.next()) {
            batch.allocate();
        }
        for (let x = 1; 102 >= x; ++x) {
            for (let z = 1; z <= 102; ++z) {
                const underlayId = 255 & ((arrayAtU8(arrayAtObj(underlays, x), z) << 24) >> 24);
                const overlayId = 255 & ((arrayAtU8(arrayAtObj(overlays, x), z) << 24) >> 24);
                let drawLevel: number;
                if ((8 & ((arrayAtU8(arrayAtObj(arrayAtObj(flags, level), x), z) << 24) >> 24)) !== 0) {
                    drawLevel = 0;
                } else if (2 === (((arrayAtU8(arrayAtObj(arrayAtObj(flags, 1), x), z) << 24) >> 24) & 2) && level > 0) {
                    drawLevel = level - 1;
                } else {
                    drawLevel = level;
                }
                if (0 !== overlayId) {
                    const overlay = FloType.List(-1 + overlayId);
                    if (overlay.colour === -1) {
                        continue;
                    }
                    const batch = TerrainBuilder.getOverlayBatch(batches, overlay);
                    const shape = (arrayAtU8(arrayAtObj(shapes, x), z) << 24) >> 24;
                    const rotation = (arrayAtU8(arrayAtObj(rotations, x), z) << 24) >> 24;
                    const var80 = TerrainBuilder.colour(overlay.m_materialID, overlay.colour, arrayAtI32(arrayAtObj(lighting, x), z));
                    const var82 = TerrainBuilder.colour(overlay.m_materialID, overlay.colour, arrayAtI32(arrayAtObj(lighting, x + 1), z));
                    const var84 = TerrainBuilder.colour(overlay.m_materialID, overlay.colour, arrayAtI32(arrayAtObj(lighting, 1 + x), z + 1));
                    const var86 = TerrainBuilder.colour(overlay.m_materialID, overlay.colour, arrayAtI32(arrayAtObj(lighting, x), z + 1));
                    TerrainBuilder.addOverlayTile(var80, heights, normalX, x, normalY, var82, rotation, drawLevel, var84, underlayId !== 0 && overlay.m_hasSmoothEdges, shape, z, normalZ, var86, batch);
                }
                if ((((arrayAtU8(arrayAtObj(underlays, x), z) << 24) >> 24) & 255) !== 0 || (overlayId !== 0 && 0 === (arrayAtU8(arrayAtObj(shapes, x), z) << 24) >> 24)) {
                    let northEdge = 0;
                    let neighbourCount = 0;
                    let westEdge = 0;
                    let southEdge = 0;
                    const north = ((arrayAtU8(arrayAtObj(overlays, x), z + 1) << 24) >> 24) & 255;
                    let eastEdge = 0;
                    const west = ((arrayAtU8(arrayAtObj(overlays, -1 + x), z) << 24) >> 24) & 255;
                    const east = ((arrayAtU8(arrayAtObj(overlays, 1 + x), z) << 24) >> 24) & 255;
                    const south = ((arrayAtU8(arrayAtObj(overlays, x), -1 + z) << 24) >> 24) & 255;
                    let northWest = 255 & ((arrayAtU8(arrayAtObj(overlays, -1 + x), z + 1) << 24) >> 24);
                    let southWest = 255 & ((arrayAtU8(arrayAtObj(overlays, x - 1), z - 1) << 24) >> 24);
                    let southEast = 255 & ((arrayAtU8(arrayAtObj(overlays, 1 + x), z - 1) << 24) >> 24);
                    let northEast = ((arrayAtU8(arrayAtObj(overlays, 1 + x), z + 1) << 24) >> 24) & 255;
                    if (0 !== northWest && northWest !== overlayId) {
                        const var122 = FloType.List(-1 + northWest);
                        if (var122.m_hasSmoothEdges && var122.colour !== -1) {
                            const var135 = (arrayAtU8(arrayAtObj(rotations, x - 1), 1 + z) << 24) >> 24;
                            const var148 = (arrayAtU8(arrayAtObj(shapes, -1 + x), 1 + z) << 24) >> 24;
                            const var157 = arrayAtI32(TerrainBuilder.shapeEdges, 4 * var148 + ((2 + var135) & 3));
                            const var166 = arrayAtI32(TerrainBuilder.shapeEdges, var148 * 4 + ((3 + var135) & 3));
                            if (arrayAtObj(arrayAtObj(TerrainBuilder.edgeVertices, var166), 1) && arrayAtObj(arrayAtObj(TerrainBuilder.edgeVertices, var157), 0)) {
                                northWest = 0;
                            } else {
                                for (let var171 = 0; 8 > var171; ++var171) {
                                    if (neighbourCount === var171) {
                                        arrayPutI32(neighbours, neighbourCount++, northWest);
                                        break;
                                    }
                                    if (arrayAtI32(neighbours, var171) === northWest) {
                                        break;
                                    }
                                }
                            }
                        } else {
                            northWest = 0;
                        }
                    } else {
                        northWest = 0;
                    }
                    if (0 !== southWest && overlayId !== southWest) {
                        const var123 = FloType.List(-1 + southWest);
                        if (var123.m_hasSmoothEdges && -1 !== var123.colour) {
                            const var136 = (arrayAtU8(arrayAtObj(rotations, x - 1), -1 + z) << 24) >> 24;
                            const var149 = (arrayAtU8(arrayAtObj(shapes, -1 + x), z - 1) << 24) >> 24;
                            const var158 = arrayAtI32(TerrainBuilder.shapeEdges, (3 & var136) + var149 * 4);
                            const var167 = arrayAtI32(TerrainBuilder.shapeEdges, ((var136 + 3) & 3) + 4 * var149);
                            if (!arrayAtObj(arrayAtObj(TerrainBuilder.edgeVertices, var158), 1) || !arrayAtObj(arrayAtObj(TerrainBuilder.edgeVertices, var167), 0)) {
                                for (let var172 = 0; 8 > var172; ++var172) {
                                    if (var172 === neighbourCount) {
                                        arrayPutI32(neighbours, neighbourCount++, southWest);
                                        break;
                                    }
                                    if (southWest === arrayAtI32(neighbours, var172)) {
                                        break;
                                    }
                                }
                            } else {
                                southWest = 0;
                            }
                        } else {
                            southWest = 0;
                        }
                    } else {
                        southWest = 0;
                    }
                    if (southEast !== 0 && southEast !== overlayId) {
                        const var124 = FloType.List(-1 + southEast);
                        if (var124.m_hasSmoothEdges && -1 !== var124.colour) {
                            const var137 = (arrayAtU8(arrayAtObj(rotations, 1 + x), z - 1) << 24) >> 24;
                            const var150 = (arrayAtU8(arrayAtObj(shapes, 1 + x), z - 1) << 24) >> 24;
                            const var168 = arrayAtI32(TerrainBuilder.shapeEdges, ((1 + var137) & 3) + 4 * var150);
                            const var159 = arrayAtI32(TerrainBuilder.shapeEdges, var150 * 4 + (var137 & 3));
                            if (!arrayAtObj(arrayAtObj(TerrainBuilder.edgeVertices, var168), 1) || !arrayAtObj(arrayAtObj(TerrainBuilder.edgeVertices, var159), 0)) {
                                for (let var173 = 0; 8 > var173; ++var173) {
                                    if (var173 === neighbourCount) {
                                        arrayPutI32(neighbours, neighbourCount++, southEast);
                                        break;
                                    }
                                    if (arrayAtI32(neighbours, var173) === southEast) {
                                        break;
                                    }
                                }
                            } else {
                                southEast = 0;
                            }
                        } else {
                            southEast = 0;
                        }
                    } else {
                        southEast = 0;
                    }
                    if (northEast !== 0 && overlayId !== northEast) {
                        const var125 = FloType.List(-1 + northEast);
                        if (var125.m_hasSmoothEdges && var125.colour !== -1) {
                            const var151 = (arrayAtU8(arrayAtObj(shapes, 1 + x), 1 + z) << 24) >> 24;
                            const var138 = (arrayAtU8(arrayAtObj(rotations, 1 + x), z + 1) << 24) >> 24;
                            const var160 = arrayAtI32(TerrainBuilder.shapeEdges, (3 & (var138 + 2)) + 4 * var151);
                            const var169 = arrayAtI32(TerrainBuilder.shapeEdges, ((var138 + 1) & 3) + 4 * var151);
                            if (!arrayAtObj(arrayAtObj(TerrainBuilder.edgeVertices, var160), 1) || !arrayAtObj(arrayAtObj(TerrainBuilder.edgeVertices, var169), 0)) {
                                for (let var174 = 0; var174 < 8; ++var174) {
                                    if (var174 === neighbourCount) {
                                        arrayPutI32(neighbours, neighbourCount++, northEast);
                                        break;
                                    }
                                    if (arrayAtI32(neighbours, var174) === northEast) {
                                        break;
                                    }
                                }
                            } else {
                                northEast = 0;
                            }
                        } else {
                            northEast = 0;
                        }
                    } else {
                        northEast = 0;
                    }
                    if (0 !== north && north !== overlayId) {
                        const var126 = FloType.List(north - 1);
                        if (var126.m_hasSmoothEdges && -1 !== var126.colour) {
                            northEdge = arrayAtI32(TerrainBuilder.shapeEdges, ((arrayAtU8(arrayAtObj(shapes, x), z + 1) << 24) >> 24) * 4 + ((2 + ((arrayAtU8(arrayAtObj(rotations, x), z + 1) << 24) >> 24)) & 3));
                            for (let var139 = 0; 8 > var139; ++var139) {
                                if (var139 === neighbourCount) {
                                    arrayPutI32(neighbours, neighbourCount++, north);
                                    break;
                                }
                                if (arrayAtI32(neighbours, var139) === north) {
                                    break;
                                }
                            }
                        }
                    }
                    if (west !== 0 && overlayId !== west) {
                        const var127 = FloType.List(west - 1);
                        if (var127.m_hasSmoothEdges && -1 !== var127.colour) {
                            westEdge = arrayAtI32(TerrainBuilder.shapeEdges, (3 & (((arrayAtU8(arrayAtObj(rotations, x - 1), z) << 24) >> 24) + 3)) + 4 * ((arrayAtU8(arrayAtObj(shapes, x - 1), z) << 24) >> 24));
                            for (let var140 = 0; var140 < 8; ++var140) {
                                if (neighbourCount === var140) {
                                    arrayPutI32(neighbours, neighbourCount++, west);
                                    break;
                                }
                                if (west === arrayAtI32(neighbours, var140)) {
                                    break;
                                }
                            }
                        }
                    }
                    if (south !== 0 && south !== overlayId) {
                        const var128 = FloType.List(south - 1);
                        if (var128.m_hasSmoothEdges && -1 !== var128.colour) {
                            southEdge = arrayAtI32(TerrainBuilder.shapeEdges, (((arrayAtU8(arrayAtObj(rotations, x), z - 1) << 24) >> 24) & 3) + 4 * ((arrayAtU8(arrayAtObj(shapes, x), -1 + z) << 24) >> 24));
                            for (let var141 = 0; var141 < 8; ++var141) {
                                if (neighbourCount === var141) {
                                    arrayPutI32(neighbours, neighbourCount++, south);
                                    break;
                                }
                                if (south === arrayAtI32(neighbours, var141)) {
                                    break;
                                }
                            }
                        }
                    }
                    if (east !== 0 && east !== overlayId) {
                        const var129 = FloType.List(east - 1);
                        if (var129.m_hasSmoothEdges && var129.colour !== -1) {
                            eastEdge = arrayAtI32(TerrainBuilder.shapeEdges, 4 * ((arrayAtU8(arrayAtObj(shapes, 1 + x), z) << 24) >> 24) + (3 & (((arrayAtU8(arrayAtObj(rotations, x + 1), z) << 24) >> 24) + 1)));
                            for (let var142 = 0; var142 < 8; ++var142) {
                                if (var142 === neighbourCount) {
                                    arrayPutI32(neighbours, neighbourCount++, east);
                                    break;
                                }
                                if (arrayAtI32(neighbours, var142) === east) {
                                    break;
                                }
                            }
                        }
                    }
                    for (let var130 = 0; var130 < neighbourCount; ++var130) {
                        const neighbourId = arrayAtI32(neighbours, var130);
                        const northVertices: boolean[] = arrayAtObj(TerrainBuilder.edgeVertices, neighbourId === north ? northEdge : 0);
                        const westVertices: boolean[] = arrayAtObj(TerrainBuilder.edgeVertices, west === neighbourId ? westEdge : 0);
                        const southVertices: boolean[] = arrayAtObj(TerrainBuilder.edgeVertices, neighbourId === south ? southEdge : 0);
                        const eastVertices: boolean[] = arrayAtObj(TerrainBuilder.edgeVertices, neighbourId !== east ? 0 : eastEdge);
                        const neighbour = FloType.List(-1 + neighbourId);
                        const neighbourBatch = TerrainBuilder.getOverlayBatch(batches, neighbour);
                        const colour00 = (TerrainBuilder.colour(neighbour.m_materialID, neighbour.colour, arrayAtI32(arrayAtObj(lighting, x), z)) << 8) | 255;
                        let var44 = 6;
                        const colour10 = 255 | (TerrainBuilder.colour(neighbour.m_materialID, neighbour.colour, arrayAtI32(arrayAtObj(lighting, 1 + x), z)) << 8);
                        const colour11 = (TerrainBuilder.colour(neighbour.m_materialID, neighbour.colour, arrayAtI32(arrayAtObj(lighting, x + 1), z + 1)) << 8) | 255;
                        const colour01 = 255 | (TerrainBuilder.colour(neighbour.m_materialID, neighbour.colour, arrayAtI32(arrayAtObj(lighting, x), z + 1)) << 8);
                        const transparent00 = neighbourId !== southWest && arrayAtObj(southVertices, 0) && arrayAtObj(westVertices, 1);
                        const transparent11 = neighbourId !== northEast && arrayAtObj(northVertices, 0) && arrayAtObj(eastVertices, 1);
                        const transparent01 = northWest !== neighbourId && arrayAtObj(westVertices, 0) && arrayAtObj(northVertices, 1);
                        var44 += -2 + northVertices.length;
                        const transparent10 = neighbourId !== southEast && arrayAtObj(eastVertices, 0) && arrayAtObj(southVertices, 1);
                        var44 += -2 + westVertices.length;
                        var44 += southVertices.length - 2;
                        var44 += -2 + eastVertices.length;
                        const centreVertex = TerrainBuilder.vertex(colour01, 0, colour00, colour10, null, heights, x, normalZ, colour11, 0, true, neighbourBatch, normalX, z, 64, normalY, 64);
                        const polygon = polygonIndices.allocate(var44);
                        var44 = 0;
                        const northWestVertex = TerrainBuilder.vertex(colour01, 0, colour00, colour10, null, heights, x, normalZ, colour11, 0, transparent01, neighbourBatch, normalX, z, 0, normalY, 128);
                        const northEastVertex = TerrainBuilder.vertex(colour01, 0, colour00, colour10, null, heights, x, normalZ, colour11, 0, transparent11, neighbourBatch, normalX, z, 128, normalY, 128);
                        const southWestVertex = TerrainBuilder.vertex(colour01, 0, colour00, colour10, null, heights, x, normalZ, colour11, 0, transparent00, neighbourBatch, normalX, z, 0, normalY, 0);
                        const southEastVertex = TerrainBuilder.vertex(colour01, 0, colour00, colour10, null, heights, x, normalZ, colour11, 0, transparent10, neighbourBatch, normalX, z, 128, normalY, 0);
                        arrayPutI32(polygon, var44++, centreVertex);
                        arrayPutI32(polygon, var44++, northEastVertex);
                        if (2 < northVertices.length) {
                            arrayPutI32(polygon, var44++, TerrainBuilder.vertex(colour01, 0, colour00, colour10, null, heights, x, normalZ, colour11, 0, arrayAtObj(northVertices, 2), neighbourBatch, normalX, z, 64, normalY, 128));
                        }
                        arrayPutI32(polygon, var44++, northWestVertex);
                        if (westVertices.length > 2) {
                            arrayPutI32(polygon, var44++, TerrainBuilder.vertex(colour01, 0, colour00, colour10, null, heights, x, normalZ, colour11, 0, arrayAtObj(westVertices, 2), neighbourBatch, normalX, z, 0, normalY, 64));
                        }
                        arrayPutI32(polygon, var44++, southWestVertex);
                        if (southVertices.length > 2) {
                            arrayPutI32(polygon, var44++, TerrainBuilder.vertex(colour01, 0, colour00, colour10, null, heights, x, normalZ, colour11, 0, arrayAtObj(southVertices, 2), neighbourBatch, normalX, z, 64, normalY, 0));
                        }
                        arrayPutI32(polygon, var44++, southEastVertex);
                        if (2 < eastVertices.length) {
                            arrayPutI32(polygon, var44++, TerrainBuilder.vertex(colour01, 0, colour00, colour10, null, heights, x, normalZ, colour11, 0, arrayAtObj(eastVertices, 2), neighbourBatch, normalX, z, 128, normalY, 64));
                        }
                        arrayPutI32(polygon, var44++, northEastVertex);
                        neighbourBatch.addTile(drawLevel, x, z, polygon, null, true);
                    }
                }
            }
        }
        for (let built: TerrainBatch | null = batches.head(); null !== built; built = batches.next()) {
            if (0 !== built.vertexCount) {
                built.upload();
            } else {
                built.Unlink();
            }
        }
        const batchCount = batches.size();
        const sortedBatches = new Array<TerrainBatch>(batchCount);
        const keys = new BigInt64Array(batchCount);
        TerrainBuilder.copyBatches(batches, sortedBatches);
        for (let i = 0; batchCount > i; ++i) {
            arrayPutB64(keys, i, arrayAtObj(sortedBatches, i).key);
        }
        TerrainBuilder.sort(keys, sortedBatches);
        return sortedBatches;
    }
}
