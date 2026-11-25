import { expect, mock, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Js5Compression from '../../src/cache/Js5Compression.js';
import type ModelSource from '../../src/dash3d/ModelSource.js';
import type ModelUnlitType from '../../src/dash3d/ModelUnlit.js';
import type PointNormal from '../../src/dash3d/PointNormal.js';
import type FaceNormal from '../../src/dash3d/FaceNormal.js';
import { readGroup } from '../cachefile.js';
import { cachePath, gamepackPath } from '../reference.js';

// cb (ModelUnlit), fa (PointNormal) and ha (FaceNormal) against client.jar. A script of operations runs through
// test/review/modelunlit/ModelUnlitOracle.java (reflection on the real cb) and through the TS port, and every
// result line must match: the result (ok or the Java exception), any return value, and a dump of every cb instance
// field of the touched models (arrays as length:hash over the signed elements, PointNormal/FaceNormal arrays hashed
// per element, the share statics after mergeNormals).
//
// Coverage: both decoders on a sample of every model in archive 7 (each model is decoded by cb(byte[]) and the
// ModelUnlit bytes constructor), bad data (null, 1- and 2-byte buffers); the copy constructor with all 16 share-flag
// combinations (followed by a transform of the copy and a dump of the source, which shows the aliasing); the merge
// constructor (with null entries and a count past the list); cb(III) with AddPoint/AddFace/AddPointFromModel including
// overflow; Resize, Translate, rotate, RotateYAxis/RotateXAxis/rotateZAxis, Rotate90/180/270, Mirror, Recolour,
// Retexture; CalculateNormals; CopyForShareLight; mergeNormals with itself, a neighbour offset by a tile, null and a
// model without normals; PrepareAnim and DiscardAnimLabels; CalcBoundingCube and getMinY; HillSkewCopy types 0..6
// with copy/drop flags, on the map, at its edges and outside it, with a missing second map, and type 2 on a model whose
// minY is 0; tiltToGround and interpolateHeight; and unload() followed by a rotation (NullPointerException).

// ModelUnlit.ts imports ModelLitImpl (fc) for Light/LightImpl, which this suite does not call. Until the lit unit lands
// that file does not exist, so a stub stands in for it; once it exists the real module is used.
const litPath = fileURLToPath(new URL('../../src/dash3d/ModelLitImpl.ts', import.meta.url));
if (!existsSync(litPath)) {
    mock.module('../../src/dash3d/ModelLitImpl.js', () => ({ default: class ModelLitImplStub {} }));
}

// [cb field, ModelUnlit property, kind] in cb's declaration order (the oracle's FIELDS).
const FIELDS: [string, string, string][] = [
    ['j', 'pointPartMask', 's'],
    ['k', 'maxX', 'n'],
    ['l', 'pointY', 'i'],
    ['m', 'pointX', 'i'],
    ['n', 'textureRotation', 'b'],
    ['o', 'vertexLabel', 'i'],
    ['p', 'faceColour', 's'],
    ['q', 'contrast', 'n'],
    ['r', 'faceTextureP', 's'],
    ['s', 'numPoints', 'n'],
    ['t', 'ambient', 'n'],
    ['u', 'faceNormal', 'ha'],
    ['v', 'faceAlpha', 'b'],
    ['w', 'maxZ', 'n'],
    ['x', 'facePartMask', 's'],
    ['y', 'numFaces', 'n'],
    ['z', 'minZ', 'n'],
    ['A', 'textureScaleZ', 's'],
    ['B', 'faceTextureN', 's'],
    ['C', 'faceVertexA', 'i'],
    ['E', 'textureType', 'b'],
    ['F', 'faceTextureM', 's'],
    ['H', 'faceMaterial', 's'],
    ['I', 'faceVertexC', 'i'],
    ['J', 'pointNormal', 'fa'],
    ['K', 'faceLabel', 'i'],
    ['L', 'faceTextureAxis', 'b'],
    ['M', 'labelVertices', 'ii'],
    ['N', 'faceVertexB', 'i'],
    ['O', 'minX', 'n'],
    ['P', 'textureTransV', 'b'],
    ['Q', 'boundsCalculated', 'z'],
    ['R', 'numT', 'n'],
    ['S', 'textureScaleY', 's'],
    ['T', 'pointZ', 'i'],
    ['U', 'faceRenderType', 'b'],
    ['W', 'maxY', 'n'],
    ['X', 'minY', 'n'],
    ['Z', 'textureTransU', 'b'],
    ['ab', 'textureSpeed', 'b'],
    ['bb', 'textureDirection', 'b'],
    ['db', 'facePriority', 'b'],
    ['eb', 'textureScaleX', 's'],
    ['fb', 'priority', 'n'],
    ['gb', 'labelFaces', 'ii'],
    ['hb', 'sharedPointNormal', 'fa']
];

function hashValues(values: ArrayLike<number>, signedBytes: boolean): number {
    let h = 1;
    for (let i = 0; i < values.length; i++) h = (Math.imul(h, 31) + (signedBytes ? (values[i] << 24) >> 24 : values[i])) | 0;
    return h;
}

function pointNormalHash(e: PointNormal): number {
    let h = 1;
    h = (Math.imul(h, 31) + e.x) | 0;
    h = (Math.imul(h, 31) + e.y) | 0;
    h = (Math.imul(h, 31) + e.z) | 0;
    h = (Math.imul(h, 31) + e.w) | 0;
    return h;
}

function faceNormalHash(e: FaceNormal): number {
    let h = 1;
    h = (Math.imul(h, 31) + e.x) | 0;
    h = (Math.imul(h, 31) + e.y) | 0;
    h = (Math.imul(h, 31) + e.z) | 0;
    return h;
}

function value(v: unknown, kind: string): string {
    if (v === null || v === undefined) return kind === 'n' || kind === 'z' ? String(v) : 'null';
    switch (kind) {
        case 'i':
        case 's':
            return `${(v as Int32Array).length}:${hashValues(v as Int32Array, false)}`;
        case 'b':
            return `${(v as Uint8Array).length}:${hashValues(v as Uint8Array, true)}`;
        case 'ii': {
            const rows = v as (Int32Array | null)[];
            let h = 1;
            for (const row of rows) h = (Math.imul(h, 31) + (row === null ? 0 : (Math.imul(31, row.length) + hashValues(row, false)) | 0)) | 0;
            return `${rows.length}:${h}`;
        }
        case 'fa': {
            const list = v as (PointNormal | null)[];
            let h = 1;
            for (const e of list) h = (Math.imul(h, 31) + (e === null ? 0 : pointNormalHash(e))) | 0;
            return `${list.length}:${h}`;
        }
        case 'ha': {
            const list = v as (FaceNormal | null)[];
            let h = 1;
            for (const e of list) h = (Math.imul(h, 31) + (e === null ? 0 : faceNormalHash(e))) | 0;
            return `${list.length}:${h}`;
        }
        case 'z':
            return v ? '1' : '0';
        default:
            return String(v);
    }
}

function dump(model: ModelUnlitType | null): string {
    if (model === null) return 'nullmodel';
    const fields = model as unknown as Record<string, unknown>;
    return FIELDS.map(([obf, name, kind]) => `${obf}=${value(fields[name], kind)}`).join(' ');
}

function code(e: unknown): string {
    if (e instanceof RangeError) {
        if (e.message.startsWith('array index') || e.message.startsWith('byte array index')) return 'aioobe';
        if (e.message === '/ by zero') return 'arith';
        if (e.message.startsWith('Invalid typed array length') || e.message.startsWith('Invalid array length') || e.message.startsWith('length cannot be negative') || e.message.startsWith('Requested length is negative')) return 'nase';
    }
    if (e instanceof TypeError) {
        if (e.message.startsWith('ClassCastException')) return 'cce';
        if (e.message === 'Null reference' || e.message === 'Null array' || e.message === 'Null byte array') return 'npe';
    }
    return `error:${String(e)}`;
}

function makeMaps(): (Int32Array | null)[][] {
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
    return [map0, map1, map2];
}

function runOracle(script: string[]): string[] {
    const source = fileURLToPath(new URL('./modelunlit/ModelUnlitOracle.java', import.meta.url));
    const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', gamepackPath, source], {
        stdin: Buffer.from(script.join('\n') + '\n'),
        timeout: 170000
    });
    if (java.exitCode !== 0) throw new Error(`ModelUnlitOracle exited ${java.exitCode}: ${java.stderr.toString()}`);
    const lines = java.stdout.toString().split(/\r?\n/);
    if (lines[lines.length - 1] === '') lines.pop();
    return lines;
}

test('ModelUnlit matches cb in client.jar: decoders, constructors, transforms, normals, labels and hill skew', async () => {
    const { default: ModelUnlit } = await import('../../src/dash3d/ModelUnlit.js');
    const statics = ModelUnlit as unknown as Record<string, unknown>;
    const saved = { shareMap: statics['shareMap'], shareMap2: statics['shareMap2'], shareTic: statics['shareTic'], sin: statics['sin'], cos: statics['cos'] };
    // A fresh JVM: new share maps, tic 0, and Pix3D's tables (other suites may have unloaded them).
    statics['shareMap'] = new Int32Array(10000);
    statics['shareMap2'] = new Int32Array(10000);
    statics['shareTic'] = 0;
    const sin = new Int32Array(2048);
    const cos = new Int32Array(2048);
    for (let i = 0; i < 2048; i++) {
        sin[i] = (65536.0 * Math.sin(i * 0.0030679615)) | 0;
        cos[i] = (65536.0 * Math.cos(i * 0.0030679615)) | 0;
    }
    statics['sin'] = sin;
    statics['cos'] = cos;

    let seed = 0x1234567;
    const rand = (n: number): number => {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        return ((seed >>> 0) % n) | 0;
    };

    const script: string[] = [];
    const hexOf = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');
    script.push('nullbytes 8', 'dec 8 00', 'dec 8 ffff', 'dec 8 ffffff', 'copy 8 -1 0 0 0 0', 'empty 9', 'miny 9', 'unlit 9', 'normals 9', 'prepare 9');
    script.push('interp 0 6000 6000', 'interp 0 -1 50', 'interp 0 13183 13183', 'interp 0 13184 0', 'interp 2 200 200', 'interp 2 255 1', 'interp 2 256 0');
    script.push('sizes 7 4 3 2', 'addpoint 7 1 2 3', 'addpoint 7 1 2 3', 'addpoint 7 -5 0 9', 'addface 7 0 1 0 1 -3 200', 'addface 7 1 0 1 0 32767 -1');
    script.push('addpoint 7 7 7 7', 'addpoint 7 8 8 8', 'addpoint 7 9 9 9', 'addface 7 0 1 2 0 5 5', 'addface 7 0 1 2 0 5 5', 'normals 7', 'prepare 7');
    script.push('sizes 9 -1 2 0', 'sizes 9 2 -1 0', 'sizes 9 0 0 3', 'bounds 9', 'miny 9');

    let ring = 0;
    let count = 0;
    let extended = 0;
    for (let id = 0; id < 45468; id += 29) {
        let bytes: Uint8Array;
        try {
            bytes = Js5Compression.Decompress(readGroup(cachePath, 7, id));
        } catch {
            continue;
        }
        if (bytes.length >= 2 && bytes[bytes.length - 1] === 255 && bytes[bytes.length - 2] === 255) extended++;
        script.push(`dec 0 ${hexOf(bytes)}`);
        let model: ModelUnlitType;
        try {
            model = new ModelUnlit(bytes);
        } catch {
            continue;
        }
        count++;
        if (count % 5 !== 0) continue;

        const k = count / 5;
        const colour = model.faceColour !== null && model.faceColour.length > 0 ? model.faceColour[rand(model.faceColour.length)] : 100;
        const material = model.faceMaterial !== null && model.faceMaterial.length > 0 ? model.faceMaterial[rand(model.faceMaterial.length)] : 1;
        const flags = (k % 16).toString(2).padStart(4, '0').split('').join(' ');
        script.push('unlit 0', 'miny 0', `copy 1 0 ${flags}`);
        script.push(`resize 1 ${96 + rand(64)} ${100 + rand(100)} ${64 + rand(128)}`, 'miny 0');
        script.push(`recolour 1 ${colour} ${rand(65536) - 32768}`, 'miny 0', `retexture 1 ${material} ${rand(200) - 1}`, 'miny 0');
        script.push(`rotate 1 ${rand(2048)} ${rand(2048)} ${rand(2048)}`, `rotate 1 0 ${rand(2048)} 0`, `roty 1 ${rand(2048)}`, `rotx 1 ${rand(2048)}`, `rotz 1 ${rand(2048)}`);
        script.push('rot90 1', 'rot180 1', 'rot270 1', 'mirror 1', `translate 1 ${rand(512) - 256} ${rand(512) - 256} ${rand(512) - 256}`, 'miny 0');
        script.push('share-normals 1 0 0 0 0 1', 'normals 1', 'normals 1', 'share 2 1', 'share-normals 1 2 0 0 0 1', 'share-normals 2 1 128 0 0 0', 'share-normals 2 0 0 0 0 1');
        script.push('copy 3 0 1 1 1 1', 'translate 3 128 0 0', 'normals 3', 'normals 0', 'share-normals 0 3 -128 0 0 1', 'share-normals 3 0 128 0 0 1');
        // HillSkewCopy: type, param, maps, position, copy, drop.
        const x = 1024 + rand(10000);
        const z = 1024 + rand(10000);
        for (const [type, param, a, b] of [
            [0, 0, 0, 1],
            [1, 0, 0, 1],
            [2, 340, 0, 1],
            [2, 0, 0, 1],
            [3, rand(65536), 0, 1],
            [4, 0, 0, 1],
            [4, 0, 0, -1],
            [5, 0, 0, 1],
            [5, 0, 0, -1],
            [6, 0, 0, 1],
            [1, 0, 2, 2],
            [5, 0, 2, 1]
        ]) {
            script.push('copy 3 0 1 1 1 1', `hill 4 3 ${type} ${param} ${a} ${b} ${x} ${rand(400) - 200} ${z} ${rand(2)} ${rand(2)}`);
        }
        script.push('copy 3 0 1 1 1 1', 'hill 4 3 1 0 0 1 64 0 64 1 1', 'hill 4 3 1 0 0 1 -200 0 300 1 1', 'hill 4 3 1 0 0 1 13300 0 6000 0 0', 'hill 4 3 1 0 1 0 13000 0 13000 1 0');
        script.push('copy 5 0 0 1 1 1', `tilt 5 0 ${x} ${rand(100)} ${z} ${rand(1024)} ${rand(1024)}`, 'tilt 5 2 300 0 300 64 64', 'bounds 5', 'miny 5');
        script.push('prepare 0', 'prepare 0', 'discard 0', 'bounds 0', 'miny 0');

        script.push(`dec ${10 + ring} ${hexOf(bytes)}`);
        ring = (ring + 1) % 3;
        if (k >= 3) {
            script.push('merge 6 3 10 11 12', 'merge 6 4 10 -1 11 12', 'merge 6 2 12 10', 'merge 6 4 10 11', 'merge 6 0');
            script.push('normals 6', 'prepare 6', 'miny 6', 'sizes 7 64 32 4', `addfrom 7 10 0 ${rand(65536) - 32768}`, 'addfrom 7 11 1 1', 'addfrom 7 11 1 1');
        }
    }
    script.push('copy 1 0 0 0 0 0', 'share-normals 1 0 0 0 0 1', 'share-normals 0 -1 0 0 0 1', 'unload', 'roty 0 5', 'normals 1', 'share-normals 1 1 0 0 0 1', 'unload');
    expect(count).toBeGreaterThan(1000);
    // Both decoders (LoadOb3Engine200 for the 0xFFFF-terminated format, LoadOb2Engine200 for the rest) are sampled.
    expect(extended).toBeGreaterThan(50);
    expect(count - extended).toBeGreaterThan(50);

    const want = runOracle(script);
    expect(want.length).toBe(script.length);
    // The script reaches the success path, both hill-skew outcomes and every exception the class can raise.
    const codes = new Set(want.map(line => line.split(' ')[0]));
    for (const c of ['ok', 'aioobe', 'npe', 'arith', 'nase']) expect(codes.has(c)).toBe(true);
    expect(want.some(line => line.startsWith('ok new'))).toBe(true);
    expect(want.some(line => line.startsWith('ok same'))).toBe(true);

    const maps = makeMaps();
    const map = (i: number): (Int32Array | null)[] | null => (i < 0 ? null : maps[i]);
    const slots: (ModelUnlitType | null)[] = new Array(16).fill(null);
    const at = (i: number): ModelUnlitType => {
        const m = slots[i];
        if (m === null) throw new Error(`script uses empty slot ${i}`);
        return m;
    };
    const priv = (i: number): Record<string, (...args: unknown[]) => unknown> => at(i) as unknown as Record<string, (...args: unknown[]) => unknown>;
    const shareStatics = (): string => `G=${value(statics['shareMap'], 'i')} V=${statics['shareTic']} Y=${value(statics['shareMap2'], 'i')}`;

    const got: string[] = [];
    try {
        for (const line of script) {
            const a = line.split(' ');
            const n = a.map((s, i) => (i === 0 || (a[0] === 'dec' && i === 2) ? 0 : Number(s)));
            let result = 'ok';
            let extra = '';
            let show: number[] = [];
            try {
                switch (a[0]) {
                    case 'dec':
                        slots[n[1]] = null;
                        show = [n[1]];
                        slots[n[1]] = new ModelUnlit(Uint8Array.from(Buffer.from(a[2], 'hex')));
                        break;
                    case 'nullbytes':
                        show = [n[1]];
                        slots[n[1]] = new ModelUnlit(null);
                        break;
                    case 'empty':
                        show = [n[1]];
                        slots[n[1]] = new ModelUnlit();
                        break;
                    case 'sizes':
                        show = [n[1]];
                        slots[n[1]] = new ModelUnlit(n[2], n[3], n[4]);
                        break;
                    case 'copy':
                        show = [n[1], n[2]];
                        slots[n[1]] = new ModelUnlit(n[2] < 0 ? null : at(n[2]), n[3] !== 0, n[4] !== 0, n[5] !== 0, n[6] !== 0);
                        break;
                    case 'merge':
                        show = [n[1]];
                        slots[n[1]] = new ModelUnlit(
                            n.slice(3).map(s => (s < 0 ? null : at(s))),
                            n[2]
                        );
                        break;
                    case 'share':
                        show = [n[1], n[2]];
                        slots[n[1]] = at(n[2]).CopyForShareLight();
                        break;
                    case 'resize':
                        show = [n[1]];
                        at(n[1]).Resize(n[2], n[3], n[4]);
                        break;
                    case 'translate':
                        show = [n[1]];
                        at(n[1]).Translate(n[2], n[3], n[4]);
                        break;
                    case 'rotate':
                        show = [n[1]];
                        at(n[1]).rotate(n[2], n[3], n[4]);
                        break;
                    case 'rot90':
                        show = [n[1]];
                        at(n[1]).Rotate90();
                        break;
                    case 'rot180':
                        show = [n[1]];
                        at(n[1]).Rotate180();
                        break;
                    case 'rot270':
                        show = [n[1]];
                        at(n[1]).Rotate270();
                        break;
                    case 'mirror':
                        show = [n[1]];
                        at(n[1]).Mirror();
                        break;
                    case 'roty':
                        show = [n[1]];
                        at(n[1]).RotateYAxis(n[2]);
                        break;
                    case 'rotx':
                        show = [n[1]];
                        priv(n[1])['RotateXAxis'].call(at(n[1]), n[2]);
                        break;
                    case 'rotz':
                        show = [n[1]];
                        priv(n[1])['rotateZAxis'].call(at(n[1]), n[2]);
                        break;
                    case 'recolour':
                        show = [n[1]];
                        at(n[1]).Recolour((n[2] << 16) >> 16, (n[3] << 16) >> 16);
                        break;
                    case 'retexture':
                        show = [n[1]];
                        at(n[1]).Retexture((n[2] << 16) >> 16, (n[3] << 16) >> 16);
                        break;
                    case 'normals':
                        show = [n[1]];
                        at(n[1]).CalculateNormals();
                        break;
                    case 'prepare':
                        show = [n[1]];
                        at(n[1]).PrepareAnim();
                        break;
                    case 'discard':
                        show = [n[1]];
                        at(n[1]).DiscardAnimLabels();
                        break;
                    case 'bounds':
                        show = [n[1]];
                        priv(n[1])['CalcBoundingCube'].call(at(n[1]));
                        break;
                    case 'miny':
                        show = [n[1]];
                        extra = ` ${at(n[1]).getMinY()}`;
                        break;
                    case 'unlit':
                        extra = ` ${at(n[1]).isUnlit()}`;
                        break;
                    case 'addpoint':
                        show = [n[1]];
                        extra = ` ${at(n[1]).AddPoint(n[2], n[3], n[4])}`;
                        break;
                    case 'addface':
                        show = [n[1]];
                        extra = ` ${at(n[1]).AddFace(n[2], n[3], n[4], (n[5] << 24) >> 24, (n[6] << 16) >> 16, (n[7] << 24) >> 24)}`;
                        break;
                    case 'addfrom':
                        show = [n[1]];
                        extra = ` ${priv(n[1])['AddPointFromModel'].call(at(n[1]), at(n[2]), n[3], (n[4] << 16) >> 16)}`;
                        break;
                    case 'hill': {
                        show = [n[1], n[2]];
                        const r = at(n[2]).HillSkewCopy(n[3], n[4], map(n[5]), map(n[6]), n[7], n[8], n[9], n[10] !== 0, n[11] !== 0);
                        extra = r === at(n[2]) ? ' same' : ' new';
                        slots[n[1]] = r;
                        break;
                    }
                    case 'tilt':
                        show = [n[1]];
                        priv(n[1])['tiltToGround'].call(at(n[1]), map(n[2]), n[3], n[4], n[5], n[6], n[7]);
                        break;
                    case 'interp':
                        extra = ` ${(statics['interpolateHeight'] as (m: (Int32Array | null)[] | null, x: number, z: number) => number).call(ModelUnlit, map(n[1]), n[2], n[3])}`;
                        break;
                    case 'share-normals': {
                        show = [n[1], n[2]];
                        const other = n[2] < 0 ? null : at(n[2]);
                        at(n[1]).mergeNormals(other as unknown as ModelSource, n[3], n[4], n[5], n[6] !== 0);
                        extra = ` ${shareStatics()}`;
                        break;
                    }
                    case 'unload':
                        ModelUnlit.unload();
                        extra = ` ${value(statics['sin'], 'i')} ${value(statics['cos'], 'i')}`;
                        break;
                    default:
                        throw new Error(`unknown op ${line}`);
                }
            } catch (e) {
                result = code(e);
            }
            got.push([result + extra, ...show.map(s => (s < 0 ? 'nullmodel' : dump(slots[s])))].join(' | '));
        }
    } finally {
        statics['shareMap'] = saved.shareMap;
        statics['shareMap2'] = saved.shareMap2;
        statics['shareTic'] = saved.shareTic;
        statics['sin'] = saved.sin;
        statics['cos'] = saved.cos;
    }

    const mismatches: string[] = [];
    for (let i = 0; i < script.length && mismatches.length < 5; i++) {
        if (got[i] !== want[i]) mismatches.push(`#${i} ${script[i].slice(0, 80)}\n  ts:   ${got[i]?.slice(0, 1500)}\n  java: ${want[i]?.slice(0, 1500)}`);
    }
    expect(mismatches).toEqual([]);
    expect(got.length).toBe(want.length);
}, 300000);
