import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import ClientBuild from '#/client/ClientBuild.js';
import LightType from '#/config/LightType.js';
import CollisionMap from '#/dash3d/CollisionMap.js';
import Environment from '#/dash3d/Environment.js';
import Pix3D from '#/dash3d/Pix3D.js';
import StaticPointLight from '#/dash3d/StaticPointLight.js';
import world from '#/dash3d/world.js';
import GlRenderer from '#/gl/GlRenderer.js';
import PointLightManager from '#/gl/PointLightManager.js';
import type PacketT from '#/io/PacketT.js';
import { requireNonNull } from '#/util/JavaArray.js';
import WrappedException from '#/util/WrappedException.js';
import { loginFixture } from '../login-fixture.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

type Chunk = { angle: number; x: number; z: number; level: number; source: number; water: boolean; active: boolean; trailer: number[] };
const u16 = (v: number) => [(v >> 8) & 255, v & 255];
function light(level: number, x: number, z: number, flicker = 2): number[] {
    return [24 | level, ...u16(x), ...u16(z), ...u16(103), 0, ...u16(1), ...u16(775), flicker, ...(flicker === 31 ? u16(42) : [])];
}
function cases(): Chunk[] {
    const result: Chunk[] = [];
    const firstEnv = [0, 1, 1, 23, 45, 67],
        lastEnv = [0, 0x50, ...u16(-33), ...u16(-71), ...u16(116), ...u16(911)];
    const chunk = (trailer: number[], options: Partial<Chunk> = {}) => result.push({ angle: 1, x: 32, z: 48, level: 2, source: 1, water: false, active: true, trailer, ...options });
    for (let angle = 0; angle < 4; angle++)
        for (let source = 0; source < 4; source++) {
            const lights = [
                light(source, 16 * 128, 24 * 128),
                light(source, 24 * 128 - 1, 32 * 128 - 1),
                light(source, 17 * 128 + 33, 26 * 128 + 91, 31),
                light(source, 16 * 128 - 1, 25 * 128),
                light(source, 17 * 128, 32 * 128),
                light((source + 1) & 3, 17 * 128, 25 * 128)
            ];
            chunk([...firstEnv, 1, lights.length, ...lights.flat(), ...lastEnv], { angle, source, level: (source + 1) & 3 });
        }
    chunk([]);
    chunk([129, 2, 2, 2, 2, 1, 0, ...firstEnv]);
    chunk([129]);
    chunk([129, 1, 17]);
    chunk([1, 1, ...light(0, 0, 0, 31).slice(0, -1)]);
    chunk([3], { active: false });
    chunk([3], { water: true, source: 0 });
    chunk(firstEnv, { x: 104 });
    chunk([1, 1, ...light(1, 16 * 128, 24 * 128)], { x: 100, z: 100, angle: 2 });
    const packet = [...firstEnv, 1, 2, ...light(1, 16 * 128 + 40, 24 * 128 + 66), ...light(1, 20 * 128, 26 * 128, 31), ...lastEnv];
    chunk(packet, { angle: 5 });
    chunk(packet, { angle: -1 });
    for (let end = 0; end <= packet.length; end++) chunk(packet.slice(0, end));
    chunk([...packet, 3]);
    return result;
}

function state(c: Chunk): string {
    const maps = Array.from({ length: 4 }, () => new CollisionMap(104, 104));
    world.tileCameraClearance = Array.from({ length: 4 }, () => Array.from({ length: 104 }, () => new Uint8Array(104).fill(17)));
    world.levelHeightmaps = Array.from({ length: 4 }, (_, p) => Array.from({ length: 105 }, (_, x) => Int32Array.from({ length: 105 }, (_, z) => (x < 104 && z < 104 ? (p + 1) * 5000 + x * 9 - z * 11 : 0))));
    world.mainGroundh = world.levelHeightmaps;
    ClientBuild.m_mapl = Array.from({ length: 4 }, () => Array.from({ length: 104 }, (_, x) => Uint8Array.from({ length: 104 }, (_, z) => (x ^ z) & 2)));
    Environment.grid = Array.from({ length: 13 }, () => new Array<Environment | null>(13).fill(null));
    PointLightManager.lights = new Array<StaticPointLight | null>(255).fill(null);
    PointLightManager.lightCount = 0;
    GlRenderer.active = c.active;
    const tiles = (c.water ? 1 : 4) * 4096;
    const data = new Uint8Array(3 * tiles + c.trailer.length);
    for (let i = 0; i < tiles; i++) {
        data[3 * i] = 50 + (i & 1);
        data[3 * i + 1] = 1;
        data[3 * i + 2] = 2 + (i % 123);
    }
    data.set(c.trailer, tiles * 3);
    let status = 'ok';
    const observed: { packet: PacketT | null } = { packet: null };
    const square = ClientBuild.LoadGroundSquare;
    ClientBuild.LoadGroundSquare = (packet, ...args) => {
        observed.packet = packet;
        square(packet, ...args);
    };
    try {
        ClientBuild.LoadGroundRegion(c.x, 24, c.z, c.level, data, c.angle, maps, c.source, c.water, 16);
    } catch (fault) {
        if (!(fault instanceof WrappedException)) throw fault;
        const cause = fault.cause;
        const name = cause instanceof RangeError ? 'ArrayIndexOutOfBoundsException' : cause?.message;
        status = name + '/' + fault.context;
    } finally {
        ClientBuild.LoadGroundSquare = square;
    }
    const hash = (values: ArrayLike<number>) => Array.from(values).reduce((h, n) => (Math.imul(h, 31) + n) | 0, 1);
    const rows = [status, requireNonNull(observed.packet).m_pos, hash(world.tileCameraClearance.map(plane => hash(plane.map(hash))))];
    for (let i = 0; i < PointLightManager.lightCount; i++) {
        const l = requireNonNull(PointLightManager.lights[i]);
        rows.push(['L', l.m_level, l.x, l.y, l.z, l.bridge, l.m_radius, l.m_rGB, l.m_flickerType, l.waveType, l.frequency, l.amplitude, l.offset].join(' '));
    }
    const bits = (v: number) => new Int32Array(Float32Array.of(v).buffer)[0];
    Environment.grid.forEach((row, x) =>
        row.forEach((e, z) => {
            if (e) rows.push(['E', x, z, e.sunColour, bits(e.ambient), bits(e.diffuse), bits(e.back), e.sunX, e.sunY, e.sunZ, e.fogColour, e.fogDepth].join(' '));
        })
    );
    return rows.join('|');
}

loginFixture(
    import.meta.url,
    'rotated chunk lights, environments and truncated trailers match tm.a',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-hd-chunk-'));
        try {
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            const build = Bun.spawnSync(['javac', asm, '-encoding', 'UTF-8', '-cp', cp, '-sourcepath', import.meta.dir, '-d', dir, join(import.meta.dir, 'HdDynamicChunkOracle.java')]);
            expect(build.exitCode, build.stderr.toString()).toBe(0);
            const java = ['java', asm, '-Djava.awt.headless=true', '-cp', cp, 'HdDynamicChunkOracle'];
            const patched = Bun.spawnSync([...java, hdGamepackPath, dir]);
            expect(patched.exitCode, patched.stderr.toString()).toBe(0);
            const chunks = cases();
            const input = chunks.map(c => [c.angle, c.x, c.z, c.level, c.source, +c.water, +c.active, Buffer.from(c.trailer).toString('hex') || '-'].join(' '));
            const oracle = Bun.spawnSync(java, { stdin: Buffer.from(input.join('\n') + '\n') });
            expect(oracle.exitCode, oracle.stderr.toString()).toBe(0);
            const lines = oracle.stdout.toString().trimEnd().split(/\r?\n/);
            expect(lines.length).toBe(chunks.length);
            expect(lines[0].split('|').filter(s => s.startsWith('L '))).toHaveLength(3);
            expect(lines.some(s => s.includes('wa.EB(1) gi.<init>'))).toBe(true);
            StaticPointLight.mPerlinNoise = new Int32Array(2048);
            const table = requireNonNull(Pix3D.colourTable);
            for (let i = 0; i < table.length; i++) table[i] = Math.imul(i, 3571) & 0xffffff;
            const type = Object.assign(new LightType(), { m_waveType: 4, m_frequency: 287, m_amplitude: 717, m_offset: -51 });
            LightType.cache.Put(42n, type);
            for (const [i, c] of chunks.entries()) expect(state(c), input[i]).toBe(lines[i]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    60000,
    'gl'
);
