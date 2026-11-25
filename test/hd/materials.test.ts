import { afterAll, beforeAll, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { glJar } from '#/client/ClientVariant.js';
import Pix3D from '#/dash3d/Pix3D.js';
import Square from '#/dash3d/Square.js';
import TerrainBatch from '#/dash3d/TerrainBatch.js';
import type { HdTextureProvider } from '#/dash3d/TextureProvider.js';
import world from '#/dash3d/world.js';
import { type CapsProfile, capsProfileFromJson, capsProfileToJson, RADEON_CAPS_PROFILE } from '#/gl/CapsProfile.js';
import GlRenderer from '#/gl/GlRenderer.js';
import GlLighting from '#/gl/GlLighting.js';
import { GlTraceWriter, sha256Hex } from '#/gl/GlTrace.js';
import NoiseTextures from '#/gl/NoiseTextures.js';
import NullGL from '#/gl/NullGL.js';
import RecordingGL from '#/gl/RecordingGL.js';
import HighDetailWaterMaterial from '#/gl/material/HighDetailWaterMaterial.js';
import MaterialManager from '#/gl/material/MaterialManager.js';
import type MaterialRenderer from '#/gl/material/MaterialRenderer.js';
import ScrollingDetailMaterial from '#/gl/material/ScrollingDetailMaterial.js';
import SpecularCubeMapMaterial from '#/gl/material/SpecularCubeMapMaterial.js';
import UnderwaterMaterial from '#/gl/material/UnderwaterMaterial.js';
import UnlitMaterial from '#/gl/material/UnlitMaterial.js';
import WaterProgramMaterial from '#/gl/material/WaterProgramMaterial.js';
import { GL } from '#/jogl/GL.js';
import Preferences from '#/ui/Preferences.js';
import { arrayAtObj, requireNonNull } from '#/util/JavaArray.js';
import ByteBuffer from '#/util/nio/ByteBuffer.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';
import { diffTraces } from './glTraceDiff.js';

// The HD material renderers (pc and vm, rd, wg, pd, ob, ue) with MaterialManager (te.e(I)V, cb.b(III)V, gj.b(I)V,
// nj.a(I)V, ef.a(I)I, jj.a(B)[F) against the original code in runescape_gl.jar. HdMaterialsOracle runs a command
// script against the jar under GlRecorder; the same script runs here through RecordingGL(NullGL). Both GLTrace v1
// traces must be equal record for record (every argument, float bits, buffer hashes, normalized names), and every
// command must print the same result line.
//
// Each configuration starts from a fresh state: the tf.m() probe of a capability profile (the four H1 profiles:
// rtx5070, no VBO, no 3D textures, Radeon), optionally overridden to reach the paths those profiles skip (2 or 3
// texture units, no cube maps, no vertex program, a big-endian host, one texture unit). The script creates the
// context's white texture and runs te.e(6) (MaterialManager.createMaterials(6)), whose lm.c()V uploads two synthetic
// noise volumes on both sides, then drives every material's bind, argument and unbind paths, the cb.b(III)V routing,
// rd's 256 argument flags and its per-cycle upload of 64 noise registers, the camera, depth, water colour and
// lighting inputs, and finally the teardown statics.

const classes = [
    ['vm', SpecularCubeMapMaterial],
    ['rd', WaterProgramMaterial],
    ['wg', UnderwaterMaterial],
    ['pd', HighDetailWaterMaterial],
    ['ob', ScrollingDetailMaterial],
    ['ue', UnlitMaterial]
] as const;
const ARB_SHA = '05b4a0e72fd47dddd64ec397b735a871b1510d8c0cd0693189495d18f6a553ce';

let dir = '';
let classpath = '';
let rtxJson = '';

beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'rs530-hd-materials-'));
    classpath = [dir, hdGamepackPath, joglPath].join(delimiter);
    const build = Bun.spawnSync(['javac', '-encoding', 'UTF-8', '-cp', classpath, '-d', dir, ...['GlRecorder.java', 'HdMaterialsOracle.java'].map(name => join(import.meta.dir, name))]);
    expect(build.exitCode, build.stderr.toString()).toBe(0);
    rtxJson = readFileSync(join(import.meta.dir, 'rtx5070.json'), 'utf8');
});

afterAll(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
});

function withoutExtension(json: string, extension: string): string {
    const profile = JSON.parse(json);
    const tokens = (profile.strings[GL.GL_EXTENSIONS] as string).split(' ');
    expect(tokens).toContain(extension);
    profile.strings[GL.GL_EXTENSIONS] = tokens.filter(token => token !== extension).join(' ');
    return JSON.stringify(profile);
}

// The two lm volumes the oracle installs in lm.d and lm.c (lm.a()V then skips its generators).
function volume(multiplier: number, offset: number): ByteBuffer {
    const bytes = ByteBuffer.allocateDirect(524288);
    for (let i = 0; i < 524288; i++) bytes.put(((Math.imul(i, multiplier) + offset) << 24) >> 24);
    bytes.flip();
    return bytes;
}

function hexFloats(values: Float32Array | null): string {
    const view = new DataView(new ArrayBuffer(4));
    return Array.from(requireNonNull(values), v => {
        view.setFloat32(0, v);
        return view.getUint32(0).toString(16).padStart(8, '0');
    }).join(',');
}

function floats(csv: string): Float32Array {
    const view = new DataView(new ArrayBuffer(4));
    return Float32Array.from(csv.split(','), hex => {
        view.setUint32(0, parseInt(hex, 16) >>> 0);
        return view.getFloat32(0);
    });
}

function bits(hex: string): number {
    return requireNonNull(floats(hex)[0]);
}

function kind(e: unknown): string {
    if (e instanceof TypeError) return 'NPE';
    if (e instanceof RangeError) return 'AIOOBE';
    return e instanceof Error ? e.constructor.name : String(e);
}

function material(id: number): MaterialRenderer {
    return requireNonNull(arrayAtObj(MaterialManager.materials, id));
}

// A call boundary, so the reset assignments below do not narrow the static's type.
function materialTable(): (MaterialRenderer | null)[] {
    return requireNonNull(MaterialManager.materials);
}

function triangle(texture: number, blend: boolean, extra: boolean, colour: number): TerrainBatch {
    const batch = new TerrainBatch(texture, 128, blend, extra, colour);
    batch.vertexCapacity = 3;
    batch.tileCapacity = 1;
    batch.allocate();
    const x = texture === 5 ? 49 : 1;
    batch.addVertex(x, 0, 1, 0, 1, 0, 0x346789ff, 0.25);
    batch.addVertex(x, 0, 65, 0, 1, 0, 0x346789ff, 0.5);
    batch.addVertex(x + 64, 0, 1, 0, 1, 0, 0x346789ff, 0.75);
    batch.addTile(0, 0, 0, Int32Array.of(0, 1, 2), null, blend);
    batch.upload();
    return batch;
}

function waterFrame(underwater: boolean, highDetail: boolean): string {
    GlRenderer.active = true;
    GlRenderer.vboSupported = false;
    Preferences.highDetailLighting = false;
    Preferences.highWaterDetail = highDetail;
    Preferences.sceneryShadows = 0;
    MaterialManager.locked = false;
    MaterialManager.setMaterial(0, 0);
    const textures: Pick<HdTextureProvider, 'materialType' | 'bindTexture'> = {
        materialType: id => id,
        bindTexture: id => MaterialManager.setMaterial(1, id)
    };
    Pix3D.textureProvider = textures as HdTextureProvider;
    world.minLevel = world.minX = world.minZ = world.gx = world.eyeTileZ = world.viewRadius = 0;
    world.maxLevel = world.maxX = world.maxZ = 1;
    world.visibilityMap = [[true]];
    const tile = new Square(0, 0, 0);
    world.squares = [[[tile]]];
    world.mainGroundh = [[Int32Array.of(-16, -24), Int32Array.of(-32, -40)]];
    world.underwaterHeightmap = [[new Int32Array(2), new Int32Array(2)]];
    world.levelHeightmaps = underwater ? world.underwaterHeightmap : world.mainGroundh;
    world.waterSpriteKeys = [Int32Array.of(0x05204060)];
    world.mainTerrainBatches = [[triangle(4, false, false, 0x234567), triangle(5, true, false, 0x456789)]];
    world.terrainBatches = underwater ? [[triangle(-1, false, true, 0x112233), triangle(5, true, true, 0x556677)]] : world.mainTerrainBatches;
    world.Render(32, 48, 16, null, 0, 0, 0, 0);
    return ['frame', MaterialManager.current, MaterialManager.currentArgument, MaterialManager.locked, world['waterColour'], world['waterDepth'], tile.drawFront, world.fillLeft].join(' ');
}

interface Run {
    readonly trace: string;
    readonly results: string[];
}

function runJava(name: string, profileJson: string, script: readonly string[]): Run & { probe: string } {
    const traceDir = join(dir, name);
    const profilePath = join(dir, name + '.json');
    writeFileSync(profilePath, profileJson);
    const run = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-Dgltrace.stacks=false', '-cp', classpath, 'HdMaterialsOracle', traceDir, profilePath], {
        stdin: Buffer.from(script.join('\n') + '\n'),
        maxBuffer: 64 * 1024 * 1024,
        timeout: 120000
    });
    expect(run.exitCode, run.stderr.toString()).toBe(0);
    const lines = run.stdout.toString().trimEnd().split(/\r?\n/);
    return { probe: requireNonNull(lines[0]), results: lines.slice(1), trace: readFileSync(join(traceDir, 'trace.tsv'), 'utf8') };
}

// The TS side of HdMaterialsOracle.main: the same probe results, the same silent reset of tf's cached state, then the
// same commands on the ported classes.
function runTs(profile: CapsProfile, probe: string, script: readonly string[]): Run {
    const [, status, units, cubeMap, vertexProgram, texture3d, bigEndian] = probe.split(' ');
    expect(status).toBe('0');
    GlRenderer.gl = new NullGL(profile);
    GlRenderer.maxTextureUnits = Number(units);
    GlRenderer.cubeMapSupported = cubeMap === 'true';
    GlRenderer.vertexProgramSupported = vertexProgram === 'true';
    GlRenderer.texture3d = texture3d === 'true';
    GlRenderer.bigEndian = bigEndian === 'true';
    GlRenderer.setLighting(false);
    GlRenderer.setLighting(true);
    GlRenderer.setTextureCombineAlpha(1);
    GlRenderer.setTextureCombineAlpha(0);
    GlRenderer.setTextureCombineRgb(1);
    GlRenderer.setTextureCombineRgb(0);
    GlRenderer.bindTexture2D(0);
    GlRenderer.bindTexture2D(-1);
    GlRenderer.resetTextureMatrix();
    // A fresh JVM per configuration on the Java side: put back the <clinit> state the previous configuration changed.
    NoiseTextures['ridgedVolume'] = volume(7, 3);
    NoiseTextures['fractalVolume'] = volume(13, 5);
    NoiseTextures.ridgedTexture = -1;
    NoiseTextures.fractalTexture = -1;
    NoiseTextures.ridgedSlices = null;
    NoiseTextures.fractalSlices = null;
    NoiseTextures.texture3d = false;
    UnderwaterMaterial['threeUnits'] = false;
    WaterProgramMaterial.ambient = new Float32Array(4);
    HighDetailWaterMaterial.environmentColour = new Float32Array([0.1, 0.1, 0.15, 0.1]);
    MaterialManager.materials = null;
    MaterialManager.current = 0;
    MaterialManager.currentArgument = 0;
    MaterialManager.locked = false;
    MaterialManager.fogColour = new Float32Array(4);
    const writer = new GlTraceWriter();
    const recording = new RecordingGL(new NullGL(profile), writer);
    const results: string[] = [];
    for (const line of script) {
        const v = line.split(' ');
        const n = (i: number) => Number(v[i]);
        let result = 'ok';
        try {
            switch (v[0]) {
                case 'override':
                    if (v[1] !== '-') GlRenderer.maxTextureUnits = n(1);
                    if (v[2] !== '-') GlRenderer.cubeMapSupported = v[2] === '1';
                    if (v[3] !== '-') GlRenderer.vertexProgramSupported = v[3] === '1';
                    if (v[4] !== '-') GlRenderer.texture3d = v[4] === '1';
                    if (v[5] !== '-') GlRenderer.bigEndian = v[5] === '1';
                    break;
                case 'record':
                    GlRenderer.gl = recording;
                    break;
                case 'white': {
                    const name = new Int32Array(1);
                    requireNonNull(GlRenderer.gl).glGenTextures(1, name, 0);
                    GlRenderer.whiteTexture = name[0];
                    break;
                }
                case 'build':
                    MaterialManager.createMaterials(n(1));
                    break;
                case 'materials': {
                    const names = materialTable().map(m => (m === null ? '-' : requireNonNull(classes.find(([, c]) => m instanceof c))[0]));
                    result = 'materials ' + names.join(' ') + ' noise ' + NoiseTextures.texture3d + ' ' + (NoiseTextures.ridgedSlices === null ? '-' : '2d') + ' ' + (NoiseTextures.fractalSlices === null ? '-' : '2d');
                    break;
                }
                case 'prefs':
                    Preferences.highDetailLighting = v[1] === '1';
                    Preferences.highWaterDetail = v[2] === '1';
                    break;
                case 'cycle':
                    GlRenderer.cycle = n(1);
                    break;
                case 'camera':
                    MaterialManager.cameraX = n(1);
                    MaterialManager.cameraY = n(2);
                    MaterialManager.cameraZ = n(3);
                    MaterialManager.cameraYaw = n(4);
                    MaterialManager.cameraPitch = n(5);
                    break;
                case 'depth':
                    MaterialManager.underwaterDepth = n(1);
                    break;
                case 'water':
                    requireNonNull(MaterialManager.underwaterColour).set(floats(requireNonNull(v[1])));
                    break;
                case 'light':
                    Reflect.set(GlLighting, 'sunColour', n(1));
                    Reflect.set(GlLighting, 'ambientIntensity', bits(requireNonNull(v[2])));
                    Reflect.set(GlLighting, 'diffuseIntensity', bits(requireNonNull(v[3])));
                    break;
                case 'ambient':
                    requireNonNull(GlRenderer.gl).glLightModelfv(GL.GL_LIGHT_MODEL_AMBIENT, floats(requireNonNull(v[1])), 0);
                    break;
                case 'set':
                    MaterialManager.setMaterial(n(1), n(2));
                    break;
                case 'lock':
                    MaterialManager.locked = v[1] === '1';
                    break;
                case 'state':
                    result = 'state ' + MaterialManager.current + ' ' + MaterialManager.currentArgument + ' ' + MaterialManager.locked;
                    break;
                case 'bind':
                    material(n(1)).bind();
                    break;
                case 'unbind':
                    material(n(1)).unbind();
                    break;
                case 'arg':
                    material(n(1)).setArgument(n(2));
                    break;
                case 'flags':
                    result = 'flags ' + material(n(1)).flags();
                    break;
                case 'mflags':
                    result = 'flags ' + MaterialManager.getMaterialFlags();
                    break;
                case 'wgclient':
                    if (v[1] === '1') UnderwaterMaterial.enableRampCoordArray();
                    else UnderwaterMaterial.disableRampCoordArray();
                    break;
                case 'wgunit':
                    result = 'unit ' + UnderwaterMaterial.rampUnit();
                    break;
                case 'waterframe':
                    result = waterFrame(v[1] === '1', v[2] === '1');
                    break;
                case 'fog':
                    result = 'fog ' + hexFloats(MaterialManager.underwaterFogColour());
                    break;
                case 'reset':
                    MaterialManager.resetMaterial();
                    break;
                case 'release':
                    MaterialManager.releaseMaterials();
                    break;
                case 'unload':
                    WaterProgramMaterial.unload();
                    HighDetailWaterMaterial.unload();
                    break;
                case 'mark':
                    writer.mark(requireNonNull(v[1]));
                    break;
                default:
                    throw new Error('unknown command ' + line);
            }
        } catch (e) {
            if (e instanceof Error && e.message.startsWith('unknown command')) throw e;
            result = 'throw ' + kind(e);
        }
        results.push(result);
    }
    return { trace: writer.text(), results };
}

const range = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => from + i);
// No NaN may arise: Java stores the x86 default NaN (0xffc00000) where a JS number can only carry the canonical one.
const WATER = ['3d95810e,3e2d0e56,3e75c28f,3f800000', '3f000000,00000000,bf800000,3f800000', '7f7fffff,ff7fffff,00000001,3f000000'];
const LIGHT = ['16777215 3f938000 3f330000', '1193046 3f4ccccd 3e99999a', '-1 bf800000 40000000', '8454015 00000000 80000000', '0 3f800000 3f800000'];

function script(full: boolean, override: string | null): string[] {
    const s: string[] = [];
    if (override !== null) s.push('override ' + override);
    s.push('record', 'mark context', 'white', 'build 6', 'mark built', 'materials', ...range(1, 7).map(m => 'flags ' + m), 'wgunit', 'mflags');
    s.push('prefs 1 1', 'cycle 0', 'camera 37 -128 92 512 256', 'depth 300', 'water ' + WATER[0], 'light ' + LIGHT[0], 'ambient 3d808081,3e008081,3e808081,3f800000', 'fog');
    // Direct bind / argument / unbind per material, with and without high-detail lighting.
    const args: Record<number, number[]> = {
        1: full ? [...range(0, 256), -1] : [1, 2, 3, 0, 4, -1],
        2: full ? range(0, 256) : [0, 1, 2, 3, 64, 128, 194, 255, -1, 256],
        3: [...(full ? range(0, 256) : [0, 1, 100]), -1, -100, 2147483647, -2147483648],
        4: [...(full ? range(0, 256) : [0, 1, 2, 3]), -1, 2147483647],
        5: full ? range(0, 256) : [0, 3, 8, 24, 64, 128, 192, 255, -1],
        6: [0, 1]
    };
    for (const lighting of [1, 0]) {
        s.push('prefs ' + lighting + ' 1');
        for (let m = 1; m <= 6; m++) {
            s.push('mark m' + m + '.' + lighting, 'bind ' + m, ...requireNonNull(args[m]).map(a => 'arg ' + m + ' ' + a), 'unbind ' + m, 'flags ' + m);
        }
    }
    s.push('prefs 1 1', 'mark program');
    // rd: every argument flag after a new light-model ambient, then the per-cycle noise register upload.
    s.push('ambient 3ec00000,bf000000,3fa00000,80000000');
    for (const flags of full ? range(0, 256) : [0, 63, 64, 128, 193, 255]) s.push('arg 2 ' + flags);
    for (const cycle of [...(full ? range(0, 256) : [0, 1, 17, 255]), 255, 256, 511, 100000, 2147483647, 33554432, -1, -64, -2147483648]) {
        s.push('cycle ' + cycle, 'bind 2');
    }
    s.push('unbind 2', 'mark animation');
    // The cycle-driven planes and noise frames of wg, pd and ob.
    for (const cycle of [0, 1, 99, 100, 200, 12345, 2147483647, -1, -101, -2147483648]) {
        s.push('cycle ' + cycle, 'arg 4 1', 'arg 4 1', 'arg 4 0', 'arg 5 0', 'arg 5 255', 'arg 5 27', 'arg 3 50', 'bind 2');
    }
    s.push('mark camera');
    for (const camera of ['0 0 0 0 0', '-2147483648 2147483647 0 -1 2047', '3200 -500 3200 1024 1460', '1 2 3 4 1459', '-7 8 -9 2048 1461', '5 5 5 -2048 -4096']) {
        s.push('camera ' + camera, 'cycle 3', 'bind 2', 'bind 4', 'arg 3 7', 'arg 5 129', 'unbind 4');
    }
    s.push('mark fog');
    for (const depth of [300, 0, -8, 2040, 1]) {
        for (const water of WATER) {
            for (const light of LIGHT) s.push('depth ' + depth, 'water ' + water, 'light ' + light, 'fog', 'arg 3 ' + (depth + 5), 'arg 4 2');
        }
    }
    s.push('mark route', 'camera 37 -128 92 512 256', 'cycle 9', 'water ' + WATER[0], 'light ' + LIGHT[0], 'depth 300');
    // cb.b(III)V: same material, argument changes, the material 4 -> 2 route, the lock, invalid ids.
    for (const command of [
        'state',
        'set 1 1',
        'state',
        'mflags',
        'set 1 1',
        'set 2 1',
        'set 2 2',
        'mflags',
        'set 0 0',
        'state',
        'set 5 4',
        'mflags',
        'prefs 1 0',
        'set 5 4',
        'state',
        'set 7 4',
        'set 2 4',
        'set 3 4',
        'state',
        'lock 1',
        'set 3 3',
        'set 9 2',
        'state',
        'lock 0',
        'set -5 3',
        'set 0 6',
        'set 0 6',
        'set 1 6',
        'mflags',
        'prefs 0 0',
        'set 0 1',
        'set 0 6',
        'prefs 1 1',
        'set 0 5',
        'set 0 7',
        'state',
        'set 0 -1',
        'state',
        'reset',
        'state',
        'reset',
        'set 40 3',
        'wgclient 1',
        'wgclient 0',
        'wgunit',
        'set 0 0',
        'state'
    ])
        s.push(command);
    s.push('mark teardown', 'unload', 'arg 2 0', 'arg 2 64', 'bind 4', 'release', 'materials', 'set 0 1', 'state', 'mflags');
    return s;
}

interface Config {
    readonly name: string;
    readonly profile: () => string;
    readonly override: string | null;
    readonly full: boolean;
}

const configs: readonly Config[] = [
    { name: 'rtx5070', profile: () => rtxJson, override: null, full: true },
    { name: 'noVbo', profile: () => withoutExtension(rtxJson, 'GL_ARB_vertex_buffer_object'), override: null, full: false },
    { name: 'no3d', profile: () => withoutExtension(rtxJson, 'GL_EXT_texture3D'), override: null, full: true },
    { name: 'radeon', profile: () => capsProfileToJson(RADEON_CAPS_PROFILE), override: null, full: false },
    { name: 'units3', profile: () => rtxJson, override: '3 - - - -', full: false },
    { name: 'units2', profile: () => rtxJson, override: '2 - - - -', full: false },
    { name: 'units2-no3d', profile: () => rtxJson, override: '2 - - 0 -', full: false },
    { name: 'units1', profile: () => rtxJson, override: '1 - - - -', full: false },
    { name: 'noCubeMap-bigEndian', profile: () => rtxJson, override: '- 0 - - 1', full: false },
    { name: 'noVertexProgram', profile: () => rtxJson, override: '- - 0 - -', full: false }
];

const waterFrameTest = 'HD water and underwater scene frames match original terrain draws and state';
test(
    waterFrameTest,
    () => {
        if (!glJar) {
            const result = Bun.spawnSync([process.execPath, 'test', '--test-name-pattern', waterFrameTest, fileURLToPath(import.meta.url)], { env: { ...process.env, RS530_GAMEPACK_IDENTITY: 'gl' }, timeout: 120000 });
            expect(result.exitCode, result.stderr.toString()).toBe(0);
            return;
        }
        const commands = ['record', 'white', 'build 6', 'camera 37 -128 92 512 256', 'cycle 9', 'light ' + LIGHT[0]];
        for (const wet of [0, 1])
            for (const high of [0, 1]) {
                commands.push('mark frame' + wet + high, 'waterframe ' + wet + ' ' + high);
            }
        commands.push('mark end');
        const java = runJava('water-frames', rtxJson, commands);
        const ts = runTs(capsProfileFromJson(rtxJson), java.probe, commands);
        const segments = java.trace.split(/~mark\t[^\n]*\n/);
        for (const wet of [0, 1])
            for (const high of [0, 1]) {
                const index = commands.indexOf('waterframe ' + wet + ' ' + high);
                expect(java.results[index]).toStartWith('frame ');
                expect(ts.results[index]).toBe(java.results[index]);
                expect((segments[1 + wet * 2 + high]?.match(/\tglDrawElements\t/g) ?? []).length).toBe(wet ? 3 : 2);
            }
        const difference = diffTraces(java.trace, ts.trace, { expectedLabel: 'jar', actualLabel: 'ts', includeDeletions: true });
        if (!difference.equal) throw new Error(difference.report);
    },
    120000
);

test('the shipped ARB program literal is the 1,736-byte source', () => {
    const source = WaterProgramMaterial.PROGRAM_SOURCE;
    expect(source.length).toBe(1736);
    expect(sha256Hex(new TextEncoder().encode(source))).toBe(ARB_SHA);
});

// test/render/hd-program.test.ts pins rd's 256 x 64 register table: SHA-256 of its 65,536 raw words in
// little-endian order, written through the little-endian (tf.f false) and big-endian (tf.f true) PacketT paths.
test('rd.<init>() builds the noise register table hd-program.test.ts pins for both float writers', () => {
    const tables = ['307460648dd4a18d05b706af682bb54e78de8db6656bef894d94971b27af06f1', '20cb151aa1705c2e25c1a830dd97a6684006a841a8563ee8828bc08c6fa29926'];
    for (const [i, bigEndian] of [false, true].entries()) {
        GlRenderer.gl = new NullGL(capsProfileFromJson(rtxJson));
        GlRenderer.vertexProgramSupported = true;
        GlRenderer.maxTextureUnits = 4;
        GlRenderer.bigEndian = bigEndian;
        const noise = requireNonNull(new WaterProgramMaterial()['noise']);
        expect([noise.position(), noise.limit(), noise.capacity(), noise.isDirect(), noise.isReadOnly()]).toEqual([0, 65536, 65536, true, true]);
        expect(sha256Hex(noise.storageBytes())).toBe(tables[i]);
    }
});

for (const config of configs) {
    test(
        'HD materials match the original jar: ' + config.name,
        () => {
            const commands = script(config.full, config.override);
            const profileJson = config.profile();
            const java = runJava(config.name, profileJson, commands);
            const ts = runTs(capsProfileFromJson(profileJson), java.probe, commands);
            for (let i = 0; i < commands.length; i++) {
                if (ts.results[i] !== java.results[i]) throw new Error('command ' + i + ' (' + commands[i] + '): java ' + java.results[i] + ', ts ' + ts.results[i]);
            }
            expect(ts.results).toHaveLength(java.results.length);
            const diff = diffTraces(java.trace, ts.trace, { expectedLabel: 'jar', actualLabel: 'ts', includeDeletions: true });
            if (!diff.equal) throw new Error(diff.report);
            if (config.name === 'rtx5070') {
                // te.e(6) builds all six materials and ten display lists; rd loads the shipped program.
                expect(java.results[commands.indexOf('materials')]).toBe('materials - vm rd wg pd ob ue noise true - -');
                expect(java.trace).toContain('glProgramStringARB\t34336\t34933\t1736\tS:1736:' + ARB_SHA);
                expect(java.trace.split('\n').filter(line => line.includes('\tglNewList\t'))).toHaveLength(10);
            }
        },
        180000
    );
}
