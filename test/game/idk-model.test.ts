import { expect } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Js5 from '#/cache/Js5.js';
import IdkType from '#/config/IdkType.js';
import ModelUnlit from '#/dash3d/ModelUnlit.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { localAssets } from '../cachefile.js';
import { loginFixture } from '../login-fixture.js';
import { cachePath, gamepackPath } from '../reference.js';

// In cb declaration order. The provider may allocate different arrays for a single head and a single body.
const fields = [
    ['j', 'pointPartMask'],
    ['k', 'maxX'],
    ['l', 'pointY'],
    ['m', 'pointX'],
    ['n', 'textureRotation'],
    ['o', 'vertexLabel'],
    ['p', 'faceColour'],
    ['q', 'contrast'],
    ['r', 'faceTextureP'],
    ['s', 'numPoints'],
    ['t', 'ambient'],
    ['u', 'faceNormal'],
    ['v', 'faceAlpha'],
    ['w', 'maxZ'],
    ['x', 'facePartMask'],
    ['y', 'numFaces'],
    ['z', 'minZ'],
    ['A', 'textureScaleZ'],
    ['B', 'faceTextureN'],
    ['C', 'faceVertexA'],
    ['E', 'textureType'],
    ['F', 'faceTextureM'],
    ['H', 'faceMaterial'],
    ['I', 'faceVertexC'],
    ['J', 'pointNormal'],
    ['K', 'faceLabel'],
    ['L', 'faceTextureAxis'],
    ['M', 'labelVertices'],
    ['N', 'faceVertexB'],
    ['O', 'minX'],
    ['P', 'textureTransV'],
    ['Q', 'boundsCalculated'],
    ['R', 'numT'],
    ['S', 'textureScaleY'],
    ['T', 'pointZ'],
    ['U', 'faceRenderType'],
    ['W', 'maxY'],
    ['X', 'minY'],
    ['Z', 'textureTransU'],
    ['ab', 'textureSpeed'],
    ['bb', 'textureDirection'],
    ['db', 'facePriority'],
    ['eb', 'textureScaleX'],
    ['fb', 'priority'],
    ['gb', 'labelFaces'],
    ['hb', 'sharedPointNormal']
] as const;
function state(model: ModelUnlit | null): string {
    if (model === null) return 'null';
    return fields
        .map(([field, property]) => {
            const value = model[property];
            if (value === null) return field + '=~';
            if (typeof value === 'number' || typeof value === 'boolean') return field + '=' + value;
            if (!(value instanceof Int32Array || value instanceof Int16Array || value instanceof Uint8Array)) {
                throw Error('Unexpected allocated post-processing array ' + property);
            }
            const elements = value instanceof Uint8Array ? new Int8Array(value.buffer, value.byteOffset, value.length) : value;
            const digest = createHash('sha256')
                .update('[' + elements.join(', ') + ']')
                .digest('hex');
            return field + '=' + elements.length + ':' + digest;
        })
        .join(',');
}
type Values = number[] | null;
interface Row {
    head: boolean;
    id: number;
    heads: Values;
    bodies: Values;
    colourFrom: Values;
    colourTo: Values;
    textureFrom: Values;
    textureTo: Values;
    at: number;
    fault: number;
    replacement: Values;
}
function text(values: Values): string {
    return values === null ? '~' : values.join(',') || '_';
}
function command(r: Row): string {
    return [r.head ? 'H' : 'B', r.id, text(r.heads), text(r.bodies), text(r.colourFrom), text(r.colourTo), text(r.textureFrom), text(r.textureTo), r.at, r.fault, text(r.replacement)].join(' ');
}
const intArray = (v: Values) => (v === null ? null : Int32Array.from(v));
const shortArray = (v: Values) => (v === null ? null : Int16Array.from(v));

loginFixture(
    import.meta.url,
    'all 530 identity kit heads and bodies match fi.a and fi.c in model fields, fetch order and failure timing',
    async () => {
        const assets = localAssets(cachePath, [2, 7]);
        const real = assets.archive(7);
        const disk = requireNonNull(real['provider']);
        const ids = requireNonNull(requireNonNull(disk.index()).groupIds);
        let modelId = -1,
            colour = 0,
            material = -1;
        for (const id of ids) {
            const model = ModelUnlit.Load(real, id, 0);
            const t = model?.faceMaterial?.find(value => value !== -1);
            if (t !== undefined && model?.faceColour?.length) {
                modelId = id;
                material = t;
                colour = model.faceColour[0];
                break;
            }
        }
        expect(modelId).toBeGreaterThanOrEqual(0);
        const second = requireNonNull(ids.find(id => id !== modelId));
        const rows: Row[] = [];
        const defaults: Row = { head: false, id: -1, heads: [-1, -1, -1, -1, -1], bodies: null, colourFrom: null, colourTo: null, textureFrom: null, textureTo: null, at: 0, fault: 0, replacement: null };
        function both(changes: Partial<Row>): void {
            for (const head of [true, false]) rows.push({ ...defaults, ...changes, head });
        }
        for (let id = 0; id < IdkType.m_numDefinitions; id++) both({ id });
        for (const parts of [null, [], [-1], [modelId], [second], [-2], [65535], [2147483647], [-1, modelId, -1, second, modelId], [modelId, modelId, second, -1, -1], [modelId, second, modelId, second, modelId, second]]) {
            for (const at of [0, 1, 2, 3]) {
                const changes = { heads: parts, bodies: parts, at };
                if (at === 0) {
                    both(changes);
                    both({ ...changes, fault: 3 });
                } else for (const fault of [1, 2, 3]) both({ ...changes, fault });
            }
        }
        const full = [modelId, -1, second, modelId, -1];
        for (const parts of [[modelId], [], [modelId, second], [-1]]) {
            for (const maps of [
                { colourFrom: [], colourTo: null },
                { colourFrom: null, colourTo: [colour] },
                { textureFrom: [], textureTo: null },
                { textureFrom: null, textureTo: [material] },
                { colourFrom: [colour], colourTo: null },
                { colourFrom: [colour], colourTo: [] },
                { colourFrom: [colour, 17], colourTo: [17] },
                { textureFrom: [material], textureTo: null },
                { textureFrom: [material], textureTo: [] },
                { textureFrom: [material, 19], textureTo: [19] },
                { colourFrom: [colour, 17], colourTo: [17, -32768], textureFrom: [material, 19], textureTo: [19, 32767] },
                { colourFrom: [colour], colourTo: [], textureFrom: [material], textureTo: null }
            ]) {
                for (const fault of [0, 1, 6, 7]) both({ heads: full, bodies: parts, ...maps, at: 1, fault });
            }
        }
        for (const fault of [4, 5])
            for (const replacement of [null, [], [second], [modelId, second, second], full, [...full, modelId]]) {
                for (const at of [1, 2]) both({ heads: full, bodies: [modelId, second], at, fault, replacement });
            }

        const dir = mkdtempSync(join(tmpdir(), 'rs530-idk-models-'));
        let expected: string[];
        try {
            const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'idk-model-oracle.java'), join(import.meta.dir, '../review/model-mesh/ModelMeshOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const java = Bun.spawnSync(['java', '-cp', dir + delimiter + gamepackPath, 'IdkModelOracle', cachePath], { stdin: Buffer.from(rows.map(command).join('\n') + '\n'), maxBuffer: 32 * 1024 * 1024, timeout: 30000 });
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            expected = java.stdout.toString().trimEnd().split(/\r?\n/);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
        expect(expected.shift()).toBe(String(IdkType.m_numDefinitions));
        expect(expected.length).toBe(rows.length);

        let row: Row = defaults,
            kit = new IdkType(),
            fetches = 0;
        const reads: string[] = [];
        const models = new Js5(
            {
                group(mode, group) {
                    reads.push(fetches + ':' + mode + '/' + group);
                    if (reads.length === row.at) {
                        switch (row.fault) {
                            case 1:
                                return null;
                            case 2:
                                return Uint8Array.of(0, 0, 0, 0, 1, 37);
                            case 3:
                                IdkType.m_pModels = null;
                                break;
                            case 4:
                                Reflect.set(kit, 'headModels', intArray(row.replacement));
                                break;
                            case 5:
                                kit.models = intArray(row.replacement);
                                break;
                            case 6:
                                kit.recolourTo = null;
                                break;
                            case 7:
                                kit.retextureTo = null;
                                break;
                        }
                    }
                    return disk.group(mode, group);
                },
                index: () => disk.index(),
                prefetchGroup: group => disk.prefetchGroup(group),
                GetGroupLoadPercentage: group => disk.GetGroupLoadPercentage(group)
            },
            true,
            true
        );
        const fetch = models.GetFile.bind(models);
        models.GetFile = (file, group) => {
            fetches++;
            return fetch(file, group);
        };
        for (const [n, r] of rows.entries()) {
            row = r;
            kit = r.id < 0 ? new IdkType() : IdkType.List(r.id);
            if (r.id < 0) {
                Reflect.set(kit, 'headModels', intArray(r.heads));
                kit.models = intArray(r.bodies);
                kit.recolourFrom = shortArray(r.colourFrom);
                kit.recolourTo = shortArray(r.colourTo);
                kit.retextureFrom = shortArray(r.textureFrom);
                kit.retextureTo = shortArray(r.textureTo);
            }
            fetches = 0;
            reads.length = 0;
            IdkType.m_pModels = r.at === 0 && r.fault === 3 ? null : models;
            let model: ModelUnlit | null = null;
            let failure: string | null = null;
            try {
                model = r.head ? kit.GetHeadNoCheck() : kit.GetModelNoCheck();
            } catch (error) {
                if (error instanceof TypeError) failure = 'null-ref';
                else if (error instanceof RangeError) failure = 'bounds';
                else throw error;
            }
            expect(fetches + ';' + reads.join(',') + ';' + (failure ?? state(model)), command(row)).toBe(expected[n]);
        }
    },
    45000
);
