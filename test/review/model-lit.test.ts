import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type Js5 from '../../src/cache/Js5.js';
import AnimFrame from '../../src/dash3d/AnimFrame.js';
import AnimFrameSet from '../../src/dash3d/AnimFrameSet.js';
import ModelLit from '../../src/dash3d/ModelLit.js';
import ModelLitImpl from '../../src/dash3d/ModelLitImpl.js';
import type ModelSource from '../../src/dash3d/ModelSource.js';
import ModelUnlit from '../../src/dash3d/ModelUnlit.js';
import ParticleSystem from '../../src/dash3d/ParticleSystem.js';
import Pix3D from '../../src/dash3d/Pix3D.js';
import type TextureProvider from '../../src/dash3d/TextureProvider.js';
import Pix2D from '../../src/graphics/Pix2D.js';
import { requireNonNull } from '../../src/util/JavaArray.js';
import { localAssets, readGroup } from '../cachefile.js';
import { cachePath, gamepackPath } from '../reference.js';
import { PIX2D, type StaticReset, withClinitStatics } from './staticState.js';

// nd (ModelLit) and fc (ModelLitImpl) against client.jar, with the statics the member map places on them (dd.r, oc.m,
// pf.W, ud.d, rg.g and a.a). A seeded script runs through test/review/model-lit/ModelLitOracle.java (javac'd next
// to client.jar, driving the real gamepack classes) and through the TS port; every result line must match: the result
// (ok or the Java exception), any return value, a dump of every fc instance field (arrays as length:hash over the
// signed elements, so every vertex, face colour and alpha is compared) and, after every draw, the hash of the 320x240
// framebuffer, every fc scratch static (projection, near-clip flags, depth buckets and their overflow, priority lists,
// clip buffers, the quicksort buffers and switch, the particle list), Pix3D hclip/trans, the pick count and typecodes
// and the animation origin. The first line prints the statics both sides start from (fc/pf/dd/oc/ud/rg <clinit>).
//
// Models come from the cache through cb.a(Lal;II) (ModelUnlit.Load, archive 7) and are lit through all four entry
// points (the fc constructor, cb.b, cb.c and cb.a(III) with the stored zero contrast) with several ambient/contrast/
// light vectors each, including zero vectors (division by zero), a missing source, combined models (cb([Lcb;I), which
// carry the part masks the masked animation tests) and models whose normals were shared with a neighbour first
// (cb.a(Lug;IIIZ)V, the sharedPointNormal lighting path). Fake textures: some unavailable, some without texels, 64 and
// 128 texel sizes, solid flags; and no texture provider at all.
//
// Draws: the world draw (frustum culls on all four sides, near-plane clipping into triangles and quads, AABB and
// per-triangle picking, pick-list overflow and a null pick list, raw non-unit sin/cos, int-overflowing positions, model
// yaw outside the tables, a level and a particle system that SD ignores), ObjRender (a vertex at z 0 caught by its
// RuntimeException handler, angles outside the tables) and ObjRenderOrthog (zoom 0); in the full viewport, in clipped
// windows with moved origins (td.b + dc.d + dc.c), with Pix3D lowDetail on and off, through the depth-bucket sort and
// through the quicksort path (fc.Gb set by reflection with fc.gb/fc.sb allocated as its <clinit> arm does), and for a
// model of more than 4096 vertices (AppendModel of AppendModel).
//
// Exact edges, computed from each model's own bounds (the generator replays fc.n()V): every world-draw cull plane
// (near 50, far 3500, the four clip edges) and the near-clip flag on and one unit inside their boundary, the pick guard
// var14 = -1/0/1, Render2's 1600 depth range (a model collapsed to one point at distance 798..801), small models
// straddling the near plane (clipped quads with each point on or off screen), the mouse swept pixel by pixel across a
// model's projected box and triangle boxes, and two-triangle quads rolled 16 times with the mouse on and next to each
// extreme vertex (FastInsideTriangle's four edges); full depth buckets (four stacked copies, flattened in depth) and
// models of more than 4096 faces and vertices; uniform priority 2/10/11 models merged with each other (Render2's
// var36/var40/var44 averages).
//
// Animation: Animate, SplitAnimate (walk-merge masks of every length, both halves tweened), animateMasked (combined
// models' part masks, AnimBase part masks, transform matrices), animateShadow, Animate2 and animate2Masked with random
// labels and matrices, animateAll for types 0..9, begin/end; mostly tweened between two frames of one set (the tween
// arithmetic, the type 2/7 wraps), with zero and out-of-range tween ratios; consecutive frames of the only four sets
// whose frames carry tween flags (256, 2370, 2690, 2691) and of sets with half-turn rotation tweens; a rotation stress
// for the +32767 roundings. The three CopyForAnim scratch copies and their buffer growth (including a buffer of
// exactly the new size); every rigid transform and getter (bounds read between transforms); HillSkewCopy types 0..6 on
// and off the map, in place and copied, over flat ground with bumps and at height 0; tiltToGround across the map
// edges; AppendModel of different models (mixed priorities, alpha, textures); update (nd.a(IIIII)V); the quicksort
// (a.a); unload() followed by copies, draws and animation.
//
// Sensitivity: 77 of 81 single-statement mutations of ModelLit.ts/ModelLitImpl.ts (a cull or clip bound off by one, a
// pick edge, a rounding constant, a dropped flag or invalidation, a swapped colour or texture vertex, a buffer growth
// boundary...) make this test fail. The survivors are equivalent or unreachable: the hue wrap & 63 -> & 127 in
// animateAll and in MaskAnimate (faceColour is a short[], the extra bit is dropped on store), relight's & -131072 ->
// & -65536 (bit 16 of a lit colour is always 0), and MaskAnimate preferring the second frame's origin transform (no
// two frames of one set in the cache differ in the origin transform of a shared part).
//
// MODEL_LIT_STATS=1 prints per-operation result counts and the TS paths reached; MODEL_LIT_DUMP=<prefix> writes the
// script and both outputs; MODEL_LIT_TRACE=<line> prints the stack of the TS exception on that script line.

const FIELDS: [string, string][] = [
    ['l', 'faceColourA'],
    ['m', 'relightPending'],
    ['n', 'faceTextureM'],
    ['o', 'maxZ'],
    ['p', 'minY'],
    ['q', 'pointY'],
    ['r', 'faceVertexA'],
    ['s', 'radiusSphere'],
    ['t', 'faceColour'],
    ['u', 'facePartMask'],
    ['v', 'pointZ'],
    ['w', 'maxY'],
    ['x', 'faceTextureAxis'],
    ['y', 'numFaces'],
    ['z', 'faceTextureP'],
    ['A', 'priority'],
    ['B', 'maxX'],
    ['C', 'radiusCylinder'],
    ['D', 'numPoints'],
    ['E', 'faceMaterial'],
    ['F', 'numT'],
    ['G', 'pointPartMask'],
    ['H', 'faceTextureN'],
    ['I', 'facePriority'],
    ['J', 'faceVertexC'],
    ['K', 'boundsCalculated'],
    ['L', 'faceColourC'],
    ['M', 'faceColourB'],
    ['N', 'faceVertexB'],
    ['Q', 'minX'],
    ['R', 'faceAlpha'],
    ['S', 'minZ'],
    ['U', 'pointX'],
    ['Y', 'labelVertices'],
    ['Z', 'labelFaces']
];

const STATICS: [string, string][] = [
    ['Jb', 'vertexScreenX'],
    ['Cb', 'vertexScreenY'],
    ['Bb', 'vertexScreenZ'],
    ['Fb', 'vertexViewSpaceX'],
    ['rb', 'vertexViewSpaceY'],
    ['Mb', 'vertexViewSpaceZ'],
    ['pb', 'faceClippedX'],
    ['yb', 'faceNearClipped'],
    ['ib', 'tmpDepthFaceCount'],
    ['lb', 'tmpDepthFaces'],
    ['kb', 'tmpExtendedDepthFaceCount'],
    ['ub', 'tmpExtendedDepthFaces'],
    ['mb', 'extendedDepthBucketCount'],
    ['nb', 'tmpPriorityFaceCount'],
    ['vb', 'tmpPriorityFaces'],
    ['Hb', 'tmpPriorityDepthSum'],
    ['tb', 'tmpPriority10FaceDepth'],
    ['wb', 'tmpPriority11FaceDepth'],
    ['Ab', 'deferredParticleIndices'],
    ['Db', 'clippedX'],
    ['Eb', 'clippedY'],
    ['qb', 'clippedColour'],
    ['gb', 'sortFaceDepths'],
    ['sb', 'sortFaceIndices'],
    ['Gb', 'useQuickSort']
];

const TEMPS: [string, string][] = [
    ['T', 'tempActorFaceAlpha'],
    ['P', 'tempActorFaceColour'],
    ['O', 'tempActorFaceColourA'],
    ['X', 'tempActorFaceColourB'],
    ['W', 'tempActorFaceColourC'],
    ['db', 'tempSpotFaceAlpha'],
    ['eb', 'tempSpotFaceColour'],
    ['bb', 'tempSpotFaceColourA'],
    ['ab', 'tempSpotFaceColourB'],
    ['fb', 'tempSpotFaceColourC'],
    ['hb', 'tempLocFaceAlpha'],
    ['Lb', 'tempLocFaceColour'],
    ['Nb', 'tempLocFaceColourA'],
    ['jb', 'tempLocFaceColourB'],
    ['zb', 'tempLocFaceColourC']
];

type Statics = Record<string, unknown>;
const impl = ModelLitImpl as unknown as Statics;
const pix3d = Pix3D as unknown as Statics;

function hashInts(a: ArrayLike<number>): number {
    let h = 1;
    for (let i = 0; i < a.length; i++) h = (Math.imul(h, 31) + a[i]) | 0;
    return h;
}

function longHash(v: bigint): number {
    const u = BigInt.asUintN(64, v);
    return Number(BigInt.asIntN(32, u ^ (u >> 32n)));
}

function value(v: unknown): string {
    if (v === null || v === undefined) return 'null';
    if (v instanceof Int32Array || v instanceof Int16Array) return `${v.length}:${hashInts(v)}`;
    if (v instanceof Uint8Array) {
        let h = 1;
        for (let i = 0; i < v.length; i++) h = (Math.imul(h, 31) + ((v[i] << 24) >> 24)) | 0;
        return `${v.length}:${h}`;
    }
    if (v instanceof BigInt64Array) {
        let h = 1;
        for (let i = 0; i < v.length; i++) h = (Math.imul(h, 31) + longHash(v[i])) | 0;
        return `${v.length}:${h}`;
    }
    if (Array.isArray(v)) {
        let h = 1;
        if (v.length > 0 && typeof v[0] === 'boolean') {
            for (const e of v) h = (Math.imul(h, 31) + (e ? 1 : 0)) | 0;
        } else {
            for (const row of v as (Int32Array | null)[]) h = (Math.imul(h, 31) + (row === null ? 0 : (Math.imul(31, row.length) + hashInts(row)) | 0)) | 0;
        }
        return `${v.length}:${h}`;
    }
    if (typeof v === 'boolean') return v ? '1' : '0';
    if (v instanceof ModelLitImpl) return 'fc';
    return String(v);
}

function dump(model: ModelLitImpl | null): string {
    if (model === null) return 'nullmodel';
    const f = model as unknown as Statics;
    return FIELDS.map(([obf, name]) => `${obf}=${value(f[name])} `).join('') + `j=${value(model.useAABBMouseCheck)}`;
}

function origin(): string {
    return ` o=${impl['originX']},${impl['originY']},${impl['originZ']},${impl['originTransformPending'] ? 1 : 0}`;
}

function tempLengths(): string {
    return (
        ' temps' +
        TEMPS.map(([obf, name]) => {
            const t = impl[name] as ArrayLike<number> | null;
            return ` ${obf}=${t === null ? 'null' : t.length}`;
        }).join('')
    );
}

function code(e: unknown): string {
    if (e instanceof RangeError) {
        if (e.message.startsWith('array index') || e.message.startsWith('byte array index')) return 'aioobe';
        if (e.message === '/ by zero') return 'arith';
        // JSC words a negative typed-array length differently once the allocation site is optimised.
        if (/^(Invalid typed array length|Invalid array length|length cannot be negative|Requested length is negative)/.test(e.message)) return 'nase';
    }
    if (e instanceof TypeError) {
        if (e.message.startsWith('ClassCastException')) return 'cce';
        if (e.message === 'Null reference' || e.message === 'Null array' || e.message === 'Null byte array') return 'npe';
    }
    return `error:${String(e)}`;
}

// Fake textures, identical to ModelLitOracle.Textures: ids divisible by 3 are 128x128, the rest 64x64.
const texelCache = new Map<number, Int32Array>();
function texels(t: number): Int32Array {
    let p = texelCache.get(t);
    if (p === undefined) {
        p = new Int32Array(t % 3 === 0 ? 16384 : 4096);
        for (let i = 0; i < p.length; i++) {
            let v = Math.imul(i + 1, 0x9e3779b1 | 0) ^ Math.imul(t, 0x85ebca6b | 0);
            v ^= v >>> 13;
            v = Math.imul(v, 0x5bd1e995);
            v ^= v >>> 15;
            p[i] = i % 11 === 0 ? 0 : v & 0xffffff;
        }
        texelCache.set(t, p);
    }
    return p;
}

const textures: TextureProvider = {
    getTextureSmall: id => id % 3 !== 0,
    isAvailable: id => id % 7 !== 3,
    getPixels: id => texels(id),
    isLoaded: () => true,
    getTextureData: id => (id % 5 === 4 ? null : texels(id)),
    getTextureColour: id => (Math.imul(id, 0x1f3d) + 0x123) & 0xffff,
    getTextureSolid: id => (id & 1) === 0
};

function makeMaps(): Int32Array[][] {
    const map0: Int32Array[] = [];
    const map1: Int32Array[] = [];
    for (let x = 0; x < 104; x++) {
        const row0 = new Int32Array(104);
        const row1 = new Int32Array(104);
        for (let z = 0; z < 104; z++) {
            row0[z] = -((x * 37 + z * 91) % 400) - ((x * z) % 97) * 3;
            row1[z] = -((x * 53 + z * 17) % 700) - 200;
        }
        map0.push(row0);
        map1.push(row1);
    }
    const map2: Int32Array[] = [];
    for (let x = 0; x < 3; x++) map2.push(Int32Array.from({ length: 3 }, (_, z) => -x * 40 - z * 7));
    // Flat at -200 with a bump at every even x, odd z: HillSkewCopy's flat-ground test sees every corner pattern.
    const map3: Int32Array[] = [];
    for (let x = 0; x < 104; x++) map3.push(Int32Array.from({ length: 104 }, (_, z) => ((x & 1) === 0 && (z & 1) === 1 ? -230 : -200)));
    return [map0, map1, map2, map3];
}

// mulberry32
function rng(seed: number): () => number {
    let a = seed | 0;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return (t ^ (t >>> 14)) | 0;
    };
}

function rows(count: number, length: number): Int32Array[] {
    return Array.from({ length: count }, () => new Int32Array(length));
}

// ---- static state: the fresh-JVM values of everything the script touches ----

// fc.<clinit> (fc.Gb false, so the depth-bucket arrays and no quicksort buffers) and the JVM defaults of ob/Kb/xb and
// rg.g.
function modelLitImplClinit(): Statics {
    return {
        tempActorModel: new ModelLitImpl(),
        tempActorFaceColour: new Int16Array(1),
        tempActorFaceColourA: new Int32Array(1),
        tempActorFaceColourC: new Int32Array(1),
        tempActorFaceColourB: new Int32Array(1),
        tempActorFaceAlpha: new Uint8Array(1),
        tempSpotModel: new ModelLitImpl(),
        tempSpotFaceColourB: new Int32Array(1),
        tempSpotFaceColourA: new Int32Array(1),
        tempSpotFaceColour: new Int16Array(1),
        tempSpotFaceAlpha: new Uint8Array(1),
        tempSpotFaceColourC: new Int32Array(1),
        tempLocModel: new ModelLitImpl(),
        tempLocFaceAlpha: new Uint8Array(1),
        tempLocFaceColourB: new Int32Array(1),
        faceClippedX: new Array<boolean>(4096).fill(false),
        tmpPriority10FaceDepth: new Int32Array(4096),
        extendedDepthBucketCount: 0,
        faceNearClipped: new Array<boolean>(4096).fill(false),
        vertexViewSpaceY: new Int32Array(4096),
        vertexScreenZ: new Int32Array(4096),
        tmpPriority11FaceDepth: new Int32Array(4096),
        tmpPriorityFaces: rows(12, 4096),
        deferredParticleIndices: new Int32Array(8192),
        vertexViewSpaceX: new Int32Array(4096),
        useQuickSort: false,
        tmpPriorityDepthSum: new Int32Array(12),
        originTransformPending: false,
        tempLocFaceColour: new Int16Array(1),
        tempLocFaceColourC: new Int32Array(1),
        clippedX: new Int32Array(10),
        sortFaceDepths: null,
        sortFaceIndices: null,
        tmpDepthFaceCount: new Int32Array(1600),
        tmpDepthFaces: rows(1600, 64),
        tmpExtendedDepthFaceCount: new Int32Array(32),
        tmpExtendedDepthFaces: rows(32, 512),
        tmpPriorityFaceCount: new Int32Array(12),
        clippedColour: new Int32Array(10),
        clippedY: new Int32Array(10),
        vertexViewSpaceZ: new Int32Array(4096),
        vertexScreenX: new Int32Array(4096),
        vertexScreenY: new Int32Array(4096),
        tempLocFaceColourA: new Int32Array(1),
        originX: 0,
        originY: 0,
        originZ: 0,
        mouseX: 0
    };
}

// dd.r, oc.m and ud.d (JVM defaults) and pf.W (new long[1000] in pf.<clinit>).
function modelLitClinit(): Statics {
    return { pickedCount: 0, checkHover: false, pickedTypecodes: new BigInt64Array(1000), mouseY: 0 };
}

// dc.<clinit>: the tables, the 1024-entry scanline offsets and colour table, brightness 1.0, no provider.
function pix3dClinit(): Statics {
    const sin = new Int32Array(2048);
    const cos = new Int32Array(2048);
    for (let i = 0; i < 2048; i++) {
        sin[i] = (65536.0 * Math.sin(i * 0.0030679615)) | 0;
        cos[i] = (65536.0 * Math.cos(i * 0.0030679615)) | 0;
    }
    const div = new Int32Array(512);
    for (let i = 1; i < 512; i++) div[i] = (32768 / i) | 0;
    const div2 = new Int32Array(2048);
    for (let i = 1; i < 2048; i++) div2[i] = (65536 / i) | 0;
    return {
        divTable: div,
        lowDetail: true,
        textureFallback: false,
        cosTable: cos,
        divTable2: div2,
        lowMemTexture: false,
        opaque: false,
        sinTable: sin,
        scanline: new Int32Array(1024),
        trans: 0,
        colourTable: new Int32Array(65536),
        brightness: 1.0,
        hclip: false,
        originY: 0,
        originX: 0,
        width: 0,
        height: 0,
        textureProvider: null,
        clipMinX: 0,
        clipMaxX: 0,
        clipMinY: 0,
        clipMaxY: 0
    };
}

// cb.<clinit>: the share maps and tic, and cb.D/cb.cb aliasing dc.g/dc.l.
function modelUnlitClinit(pix: Statics): Statics {
    return { shareMap: new Int32Array(10000), shareTic: 0, shareMap2: new Int32Array(10000), cos: pix['cosTable'], sin: pix['sinTable'] };
}

// of.<clinit>: the frame decoder's scratch.
function animFrameClinit(): Statics {
    return { tempTz: new Int16Array(500), tempTi: new Int16Array(500), tempTx: new Int16Array(500), tempFlags: new Uint8Array(500), tempPrevOrigin: new Int16Array(500), tempTy: new Int16Array(500) };
}

// dc.a(IIII)V (setBounds, what dc.d() runs for the td clip): assigned field by field so this suite adds no call to
// Pix3D.setBounds (pix3d.test.ts matches the engine's negative-length message from its allocation site).
function setBounds(x0: number, y0: number, x1: number, y1: number): void {
    pix3d['width'] = (x1 - x0) | 0;
    pix3d['height'] = (y1 - y0) | 0;
    Pix3D.resetOrigin();
    const scanline = requireNonNull(pix3d['scanline'] as Int32Array | null);
    const height = pix3d['height'] as number;
    if (scanline.length < height) throw new Error('setBounds: the suite never needs a scanline reallocation');
    let offset = (Math.imul(y0, Pix2D.width) + x0) | 0;
    for (let y = 0; y < height; y++) {
        scanline[y] = offset;
        offset = (offset + Pix2D.width) | 0;
    }
}

// ---- oracle ----

function runOracle(fixture: Buffer, script: string[]): string[] {
    const out = resolve(import.meta.dir, '../../out');
    mkdirSync(out, { recursive: true });
    const scratch = mkdtempSync(join(out, 'model-lit-oracle-'));
    try {
        const source = fileURLToPath(new URL('./model-lit/ModelLitOracle.java', import.meta.url));
        const build = Bun.spawnSync(['javac', '-nowarn', '-cp', gamepackPath, '-d', scratch, source]);
        if (build.exitCode !== 0) throw new Error(build.stderr.toString());
        const fixturePath = join(scratch, 'fixture.bin');
        writeFileSync(fixturePath, fixture);
        const run = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', gamepackPath + delimiter + scratch, 'ModelLitOracle', fixturePath], {
            stdin: Buffer.from(script.join('\n') + '\n'),
            timeout: 280000
        });
        if (run.exitCode !== 0) throw new Error(`ModelLitOracle exited ${run.exitCode}: ${run.stderr.toString()}`);
        const lines = run.stdout.toString().split(/\r?\n/);
        if (lines[lines.length - 1] === '') lines.pop();
        return lines;
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
}

// ---- fixture and script ----

interface FrameSetInfo {
    group: number;
    frames: number[];
    length: number;
    baseSize: number;
    special: boolean;
}

interface ModelInfo {
    id: number;
    points: number;
    faces: number;
    textured: boolean;
    priorities: boolean;
    // The bounding box straddles x = 0 and z = 0 and rises above y = -40 (the mouse at the centre is over it).
    centred: boolean;
    labelled: boolean;
    // The model-wide priority when facePriority is null, else -1.
    uniformPriority: number;
    // Faces of priority 10 or 11 together with priority 2 but none of 1 and 3 (Render2's var36 average).
    mixedPriority: boolean;
    // fc.n()V (CalcBoundingCylinder) of the freshly lit model, which shares the unlit vertices.
    bounds: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number; cylinder: number; sphere: number };
    // The vertices (kept for the two-triangle models whose picks the script aims at single screen pixels).
    vertices: [number, number, number][];
}

// What fc.n()V computes for these vertices, for the boundary draws.
function cylinderBounds(m: ModelUnlit): ModelInfo['bounds'] {
    let minX = 32767;
    let minY = 32767;
    let minZ = 32767;
    let maxX = -32768;
    let maxY = -32768;
    let maxZ = -32768;
    let cylinder = 0;
    let sphere = 0;
    const xs = requireNonNull(m.pointX);
    const ys = requireNonNull(m.pointY);
    const zs = requireNonNull(m.pointZ);
    for (let i = 0; i < m.numPoints; i++) {
        minX = Math.min(minX, xs[i]);
        maxX = Math.max(maxX, xs[i]);
        minY = Math.min(minY, ys[i]);
        maxY = Math.max(maxY, ys[i]);
        minZ = Math.min(minZ, zs[i]);
        maxZ = Math.max(maxZ, zs[i]);
        let d = (Math.imul(xs[i], xs[i]) + Math.imul(zs[i], zs[i])) | 0;
        if (d > cylinder) cylinder = d;
        d = (d + Math.imul(ys[i], ys[i])) | 0;
        if (d > sphere) sphere = d;
    }
    const short = (v: number): number => (v << 16) >> 16;
    return {
        minX: short(minX),
        maxX: short(maxX),
        minY: short(minY),
        maxY: short(maxY),
        minZ: short(minZ),
        maxZ: short(maxZ),
        cylinder: short((Math.sqrt(cylinder) + 0.99) | 0),
        sphere: short((Math.sqrt(sphere) + 0.99) | 0)
    };
}

function modelInfo(id: number, probe: ModelUnlit): ModelInfo {
    const xs = requireNonNull(probe.pointX).subarray(0, probe.numPoints);
    const ys = requireNonNull(probe.pointY).subarray(0, probe.numPoints);
    const zs = requireNonNull(probe.pointZ).subarray(0, probe.numPoints);
    const centred = Math.min(...xs) < -20 && Math.max(...xs) > 20 && Math.min(...zs) < -20 && Math.max(...zs) > 20 && Math.min(...ys) < -40;
    const priorities = probe.facePriority;
    const present = new Set<number>();
    if (priorities !== null) for (let i = 0; i < probe.numFaces; i++) present.add(priorities[i]);
    const mixedPriority = (present.has(10) || present.has(11)) && present.has(2) && !present.has(1) && !present.has(3);
    return {
        id,
        points: probe.numPoints,
        faces: probe.numFaces,
        textured: probe.faceMaterial !== null,
        priorities: priorities !== null,
        centred,
        labelled: (probe as unknown as Statics)['vertexLabel'] !== null,
        uniformPriority: priorities === null ? ((probe as unknown as Statics)['priority'] as number) : -1,
        mixedPriority,
        bounds: cylinderBounds(probe),
        vertices: probe.numFaces <= 2 ? Array.from({ length: probe.numPoints }, (_, i) => [xs[i], ys[i], zs[i]] as [number, number, number]) : []
    };
}

function fixture(): { data: Buffer; sets: FrameSetInfo[]; models: ModelInfo[]; quads: ModelInfo[] } {
    const assets = localAssets(cachePath, [0, 1, 7]);
    const framesArchive = assets.archive(0);
    const basesArchive = assets.archive(1);
    const modelsArchive = assets.archive(7);

    // Frame sets: a spread of archive 0 groups, then the only four sets whose frames carry tween flags (256, 2370, 2690,
    // 2691) and sets with rotation tweens of exactly 1024 between consecutive frames (134, 137, 187). Each kept set
    // lists its non-null frame ids and its base size.
    const frameGroups = requireNonNull(requireNonNull(assets.index(0)).groupIds);
    const candidates: number[] = [];
    for (let i = 0; i < frameGroups.length && candidates.length < 44; i += 61) candidates.push(frameGroups[i]);
    const special = [256, 2370, 2690, 2691, 134, 137, 187];
    for (const group of special) if (!candidates.includes(group)) candidates.push(group);
    const sets: FrameSetInfo[] = [];
    for (const group of candidates) {
        try {
            const set = new AnimFrameSet(framesArchive, basesArchive, group, false);
            const frames: number[] = [];
            let baseSize = 0;
            set.frames.forEach((f, id) => {
                if (f !== null) {
                    frames.push(id);
                    baseSize = requireNonNull(f.base).size;
                }
            });
            if (frames.length > 1) sets.push({ group, frames, length: set.frames.length, baseSize, special: special.includes(group) });
        } catch {
            // Skipped here; the oracle never sees it.
        }
    }

    // Models: every 211th id of archive 7 that decodes and has faces (about 210), then two each of the uniform
    // priorities 2, 10 and 11 and of the mixed 10/11 + 2 (no 1, no 3) priority sets, for the priority merges.
    const models: ModelInfo[] = [];
    const modelGroups = requireNonNull(requireNonNull(assets.index(7)).groupIds);
    const maxId = modelGroups[modelGroups.length - 1];
    const probe = (id: number): ModelInfo | null => {
        try {
            const m = ModelUnlit.Load(modelsArchive, id, 0);
            return m === null || m.numFaces === 0 ? null : modelInfo(id, m);
        } catch {
            return null;
        }
    };
    for (let id = 0; id <= maxId && models.length < 210; id += 211) {
        const info = probe(id);
        if (info !== null) models.push(info);
    }
    const wanted: [string, (m: ModelInfo) => boolean][] = [
        ['u2', m => m.uniformPriority === 2],
        ['u10', m => m.uniformPriority === 10],
        ['u11', m => m.uniformPriority === 11],
        ['mixed', m => m.mixedPriority]
    ];
    for (const [, accept] of wanted) {
        let found = models.filter(accept).length;
        for (let k = 0; k < modelGroups.length && found < 2; k += 13) {
            if (models.some(m => m.id === modelGroups[k])) continue;
            const info = probe(modelGroups[k]);
            if (info !== null && accept(info) && info.faces < 2000) {
                models.push(info);
                found++;
            }
        }
    }

    // Two-triangle quads (cache models 1824, 1830, 1962 and 1980: flat 128-wide quads facing the camera).
    const quads: ModelInfo[] = [];
    for (const id of [1824, 1830, 1962, 1980]) {
        const info = probe(id);
        if (info !== null && info.faces === 2) quads.push(info);
    }

    const chunks: Buffer[] = [];
    const int = (n: number): void => {
        const b = Buffer.alloc(4);
        b.writeInt32BE(n);
        chunks.push(b);
    };
    const bytes = (data: Uint8Array): void => {
        int(data.length);
        chunks.push(Buffer.from(data));
    };
    const archive = (id: number, groups: number[]): void => {
        bytes(readGroup(cachePath, 255, id));
        int(groups.length);
        for (const group of groups) {
            int(group);
            bytes(readGroup(cachePath, id, group));
        }
    };
    archive(1, [...requireNonNull(requireNonNull(assets.index(1)).groupIds)]);
    archive(
        0,
        sets.map(s => s.group)
    );
    archive(7, [...new Set([...models, ...quads].map(m => m.id))]);
    return { data: Buffer.concat(chunks), sets, models, quads };
}

function generateScript(sets: FrameSetInfo[], models: ModelInfo[], quads: ModelInfo[]): string[] {
    const next = rng(0x530);
    const below = (n: number): number => (next() >>> 0) % n;
    const between = (lo: number, hi: number): number => lo + below(hi - lo + 1);
    const script: string[] = ['init'];
    sets.forEach((s, i) => script.push(`set ${i} ${s.group}`));
    // The CopyForAnim scratch buffers grow to the model size + 100 only when they are shorter: copy a model, then one
    // with exactly 100 more faces (and, separately, 100 more vertices), so the second copy finds a buffer of exactly
    // its size. Done first, while the buffers still have their <clinit> length of 1.
    const pairBy = (key: 'faces' | 'points'): [ModelInfo, ModelInfo] | null => {
        for (const a of models) {
            const b = models.find(m => m[key] === a[key] + 100 && m.points < 4000 && m.faces < 4000);
            if (b !== undefined && a.points < 4000 && a.faces < 4000) return [a, b];
        }
        return null;
    };
    for (const pair of [pairBy('faces'), pairBy('points')]) {
        if (pair === null) continue;
        for (const m of pair) script.push(`load 0 ${m.id}`, 'light 0 0 64 768 -50 -10 -50', 'copya 1 0 0 0 0', 'copyb 1 0 0 0 0', 'copyc 1 0 0 0 0');
    }

    const pickSet = (): number => (below(14) === 0 ? -1 : below(sets.length));
    const pickFrame = (s: number): number => {
        if (s < 0) return below(3);
        const r = below(24);
        if (r === 0) return -1;
        if (r === 1) return sets[s].length + below(3);
        return sets[s].frames[below(sets[s].frames.length)];
    };
    // The tween target: mostly another frame of the same set (the only frames that share the AnimBase).
    const tween = (s: number): [number, number] => {
        const r = below(10);
        const target = r < 7 ? s : r < 8 ? pickSet() : -1;
        return [target, pickFrame(target)];
    };
    const ratio = (): string => {
        const den = below(30) === 0 ? 0 : 1 + below(8);
        const num = below(6) === 0 ? 0 : below(den + 3);
        return `${num} ${den}`;
    };
    const labels = (): string => {
        const r = below(12);
        if (r === 0) return 'null';
        if (r === 1) return '-';
        return Array.from({ length: 1 + below(4) }, () => (below(10) === 0 ? 200 + below(100) : below(24))).join(',');
    };
    const matrix = (): string => (below(3) === 0 ? 'null' : Array.from({ length: below(15) === 0 ? 9 : 15 }, () => between(-40000, 40000)).join(','));
    const partMask = (): number => [65535, below(65536), 1, 2, 3 | (below(2) << 2), 65535 & ~(1 << below(4))][below(6)];
    const bools = (length: number): string => {
        if (below(6) === 0) return 'null';
        const n = Math.max(0, length + (below(5) === 0 ? -1 - below(3) : 0));
        return n === 0 ? '-' : Array.from({ length: n }, () => (below(2) === 0 ? '0' : '1')).join('');
    };
    const typecode = (): string => {
        const r = below(6);
        if (r === 0) return '0';
        if (r === 1) return String(-1 - below(1000));
        return String(BigInt.asIntN(64, (BigInt(next() >>> 0) << 32n) | BigInt(next() >>> 0)) & 0x7fffffffffffffffn);
    };
    const sinOf = (a: number): number => (65536.0 * Math.sin(a * 0.0030679615)) | 0;
    const cosOf = (a: number): number => (65536.0 * Math.cos(a * 0.0030679615)) | 0;
    const angle = (): number => (below(80) === 0 ? [2048, -1, 4096][below(3)] : below(2048));

    const draw = (slot: number): void => {
        const pitch = below(10) === 0 ? below(2048) : between(128, 383);
        const yaw = below(2048);
        let sp = sinOf(pitch);
        let cp = cosOf(pitch);
        if (below(12) === 0) {
            sp = between(-70000, 70000);
            cp = between(-70000, 70000);
        }
        const kind = below(20);
        let x: number;
        let y: number;
        let z: number;
        if (kind < 4) {
            x = between(-200, 200);
            y = between(-100, 300);
            z = between(-200, 300);
        } else if (kind < 17) {
            x = between(-1400, 1400);
            y = between(-400, 900);
            z = between(-300, 3200);
        } else if (kind < 19) {
            x = between(-6000, 6000);
            y = between(-3000, 3000);
            z = between(3000, 9000);
        } else {
            x = between(-60000, 60000);
            y = between(-60000, 60000);
            z = between(-60000, 60000);
        }
        const modelYaw = below(3) === 0 ? 0 : angle();
        script.push(`cls ${below(1000)}`, `draw ${slot} ${modelYaw} ${sp} ${cp} ${sinOf(yaw)} ${cosOf(yaw)} ${x} ${y} ${z} ${typecode()} ${below(4)} ${below(2)}`);
    };
    // ObjRender: model pitch, yaw and roll, the eye pitch (mostly a shallow one), the eye offset and the typecode.
    const obj = (slot: number): void => {
        const z = below(8) === 0 ? between(-50, 50) : between(300, 3000);
        const eye = below(4) === 0 ? angle() : (between(-300, 300) + 2048) % 2048;
        script.push(`obj ${slot} ${angle()} ${angle()} ${below(4) === 0 ? 0 : angle()} ${eye} ${between(-200, 200)} ${between(-150, 150)} ${z} ${typecode()}`);
    };
    const ortho = (slot: number): void => {
        const zoom = below(8) === 0 ? 0 : between(64, 4096);
        script.push(`ortho ${slot} ${angle()} ${angle()} ${angle()} ${between(0, 512)} ${between(-60, 60)} ${between(-100, 300)} ${between(-200, 2000)} ${zoom}`);
    };
    const pick = (): void => {
        const r = below(10);
        script.push(`pick ${r < 7 ? 1 : 0} ${between(-80, 80)} ${between(-80, 80)} ${r === 9 ? 998 + below(3) : 0}`);
    };
    const lightVector = (): string => {
        const c = (): number => (below(10) === 0 ? 0 : between(-100, 100));
        return `${c()} ${c()} ${c()}`;
    };
    const light = (slot: number, source: number): void => {
        if (below(40) === 0) {
            script.push(`lighta ${slot} ${source} ${lightVector()}`);
            return;
        }
        const op = ['light', 'lightb', 'lightc'][below(3)];
        const ambient = below(10) === 0 ? between(-100, 300) : between(0, 128);
        // LocType/NpcType/ObjType contrasts are 768 or 850 plus g1s * 5; the routine takes any int.
        const r = below(20);
        const contrast = r === 0 ? between(0, 255) : r === 1 ? between(-640, -1) : between(256, 1500);
        script.push(`${op} ${slot} ${source} ${ambient} ${contrast} ${lightVector()}`);
    };
    const view = (): void => {
        if (below(3) === 0) {
            script.push('view 0 0 320 240');
            return;
        }
        const x0 = between(-20, 120);
        const y0 = between(-20, 90);
        const x1 = between(x0 + 1, 340);
        const y1 = between(y0 + 1, 250);
        script.push(below(2) === 0 ? `view ${x0} ${y0} ${x1} ${y1}` : `view ${x0} ${y0} ${x1} ${y1} ${between(0, 320)} ${between(0, 240)}`);
    };

    script.push('light 5 15 64 768 -50 -10 -50', 'qs 0 1', 'qs 1 2', 'qs 2 3', 'qs 17 4', 'qs 300 5', 'qs 4096 6');
    models.forEach((model, index) => {
        if (index % 9 === 4) view();
        if (index % 9 === 8) script.push('view 0 0 320 240');
        if (below(10) === 0) script.push(`ld ${below(2)}`);

        // The source: the cache model, sometimes combined with the two (or three) before it, lit one to three times.
        script.push(`load 0 ${model.id}`);
        let source = 0;
        if (index > 3 && below(4) === 0) {
            script.push(below(2) === 0 ? 'comb 1 0 2 3' : 'comb 1 2 0 3 4');
            source = 1;
        }
        let lights = 1 + below(3);
        light(0, source);
        // ShareLight (cb.a(Lug;IIIZ)V) needs this model's normals (the light above computed them) and coincident
        // vertices: the model with itself, with the model it was combined from, or with the previous one, mostly at
        // offset 0. The lights after it read the shared normals.
        if (index > 3 && below(3) === 0) {
            const r = below(4);
            const other = r === 0 ? source : r === 1 && source === 1 ? 0 : 2;
            const offset = below(3) === 0 ? `${between(-256, 256)} ${between(-64, 64)} ${between(-256, 256)}` : '0 0 0';
            script.push(`share ${source} ${other} ${offset} ${below(4) === 0 ? 1 : 0}`);
            lights = Math.max(lights, 2);
        }
        for (let k = 1; k < lights; k++) light(0, source);
        script.push('bounds 0', `aabb 0 ${below(4) === 0 ? 1 : 0}`, `upd 0 ${below(100)} ${below(100)} ${below(100)} ${below(100)} ${below(100)}`);
        pick();
        draw(0);
        draw(0);
        if (below(2) === 0) {
            pick();
            draw(0);
        }
        obj(0);
        ortho(0);

        // Animation on the actor scratch copy.
        script.push(`copyb 1 0 ${below(2)} ${below(2)} ${below(2)}`);
        const s1 = pickSet();
        const [s2, f2] = below(4) === 0 ? [-1, 0] : tween(s1);
        script.push(`anim 1 ${s1} ${pickFrame(s1)} ${s2} ${f2} ${ratio()} ${below(2)}`);
        pick();
        draw(1);

        // Walk-merge on the spot scratch copy: the second half tweens toward a frame that must share the first
        // half's base.
        const s3 = pickSet();
        const [s3b, f3b] = tween(s3);
        const s4 = below(10) < 6 ? s3 : pickSet();
        const r4 = below(10);
        const s4b = r4 < 5 ? s3 : r4 < 7 ? s4 : r4 < 8 ? pickSet() : -1;
        const baseSize = s3 >= 0 ? sets[s3].baseSize : 8;
        script.push(`copya 2 0 ${below(2)} ${below(2)} ${below(2)}`);
        script.push(`split 2 ${s3} ${pickFrame(s3)} ${s3b} ${f3b} ${ratio()} ${s4} ${below(8) === 0 ? -1 : pickFrame(s4)} ${s4b} ${pickFrame(s4b)} ${ratio()} ${bools(baseSize)} ${below(2)}`);
        obj(2);

        // Masked animation on the loc scratch copy (a combined source carries part masks).
        const s7 = pickSet();
        const [s7b, f7b] = tween(s7);
        script.push(`copyc 3 0 ${below(2)} ${below(2)} ${below(2)}`);
        script.push(`animm 3 ${s7} ${pickFrame(s7)} ${s7b} ${f7b} ${ratio()} ${partMask()} ${below(2)} ${matrix()}`);
        const s9 = pickSet();
        script.push(`shadow 3 ${s9} ${pickFrame(s9)}`, 'end 3');
        draw(3);

        // Direct transforms on the lit model.
        script.push('begin 0');
        for (let k = 0; k < 4; k++) {
            const type = [0, 1, 2, 3, 5, 7, 0, 2, 3, 4, 6, 9][below(12)];
            const args = type === 3 ? [between(64, 192), between(64, 192), between(64, 192)] : [between(-300, 300), between(-300, 300), between(-300, 300)];
            const angles = [below(2048), below(2048), below(2048)].map(a => (below(3) === 0 ? 0 : a));
            if (below(2) === 0) script.push(`a2 0 ${type} ${labels()} ${(type === 2 ? angles : args).join(' ')} ${below(2)}`);
            else script.push(`a2m 0 ${type} ${labels()} ${(type === 2 ? angles : args).join(' ')} ${below(2)} ${partMask()} ${matrix()}`);
        }
        // Rotations of every labelled vertex (labels 0..63) at random angles: the +32767 rounding of each axis.
        const all = Array.from({ length: 64 }, (_, k) => k).join(',');
        for (let k = 0; k < 2; k++) script.push(`a2 0 2 ${all} ${below(2048)} ${below(2048)} ${below(2048)} 0`);
        script.push('end 0');
        const allType = [0, 1, 2, 3, 5, 7, 4, 8][below(8)];
        script.push(`all 0 0 ${between(-20, 20)} ${between(-20, 20)} ${between(-20, 20)}`);
        script.push(`all 0 ${allType} ${allType === 2 ? below(2048) : between(-40, 160)} ${allType === 2 ? below(2048) : between(-40, 160)} ${allType === 2 ? below(2048) : between(-40, 160)}`, 'end 0');
        // Each rigid transform invalidates the bounds: a bounds query after some of them catches a stale cylinder.
        for (const op of [
            `rotx 0 ${angle()}`,
            `roty 0 ${angle()}`,
            `rotz 0 ${angle()}`,
            'rot90 0',
            'rot180 0',
            'rot270 0',
            `resize 0 ${between(64, 192)} ${between(64, 192)} ${between(64, 192)}`,
            `trans 0 ${between(-64, 64)} ${between(-64, 64)} ${between(-64, 64)}`
        ]) {
            script.push(op);
            if (below(3) === 0) script.push('bounds 0');
        }
        script.push('bounds 0');

        // Ground conformance and merging.
        const hx = between(1024, 12000);
        const hz = between(1024, 12000);
        const type = below(7);
        const mapA = below(10) === 0 ? 2 : 0;
        const mapB = below(6) === 0 ? -1 : 1;
        script.push(`hill 4 0 ${type} ${type === 3 ? below(65536) : between(0, 400)} ${mapA} ${mapB} ${hx} ${between(-200, 200)} ${hz} ${below(2)}`);
        if (below(4) === 0) script.push(`hill 4 0 1 0 0 1 ${between(-300, 13600)} 0 ${between(-300, 13600)} 1`);
        script.push(`tilt 0 ${below(8) === 0 ? 2 : below(8) === 0 ? -1 : 0} ${hx} ${below(100)} ${hz} ${below(1024)} ${below(1024)}`);
        // Footprints over the map edges (getHeightAt's bounds: 0 outside, the last row and column inside).
        if (below(3) === 0) script.push(`tilt 0 0 ${below(2) === 0 ? between(-300, 300) : between(13012, 13612)} ${below(100)} ${below(2) === 0 ? between(-300, 300) : between(13012, 13612)} ${below(600)} ${below(600)}`);
        // HillSkewCopy type 2 at height 0: every vertex compares its (y << 16) / minY against 0.
        if (below(5) === 0) script.push(`hill 4 0 2 0 0 1 ${hx} ${between(-200, 200)} ${hz} ${below(2)}`);
        script.push(`append 6 0 ${[4, 5, 5, -1][below(4)]}`, 'bounds 6');
        if (below(3) === 0) draw(6);
        if (below(2) === 0) ortho(4);

        // The quicksort path of Render2 (fc.Gb) on a few models.
        if (index % 13 === 6) {
            script.push('qsmode 1');
            draw(0);
            draw(0);
            obj(0);
            ortho(0);
            draw(6);
            script.push('qsmode 0');
        }

        // Keep the last unlit models for comb/share and this lit model for the next append.
        script.push('ucopy 4 3', 'ucopy 3 2', 'ucopy 2 0', 'lcopy 5 0');
    });

    // Edges.
    script.push('view 0 0 320 240', 'ld 1', 'qsmode 0');
    // No texture provider: lighting a textured model and drawing one.
    const textured = models.filter(m => m.textured);
    for (const m of textured.slice(0, 3)) {
        script.push(`load 0 ${m.id}`, 'tp 0', 'light 0 0 64 768 -50 -10 -50', 'tp 1', 'light 0 0 64 768 -50 -10 -50', 'tp 0');
        draw(0);
        script.push('cls 1', 'draw 0 0 16000 63500 0 65536 0 100 900 0 0 0');
        obj(0);
        ortho(0);
        script.push('tp 1');
    }
    // The pick list: null, too short, refilled; the model straight ahead with the mouse on its centre, picked by its
    // bounding box (world draw), per triangle (world draw, inside its catch) and by ObjRender (inside its catch).
    const centred = requireNonNull(models.find(m => m.centred && !m.textured && m.faces >= 60));
    script.push(`load 0 ${centred.id}`, 'light 0 0 64 768 -50 -10 -50', 'aabb 0 1');
    for (const n of [-1, 2, 0, 1000]) {
        script.push(`pickarr ${n}`, 'pick 1 0 -10 0', 'cls 2', 'draw 0 0 0 65536 0 65536 0 0 600 77 0 0', 'pick 1 0 -10 1', 'draw 0 0 0 65536 0 65536 0 0 600 78 0 0');
        script.push('aabb 0 0', 'pick 1 0 -10 1', 'draw 0 0 0 65536 0 65536 0 0 600 79 0 0', 'pick 1 0 -10 2', 'obj 0 0 0 0 0 0 0 600 80', 'aabb 0 1');
    }
    // The world draw's culls exactly on and one unit inside each bound, from each model's own cylinder: with no pitch
    // and no yaw the eye-space depth is z and the bounds are z +- cylinder radius, so var13 (near), var14 (far 3500),
    // the near-clip flag (var14 <= 50), the four clip edges (at depth 512, x/y scale 1) and the pick guard
    // (var14 > 0) each sit on their boundary. Untextured, textured and large models.
    const boundary = [models.find(m => m.centred && !m.textured && m.faces < 800), models.find(m => m.textured && m.faces < 800), models.find(m => m.bounds.cylinder > 300 && m.faces < 2000)];
    for (const m of boundary) {
        if (m === undefined) continue;
        const b = m.bounds;
        const r = b.cylinder;
        script.push(`load 0 ${m.id}`, 'light 0 0 64 768 -50 -10 -50', 'bounds 0', 'pick 0 0 0 0', 'aabb 0 0');
        const at = (x: number, y: number, z: number, typecode = 0): void => {
            script.push(`cls ${below(1000)}`, `draw 0 0 0 65536 0 65536 ${x} ${y} ${z} ${typecode} 0 0`);
        };
        for (const d of [0, 1]) {
            at(0, 0, 50 - r + d);
            at(0, 0, 3500 + r - d);
            at(-160 - r + d, 0, 512 - r);
            at(160 + r - d, 0, 512 - r);
            at(0, -120 - b.maxY + d, 512 - r);
            at(0, 120 - b.minY - d, 512 - r);
            at(0, 0, 50 + r + d);
        }
        // The pick guard: the model straddling the eye (var14 = -1, 0, 1) with the mouse on it.
        script.push('aabb 0 1');
        for (const d of [-1, 0, 1]) {
            script.push('pick 1 0 0 0');
            at(0, 0, r + d, 70 + d);
        }
        script.push('aabb 0 0');
        // HillSkewCopy type 2 at height 0 on the unmoved model (no vertex below its base): only a vertex at the base
        // (y << 16) / minY == 0 would reach the division by the height.
        script.push('hill 4 0 2 0 0 1 6000 -50 6000 1', 'hill 4 0 2 1 0 1 6000 -50 6000 1');
    }
    // The mouse swept one pixel at a time across a model, picked by its box and per triangle: every edge of the
    // projected box and of the triangle boxes. No pitch, the model's vertical middle on the eye line, and off-centre by
    // 20 to either side: the cylinder pre-test bounds each side with the depth that makes it the wider one only when
    // the model is on that side, so the corner box decides there.
    const swept = requireNonNull(models.find(m => m.centred && !m.textured && m.faces >= 60 && m.faces < 600));
    const middle = -((swept.bounds.minY + swept.bounds.maxY) >> 1);
    const half = ((swept.bounds.maxY - swept.bounds.minY) * 512) / 1200;
    script.push(`load 0 ${swept.id}`, 'light 0 0 64 768 -50 -10 -50', 'cls 5');
    for (const aabb of [1, 0]) {
        script.push(`aabb 0 ${aabb}`);
        for (const dx of [20, -20]) {
            const view = `draw 0 0 0 65536 0 65536 ${dx} ${middle} 600 71 0 0`;
            const rows = aabb === 1 ? [0] : [0, Math.round(-half / 2), Math.round(half / 2)];
            const columns = aabb === 1 || dx < 0 ? [dx] : [-30, -20, -10, 0, 10, 20, 30].map(c => c + dx);
            for (const row of rows) for (let v = -150; v <= 150; v++) script.push(`pick 1 ${v} ${row} 0`, view);
            for (const column of columns) for (let v = -130; v <= 130; v++) script.push(`pick 1 ${column} ${v} 0`, view);
        }
    }
    // Small models straddling the near plane (depth 50 +- their radius) at shallow angles: many faces cross it within
    // the 15 units of the axis that stay on screen after the 512/50 magnification, so clipped quads come with every
    // pattern of on- and off-screen points.
    for (const m of models.filter(x => x.bounds.cylinder >= 30 && x.bounds.cylinder <= 90 && x.faces >= 40 && x.faces < 1000).slice(0, 12)) {
        const r = m.bounds.cylinder;
        const middleY = -((m.bounds.minY + m.bounds.maxY) >> 1);
        script.push(`load 0 ${m.id}`, 'light 0 0 64 768 -50 -10 -50');
        for (let k = 0; k < 40; k++) {
            const pitch = below(4) === 0 ? between(0, 120) : 0;
            const yaw = below(3) === 0 ? 0 : below(2048);
            script.push(
                `cls ${below(1000)}`,
                `draw 0 ${below(2048)} ${(65536.0 * Math.sin(pitch * 0.0030679615)) | 0} ${(65536.0 * Math.cos(pitch * 0.0030679615)) | 0} ${(65536.0 * Math.sin(yaw * 0.0030679615)) | 0} ${(65536.0 * Math.cos(yaw * 0.0030679615)) | 0} ${between(-r, r)} ${middleY + between(-r >> 1, r >> 1)} ${50 + between(-r, r >> 1)} 0 0 0`
            );
        }
    }
    // Per-triangle picking at single pixels: a two-triangle quad rolled in the screen plane 16 times (rotateZAxis by 128,
    // replayed here with the same table arithmetic) and drawn straight ahead at depth 400, so one triangle alone holds
    // the topmost, bottommost, leftmost and rightmost vertex; the mouse on each of those vertices and one pixel off it
    // in each direction hits FastInsideTriangle's four rejections exactly on their edges. The model sits one unit to the
    // side of the axis that holds the vertex, so the cylinder pre-test bounds that side with its wider depth.
    for (const m of quads) {
        script.push(`load 0 ${m.id}`, 'light 0 0 64 768 -50 -10 -50', 'aabb 0 0', 'cls 7');
        const v = m.vertices.map(([x, y, z]) => [x, y, z]);
        const sin = sinOf(128);
        const cos = cosOf(128);
        for (let k = 0; k < 16; k++) {
            if (k > 0) {
                script.push('rotz 0 128');
                for (const p of v) {
                    const x = (Math.imul(p[1], sin) + Math.imul(p[0], cos)) >> 16;
                    p[1] = (Math.imul(p[1], cos) - Math.imul(p[0], sin)) >> 16;
                    p[0] = x;
                }
            }
            const extremes = [v.reduce((a, b) => (b[1] < a[1] ? b : a)), v.reduce((a, b) => (b[1] > a[1] ? b : a)), v.reduce((a, b) => (b[0] < a[0] ? b : a)), v.reduce((a, b) => (b[0] > a[0] ? b : a))];
            for (const e of extremes) {
                const dx = e[0] >= 0 ? 1 : -1;
                const sx = (((e[0] + dx) << 9) / (e[2] + 400)) | 0;
                const sy = ((e[1] << 9) / (e[2] + 400)) | 0;
                for (const [ox, oy] of [
                    [0, 0],
                    [-1, 0],
                    [1, 0],
                    [0, -1],
                    [0, 1]
                ])
                    script.push(`pick 1 ${sx + ox} ${sy + oy} 0`, `draw 0 0 0 65536 0 65536 ${dx} 0 400 72 0 0`);
            }
        }
    }
    // Render2's depth range limit (var6 >= 1600): every vertex at one point, at distance 798..801 on x, so the world
    // draw's range (2 * cylinder + 2 = 1598..1604) and ObjRender's (2 * sphere = 1596..1602) straddle 1600; drawn after
    // a real draw so a depth-bucket reset would show.
    for (const dx of [798, 799, 800, 801]) {
        script.push(`load 0 ${swept.id}`, 'light 0 0 64 768 -50 -10 -50', 'cls 6', 'draw 0 0 0 65536 0 65536 0 30 600 0 0 0');
        script.push('resize 0 0 0 0', `trans 0 ${dx} 0 0`, 'bounds 0', 'draw 0 0 0 65536 0 65536 0 0 1000 0 0 0', 'obj 0 0 0 0 0 0 0 1000 0');
    }
    // The near plane through big models: the eye inside or just in front of them at many angles, mostly shallow
    // pitches and offsets near the screen edges, so clipped quads have their fourth vertex on and off screen.
    for (const m of models.filter(x => x.bounds.cylinder > 150 && x.faces < 1500).slice(0, 12)) {
        const r = m.bounds.cylinder;
        script.push(`load 0 ${m.id}`, 'light 0 0 64 768 -50 -10 -50');
        for (let k = 0; k < 60; k++) {
            const pitch = between(0, 300);
            const yaw = below(2048);
            script.push(
                `cls ${below(1000)}`,
                `draw 0 ${below(2048)} ${(65536.0 * Math.sin(pitch * 0.0030679615)) | 0} ${(65536.0 * Math.cos(pitch * 0.0030679615)) | 0} ${(65536.0 * Math.sin(yaw * 0.0030679615)) | 0} ${(65536.0 * Math.cos(yaw * 0.0030679615)) | 0} ${between(-r, r)} ${between(-r, r >> 1)} ${between(-r, r)} 0 0 0`
            );
        }
    }
    // Merged priorities: uniform-priority models appended to each other (2 with 10 and 11: Render2's var36 average of
    // priorities 1 and 2 decides where the 10/11 faces go) and the mixed models, from many angles and both sorts.
    const byPriority = (accept: (m: ModelInfo) => boolean): ModelInfo[] => models.filter(accept).slice(0, 2);
    const u2 = byPriority(m => m.uniformPriority === 2);
    const u10 = byPriority(m => m.uniformPriority === 10);
    const u11 = byPriority(m => m.uniformPriority === 11);
    const mixed = byPriority(m => m.mixedPriority);
    const merges: [ModelInfo, ModelInfo | null][] = [];
    for (const a of u2) for (const b of [...u10, ...u11]) merges.push([a, b], [b, a]);
    for (const a of mixed) merges.push([a, null]);
    for (const [a, b] of merges) {
        script.push(`load 0 ${a.id}`, 'light 0 0 64 768 -50 -10 -50');
        if (b === null) script.push('lcopy 6 0');
        else script.push(`load 1 ${b.id}`, 'light 1 1 64 768 -30 -50 -40', 'trans 1 40 -20 30', 'append 6 0 1');
        script.push('bounds 6');
        for (const qs of [0, 1]) {
            script.push(`qsmode ${qs}`);
            for (let k = 0; k < 6; k++) draw(6);
            obj(6);
            ortho(6);
        }
        script.push('qsmode 0');
    }
    // Rotation stress on labelled models: Animate2 type 2 at random angles 60 times (animate2Masked and animateAll 30),
    // so their +32767 rounding sums meet values whose low 16 bits are exactly 0x8000.
    const all = Array.from({ length: 64 }, (_, k) => k).join(',');
    for (const m of models.filter(x => x.labelled && x.points > 200 && x.points < 4000).slice(0, 12)) {
        script.push(`load 0 ${m.id}`, 'light 0 0 64 768 -50 -10 -50', 'begin 0', 'all 0 0 0 0 0');
        for (let k = 0; k < 60; k++) {
            script.push(`a2 0 2 ${all} ${below(2048)} ${below(2048)} ${below(2048)} 0`);
            if (k % 2 === 0) script.push(`a2m 0 2 ${all} ${below(2048)} ${below(2048)} ${below(2048)} 0 ${below(2) === 0 ? 65535 : below(65536)} null`, `all 0 2 ${below(2048)} ${below(2048)} ${below(2048)}`);
        }
        script.push('end 0');
    }
    // Tweens over consecutive frames of the flagged sets and of the sets with half-turn rotation tweens.
    const animated = requireNonNull(models.find(m => m.labelled && m.faces < 1500));
    script.push(`load 0 ${animated.id}`, 'light 0 0 64 768 -50 -10 -50');
    sets.forEach((set, index) => {
        if (!set.special) return;
        for (let k = 0; k + 1 < set.frames.length && k < 12; k++) {
            script.push('copyb 1 0 0 0 0', `anim 1 ${index} ${set.frames[k]} ${index} ${set.frames[k + 1]} ${1 + below(7)} 8 0`, 'bounds 1');
            script.push('copyc 3 0 0 0 0', `animm 3 ${index} ${set.frames[k + 1]} ${index} ${set.frames[k]} ${1 + below(3)} 4 ${partMask()} 0 ${matrix()}`);
            script.push('copya 2 0 0 0 0', `split 2 ${index} ${set.frames[k]} ${index} ${set.frames[k + 1]} 1 2 ${index} ${set.frames[k + 1]} ${index} ${set.frames[k]} 1 2 ${bools(set.baseSize)} 0`);
        }
    });
    // HillSkewCopy over flat ground with bumps (map 3): every corner pattern of the flat-ground early return, with the
    // model narrowed to an eighth so its footprint mostly fits one tile.
    const small = requireNonNull(models.find(m => m.faces < 200 && m.bounds.cylinder > 40));
    script.push(`load 0 ${small.id}`, 'light 0 0 64 768 -50 -10 -50', 'resize 0 16 128 16', 'bounds 0');
    for (let k = 0; k < 120; k++) script.push(`hill 4 0 ${[1, 2, 3][below(3)]} ${[300, 65535, 4660][below(3)]} 3 1 ${between(256, 12800)} -200 ${between(256, 12800)} 1`);
    // cb.a(III) lights with the contrast cb stores (0 unless LocType set it): a division by zero on any smooth face.
    script.push('lighta 0 0 -50 -10 -50', 'lighta 0 0 0 0 0');
    // A model id outside the archive.
    script.push('load 0 999999', 'light 0 0 64 768 -50 -10 -50');
    // Full depth buckets: four copies of one model drawn on top of each other (AppendModel of AppendModel), then
    // flattened in depth so their faces share a few buckets (the 64-face buckets overflow into the extended ones) and
    // then one (whose 512 entries overflow too), with and without face priorities, through the depth sort and the
    // quicksort.
    for (const m of [models.find(x => x.priorities && x.faces >= 120 && x.faces <= 600), models.find(x => !x.priorities && x.faces >= 120 && x.faces <= 600)]) {
        if (m === undefined) continue;
        script.push(`load 0 ${m.id}`, 'light 0 0 64 768 -50 -10 -50', 'append 6 0 0', 'append 6 6 6', 'bounds 6');
        for (const scale of [128, 16, 0]) {
            if (scale !== 128) script.push(`resize 6 128 128 ${scale}`, 'bounds 6');
            for (const qs of [0, 1]) {
                script.push(`qsmode ${qs}`, 'pick 1 0 -10 0', 'cls 4', 'draw 6 0 0 65536 0 65536 0 50 900 83 0 0', 'draw 6 300 16000 63500 0 65536 40 50 600 84 0 0', 'obj 6 0 0 0 0 0 50 900 85', 'ortho 6 0 0 0 0 0 50 900 512');
            }
            script.push('qsmode 0');
        }
    }
    // More than 4096 faces, then more than 4096 vertices: appended copies of the largest model.
    const large = models.reduce((a, b) => (b.points > a.points ? b : a));
    script.push(`load 0 ${large.id}`, 'light 0 0 64 768 -50 -10 -50', 'append 6 0 0', 'bounds 6');
    for (let k = 0; k < 2; k++) {
        script.push('pick 1 0 0 0', 'cls 3', 'draw 6 0 16000 63500 0 65536 0 300 2000 81 0 0', 'obj 6 0 0 0 0 0 100 2000 82', 'ortho 6 0 0 0 0 0 100 2000 512');
        script.push('qsmode 1', 'draw 6 0 16000 63500 0 65536 0 300 2000 81 0 0', 'obj 6 0 0 0 0 0 100 2000 82', 'ortho 6 0 0 0 0 0 100 2000 512', 'qsmode 0');
        script.push('copya 7 6 0 0 0', 'copyb 7 6 0 0 0', 'copyc 7 6 0 0 0', 'hill 8 6 1 0 0 1 6000 0 6000 1', 'append 6 6 6', 'bounds 6');
    }
    // The end of the classes: unload, then everything that reads the statics it nulls.
    script.push('load 1 ' + models[0].id, 'light 1 1 64 768 0 0 0', 'light 1 1 64 768 -50 -10 -50', 'append 7 1 7');
    script.push('pick 1 0 0 1000', 'aabb 1 1');
    draw(1);
    script.push('unload', 'copya 2 1 0 0 0', 'copyb 2 1 1 1 1', 'copyc 2 1 0 1 0', 'copya 2 1 1 1 1', 'anim 1 0 0 -1 0 0 1 0', 'bounds 1');
    draw(1);
    script.push('draw 1 0 16000 63500 0 65536 0 100 900 0 0 0');
    obj(1);
    ortho(1);
    script.push('qsmode 1', 'draw 1 0 16000 63500 0 65536 0 100 900 0 0 0', 'qsmode 0');
    return script;
}

// ---- the TS side ----

interface Reached {
    tween: number;
    sharedNormals: number;
    partMasked: number;
    quicksortDraws: number;
}

function runTs(script: string[], reached: Reached): string[] {
    const assets = localAssets(cachePath, [0, 1, 7]);
    const framesArchive: Js5 = assets.archive(0);
    const basesArchive: Js5 = assets.archive(1);
    const modelsArchive: Js5 = assets.archive(7);
    const maps = makeMaps();
    const px = new Int32Array(320 * 240);
    const animSets: (AnimFrameSet | null)[] = new Array(64).fill(null);
    const unlit: (ModelUnlit | null)[] = new Array(16).fill(null);
    const lit: (ModelLitImpl | null)[] = new Array(16).fill(null);
    const at = (i: number): ModelLitImpl => requireNonNull(lit[i]);
    const unlitAt = (i: number): ModelUnlit | null => (i < 0 ? null : unlit[i]);
    const set = (i: number): AnimFrameSet | null => (i < 0 ? null : animSets[i]);
    const map = (i: number): Int32Array[] | null => (i < 0 ? null : maps[i]);
    const ints = (s: string): Int32Array | null => (s === 'null' ? null : s === '-' ? new Int32Array(0) : Int32Array.from(s.split(',').map(Number)));
    const boolList = (s: string): boolean[] | null => (s === 'null' ? null : s === '-' ? [] : Array.from(s, c => c === '1'));
    const scratch = (): string => {
        let s = STATICS.map(([obf, name]) => ` ${obf}=${value(impl[name])}`).join('');
        s += ` hclip=${Pix3D.hclip ? 1 : 0} trans=${Pix3D.trans}`;
        s += ` picked=${ModelLit.pickedCount}`;
        const w = ModelLit.pickedTypecodes;
        if (w === null) s += ':null';
        else {
            let h = 1;
            for (let i = 0; i < ModelLit.pickedCount && i < w.length; i++) h = (Math.imul(h, 31) + longHash(w[i])) | 0;
            s += `:${h}`;
        }
        return s + ` fb=${hashInts(px)}` + origin();
    };
    const initial = (): string => {
        const w = ModelLit.pickedTypecodes;
        let s = ` W=${w === null ? 'null' : w.length} r=${ModelLit.pickedCount} m=${ModelLit.checkHover ? 1 : 0} d=${ModelLit.mouseY} g=${ModelLitImpl.mouseX}`;
        s += tempLengths();
        s += STATICS.map(([obf, name]) => ` ${obf}=${value(impl[name])}`).join('');
        s += origin();
        return s + ` k=${value(impl['tempActorModel'])} V=${value(impl['tempSpotModel'])} cb=${value(impl['tempLocModel'])}`;
    };
    const quicksort = (n: number, seed: number): string => {
        const keys = new Int32Array(n);
        const idx = new Int32Array(n);
        for (let i = 0; i < n; i++) {
            let v = Math.imul(i, 0x9e3779b1 | 0) ^ seed;
            v ^= v >>> 15;
            keys[i] = (v & 3) === 0 ? v & 7 : v % 1000;
            idx[i] = i;
        }
        ModelLitImpl.quicksort(keys, n - 1, 0, idx);
        return `${hashInts(keys)} ${hashInts(idx)}`;
    };
    const fill = (seed: number): void => {
        for (let i = 0; i < px.length; i++) px[i] = Math.imul(i, 0x2545f491) ^ Math.imul(seed, 0x27d4eb2f);
    };
    const partMasked = (m: ModelLitImpl | null): boolean => m !== null && (m as unknown as Statics)['pointPartMask'] !== null;
    // Whether an animate call will tween: frame b of set sb shares the base of frame a of set sa.
    const shareBase = (sa: number, a: number, sb: number, b: number, num: number): boolean => {
        const x = set(sa)?.frames[a];
        const y = set(sb)?.frames[b];
        return num !== 0 && x !== undefined && x !== null && y !== undefined && y !== null && x.base === y.base;
    };
    const shows = (op: string, n: number[]): number[] => {
        switch (op) {
            case 'light':
            case 'lightb':
            case 'lightc':
            case 'lighta':
            case 'dump':
            case 'trans':
            case 'rot90':
            case 'rot180':
            case 'rot270':
            case 'rotx':
            case 'roty':
            case 'rotz':
            case 'resize':
            case 'upd':
            case 'all':
            case 'a2':
            case 'a2m':
            case 'end':
            case 'anim':
            case 'split':
            case 'animm':
            case 'shadow':
            case 'tilt':
            case 'append':
            case 'bounds':
                return [n[1]];
            case 'copya':
            case 'copyb':
            case 'copyc':
            case 'hill':
                return [n[1], n[2]];
            default:
                return [];
        }
    };

    const run = (line: string, t: string[], n: number[]): string => {
        switch (t[0]) {
            case 'init':
                return initial();
            case 'load':
                unlit[n[1]] = null;
                unlit[n[1]] = ModelUnlit.Load(modelsArchive, n[2], 0);
                return unlit[n[1]] === null ? ' null' : '';
            case 'comb': {
                const parts = t.slice(2).map((_, i) => unlitAt(n[i + 2]));
                unlit[n[1]] = null;
                unlit[n[1]] = new ModelUnlit(parts, parts.length);
                return '';
            }
            case 'ucopy':
                unlit[n[1]] = unlitAt(n[2]);
                return '';
            case 'lcopy':
                lit[n[1]] = lit[n[2]];
                return '';
            case 'share':
                requireNonNull(unlitAt(n[1])).mergeNormals(unlitAt(n[2]) as unknown as ModelSource, n[3], n[4], n[5], n[6] !== 0);
                return '';
            case 'light':
            case 'lightb':
            case 'lightc':
            case 'lighta': {
                const source = unlitAt(n[2]);
                if (source !== null && source.sharedPointNormal !== null) reached.sharedNormals++;
                lit[n[1]] = null;
                if (t[0] === 'light') lit[n[1]] = new ModelLitImpl(source, n[3], n[4], n[5], n[6], n[7]);
                else if (t[0] === 'lightb') lit[n[1]] = requireNonNull(source).Light(n[3], n[4], n[5], n[6], n[7]) as ModelLitImpl;
                else if (t[0] === 'lightc') lit[n[1]] = requireNonNull(source).LightImpl(n[3], n[4], n[5], n[6], n[7]);
                else lit[n[1]] = requireNonNull(source).light(n[3], n[4], n[5]) as ModelLitImpl;
                return '';
            }
            case 'dump':
                return '';
            case 'set': {
                const s = new AnimFrameSet(framesArchive, basesArchive, n[2], false);
                animSets[n[1]] = s;
                return ` ${s.frames.length}`;
            }
            case 'trans':
                at(n[1]).Translate(n[2], n[3], n[4]);
                return '';
            case 'rot90':
                at(n[1]).Rotate90();
                return '';
            case 'rot180':
                at(n[1]).Rotate180();
                return '';
            case 'rot270':
                at(n[1]).Rotate270();
                return '';
            case 'rotx':
                at(n[1]).RotateXAxis(n[2]);
                return '';
            case 'roty':
                at(n[1]).RotateYAxis(n[2]);
                return '';
            case 'rotz':
                at(n[1]).rotateZAxis(n[2]);
                return '';
            case 'resize':
                at(n[1]).Resize(n[2], n[3], n[4]);
                return '';
            case 'upd':
                at(n[1]).update(n[2], n[3], n[4], n[5], n[6]);
                return '';
            case 'all':
                at(n[1]).animateAll(n[2], n[3], n[4], n[5]);
                return origin();
            case 'a2':
                at(n[1]).Animate2(n[2], ints(t[3]), n[4], n[5], n[6], n[7] !== 0);
                return origin();
            case 'a2m':
                at(n[1]).animate2Masked(n[2], ints(t[3]), n[4], n[5], n[6], n[7] !== 0, n[8], ints(t[9]));
                return origin();
            case 'begin':
                return ` ${at(n[1]).beginAnimate()}` + origin();
            case 'end':
                at(n[1]).endAnimate();
                return '';
            case 'anim':
                if (shareBase(n[2], n[3], n[4], n[5], n[6])) reached.tween++;
                at(n[1]).Animate(set(n[2]), n[3], set(n[4]), n[5], n[6], n[7], n[8] !== 0);
                return origin();
            case 'split':
                if (shareBase(n[2], n[3], n[4], n[5], n[6])) reached.tween++;
                if (shareBase(n[2], n[3], n[10], n[11], n[12])) reached.tween++;
                at(n[1]).SplitAnimate(set(n[2]), n[3], set(n[4]), n[5], n[6], n[7], set(n[8]), n[9], set(n[10]), n[11], n[12], n[13], boolList(t[14]), n[15] !== 0);
                return origin();
            case 'animm':
                if (partMasked(lit[n[1]]) && n[8] !== 65535) reached.partMasked++;
                at(n[1]).animateMasked(set(n[2]), n[3], set(n[4]), n[5], n[6], n[7], n[8], n[9] !== 0, ints(t[10]));
                return origin();
            case 'shadow':
                at(n[1]).animateShadow(set(n[2]), n[3]);
                return origin();
            case 'copya':
            case 'copyb':
            case 'copyc': {
                lit[n[1]] = null;
                const src = at(n[2]);
                const r = t[0] === 'copya' ? src.CopyForAnimSpot(n[3] !== 0, n[4] !== 0, n[5] !== 0) : t[0] === 'copyb' ? src.CopyForAnimActor(n[3] !== 0, n[4] !== 0, n[5] !== 0) : src.CopyForAnimLoc(n[3] !== 0, n[4] !== 0, n[5] !== 0);
                lit[n[1]] = r as ModelLitImpl;
                return tempLengths();
            }
            case 'hill': {
                const r = at(n[2]).HillSkewCopy(n[3], n[4], map(n[5]), map(n[6]), n[7], n[8], n[9], n[10] !== 0);
                const extra = r === lit[n[2]] ? ' same' : ' new';
                lit[n[1]] = r;
                return extra;
            }
            case 'tilt':
                at(n[1]).tiltToGround(map(n[2]), n[3], n[4], n[5], n[6], n[7]);
                return '';
            case 'append': {
                // Both operands are read before the destination slot is cleared (append 6 6 6 doubles slot 6).
                const src = lit[n[2]];
                const other = n[3] < 0 ? null : lit[n[3]];
                lit[n[1]] = null;
                lit[n[1]] = requireNonNull(src).AppendModel(other) as ModelLitImpl;
                return '';
            }
            case 'bounds': {
                const m = at(n[1]);
                return ` ${m.getMaxX()} ${m.getMinX()} ${m.getMinY()} ${m.getMinZ()} ${m.getMaxZ()} ${m.GetRadiusCylinder()}`;
            }
            case 'aabb':
                at(n[1]).useAABBMouseCheck = n[2] !== 0;
                return '';
            case 'pick':
                ModelLit.checkHover = n[1] !== 0;
                ModelLitImpl.mouseX = n[2];
                ModelLit.mouseY = n[3];
                ModelLit.pickedCount = n[4];
                return '';
            case 'pickarr':
                ModelLit.pickedTypecodes = n[1] < 0 ? null : new BigInt64Array(n[1]);
                return '';
            case 'cls':
                fill(n[1]);
                return '';
            case 'view':
                Pix2D.setClipping(n[1], n[2], n[3], n[4]);
                setBounds(Pix2D.clipMinX, Pix2D.clipMinY, Pix2D.clipMaxX, Pix2D.clipMaxY);
                if (t.length > 6) Pix3D.setOrigin(n[5], n[6]);
                return ` ${Pix3D.originX},${Pix3D.originY},${Pix3D.width}`;
            case 'ld':
                Pix3D.lowDetail = n[1] !== 0;
                return '';
            case 'tp':
                Pix3D.textureProvider = n[1] !== 0 ? textures : null;
                return '';
            case 'qsmode':
                impl['useQuickSort'] = n[1] !== 0;
                if (n[1] !== 0) {
                    impl['sortFaceDepths'] = new Int32Array(4096);
                    impl['sortFaceIndices'] = new Int32Array(4096);
                }
                return '';
            case 'draw':
                if (impl['useQuickSort']) reached.quicksortDraws++;
                at(n[1]).draw(n[2], n[3], n[4], n[5], n[6], n[7], n[8], n[9], BigInt(t[10]), n[11], n[12] !== 0 ? new ParticleSystem() : null);
                return scratch();
            case 'obj':
                at(n[1]).ObjRender(n[2], n[3], n[4], n[5], n[6], n[7], n[8], BigInt(t[9]));
                return scratch();
            case 'ortho':
                at(n[1]).ObjRenderOrthog(n[2], n[3], n[4], n[5], n[6], n[7], n[8], n[9]);
                return scratch();
            case 'qs':
                return ` ${quicksort(n[1], n[2])}`;
            case 'unload':
                ModelLitImpl.unload();
                return '';
            default:
                throw new Error(`unknown op ${line}`);
        }
    };

    const got: string[] = [];
    let setup = false;
    for (const line of script) {
        if (!setup && line !== 'init') {
            // What the oracle does after printing the fresh statics: td.a(px, 320, 240), dc.d(), brightness 0.8 and
            // dc.b(0, 512) (the colour table without dc.a(F)'s random jitter), and the fake textures.
            Pix2D.setPixels(px, 320, 240);
            setBounds(Pix2D.clipMinX, Pix2D.clipMinY, Pix2D.clipMaxX, Pix2D.clipMaxY);
            pix3d['brightness'] = Math.fround(0.8);
            (pix3d['initColourTable'] as (a: number, b: number) => void).call(Pix3D, 0, 512);
            Pix3D.textureProvider = textures;
            setup = true;
        }
        const t = line.split(' ');
        const n = t.map((s, i) => (i === 0 ? 0 : Number.isInteger(Number(s)) ? Number(s) | 0 : 0));
        let result = 'ok';
        let extra = '';
        try {
            extra = run(line, t, n);
        } catch (e) {
            if (e instanceof Error && e.message.startsWith('unknown op')) throw e;
            result = code(e);
            // MODEL_LIT_TRACE=<line> prints the stack of the exception that line raised.
            if (process.env.MODEL_LIT_TRACE === String(got.length)) console.log(line, e instanceof Error ? e.stack : e);
        }
        got.push(
            result +
                extra +
                shows(t[0], n)
                    .map(s => ` | ${dump(lit[s])}`)
                    .join('')
        );
    }
    return got;
}

test('ModelLit and ModelLitImpl match nd and fc in client.jar: lighting, animation, transforms, copies and the three draws', () => {
    // Every static the fixture and the script read or write starts from its fresh-JVM value and is put back afterwards
    // (the anim suite, for one, ends with AnimFrame.unload()).
    const pixClinit = pix3dClinit();
    const resets: StaticReset[] = [
        { target: ModelLitImpl, clinit: modelLitImplClinit() },
        { target: ModelLit, clinit: modelLitClinit() },
        { target: Pix3D, clinit: pixClinit },
        PIX2D(),
        { target: ModelUnlit, clinit: modelUnlitClinit(pixClinit) },
        { target: AnimFrame, clinit: animFrameClinit() }
    ];
    const reached: Reached = { tween: 0, sharedNormals: 0, partMasked: 0, quicksortDraws: 0 };
    const { script, want, got } = withClinitStatics(resets, () => {
        const { data, sets, models, quads } = fixture();
        expect(sets.length).toBeGreaterThan(25);
        expect(sets.filter(s => s.special).length).toBe(7);
        expect(models.length).toBeGreaterThan(150);
        expect(models.filter(m => m.textured).length).toBeGreaterThan(10);
        expect(quads.length).toBe(4);
        const script = generateScript(sets, models, quads);
        const want = runOracle(data, script);
        return { script, want, got: runTs(script, reached) };
    });

    if (process.env.MODEL_LIT_DUMP) {
        writeFileSync(`${process.env.MODEL_LIT_DUMP}.script`, script.join('\n') + '\n');
        writeFileSync(`${process.env.MODEL_LIT_DUMP}.java`, want.join('\n') + '\n');
        writeFileSync(`${process.env.MODEL_LIT_DUMP}.ts`, got.join('\n') + '\n');
    }
    if (process.env.MODEL_LIT_STATS) {
        const byOp = new Map<string, Map<string, number>>();
        want.forEach((line, i) => {
            const op = script[i].split(' ')[0];
            const result = line.split(' ')[0];
            const counts = byOp.get(op) ?? new Map<string, number>();
            counts.set(result, (counts.get(result) ?? 0) + 1);
            byOp.set(op, counts);
        });
        console.log([...byOp].map(([op, counts]) => `${op}: ${[...counts].map(([r, c]) => `${r}=${c}`).join(' ')}`).join('\n'));
        const fb = new Set(want.filter(line => / fb=/.test(line)).map(line => / fb=(-?\d+)/.exec(line)?.[1]));
        console.log({ lines: want.length, distinctFramebuffers: fb.size, overflow: want.filter(line => / mb=[1-9]/.test(line)).length, picked: want.filter(line => / picked=[1-9]/.test(line)).length, reached });
    }

    expect(want.length).toBe(script.length);
    expect(got.length).toBe(want.length);
    const mismatches: string[] = [];
    for (let i = 0; i < want.length && mismatches.length < 5; i++) {
        if (got[i] !== want[i]) {
            const w = want[i];
            const g = got[i];
            let at = 0;
            while (at < w.length && w[at] === g[at]) at++;
            const from = Math.max(0, at - 200);
            mismatches.push(`#${i} ${script[i].slice(0, 300)}\n  first difference at ${at}\n  java: ...${w.slice(from, at + 300)}\n  ts:   ...${g.slice(from, at + 300)}`);
        }
    }
    expect(mismatches).toEqual([]);

    // The script reaches the success path and every exception these classes raise.
    const codes = new Set(want.map(line => line.split(' ')[0]));
    for (const c of ['ok', 'aioobe', 'npe', 'arith']) expect(codes.has(c), c).toBe(true);
    const ok = (op: string): string[] => want.filter((line, i) => script[i].startsWith(op + ' ') && line.startsWith('ok'));
    // Draws that changed the framebuffer, picks (both kinds), the depth-bucket overflow and the quicksort path.
    expect(new Set(ok('draw').map(line => / fb=(-?\d+)/.exec(line)?.[1])).size).toBeGreaterThan(400);
    expect(want.some(line => / picked=[1-9]/.test(line))).toBe(true);
    expect(want.some(line => / mb=[1-9]/.test(line))).toBe(true);
    expect(reached.quicksortDraws).toBeGreaterThan(20);
    expect(want.some(line => line.startsWith('ok new'))).toBe(true);
    expect(want.some(line => line.startsWith('ok same'))).toBe(true);
    // Tweened animation, lighting through shared normals and masked animation over part-masked vertices.
    expect(reached.tween).toBeGreaterThan(150);
    expect(reached.sharedNormals).toBeGreaterThan(20);
    expect(reached.partMasked).toBeGreaterThan(5);
    // Near-plane clipping (Render3ZClip's clip buffers) and the 512-entry extended bucket limit.
    expect(new Set(ok('draw').map(line => / Db=(\S+)/.exec(line)?.[1])).size).toBeGreaterThan(20);
    expect(want.some((line, i) => script[i].startsWith('draw 6 0 0 65536') && / mb=1 /.test(line))).toBe(true);
    // The single-pixel probes around the quads' extreme vertices land on both sides of the triangle edges.
    const probes = want.filter((_line, i) => / 400 72 0 0$/.test(script[i]));
    expect(probes.filter(line => / picked=0:/.test(line)).length).toBeGreaterThan(100);
    expect(probes.filter(line => / picked=1:/.test(line)).length).toBeGreaterThan(100);
    // The large model really exceeds the 4096-vertex scratch.
    expect(want.some((line, i) => script[i].startsWith('draw 6 0 16000') && line.startsWith('aioobe'))).toBe(true);
    // Both kinds of pick hit the centred model of the edge section (typecodes 77..80).
    for (const typecode of [77, 79, 80])
        expect(
            want.some((line, i) => script[i].split(' ').includes(String(typecode)) && / picked=[1-9]/.test(line)),
            `pick ${typecode}`
        ).toBe(true);
}, 600000);
