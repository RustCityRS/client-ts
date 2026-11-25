import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ClientBuild from '#/client/ClientBuild.js';
import WrappedException from '#/util/WrappedException.js';
import BASType from '#/config/BASType.js';
import BASTypeList from '#/config/BASTypeList.js';
import ClientEntity from '#/dash3d/ClientEntity.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import ModelLitImpl from '#/dash3d/ModelLitImpl.js';
import Pix3D from '#/dash3d/Pix3D.js';
import world from '#/dash3d/world.js';
import { gamepackPath } from './reference.js';

const fields = ['rollAngle', 'rollTarget', 'rollVelocity', 'rollBrakeAt', 'rollAccelerating', 'pitchAngle', 'pitchTarget', 'pitchVelocity', 'pitchBrakeAt', 'pitchAccelerating'];
const base = [
    0,
    1,
    0,
    319, // method, iterations, probe, yaw
    123,
    82,
    593,
    -199,
    8923,
    6091, // BAS footprint, scene height, model minY, actor x/z
    1,
    25,
    -576,
    710,
    37,
    43,
    97,
    123, // turning, roll/pitch targets, accelerations and limits
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0 // ten actor fields in the order above
];
function vector(changes: Record<number, number>): number[] {
    return Object.assign(base.slice(), changes);
}

test('actor lean and four-corner hill transforms match the 530 JAR, including partial state before each model fault', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-actor-model-'));
    const old = {
        bas: BASTypeList.defaultType,
        level: Client.playerLevel,
        height: Client.GetAvH,
        heights: world.levelHeightmaps,
        flags: ClientBuild.m_mapl,
        sin: Pix3D.sinTable,
        cos: Pix3D.cosTable,
        pitch: ClientEntity.tiltPitch,
        roll: ClientEntity.groundTiltRoll,
        offsetY: ClientEntity.tiltOffsetY
    };
    function run(a: number[]): string {
        const actor = new ClientPlayer(),
            bas = new BASType();
        const mode = a[2];
        let minY = a[7],
            ordinal = 0,
            modelCalls = 0;
        const trace: string[] = [];
        Client.playerLevel = 1;
        ClientEntity.tiltPitch = 38;
        ClientEntity.groundTiltRoll = -7;
        ClientEntity.tiltOffsetY = 935;
        Reflect.set(BASTypeList, 'defaultType', mode === 13 ? null : bas);
        Pix3D.cosTable = mode === 9 ? new Int32Array(0) : old.cos;
        Pix3D.sinTable = mode === 10 ? null : old.sin;
        bas.hillX = a[4];
        bas.m_hillRotateLength = a[5];
        actor.sceneHeight = a[6];
        actor.x = a[8];
        actor.z = a[9];
        actor.turnAccelerating = a[10] !== 0;
        actor.turnVelocity = a[11];
        bas.roll = a[12];
        bas.pitch = a[13];
        bas.rollAcceleration = a[14];
        bas.pitchAcceleration = a[15];
        bas.rollMax = a[16];
        bas.pitchMax = a[17];
        for (const [i, field] of fields.entries()) Reflect.set(actor, field, i % 5 === 4 ? a[18 + i] !== 0 : a[18 + i]);
        const state = () => [...fields.map(field => Reflect.get(actor, field)), ClientEntity.tiltPitch, ClientEntity.groundTiltRoll, ClientEntity.tiltOffsetY].join(',');
        function event(value: string): void {
            trace.push(value);
            modelCalls++;
            if (mode >= 20 && modelCalls === mode - 19) throw new Error('probe');
            if (mode === 12) {
                actor.sceneHeight = (actor.sceneHeight + 76) | 0;
                bas.pitchAcceleration = 36;
                if (modelCalls === 1) minY ^= -126;
            }
        }
        const lit = new ModelLitImpl();
        lit.getMinY = () => {
            const value = minY;
            event('m' + value);
            return value;
        };
        lit.RotateXAxis = value => event('x' + value);
        lit.rotateZAxis = value => event('z' + value);
        lit.Translate = (x, y, z) => event('y' + [x, y, z].join(','));
        Client.GetAvH = (x, z, level, guard) => {
            trace.push('h' + [level, x, z].join(','));
            const corner = ordinal++ & 3;
            if (mode === 1) {
                Client.playerLevel++;
                actor.x = (actor.x + 19) | 0;
                actor.z = (actor.z - 393) | 0;
            }
            if (mode >= 2 && mode <= 5 && corner === mode - 2) throw new Error('probe');
            if (mode === 6) return [0x7fffffff, 0x40000100, 0x70000000, -0x7fffffff][corner];
            if (mode === 7) return 0;
            if (mode === 8) return old.height(x, z, level, guard);
            return (Math.imul(x, 17) - Math.imul(z, 111) + Math.imul(x ^ z, 45) + level * 9231) >> 3;
        };
        const model = mode === 11 ? null : lit;
        let result = 'ok';
        try {
            for (let step = 0; step < a[1]; step++) {
                if (step === 5 || step === 11) actor.turnVelocity = -actor.turnVelocity | 0;
                if (step === 17) actor.turnAccelerating = false;
                if (a[0] === 0) Reflect.apply(actor.updateRollPitch, actor, [model]);
                else Reflect.apply(actor.CalculateHillRotateTransform, actor, [a[3], model]);
                trace.push('c' + state());
            }
        } catch (caught) {
            let e = caught;
            while (e instanceof WrappedException) e = e.cause;
            if (e instanceof TypeError) result = 'null';
            else if (e instanceof RangeError && /array index /.test(e.message)) result = 'bounds';
            else if (e instanceof RangeError && e.message === '/ by zero') result = 'div';
            else if (e instanceof Error && e.message === 'probe') result = 'probe';
            else throw e;
        }
        return result + '|' + state() + '|' + trace.join(';');
    }
    try {
        world.levelHeightmaps = Array.from({ length: 4 }, (_, p) => Array.from({ length: 105 }, (_, x) => Int32Array.from({ length: 105 }, (_, z) => p * 31917 - x * 117 + z * x * 73)));
        ClientBuild.m_mapl = Array.from({ length: 4 }, () => Array.from({ length: 104 }, (_, x) => Uint8Array.from({ length: 104 }, (_, z) => x ^ z)));
        const access = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
        const build = Bun.spawnSync(['javac', ...access, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game/ActorModelTransformOracle.java')]);
        expect(build.exitCode, build.stderr.toString()).toBe(0);
        const java = ['java', ...access, '-cp', dir + delimiter + gamepackPath, 'ActorModelTransformOracle'];
        const probes = Bun.spawnSync([...java, gamepackPath, dir]);
        expect(probes.exitCode, probes.stderr.toString()).toBe(0);
        const cases: number[][] = [];
        for (const operation of [0, 1])
            for (const mode of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 20, 21, 22, 23, 24, 25, 26, 27]) {
                for (const repeat of [1, 25]) cases.push(vector({ 0: operation, 1: repeat, 2: mode }));
            }
        for (const yaw of [-1, 0, 1, 256, 511, 512, 633, 1024, 1536, 1999, 2047, 2048]) {
            for (const [width, length] of [
                [0, 0],
                [1, 0],
                [0, -63],
                [1, 1],
                [100, 101],
                [125, 17],
                [-35, -84],
                [-2147483648, 2147483647]
            ]) {
                cases.push(vector({ 0: 1, 2: 8, 3: yaw, 4: width, 5: length }));
            }
        }
        for (const value of [0, 1, -1, 31, -31, 2147483647, -2147483648])
            for (const index of [4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 20, 23, 25]) {
                cases.push(vector({ 0: index < 7 || index === 8 || index === 9 ? 1 : 0, [index]: value, 1: 7 }));
            }
        let random = 250226;
        const next = () => (random = (Math.imul(random, 1664525) + 1013904223) | 0);
        for (let n = 0; n < 550; n++) {
            const a = base.slice();
            a[1] = 3;
            a[10] = next() >>> 30;
            a[11] = next() >> 25;
            for (let i = 12; i < 28; i++) {
                const r = next();
                a[i] = i === 22 || i === 27 ? r >>> 31 : n % 5 === 0 ? r : r >> 21;
            }
            cases.push(a);
        }
        const result = Bun.spawnSync(java, { stdin: Buffer.from(cases.map(a => a.join(' ')).join('\n') + '\n'), maxBuffer: 32 * 1024 * 1024 });
        expect(result.exitCode, result.stderr.toString()).toBe(0);
        const lines = result.stdout.toString().trimEnd().split(/\r?\n/);
        expect(lines.length).toBe(cases.length);
        for (const [i, a] of cases.entries()) expect(run(a), a.join(' ')).toBe(lines[i]);
    } finally {
        Reflect.set(BASTypeList, 'defaultType', old.bas);
        Client.playerLevel = old.level;
        Client.GetAvH = old.height;
        world.levelHeightmaps = old.heights;
        ClientBuild.m_mapl = old.flags;
        Pix3D.cosTable = old.cos;
        Pix3D.sinTable = old.sin;
        ClientEntity.tiltPitch = old.pitch;
        ClientEntity.groundTiltRoll = old.roll;
        ClientEntity.tiltOffsetY = old.offsetY;
        rmSync(dir, { recursive: true, force: true });
    }
}, 60000);
