import { expect } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import type Js5 from '#/cache/Js5.js';
import Client from '#/client/Client.js';
import GlFont from '#/gl/GlFont.js';
import GlRenderer from '#/gl/GlRenderer.js';
import NullGL from '#/gl/NullGL.js';
import { capsProfileFromJson } from '#/gl/CapsProfile.js';
import type PixfontGeneric from '#/graphics/PixfontGeneric.js';
import SoftwareFont from '#/graphics/SoftwareFont.js';
import WrappedException from '#/util/WrappedException.js';
import { localAssets } from '../cachefile.js';
import { loginFixture } from '../login-fixture.js';
import { cachePath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

const scenarios = [
    'complete',
    'null-sprites',
    'null-metrics',
    'null-gl',
    'p12-file1-missing',
    'p12-file1-supplied',
    'miss-s0.1',
    'miss-m0.1',
    'miss-s0.2',
    'miss-m0.2',
    'miss-s1.1',
    'miss-m1.1',
    'miss-s2.1',
    'miss-m2.1',
    'short-s0.1',
    'short-m0.1',
    'short-s0.2',
    'short-m0.2',
    'short-m1.1',
    'short-m2.1'
];
const slots = ['fontPlain11', 'p11Software', 'p12', 'fontBold12'] as const;
const javaSlots = ['j.x', 'vj.j', 'rh.h', 'wl.q'];

function glyphs(font: PixfontGeneric): string {
    const hash = createHash('sha256');
    const word = Buffer.alloc(4);
    function int(value: number) {
        word.writeInt32BE(value);
        hash.update(word);
    }
    function bytes(data: Uint8Array | null) {
        int(data?.length ?? -1);
        if (data) hash.update(data);
    }
    for (const name of ['lineHeight', 'paddingTop', 'paddingBottom']) int(Reflect.get(font, name));
    for (const name of ['glyphAdvances', 'glyphXOffsets', 'glyphYOffsets', 'glyphWidths', 'glyphHeights']) {
        const array: Int32Array | null = Reflect.get(font, name);
        int(array?.length ?? -1);
        if (array) for (const value of array) int(value);
    }
    bytes(Reflect.get(font, 'kerning'));
    if (font instanceof SoftwareFont) {
        const masks: (Uint8Array | null)[] = Reflect.get(font, 'glyphMasks');
        int(masks.length);
        for (const mask of masks) bytes(mask);
    }
    return hash.digest('hex');
}

function clientResults(groups: number[], contents: Uint8Array[][], profile: string): string[] {
    const rows: string[] = [];
    GlRenderer.gl = null;
    [Client.fontPlain11Id, Client.p12FullGroup, Client.fontBold12Id] = groups;
    for (const active of [false, true]) {
        GlRenderer.active = active;
        for (const scenario of scenarios) {
            GlRenderer.gl = scenario === 'null-gl' ? null : new NullGL(capsProfileFromJson(profile));
            const ids = new Map<PixfontGeneric, string>();
            const events: string[] = [];
            const counts = [new Int32Array(3), new Int32Array(3)];
            function archive(index: number): Js5 {
                return Object.assign(Object.create(null), {
                    GetFile(file: number, id: number) {
                        const group = groups.indexOf(id);
                        if (group < 0) throw new Error('unexpected archive read');
                        const read = (index === 0 ? 's' : 'm') + group + '.' + ++counts[index][group];
                        events.push(file === 0 ? read : read + '/' + file);
                        if (file !== 0) {
                            if (group !== 1 || file !== 1) throw new Error('p12 file selector');
                            // Supply b12's real bytes at the otherwise absent file to observe both GetFile arguments.
                            return scenario === 'p12-file1-supplied' ? contents[index][2].slice() : null;
                        }
                        if (scenario === 'miss-' + read) return null;
                        if (scenario === 'short-' + read) return new Uint8Array(1);
                        return contents[index][group].slice();
                    }
                });
            }
            for (const [index, name] of slots.entries()) {
                const old = new SoftwareFont(new Uint8Array(257));
                ids.set(old, 'old' + index);
                let font: PixfontGeneric | null = old;
                Object.defineProperty(Client, name, {
                    configurable: true,
                    get: () => font,
                    set(value) {
                        font = value;
                        events.push(javaSlots[index]);
                    }
                });
            }
            let result = 'ok';
            try {
                Client.loadFonts(scenario === 'null-sprites' ? null : archive(0), scenario === 'null-metrics' ? null : archive(1), scenario.startsWith('p12-file1') ? 1 : 0);
            } catch (error) {
                const cause = error instanceof WrappedException ? error.cause : error;
                if (cause instanceof RangeError) result = 'ArrayIndexOutOfBoundsException';
                else if (cause instanceof TypeError) result = cause.message.includes('ClassCastException') ? 'ClassCastException' : 'NullPointerException';
                else throw error;
            }
            const state = slots.map((name, index) => {
                const font = Client[name];
                if (font === null) return 'null';
                if (!ids.has(font)) {
                    const kind = font instanceof SoftwareFont ? 'dd' : font instanceof GlFont ? 'mb' : font.constructor.name;
                    ids.set(font, index + ':' + kind + ':' + glyphs(font));
                }
                return ids.get(font);
            });
            rows.push([active ? 'gl' : 'sd', scenario, result, events.join(','), state.join(',')].join('|'));
        }
    }
    return rows;
}

loginFixture(
    import.meta.url,
    'HD hn.a loads the cache fonts in both render modes and preserves partial stores',
    async () => {
        const directory = mkdtempSync(join(tmpdir(), 'rs530-window-fonts-'));
        try {
            const assets = localAssets(cachePath, [8, 13]);
            const groups = ['p11_full', 'p12_full', 'b12_full'].map(name => assets.groupId(8, name));
            for (const archive of [8, 13]) expect(assets.file(archive, groups[1], 1)).toBeUndefined();
            const contents = [8, 13].map(archive =>
                groups.map(id => {
                    const data = assets.file(archive, id);
                    if (!data) throw new Error('missing font group ' + archive + '/' + id);
                    writeFileSync(join(directory, id + (archive === 8 ? '.glyphs' : '.metrics')), data);
                    return data;
                })
            );
            const cp = [directory, hdGamepackPath, joglPath].join(delimiter);
            const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            const profile = join(import.meta.dir, 'rtx5070.json');
            const compile = Bun.spawnSync(['javac', asm, '-encoding', 'UTF-8', '-cp', cp, '-d', directory, join(import.meta.dir, 'GlRecorder.java'), join(import.meta.dir, 'WindowFontsOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const java = ['java', asm, '-Djava.awt.headless=true', '-Dgltrace.stacks=false', '-cp', cp, 'WindowFontsOracle'];
            const patch = Bun.spawnSync([...java, 'instrument', directory]);
            expect(patch.exitCode, patch.stderr.toString()).toBe(0);
            const run = Bun.spawnSync([...java, 'run', directory, profile, ...groups.map(String), ...scenarios]);
            expect(run.exitCode, run.stderr.toString()).toBe(0);
            const expected = run.stdout.toString().trimEnd().split(/\r?\n/);
            const actual = clientResults(groups, contents, readFileSync(profile, 'utf8'));
            expect(expected).toHaveLength(2 * scenarios.length);
            for (const [i, row] of expected.entries()) expect(actual[i], row.split('|').slice(0, 2).join('/')).toBe(row);
        } finally {
            rmSync(directory, { recursive: true, force: true });
        }
    },
    50000,
    'gl'
);
