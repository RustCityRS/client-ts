import { expect } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Js5 from '#/cache/Js5.js';
import Js5Index from '#/cache/Js5Index.js';
import NpcType from '#/config/NpcType.js';
import ObjType from '#/config/ObjType.js';
import SeqType from '#/config/SeqType.js';
import ModelLitImpl from '#/dash3d/ModelLitImpl.js';
import Pix3D from '#/dash3d/Pix3D.js';
import PlayerModel from '#/dash3d/PlayerModel.js';
import LRUHashCache from '#/datastruct/LRUHashCache.js';
import Pix32 from '#/graphics/Pix32.js';
import SoftwareAlphaSprite from '#/graphics/SoftwareAlphaSprite.js';
import Crc32 from '#/io/Crc32.js';
import IfType from '#/ui/IfType.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { readGroup } from '../cachefile.js';
import { loginFixture } from '../login-fixture.js';
import { cachePath, gamepackPath } from '../reference.js';

type Row = [op: number, mode: string, id: number, flags: number, outline: number, shadow: number, modelType: number];
function cases(observe: boolean): Row[] {
    const rows: Row[] = [];
    if (observe) {
        for (const mode of ['cache-read', 'put-read']) for (const op of [1, 2, 3]) rows.push([op, mode, op === 3 ? 0 : 300, 0, 0, 0, 1]);
        for (const mode of ['start-read', 'width-read', 'replace-mask', 'old-width', 'cached-mask']) rows.push([0, mode, 300, 0, 0, 0, 0]);
        for (const mode of ['delegate', 'delegate-null', 'delegate-throw']) for (const type of [1, 2, 3, 4, 6, 7]) for (const flags of [0, 8, 16, 24]) rows.push([3, mode, 0, flags, 0, 0, type]);
        return rows;
    }
    for (const mode of ['normal', 'real', 'no-index', 'missing', 'corrupt', 'null-archive', 'null-cache', 'swap', 'drop-cache', 'drop-archive', 'replace-mask', 'set-flag', 'hit', 'poison']) {
        for (const op of [0, 1, 2, 3]) rows.push([op, mode, op === 3 ? 0 : 300, 0, 0, 0, 1]);
    }
    for (const mode of ['cached-mask', 'old-width']) rows.push([0, mode, 300, 0, 0, 0, 0]);
    for (const mode of ['null-slots', 'below-slot', 'above-slot']) rows.push([2, mode, 300, 0, 0, 0, 0]);
    rows.push([1, 'shared', 300, 0, 0, 0, 0], [0, 'real', 169, 8, 0, 0, 0]);
    for (let flags = 0; flags < 16; flags++)
        for (const outline of [-1, 0, 1, 2, 3])
            for (const shadow of [0, 0xabcdef, -1]) {
                rows.push([1, 'normal', 300, flags, outline, shadow, 0]);
            }
    for (const type of [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8]) {
        for (const flags of [0, 8, 16, 24]) for (const id of [-1, 0]) rows.push([3, 'real', id, flags, 0, 0, type]);
    }
    for (const id of [-1, -2, 0x7fffffff]) for (const op of [0, 1, 2, 3]) rows.push([op, 'missing', id, 0, 0, 0, 1]);
    return rows;
}

// One trimmed 4x3 indexed image in a 6x5 canvas. Its first row has two
// opaque runs, the second is empty, and its alpha channel contains 0/128/255.
function spriteGroup(): Uint8Array {
    const file = Uint8Array.of(2, 0, 1, 0, 2, 0, 0, 0, 0, 2, 1, 1, 0, 0, 128, 255, 255, 0, 0, 0, 0, 17, 255, 128, 0, 0x14, 0xd2, 0xa7, 0xf8, 0x10, 0x62, 0, 6, 0, 5, 2, 0, 1, 0, 1, 0, 4, 0, 3, 0, 1);
    const group = new Uint8Array(file.length + 5);
    group[4] = file.length;
    group.set(file, 5);
    return group;
}

loginFixture(
    import.meta.url,
    'four widget providers preserve JAR sprite and model caches, mask rows and resource fault timing',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-widget-providers-')),
            probes = join(dir, 'observe');
        try {
            mkdirSync(probes);
            const tables = new Map<number, Js5Index>(),
                raw = new Map<string, Uint8Array>();
            for (const [archive, group] of [
                [255, 7],
                [255, 8],
                [7, 0],
                [7, 1],
                [8, 300],
                [8, 169]
            ]) {
                const data = readGroup(cachePath, archive, group),
                    key = archive + '-' + group;
                writeFileSync(join(dir, key), data);
                raw.set(key, data);
                if (archive === 255) tables.set(group, new Js5Index(data, Crc32.prefix(data, data.length)));
            }
            const synthetic = spriteGroup();
            writeFileSync(join(dir, 'synthetic'), synthetic);
            function unexpectedTextureCall(): never {
                throw new Error('Unexpected texture sample while lighting widget model');
            }
            Pix3D.textureProvider = {
                isAvailable: () => true,
                getTextureSmall: unexpectedTextureCall,
                getPixels: unexpectedTextureCall,
                isLoaded: unexpectedTextureCall,
                getTextureData: unexpectedTextureCall,
                getTextureColour: unexpectedTextureCall,
                getTextureSolid: unexpectedTextureCall
            };
            const cp = dir + delimiter + gamepackPath,
                access = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
            const build = Bun.spawnSync(['javac', ...access, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'widget-providers/WidgetProvidersOracle.java')]);
            expect(build.exitCode, build.stderr.toString()).toBe(0);
            const instruments = Bun.spawnSync(['java', ...access, '-cp', cp, 'WidgetProvidersOracle', gamepackPath, probes]);
            expect(instruments.exitCode, instruments.stderr.toString()).toBe(0);
            const oldMask = Int32Array.of(-7, 4);
            const numbers = (array: Int32Array | null) => (array === null ? '~' : array.join(','));
            const describe = (array: Int32Array | null) => (array === oldMask ? 'old:' : '') + numbers(array);
            function run(row: Row, observe: boolean): string[] {
                const [op, mode, argument, flags, outline, shadow, type] = row,
                    active = (flags & 8) !== 0,
                    seed = (flags & 16) !== 0;
                const widget = new IfType(),
                    initial = new LRUHashCache<object>(10),
                    replacement = new LRUHashCache<object>(10);
                const identities = new Map<object, number>();
                const id = (value: object | null): number => {
                    if (value === null) return 0;
                    if (!identities.has(value)) identities.set(value, identities.size + 1);
                    return requireNonNull(identities.get(value));
                };
                widget.vFlip = (flags & 1) !== 0;
                widget.hFlip = (flags & 2) !== 0;
                widget.spriteAlpha = (flags & 4) !== 0;
                widget.spriteShadow = shadow;
                widget.outline = outline;
                widget.spriteId = active ? 169 : argument;
                widget.activeSprite = active ? argument : 169;
                widget.modelType = active ? 5 : type;
                widget.modelId = active ? 1 : argument;
                widget.activeModelType = active ? type : 5;
                widget.activeModel = active ? argument : 1;
                const delegated = mode.startsWith('delegate');
                if (delegated && type === 7) {
                    widget.modelId = 0x1234abcd;
                    widget.modelThirdKit = -37812;
                }
                widget.invSlotSprite = mode === 'null-slots' ? null : Int32Array.of(-1, argument);
                if (mode === 'cached-mask') widget.maskStarts = oldMask;
                if (mode === 'old-width') widget.maskWidths = oldMask;
                let key;
                if (op === 3) {
                    key = BigInt((argument + (type << 16)) | 0);
                } else if (op === 1) {
                    key = BigInt.asIntN(64, BigInt(argument) + (BigInt(shadow) << 40n) + (BigInt(outline) << 36n) + (BigInt(+widget.vFlip) << 38n) + (BigInt(+widget.hFlip) << 39n) + (BigInt(+widget.spriteAlpha) << 35n));
                } else {
                    key = BigInt(argument);
                }
                if (mode === 'hit' || mode === 'poison') initial.Put(key, mode === 'poison' ? {} : op === 3 ? new ModelLitImpl() : new Pix32(1, 2));
                const events: string[] = [];
                const sequence = new SeqType(),
                    player = new PlayerModel(),
                    npc = new NpcType(),
                    obj = new ObjType(),
                    model = new ModelLitImpl();
                const delegateFailure = new Error('model delegate');
                if (delegated) {
                    const call = (name: string, ...args: unknown[]) => {
                        events.push([name, ...args.map(v => (v === sequence ? 'seq' : v === player ? 'player' : v === npc ? 'npc' : v === obj ? 'obj' : v instanceof ModelLitImpl ? 'model' : String(v)))].join(','));
                        if (mode === 'delegate-throw') throw delegateFailure;
                        return mode === 'delegate-null' ? null : model;
                    };
                    NpcType.List = id => {
                        events.push('npc:' + id);
                        return npc;
                    };
                    ObjType.List = id => {
                        events.push('obj:' + id);
                        return obj;
                    };
                    npc.GetHeadModel = (...args) => call('head-n', npc, ...args);
                    npc.GetTempModel = (...args) => call('body', npc, ...args);
                    obj.GetModelLit = (...args) => call('obj-model', obj, ...args);
                    player.GetHeadModel = (...args) => call('head-p', player, ...args);
                    player.getKitHeadModel = (...args) => call('kit', player, ...args);
                    Reflect.set(sequence, 'AnimateModelWithExtra', (...args: unknown[]) => call('anim', sequence, ...args));
                }
                let inCall = false,
                    cacheReads = 0,
                    startReads = 0,
                    widthReads = 0;
                for (const field of ['m_spriteCache', 'm_modelCache'] as const) {
                    let value: LRUHashCache<object> | null = mode === 'null-cache' ? null : initial;
                    Object.defineProperty(IfType, field, {
                        configurable: true,
                        get() {
                            const captured = value;
                            if (observe && inCall) {
                                events.push('cache' + ++cacheReads);
                                if (mode === 'cache-read' && cacheReads === 1) {
                                    Reflect.set(IfType, 'm_modelCache', replacement);
                                    Reflect.set(IfType, 'm_spriteCache', replacement);
                                }
                                if (mode === 'put-read' && cacheReads === 2) {
                                    Reflect.set(IfType, 'm_modelCache', null);
                                    Reflect.set(IfType, 'm_spriteCache', null);
                                }
                            }
                            return captured;
                        },
                        set(next) {
                            value = next;
                        }
                    });
                }
                if (observe)
                    for (const field of ['maskStarts', 'maskWidths'] as const) {
                        let value = widget[field];
                        Object.defineProperty(widget, field, {
                            configurable: true,
                            get() {
                                const captured = value;
                                if (inCall && field === 'maskStarts') {
                                    events.push('start' + ++startReads);
                                    if (mode === 'start-read' && startReads === 2) value = new Int32Array(0);
                                }
                                if (inCall && field === 'maskWidths') {
                                    events.push('width' + ++widthReads);
                                    if (mode === 'width-read' && widthReads === 1) value = null;
                                }
                                return captured;
                            },
                            set(next) {
                                value = next;
                            }
                        });
                    }
                function event(tag: string): void {
                    events.push(tag + ':' + IfType.resourceMissing);
                    if (tag.startsWith('g'))
                        switch (mode) {
                            case 'swap':
                                Reflect.set(IfType, 'm_modelCache', replacement);
                                Reflect.set(IfType, 'm_spriteCache', replacement);
                                widget.spriteId = 169;
                                widget.modelId = 1;
                                widget.spriteShadow = 13579;
                                widget.vFlip = !widget.vFlip;
                                break;
                            case 'drop-cache':
                                Reflect.set(IfType, 'm_modelCache', null);
                                Reflect.set(IfType, 'm_spriteCache', null);
                                break;
                            case 'replace-mask':
                                widget.maskStarts = oldMask;
                                widget.maskWidths = oldMask;
                                break;
                            case 'set-flag':
                                IfType.resourceMissing = true;
                                break;
                        }
                    if (mode === 'drop-archive' && tag.startsWith('i')) IfType.m_pSprites = IfType.m_pModels = null;
                }
                function archive(arc: number): Js5 | null {
                    if (mode === 'null-archive') {
                        return null;
                    } else {
                        return new Js5(
                            {
                                index() {
                                    event('i' + arc);
                                    return mode === 'no-index' ? null : requireNonNull(tables.get(arc));
                                },
                                group(_mode, group) {
                                    event('g' + arc + '.' + group);
                                    if (mode === 'missing') return null;
                                    if (mode === 'corrupt') return Uint8Array.of(0, 0, 0, 0, 1, 0);
                                    if (arc === 8 && mode !== 'real') return synthetic;
                                    return requireNonNull(raw.get(arc + '-' + group));
                                },
                                prefetchGroup() {
                                    throw new Error('prefetch');
                                },
                                GetGroupLoadPercentage() {
                                    throw new Error('percentage');
                                }
                            },
                            true,
                            true
                        );
                    }
                }
                IfType.m_pSprites = archive(8);
                IfType.m_pModels = archive(7);
                IfType.resourceMissing = true;
                const lines: string[] = [];
                for (let repeat = 0; repeat < 2; repeat++) {
                    events.length = 0;
                    inCall = true;
                    let result: object | boolean | null = null,
                        fault = 'ok';
                    try {
                        if (op === 0) result = widget.GetMask();
                        if (op === 1) result = mode === 'shared' && repeat === 1 ? widget.GetInvBackground(1) : widget.GetGraphic(active);
                        if (op === 2) result = widget.GetInvBackground(mode === 'below-slot' ? -1 : mode === 'above-slot' ? 2 : 1);
                        if (op === 3) result = widget.GetTempModel(delegated ? player : null, 23, 7, active, 11, seed, delegated ? sequence : null);
                    } catch (e) {
                        if (e === delegateFailure) fault = 'probe';
                        else if (e instanceof TypeError) fault = e.message.includes('ClassCastException') ? 'cast' : 'null';
                        else if (e instanceof RangeError) fault = e.message.includes('Invalid typed array length') ? 'negative' : 'bounds';
                        else throw e;
                    } finally {
                        inCall = false;
                    }
                    let value = '~';
                    if (typeof result === 'boolean') value = String(result);
                    else if (result instanceof Pix32)
                        value = [result instanceof SoftwareAlphaSprite ? 'alpha' : 'rgb', id(result), result.xOffset, result.yOffset, result.cropW, result.cropH, result.width, result.height, numbers(result.pixels)].join(',');
                    else if (result instanceof ModelLitImpl) value = ['model', id(result), result.getMinY()].join(',');
                    else if (result !== null) value = 'wrong';
                    lines.push([fault, IfType.resourceMissing, value, describe(widget.maskStarts), describe(widget.maskWidths), id(initial.Find(key)), id(replacement.Find(key)), events.join(';')].join('/'));
                }
                return lines;
            }
            const mismatches: string[] = [];
            for (const observed of [false, true]) {
                const rows = cases(observed);
                const output = Bun.spawnSync(['java', '-Xmx384m', ...access, '-cp', observed ? probes + delimiter + cp : cp, 'WidgetProvidersOracle', dir], {
                    stdin: Buffer.from(rows.map(row => row.join(' ')).join('\n') + '\n'),
                    maxBuffer: 16 * 1024 * 1024
                });
                expect(output.exitCode, output.stderr.toString()).toBe(0);
                const lines = output.stdout.toString().trimEnd().split(/\r?\n/);
                expect(lines.length).toBe(rows.length * 2);
                if (!observed) {
                    const first = (op: number, mode: string) => lines[rows.findIndex(row => row[0] === op && row[1] === mode) * 2];
                    expect(first(0, 'real')).toBe('ok/true/true/1,0,0,0,1/2,4,4,4,2/0/0/i8:true;g8.300:true');
                    expect(first(1, 'missing')).toBe('ok/true/~/~/~/0/0/i8:false;g8.300:false');
                    expect(first(3, 'real')).toStartWith('ok/false/model,1,');
                    expect(first(1, 'poison')).toBe('cast/false/~/~/~/1/0/');
                }
                for (const [i, row] of rows.entries()) {
                    const values = run(row, observed);
                    for (let j = 0; j < 2; j++)
                        if (values[j] !== lines[i * 2 + j]) {
                            mismatches.push(row.join(' ') + ' #' + j + '\nJAR ' + lines[i * 2 + j] + '\n TS ' + values[j]);
                        }
                }
            }
            expect(mismatches).toEqual([]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    60000
);
