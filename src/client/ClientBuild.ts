import Client from './Client';
import SharedPtrList from '#/datastruct/SharedPtrList';
import { glJar } from './ClientVariant';
import SceneCutover from '#/scene/SceneCutover';
import CollisionMap from '#/dash3d/CollisionMap';
import LocType from '#/config/LocType';
import Pix3D from '#/dash3d/Pix3D';
import world from '#/dash3d/world';
import PacketT from '#/io/PacketT';
import Preferences from '#/ui/Preferences';
import { doubleToInt, intDivide } from '#/util/IntUtils';
import { arrayAtF32, arrayAtI32, arrayAtObj, arrayAtU8, arrayPutI32, arrayPutObj, arrayPutU8, requireNonNull } from '#/util/JavaArray';
import type { HdTextureProvider } from '#/dash3d/TextureProvider';
import { mathRandom } from '#/util/JavaRandom';
import RegionRotate from '#/util/RegionRotate';
import AudioEngine from '#/sound/AudioEngine';
import AreaSoundManager from '#/sound/AreaSoundManager';
import ClientLocAnim from '#/dash3d/ClientLocAnim';
import ModelLit from '#/dash3d/ModelLit';
import type ModelSource from '#/dash3d/ModelSource';
import FloType from '#/config/FloType';
import FluType from '#/config/FluType';
import LightType from '#/config/LightType';
import Environment from '#/dash3d/Environment';
import StaticPointLight from '#/dash3d/StaticPointLight';
import GroundShadows from '#/dash3d/GroundShadows';
import { isJavaRuntimeException } from '#/util/JavaException';
import WrappedException from '#/util/WrappedException';
import GlRenderer from '#/gl/GlRenderer';
import PointLightManager from '#/gl/PointLightManager';
import GlLighting from '#/gl/GlLighting';
import TerrainBuilder from '#/dash3d/TerrainBuilder';

export default class ClientBuild {
    // oldscape/jagex3/client/clientbuild.h:69-74. Wall masks and decor offsets indexed by rotation in nc.a.
    static WSHAPE0 = Int32Array.of(1, 2, 4, 8); // gh.B:[I
    static WSHAPE1 = Int32Array.of(16, 32, 64, 128); // nf.n:[I
    static DECORXOF = Int32Array.of(1, 0, -1, 0); // tj.d:[I
    static DECORZOF = Int32Array.of(0, -1, 0, 1); // cf.o:[I
    static DECORXOF2 = Int32Array.of(1, -1, -1, 1); // lj.i:[I
    static DECORZOF2 = Int32Array.of(-1, -1, 1, 1); // ii.e:[I
    private static terrainHue = glJar ? undefined : ((mathRandom.nextDouble() * 17.0) | 0) - 8;
    private static terrainLightness = glJar ? undefined : ((mathRandom.nextDouble() * 33.0) | 0) - 16;
    // SD ki.X:I, HD gm.R:I. The HD owner initializes when client.g first assigns gm.T.
    static get m_hueOff(): number {
        return (ClientBuild.terrainHue ??= ((mathRandom.nextDouble() * 17.0) | 0) - 8);
    }
    static set m_hueOff(value: number) {
        if (ClientBuild.terrainHue === undefined) void ClientBuild.m_hueOff;
        ClientBuild.terrainHue = value;
    }
    // SD si.u:I, HD ok.c:I. ok initializes on first use of an indexed sprite.
    static get m_ligOff(): number {
        return (ClientBuild.terrainLightness ??= ((mathRandom.nextDouble() * 33.0) | 0) - 16);
    }
    static set m_ligOff(value: number) {
        if (ClientBuild.terrainLightness === undefined) void ClientBuild.m_ligOff;
        ClientBuild.terrainLightness = value;
    }
    // tb.t:[[[B. NXT ClientBuild::m_mapl.
    static m_mapl: Uint8Array[][] | null = Array.from({ length: 4 }, () => Array.from({ length: 104 }, () => new Uint8Array(104)));
    static buildLevel = 0; // sb.h:I
    static minusedlevel = 99; // je.Z:I
    static m_floort1: Uint8Array[][] | null = null; // qe.V:[[[B
    static m_floort2: Uint8Array[][] | null = null; // ka.m:[[[B
    static m_floors: Uint8Array[][] | null = null; // ib.jb:[[[B
    static m_floorr: Uint8Array[][] | null = null; // lg.A:[[[B
    static m_mapo: Int32Array[][] | null = null; // ti.db:[[[I
    static m_shadow: Uint8Array[][] | null = null; // ke.E:[[[B
    static m_huetot: Int32Array | null = null; // t.ab:[I
    static m_sattot: Int32Array | null = null; // tf.E:[I
    static m_ligtot: Int32Array | null = null; // vk.O:[I
    static m_comtot: Int32Array | null = null; // li.B:[I
    static m_tot: Int32Array | null = null; // lc.A:[I

    // Browser scene collector at the nc.a call site until the native AddLoc scene builder is installed.
    static placeLocation: ((underwater: boolean, level: number, id: number, heightLevel: number, angle: number, shape: number, x: number, z: number, surface: boolean, collision: CollisionMap | null) => void) | null = null;

    // bc.a(III)Z. ClientBuild::ChangeLocAvailable, oldscape/jagex3/client/clientbuild.cpp:2781.
    static ChangeLocAvailable(id: number, shape: number): boolean {
        if (shape === 11) shape = 10;
        if (shape >= 5 && shape <= 8) shape = 4;
        const type = LocType.List(id);
        return type.CheckModel(shape);
    }

    // aj.a(ZI)V. gj.e passes -122.
    static Init(underwater: boolean): void {
        ClientBuild.m_ligtot = new Int32Array(104);
        ClientBuild.m_huetot = new Int32Array(104);
        ClientBuild.m_sattot = new Int32Array(104);
        ClientBuild.m_tot = new Int32Array(104);
        ClientBuild.minusedlevel = 99;
        ClientBuild.m_comtot = new Int32Array(104);
        const levels = underwater ? 1 : 4;
        ClientBuild.m_shadow = Array.from({ length: levels }, () => Array.from({ length: 105 }, () => new Uint8Array(105)));
        ClientBuild.m_floorr = Array.from({ length: levels }, () => Array.from({ length: 104 }, () => new Uint8Array(104)));
        ClientBuild.m_mapo = Array.from({ length: levels }, () => Array.from({ length: 105 }, () => new Int32Array(105)));
        ClientBuild.m_floort1 = Array.from({ length: levels }, () => Array.from({ length: 104 }, () => new Uint8Array(104)));
        ClientBuild.m_floort2 = Array.from({ length: levels }, () => Array.from({ length: 104 }, () => new Uint8Array(104)));
        ClientBuild.m_floors = Array.from({ length: levels }, () => Array.from({ length: 104 }, () => new Uint8Array(104)));
    }

    // lk.c(I)V
    static Quit(): void {
        ClientBuild.m_huetot = null;
        ClientBuild.m_floorr = null;
        ClientBuild.m_mapo = null;
        ClientBuild.m_comtot = null;
        ClientBuild.m_tot = null;
        ClientBuild.m_ligtot = null;
        ClientBuild.m_floors = null;
        ClientBuild.m_floort2 = null;
        ClientBuild.m_shadow = null;
        ClientBuild.m_sattot = null;
        ClientBuild.m_floort1 = null;
    }

    // fi.a(ZLgd;IIIIIZI)V. 530 uses byte-sized opcodes and overlay ids.
    static LoadGroundSquare(packet: PacketT | null, z: number, rotation: number, level: number, x: number, noiseZ: number, underwater: boolean, noiseX: number): void {
        if (x >= 0 && x < 104 && z >= 0 && z < 104) {
            if (!underwater) arrayPutU8(arrayAtObj(arrayAtObj(ClientBuild.m_mapl, level), x), z, 0);
            for (;;) {
                const opcode = requireNonNull(packet).g1();
                if (opcode === 0) {
                    if (!underwater) {
                        if (level === 0) {
                            arrayPutI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, 0), x), z, -8 * ClientBuild.PerlinNoise((932731 + x + noiseX) | 0, (noiseZ + 556238 + z) | 0));
                        } else {
                            arrayPutI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, level), x), z, (-240 + arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, (level - 1) | 0), x), z)) | 0);
                        }
                    } else {
                        arrayPutI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, 0), x), z, arrayAtI32(arrayAtObj(arrayAtObj(world.mainGroundh, 0), x), z));
                    }
                    return;
                }
                if (opcode === 1) {
                    let height = requireNonNull(packet).g1();
                    if (underwater) {
                        arrayPutI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, 0), x), z, (arrayAtI32(arrayAtObj(arrayAtObj(world.mainGroundh, 0), x), z) + 8 * height) | 0);
                    } else {
                        if (height === 1) height = 0;
                        if (level === 0) arrayPutI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, 0), x), z, -height * 8);
                        else arrayPutI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, level), x), z, (-8 * height + arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, (level - 1) | 0), x), z)) | 0);
                    }
                    return;
                }
                if (opcode <= 49) {
                    arrayPutU8(arrayAtObj(arrayAtObj(ClientBuild.m_floort2, level), x), z, requireNonNull(packet).g1s());
                    arrayPutU8(arrayAtObj(arrayAtObj(ClientBuild.m_floors, level), x), z, ((opcode - 2) / 4) | 0);
                    arrayPutU8(arrayAtObj(arrayAtObj(ClientBuild.m_floorr, level), x), z, (rotation + opcode - 2) & 3);
                } else if (opcode <= 81) {
                    if (!underwater) arrayPutU8(arrayAtObj(arrayAtObj(ClientBuild.m_mapl, level), x), z, opcode - 49);
                } else {
                    arrayPutU8(arrayAtObj(arrayAtObj(ClientBuild.m_floort1, level), x), z, opcode - 81);
                }
            }
        }
        for (;;) {
            const opcode = requireNonNull(packet).g1();
            if (opcode === 0) return;
            if (opcode === 1) {
                requireNonNull(packet).g1();
                return;
            }
            if (opcode <= 49) requireNonNull(packet).g1();
        }
    }

    // nk.a(IZIII[BI[Lke;)V. ClientBuild::LoadGround in oldscape/jagex3/client/clientbuild.cpp.
    static LoadGround(baseZ: number, underwater: boolean, noiseZ: number, baseX: number, data: Uint8Array | null, noiseX: number, collisionMaps: (CollisionMap | null)[] | null): void {
        const levels = underwater ? 1 : 4;
        if (!underwater) {
            for (let level = 0; level < 4; level++) {
                for (let dx = 0; dx < 64; dx++) {
                    const x = (baseX + dx) | 0;
                    for (let dz = 0; dz < 64; dz++) {
                        const z = (baseZ + dz) | 0;
                        if (x > 0 && x < 103 && z > 0 && z < 103) {
                            const row = arrayAtObj(requireNonNull(arrayAtObj(collisionMaps, level)).flags, x);
                            const flags = arrayAtI32(arrayAtObj(requireNonNull(arrayAtObj(collisionMaps, level)).flags, x), z);
                            arrayPutI32(row, z, flags & ~0x1000000);
                        }
                    }
                }
            }
        }
        const packet = new PacketT(data);
        for (let level = 0; level < levels; level++) {
            for (let dx = 0; dx < 64; dx++) {
                for (let dz = 0; dz < 64; dz++) {
                    ClientBuild.LoadGroundSquare(packet, (baseZ + dz) | 0, 0, level, (baseX + dx) | 0, noiseZ, underwater, noiseX);
                }
            }
        }
        let hasClearance = false;
        while (packet.m_pos < requireNonNull(packet.m_data).length) {
            if (packet.g1() !== 129) {
                packet.m_pos = (packet.m_pos - 1) | 0;
                break;
            }
            hasClearance = true;
            for (let level = 0; level < 4; level++) {
                const mode = packet.g1s();
                if (mode === 1) {
                    for (let dx = 0; dx < 64; dx += 4) {
                        for (let dz = 0; dz < 64; dz += 4) {
                            const value = packet.g1s();
                            for (let x = (baseX + dx) | 0; x < ((baseX + dx + 4) | 0); x = (x + 1) | 0) {
                                for (let z = (baseZ + dz) | 0; z < ((baseZ + dz + 4) | 0); z = (z + 1) | 0) {
                                    if (x >= 0 && x < 104 && z >= 0 && z < 104) {
                                        arrayPutU8(arrayAtObj(arrayAtObj(world.tileCameraClearance, level), x), z, value);
                                    }
                                }
                            }
                        }
                    }
                } else if (mode === 0 || (mode === 2 && level > 0)) {
                    const endX = Math.max(0, Math.min(104, (baseX + 64) | 0));
                    const endZ = Math.max(0, Math.min(104, (baseZ + 64) | 0));
                    // nk initializes z only once for the entire strip (bytecode 0x22a / 0x326).
                    let z = Math.max(0, Math.min(104, baseZ));
                    for (let x = Math.max(0, Math.min(104, baseX)); x < endX; x++) {
                        for (; z < endZ; z++) {
                            const row = arrayAtObj(arrayAtObj(world.tileCameraClearance, level), x);
                            const value = mode === 0 ? 0 : arrayAtU8(arrayAtObj(arrayAtObj(world.tileCameraClearance, level - 1), x), z);
                            arrayPutU8(row, z, value);
                        }
                    }
                }
            }
        }
        if (glJar && GlRenderer.active && !underwater) {
            const lights = PointLightManager;
            try {
                let environment: Environment | null = null;
                while (packet.m_pos < requireNonNull(packet.m_data).length) {
                    const opcode = packet.g1();
                    if (opcode !== 0) {
                        if (opcode !== 1) throw new Error('IllegalStateException');
                        const count = packet.g1();
                        for (let i = 0; i < count; i++) {
                            const light = new StaticPointLight(packet);
                            if (light.m_flickerType === 31) {
                                const type = LightType.List(packet.g2());
                                light.setFlicker(type.m_waveType, type.m_frequency, type.m_amplitude, type.m_offset);
                            }
                            light.z = (light.z + (baseZ << 7)) | 0;
                            light.x = (light.x + (baseX << 7)) | 0;
                            const z = light.z >> 7;
                            const x = light.x >> 7;
                            if (x < 0 || z < 0 || x >= 104 || z >= 104) continue;
                            light.bridge = (arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_mapl, 1), x), z) & 2) !== 0;
                            light.y = (arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, light.m_level), x), z) - light.y) | 0;
                            lights.add(light);
                        }
                    } else {
                        environment = new Environment(packet);
                    }
                }
                if (environment === null) environment = new Environment();
                for (let dx = 0; dx < 8; dx++) {
                    for (let dz = 0; dz < 8; dz++) {
                        const x = (baseX >> 3) + dx;
                        const z = (baseZ >> 3) + dz;
                        if (x >= 0 && x < 13 && z >= 0 && z < 13) arrayPutObj(arrayAtObj(Environment.grid, x), z, environment);
                    }
                }
            } catch (error) {
                if (!isJavaRuntimeException(error)) throw error;
                throw WrappedException.wrap(error, 'wa.OA(' + (collisionMaps === null ? 'null' : '{...}') + ',' + underwater + ',' + noiseZ + ',' + baseZ + ',4,' + baseX + ',' + noiseX + ',' + (data === null ? 'null' : '{...}') + ')');
            }
        }
        if (!hasClearance) {
            for (let level = 0; level < 4; level++) {
                for (let dx = 0; dx < 16; dx++) {
                    for (let dz = 0; dz < 16; dz++) {
                        const z = ((baseZ >> 2) + dz) | 0;
                        const x = ((baseX >> 2) + dx) | 0;
                        if (x >= 0 && x < 26 && z >= 0 && z < 26) {
                            arrayPutU8(arrayAtObj(arrayAtObj(world.tileCameraClearance, level), x), z, 0);
                        }
                    }
                }
            }
        }
    }

    // lk.a(IIII[BI[Lke;IIZI)V. wj.a uses 73 for the dummy argument.
    static LoadGroundRegion(baseX: number, sourceZ: number, baseZ: number, level: number, data: Uint8Array | null, rotation: number, collisionMaps: (CollisionMap | null)[] | null, sourceLevel: number, underwater: boolean, sourceX: number): void {
        try {
            const levels = underwater ? 1 : 4;
            if (!underwater) {
                for (let dx = 0; dx < 8; dx++) {
                    for (let dz = 0; dz < 8; dz++) {
                        const x = (baseX + dx) | 0;
                        const z = (baseZ + dz) | 0;
                        if (x > 0 && x < 103 && z > 0 && z < 103) {
                            const row = arrayAtObj(requireNonNull(arrayAtObj(collisionMaps, level)).flags, x);
                            const value = arrayAtI32(arrayAtObj(requireNonNull(arrayAtObj(collisionMaps, level)).flags, x), z);
                            arrayPutI32(row, z, value & ~0x1000000);
                        }
                    }
                }
            }
            const packet = new PacketT(data);
            for (let plane = 0; plane < levels; plane++) {
                for (let x = 0; x < 64; x++) {
                    for (let z = 0; z < 64; z++) {
                        if (plane === sourceLevel && x >= sourceX && x < ((sourceX + 8) | 0) && z >= sourceZ && z < ((sourceZ + 8) | 0)) {
                            ClientBuild.LoadGroundSquare(packet, (RegionRotate.RegionRotateZ(rotation, z & 7, x & 7) + baseZ) | 0, rotation, level, (RegionRotate.RegionRotateX(rotation, 2, z & 7, x & 7) + baseX) | 0, 0, underwater, 0);
                        } else {
                            ClientBuild.LoadGroundSquare(packet, -1, 0, 0, -1, 0, underwater, 0);
                        }
                    }
                }
            }
            while (packet.m_pos < requireNonNull(packet.m_data).length) {
                if (packet.g1(glJar ? -74 : undefined) !== 129) {
                    packet.m_pos = (packet.m_pos - 1) | 0;
                    break;
                }
                for (let plane = 0; plane < 4; plane++) {
                    const mode = packet.g1s(glJar ? false : undefined);
                    if (mode === 0 && sourceLevel >= plane) {
                        const endX = Math.max(0, Math.min(104, (baseX + 7) | 0));
                        const endZ = Math.max(0, Math.min(104, (baseZ + 7) | 0));
                        let z = Math.max(0, Math.min(104, baseZ));
                        for (let x = Math.max(0, Math.min(104, baseX)); x < endX; x++) {
                            for (; z < endZ; z++) arrayPutU8(arrayAtObj(arrayAtObj(world.tileCameraClearance, level), x), z, 0);
                        }
                    } else if (mode === 1) {
                        for (let dx = 0; dx < 64; dx += 4) {
                            for (let dz = 0; dz < 64; dz += 4) {
                                const value = packet.g1s(glJar ? false : undefined);
                                if (sourceLevel < plane) continue;
                                for (let x = dx; x < dx + 4; x++) {
                                    for (let z = dz; z < dz + 4; z++) {
                                        // The last comparison in the bytecode at 680 uses sourceZ twice.
                                        if (x >= sourceX && x < ((sourceX + 8) | 0) && sourceZ <= z && sourceZ < ((sourceZ + 8) | 0)) {
                                            const tileX = (baseX + RegionRotate.RegionRotateX(rotation, 2, z & 7, x & 7)) | 0;
                                            const tileZ = (RegionRotate.RegionRotateZ(rotation, z & 7, x & 7) + baseZ) | 0;
                                            if (tileX >= 0 && tileX < 104 && tileZ >= 0 && tileZ < 104) {
                                                arrayPutU8(arrayAtObj(arrayAtObj(world.tileCameraClearance, level), tileX), tileZ, value);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            // HD tm.a(III[Lmj;IB[BIIIZ)V, between the clearance extension and the unconditional final clear.
            if (glJar && GlRenderer.active && !underwater) {
                const lights = PointLightManager;
                let environment: Environment | null = null;
                while (packet.m_pos < requireNonNull(packet.m_data).length) {
                    const opcode = packet.g1(-33);
                    if (opcode !== 0) {
                        if (opcode !== 1) throw new Error('IllegalStateException');
                        const count = packet.g1(-71);
                        for (let i = 0; i < count; i++) {
                            const light = new StaticPointLight(packet);
                            if (light.m_flickerType === 31) {
                                const type = LightType.List(packet.g2(1));
                                light.setFlicker(type.m_waveType, type.m_frequency, type.m_amplitude, type.m_offset);
                            }
                            let x = light.x >> 7,
                                z = light.z >> 7;
                            if (sourceLevel !== light.m_level || x < sourceX || x >= ((sourceX + 8) | 0) || z < sourceZ || z >= ((sourceZ + 8) | 0)) continue;
                            const rotatedX = (ClientBuild.rotateLightX(rotation, light.x & 1023, light.z & 1023) + (baseX << 7)) | 0;
                            const rotatedZ = (ClientBuild.rotateLightZ(light.x & 1023, rotation, light.z & 1023) + (baseZ << 7)) | 0;
                            light.x = rotatedX;
                            light.z = rotatedZ;
                            x = light.x >> 7;
                            z = light.z >> 7;
                            if (x >= 0 && z >= 0 && x < 104 && z < 104) {
                                light.bridge = (arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_mapl, 1), x), z) & 2) !== 0;
                                light.y = (arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, light.m_level), x), z) - light.y) | 0;
                                lights.add(light);
                            }
                        }
                    } else {
                        environment = new Environment(packet);
                    }
                }
                if (environment === null) environment = new Environment();
                arrayPutObj(arrayAtObj(Environment.grid, baseX >> 3), baseZ >> 3, environment);
            }
            // lk always clears the first seven rows and columns after reading the extension.
            for (let x = baseX; x < ((baseX + 7) | 0); x++) {
                for (let z = baseZ; z < ((baseZ + 7) | 0); z++) {
                    arrayPutU8(arrayAtObj(arrayAtObj(world.tileCameraClearance, level), x), z, 0);
                }
            }
        } catch (error) {
            if (!glJar || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(
                error,
                'tm.E(' +
                    rotation +
                    ',' +
                    baseX +
                    ',' +
                    level +
                    ',' +
                    (collisionMaps === null ? 'null' : '{...}') +
                    ',' +
                    baseZ +
                    ',-100,' +
                    (data === null ? 'null' : '{...}') +
                    ',' +
                    sourceLevel +
                    ',' +
                    sourceZ +
                    ',' +
                    sourceX +
                    ',' +
                    underwater +
                    ')'
            );
        }
    }

    // HD qi.a(IIBI)I and ol.a(IIZI)I rotate fine coordinates within a 1024-unit chunk.
    private static rotateLightX(rotation: number, x: number, z: number): number {
        rotation &= 3;
        if (rotation === 0) return x;
        if (rotation === 1) return z;
        if (rotation === 2) return (1023 - x) | 0;
        return (1023 - z) | 0;
    }

    private static rotateLightZ(x: number, rotation: number, z: number): number {
        rotation &= 3;
        if (rotation === 0) return z;
        if (rotation === 1) return (1023 - x) | 0;
        if (rotation === 2) return (1023 - z) | 0;
        return x;
    }

    // bk.a(IIIBII)V. g.a supplies 125 for a square and wj.a supplies 123 for a chunk.
    static clearMapArea(x: number, width: number, z: number, height: number, level: number): void {
        const endX = (x + width) | 0;
        const endZ = (z + height) | 0;
        for (let tileZ = z; tileZ <= endZ; tileZ = (tileZ + 1) | 0) {
            for (let tileX = x; tileX <= endX; tileX = (tileX + 1) | 0) {
                if (tileX >= 0 && tileX < 104 && tileZ >= 0 && tileZ < 104) {
                    arrayPutU8(arrayAtObj(arrayAtObj(ClientBuild.m_shadow, level), tileX), tileZ, 127);
                }
            }
        }
        for (let tileZ = z; tileZ < endZ; tileZ = (tileZ + 1) | 0) {
            for (let tileX = x; tileX < endX; tileX = (tileX + 1) | 0) {
                if (tileX >= 0 && tileX < 104 && tileZ >= 0 && tileZ < 104) {
                    arrayPutI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, level), tileX), tileZ, level > 0 ? arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, level - 1), tileX), tileZ) : 0);
                }
            }
        }
        if (x > 0 && x < 104) {
            for (let tileZ = (z + 1) | 0; tileZ < endZ; tileZ = (tileZ + 1) | 0) {
                if (tileZ >= 0 && tileZ < 104) {
                    arrayPutI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, level), x), tileZ, arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, level), x - 1), tileZ));
                }
            }
        }
        if (z > 0 && z < 104) {
            for (let tileX = (x + 1) | 0; tileX < endX; tileX = (tileX + 1) | 0) {
                if (tileX >= 0 && tileX < 104) {
                    arrayPutI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, level), tileX), z, arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, level), tileX), z - 1));
                }
            }
        }
        if (x < 0 || z < 0 || x >= 104 || z >= 104) return;
        if (level === 0) {
            if (x > 0 && arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, level), x - 1), z) !== 0) {
                arrayPutI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, level), x), z, arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, level), x - 1), z));
            } else if (z > 0 && arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, level), x), z - 1) !== 0) {
                arrayPutI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, level), x), z, arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, level), x), z - 1));
            } else if (x > 0 && z > 0 && arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, level), x - 1), z - 1) !== 0) {
                arrayPutI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, level), x), z, arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, level), x - 1), z - 1));
            }
        } else {
            if (x > 0 && arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, level), x - 1), z) !== arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, level - 1), x - 1), z)) {
                arrayPutI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, level), x), z, arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, level), x - 1), z));
            } else if (z > 0 && arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, level - 1), x), z - 1) !== arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, level), x), z - 1)) {
                arrayPutI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, level), x), z, arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, level), x), z - 1));
            } else if (x > 0 && z > 0 && arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, level), x - 1), z - 1) !== arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, level - 1), x - 1), z - 1)) {
                arrayPutI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, level), x), z, arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, level), x - 1), z - 1));
            }
        }
    }

    // ec.a(ZIII)I. ClientBuild::VisLevel calls IsVisBelow then IsLinkBelow.
    static VisLevel(x: number, level: number, z: number): number {
        if ((arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_mapl, level), x), z) & 8) !== 0) return 0;
        if (level > 0 && (arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_mapl, 1), x), z) & 2) !== 0) return (level - 1) | 0;
        return level;
    }

    // wj.a(ZI)V. gj.e calls wj.a(false,99) on a dynamic rebuild.
    static loadDynamicGround(underwater: boolean): void {
        const underwaterLayer = glJar && GlRenderer.active && underwater;
        const land = underwaterLayer ? Client.sceneMapUnderwaterLandData : Client.sceneMapLandData;
        for (let level = 0; level < (underwaterLayer ? 1 : 4); level++) {
            AudioEngine.tick();
            for (let x = 0; x < 13; x++) {
                for (let z = 0; z < 13; z++) {
                    let loaded = false;
                    const template = arrayAtI32(arrayAtObj(arrayAtObj(Client.dynamicChunks, level), x), z);
                    if (template !== -1) {
                        const sourceLevel = (0x37bafb7 & template) >> 24;
                        if (!underwater || sourceLevel === 0) {
                            const rotation = (template & 6) >> 1;
                            const sourceZ = (template & 0x3ffd) >> 3;
                            const sourceX = (template >> 14) & 1023;
                            const region = (sourceZ >> 3) + ((sourceX >> 3) << 8);
                            for (let i = 0; i < requireNonNull(Client.mapBuildIndex).length; i++) {
                                if (arrayAtI32(Client.mapBuildIndex, i) === region && arrayAtObj(land, i) !== null) {
                                    loaded = true;
                                    ClientBuild.LoadGroundRegion(x * 8, (sourceZ & 7) * 8, z * 8, level, arrayAtObj(land, i), rotation, CollisionMap.levelMaps, sourceLevel, underwater, (sourceX & 7) * 8);
                                    break;
                                }
                            }
                        }
                    }
                    if (!loaded) ClientBuild.clearMapArea(x * 8, 8, z * 8, 8, level);
                }
            }
        }
    }

    // hi.a(BI[Lke;[BIZ)V. ClientBuild::LoadLocations.
    static LoadLocations(baseX: number, collisionMaps: (CollisionMap | null)[] | null, data: Uint8Array | null, baseZ: number, underwater: boolean): void {
        const packet = new PacketT(data);
        let id = -1;
        for (;;) {
            const delta = packet.gSmartsExtend();
            if (delta === 0) return;
            id = (id + delta) | 0;
            let position = 0;
            for (;;) {
                const step = packet.gSmart1or2();
                if (step === 0) break;
                position = (position + step - 1) | 0;
                const localZ = position & 63;
                const localX = (position & 4089) >> 6;
                const info = packet.g1();
                const level = position >> 12;
                const angle = info & 3;
                const shape = info >> 2;
                const z = (localZ + baseZ) | 0;
                const x = (baseX + localX) | 0;
                if (x <= 0 || z <= 0 || x >= 103 || z >= 103) continue;
                let collision = null;
                if (!underwater) {
                    let collisionLevel = level;
                    if ((arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_mapl, 1), x), z) & 2) === 2) collisionLevel = (level - 1) | 0;
                    if (collisionLevel >= 0) collision = arrayAtObj(collisionMaps, collisionLevel);
                }
                if (SceneCutover.active) {
                    ClientBuild.AddLoc(underwater, level, id, level, angle, shape, x, z, !underwater, collision);
                } else {
                    requireNonNull(ClientBuild.placeLocation)(underwater, level, id, level, angle, shape, x, z, !underwater, collision);
                }
            }
        }
    }

    // ck.a(II[Lke;BII[BIZII)V. ClientBuild::LoadLocationsRegion.
    static LoadLocationsRegion(baseX: number, sourceX: number, collisionMaps: (CollisionMap | null)[] | null, rotation: number, sourceLevel: number, data: Uint8Array | null, baseZ: number, underwater: boolean, level: number, sourceZ: number): void {
        const packet = new PacketT(data);
        let id = -1;
        for (;;) {
            const delta = packet.gSmartsExtend();
            if (delta === 0) return;
            let position = 0;
            id = (id + delta) | 0;
            for (;;) {
                const step = packet.gSmart1or2();
                if (step === 0) break;
                position = (position + step - 1) | 0;
                const localX = (position & 4089) >> 6;
                const plane = position >> 12;
                const info = packet.g1();
                const shape = info >> 2;
                const angle = info & 3;
                const localZ = position & 63;
                if (plane !== sourceLevel || localX < sourceX || localX >= ((sourceX + 8) | 0) || sourceZ > localZ || localZ >= ((sourceZ + 8) | 0)) continue;
                const type = LocType.List(id);
                const x = (baseX + RegionRotate.RegionRotateLocationX(localZ & 7, localX & 7, type.length, angle, type.width, rotation)) | 0;
                const z = (baseZ + RegionRotate.RegionRotateLocationZ(rotation, type.width, localZ & 7, type.length, angle, localX & 7)) | 0;
                if (x <= 0 || z <= 0 || x >= 103 || z >= 103) continue;
                let collision = null;
                if (!underwater) {
                    let collisionLevel = level;
                    if ((arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_mapl, 1), x), z) & 2) === 2) collisionLevel = (level - 1) | 0;
                    if (collisionLevel >= 0) collision = arrayAtObj(collisionMaps, collisionLevel);
                }
                if (SceneCutover.active) {
                    ClientBuild.AddLoc(underwater, level, id, level, (rotation + angle) & 3, shape, x, z, !underwater, collision);
                } else {
                    requireNonNull(ClientBuild.placeLocation)(underwater, level, id, level, (rotation + angle) & 3, shape, x, z, !underwater, collision);
                }
            }
        }
    }

    // nc.a(ZIIIIIIIZLke;I)V. ClientBuild::AddLoc (oldscape/jagex3/client/clientbuild.cpp:765, an OSRS body with fewer
    // arguments). Places loc locId with shape and angle at tile (x, z) of world level `level`: ground decor (22) through
    // world.SetGroundDecor, scenery (10/11 sized by the rotated footprint, 12+ and 9 single-tile) through
    // world.AddScenery, walls (0-3) through world.SetWall with the WSHAPE0/WSHAPE1 masks and wall decor (4-8) through
    // world.SetDecor with the DECORXOF/DECORZOF (5) or DECORXOF2/DECORZOF2 (6, 8) offsets scaled by the wall's width. A
    // loc with an animation, a multiloc list or particles gets a ClientLocAnim, otherwise the LocType.GetModel model.
    // Typecode: x | z << 7 | shape << 14 | angle << 20 | 1 << 30, bit 22 for raiseObject 1, bit 31 for flag96, the loc
    // id in bits 32-62 and bit 63 when the loc is inactive or underwater.
    // underwater (Java var0): hi.a and ck.a pass their underwater flag, o.a passes false. It picks the surface heightmap
    // world.mainGroundh[0] as the hill-skew second heightmap, sets typecode bit 63 and clears GetModel's last flag.
    // heightLevel (var3): the levelHeightmaps level for the ground height (and level + 1 for the hill-skew second
    // heightmap); the level ClientLocAnim keeps. hi.a and ck.a pass level; o.a passes level + 1 when level < 3 and the
    // tile's plane-1 m_mapl entry has the bridge flag 2.
    // building (var8): hi.a and ck.a pass !underwater, o.a passes false. It gates the low-detail build-level return,
    // asks GetModel for share-light models and writes the m_shadow / m_mapo grids that the ground build consumes.
    // Stripped: the nc.p counter, the od.a wrapper, the client.wb branches (labelled breaks and the duplicated loop entry
    // of the shape-10 shadow loop), ok.a(II)I (inlined as |) and the dummy int last argument: all three callers pass
    // iconst_2 (hi.a bytecode 246, ck.a 371, o.a 181) and `if (var10 != 2) return` at 468 never returns (nc.b(B)V's
    // call with 95 sits behind `if (var0 != 104)`, and its only caller passes 104). Callee dummies dropped by their
    // ports: dl.a(Z)Z true, ke.a(II)Ljb; 11525, ec.a false, jb.a(B)Z -95, GetModel's byte (-46 .. -112, all < -38),
    // CollisionMap ke.a(ZII)V false, ke.a(IBZIII)V 70, ke.a(IZIIZI)V true. AreaSoundManager.add folds da.a's 128 (a live
    // multiplier, 128 at every caller). Locals keep the decompiler's names; branches follow the bytecode's order, each
    // shape block returning.
    static AddLoc(underwater: boolean, level: number, locId: number, heightLevel: number, angle: number, shape: number, x: number, z: number, building: boolean, collision: CollisionMap | null): void {
        if (building && !Preferences.getAllLevelsVisible() && (2 & ((arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_mapl, 0), x), z) << 24) >> 24)) === 0) {
            if ((16 & ((arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_mapl, level), x), z) << 24) >> 24)) !== 0) {
                return;
            }

            if (ClientBuild.VisLevel(x, level, z) !== ClientBuild.buildLevel) {
                return;
            }
        }

        if (level < ClientBuild.minusedlevel) {
            ClientBuild.minusedlevel = level;
        }

        const var11 = LocType.List(locId);
        if (glJar && GlRenderer.active && var11.field_844) return;
        // var12/var13: the footprint in x/z (width and length swapped at angles 1 and 3).
        let var12: number;
        let var13: number;
        if (angle !== 1 && angle !== 3) {
            var12 = var11.width;
            var13 = var11.length;
        } else {
            var13 = var11.width;
            var12 = var11.length;
        }

        let var14: number;
        let var15: number;
        if (((x + var12) | 0) > 104) {
            var14 = x;
            var15 = (x + 1) | 0;
        } else {
            var15 = (x + ((var12 + 1) >> 1)) | 0;
            var14 = ((var12 >> 1) + x) | 0;
        }

        let var16: number;
        let var17: number;
        if (((z + var13) | 0) <= 104) {
            var17 = (((1 + var13) >> 1) + z) | 0;
            var16 = (z + (var13 >> 1)) | 0;
        } else {
            var17 = (z + 1) | 0;
            var16 = z;
        }

        const var18 = arrayAtObj(world.levelHeightmaps, heightLevel);
        // var19: the mean of the four corner heights around the footprint's centre.
        const var19 = (arrayAtI32(arrayAtObj(var18, var14), var17) + ((((arrayAtI32(arrayAtObj(var18, var15), var16) + arrayAtI32(arrayAtObj(var18, var14), var16)) | 0) - -arrayAtI32(arrayAtObj(var18, var15), var17)) | 0)) >> 2;
        // var20/var21: the footprint centre in fine x/z.
        const var20 = ((x << 7) + (var12 << 6)) | 0;
        const var21 = ((var13 << 6) + (z << 7)) | 0;
        let shadowY = 0;
        if (glJar && GlRenderer.active && heightLevel !== 0) {
            const surface = arrayAtObj(world.levelHeightmaps, 0);
            shadowY = (var19 - ((arrayAtI32(arrayAtObj(surface, var15), var17) + (arrayAtI32(arrayAtObj(surface, var15), var16) + arrayAtI32(arrayAtObj(surface, var14), var16)) + arrayAtI32(arrayAtObj(surface, var14), var17)) >> 2)) | 0;
        }
        let var22: Int32Array[] | null = null;
        if (underwater) {
            var22 = arrayAtObj(world.mainGroundh, 0);
        } else if (heightLevel < 3) {
            var22 = arrayAtObj(world.levelHeightmaps, (heightLevel - -1) | 0);
        }

        let var23 = BigInt((shape << 14) | (x | (z << 7)) | (angle << 20) | 1073741824);
        if (var11.active === 0 || underwater) {
            var23 = BigInt.asIntN(64, var23 | -9223372036854775808n);
        }

        if (var11.raiseObject === 1) {
            var23 = BigInt.asIntN(64, var23 | 4194304n);
        }

        if (var11.flag96) {
            var23 = BigInt.asIntN(64, var23 | 2147483648n);
        }

        if (var11.HasBgSound()) {
            AreaSoundManager.add(z, var11, level, null, x, null, angle);
        }

        const var25 = var11.flag88 && !underwater;
        var23 = BigInt.asIntN(64, var23 | BigInt.asIntN(64, BigInt(locId) << 32n));
        if (shape === 22) {
            if (!Preferences.graphics.showGroundDecorations && var11.active === 0 && var11.blockwalk !== 1 && !var11.forceDecor) {
                return;
            }

            let var47: ModelSource | null;
            if (var11.animation !== -1 || var11.multi !== null || var11.hasParticles) {
                var47 = new ClientLocAnim(locId, 22, angle, heightLevel, x, z, var11.animation, var11.randomAnimFrame, null);
            } else {
                const var60 = var11.GetModel(var22, 22, angle, var19, building, var18, null, var21, var20, var25);
                if (glJar && GlRenderer.active && var25) GroundShadows.addLoc(var60.shadow, var20, shadowY, var21);
                var47 = var60.model;
            }

            world.SetGroundDecor(level, x, z, var19, var47, var23, var11.flag90);
            if (var11.blockwalk === 1 && collision !== null) {
                collision.blockGroundDecor(x, z);
            }

            return;
        }

        if (shape === 10 || shape === 11) {
            let var26: ModelSource | null;
            if (var11.animation === -1 && var11.multi === null && !var11.hasParticles) {
                const var27 = var11.GetModel(var22, 10, shape !== 11 ? angle : (angle + 4) | 0, var19, building, var18, null, var21, var20, var25);
                if (glJar && GlRenderer.active && var25) GroundShadows.addLoc(var27.shadow, var20, shadowY, var21);
                var26 = var27.model;
            } else {
                var26 = new ClientLocAnim(locId, 10, shape === 11 ? (angle + 4) | 0 : angle, heightLevel, x, z, var11.animation, var11.randomAnimFrame, null);
            }

            if (var26 !== null) {
                const var48 = world.AddScenery(level, x, z, var19, var12, var13, var26, 0, var23);
                if (var11.shadow && var48 && building) {
                    let var28 = 15;
                    if (var26 instanceof ModelLit) {
                        var28 = (var26.GetRadiusCylinder() / 4) | 0;
                        if (var28 > 30) {
                            var28 = 30;
                        }
                    }

                    for (let var29 = 0; var29 <= var12; var29 = (var29 + 1) | 0) {
                        for (let var30 = 0; var13 >= var30; var30 = (var30 + 1) | 0) {
                            if ((arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_shadow, level), (var29 + x) | 0), (z + var30) | 0) << 24) >> 24 < var28) {
                                // (byte) var28: the Uint8Array store keeps the low 8 bits, as bastore does.
                                arrayPutU8(arrayAtObj(arrayAtObj(ClientBuild.m_shadow, level), (x - -var29) | 0), (var30 + z) | 0, var28);
                            }
                        }
                    }
                }
            }

            if (var11.blockwalk !== 0 && collision !== null) {
                collision.addLoc(x, z, var12, var13, var11.blockrange);
            }

            return;
        }

        if (shape >= 12) {
            let var46: ModelSource | null;
            if (var11.animation === -1 && var11.multi === null && !var11.hasParticles) {
                const var59 = var11.GetModel(var22, shape, angle, var19, building, var18, null, var21, var20, var25);
                if (glJar && GlRenderer.active && var25) GroundShadows.addLoc(var59.shadow, var20, shadowY, var21);
                var46 = var59.model;
            } else {
                var46 = new ClientLocAnim(locId, shape, angle, heightLevel, x, z, var11.animation, var11.randomAnimFrame, null);
            }

            world.AddScenery(level, x, z, var19, 1, 1, var46, 0, var23);
            if (building && shape >= 12 && shape <= 17 && shape !== 13 && level > 0) {
                arrayPutI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, level), x), z, arrayAtI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, level), x), z) | 4);
            }

            if (var11.blockwalk !== 0 && collision !== null) {
                collision.addLoc(x, z, var12, var13, var11.blockrange);
            }

            return;
        }

        if (shape === 0) {
            let var45: ModelSource | null;
            if (var11.animation !== -1 || var11.multi !== null || var11.hasParticles) {
                var45 = new ClientLocAnim(locId, 0, angle, heightLevel, x, z, var11.animation, var11.randomAnimFrame, null);
            } else {
                const var58 = var11.GetModel(var22, 0, angle, var19, building, var18, null, var21, var20, var25);
                if (glJar && GlRenderer.active && var25) GroundShadows.addLoc(var58.shadow, var20, shadowY, var21);
                var45 = var58.model;
            }

            world.SetWall(level, x, z, var19, var45, null, arrayAtI32(ClientBuild.WSHAPE0, angle), 0, var23);
            if (building) {
                if (angle === 0) {
                    if (var11.shadow) {
                        arrayPutU8(arrayAtObj(arrayAtObj(ClientBuild.m_shadow, level), x), z, 50);
                        arrayPutU8(arrayAtObj(arrayAtObj(ClientBuild.m_shadow, level), x), (1 + z) | 0, 50);
                    }

                    if (var11.occludes) {
                        arrayPutI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, level), x), z, arrayAtI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, level), x), z) | 1);
                    }
                } else if (angle === 1) {
                    if (var11.shadow) {
                        arrayPutU8(arrayAtObj(arrayAtObj(ClientBuild.m_shadow, level), x), (1 + z) | 0, 50);
                        arrayPutU8(arrayAtObj(arrayAtObj(ClientBuild.m_shadow, level), (1 + x) | 0), (z + 1) | 0, 50);
                    }

                    if (var11.occludes) {
                        arrayPutI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, level), x), (z + 1) | 0, arrayAtI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, level), x), (z + 1) | 0) | 2);
                    }
                } else if (angle === 2) {
                    if (var11.shadow) {
                        arrayPutU8(arrayAtObj(arrayAtObj(ClientBuild.m_shadow, level), (1 + x) | 0), z, 50);
                        arrayPutU8(arrayAtObj(arrayAtObj(ClientBuild.m_shadow, level), (x + 1) | 0), (z - -1) | 0, 50);
                    }

                    if (var11.occludes) {
                        arrayPutI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, level), (1 + x) | 0), z, arrayAtI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, level), (1 + x) | 0), z) | 1);
                    }
                } else if (angle === 3) {
                    if (var11.shadow) {
                        arrayPutU8(arrayAtObj(arrayAtObj(ClientBuild.m_shadow, level), x), z, 50);
                        arrayPutU8(arrayAtObj(arrayAtObj(ClientBuild.m_shadow, level), (1 + x) | 0), z, 50);
                    }

                    if (var11.occludes) {
                        arrayPutI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, level), x), z, arrayAtI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, level), x), z) | 2);
                    }
                }
            }

            if (var11.blockwalk !== 0 && collision !== null) {
                collision.addWall(x, z, shape, angle, var11.blockrange);
            }

            if (var11.wallWidth !== 16) {
                world.MoveDecor(level, x, z, var11.wallWidth);
            }

            return;
        }

        if (shape === 1) {
            let var44: ModelSource | null;
            if (var11.animation !== -1 || var11.multi !== null || var11.hasParticles) {
                var44 = new ClientLocAnim(locId, 1, angle, heightLevel, x, z, var11.animation, var11.randomAnimFrame, null);
            } else {
                const var57 = var11.GetModel(var22, 1, angle, var19, building, var18, null, var21, var20, var25);
                if (glJar && GlRenderer.active && var25) GroundShadows.addLoc(var57.shadow, var20, shadowY, var21);
                var44 = var57.model;
            }

            world.SetWall(level, x, z, var19, var44, null, arrayAtI32(ClientBuild.WSHAPE1, angle), 0, var23);
            if (var11.shadow && building) {
                if (angle === 0) {
                    arrayPutU8(arrayAtObj(arrayAtObj(ClientBuild.m_shadow, level), x), (z + 1) | 0, 50);
                } else if (angle === 1) {
                    arrayPutU8(arrayAtObj(arrayAtObj(ClientBuild.m_shadow, level), (1 + x) | 0), (1 + z) | 0, 50);
                } else if (angle === 2) {
                    arrayPutU8(arrayAtObj(arrayAtObj(ClientBuild.m_shadow, level), (x + 1) | 0), z, 50);
                } else if (angle === 3) {
                    arrayPutU8(arrayAtObj(arrayAtObj(ClientBuild.m_shadow, level), x), z, 50);
                }
            }

            if (var11.blockwalk !== 0 && collision !== null) {
                collision.addWall(x, z, shape, angle, var11.blockrange);
            }

            return;
        }

        if (shape === 2) {
            const var43 = 3 & (angle + 1);
            let var56: ModelSource | null;
            let var62: ModelSource | null;
            if (var11.animation !== -1 || var11.multi !== null || var11.hasParticles) {
                var56 = new ClientLocAnim(locId, 2, (angle + 4) | 0, heightLevel, x, z, var11.animation, var11.randomAnimFrame, null);
                var62 = new ClientLocAnim(locId, 2, var43, heightLevel, x, z, var11.animation, var11.randomAnimFrame, null);
            } else {
                let var66 = var11.GetModel(var22, 2, (4 + angle) | 0, var19, building, var18, null, var21, var20, var25);
                if (glJar && GlRenderer.active && var25) GroundShadows.addLoc(var66.shadow, var20, shadowY, var21);
                var56 = var66.model;
                var66 = var11.GetModel(var22, 2, var43, var19, building, var18, null, var21, var20, var25);
                if (glJar && GlRenderer.active && var25) GroundShadows.addLoc(var66.shadow, var20, shadowY, var21);
                var62 = var66.model;
            }

            world.SetWall(level, x, z, var19, var56, var62, arrayAtI32(ClientBuild.WSHAPE0, angle), arrayAtI32(ClientBuild.WSHAPE0, var43), var23);
            if (var11.occludes && building) {
                if (angle === 0) {
                    arrayPutI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, level), x), z, arrayAtI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, level), x), z) | 1);
                    arrayPutI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, level), x), (z + 1) | 0, arrayAtI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, level), x), (z + 1) | 0) | 2);
                } else if (angle === 1) {
                    arrayPutI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, level), x), (z + 1) | 0, arrayAtI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, level), x), (z + 1) | 0) | 2);
                    arrayPutI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, level), (1 + x) | 0), z, arrayAtI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, level), (1 + x) | 0), z) | 1);
                } else if (angle === 2) {
                    arrayPutI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, level), (1 + x) | 0), z, arrayAtI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, level), (1 + x) | 0), z) | 1);
                    arrayPutI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, level), x), z, arrayAtI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, level), x), z) | 2);
                } else if (angle === 3) {
                    arrayPutI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, level), x), z, arrayAtI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, level), x), z) | 2);
                    arrayPutI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, level), x), z, arrayAtI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, level), x), z) | 1);
                }
            }

            if (var11.blockwalk !== 0 && collision !== null) {
                collision.addWall(x, z, shape, angle, var11.blockrange);
            }

            if (var11.wallWidth !== 16) {
                world.MoveDecor(level, x, z, var11.wallWidth);
            }

            return;
        }

        if (shape === 3) {
            let var42: ModelSource | null;
            if (var11.animation !== -1 || var11.multi !== null || var11.hasParticles) {
                var42 = new ClientLocAnim(locId, 3, angle, heightLevel, x, z, var11.animation, var11.randomAnimFrame, null);
            } else {
                const var55 = var11.GetModel(var22, 3, angle, var19, building, var18, null, var21, var20, var25);
                if (glJar && GlRenderer.active && var25) GroundShadows.addLoc(var55.shadow, var20, shadowY, var21);
                var42 = var55.model;
            }

            world.SetWall(level, x, z, var19, var42, null, arrayAtI32(ClientBuild.WSHAPE1, angle), 0, var23);
            if (var11.shadow && building) {
                if (angle === 0) {
                    arrayPutU8(arrayAtObj(arrayAtObj(ClientBuild.m_shadow, level), x), (1 + z) | 0, 50);
                } else if (angle === 1) {
                    arrayPutU8(arrayAtObj(arrayAtObj(ClientBuild.m_shadow, level), (x + 1) | 0), (z - -1) | 0, 50);
                } else if (angle === 2) {
                    arrayPutU8(arrayAtObj(arrayAtObj(ClientBuild.m_shadow, level), (x - -1) | 0), z, 50);
                } else if (angle === 3) {
                    arrayPutU8(arrayAtObj(arrayAtObj(ClientBuild.m_shadow, level), x), z, 50);
                }
            }

            if (var11.blockwalk !== 0 && collision !== null) {
                collision.addWall(x, z, shape, angle, var11.blockrange);
            }

            return;
        }

        if (shape === 9) {
            let var41: ModelSource | null;
            if (var11.animation === -1 && var11.multi === null && !var11.hasParticles) {
                const var54 = var11.GetModel(var22, shape, angle, var19, building, var18, null, var21, var20, var25);
                if (glJar && GlRenderer.active && var25) GroundShadows.addLoc(var54.shadow, var20, shadowY, var21);
                var41 = var54.model;
            } else {
                var41 = new ClientLocAnim(locId, shape, angle, heightLevel, x, z, var11.animation, var11.randomAnimFrame, null);
            }

            world.AddScenery(level, x, z, var19, 1, 1, var41, 0, var23);
            if (var11.blockwalk !== 0 && collision !== null) {
                collision.addLoc(x, z, var12, var13, var11.blockrange);
            }

            if (var11.wallWidth !== 16) {
                world.MoveDecor(level, x, z, var11.wallWidth);
            }

            return;
        }

        if (shape === 4) {
            let var40: ModelSource | null;
            if (var11.animation !== -1 || var11.multi !== null || var11.hasParticles) {
                var40 = new ClientLocAnim(locId, 4, angle, heightLevel, x, z, var11.animation, var11.randomAnimFrame, null);
            } else {
                const var53 = var11.GetModel(var22, 4, angle, var19, building, var18, null, var21, var20, var25);
                if (glJar && GlRenderer.active && var25) GroundShadows.addLoc(var53.shadow, var20, shadowY, var21);
                var40 = var53.model;
            }

            world.SetDecor(level, x, z, var19, var40, null, arrayAtI32(ClientBuild.WSHAPE0, angle), 0, 0, 0, var23);
            return;
        }

        if (shape === 5) {
            let var39 = 16;
            const var52 = world.WallType(level, x, z);
            if (var52 !== 0n) {
                // (int) (var52 >>> 32) & 0x7fffffff: the wall's loc id.
                var39 = LocType.List(Number(BigInt.asIntN(32, BigInt.asUintN(64, var52) >> 32n)) & 2147483647).wallWidth;
            }

            let var65: ModelSource | null;
            if (var11.animation === -1 && var11.multi === null && !var11.hasParticles) {
                const var70 = var11.GetModel(var22, 4, angle, var19, building, var18, null, var21, var20, var25);
                if (glJar && GlRenderer.active && var25) GroundShadows.addLoc(var70.shadow, (var20 - Math.imul(8, arrayAtI32(ClientBuild.DECORXOF, angle))) | 0, shadowY, (var21 - Math.imul(8, arrayAtI32(ClientBuild.DECORZOF, angle))) | 0);
                var65 = var70.model;
            } else {
                var65 = new ClientLocAnim(locId, 4, angle, heightLevel, x, z, var11.animation, var11.randomAnimFrame, null);
            }

            world.SetDecor(level, x, z, var19, var65, null, arrayAtI32(ClientBuild.WSHAPE0, angle), 0, Math.imul(var39, arrayAtI32(ClientBuild.DECORXOF, angle)), Math.imul(var39, arrayAtI32(ClientBuild.DECORZOF, angle)), var23);
            return;
        }

        if (shape === 6) {
            let var38 = 8;
            const var51 = world.WallType(level, x, z);
            if (var51 !== 0n) {
                var38 = (LocType.List(Number(BigInt.asIntN(32, BigInt.asUintN(64, var51) >> 32n)) & 2147483647).wallWidth / 2) | 0;
            }

            let var64: ModelSource | null;
            if (var11.animation !== -1 || var11.multi !== null || var11.hasParticles) {
                var64 = new ClientLocAnim(locId, 4, (4 + angle) | 0, heightLevel, x, z, var11.animation, var11.randomAnimFrame, null);
            } else {
                const var69 = var11.GetModel(var22, 4, (4 + angle) | 0, var19, building, var18, null, var21, var20, var25);
                if (glJar && GlRenderer.active && var25) GroundShadows.addLoc(var69.shadow, (var20 - Math.imul(8, arrayAtI32(ClientBuild.DECORXOF2, angle))) | 0, shadowY, (var21 - Math.imul(8, arrayAtI32(ClientBuild.DECORZOF2, angle))) | 0);
                var64 = var69.model;
            }

            world.SetDecor(level, x, z, var19, var64, null, 256, angle, Math.imul(arrayAtI32(ClientBuild.DECORXOF2, angle), var38), Math.imul(arrayAtI32(ClientBuild.DECORZOF2, angle), var38), var23);
            return;
        }

        if (shape === 7) {
            const var50 = 3 & (angle - -2);
            let var37: ModelSource | null;
            if (var11.animation === -1 && var11.multi === null && !var11.hasParticles) {
                const var61 = var11.GetModel(var22, 4, (4 + var50) | 0, var19, building, var18, null, var21, var20, var25);
                if (glJar && GlRenderer.active && var25) GroundShadows.addLoc(var61.shadow, var20, shadowY, var21);
                var37 = var61.model;
            } else {
                var37 = new ClientLocAnim(locId, 4, (4 + var50) | 0, heightLevel, x, z, var11.animation, var11.randomAnimFrame, null);
            }

            world.SetDecor(level, x, z, var19, var37, null, 256, var50, 0, 0, var23);
            return;
        }

        if (shape === 8) {
            let var36 = 8;
            const var49 = world.WallType(level, x, z);
            if (var49 !== 0n) {
                var36 = (LocType.List(2147483647 & Number(BigInt.asIntN(32, BigInt.asUintN(64, var49) >> 32n))).wallWidth / 2) | 0;
            }

            const var31 = 3 & (2 + angle);
            let var63: ModelSource | null;
            let var68: ModelSource | null;
            if (var11.animation !== -1 || var11.multi !== null || var11.hasParticles) {
                var63 = new ClientLocAnim(locId, 4, (angle - -4) | 0, heightLevel, x, z, var11.animation, var11.randomAnimFrame, null);
                var68 = new ClientLocAnim(locId, 4, (4 + var31) | 0, heightLevel, x, z, var11.animation, var11.randomAnimFrame, null);
            } else {
                const shadowZOffset = glJar ? Math.imul(8, arrayAtI32(ClientBuild.DECORZOF2, angle)) : 0;
                const shadowXOffset = glJar ? Math.imul(8, arrayAtI32(ClientBuild.DECORXOF2, angle)) : 0;
                let var32 = var11.GetModel(var22, 4, (angle + 4) | 0, var19, building, var18, null, var21, var20, var25);
                if (glJar && GlRenderer.active && var25) GroundShadows.addLoc(var32.shadow, (var20 - shadowXOffset) | 0, shadowY, (var21 - shadowZOffset) | 0);
                var63 = var32.model;
                var32 = var11.GetModel(var22, 4, (var31 + 4) | 0, var19, building, var18, null, var21, var20, var25);
                if (glJar && GlRenderer.active && var25) GroundShadows.addLoc(var32.shadow, (var20 - shadowXOffset) | 0, shadowY, (var21 - shadowZOffset) | 0);
                var68 = var32.model;
            }

            world.SetDecor(level, x, z, var19, var63, var68, 256, angle, Math.imul(arrayAtI32(ClientBuild.DECORXOF2, angle), var36), Math.imul(arrayAtI32(ClientBuild.DECORZOF2, angle), var36), var23);
        }
    }

    // al.a(I[Lke;Z)V. ClientBuild::FinishBuild (oldscape/jagex3/client/clientbuild.cpp:1692, an OSRS body with a
    // different light and blend). The ground build after every loc is placed. Without underwater: blocks the ground of
    // every m_mapl flag-1 tile (one level lower under a plane-1 bridge, flag 2) in collisionMaps, then jitters
    // m_hueOff by Math.random()*5 - 2 (clamped to -8..8) and m_ligOff likewise (clamped to -16..16). For each of the 4
    // levels (1 underwater): var7 is the light grid, 74 plus the heightmap normal dotted with the light (-50, -10, -50)
    // over 213 ((int) Math.sqrt(5100) * 768 >> 8) minus the m_shadow blur; var6 is the underlay colour grid, the FluType
    // hue/saturation/lightness/chroma of the m_floort1 ids summed over the m_huetot..m_tot column totals and a 10-wide
    // window, packed by packHsl (mi.a). Every tile (1..102)^2 that is not skipped (without underwater, unless all levels
    // show or plane 0 has m_mapl bit 2, a tile with m_mapl bit 16 or VisLevel != buildLevel is skipped) lowers
    // minusedlevel, and one with an underlay or overlay goes to world.SetGround: underlay corners through
    // underlayBrightness (qe.a) and the m_hueOff/m_ligOff shifted colour, the FloType overlay (shape m_floors + 1,
    // rotation m_floorr, texture when the provider has it, else colour, secondaryColour for the minimap) through
    // overlayBrightness (lk.a). On levels above 0 a flat tile sets m_mapo bit 4 unless its overlay does not occlude or it
    // has no underlay and a nonzero m_floors shape. The level's m_floort1, m_floort2, m_floors, m_floorr and m_shadow
    // rows are then nulled. Then world.ShareLight(-50, -10, -50) and, without underwater, world.PushDown for every
    // plane-1 bridge tile and the occluders: each m_mapo bit 1 (x wall) or 2 (z wall) run is grown along its tile row and
    // then through the levels, each bit 4 (floor) run along z and then x on its level; it becomes a world.SetOcclude of
    // type 1 or 2 (when it covers at least 8 tiles) or 4 (at least 4) and its bits are cleared.
    // underwater (Java var2): gj.e, the only caller, passes false; kept as the semantic flag (like Init and
    // loadDynamicGround). It picks 1 level instead of 4 and skips the collision pass, the jitter, the low-detail skip,
    // PushDown and the occluders.
    // Stripped: the al.c counter, the od.a wrapper, ok.a(II)I (inlined as |), kg.e(II)I (inlined as &) and the dummy int
    // first argument: the jar's only call (gj.e bytecode 786-793) passes sipush 128, and the guard at 3467
    // `if (var0 != 128) al.a(98)` (the Js5 unload) never runs. Every `iload 38; ifeq` (client.wb) is a goto: loop entries,
    // else-skips and the labelled breaks of the occluder searches. Callee dummies dropped by their ports: ke.a(III)V
    // -26742, dl.a(Z)Z true, ec.a(ZIII)I false, ij.a(BI) 39, jl.a(II) -127, mi.a(IIII)I -31863, qe.a(ZII)I false,
    // lk.a(III)I -24637, pc.b(II)Z 0, pc.a(BI)I -118. The decompiler fails on this method; locals are named after their
    // JVM slots (slots are reused, so a name can hold a different value in a later block).
    static FinishBuild(collisionMaps: (CollisionMap | null)[] | null, underwater: boolean): void {
        if (!underwater) {
            for (let var4 = 0; var4 < 4; var4++) {
                for (let var5 = 0; var5 < 104; var5++) {
                    for (let var6 = 0; var6 < 104; var6++) {
                        if ((((arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_mapl, var4), var5), var6) << 24) >> 24) & 1) === 1) {
                            let var7 = var4;
                            if ((((arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_mapl, 1), var5), var6) << 24) >> 24) & 2) === 2) {
                                var7 = (var7 - 1) | 0;
                            }

                            if (var7 >= 0) {
                                // ke.a(var6, var5, -26742): (z, x) in the jar's order.
                                requireNonNull(arrayAtObj(collisionMaps, var7)).blockGround(var5, var6);
                            }
                        }
                    }
                }
            }

            if (!glJar) ClientBuild.m_hueOff = (ClientBuild.m_hueOff + ((-2 + ((mathRandom.nextDouble() * 5.0) | 0)) | 0)) | 0;
            ClientBuild.m_ligOff = (ClientBuild.m_ligOff + ((((mathRandom.nextDouble() * 5.0) | 0) - 2) | 0)) | 0;
            if (ClientBuild.m_ligOff < -16) {
                ClientBuild.m_ligOff = -16;
            }

            if (ClientBuild.m_ligOff > 16) {
                ClientBuild.m_ligOff = 16;
            }

            if (glJar) ClientBuild.m_hueOff = (ClientBuild.m_hueOff + ((mathRandom.nextDouble() * 5) | 0) - 2) | 0;
            if (ClientBuild.m_hueOff < -8) {
                ClientBuild.m_hueOff = -8;
            }

            if (ClientBuild.m_hueOff > 8) {
                ClientBuild.m_hueOff = 8;
            }
        }

        let var3: number;
        if (!underwater) {
            var3 = 4;
        } else {
            var3 = 1;
        }

        // var4/var5: the hue and lightness offsets as they enter an HSL value.
        const var4 = (ClientBuild.m_hueOff >> 2) << 10;
        const var6 = Array.from({ length: 104 }, () => new Int32Array(104));
        const var5 = ClientBuild.m_ligOff >> 1;
        const var7 = Array.from({ length: 104 }, () => new Int32Array(104));
        for (let var8 = 0; var3 > var8; var8++) {
            const var9 = arrayAtObj(ClientBuild.m_shadow, var8);
            if (glJar && GlRenderer.active) {
                const lighting = GlLighting;
                if (!Preferences.graphics.highDetailLighting) {
                    const sunX = doubleToInt(arrayAtF32(lighting.sunDirection, 0));
                    const sunY = doubleToInt(arrayAtF32(lighting.sunDirection, 1));
                    const sunZ = doubleToInt(arrayAtF32(lighting.sunDirection, 2));
                    const length = doubleToInt(Math.sqrt((Math.imul(sunY, sunY) + Math.imul(sunX, sunX) + Math.imul(sunZ, sunZ)) | 0));
                    const divisor = Math.imul(1024, length) >> 8;
                    for (let z = 1; z < 103; z++) {
                        for (let x = 1; x < 103; x++) {
                            const dx = (arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, var8), x + 1), z) - arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, var8), x - 1), z)) | 0;
                            const dz = (arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, var8), x), z + 1) - arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, var8), x), z - 1)) | 0;
                            const length = doubleToInt(Math.sqrt((Math.imul(dx, dx) + 65536 + Math.imul(dz, dz)) | 0));
                            const nx = intDivide(dx << 8, length);
                            const shadow =
                                ((arrayAtU8(arrayAtObj(var9, x), z + 1) << 24) >> 27) +
                                ((arrayAtU8(arrayAtObj(var9, x), z - 1) << 24) >> 26) +
                                ((arrayAtU8(arrayAtObj(var9, x - 1), z) << 24) >> 26) +
                                ((arrayAtU8(arrayAtObj(var9, x + 1), z) << 24) >> 27) +
                                ((arrayAtU8(arrayAtObj(var9, x), z) << 24) >> 25);
                            const ny = intDivide(-65536, length),
                                nz = intDivide(dz << 8, length);
                            const dot = (Math.imul(sunZ, nz) + Math.imul(sunX, nx) + Math.imul(ny, sunY)) | 0;
                            arrayPutI32(arrayAtObj(var7, x), z, (96 + intDivide(dot, divisor) - doubleToInt(Math.fround(shadow * Math.fround(1.7)))) | 0);
                        }
                    }
                } else {
                    for (let z = 1; z < 103; z++) {
                        for (let x = 1; x < 103; x++) {
                            const shadow =
                                ((arrayAtU8(arrayAtObj(var9, x + 1), z) << 24) >> 27) +
                                ((arrayAtU8(arrayAtObj(var9, x - 1), z) << 24) >> 26) +
                                ((arrayAtU8(arrayAtObj(var9, x), z - 1) << 24) >> 26) +
                                ((arrayAtU8(arrayAtObj(var9, x), z + 1) << 24) >> 27) +
                                ((arrayAtU8(arrayAtObj(var9, x), z) << 24) >> 25);
                            arrayPutI32(arrayAtObj(var7, x), z, (74 - shadow) | 0);
                        }
                    }
                }
            } else {
                const var10 = Math.sqrt(5100.0) | 0;
                const var11 = Math.imul(768, var10) >> 8;
                for (let var12 = 1; var12 < 103; var12++) {
                    for (let var13 = 1; var13 < 103; var13++) {
                        const var15 = (-arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, var8), (var13 - 1) | 0), var12) + arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, var8), (1 + var13) | 0), var12)) | 0;
                        let var14 = 74;
                        const var16 = (arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, var8), var13), (var12 - -1) | 0) - arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, var8), var13), (var12 + -1) | 0)) | 0;
                        // (int) Math.sqrt((double) int): d2i of NaN (an overflowed negative sum) is 0, and the idiv throws.
                        const var17 = Math.sqrt((65536 + ((Math.imul(var15, var15) + Math.imul(var16, var16)) | 0)) | 0) | 0;
                        const var19 = intDivide(-65536, var17);
                        const var18 = intDivide(var15 << 8, var17);
                        const var20 = intDivide(var16 << 8, var17);
                        var14 = (var14 + intDivide((Math.imul(-50, var18) - -Math.imul(var19, -10) + Math.imul(-50, var20)) | 0, var11)) | 0;
                        const var21 =
                            ((((arrayAtU8(arrayAtObj(var9, var13), var12) << 24) >> 24) >> 1) +
                                (((arrayAtU8(arrayAtObj(var9, var13), (var12 - 1) | 0) << 24) >> 24) >> 2) +
                                (((arrayAtU8(arrayAtObj(var9, (var13 + -1) | 0), var12) << 24) >> 24) >> 2) -
                                (-(((arrayAtU8(arrayAtObj(var9, (1 + var13) | 0), var12) << 24) >> 24) >> 3) - (((arrayAtU8(arrayAtObj(var9, var13), (1 + var12) | 0) << 24) >> 24) >> 3))) |
                            0;
                        arrayPutI32(arrayAtObj(var7, var13), var12, (-var21 + var14) | 0);
                    }
                }
            }

            for (let var13 = 0; var13 < 104; var13++) {
                arrayPutI32(ClientBuild.m_huetot, var13, 0);
                arrayPutI32(ClientBuild.m_sattot, var13, 0);
                arrayPutI32(ClientBuild.m_ligtot, var13, 0);
                arrayPutI32(ClientBuild.m_comtot, var13, 0);
                arrayPutI32(ClientBuild.m_tot, var13, 0);
            }

            for (let var14 = -5; var14 < 104; var14++) {
                for (let var15 = 0; var15 < 104; var15++) {
                    const var16 = (5 + var14) | 0;
                    if (var16 < 104) {
                        const var17 = 255 & arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_floort1, var8), var16), var15);
                        if (var17 > 0) {
                            const var18 = FluType.List((var17 - 1) | 0);
                            arrayPutI32(ClientBuild.m_huetot, var15, (arrayAtI32(ClientBuild.m_huetot, var15) + var18.weightedHue) | 0);
                            arrayPutI32(ClientBuild.m_sattot, var15, (arrayAtI32(ClientBuild.m_sattot, var15) + var18.saturation) | 0);
                            arrayPutI32(ClientBuild.m_ligtot, var15, (arrayAtI32(ClientBuild.m_ligtot, var15) + var18.lightness) | 0);
                            arrayPutI32(ClientBuild.m_comtot, var15, (arrayAtI32(ClientBuild.m_comtot, var15) + var18.chroma) | 0);
                            arrayPutI32(ClientBuild.m_tot, var15, (arrayAtI32(ClientBuild.m_tot, var15) + 1) | 0);
                        }
                    }

                    const var17 = (var14 - 5) | 0;
                    if (var17 >= 0) {
                        const var18 = 255 & arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_floort1, var8), var17), var15);
                        if (var18 > 0) {
                            const var19 = FluType.List((var18 - 1) | 0);
                            arrayPutI32(ClientBuild.m_huetot, var15, (arrayAtI32(ClientBuild.m_huetot, var15) - var19.weightedHue) | 0);
                            arrayPutI32(ClientBuild.m_sattot, var15, (arrayAtI32(ClientBuild.m_sattot, var15) - var19.saturation) | 0);
                            arrayPutI32(ClientBuild.m_ligtot, var15, (arrayAtI32(ClientBuild.m_ligtot, var15) - var19.lightness) | 0);
                            arrayPutI32(ClientBuild.m_comtot, var15, (arrayAtI32(ClientBuild.m_comtot, var15) - var19.chroma) | 0);
                            arrayPutI32(ClientBuild.m_tot, var15, (arrayAtI32(ClientBuild.m_tot, var15) - 1) | 0);
                        }
                    }
                }

                if (var14 >= 0) {
                    let var16 = 0;
                    let var19 = 0;
                    let var18 = 0;
                    let var17 = 0;
                    let var20 = 0;
                    for (let var21 = -5; var21 < 104; var21++) {
                        const var22 = (5 + var21) | 0;
                        const var23 = (-5 + var21) | 0;
                        if (var22 < 104) {
                            if (glJar) {
                                var17 = (var17 + arrayAtI32(ClientBuild.m_sattot, var22)) | 0;
                                var20 = (var20 + arrayAtI32(ClientBuild.m_tot, var22)) | 0;
                                var16 = (var16 + arrayAtI32(ClientBuild.m_huetot, var22)) | 0;
                            } else {
                                var16 = (var16 + arrayAtI32(ClientBuild.m_huetot, var22)) | 0;
                                var17 = (var17 + arrayAtI32(ClientBuild.m_sattot, var22)) | 0;
                                var20 = (var20 + arrayAtI32(ClientBuild.m_tot, var22)) | 0;
                            }
                            var19 = (var19 + arrayAtI32(ClientBuild.m_comtot, var22)) | 0;
                            var18 = (var18 + arrayAtI32(ClientBuild.m_ligtot, var22)) | 0;
                        }

                        if (var23 >= 0) {
                            var17 = (var17 - arrayAtI32(ClientBuild.m_sattot, var23)) | 0;
                            if (glJar) var19 = (var19 - arrayAtI32(ClientBuild.m_comtot, var23)) | 0;
                            else var18 = (var18 - arrayAtI32(ClientBuild.m_ligtot, var23)) | 0;
                            var16 = (var16 - arrayAtI32(ClientBuild.m_huetot, var23)) | 0;
                            var20 = (var20 - arrayAtI32(ClientBuild.m_tot, var23)) | 0;
                            if (glJar) var18 = (var18 - arrayAtI32(ClientBuild.m_ligtot, var23)) | 0;
                            else var19 = (var19 - arrayAtI32(ClientBuild.m_comtot, var23)) | 0;
                        }

                        if (var21 >= 0 && var20 > 0) {
                            const row = arrayAtObj(var6, var14);
                            if (glJar) {
                                const light = intDivide(var18, var20);
                                const saturation = intDivide(var17, var20);
                                arrayPutI32(row, var21, ClientBuild.packHsl(intDivide(Math.imul(var16, 256), var19), light, saturation));
                            } else arrayPutI32(row, var21, ClientBuild.packHsl(intDivide(Math.imul(var16, 256), var19), intDivide(var18, var20), intDivide(var17, var20)));
                        }
                    }
                }
            }

            for (let var15 = 1; var15 < 103; var15++) {
                for (let var16 = 1; var16 < 103; var16++) {
                    if (!underwater && !Preferences.getAllLevelsVisible() && (2 & ((arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_mapl, 0), var15), var16) << 24) >> 24)) === 0) {
                        if ((16 & ((arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_mapl, var8), var15), var16) << 24) >> 24)) !== 0) {
                            continue;
                        }

                        if (ClientBuild.VisLevel(var15, var8, var16) !== ClientBuild.buildLevel) {
                            continue;
                        }
                    }

                    if (var8 < ClientBuild.minusedlevel) {
                        ClientBuild.minusedlevel = var8;
                    }

                    // var18: the overlay (FloType) id + 1, var17: the underlay (FluType) id + 1.
                    let var17: number, var18: number;
                    if (glJar) {
                        var17 = 255 & arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_floort1, var8), var15), var16);
                        var18 = 255 & arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_floort2, var8), var15), var16);
                    } else {
                        var18 = 255 & arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_floort2, var8), var15), var16);
                        var17 = 255 & arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_floort1, var8), var15), var16);
                    }
                    if (var17 > 0 || var18 > 0) {
                        // var19/var20/var21/var22: the SW/SE/NE/NW corner heights.
                        let var19: number, var20: number;
                        if (glJar) {
                            var20 = arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, var8), (1 + var15) | 0), var16);
                            var19 = arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, var8), var15), var16);
                        } else {
                            var19 = arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, var8), var15), var16);
                            var20 = arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, var8), (1 + var15) | 0), var16);
                        }
                        const var22 = arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, var8), var15), (1 + var16) | 0);
                        const var21 = arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, var8), (1 + var15) | 0), (1 + var16) | 0);
                        if (var8 > 0) {
                            let var23 = true;
                            if (var17 === 0 && (arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_floors, var8), var15), var16) << 24) >> 24 !== 0) {
                                var23 = false;
                            }

                            if (var18 > 0 && !FloType.List((var18 - 1) | 0).occludes) {
                                var23 = false;
                            }

                            if (var23 && var19 === var20 && var21 === var19 && var19 === var22) {
                                arrayPutI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, var8), var15), var16, arrayAtI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, var8), var15), var16) | 4);
                            }
                        }

                        // var23: the underlay HSL (-1 without one), var24: its minimap RGB.
                        let var23: number;
                        let var24: number;
                        if (var17 > 0) {
                            var23 = arrayAtI32(arrayAtObj(var6, var15), var16);
                            let var25 = ((var23 & 127) - -var5) | 0;
                            if (var25 < 0) {
                                var25 = 0;
                            } else if (var25 > 127) {
                                var25 = 127;
                            }

                            const var26 = ((896 & var23) + (64512 & (var23 - -var4)) - -var25) | 0;
                            var24 = arrayAtI32(Pix3D.colourTable, ClientBuild.underlayBrightness(96, var26));
                        } else {
                            var24 = 0;
                            var23 = -1;
                        }

                        // var25..var28: the SW/SE/NE/NW corner light.
                        const var25 = arrayAtI32(arrayAtObj(var7, var15), var16);
                        const var26 = arrayAtI32(arrayAtObj(var7, (1 + var15) | 0), var16);
                        const var27 = arrayAtI32(arrayAtObj(var7, (1 + var15) | 0), (var16 - -1) | 0);
                        const var28 = arrayAtI32(arrayAtObj(var7, var15), (var16 + 1) | 0);
                        if (var18 !== 0) {
                            const var29 = (((arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_floors, var8), var15), var16) << 24) >> 24) - -1) | 0;
                            const var30 = (arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_floorr, var8), var15), var16) << 24) >> 24;
                            const var31 = FloType.List((var18 - 1) | 0);
                            if (glJar && GlRenderer.active && !underwater && world.waterSpriteKeys !== null && var8 === 0) {
                                if (var31.m_materialID !== -1 && (requireNonNull(Pix3D.textureProvider) as HdTextureProvider).materialType(var31.m_materialID) === 4) {
                                    arrayPutI32(arrayAtObj(world.waterSpriteKeys, var15), var16, ((var31.field_84 << 24) + var31.field_80) | 0);
                                } else ClientBuild.setAdjacentWaterColour(var8, var15, var16);
                            }
                            let var32 = var31.m_materialID;
                            if (var32 >= 0 && !requireNonNull(Pix3D.textureProvider).isAvailable(var32)) {
                                var32 = -1;
                            }

                            // var33: the overlay HSL (-2 none, -1 textured), var34: its minimap RGB.
                            let var33: number;
                            let var34: number;
                            if (var32 < 0) {
                                if (var31.colour === -1) {
                                    var34 = 0;
                                    var33 = -2;
                                } else {
                                    var33 = var31.colour;
                                    let var35 = (var5 + (127 & var33)) | 0;
                                    // Bytecode 1738: the < 0 arm is laid out after the > 127 test.
                                    if (var35 >= 0) {
                                        if (var35 > 127) {
                                            var35 = 127;
                                        }
                                    } else {
                                        var35 = 0;
                                    }

                                    const var36 = (var35 + (64512 & (var4 + var33)) - -(896 & var33)) | 0;
                                    var34 = arrayAtI32(Pix3D.colourTable, ClientBuild.overlayBrightness(var36, 96));
                                }
                            } else {
                                var34 = arrayAtI32(Pix3D.colourTable, ClientBuild.overlayBrightness(requireNonNull(Pix3D.textureProvider).getTextureColour(var32), 96));
                                var33 = -1;
                            }

                            if (var31.secondaryColour >= 0) {
                                const var35 = var31.secondaryColour;
                                let var36 = (var5 + (var35 & 127)) | 0;
                                if (var36 < 0) {
                                    var36 = 0;
                                } else if (var36 > 127) {
                                    var36 = 127;
                                }

                                const var37 = ((64512 & (var4 + var35)) + (((var35 & 896) + var36) | 0)) | 0;
                                var34 = arrayAtI32(Pix3D.colourTable, ClientBuild.overlayBrightness(var37, 96));
                            }

                            world.SetGround(
                                var8,
                                var15,
                                var16,
                                var29,
                                var30,
                                var32,
                                var19,
                                var20,
                                var21,
                                var22,
                                ClientBuild.underlayBrightness(var25, var23),
                                ClientBuild.underlayBrightness(var26, var23),
                                ClientBuild.underlayBrightness(var27, var23),
                                ClientBuild.underlayBrightness(var28, var23),
                                ClientBuild.overlayBrightness(var33, var25),
                                ClientBuild.overlayBrightness(var33, var26),
                                ClientBuild.overlayBrightness(var33, var27),
                                ClientBuild.overlayBrightness(var33, var28),
                                var24,
                                var34
                            );
                            if (glJar && GlRenderer.active && var8 > 0) {
                                const shadows = GroundShadows;
                                shadows.addTile(
                                    var29,
                                    var30,
                                    var33 === -2 || !var31.field_77,
                                    var23 === -1 || !FluType.List(var17 - 1).field_68,
                                    var15,
                                    var16,
                                    (var19 - arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, 0), var15), var16)) | 0,
                                    (var20 - arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, 0), var15 + 1), var16)) | 0,
                                    (var21 - arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, 0), var15 + 1), var16 + 1)) | 0,
                                    (var22 - arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, 0), var15), var16 + 1)) | 0
                                );
                            }
                        } else {
                            world.SetGround(
                                var8,
                                var15,
                                var16,
                                0,
                                0,
                                -1,
                                var19,
                                var20,
                                var21,
                                var22,
                                ClientBuild.underlayBrightness(var25, var23),
                                ClientBuild.underlayBrightness(var26, var23),
                                ClientBuild.underlayBrightness(var27, var23),
                                ClientBuild.underlayBrightness(var28, var23),
                                0,
                                0,
                                0,
                                0,
                                var24,
                                0
                            );
                            if (glJar && GlRenderer.active && var8 > 0 && var23 !== -1 && FluType.List(var17 - 1).field_68) {
                                const shadows = GroundShadows;
                                shadows.addTile(
                                    0,
                                    0,
                                    true,
                                    false,
                                    var15,
                                    var16,
                                    (var19 - arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, 0), var15), var16)) | 0,
                                    (var20 - arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, 0), var15 + 1), var16)) | 0,
                                    (var21 - arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, 0), var15 + 1), var16 + 1)) | 0,
                                    (var22 - arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, 0), var15), var16 + 1)) | 0
                                );
                            }
                            if (glJar && GlRenderer.active && !underwater && world.waterSpriteKeys !== null && var8 === 0) {
                                ClientBuild.setAdjacentWaterColour(var8, var15, var16);
                            }
                        }
                    }
                }
            }

            if (glJar && GlRenderer.active) {
                const terrain = TerrainBuilder;
                const normalX = Array.from({ length: 105 }, () => new Float32Array(105));
                const heights = arrayAtObj(world.levelHeightmaps, var8);
                const normalY = Array.from({ length: 105 }, () => new Float32Array(105));
                const normalZ = Array.from({ length: 105 }, () => new Float32Array(105));
                for (let z = 1; z <= 103; z++) {
                    for (let x = 1; x <= 103; x++) {
                        const dz = (arrayAtI32(arrayAtObj(heights, x), z + 1) - arrayAtI32(arrayAtObj(heights, x), z - 1)) | 0;
                        const dx = (-arrayAtI32(arrayAtObj(heights, x - 1), z) + arrayAtI32(arrayAtObj(heights, x + 1), z)) | 0;
                        const length = Math.fround(Math.sqrt((Math.imul(dx, dx) + 65536 + Math.imul(dz, dz)) | 0));
                        normalX[x][z] = Math.fround(dx) / length;
                        normalY[x][z] = -256 / length;
                        normalZ[x][z] = Math.fround(dz) / length;
                    }
                }
                if (!underwater) {
                    const first = terrain.buildUnderlays(
                        ClientBuild.m_mapl,
                        arrayAtObj(ClientBuild.m_floors, var8),
                        arrayAtObj(ClientBuild.m_floort1, var8),
                        var7,
                        normalY,
                        null,
                        arrayAtObj(ClientBuild.m_floort2, var8),
                        arrayAtObj(ClientBuild.m_floorr, var8),
                        normalX,
                        var8,
                        normalZ,
                        var6,
                        arrayAtObj(world.levelHeightmaps, var8),
                        null
                    );
                    const second = terrain.buildOverlays(
                        normalY,
                        normalX,
                        arrayAtObj(world.levelHeightmaps, var8),
                        var8,
                        normalZ,
                        arrayAtObj(ClientBuild.m_floorr, var8),
                        var7,
                        arrayAtObj(ClientBuild.m_floors, var8),
                        arrayAtObj(ClientBuild.m_floort1, var8),
                        arrayAtObj(ClientBuild.m_floort2, var8),
                        ClientBuild.m_mapl
                    );
                    SharedPtrList.setTerrainBatches(var8, first.concat(second));
                    const lights = PointLightManager;
                    lights.buildMeshes(
                        normalZ,
                        arrayAtObj(ClientBuild.m_floort1, var8),
                        arrayAtObj(ClientBuild.m_floorr, var8),
                        lights.lights,
                        var8,
                        lights.lightCount,
                        normalY,
                        arrayAtObj(ClientBuild.m_floors, var8),
                        arrayAtObj(ClientBuild.m_floort2, var8),
                        arrayAtObj(world.levelHeightmaps, var8),
                        normalX
                    );
                } else {
                    const batches = terrain.buildUnderlays(
                        ClientBuild.m_mapl,
                        arrayAtObj(ClientBuild.m_floors, var8),
                        arrayAtObj(ClientBuild.m_floort1, var8),
                        var7,
                        normalY,
                        world.waterSpriteKeys,
                        arrayAtObj(ClientBuild.m_floort2, var8),
                        arrayAtObj(ClientBuild.m_floorr, var8),
                        normalX,
                        var8,
                        normalZ,
                        var6,
                        arrayAtObj(world.levelHeightmaps, var8),
                        arrayAtObj(world.mainGroundh, 0)
                    );
                    SharedPtrList.setTerrainBatches(var8, batches);
                }
            }
            // Java nulls each level's rows (aastore null); the fields' row types are non-null, so the element type is widened here.
            arrayPutObj<Uint8Array[] | null>(ClientBuild.m_floort1, var8, null);
            arrayPutObj<Uint8Array[] | null>(ClientBuild.m_floort2, var8, null);
            arrayPutObj<Uint8Array[] | null>(ClientBuild.m_floors, var8, null);
            arrayPutObj<Uint8Array[] | null>(ClientBuild.m_floorr, var8, null);
            arrayPutObj<Uint8Array[] | null>(ClientBuild.m_shadow, var8, null);
        }

        world.ShareLight(-50, -10, -50);
        if (!underwater) {
            for (let var9 = 0; var9 < 104; var9++) {
                for (let var10 = 0; var10 < 104; var10++) {
                    if ((2 & ((arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_mapl, 1), var9), var10) << 24) >> 24)) === 2) {
                        world.PushDown(var9, var10);
                    }
                }
            }

            // m_mapo is [level][x][z]: var12 is x and var11 is z.
            for (let var10 = 0; var10 < 4; var10++) {
                for (let var11 = 0; var11 <= 104; var11++) {
                    for (let var12 = 0; var12 <= 104; var12++) {
                        if ((arrayAtI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, var10), var12), var11) & 1) !== 0) {
                            // An x wall: var13..var14 along z, var15..var16 through the levels.
                            let var14 = var11;
                            let var13 = var11;
                            while (var13 > 0 && (1 & arrayAtI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, var10), var12), (-1 + var13) | 0)) !== 0) {
                                var13 = (var13 - 1) | 0;
                            }

                            while (var14 < 104 && (1 & arrayAtI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, var10), var12), (1 + var14) | 0)) !== 0) {
                                var14 = (var14 + 1) | 0;
                            }

                            let var15 = var10;
                            let var16 = var10;
                            findMinLevel1: while (var15 > 0) {
                                for (let var17 = var13; var14 >= var17; var17++) {
                                    if ((arrayAtI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, (-1 + var15) | 0), var12), var17) & 1) === 0) {
                                        break findMinLevel1;
                                    }
                                }

                                var15 = (var15 - 1) | 0;
                            }

                            findMaxLevel1: while (var16 < 3) {
                                for (let var17 = var13; var17 <= var14; var17++) {
                                    if ((1 & arrayAtI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, (var16 - -1) | 0), var12), var17)) === 0) {
                                        break findMaxLevel1;
                                    }
                                }

                                var16 = (var16 + 1) | 0;
                            }

                            const var17 = Math.imul((-var13 + ((var14 + 1) | 0)) | 0, (var16 - ((-1 - -var15) | 0)) | 0);
                            if (var17 >= 8) {
                                const var18 = 240;
                                const var19 = (-var18 + arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, var16), var12), var13)) | 0;
                                const var20 = arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, var15), var12), var13);
                                world.SetOcclude(1, Math.imul(var12, 128), Math.imul(var12, 128), Math.imul(128, var13), (Math.imul(128, var14) + 128) | 0, var19, var20);
                                for (let var21 = var15; var16 >= var21; var21++) {
                                    for (let var22 = var13; var22 <= var14; var22++) {
                                        arrayPutI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, var21), var12), var22, arrayAtI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, var21), var12), var22) & -2);
                                    }
                                }
                            }
                        }

                        if ((arrayAtI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, var10), var12), var11) & 2) !== 0) {
                            // A z wall: var13..var14 along x, var15..var16 through the levels.
                            let var13 = var12;
                            let var14 = var12;
                            while (var13 > 0 && (2 & arrayAtI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, var10), (-1 + var13) | 0), var11)) !== 0) {
                                var13 = (var13 - 1) | 0;
                            }

                            let var16 = var10;
                            while (var14 < 104 && (2 & arrayAtI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, var10), (var14 + 1) | 0), var11)) !== 0) {
                                var14 = (var14 + 1) | 0;
                            }

                            let var15 = var10;
                            findMinLevel2: while (var15 > 0) {
                                for (let var17 = var13; var17 <= var14; var17++) {
                                    if ((arrayAtI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, (-1 + var15) | 0), var17), var11) & 2) === 0) {
                                        break findMinLevel2;
                                    }
                                }

                                var15 = (var15 - 1) | 0;
                            }

                            findMaxLevel2: while (var16 < 3) {
                                for (let var17 = var13; var17 <= var14; var17++) {
                                    if ((2 & arrayAtI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, (1 + var16) | 0), var17), var11)) === 0) {
                                        break findMaxLevel2;
                                    }
                                }

                                var16 = (var16 + 1) | 0;
                            }

                            const var17 = Math.imul((1 + ((-var13 + var14) | 0)) | 0, (1 + ((var16 - var15) | 0)) | 0);
                            if (var17 >= 8) {
                                const var18 = 240;
                                const var20 = arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, var15), var13), var11);
                                const var19 = (-var18 + arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, var16), var13), var11)) | 0;
                                world.SetOcclude(2, Math.imul(var13, 128), (128 + Math.imul(var14, 128)) | 0, Math.imul(var11, 128), Math.imul(var11, 128), var19, var20);
                                for (let var21 = var15; var16 >= var21; var21++) {
                                    for (let var22 = var13; var14 >= var22; var22++) {
                                        arrayPutI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, var21), var22), var11, arrayAtI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, var21), var22), var11) & -3);
                                    }
                                }
                            }
                        }

                        if ((4 & arrayAtI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, var10), var12), var11)) !== 0) {
                            // A floor: var13..var14 along x, var15..var16 along z, on this level only.
                            let var13 = var12;
                            let var14 = var12;
                            let var15 = var11;
                            while (var15 > 0 && (arrayAtI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, var10), var12), (-1 + var15) | 0) & 4) !== 0) {
                                var15 = (var15 - 1) | 0;
                            }

                            let var16 = var11;
                            while (var16 < 104 && (arrayAtI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, var10), var12), (1 + var16) | 0) & 4) !== 0) {
                                var16 = (var16 + 1) | 0;
                            }

                            findMinX: while (var13 > 0) {
                                for (let var17 = var15; var17 <= var16; var17++) {
                                    if ((4 & arrayAtI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, var10), (-1 + var13) | 0), var17)) === 0) {
                                        break findMinX;
                                    }
                                }

                                var13 = (var13 - 1) | 0;
                            }

                            findMaxX: while (var14 < 104) {
                                for (let var17 = var15; var16 >= var17; var17++) {
                                    if ((arrayAtI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, var10), (1 + var14) | 0), var17) & 4) === 0) {
                                        break findMaxX;
                                    }
                                }

                                var14 = (var14 + 1) | 0;
                            }

                            if (Math.imul((-var13 + ((var14 + 1) | 0)) | 0, (1 + ((-var15 + var16) | 0)) | 0) >= 4) {
                                const var17 = arrayAtI32(arrayAtObj(arrayAtObj(world.levelHeightmaps, var10), var13), var15);
                                world.SetOcclude(4, Math.imul(var13, 128), (128 + Math.imul(var14, 128)) | 0, Math.imul(128, var15), (Math.imul(128, var16) - -128) | 0, var17, var17);
                                for (let var18 = var13; var14 >= var18; var18++) {
                                    for (let var19 = var15; var19 <= var16; var19++) {
                                        arrayPutI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, var10), var18), var19, arrayAtI32(arrayAtObj(arrayAtObj(ClientBuild.m_mapo, var10), var18), var19) & -5);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // be.a(IBI)I. ClientBuild::PerlinNoise in oldscape/jagex3/client/clientbuild.cpp.
    static PerlinNoise(x: number, z: number): number {
        let value = -128 + ClientBuild.InterpolatedNoise(4, (x + 45365) | 0, (z + 91923) | 0) + ((ClientBuild.InterpolatedNoise(2, (x + 10294) | 0, (z + 37821) | 0) - 128) >> 1) + ((ClientBuild.InterpolatedNoise(1, x, z) - 128) >> 2);
        value = 35 + ((0.3 * value) | 0);
        if (value < 10) return 10;
        if (value > 60) return 60;
        return value;
    }

    // ui.a(IIZI)I
    static InterpolatedNoise(scale: number, x: number, z: number): number {
        const fracX = (scale - 1) & x;
        const tileX = intDivide(x, scale);
        const tileZ = intDivide(z, scale);
        const fracZ = (scale - 1) & z;
        const sw = ClientBuild.SmoothNoise(tileZ, tileX);
        const se = ClientBuild.SmoothNoise(tileZ, (tileX + 1) | 0);
        const nw = ClientBuild.SmoothNoise((1 + tileZ) | 0, tileX);
        const ne = ClientBuild.SmoothNoise((tileZ + 1) | 0, (tileX + 1) | 0);
        const south = ClientBuild.Interpolate(scale, se, sw, fracX);
        const north = ClientBuild.Interpolate(scale, ne, nw, fracX);
        return ClientBuild.Interpolate(scale, north, south, fracZ);
    }

    // The two neighbour searches in HD di.a([Lmj;ZI)V use the first water overlay in x,z order.
    private static setAdjacentWaterColour(level: number, x: number, z: number): void {
        for (let nx = x - 1; nx <= x + 1; nx++) {
            for (let nz = z - 1; nz <= z + 1; nz++) {
                if ((nx === x && nz === z) || nx < 0 || nx >= 104 || nz < 0 || nz >= 104) continue;
                const id = arrayAtU8(arrayAtObj(arrayAtObj(ClientBuild.m_floort2, level), nx), nz) & 255;
                if (id === 0) continue;
                const floor = FloType.List(id - 1);
                if (floor.m_materialID !== -1 && (requireNonNull(Pix3D.textureProvider) as HdTextureProvider).materialType(floor.m_materialID) === 4) {
                    arrayPutI32(arrayAtObj(world.waterSpriteKeys, x), z, (floor.field_80 + (floor.field_84 << 24)) | 0);
                    return;
                }
            }
        }
    }

    // lc.a(IZI)I
    static SmoothNoise(z: number, x: number): number {
        const corners = ClientBuild.Noise((z - 1) | 0, (x - 1) | 0) + ClientBuild.Noise((z - 1) | 0, (x + 1) | 0) + ClientBuild.Noise((z + 1) | 0, (x - 1) | 0) + ClientBuild.Noise((z + 1) | 0, (x + 1) | 0);
        const sides = ClientBuild.Noise(z, (x - 1) | 0) + ClientBuild.Noise(z, (x + 1) | 0) + ClientBuild.Noise((z - 1) | 0, x) + ClientBuild.Noise((z + 1) | 0, x);
        const center = ClientBuild.Noise(z, x);
        return ((center / 4) | 0) + ((corners / 16) | 0) + ((sides / 8) | 0);
    }

    // je.a(IIIIB)I
    static Interpolate(scale: number, b: number, a: number, fraction: number): number {
        const weight = (65536 - arrayAtI32(Pix3D.cosTable, intDivide(Math.imul(1024, fraction), scale))) >> 1;
        return (Math.imul(a, 65536 - weight) >> 16) + (Math.imul(b, weight) >> 16);
    }

    // vb.a(III)I
    static Noise(z: number, x: number): number {
        let value = (Math.imul(57, z) + x) | 0;
        value ^= value << 13;
        const hash = (1376312589 + Math.imul(value, 789221 + Math.imul(Math.imul(15731, value), value))) & 0x7fffffff;
        return (hash & 133844003) >> 19;
    }

    // ll.a(I[BII)Z. ClientBuild::CheckLocations, projects/osclient/client.cpp.
    static CheckLocations(baseX: number, data: Uint8Array, baseZ: number): boolean {
        const packet = new PacketT(data);
        let ready = true;
        let id = -1;
        for (;;) {
            const delta = packet.gSmartsExtend();
            if (delta === 0) return ready;
            id = (id + delta) | 0;
            let location = 0;
            let checked = false;
            for (;;) {
                const step = packet.gSmart1or2();
                if (step === 0) break;
                if (checked) {
                    packet.g1();
                    continue;
                }
                location = (location + step - 1) | 0;
                const x = (baseX + ((location & 4060) >> 6)) | 0;
                const z = (baseZ + (location & 63)) | 0;
                const shape = packet.g1() >> 2;
                if (x <= 0 || z <= 0 || x >= 103 || z >= 103) continue;
                const type = LocType.List(id);
                if (shape === 22 && !Preferences.graphics.showGroundDecorations && type.active === 0 && type.blockwalk !== 1 && !type.forceDecor) continue;
                checked = true;
                if (!type.CheckModelAll()) {
                    Client.locsNotReadyCount = (Client.locsNotReadyCount + 1) | 0;
                    ready = false;
                }
            }
        }
    }

    // mi.a(IIII)I
    static packHsl(hue: number, lightness: number, saturation: number): number {
        if (lightness > 243) saturation >>= 4;
        else if (lightness > 217) saturation >>= 3;
        else if (lightness > 192) saturation >>= 2;
        else if (lightness > 179) saturation >>= 1;
        return (((hue >> 2) << 10) + ((saturation >> 5) << 7) + (lightness >> 1)) | 0;
    }

    // qe.a(ZII)I
    static underlayBrightness(light: number, color: number): number {
        if (color === -1) return 12345678;
        light = Math.imul(color & 127, light) >> 7;
        return (color & 65408) + Math.max(2, Math.min(126, light));
    }

    // lk.a(III)I
    static overlayBrightness(color: number, light: number): number {
        if (color === -2) return 12345678;
        if (color === -1) return Math.max(2, Math.min(126, light));
        light = Math.imul(color & 127, light) >> 7;
        return (color & 65408) + Math.max(2, Math.min(126, light));
    }
}
