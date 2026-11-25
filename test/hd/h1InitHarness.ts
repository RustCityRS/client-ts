// The TS side of HdH1InitOracle.java for the H1 gate (h1-init.test.ts). Runs Codex's HdInitOracle start on the port:
// GlRenderer.init (tf.a(Ljava/awt/Canvas;I)I) first on an undisplayable canvas, then on the 871x613 display, through
// the JOGL mirror's drawable-factory registry with a RecordingGLDrawableFactory over either NullGLDrawableFactory
// (driver "null", run by bun) or WebGpuDrawableFactory on headless Dawn (driver "webgpu", bundled and run by node,
// since Bun crashes loading dawn.node). Nothing in the H1 classes is mocked: the real GlRenderer, GlCleaner,
// MaterialManager, NoiseTextures and the six material renderers run. It prints HdInitOracle's lines and the
// HdH1InitOracle dump to stdout.txt and writes the GLTrace to trace.tsv.
//
// Members that tf calls but whose owner is not ported yet (GlLighting mk.e, PointLightManager jf.f/jf.e/jf.c, batches
// H3 and H5) are installed as stubs only when the class lacks them, and listed in stubs.txt. The stubs for mk.e and
// jf.e, whose Java bodies always issue GL calls, put a `call.<java method>` mark into the trace where the test collapses
// the Java trace's run of calls from that method. Once those members exist no stub is installed and the gate compares
// the whole trace.
//
// usage: bun h1InitHarness.ts <outDir> <profile.json> <samples> null
//        node <bundle> <outDir> <profile.json> <samples> webgpu <path of node_modules/webgpu/index.js>
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { capsProfileFromJson } from '../../src/gl/CapsProfile.js';
import GlCleaner from '../../src/gl/GlCleaner.js';
import GlLighting from '../../src/gl/GlLighting.js';
import GlRenderer from '../../src/gl/GlRenderer.js';
import { floatBits, GlTraceWriter, hex8 } from '../../src/gl/GlTrace.js';
import HighDetailWaterMaterial from '../../src/gl/material/HighDetailWaterMaterial.js';
import MaterialManager from '../../src/gl/material/MaterialManager.js';
import ScrollingDetailMaterial from '../../src/gl/material/ScrollingDetailMaterial.js';
import SpecularCubeMapMaterial from '../../src/gl/material/SpecularCubeMapMaterial.js';
import UnderwaterMaterial from '../../src/gl/material/UnderwaterMaterial.js';
import UnlitMaterial from '../../src/gl/material/UnlitMaterial.js';
import WaterProgramMaterial from '../../src/gl/material/WaterProgramMaterial.js';
import NoiseTextures from '../../src/gl/NoiseTextures.js';
import NullGL, { NullGLDrawableFactory } from '../../src/gl/NullGL.js';
import PointLightManager from '../../src/gl/PointLightManager.js';
import { RecordingGLDrawableFactory } from '../../src/gl/RecordingGL.js';
import GLContext from '../../src/jogl/GLContext.js';
import type GLDrawableFactory from '../../src/jogl/GLDrawableFactory.js';
import { registerGLDrawableFactory } from '../../src/jogl/GLDrawableFactory.js';
import ByteBuffer from '../../src/util/nio/ByteBuffer.js';
import FloatBuffer from '../../src/util/nio/FloatBuffer.js';

const [outDir, profilePath, samplesText, driver, webgpuPath] = process.argv.slice(2);
const samples = Number(samplesText);
const profile = capsProfileFromJson(readFileSync(profilePath, 'utf8'));
const writer = new GlTraceWriter();
const lines: string[] = [];
const out = (line: string): void => {
    lines.push(line);
};

// ---- stubs for the members of not-yet-ported owners ------------------------------------------------------------
const stubs: string[] = [];
function stub(owner: object, ownerName: string, member: string, java: string, marks: boolean): void {
    if (typeof Reflect.get(owner, member) === 'function') return;
    stubs.push(ownerName + '.' + member + ' ' + java);
    Reflect.set(owner, member, (): void => {
        if (marks) writer.mark('call.' + java);
    });
}
stub(GlLighting, 'GlLighting', 'init', 'mk.e', true);
stub(PointLightManager, 'PointLightManager', 'allocate', 'jf.f', false);
stub(PointLightManager, 'PointLightManager', 'init', 'jf.e', true);
stub(PointLightManager, 'PointLightManager', 'release', 'jf.c', false);

// ---- the platform -------------------------------------------------------------------------------------------------
const errors: string[] = [];
let finish: () => Promise<void> = async () => {};
let inner: GLDrawableFactory;
let glClass: (abstract new (...args: never[]) => object) | null = null;
if (driver === 'webgpu') {
    const webgpu = (await import(pathToFileURL(webgpuPath).href)) as { create: (o: string[]) => GPU; globals: object };
    Object.assign(globalThis, webgpu.globals);
    const root = webgpu.create([]);
    const adapter = await root.requestAdapter({ powerPreference: 'high-performance' });
    if (adapter === null) throw new Error('no WebGPU adapter');
    const device = await adapter.requestDevice();
    device.addEventListener('uncapturederror', e => errors.push((e as GPUUncapturedErrorEvent).error.message));
    const { default: GpuDevice } = await import('../../src/gl/driver/GpuDevice.js');
    const { WebGpuDrawableFactory } = await import('../../src/gl/driver/WebGpuDrawableFactory.js');
    glClass = (await import('../../src/gl/driver/WebGpuGL.js')).default;
    const gpu = GpuDevice.install(device, 'bgra8unorm');
    inner = new WebGpuDrawableFactory(profile, { device: gpu });
    finish = async () => {
        gpu.submit();
        await device.queue.onSubmittedWorkDone();
        // keep the GPU root reachable until here (dawn.node crashes if it is collected under a live adapter)
        if (root === null) throw new Error('unreachable');
        device.destroy();
    };
} else if (driver === 'null') {
    inner = new NullGLDrawableFactory(profile);
} else {
    throw new Error('driver ' + driver);
}
registerGLDrawableFactory(() => new RecordingGLDrawableFactory(inner, writer));

// java.awt.Canvas as tf sees it (isDisplayable, getSize); HdInitOracle's Display is displayable at 871x613, and its
// first call passes a plain undisplayable Canvas.
class Display {
    constructor(private readonly displayable: boolean) {}
    isDisplayable(): boolean {
        return this.displayable;
    }
    getSize(): { width: number; height: number } {
        return { width: 871, height: 613 };
    }
}

// ---- the dump (HdH1InitOracle.value) ------------------------------------------------------------------------------
const sha = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

function buffer(b: ByteBuffer | FloatBuffer): string {
    const head = (b.isDirect() ? 'direct' : 'heap') + ':' + (b.isReadOnly() ? 'ro' : 'rw') + ':' + b.position() + ':' + b.limit() + ':' + b.capacity();
    if (b instanceof ByteBuffer) {
        const data = new Uint8Array(b.limit());
        for (let i = 0; i < data.length; i++) data[i] = b.get(i) & 0xff;
        return 'B:' + head + ':' + b.order().toString() + ':' + sha(data);
    }
    const data = new Uint8Array(b.capacity() * 4);
    const view = new DataView(data.buffer);
    for (let i = 0; i < b.capacity(); i++) view.setInt32(i * 4, floatBits(b.get(i)));
    return 'F:' + head + ':' + b.order().toString() + ':' + sha(data);
}

// kinds: s String, f float, i int, z boolean, x float[], n int[], b Buffer, c GLContext, r other reference
function value(kind: string, v: unknown): string {
    if (v === null) return 'null';
    switch (kind) {
        case 's':
            return typeof v === 'string' ? '"' + v.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"' : 's?' + String(v);
        case 'f':
            return typeof v === 'number' && (Number.isNaN(v) || Math.fround(v) === v) ? 'f:' + hex8(floatBits(v)) : 'f?' + String(v);
        case 'i':
            return typeof v === 'number' && (v | 0) === v && !Object.is(v, -0) ? String(v) : 'i?' + String(v);
        case 'z':
            return v === true ? 'T' : v === false ? 'F' : 'z?' + String(v);
        case 'x':
            return v instanceof Float32Array ? '[' + Array.from(v, e => hex8(floatBits(e))).join(',') + ']' : 'x?' + String(v);
        case 'n':
            return v instanceof Int32Array ? '[' + Array.from(v).join(',') + ']' : 'n?' + String(v);
        case 'b':
            return v instanceof ByteBuffer || v instanceof FloatBuffer ? buffer(v) : 'b?' + String(v);
        case 'c':
            return v instanceof GLContext ? (v === GLContext.getCurrent() ? 'context:current' : 'context') : 'c?' + String(v);
        default:
            return typeof v === 'object' ? 'set' : 'r?' + String(v);
    }
}

function print(java: string, kind: string, v: unknown): void {
    out('dump ' + java + ' ' + value(kind, v));
}

// tf statics in classfile order: Java name, GlRenderer name, kind.
const TF: readonly (readonly [string, string, string])[] = [
    ['a', 'vendor', 's'],
    ['b', 'renderer', 's'],
    ['c', 'projectionZScale', 'f'],
    ['d', 'textureMatrixDirty', 'z'],
    ['e', 'maxTextureUnits', 'i'],
    ['f', 'bigEndian', 'z'],
    ['g', 'cycle', 'i'],
    ['h', 'combineAlpha', 'i'],
    ['i', 'combineRgb', 'i'],
    ['j', 'depthBias', 'f'],
    ['k', 'projectionZOffset', 'f'],
    ['l', 'lighting', 'z'],
    ['m', 'depthBiasDistance', 'f'],
    ['n', 'normalArray', 'z'],
    ['o', 'ortho2d', 'z'],
    ['p', 'context', 'c'],
    ['q', 'frustumScale', 'f'],
    ['r', 'texture3d', 'z'],
    ['s', 'boundTexture', 'i'],
    ['t', 'gl', 'r'],
    ['u', 'depthTest', 'z'],
    ['v', 'maxTextureImageUnits', 'i'],
    ['w', 'active', 'z'],
    ['x', 'projection', 'x'],
    ['y', 'multisampleSupported', 'z'],
    ['z', 'whiteTexture', 'i'],
    ['A', 'height', 'i'],
    ['B', 'glVersion', 'i'],
    ['C', 'vboSupported', 'z'],
    ['D', 'maxTextureCoords', 'i'],
    ['E', 'drawable', 'r'],
    ['F', 'fog', 'z'],
    ['G', 'streamVbo', 'z'],
    ['H', 'vertexProgramSupported', 'z'],
    ['I', 'radeon', 'r'],
    ['J', 'width', 'i'],
    ['K', 'cubeMapSupported', 'z']
];
const FA: readonly (readonly [string, string, string])[] = [
    ['a', 'textureMemory', 'i'],
    ['c', 'generation', 'i'],
    ['e', 'memory2d', 'i'],
    ['f', 'geometryMemory', 'i']
];
const LM: readonly (readonly [string, string, string])[] = [
    ['a', 'fractalSlices', 'n'],
    ['b', 'ridgedSlices', 'n'],
    ['g', 'fractalTexture', 'i'],
    ['f', 'ridgedTexture', 'i'],
    ['c', 'fractalVolume', 'b'],
    ['d', 'ridgedVolume', 'b'],
    ['e', 'texture3d', 'z']
];
// The material renderers: class, Java name, instance fields in classfile order (Java name, TS name, kind).
const MATERIALS: readonly (readonly [object, string, readonly (readonly [string, string, string])[]])[] = [
    [
        SpecularCubeMapMaterial,
        'vm',
        [
            ['a', 'listBase', 'i'],
            ['b', 'twoUnits', 'z'],
            ['c', 'cubeMaps', 'n']
        ]
    ],
    [
        WaterProgramMaterial,
        'rd',
        [
            ['a', 'uploadedCycle', 'i'],
            ['b', 'noise', 'b'],
            ['c', 'program', 'i'],
            ['e', 'listBase', 'i']
        ]
    ],
    [
        UnderwaterMaterial,
        'wg',
        [
            ['a', 'plane', 'x'],
            ['c', 'rampTexture', 'i'],
            ['d', 'listBase', 'i']
        ]
    ],
    [
        HighDetailWaterMaterial,
        'pd',
        [
            ['a', 'listBase', 'i'],
            ['c', 'plane', 'x'],
            ['d', 'rampTexture', 'i'],
            ['e', 'planeCycle', 'i']
        ]
    ],
    [
        ScrollingDetailMaterial,
        'ob',
        [
            ['g', 'listBase', 'i'],
            ['n', 'plane', 'x']
        ]
    ],
    [UnlitMaterial, 'ue', []]
];

function javaName(material: object | null): string {
    if (material === null) return 'null';
    for (const [type, name] of MATERIALS) if (material instanceof (type as new () => object)) return name;
    return '?' + material.constructor.name;
}

function own(target: object, name: string): unknown {
    if (!Reflect.has(target, name)) return 'missing:' + name;
    return Reflect.get(target, name);
}

function volume(b: unknown): string {
    if (!(b instanceof ByteBuffer)) return 'none';
    const data = new Uint8Array(b.limit());
    for (let i = 0; i < data.length; i++) data[i] = b.get(i) & 0xff;
    return sha(data);
}

// ---- HdInitOracle.main, then HdH1InitOracle's dump ---------------------------------------------------------------
// HdInitOracle throws (AssertionError) where this prints a line: a failing TS start still writes its trace and dump,
// so the test can show the first divergence.
async function start(): Promise<void> {
    if ((await GlRenderer.init(new Display(false), samples)) !== -1 || GlRenderer.active || GLContext.getCurrent() !== null) {
        out('undisplayable canvas initialized a context');
    }
    const status = await GlRenderer.init(new Display(true), samples);
    out('status ' + status);
    const current = GLContext.getCurrent();
    out('context ' + GlRenderer.active + ' ' + (GlRenderer.gl !== null) + ' ' + (current !== null && own(GlRenderer, 'context') === current) + ' ' + (own(GlRenderer, 'drawable') !== null) + ' ' + GlRenderer.width + ' ' + GlRenderer.height);
    out(
        'caps ' +
            GlRenderer.vboSupported +
            ' ' +
            GlRenderer.texture3d +
            ' ' +
            GlRenderer.cubeMapSupported +
            ' ' +
            GlRenderer.vertexProgramSupported +
            ' ' +
            GlRenderer.multisampleSupported +
            ' ' +
            GlRenderer.maxTextureUnits +
            ' ' +
            GlRenderer.streamVbo
    );
    const table = MaterialManager.materials;
    out('materials ' + (table === null ? '' : table.map(m => (m === null ? '-' : javaName(m))).join(' ')));
    out('noise ' + volume(own(NoiseTextures, 'ridgedVolume')) + ' ' + volume(own(NoiseTextures, 'fractalVolume')));

    for (const [java, ts, kind] of TF) print('tf.' + java, kind, own(GlRenderer, ts));
    for (const [java, ts, kind] of FA) print('fa.' + java, kind, own(GlCleaner, ts));
    for (const [java, ts, kind] of LM) print('lm.' + java, kind, own(NoiseTextures, ts));
    out('dump aa.t ' + (table === null ? 'null' : 'length ' + table.length));
    for (let slot = 0; table !== null && slot < table.length; slot++) {
        const material = table[slot];
        const type = javaName(material);
        out('dump aa.t[' + slot + '] ' + type);
        for (const [, name, fields] of MATERIALS) {
            if (name !== type || material === null) continue;
            for (const [java, ts, kind] of fields) print(type + '.' + java, kind, own(material, ts));
        }
    }
    print('rd.d', 'x', WaterProgramMaterial.ambient);
    print('wg.b', 'z', own(UnderwaterMaterial, 'threeUnits'));
    print('pd.b', 'x', HighDetailWaterMaterial.environmentColour);
    print('dl.c', 'i', MaterialManager.current);
    print('mh.eb', 'i', MaterialManager.currentArgument);
    print('je.R', 'z', MaterialManager.locked);
}

// The GL behind the recorder, and the swaps the platform drawable saw (one: tf.a presents its cleared frame).
function platform(): string {
    const recorded = own(GlRenderer, 'drawable');
    const drawable = typeof recorded === 'object' && recorded !== null ? Reflect.get(recorded, 'inner') : null;
    const gl = GlRenderer.gl === null ? null : Reflect.get(GlRenderer.gl, 'inner');
    const swaps = typeof drawable === 'object' && drawable !== null && typeof Reflect.get(drawable, 'swaps') === 'number' ? Reflect.get(drawable, 'swaps') : '-';
    return (gl instanceof NullGL ? 'NullGL' : glClass !== null && gl instanceof glClass ? 'WebGpuGL' : 'unknown') + ' swaps ' + swaps;
}

try {
    await start();
} catch (error) {
    out('threw ' + (error instanceof Error ? error.message : String(error)));
}
const driverLine = platform();
try {
    await finish();
} catch (error) {
    errors.push('finish threw ' + (error instanceof Error ? error.message : String(error)));
}
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'trace.tsv'), writer.text());
writeFileSync(join(outDir, 'stdout.txt'), lines.join('\n') + '\n');
writeFileSync(join(outDir, 'stubs.txt'), stubs.join('\n') + (stubs.length > 0 ? '\n' : ''));
writeFileSync(join(outDir, 'errors.txt'), errors.join('\n') + (errors.length > 0 ? '\n' : ''));
writeFileSync(join(outDir, 'driver.txt'), driverLine + '\n');
process.exit(0);
