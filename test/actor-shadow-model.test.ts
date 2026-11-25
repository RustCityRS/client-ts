import { expect } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ClientBuild from '#/client/ClientBuild.js';
import WrappedException from '#/util/WrappedException.js';
import SeqType from '#/config/SeqType.js';
import ClientEntity from '#/dash3d/ClientEntity.js';
import ModelLitImpl from '#/dash3d/ModelLitImpl.js';
import world from '#/dash3d/world.js';
import { localAssets } from './cachefile.js';
import { loginFixture } from './login-fixture.js';
import { cachePath, gamepackPath } from './reference.js';

interface Inputs {
    x: number;
    z: number;
    size: number;
    outerAlpha: number;
    innerColour: number;
    outerColour: number;
    innerAlpha: number;
    yaw: number;
    stretch: boolean;
    height: number;
    level: number;
    terrain: number;
    actor: number;
    frameMode: number;
    flags: number;
}
const defaults: Inputs = { z: 4096, size: 2, outerAlpha: 192, innerColour: 123, outerColour: 62000, x: 4096, stretch: true, yaw: 0, innerAlpha: 8, height: 0, level: 0, terrain: 0, actor: 0, frameMode: 0, flags: 0 };

function cases(): Map<string, Inputs> {
    const result = new Map<string, Inputs>();
    const add = (name: string, input: Partial<Inputs>) => result.set(name, { ...defaults, ...input });
    add('null actor on first cache miss', { x: 0x78901234, z: -0x34560000, actor: 2, flags: 1 });
    add('hit from ordinary world coordinates', {});
    add('rebuilt at ordinary world coordinates', { flags: 1 });
    add('real frame 63:1 scales shadow vertices', { frameMode: 3 });
    add('real frame 16:7 transforms shadow faces', { frameMode: 4 });
    add('null frame list', { frameMode: 1, flags: 1 });
    add('empty frame list', { frameMode: 2 });
    add('invalid file in cached real frameset', { frameMode: 5 });
    add('negative sequence frame', { frameMode: 6 });
    add('wrong cached type', { flags: 3 });
    add('malformed actor points', { actor: 3, flags: 1 });
    add('empty actor bounds', { actor: 4 });
    for (const size of [1, 2, 3, 4, 5]) {
        for (const boundary of [128, 384, 640, 896, 1152, 1408, 1664, 1920]) {
            for (const yaw of [boundary - 1, boundary, boundary + 1]) {
                add(`size ${size} threshold ${yaw}`, { size, yaw });
            }
        }
        for (const stretch of [false, true])
            for (const actor of [0, 1]) {
                for (const terrain of [0, 1, 2, 3, 4]) {
                    add(`size ${size} terrain ${terrain} stretch ${stretch} actor ${actor}`, { size, yaw: 321, stretch, actor, terrain, x: 47 * 128 + 61, z: 19 * 128 - 7, height: terrain === 0 ? 0 : 9182, level: 1 });
                }
            }
    }
    for (const [x, z] of [
        [0, 0],
        [19, -21],
        [-129, 17],
        [13297, 13249],
        [13312, 13312],
        [-2147483648, 2147483647]
    ]) {
        for (const level of [0, 2, 3, 4]) add(`edge ${x},${z} level ${level}`, { x, z, level, terrain: 2, yaw: 777, height: -2147483648 });
    }
    for (const size of [-2147483648, -1, 0, 2147483647])
        for (const n of [-2147483648, -1, 128, 2147483647]) {
            add(`signed key ${size} ${n}`, { size, innerAlpha: n, outerAlpha: n, innerColour: n, outerColour: n, x: -2147483647, z: 2147483647, level: 3, terrain: 1, yaw: 1741 });
        }
    for (const yaw of [-1, 2047, 2048]) add(`rotation index ${yaw}`, { yaw });
    return result;
}

function wire(c: Inputs): string {
    return [c.z, c.size, c.outerAlpha, c.innerColour, c.outerColour, c.x, Number(c.stretch), c.yaw, c.innerAlpha, c.height, c.level, c.terrain, c.actor, c.frameMode, c.flags].join(' ');
}

function bounds(model: ModelLitImpl | null): string {
    if (model === null) return '-';
    return [Number(model.boundsCalculated), model['minX'], model['maxX'], model['minY'], model['maxY'], model['minZ'], model['maxZ'], model['radiusSphere'], model['radiusCylinder']].join(',');
}

const boundsFields = ['minX', 'maxX', 'minY', 'maxY', 'minZ', 'maxZ', 'radiusSphere', 'radiusCylinder'] as const;
const meshRows = ['pointX', 'pointY', 'pointZ', 'faceVertexA', 'faceVertexB', 'faceVertexC', 'faceColour', 'faceAlpha', 'faceColourA', 'faceColourB', 'faceColourC'] as const;

// Inspect the arrays directly. Asking for a bound through a getter would change the cache-valid flag under test.
function mesh(value: object | null, ids: Map<object, number>): string {
    if (value === null) return '-';
    if (!(value instanceof ModelLitImpl)) return 'other';
    const tag = (item: object) => {
        const prior = ids.get(item);
        if (prior !== undefined) return prior;
        const id = ids.size + 1;
        ids.set(item, id);
        return id;
    };
    const parts = [String(tag(value)), value.numPoints + ',' + value['numFaces'], bounds(value)];
    for (const [fieldIndex, name] of meshRows.entries()) {
        const row = value[name];
        if (row === null) {
            parts.push('-');
            continue;
        }
        const bytes = Buffer.alloc(row.length * 4);
        for (let i = 0; i < row.length; i++) bytes.writeInt32BE(name === 'faceAlpha' ? (row[i] << 24) >> 24 : row[i], i * 4);
        const full = createHash('sha256').update(bytes).digest('hex');
        const used = fieldIndex < 3 ? value.numPoints : value['numFaces'];
        let live;
        if (used === row.length) {
            live = full;
        } else {
            live = createHash('sha256')
                .update(bytes.subarray(0, used * 4))
                .digest('hex');
        }
        parts.push(tag(row) + '@' + full + '@' + live);
    }
    return parts.join(';');
}

function run(c: Inputs, ids: Map<object, number>, countHeights: () => number): string[] {
    if ((c.flags & 1) !== 0) ClientEntity.clearShadowModelCache();
    const low = ((c.outerAlpha << 24) + c.size + (c.innerAlpha << 16)) | 0;
    const key = BigInt.asIntN(64, (BigInt(c.outerColour) << 48n) + (BigInt(c.innerColour) << 32n) + BigInt(low));
    if ((c.flags & 2) !== 0) ClientEntity.shadowModelCache.Put(key, {});
    let actor: ModelLitImpl | null = new ModelLitImpl();
    const radius = c.actor === 1 ? 37 : 850;
    actor.numPoints = 3;
    actor.pointX = Int32Array.of(-radius, radius - 6, 11);
    actor.pointY = Int32Array.of(-5, 19, -7);
    actor.pointZ = Int32Array.of(radius - 4, 17, 3 - radius);
    if (c.actor === 3) actor.pointX = Int32Array.of(1);
    if (c.actor === 4) actor.numPoints = 0;
    if (c.actor === 2) actor = null;
    let seq: SeqType | null = null;
    let frame = 0;
    if (c.frameMode !== 0) {
        seq = new SeqType();
        if (c.frameMode === 2) seq.frames = new Int32Array(0);
        if (c.frameMode === 3) seq.frames = Int32Array.of((63 << 16) | 1);
        if (c.frameMode === 4) seq.frames = Int32Array.of((16 << 16) | 7);
        if (c.frameMode === 5) seq.frames = Int32Array.of((15 << 16) | 65535);
        if (c.frameMode === 6) {
            seq.frames = Int32Array.of(15 << 16);
            frame = -1;
        }
    }
    let value = null,
        outcome = 'ok';
    const before = countHeights();
    try {
        value = ClientEntity.getShadowModel(c.z, c.size, actor, c.outerAlpha, c.innerColour, c.outerColour, seq, c.x, c.stretch, c.yaw, c.innerAlpha, frame, c.height);
    } catch (caught) {
        let error = caught;
        while (error instanceof WrappedException) error = error.cause;
        if (error instanceof TypeError && ['Null reference', 'Null array'].includes(error.message)) outcome = 'null';
        else if (error instanceof RangeError && /^array index -?\d+$/.test(error.message)) outcome = 'index:' + error.message.split(' ').at(-1);
        else if (error instanceof TypeError && error.message === 'Expected ModelLit') outcome = 'cast';
        else throw error;
    }
    return [outcome, String(key), String(ClientEntity.shadowModelCache.countHard()), String(countHeights() - before), bounds(actor), mesh(ClientEntity.shadowModelCache.Find(key), ids), mesh(value, ids), mesh(ModelLitImpl['tempSpotModel'], ids)];
}

loginFixture(
    import.meta.url,
    'actor shadow meshes match kc cache identity animation and bilinear ground on the 530 gamepack',
    async () => {
        const inputs = cases(),
            dir = mkdtempSync(join(tmpdir(), 'rs530-actor-shadows-'));
        const getHeight = Client.GetAvH;
        try {
            const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game', 'ActorShadowModelOracle.java'), join(import.meta.dir, 'review', 'model-mesh', 'ModelMeshOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-XX:-OmitStackTraceInFastThrow', '-cp', dir + delimiter + gamepackPath, 'ActorShadowModelOracle', cachePath], {
                stdin: Buffer.from(Array.from(inputs.values(), wire).join('\n') + '\n'),
                maxBuffer: 16 * 1024 * 1024
            });
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            const lines = java.stdout.toString().trimEnd().split(/\r?\n/);
            expect(lines.length).toBe(inputs.size);
            localAssets(cachePath, [0, 1]);
            const terrain = (slope: boolean) => Array.from({ length: 4 }, (_, p) => Array.from({ length: 105 }, (_, x) => Int32Array.from({ length: 105 }, (_, z) => (slope ? (p * 131 + x * 7 - z * 11) * 10001 : 0))));
            const flags = (bridges: boolean) => Array.from({ length: 4 }, () => Array.from({ length: 104 }, (_, x) => Uint8Array.from({ length: 104 }, (_, z) => (bridges && (x + z) % 3 === 0 ? 2 : 0))));
            const hills = terrain(true),
                flat = terrain(false),
                bridge = flags(true),
                clear = flags(false);
            const ids = new Map<object, number>(),
                results: string[][] = [];
            let samples = 0;
            Client.GetAvH = (x, z, level, guard) => {
                samples++;
                return getHeight(x, z, level, guard);
            };
            for (const [name, c] of inputs) {
                Client.playerLevel = c.level;
                world.levelHeightmaps = c.terrain === 0 ? flat : c.terrain === 3 ? null : hills;
                ClientBuild.m_mapl = c.terrain === 2 ? bridge : c.terrain === 4 ? null : clear;
                const expected = lines[results.length].split('|');
                const actual = run(c, ids, () => samples);
                expect(actual.slice(0, 5), name + ' result / cache / sample count / actor bounds').toEqual(expected.slice(0, 5));
                for (const index of [5, 6, 7]) {
                    const a = actual[index].split(';'),
                        e = expected[index].split(';');
                    expect(a.length, name + ' mesh state').toBe(e.length);
                    if (a.length <= 3) expect(a, name + ' mesh presence').toEqual(e);
                    else {
                        expect(a.slice(0, 3), name + ' mesh identity, counts and bounds ' + boundsFields.join('/')).toEqual(e.slice(0, 3));
                        for (const [i, field] of meshRows.entries()) expect(a[i + 3], name + ' mesh ' + index + ' ' + field).toBe(e[i + 3]);
                    }
                }
                results.push(actual);
            }
            // A null actor faults after caching geometry from the original x/z. Reusing the key keeps that geometry.
            expect(results[0][0]).toBe('null');
            expect(results[0][5]).toBe(results[1][5]);
            const contents = (row: number, model: number, field: number) => results[row][model].split(';')[3 + field].split('@')[2];
            expect(contents(1, 5, 0)).not.toBe(contents(2, 5, 0));
            expect(contents(3, 6, 2)).not.toBe(contents(2, 6, 2));
            expect(contents(4, 6, 7)).not.toBe(contents(2, 6, 7));
        } finally {
            Client.GetAvH = getHeight;
            rmSync(dir, { recursive: true, force: true });
        }
    },
    60000
);
