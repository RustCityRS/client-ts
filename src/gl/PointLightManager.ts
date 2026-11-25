import type StaticPointLight from '#/dash3d/StaticPointLight';
import PointLightMesh from '#/dash3d/PointLightMesh';
import TerrainBuilder from '#/dash3d/TerrainBuilder';
import FloType from '#/config/FloType';
import WrappedException from '#/util/WrappedException';
import { isJavaRuntimeException } from '#/util/JavaException';
import { GL } from '#/jogl/GL';
import { arrayAtI16, arrayAtI32, arrayAtF32, arrayAtU8, arrayAtObj, arrayPutF32, arrayPutI32, arrayPutObj, requireNonNull } from '#/util/JavaArray';
import GlRenderer from './GlRenderer';
import GlLighting from './GlLighting';
import MaterialManager from '#/gl/material/MaterialManager';
import Preferences from '#/ui/Preferences';
import type Square from '#/dash3d/Square';
import world from '#/dash3d/world';

// jf in runescape_gl.jar (HD only, all static): the map point-light manager, a per-tile light grid feeding GL_LIGHT4
// to GL_LIGHT7 (jf.e()V uses 16388 + i) and the additive ground glow. NXT has no GL 1.x classes, so the names are
// descriptive (HD_PLAN.md 1.3).
//
// lb.a(Z)V clears lightCount and replaces lights at bytecode 55-65. The context lifecycle allocates the four
// light slots and the per-tile grid used for model lighting and the additive terrain pass.
export default class PointLightManager {
    // jf.a:[Lgi;. The map's lights; jf.f()V and lb.a(Z)V allocate 255 entries.
    static lights: (StaticPointLight | null)[] | null = null;
    private static pendingLights: Int32Array | null = null; // jf.c:[I
    private static enabled: boolean[] | null = null; // jf.f:[Z
    private static tileLights: Int32Array[][] | null = null; // jf.g:[[[I
    private static slotLights: Int32Array | null = null; // jf.h:[I
    private static levels = 0; // jf.j:I
    // jf.l:I. The number of entries of lights in use.
    static lightCount = 0;
    private static retainedSlots: boolean[] | null = null; // jf.m:[Z
    private static tileLength = 0; // jf.o:I
    private static tileWidth = 0; // jf.p:I
    private static lastLevel = 0; // jf.i
    private static lastX = 0; // jf.k
    private static lastZ = 0; // jf.d
    private static lastMaxX = 0; // jf.n
    private static lastMaxZ = 0; // jf.e
    private static position: Float32Array | null = Float32Array.of(0, 0, 0, 1); // jf.b

    // HD s.a([[F[[B[[B[Lgi;II[[F[[B[[B[[II[[F)V. Count polygons before allocating the light's mesh.
    static buildMeshes(
        normalZ: Float32Array[],
        underlays: Uint8Array[],
        rotations: Uint8Array[],
        lights: (StaticPointLight | null)[] | null,
        level: number,
        count: number,
        normalY: Float32Array[],
        shapes: Uint8Array[],
        overlays: Uint8Array[],
        heights: Int32Array[],
        normalX: Float32Array[]
    ): void {
        try {
            for (let i = 0; i < count; i++) {
                const light = requireNonNull(arrayAtObj(lights, i));
                if (light.m_level !== level) continue;
                let row = 0;
                const mesh = new PointLightMesh();
                const leftEdge = ((light.x >> 7) - light.m_radius) | 0;
                let minZ = ((light.z >> 7) - light.m_radius) | 0;
                if (minZ < 0) {
                    row = (row - minZ) | 0;
                    minZ = 0;
                }
                let maxZ = ((light.z >> 7) + light.m_radius) | 0;
                if (maxZ > 103) maxZ = 103;
                for (let z = minZ; z <= maxZ; z++, row++) {
                    const span = arrayAtI16(light.influenceRanges, row);
                    let minX = (leftEdge + (span >> 8)) | 0;
                    let maxX = (minX - 1 + (span & 255)) | 0;
                    if (maxX > 103) maxX = 103;
                    if (minX < 0) minX = 0;
                    for (let x = minX; x <= maxX; x++) {
                        const under = arrayAtU8(arrayAtObj(underlays, x), z);
                        const over = arrayAtU8(arrayAtObj(overlays, x), z);
                        let both = false;
                        if (under === 0) {
                            if (over === 0) continue;
                            const floor = FloType.List(over - 1);
                            if (floor.colour === -1) continue;
                            if ((arrayAtU8(arrayAtObj(shapes, x), z) << 24) >> 24 !== 0) {
                                const polygon = arrayAtObj(TerrainBuilder.overlayShapes, (arrayAtU8(arrayAtObj(shapes, x), z) << 24) >> 24);
                                mesh.indexCapacity = (mesh.indexCapacity + Math.imul((polygon.length >> 1) - 2, 3)) | 0;
                                mesh.vertexCapacity = (mesh.vertexCapacity + (polygon.length >> 1)) | 0;
                                continue;
                            }
                        } else if (over !== 0) {
                            const floor = FloType.List(over - 1);
                            if (floor.colour === -1) {
                                const shape = (arrayAtU8(arrayAtObj(shapes, x), z) << 24) >> 24;
                                if (shape === 0) continue;
                                const polygon = arrayAtObj(TerrainBuilder.underlayShapes, shape);
                                mesh.indexCapacity = (mesh.indexCapacity + Math.imul((polygon.length >> 1) - 2, 3)) | 0;
                                mesh.vertexCapacity = (mesh.vertexCapacity + (polygon.length >> 1)) | 0;
                                continue;
                            }
                            if ((arrayAtU8(arrayAtObj(shapes, x), z) << 24) >> 24 !== 0) both = true;
                        }
                        const scenery = world.GetScene(level, x, z);
                        if (scenery !== null && Number((scenery.typecode >> 14n) & 63n) === 9) {
                            let polygon: Int32Array | null = null;
                            const direction = Number((scenery.typecode >> 20n) & 3n);
                            if ((direction & 1) !== 0) {
                                let left = x - 1 >= minX;
                                let right = x + 1 <= maxX;
                                if (!left && z - 1 >= minZ) {
                                    const span = arrayAtI16(light.influenceRanges, row - 1);
                                    const begin = (leftEdge + (span >> 8)) | 0;
                                    const end = (begin + (span & 255)) | 0;
                                    left = begin < x && x < end;
                                }
                                if (!right && z + 1 <= maxZ) {
                                    const span = arrayAtI16(light.influenceRanges, row + 1);
                                    const begin = (leftEdge + (span >> 8)) | 0;
                                    const end = (begin + (span & 255)) | 0;
                                    right = begin < x && x < end;
                                }
                                if (left && right) polygon = arrayAtObj(TerrainBuilder.overlayShapes, 0);
                                else if (left) {
                                    polygon = arrayAtObj(TerrainBuilder.overlayShapes, 1);
                                } else if (right) {
                                    polygon = arrayAtObj(TerrainBuilder.overlayShapes, 1);
                                }
                            } else {
                                let right = x + 1 <= maxX;
                                let left = x - 1 >= minX;
                                if (!left && z + 1 <= maxZ) {
                                    const span = arrayAtI16(light.influenceRanges, row + 1);
                                    const begin = (leftEdge + (span >> 8)) | 0;
                                    const end = (begin + (span & 255)) | 0;
                                    left = begin < x && x < end;
                                }
                                if (!right && z - 1 >= minZ) {
                                    const span = arrayAtI16(light.influenceRanges, row - 1);
                                    const begin = (leftEdge + (span >> 8)) | 0;
                                    const end = (begin + (span & 255)) | 0;
                                    right = begin < x && x < end;
                                }
                                if (left && right) polygon = arrayAtObj(TerrainBuilder.overlayShapes, 0);
                                else if (left) {
                                    polygon = arrayAtObj(TerrainBuilder.overlayShapes, 1);
                                } else if (right) {
                                    polygon = arrayAtObj(TerrainBuilder.overlayShapes, 1);
                                }
                            }
                            if (polygon === null) continue;
                            mesh.indexCapacity = (mesh.indexCapacity + Math.imul(polygon.length >> 1, 3) - 6) | 0;
                            mesh.vertexCapacity = (mesh.vertexCapacity + (polygon.length >> 1)) | 0;
                            continue;
                        }
                        if (both) {
                            const underPolygon = arrayAtObj(TerrainBuilder.underlayShapes, (arrayAtU8(arrayAtObj(shapes, x), z) << 24) >> 24);
                            const overPolygon = arrayAtObj(TerrainBuilder.overlayShapes, (arrayAtU8(arrayAtObj(shapes, x), z) << 24) >> 24);
                            mesh.indexCapacity = (mesh.indexCapacity + Math.imul((overPolygon.length >> 1) - 2, 3)) | 0;
                            mesh.indexCapacity = (mesh.indexCapacity + Math.imul((underPolygon.length >> 1) - 2, 3)) | 0;
                            mesh.vertexCapacity = (mesh.vertexCapacity + (overPolygon.length >> 1)) | 0;
                            mesh.vertexCapacity = (mesh.vertexCapacity + (underPolygon.length >> 1)) | 0;
                            continue;
                        }
                        const polygon = arrayAtObj(TerrainBuilder.overlayShapes, 0);
                        mesh.indexCapacity = (mesh.indexCapacity + Math.imul((polygon.length >> 1) - 2, 3)) | 0;
                        mesh.vertexCapacity = (mesh.vertexCapacity + (polygon.length >> 1)) | 0;
                    }
                }
                row = 0;
                mesh.allocate();
                if ((((light.z >> 7) - light.m_radius) | 0) < 0) row = (row - ((light.z >> 7) - light.m_radius)) | 0;
                for (let z = minZ; z <= maxZ; z++, row++) {
                    const span = arrayAtI16(light.influenceRanges, row);
                    let minX = (leftEdge + (span >> 8)) | 0;
                    let maxX = (minX - 1 + (span & 255)) | 0;
                    if (maxX > 103) maxX = 103;
                    if (minX < 0) minX = 0;
                    for (let x = minX; x <= maxX; x++) {
                        const over = arrayAtU8(arrayAtObj(overlays, x), z);
                        const under = arrayAtU8(arrayAtObj(underlays, x), z);
                        let rotation = (arrayAtU8(arrayAtObj(rotations, x), z) << 24) >> 24;
                        let both = false;
                        if (under === 0) {
                            if (over === 0) continue;
                            const floor = FloType.List(over - 1);
                            if (floor.colour === -1) continue;
                            if ((arrayAtU8(arrayAtObj(shapes, x), z) << 24) >> 24 !== 0) {
                                PointLightManager.addLightPolygon(
                                    normalZ,
                                    heights,
                                    x,
                                    normalY,
                                    z,
                                    arrayAtObj(TerrainBuilder.overlayShapes, (arrayAtU8(arrayAtObj(shapes, x), z) << 24) >> 24),
                                    mesh,
                                    -88,
                                    light,
                                    normalX,
                                    (arrayAtU8(arrayAtObj(rotations, x), z) << 24) >> 24
                                );
                                continue;
                            }
                        } else if (over !== 0) {
                            const floor = FloType.List(over - 1);
                            if (floor.colour === -1) {
                                PointLightManager.addLightPolygon(
                                    normalZ,
                                    heights,
                                    x,
                                    normalY,
                                    z,
                                    arrayAtObj(TerrainBuilder.underlayShapes, (arrayAtU8(arrayAtObj(shapes, x), z) << 24) >> 24),
                                    mesh,
                                    116,
                                    light,
                                    normalX,
                                    (arrayAtU8(arrayAtObj(rotations, x), z) << 24) >> 24
                                );
                                continue;
                            }
                            if ((arrayAtU8(arrayAtObj(shapes, x), z) << 24) >> 24 !== 0) both = true;
                        }
                        const scenery = world.GetScene(level, x, z);
                        if (scenery !== null && Number((scenery.typecode >> 14n) & 63n) === 9) {
                            let polygon: Int32Array | null = null;
                            const direction = Number((scenery.typecode >> 20n) & 3n);
                            if ((direction & 1) !== 0) {
                                let left = x - 1 >= minX;
                                let right = x + 1 <= maxX;
                                if (!left && z - 1 >= minZ) {
                                    const span = arrayAtI16(light.influenceRanges, row - 1);
                                    const begin = (leftEdge + (span >> 8)) | 0;
                                    const end = (begin + (span & 255)) | 0;
                                    left = begin < x && x < end;
                                }
                                if (!right && z + 1 <= maxZ) {
                                    const span = arrayAtI16(light.influenceRanges, row + 1);
                                    const begin = (leftEdge + (span >> 8)) | 0;
                                    const end = (begin + (span & 255)) | 0;
                                    right = begin < x && x < end;
                                }
                                if (left && right) polygon = arrayAtObj(TerrainBuilder.overlayShapes, 0);
                                else if (left) {
                                    polygon = arrayAtObj(TerrainBuilder.overlayShapes, 1);
                                    rotation = 0;
                                } else if (right) {
                                    polygon = arrayAtObj(TerrainBuilder.overlayShapes, 1);
                                    rotation = 2;
                                }
                            } else {
                                let left = x - 1 >= minX;
                                let right = x + 1 <= maxX;
                                if (!left && z + 1 <= maxZ) {
                                    const span = arrayAtI16(light.influenceRanges, row + 1);
                                    const begin = (leftEdge + (span >> 8)) | 0;
                                    const end = (begin + (span & 255)) | 0;
                                    left = begin < x && x < end;
                                }
                                if (!right && z - 1 >= minZ) {
                                    const span = arrayAtI16(light.influenceRanges, row - 1);
                                    const begin = (leftEdge + (span >> 8)) | 0;
                                    const end = (begin + (span & 255)) | 0;
                                    right = begin < x && x < end;
                                }
                                if (left && right) polygon = arrayAtObj(TerrainBuilder.overlayShapes, 0);
                                else if (left) {
                                    polygon = arrayAtObj(TerrainBuilder.overlayShapes, 1);
                                    rotation = 1;
                                } else if (right) {
                                    polygon = arrayAtObj(TerrainBuilder.overlayShapes, 1);
                                    rotation = 3;
                                }
                            }
                            if (polygon === null) continue;
                            PointLightManager.addLightPolygon(normalZ, heights, x, normalY, z, polygon, mesh, 98, light, normalX, rotation);
                            continue;
                        }
                        if (both) {
                            PointLightManager.addLightPolygon(
                                normalZ,
                                heights,
                                x,
                                normalY,
                                z,
                                arrayAtObj(TerrainBuilder.underlayShapes, (arrayAtU8(arrayAtObj(shapes, x), z) << 24) >> 24),
                                mesh,
                                96,
                                light,
                                normalX,
                                (arrayAtU8(arrayAtObj(rotations, x), z) << 24) >> 24
                            );
                            PointLightManager.addLightPolygon(
                                normalZ,
                                heights,
                                x,
                                normalY,
                                z,
                                arrayAtObj(TerrainBuilder.overlayShapes, (arrayAtU8(arrayAtObj(shapes, x), z) << 24) >> 24),
                                mesh,
                                -117,
                                light,
                                normalX,
                                (arrayAtU8(arrayAtObj(rotations, x), z) << 24) >> 24
                            );
                            continue;
                        }
                        PointLightManager.addLightPolygon(normalZ, heights, x, normalY, z, arrayAtObj(TerrainBuilder.overlayShapes, 0), mesh, 61, light, normalX, rotation);
                    }
                }
                if (mesh.vertexCount > 0 && mesh.indexCount > 0) {
                    mesh.upload();
                    light.mesh = mesh;
                }
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 's.C(' + [normalZ, underlays, rotations, lights, level, count, normalY, shapes, overlays, heights, -8771, normalX].map(v => (typeof v === 'number' ? v : v === null ? 'null' : '{...}')).join(',') + ')');
        }
    }

    // HD kd.a([[F[[II[[FI[ILfj;BLgi;[[FI)V
    private static addLightPolygon(
        normalZ: Float32Array[],
        heights: Int32Array[],
        x: number,
        normalY: Float32Array[],
        z: number,
        shape: Int32Array,
        mesh: PointLightMesh,
        guard: number,
        light: StaticPointLight,
        normalX: Float32Array[],
        rotation: number
    ): void {
        try {
            const indices = new Int32Array((shape.length / 2) | 0);
            const f = Math.fround;
            for (let i = 0; i < indices.length; i++) {
                let lx = arrayAtI32(shape, i + i);
                let lz = arrayAtI32(shape, i + i + 1);
                if (rotation === 1) {
                    const old = lx;
                    lx = lz;
                    lz = (128 - old) | 0;
                } else if (rotation === 2) {
                    lz = (128 - lz) | 0;
                    lx = (128 - lx) | 0;
                } else if (rotation === 3) {
                    const old = lx;
                    lx = (128 - lz) | 0;
                    lz = old;
                }
                let nx: number, ny: number, nz: number;
                if (lx === 0 && lz === 0) {
                    ny = arrayAtF32(arrayAtObj(normalY, x), z);
                    nx = arrayAtF32(arrayAtObj(normalX, x), z);
                    nz = arrayAtF32(arrayAtObj(normalZ, x), z);
                } else if (lx === 128 && lz === 0) {
                    nz = arrayAtF32(arrayAtObj(normalZ, x + 1), z);
                    nx = arrayAtF32(arrayAtObj(normalX, x + 1), z);
                    ny = arrayAtF32(arrayAtObj(normalY, x + 1), z);
                } else if (lx === 128 && lz === 128) {
                    ny = arrayAtF32(arrayAtObj(normalY, x + 1), z + 1);
                    nx = arrayAtF32(arrayAtObj(normalX, x + 1), z + 1);
                    nz = arrayAtF32(arrayAtObj(normalZ, x + 1), z + 1);
                } else if (lx === 0 && lz === 128) {
                    nz = arrayAtF32(arrayAtObj(normalZ, x), z + 1);
                    ny = arrayAtF32(arrayAtObj(normalY, x), z + 1);
                    nx = arrayAtF32(arrayAtObj(normalX, x), z + 1);
                } else {
                    nx = arrayAtF32(arrayAtObj(normalX, x), z);
                    nz = arrayAtF32(arrayAtObj(normalZ, x), z);
                    const fx = f(f(lx) / 128);
                    ny = arrayAtF32(arrayAtObj(normalY, x), z);
                    ny = f(ny + f(f(-ny + arrayAtF32(arrayAtObj(normalY, x + 1), z)) * fx));
                    nz = f(nz + f(fx * f(arrayAtF32(arrayAtObj(normalZ, x + 1), z) - nz)));
                    nx = f(nx + f(f(-nx + arrayAtF32(arrayAtObj(normalX, x + 1), z)) * fx));
                    let nx1 = arrayAtF32(arrayAtObj(normalX, x), z + 1);
                    nx1 = f(nx1 + f(f(arrayAtF32(arrayAtObj(normalX, x + 1), z + 1) - nx1) * fx));
                    let ny1 = arrayAtF32(arrayAtObj(normalY, x), z + 1);
                    const fz = f(f(lz) / 128);
                    nx = f(nx + f(f(-nx + nx1) * fz));
                    let nz1 = arrayAtF32(arrayAtObj(normalZ, x), z + 1);
                    nz1 = f(nz1 + f(f(arrayAtF32(arrayAtObj(normalZ, x + 1), z + 1) - nz1) * fx));
                    ny1 = f(ny1 + f(f(-ny1 + arrayAtF32(arrayAtObj(normalY, x + 1), z + 1)) * fx));
                    ny = f(ny + f(f(-ny + ny1) * fz));
                    nz = f(nz + f(f(nz1 - nz) * fz));
                }
                const fineX = ((x << 7) + lx) | 0;
                const fineZ = ((z << 7) + lz) | 0;
                const height = TerrainBuilder.height(lx, z, heights, x, lz);
                arrayPutI32(indices, i, mesh.addVertex(light, fineX, height, fineZ, nx, ny, nz));
            }
            mesh.addPolygon(indices);
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'kd.Q(' + [normalZ, heights, x, normalY, z, shape, mesh, guard, light, normalX, rotation].map(v => (typeof v === 'number' ? v : v === null ? 'null' : '{...}')).join(',') + ')');
        }
    }

    // jf.a(ILgi;III)V
    private static enableSlot(slot: number, lamp: StaticPointLight | null, eyeX: number, eyeY: number, eyeZ: number): void {
        const id = slot + GL.GL_LIGHT4,
            gl = GlRenderer.gl;
        if (!arrayAtObj(PointLightManager.enabled, slot)) {
            requireNonNull(gl).glEnable(id);
            arrayPutObj(PointLightManager.enabled, slot, true);
        }
        requireNonNull(gl).glLightf(id, GL.GL_QUADRATIC_ATTENUATION, requireNonNull(lamp).attenuation);
        requireNonNull(gl).glLightfv(id, GL.GL_DIFFUSE, requireNonNull(lamp).diffuse, 0);
        arrayPutF32(PointLightManager.position, 0, (requireNonNull(lamp).x - eyeX) | 0);
        arrayPutF32(PointLightManager.position, 1, (requireNonNull(lamp).y - eyeY) | 0);
        arrayPutF32(PointLightManager.position, 2, (requireNonNull(lamp).z - eyeZ) | 0);
        requireNonNull(gl).glLightfv(id, GL.GL_POSITION, PointLightManager.position, 0);
    }

    // jf.a(IIIIII)V
    static selectTile(eyeX: number, eyeY: number, eyeZ: number, level: number, x: number, z: number): void {
        if (!Preferences.graphics.highDetailLighting) return;
        if (PointLightManager.lastLevel === level && PointLightManager.lastX === x && PointLightManager.lastZ === z && PointLightManager.lastMaxX === x && PointLightManager.lastMaxZ === z) return;
        for (let i = 0; i < 4; i++) arrayPutObj(PointLightManager.retainedSlots, i, false);
        let count = 0;
        let packed = arrayAtI32(arrayAtObj(arrayAtObj(PointLightManager.tileLights, level), x), z);
        candidates: while (packed !== 0) {
            const light = (packed & 255) - 1;
            packed >>>= 8;
            for (let slot = 0; slot < 4; slot++) {
                if (light !== arrayAtI32(PointLightManager.slotLights, slot)) continue;
                arrayPutObj(PointLightManager.retainedSlots, slot, true);
                continue candidates;
            }
            arrayPutI32(PointLightManager.pendingLights, count++, light);
        }
        PointLightManager.applySlots(count, eyeX, eyeY, eyeZ);
        PointLightManager.lastLevel = level;
        PointLightManager.lastX = x;
        PointLightManager.lastZ = z;
        PointLightManager.lastMaxX = x;
        PointLightManager.lastMaxZ = z;
    }

    // jf.a(IIIIIIII)V
    static selectArea(eyeX: number, eyeY: number, eyeZ: number, level: number, x0: number, z0: number, x1: number, z1: number): void {
        if (!Preferences.graphics.highDetailLighting) return;
        if (PointLightManager.lastLevel === level && PointLightManager.lastX === x0 && PointLightManager.lastZ === z0 && PointLightManager.lastMaxX === x1 && PointLightManager.lastMaxZ === z1) return;
        for (let i = 0; i < 4; i++) arrayPutObj(PointLightManager.retainedSlots, i, false);
        let total = 0;
        let count = 0;
        tiles: for (let x = x0; x <= x1; x++) {
            for (let z = z0; z <= z1; z++) {
                let packed = arrayAtI32(arrayAtObj(arrayAtObj(PointLightManager.tileLights, level), x), z);
                candidates: while (packed !== 0) {
                    const light = (packed & 255) - 1;
                    packed >>>= 8;
                    for (let j = 0; j < count; j++) {
                        if (light === arrayAtI32(PointLightManager.pendingLights, j)) continue candidates;
                    }
                    for (let slot = 0; slot < 4; slot++) {
                        if (light !== arrayAtI32(PointLightManager.slotLights, slot)) continue;
                        if (arrayAtObj(PointLightManager.retainedSlots, slot)) continue candidates;
                        arrayPutObj(PointLightManager.retainedSlots, slot, true);
                        if (++total !== 4) continue candidates;
                        break tiles;
                    }
                    arrayPutI32(PointLightManager.pendingLights, count++, light);
                    if (++total === 4) break tiles;
                }
            }
        }
        PointLightManager.applySlots(count, eyeX, eyeY, eyeZ);
        PointLightManager.lastLevel = level;
        PointLightManager.lastX = x0;
        PointLightManager.lastZ = z0;
        PointLightManager.lastMaxX = x1;
        PointLightManager.lastMaxZ = z1;
    }

    // Identical slot-binding tail in jf.a(IIIIII)V and jf.a(IIIIIIII)V.
    private static applySlots(count: number, eyeX: number, eyeY: number, eyeZ: number): void {
        for (let i = 0; i < count; i++) {
            for (let slot = 0; slot < 4; slot++) {
                if (arrayAtObj(PointLightManager.retainedSlots, slot)) continue;
                arrayPutI32(PointLightManager.slotLights, slot, arrayAtI32(PointLightManager.pendingLights, i));
                arrayPutObj(PointLightManager.retainedSlots, slot, true);
                PointLightManager.enableSlot(slot, arrayAtObj(PointLightManager.lights, arrayAtI32(PointLightManager.pendingLights, i)), eyeX, eyeY, eyeZ);
                break;
            }
        }
        for (let slot = 0; slot < 4; slot++) {
            if (arrayAtObj(PointLightManager.retainedSlots, slot)) continue;
            arrayPutI32(PointLightManager.slotLights, slot, -1);
            PointLightManager.disableSlot(slot);
        }
    }

    // jf.a(IIIIIII)V
    static selectNeighbour(side: number, eyeX: number, eyeY: number, eyeZ: number, level: number, x: number, z: number): void {
        if (!Preferences.graphics.highDetailLighting) return;
        const maxX = PointLightManager.tileWidth - 1,
            maxZ = PointLightManager.tileLength - 1;
        if (side === 1 && x > 0) PointLightManager.selectTile(eyeX, eyeY, eyeZ, level, x - 1, z);
        else if (side === 4 && x < maxX) PointLightManager.selectTile(eyeX, eyeY, eyeZ, level, x + 1, z);
        else if (side === 8 && z > 0) PointLightManager.selectTile(eyeX, eyeY, eyeZ, level, x, z - 1);
        else if (side === 2 && z < maxZ) PointLightManager.selectTile(eyeX, eyeY, eyeZ, level, x, z + 1);
        else if (side === 16 && x > 0 && z < maxZ) PointLightManager.selectTile(eyeX, eyeY, eyeZ, level, x - 1, z + 1);
        else if (side === 32 && x < maxX && z < maxZ) PointLightManager.selectTile(eyeX, eyeY, eyeZ, level, x + 1, z + 1);
        else if (side === 128 && x > 0 && z > 0) PointLightManager.selectTile(eyeX, eyeY, eyeZ, level, x - 1, z - 1);
        else if (side === 64 && x < maxX && z > 0) PointLightManager.selectTile(eyeX, eyeY, eyeZ, level, x + 1, z - 1);
    }

    // jf.a(IIIII)V
    static retainBetween(level: number, x0: number, z0: number, x1: number, z1: number): void {
        if (!Preferences.graphics.highDetailLighting) return;
        slots: for (let slot = 0; slot < 4; slot++) {
            if (arrayAtI32(PointLightManager.slotLights, slot) !== -1) {
                for (let packed = arrayAtI32(arrayAtObj(arrayAtObj(PointLightManager.tileLights, level), x0), z0); packed !== 0; packed >>>= 8) {
                    if ((packed & 255) - 1 === arrayAtI32(PointLightManager.slotLights, slot)) continue slots;
                }
                for (let packed = arrayAtI32(arrayAtObj(arrayAtObj(PointLightManager.tileLights, level), x1), z1); packed !== 0; packed >>>= 8) {
                    if ((packed & 255) - 1 === arrayAtI32(PointLightManager.slotLights, slot)) continue slots;
                }
            }
            arrayPutI32(PointLightManager.slotLights, slot, -1);
            PointLightManager.disableSlot(slot);
        }
    }

    // jf.a(IZ)V
    static update(cycle: number, disableFlicker: boolean): void {
        for (let i = 0; i < PointLightManager.lightCount; i++) {
            requireNonNull(arrayAtObj(PointLightManager.lights, i)).CalculateIntensity(disableFlicker, cycle);
        }
        PointLightManager.lastLevel = -1;
        PointLightManager.lastX = -1;
        PointLightManager.lastZ = -1;
        PointLightManager.lastMaxX = -1;
        PointLightManager.lastMaxZ = -1;
    }

    // jf.a()V
    static clearSlots(): void {
        for (let slot = 0; slot < 4; slot++) {
            arrayPutI32(PointLightManager.slotLights, slot, -1);
            PointLightManager.disableSlot(slot);
        }
    }

    // jf.a(II[[[Lbj;)V
    static drawGroundLights(_eyeX: number, _eyeZ: number, tiles: (Square | null)[][][] | null): void {
        if (!Preferences.graphics.highDetailLighting) return;
        const gl = GlRenderer.gl;
        MaterialManager.setMaterial(0, 0);
        GlRenderer.setTextureCombineRgb(0);
        GlRenderer.resetTextureMatrix();
        GlRenderer.bindTexture2D(GlRenderer.whiteTexture);
        requireNonNull(gl).glDepthMask(false);
        GlRenderer.setLighting(false);
        requireNonNull(gl).glBlendFunc(GL.GL_DST_COLOR, GL.GL_ONE);
        requireNonNull(gl).glFogfv(GL.GL_FOG_COLOR, new Float32Array(4), 0);
        requireNonNull(gl).glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_SOURCE0_RGB, GL.GL_CONSTANT);
        requireNonNull(gl).glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_OPERAND0_RGB, GL.GL_SRC_ALPHA);
        lights: for (let i = 0; i < PointLightManager.lightCount; i++) {
            const light = requireNonNull(arrayAtObj(PointLightManager.lights, i));
            let level = light.m_level;
            if (light.bridge) level--;
            if (light.mesh === null) continue;
            let row = 0;
            let z0 = (light.z >> 7) - light.m_radius,
                z1 = (light.z >> 7) + light.m_radius;
            if (z1 >= world.maxZ) z1 = world.maxZ - 1;
            if (z0 < world.minZ) {
                row += world.minZ - z0;
                z0 = world.minZ;
            }
            for (let z = z0; z <= z1; z++) {
                const range = arrayAtI16(light.influenceRanges, row++);
                let x0 = (light.x >> 7) - light.m_radius + (range >> 8);
                let x1 = x0 + (range & 255) - 1;
                if (x0 < world.minX) x0 = world.minX;
                if (x1 >= world.maxX) x1 = world.maxX - 1;
                for (let x = x0; x <= x1; x++) {
                    let square = null;
                    if (level >= 0) square = arrayAtObj(arrayAtObj(arrayAtObj(tiles, level), x), z);
                    if (level >= 0 && (square === null || !square.drawFront)) continue;
                    GlRenderer.setLevelDepthBias(201.5 - light.m_level * 50 - 1.5);
                    requireNonNull(gl).glTexEnvfv(GL.GL_TEXTURE_ENV, GL.GL_TEXTURE_ENV_COLOR, Float32Array.of(0, 0, 0, light.m_intensity), 0);
                    light.mesh.draw();
                    continue lights;
                }
            }
        }
        requireNonNull(gl).glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_SOURCE0_RGB, GL.GL_TEXTURE);
        requireNonNull(gl).glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_OPERAND0_RGB, GL.GL_SRC_COLOR);
        requireNonNull(gl).glBlendFunc(GL.GL_SRC_ALPHA, GL.GL_ONE_MINUS_SRC_ALPHA);
        requireNonNull(gl).glDepthMask(true);
        requireNonNull(gl).glFogfv(GL.GL_FOG_COLOR, GlLighting.fogColour, 0);
        requireNonNull(gl).glEnableClientState(GL.GL_TEXTURE_COORD_ARRAY);
        GlRenderer.applyLightingPreference();
    }

    private static newTileGrid(): Int32Array[][] {
        const { levels, tileWidth: width, tileLength: length } = PointLightManager;
        for (const size of [levels, width, length]) {
            if (size < 0) throw new RangeError('NegativeArraySizeException ' + size);
        }
        return Array.from({ length: levels }, () => Array.from({ length: width }, () => new Int32Array(length)));
    }

    // jf.a(III)V
    static setDimensions(levels: number, width: number, length: number): void {
        PointLightManager.levels = levels;
        PointLightManager.tileWidth = width;
        PointLightManager.tileLength = length;
        PointLightManager.tileLights = PointLightManager.newTileGrid();
    }

    // jf.a(I)V
    private static disableSlot(slot: number): void {
        if (!arrayAtObj(PointLightManager.enabled, slot)) return;
        arrayPutObj(PointLightManager.enabled, slot, false);
        requireNonNull(GlRenderer.gl).glDisable(GL.GL_LIGHT4 + slot);
    }

    // jf.c()V
    static release(): void {
        PointLightManager.lights = null;
        PointLightManager.slotLights = null;
        PointLightManager.enabled = null;
        PointLightManager.pendingLights = null;
        PointLightManager.retainedSlots = null;
        PointLightManager.tileLights = null;
    }

    // jf.d()V
    static unload(): void {
        PointLightManager.lights = null;
        PointLightManager.tileLights = null;
        PointLightManager.slotLights = null;
        PointLightManager.enabled = null;
        PointLightManager.position = null;
        PointLightManager.pendingLights = null;
        PointLightManager.retainedSlots = null;
    }

    // jf.e()V
    static init(): void {
        const gl = GlRenderer.gl;
        for (let slot = 0; slot < 4; slot++) {
            const light = GL.GL_LIGHT4 + slot;
            requireNonNull(gl).glLightfv(light, GL.GL_AMBIENT, Float32Array.of(0, 0, 0, 1), 0);
            requireNonNull(gl).glLightf(light, GL.GL_LINEAR_ATTENUATION, 0);
            requireNonNull(gl).glLightf(light, GL.GL_CONSTANT_ATTENUATION, 0);
        }
        for (let slot = 0; slot < 4; slot++) {
            arrayPutI32(PointLightManager.slotLights, slot, -1);
            PointLightManager.disableSlot(slot);
        }
    }

    // jf.f()V
    static allocate(): void {
        PointLightManager.lights = new Array<StaticPointLight | null>(255).fill(null);
        PointLightManager.slotLights = new Int32Array(4);
        PointLightManager.enabled = new Array<boolean>(4).fill(false);
        PointLightManager.pendingLights = new Int32Array(4);
        PointLightManager.retainedSlots = new Array<boolean>(4).fill(false);
        PointLightManager.tileLights = PointLightManager.newTileGrid();
    }

    // jf.a(Lgi;)V
    static add(light: StaticPointLight | null): void {
        if (PointLightManager.lightCount >= 255) {
            console.log('Number of lights added exceeds maximum!');
            return;
        }
        arrayPutObj(PointLightManager.lights, PointLightManager.lightCount++, light);
    }

    // jf.b()V
    static buildGrid(): void {
        for (let i = 0; i < PointLightManager.lightCount; i++) {
            const light = requireNonNull(arrayAtObj(PointLightManager.lights, i));
            let firstLevel = light.m_level;
            if (light.m_lightLevelsBelow) firstLevel = 0;
            let lastLevel = light.m_level;
            if (light.m_lightLevelsAbove) lastLevel = 3;
            for (let level = firstLevel; level <= lastLevel; level++) {
                let range = 0;
                let firstZ = ((light.z >> 7) - light.m_radius) | 0;
                if (firstZ < 0) {
                    range = -firstZ;
                    firstZ = 0;
                }
                let lastZ = ((light.z >> 7) + light.m_radius) | 0;
                if (lastZ > PointLightManager.tileLength - 1) lastZ = PointLightManager.tileLength - 1;
                for (let z = firstZ; z <= lastZ; z++) {
                    const span = arrayAtI16(light.influenceRanges, range++);
                    let firstX = ((light.x >> 7) - light.m_radius + (span >> 8)) | 0;
                    let lastX = (firstX + (span & 255) - 1) | 0;
                    if (firstX < 0) firstX = 0;
                    if (lastX > PointLightManager.tileWidth - 1) lastX = PointLightManager.tileWidth - 1;
                    for (let x = firstX; x <= lastX; x++) {
                        const row = arrayAtObj(arrayAtObj(PointLightManager.tileLights, level), x);
                        const packed = arrayAtI32(row, z);
                        if ((packed & 0xff) === 0) arrayPutI32(row, z, packed | (i + 1));
                        else if ((packed & 0xff00) === 0) arrayPutI32(row, z, packed | ((i + 1) << 8));
                        else if ((packed & 0xff0000) === 0) arrayPutI32(row, z, packed | ((i + 1) << 16));
                        else if ((packed & 0xff000000) === 0) arrayPutI32(row, z, packed | ((i + 1) << 24));
                    }
                }
            }
        }
    }

    // jf.g()V, called after cd.a has reset the active map.
    static clear(): void {
        PointLightManager.lightCount = 0;
        for (let level = 0; level < PointLightManager.levels; level++) {
            for (let x = 0; x < PointLightManager.tileWidth; x++) {
                for (let z = 0; z < PointLightManager.tileLength; z++) {
                    arrayPutI32(arrayAtObj(arrayAtObj(PointLightManager.tileLights, level), x), z, 0);
                }
            }
        }
    }
}
