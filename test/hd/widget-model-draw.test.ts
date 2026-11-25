import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import Pix3D from '#/dash3d/Pix3D.js';
import GlModel from '#/dash3d/GlModel.js';
import GlRaster from '#/gl/GlRaster.js';
import GlRenderer from '#/gl/GlRenderer.js';
import { glMethods, type GL } from '#/jogl/GL.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import Preferences from '#/ui/Preferences.js';
import WrappedException from '#/util/WrappedException.js';
import { loginFixture } from '../login-fixture.js';
import { cachePath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

type Case = [flags: number, input: number, brightness: number, fault: string];

// No model, or a GL fault before the lighting call. These isolate gn.a's initial perspective/orthographic setup.
const projection: Case[] = [
    [8, 3, 3, '-'],
    [8, 0, 3, 'glViewport'],
    [15, 0, 3, 'glOrtho'],
    [9, 0, 2, 'glLoadMatrixf'],
    [10, 0, 4, 'glRotatef'],
    [1, 0, 0, 'glDisableClientState']
];
const draws: Case[] = [];
for (let flags = 0; flags < 32; flags++) {
    for (const input of [0, 1, 2, 3]) draws.push([flags, input, (flags % 4) + 1, '-']);
}
for (const flags of [13, 31]) {
    for (const fault of ['glLightfv', 'glDepthMask', 'glClear', 'restoreClip', 'model', 'lightingBrightness', 'pendingDepthClear', 'consumeDepthClear', 'modelSine', 'modelCosine']) draws.push([flags, 0, 3, fault]);
    draws.push([flags, 4, 3, '-']);
}

function widget(slot: number, flags: number, input: number): IfType {
    return Object.assign(new IfType(), {
        id: 11 + slot,
        parentId: -1,
        type: 6,
        if3: Boolean(flags & 1),
        modelOrtho: Boolean(flags & 2),
        md: Boolean(flags & 4),
        Vc: slot === 0 ? -32765 : 32760,
        o: slot === 0 ? 31237 : -29999,
        x: 13 + slot,
        y: 17,
        width: 121,
        height: 97,
        modelWidth: 60,
        modelHeight: 103,
        modelOriginX: -11,
        modelOriginY: 12,
        modelZoom: 404,
        modelOffsetX: -18,
        modelOffsetY: 31,
        modelYAngle: 251,
        modelZAngle: 65,
        modelXAngle: slot === 0 && input === 2 ? 2048 : 314,
        modelType: 1,
        modelId: (slot === 0 && input === 1) || input === 3 ? -1 : 9,
        comparisonOps: input === 4 ? Int32Array.of(0) : null
    });
}

const bits = new DataView(new ArrayBuffer(8));
function format(type: string, value: unknown): string {
    if (type === '[F') return '[' + [...(value as Float32Array)].map(n => format('F', n)).join(',') + ']';
    if (type === 'F') {
        bits.setFloat32(0, value as number);
        return 'f' + bits.getUint32(0).toString(16);
    }
    if (type === 'D') {
        bits.setFloat64(0, value as number);
        return 'd' + bits.getBigUint64(0).toString(16);
    }
    return String(value);
}

async function compare(cases: Case[]): Promise<void> {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-hd-model-widget-'));
    const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
    const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
    try {
        const compile = Bun.spawnSync(['javac', asm, '-cp', cp, '-d', dir, join(import.meta.dir, 'GlRecorder.java'), join(import.meta.dir, 'HdWidgetModelOracle.java')]);
        expect(compile.exitCode, compile.stderr.toString()).toBe(0);
        const java = ['java', asm, '-Djava.awt.headless=true', '-cp', cp, 'HdWidgetModelOracle'];
        const instrument = Bun.spawnSync([...java, dir]);
        expect(instrument.exitCode, instrument.stderr.toString()).toBe(0);
        const original = Bun.spawnSync(java, { stdin: Buffer.from(cases.map(row => row.join(' ')).join('\n') + '\n'), maxBuffer: 4194304 });
        expect(original.exitCode, original.stderr.toString()).toBe(0);
        const rows = original.stdout.toString().trimEnd().split(/\r?\n/);
        expect(rows).toHaveLength(cases.length);
        if (cases === draws) {
            const commands = rows.join('\n');
            expect(commands).toContain('glClear(256)@true;glEnable(3089)@true;glScissor(7,62,174,150)@true');
            expect(commands).toContain('glDepthMask(false)@false;model(0,251,65,314,-18,362,261,-1)@false;glDepthMask(true)@false');
        }
        let events: string[] = [];
        let fault: string,
            scissorCalls = 0;
        let fields: string[] = [];
        const testFailure = new Error('GL or model call');
        function event(name: string, args: string[]) {
            events.push(name + '(' + args.join(',') + ')@' + Client.clearInterfaceModelDepth);
            if (name === 'glScissor') scissorCalls++;
            if (name === fault || (fault === 'restoreClip' && name === 'glScissor' && scissorCalls === 2)) throw testFailure;
        }
        const gl = new Map(glMethods.map(([name, desc]) => [name, desc.slice(1, desc.indexOf(')')).match(/\[?\w/g) ?? []]));
        GlRenderer.gl = new Proxy({} as GL, {
            get(_target, name: keyof GL) {
                return (...args: unknown[]) => {
                    const params = gl.get(name);
                    if (!params) throw new Error('Unknown GL signature for ' + name);
                    event(
                        name,
                        args.map((arg, i) => format(params[i], arg))
                    );
                };
            }
        });
        GlRenderer.active = true;
        GlRenderer.width = 291;
        GlRenderer.height = 217;
        Client.localPlayer = new ClientPlayer();
        InterfaceList.rectRedrawnLastFrame[0] = true;
        // H4 owns td.ObjRender. Its original empty-vertex instance returns immediately after our observed call.
        const model = Object.assign(Object.create(GlModel.prototype), {
            ObjRender(...args: (number | bigint)[]) {
                event('model', args.map(String));
            }
        });
        IfType.m_modelCache.Put(65545n, model);
        function recordField(label: string): void {
            // A GL observer also inspects the one-shot flag. Only the direct DrawLayer instruction is under test.
            if (!new Error().stack?.split('\n')[3]?.includes('DrawLayer ')) return;
            fields.push(label + '@' + events.length);
            if (label === fault) throw testFailure;
        }
        function instrumentField(owner: object, key: string, label: string, writeLabel?: string) {
            const descriptor = Object.getOwnPropertyDescriptor(owner, key);
            if (!descriptor) throw new Error('Missing widget model field ' + key);
            let value = descriptor.value;
            Object.defineProperty(owner, key, {
                configurable: true,
                get() {
                    recordField(label);
                    return value;
                },
                set(next: unknown) {
                    if (writeLabel) recordField(writeLabel);
                    value = next;
                }
            });
            return () => Object.defineProperty(owner, key, { ...descriptor, value });
        }
        const restores = [
            instrumentField(Preferences, 'brightness', 'lightingBrightness'),
            instrumentField(Client, 'clearInterfaceModelDepth', 'pendingDepthClear', 'consumeDepthClear'),
            instrumentField(Pix3D, 'sinTable', 'modelSine'),
            instrumentField(Pix3D, 'cosTable', 'modelCosine')
        ];
        try {
            for (const [index, row] of cases.entries()) {
                const [flags, input, brightness, nextFault] = row;
                fault = nextFault;
                Preferences.brightness = brightness;
                Preferences.highDetailLighting = Boolean(flags & 16);
                Client.clearInterfaceModelDepth = Boolean(flags & 8);
                events = [];
                fields = [];
                scissorCalls = 0;
                const components = [widget(0, flags, input), widget(1, flags ^ 7, input)];
                let result = 'ok';
                try {
                    Client.DrawLayer(11, components, -1, 155, 5, 0, 181, 9, 7);
                } catch (e) {
                    if (!(e instanceof WrappedException)) throw e;
                    if (e.cause === testFailure) result = 'IllegalStateException ' + e.context;
                    else if (e.cause instanceof RangeError) result = 'ArrayIndexOutOfBoundsException ' + e.context;
                    else if (input === 4 && e.cause instanceof TypeError) result = 'NullPointerException ' + e.context;
                    else throw e;
                }
                const clip = [GlRaster.clipMinX, GlRaster.clipMinY, Reflect.get(GlRaster, 'clipMaxX'), GlRaster.clipMaxY];
                const actual = [result, Client.clearInterfaceModelDepth, clip.join(','), events.join(';'), fields.join(';')];
                expect(actual.join('|'), row.join(' ')).toBe(rows[index]);
            }
        } finally {
            for (const restore of restores) restore();
        }
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

loginFixture(import.meta.url, 'HD widget projection and early failures match gn.a', () => compare(projection), 30000, 'gl');
loginFixture(import.meta.url, 'HD model widgets match gn.a GL calls, one-shot depth clear and model dispatch', () => compare(draws), 30000, 'gl');

test('original HD draws cache model 9 in two model widgets on cold and warm frames', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-hd-cached-widget-model-'));
    const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
    const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
    try {
        const files = ['GlRecorder', 'HdTitleFrameOracle', 'HdWidgetModelOracle', 'HdCachedWidgetModelOracle'];
        const compile = Bun.spawnSync(['javac', asm, '-cp', cp, '-d', dir, ...files.map(name => join(import.meta.dir, name + '.java'))]);
        expect(compile.exitCode, compile.stderr.toString()).toBe(0);
        const trace = join(dir, 'trace');
        const java = Bun.spawnSync(['java', asm, '--add-opens=java.base/java.lang=ALL-UNNAMED', '-Djava.awt.headless=true', '-cp', cp, 'HdCachedWidgetModelOracle', cachePath, trace, join(import.meta.dir, 'rtx5070.json')]);
        expect(java.exitCode, java.stderr.toString()).toBe(0);
        expect(java.stdout.toString().trim()).toBe('td [9]');
        const rows = readFileSync(join(trace, 'trace.tsv'), 'utf8')
            .split(/\r?\n/)
            .filter(line => /^\d+\.\d+\t/.test(line))
            .map(line => line.slice(line.indexOf('\t') + 1));
        const markers = ['0', '1', 'end'].map(frame => rows.indexOf('~mark\tcache-widget.' + frame));
        const digests = ['a09bc0269eaaf999eb4a3f843dc39433806dee76192d196a307ab1d5234c215a', '4025a6bc75d0d6c13e363fa5ef0795327e96cd781e1f650d05879f00925cdf35'];
        for (let frame = 0; frame < 2; frame++) {
            const commands = rows.slice(markers[frame] + 1, markers[frame + 1]);
            expect(commands).toHaveLength(frame === 0 ? 159 : 72);
            const draws = ['glDrawElements\t4\t204\t5125\to:0', 'glDrawElements\t4\t12\t5125\to:816'];
            expect(commands.filter(line => line.startsWith('glDrawElements\t'))).toEqual([...draws, ...draws]);
            expect(createHash('sha256').update(commands.join('\n')).digest('hex')).toBe(digests[frame]);
        }
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}, 30000);
