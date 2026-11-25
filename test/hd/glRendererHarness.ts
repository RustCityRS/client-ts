// The TS side of HdRendererOracle.java (gl-renderer.test.ts runs it as a child process, so its module mocks stay out of
// the test runner): drives src/gl/GlRenderer.ts through RecordingGL over NullGL and prints the same lines as the
// oracle. GlRenderer's callees outside this unit (MaterialManager cb.b/te.e/gj.b/nj.a/ef.a, GlLighting mk.e,
// PointLightManager jf.c/e/f) are replaced by stubs that print a "C" line; the stubs for te.e, mk.e and jf.e, the
// callees whose Java counterparts always issue GL calls, also put a `call.<java method>` mark into the trace, where
// the test expects the Java trace's run of calls from that method.
//
// The "integrated" scenario is "init" with the real MaterialManager (and so the real NoiseTextures and the six
// material renderers): only GlLighting and PointLightManager stay stubbed, so te.e(6)'s calls are compared in full.
// The "points" scenario is "init" followed by ga.a()V (GlRenderer.initPointParameters) twice.
//
// usage: bun run glRendererHarness.ts <outDir> <profile.json> <samples> <scenario>
import { mock } from 'bun:test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [outDir, profilePath, samplesText, scenario] = process.argv.slice(2);
const samples = Number(samplesText);
const lines: string[] = [];
const out = (line: string): void => {
    lines.push(line);
};
let calleeMark: (label: string) => void = () => {};
let materialFlags = 0;

if (scenario !== 'integrated')
    mock.module('../../src/gl/material/MaterialManager.js', () => ({
        default: class MaterialManager {
            static setMaterial(argument: number, material: number): void {
                out('C MaterialManager.setMaterial ' + argument + ' ' + material);
            }
            static resetMaterial(): void {
                out('C MaterialManager.resetMaterial');
            }
            static createMaterials(slot: number): void {
                calleeMark('call.te.e');
                out('C MaterialManager.createMaterials ' + slot);
            }
            static releaseMaterials(): void {
                out('C MaterialManager.releaseMaterials');
            }
            static getMaterialFlags(): number {
                out('C MaterialManager.getMaterialFlags ' + materialFlags);
                return materialFlags;
            }
        }
    }));
mock.module('../../src/gl/PointLightManager.js', () => ({
    default: class PointLightManager {
        static allocate(): void {
            out('C PointLightManager.allocate');
        }
        static init(): void {
            calleeMark('call.jf.e');
            out('C PointLightManager.init');
        }
        static release(): void {
            out('C PointLightManager.release');
        }
    }
}));
mock.module('../../src/gl/GlLighting.js', () => ({
    default: class GlLighting {
        static defaultFogColour = 13156520;
        static defaultSunColour = 16777215;
        static init(): void {
            calleeMark('call.mk.e');
            out('C GlLighting.init');
        }
    }
}));

const { default: GlRenderer } = await import('../../src/gl/GlRenderer.js');
const { default: GlCleaner } = await import('../../src/gl/GlCleaner.js');
const { default: GlBuffer } = await import('../../src/gl/GlBuffer.js');
const { default: GlSolidTexture } = await import('../../src/gl/GlSolidTexture.js');
const { default: ByteBuffer } = await import('../../src/util/nio/ByteBuffer.js');
const { arrayPutI32 } = await import('../../src/util/JavaArray.js');
const { default: Pix3D } = await import('../../src/dash3d/Pix3D.js');
const { default: Preferences } = await import('../../src/ui/Preferences.js');
const { default: GLContext } = await import('../../src/jogl/GLContext.js');
const { default: GLDrawableFactory, registerGLDrawableFactory } = await import('../../src/jogl/GLDrawableFactory.js');
const { default: GLException } = await import('../../src/jogl/GLException.js');
const { default: NullGL, NullGLDrawableFactory } = await import('../../src/gl/NullGL.js');
const { default: RecordingGL, RecordingGLDrawableFactory } = await import('../../src/gl/RecordingGL.js');
const { GlTraceWriter, floatBits, hex8 } = await import('../../src/gl/GlTrace.js');
const { capsProfileFromJson } = await import('../../src/gl/CapsProfile.js');
const { JavaError } = await import('../../src/util/JavaException.js');
type GL = import('../../src/jogl/GL.js').GL;
type GLCapabilities = import('../../src/jogl/GLCapabilities.js').default;
type GLCapabilitiesChooser = import('../../src/jogl/GLCapabilitiesChooser.js').default;
type GLDrawable = import('../../src/jogl/GLDrawable.js').default;
type GlContextType = import('../../src/jogl/GLContext.js').default;
type ByteBufferType = import('../../src/util/nio/ByteBuffer.js').default;

const profile = capsProfileFromJson(readFileSync(profilePath, 'utf8'));
const writer = new GlTraceWriter();
calleeMark = label => writer.mark(label);

class Display {
    constructor(private readonly displayable: boolean) {}
    isDisplayable(): boolean {
        return this.displayable;
    }
    getSize(): { width: number; height: number } {
        return { width: 871, height: 613 };
    }
}

// tf statics in HdRendererOracle.FIELDS order: Java name, TS name, kind (s string, f float, i int, z boolean,
// r reference, x float[]).
const FIELDS: readonly (readonly [string, string, string])[] = [
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
    ['p', 'context', 'r'],
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

function floatValue(v: unknown): string {
    if (typeof v !== 'number' || (!Number.isNaN(v) && Math.fround(v) !== v)) return 'f?' + String(v);
    return 'f:' + hex8(floatBits(v));
}

function value(kind: string, v: unknown): string {
    if (v === null) return 'null';
    switch (kind) {
        case 's':
            return typeof v === 'string' ? '"' + v.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"' : 's?' + String(v);
        case 'f':
            return floatValue(v);
        case 'i':
            return typeof v === 'number' && (v | 0) === v ? String(v) : 'i?' + String(v);
        case 'z':
            return v === true ? 'T' : v === false ? 'F' : 'z?' + String(v);
        case 'x':
            return v instanceof Float32Array ? '[' + Array.from(v, e => hex8(floatBits(e))).join(',') + ']' : 'x?' + String(v);
        default:
            return typeof v === 'object' ? 'set' : 'r?' + String(v);
    }
}

function dump(): void {
    let s = 'dump';
    for (const [java, ts, kind] of FIELDS) s += ' ' + java + '=' + value(kind, Reflect.get(GlRenderer, ts));
    s += ' fa.c=' + GlCleaner.generation + ' clip=' + Pix3D.clipMinX + ',' + Pix3D.clipMaxX + ',' + Pix3D.clipMinY + ',' + Pix3D.clipMaxY;
    out(s);
}

async function attempt(label: string, step: () => void | Promise<void>): Promise<void> {
    writer.mark(label);
    try {
        await step();
        out('ok ' + label);
    } catch {
        out('threw ' + label);
    }
    dump();
}

// ---- the scripted platform of HdRendererOracle --------------------------------------------------------------------
class Platform extends GLDrawableFactory {
    contexts = 0;
    makeCurrentCalls = 0;
    swaps = 0;
    constructor(
        readonly mode: string,
        readonly gl: GL
    ) {
        super();
    }
    getGLDrawable(target: object | null, caps: GLCapabilities | null, chooser: GLCapabilitiesChooser | null): GLDrawable {
        out('L getGLDrawable ' + (target === null ? 'null' : 'canvas') + ' ' + (caps === null ? 'null' : (caps.getSampleBuffers() ? 'T' : 'F') + ':' + caps.getNumSamples()) + ' ' + (chooser === null ? 'null' : 'chooser'));
        if (target === null) throw new Error('IllegalArgumentException: Null target');
        return new Surface(this);
    }
}

class Surface implements GLDrawable {
    constructor(readonly platform: Platform) {}
    createContext(_share: GlContextType | null): GlContextType {
        const id = ++this.platform.contexts;
        out('L createContext ' + id);
        if (this.platform.mode === 'createThrows') throw new GLException('no pixel format');
        return new Context(this.platform, id);
    }
    setRealized(realized: boolean): void {
        out('L setRealized ' + (realized ? 'T' : 'F'));
    }
    swapBuffers(): void {
        const call = ++this.platform.swaps;
        if (this.platform.mode === 'swapFail' || (this.platform.mode === 'swap2' && call <= 2)) {
            out('L swapBuffers !> GLException');
            throw new GLException('swap');
        }
        out('L swapBuffers');
    }
}

class Context extends GLContext {
    created = false;
    constructor(
        readonly platform: Platform,
        readonly id: number
    ) {
        super();
    }
    makeCurrent(): number {
        const call = ++this.platform.makeCurrentCalls;
        if (GLContext.getCurrent() === this) {
            out('L makeCurrent ' + this.id + ' => 1');
            return 1;
        }
        Context.setCurrent(null);
        if (this.platform.mode === 'mc0') {
            out('L makeCurrent ' + this.id + ' => 0');
            return 0;
        }
        if (this.platform.mode === 'mcThrow2' && call <= 2) {
            out('L makeCurrent ' + this.id + ' !> GLException');
            throw new GLException('busy');
        }
        if (this.platform.mode === 'mcError') {
            out('L makeCurrent ' + this.id + ' !> Error');
            throw new JavaError('UnsatisfiedLinkError: no natives');
        }
        const result = this.created ? 1 : 2;
        this.created = true;
        Context.setCurrent(this);
        out('L makeCurrent ' + this.id + ' => ' + result);
        return result;
    }
    release(): void {
        out('L release ' + this.id);
        Context.setCurrent(null);
    }
    destroy(): void {
        out('L destroy ' + this.id);
    }
    getGL(): GL {
        out('L getGL ' + this.id);
        return this.platform.gl;
    }
}

function minimumSleep(mode: string): number {
    return mode === 'mc0' ? 6000 : mode === 'mcThrow2' ? 2000 : mode === 'swapFail' ? 600 : mode === 'swap2' ? 200 : 0;
}

function current(): string {
    const context = GLContext.getCurrent();
    return context === null ? 'null' : context === Reflect.get(GlRenderer, 'context') ? 'p' : 'other';
}

const fround = Math.fround;

async function ops(screen: Display): Promise<void> {
    await attempt('begin2dReplace', () => GlRenderer.begin2dReplace());
    await attempt('begin2dFont', () => GlRenderer.begin2dFont());
    await attempt('begin2dModulate', () => GlRenderer.begin2dModulate());
    await attempt('begin2dUntextured', () => GlRenderer.begin2dUntextured());
    await attempt('bindTexture2D', () => {
        GlRenderer.bindTexture2D(GlRenderer.whiteTexture);
        GlRenderer.bindTexture2D(GlRenderer.whiteTexture);
        GlRenderer.bindTexture2D(100000);
        GlRenderer.bindTexture2D(-1);
        GlRenderer.bindTexture2D(-1);
        GlRenderer.bindTexture2D(100001);
    });
    await attempt('combineRgb', () => {
        for (const m of [1, 1, 2, 3, 4, 5, 6, 0, 0, -1, 0]) GlRenderer.setTextureCombineRgb(m);
    });
    await attempt('combineAlpha', () => {
        for (const m of [2, 2, 1, 3, 0, 0, 1]) GlRenderer.setTextureCombineAlpha(m);
    });
    await attempt('toggles', () => {
        GlRenderer.setFog(true);
        GlRenderer.setFog(false);
        GlRenderer.setFog(false);
        GlRenderer.setFog(true);
        GlRenderer.setDepthTest(false);
        GlRenderer.setDepthTest(false);
        GlRenderer.setDepthTest(true);
        GlRenderer.setLighting(true);
        GlRenderer.setLighting(false);
        GlRenderer.setLighting(true);
    });
    await attempt('lightingPreference', () => {
        Preferences.highDetailLighting = false;
        GlRenderer.applyLightingPreference();
        GlRenderer.applyLightingPreference();
        Preferences.highDetailLighting = true;
        GlRenderer.applyLightingPreference();
        Preferences.highDetailLighting = false;
        GlRenderer.applyLightingPreference();
        Preferences.highDetailLighting = true;
    });
    await attempt('textureMatrix', () => {
        GlRenderer.resetTextureMatrix();
        GlRenderer.translateTexture(0.25, -1.5, 0.0);
        GlRenderer.translateTexture(fround(1e-3), 7.0, -0.0);
        GlRenderer.resetTextureMatrix();
        GlRenderer.resetTextureMatrix();
        GlRenderer.translateTexture(3.0, 0.0, 0.0);
    });
    await attempt('camera', () => GlRenderer.setCamera(0, 0, 512, 334, 256, 167, 0.0, 0.0, 512, 512));
    await attempt('cameraRotated', () => GlRenderer.setCamera(4, 7, 509, 331, 260, 170, 25.5, -100.25, 611, 389));
    await attempt('cameraNegative', () => GlRenderer.setCamera(-30, 900, 17, 3, 5000, -77, -0.0, fround(1e-7), 3, 1000));
    await attempt('depthBias', () => {
        GlRenderer.setDepthBias(3000.0, 12.0);
        GlRenderer.setDepthBias(3000.0, 12.0);
        GlRenderer.setDepthBias(3000.0, 0.0);
        GlRenderer.setDepthBias(100.0, fround(1e-3));
        GlRenderer.setDepthBias(-0.0, -0.0);
        GlRenderer.setDepthBias(0.0, 0.0);
        GlRenderer.setDepthBias(NaN, 5.0);
        GlRenderer.setDepthBias(NaN, 5.0);
        GlRenderer.setLevelDepthBias(2.5);
        GlRenderer.setLevelDepthBias(-301.75);
        out('get ' + floatValue(GlRenderer.getDepthBias()) + ' ' + floatValue(GlRenderer.getDepthBiasDistance()));
    });
    await attempt('perspective', () => GlRenderer.setPerspective(256, 167, 512, 512));
    await attempt('depthBiasPerspective', () => {
        GlRenderer.setDepthBias(3000.0, 48.0);
        GlRenderer.setDepthBias(17.5, 0.375);
    });
    await attempt('orthographic', () => GlRenderer.setOrthographic(100, 50, 700, 12, 256, 300));
    await attempt('orthographicOdd', () => GlRenderer.setOrthographic(-5, 9999, 1, -4000, 7, 3));
    await attempt('depthBias2d', () => {
        GlRenderer.begin2dReplace();
        GlRenderer.setDepthBias(3000.0, 5.0);
        out('get ' + floatValue(GlRenderer.getDepthBias()) + ' ' + floatValue(GlRenderer.getDepthBiasDistance()));
    });
    await attempt('clear', () => {
        GlRenderer.clear(0xc8c0a8);
        GlRenderer.clear(-1);
        GlRenderer.clear(0x123456);
        GlRenderer.clear(0);
        GlRenderer.clearDepth();
        GlRenderer.enableDepthWrite();
        GlRenderer.disableDepthWrite();
    });
    await attempt('copyFrontToBack', () => {
        GlRenderer.bindTexture2D(GlRenderer.whiteTexture);
        GlRenderer.copyFrontToBack();
        GlRenderer.copyFrontToBack();
    });
    await attempt('resize', () => {
        GlRenderer.resize(1024, 768);
        GlRenderer.begin2dUntextured();
        GlRenderer.resize(1024, 768);
        GlRenderer.setPerspective(300, 200, 400, 400);
        GlRenderer.resize(640, 480);
        GlRenderer.begin2dReplace();
    });
    await attempt('swap', () => GlRenderer.swapBuffers());
    await attempt('divideByZeroX', () => GlRenderer.setCamera(0, 0, 10, 10, 0, 0, 0.0, 0.0, 0, 5));
    await attempt('divideByZeroY', () => GlRenderer.setCamera(0, 0, 10, 10, 0, 0, 0.0, 0.0, 5, 0));
    await attempt('shutdown', () => GlRenderer.shutdown());
    out('counters ' + GlCleaner.textureMemory + ' ' + GlCleaner.memory2d + ' ' + GlCleaner.geometryMemory);
    await attempt('shutdownAgain', () => GlRenderer.shutdown());
    await attempt('swapWithoutDrawable', () => GlRenderer.swapBuffers());
    await attempt('resetCanvas', () => GlRenderer.resetCanvas(screen));
    await attempt('resetCanvasUndisplayable', () => GlRenderer.resetCanvas(new Display(false)));
    await attempt('resetCanvasNull', () => GlRenderer.resetCanvas(null));
    writer.mark('reinit');
    out('status ' + (await GlRenderer.init(screen, samples)));
    dump();
    await attempt('cameraAfterReinit', () => GlRenderer.setCamera(0, 0, 512, 334, 256, 167, 0.0, 0.0, 512, 512));
    await attempt('unload', () => GlRenderer.unload());
    await attempt('depthBiasAfterUnload', () => GlRenderer.setDepthBias(3000.0, 7.0));
    await attempt('begin2dAfterUnload', () => GlRenderer.begin2dReplace());
    writer.mark('initAfterUnload');
    out('status ' + (await GlRenderer.init(screen, samples)));
    dump();
}

// ---- GlCleaner (fa), GlBuffer (vi) and GlSolidTexture (sd) on a recording GL installed as GlRenderer.gl --------------
type GlBufferType = InstanceType<typeof GlBuffer>;
type GlSolidTextureType = InstanceType<typeof GlSolidTexture>;

function counters(): void {
    out('counters ' + GlCleaner.textureMemory + ' ' + GlCleaner.memory2d + ' ' + GlCleaner.geometryMemory);
}

// The Java oracle invokes finalize() reflectively; here the protected method is called directly.
function finalize(target: object): void {
    (target as unknown as { finalize(): void }).finalize();
}

function bytes(length: number, step: number): ByteBufferType {
    return ByteBuffer.wrap(Int8Array.from({ length }, (_, i) => Math.imul(i, step)));
}

function nonNull<T>(value: T | null): T {
    if (value === null) throw new TypeError('Null reference');
    return value;
}

async function objects(): Promise<void> {
    GlRenderer.gl = new RecordingGL(new NullGL(profile), writer);
    await attempt('faQueue', () => {
        GlCleaner.textureMemory = 5000;
        GlCleaner.memory2d = 7000;
        GlCleaner.geometryMemory = 9000;
        for (let i = 0; i < 1003; i++) GlCleaner.deleteBuffer(200000 + i, 3, 0);
        GlCleaner.deleteBuffer(1, 100, 1);
        for (let i = 0; i < 999; i++) GlCleaner.deleteTexture2d(300000 + i, 1, 0);
        GlCleaner.deleteTexture(400000, 50, 0);
        GlCleaner.deleteTexture(400001, 60, 0);
        GlCleaner.deleteTexture(400002, 70, 7);
        GlCleaner.deleteList(500000, 0);
        GlCleaner.deleteList(500001, 0);
        GlCleaner.deleteList(500002, -1);
        GlCleaner.flush();
    });
    counters();
    await attempt('faFlushEmpty', () => GlCleaner.flush());
    await attempt('faThreshold', () => {
        GlCleaner.geometryMemory = 0x6000000;
        GlCleaner.flush();
        GlCleaner.geometryMemory = 0x6000001;
        GlCleaner.flush();
        GlCleaner.flush();
        GlCleaner.geometryMemory = 0;
    });
    await attempt('faReset', () => {
        GlCleaner.deleteBuffer(600000, 8, 0);
        GlCleaner.deleteTexture2d(600001, 8, 0);
        GlCleaner.deleteTexture(600002, 8, 0);
        GlCleaner.deleteList(600003, 0);
        GlCleaner.reset();
        GlCleaner.flush();
        GlCleaner.deleteBuffer(600004, 8, 0);
        GlCleaner.deleteBuffer(600005, 8, 1);
        GlCleaner.deleteTexture2d(600006, 4, 1);
        GlCleaner.deleteTexture(600007, 2, 1);
        GlCleaner.deleteList(600008, 1);
        GlCleaner.flush();
    });
    counters();
    let buffer: GlBufferType | null = null;
    let streamBuffer: GlBufferType | null = null;
    await attempt('viCreate', () => {
        buffer = new GlBuffer();
        streamBuffer = new GlBuffer(true);
    });
    counters();
    await attempt('viUpload', () => {
        const small = bytes(16, 1),
            large = bytes(40, 3);
        nonNull(buffer).uploadArray(small);
        nonNull(buffer).update(small);
        nonNull(buffer).update(large);
        nonNull(buffer).update(small);
        nonNull(buffer).uploadElements(small);
        nonNull(buffer).bindArray();
        nonNull(buffer).bindElements();
        nonNull(streamBuffer).uploadArray(small);
        nonNull(streamBuffer).uploadElements(large);
        nonNull(streamBuffer).update(large);
    });
    counters();
    await attempt('viNull', () => nonNull(buffer).update(null));
    await attempt('viFinalize', () => {
        finalize(nonNull(buffer));
        finalize(nonNull(buffer));
        GlCleaner.flush();
    });
    counters();
    await attempt('viFinalizeOldGeneration', () => {
        GlCleaner.reset();
        finalize(nonNull(streamBuffer));
        GlCleaner.flush();
    });
    counters();
    arrayPutI32(Pix3D.colourTable, 1234, 0x123456);
    arrayPutI32(Pix3D.colourTable, 65535, 0xfedcba);
    arrayPutI32(Pix3D.colourTable, 0, -1);
    let texture: GlSolidTextureType | null = null;
    let texture2: GlSolidTextureType | null = null;
    await attempt('sdCreate', () => {
        texture = new GlSolidTexture(1234);
        texture2 = new GlSolidTexture(65535);
        new GlSolidTexture(0);
    });
    counters();
    await attempt('sdBind', () => {
        materialFlags = 0;
        nonNull(texture).bind();
        nonNull(texture2).bind();
        nonNull(texture).bind();
    });
    await attempt('sdBindFlags', () => {
        GlRenderer.setTextureCombineRgb(3);
        GlRenderer.setTextureCombineAlpha(2);
        materialFlags = 4;
        nonNull(texture2).bind();
        materialFlags = 15;
        nonNull(texture).bind();
        materialFlags = 2;
        nonNull(texture).bind();
        GlRenderer.setTextureCombineRgb(3);
        GlRenderer.setTextureCombineAlpha(2);
        materialFlags = 1;
        nonNull(texture2).bind();
        materialFlags = 0;
    });
    await attempt('sdFinalize', () => {
        finalize(nonNull(texture));
        finalize(nonNull(texture));
        GlCleaner.flush();
    });
    counters();
    await attempt('sdBadColour', () => {
        new GlSolidTexture(65536);
    });
    await attempt('sdNoGl', () => {
        GlRenderer.gl = null;
        new GlSolidTexture(1234);
    });
}

const screen = new Display(true);
dump();
if (scenario === 'init' || scenario === 'ops' || scenario === 'points' || scenario === 'integrated') {
    registerGLDrawableFactory(() => new RecordingGLDrawableFactory(new NullGLDrawableFactory(profile), writer));
    out('status ' + (await GlRenderer.init(new Display(false), samples)));
    dump();
    writer.mark('init');
    out('status ' + (await GlRenderer.init(screen, samples)));
    dump();
    if (scenario === 'ops') await ops(screen);
    if (scenario === 'points') {
        await attempt('pointParameters', () => GlRenderer.initPointParameters());
        await attempt('pointParametersAgain', () => GlRenderer.initPointParameters());
    }
} else if (scenario === 'objects') {
    await objects();
} else if (scenario === 'registry') {
    // TS only: collected GlBuffer and GlSolidTexture objects reach GlCleaner through their FinalizationRegistry, as
    // Java's finalizer thread runs vi.finalize()V and sd.finalize()V; flush then takes their bytes off the counters.
    GlRenderer.gl = new RecordingGL(new NullGL(profile), writer);
    const unreferenced = (): void => {
        for (let i = 0; i < 20; i++) new GlBuffer().uploadArray(bytes(16, 1));
        for (let i = 0; i < 20; i++) new GlSolidTexture(0);
    };
    unreferenced();
    out('registry before ' + GlCleaner.geometryMemory + ' ' + GlCleaner.textureMemory);
    for (let i = 0; i < 100 && (GlCleaner.geometryMemory !== 0 || GlCleaner.textureMemory !== 0); i++) {
        Bun.gc(true);
        await new Promise(resolve => setTimeout(resolve, 10));
        GlCleaner.flush();
    }
    out('registry after ' + GlCleaner.geometryMemory + ' ' + GlCleaner.textureMemory);
} else {
    const platform = new Platform(scenario, new RecordingGL(new NullGL(profile), writer));
    registerGLDrawableFactory(scenario === 'nullFactory' ? null : () => platform);
    writer.mark('init');
    const start = performance.now();
    const status = await GlRenderer.init(scenario === 'nullCanvas' ? null : screen, samples);
    const elapsed = performance.now() - start;
    out('status ' + status);
    out('slept ' + (elapsed >= minimumSleep(scenario) ? 'T' : 'F'));
    out('current ' + current());
    dump();
    if (status === 0) {
        await attempt('shutdown', () => GlRenderer.shutdown());
        out('current ' + (GLContext.getCurrent() === null ? 'null' : 'other'));
    }
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'trace.tsv'), writer.text());
writeFileSync(join(outDir, 'stdout.txt'), lines.join('\n') + '\n');
