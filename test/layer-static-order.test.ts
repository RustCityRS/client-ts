import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import Keyboard from '#/client/ClientKeyboardListener.js';
import Mouse from '#/client/ClientMouseListener.js';
import MouseWheel from '#/client/MouseWheel.js';
import CinematicCamera from '#/client/CinematicCamera.js';
import ComponentDrag from '#/ui/ComponentDrag.js';
import InterfaceList from '#/ui/InterfaceList.js';
import Minimenu from '#/ui/Minimenu.js';
import WorldMap from '#/ui/WorldMap.js';
import IfType from '#/ui/IfType.js';
import OrbitCamera from '#/client/OrbitCamera.js';
import GameShell from '#/client/GameShell.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import MinimapBuilder from '#/dash3d/MinimapBuilder.js';
import Pix3D from '#/dash3d/Pix3D.js';
import Pix2D from '#/graphics/Pix2D.js';
import LocalisedText from '#/ui/LocalisedText.js';
import SubInterface from '#/ui/SubInterface.js';
import JagString, { fromJsString } from '#/datastruct/JagString.js';
import QuickChatCatTypeList from '#/config/QuickChatCatTypeList.js';
import GlRaster from '#/gl/GlRaster.js';
import GlRenderer from '#/gl/GlRenderer.js';
import type PixfontGeneric from '#/graphics/PixfontGeneric.js';
import SharedPtrList from '#/datastruct/SharedPtrList.js';
import { gamepackPath } from './reference.js';
import { hdGamepackPath, joglPath } from './render/hd-reference.js';

const owners: Record<string, object> = { Client, Keyboard, Mouse, MouseWheel, CinematicCamera, ComponentDrag, InterfaceList, Minimenu, WorldMap, OrbitCamera, Pix3D, GameShell, LocalisedText, JagString, QuickChatCatTypeList, IfType, GlRenderer };
const symbols = join(import.meta.dir, 'ui/layer-fields.tsv');
const drawing = process.argv.includes('--draw');
const fields = readFileSync(symbols, 'utf8')
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map(row => row.split('\t'))
    .filter(cols => drawing || cols.length === 4);
const defaults = new Map(fields.filter(([owner]) => owner !== 'Widget').map(([owner, field]) => [owner + '.' + field, Reflect.get(owners[owner], field)]));
const source = readFileSync(join(import.meta.dir, '../src/client/Client.ts'), 'utf8').split(/\r?\n/);
const start = source.findIndex(line => line.startsWith(drawing ? '    static DrawLayer(' : '    static LoopLayer(')) + 1;
const end = source.slice(start).findIndex(line => /^ {4}(?:private |public )?static /.test(line)) + start;
const hints = process.env.RS530_LAYER_SITE_TRACES;
const base = [
    'Widget.parentId=-1',
    'Widget.if3=true',
    'Widget.type=3',
    'Widget.hasHook=true',
    'Widget.id=17',
    'Widget.x=2',
    'Widget.y=3',
    'Widget.width=50',
    'Widget.height=40',
    'Mouse.x=11',
    'Mouse.mouseY=12',
    'Mouse.clickX=13',
    'Mouse.clickY=14',
    'Mouse.mouseButton=0',
    'Mouse.clickButton=0',
    'ComponentDrag.component=null',
    'ComponentDrag.parent=null',
    'Keyboard.pressed=-',
    'MouseWheel.rotation=0',
    'Minimenu.objDragComponent=null',
    'Minimenu.isOpen=false',
    'WorldMap.dragging=0',
    'Client.m_hookQueue=new',
    'Client.mouseExit=new',
    'Client.timerEvents=new'
];
function scenarios(): string[] {
    const result: string[] = [];
    function add(...args: string[]) {
        result.push([...base, ...args].join(' '));
    }
    add('ComponentDrag.component=widget');
    add('ComponentDrag.parent=widget');
    add('Widget.type=0', 'Widget.noClickThrough=true', 'ComponentDrag.cycles=0');
    add('Widget.type=0', 'Widget.noClickThrough=true', 'ComponentDrag.cycles=3');
    for (const click of [0, 1]) for (const x of [11, 99]) add('Widget.clientCode=1338', 'Mouse.clickButton=' + click, 'Mouse.clickX=' + x);
    add('Widget.onScrollWheel=hook', 'MouseWheel.rotation=3');
    add('Widget.onClick=hook', 'Mouse.clickButton=1');
    add('Widget.clientCode=1400', 'WorldMap.dragging=1', 'Mouse.mouseButton=1', 'ComponentDrag.dragMouseX=11', 'ComponentDrag.dragMouseY=18', 'WorldMap.targetZoom=4');
    for (const dragging of [0, 1, 2])
        for (const button of [0, 1])
            add(
                'Widget.clientCode=1400',
                'WorldMap.dragging=' + dragging,
                'Mouse.mouseButton=' + button,
                'ComponentDrag.dragMouseX=16',
                'ComponentDrag.dragMouseY=15',
                'WorldMap.centerX=78',
                'WorldMap.centerZ=27',
                'WorldMap.targetZoom=4',
                'WorldMap.dragStartX=7',
                'WorldMap.dragStartZ=9'
            );
    for (const staff of [0, 2])
        add('Widget.clientCode=1400', 'Mouse.clickButton=1', 'Keyboard.pressed=82', 'Client.staffModLevel=' + staff, 'WorldMap.baseX=3020', 'WorldMap.baseZ=3254', 'WorldMap.zoom=4', 'WorldMap.height=101', 'WorldMap.centerX=17', 'WorldMap.centerZ=8');
    add('Widget.clientCode=1401', 'Mouse.mouseButton=1');
    for (const [hook, trigger, counter, ring] of [
        ['onVarcTransmit', 'varcTriggers', 'varcChanges', 'updatedVarcs'],
        ['onVarcstrTransmit', 'varcstrTriggers', 'varcStrChangeCount', 'updatedVarcStrings'],
        ['onVarTransmit', 'varTriggers', 'varpTransmitCount', 'varpUpdates'],
        ['onInvTransmit', 'invTriggers', 'invTransmitCount', 'changedInvs'],
        ['onStatTransmit', 'statTriggers', 'changedStatCount', 'statUpdates']
    ]) {
        for (const choice of ['null', '42', '6']) add('Widget.' + hook + '=hook', 'Widget.' + trigger + '=' + choice, 'Client.' + counter + '=3', 'Client.' + ring + '=7,42,9');
    }
    add('Widget.onKey=hook', 'Keyboard.count=2', 'Keyboard.codes=12,22', 'Keyboard.chars=23,33', 'CinematicCamera.justEnded=true');
    return result;
}
function drawScenarios(): string[] {
    const result: string[] = [];
    function add(...args: string[]) {
        result.push([...base, 'Widget.type=1', 'Minimenu.mouseX=10', 'Minimenu.mouseY=15', 'Client.rectDebug=0', ...args].join(' '));
    }
    add('draw.guard=31');
    add('draw.guard=32');
    add('ComponentDrag.component=widget');
    for (const delta of [-90, 0, 90]) {
        add(
            'ComponentDrag.component=widget',
            'Widget.dragRender=true',
            'ComponentDrag.started=true',
            'ComponentDrag.parentVisible=true',
            'ComponentDrag.parent=widget',
            'ComponentDrag.parentX=7',
            'ComponentDrag.parentY=11',
            'ComponentDrag.dragMouseX=' + delta,
            'ComponentDrag.dragMouseY=' + delta
        );
    }
    for (const code of [1337, 1406]) add('Widget.clientCode=' + code);
    for (const state of [0, 2, 3])
        for (const target of [false, true])
            add(
                'Widget.clientCode=1338',
                'Client.minimapState=' + state,
                'Widget.maskStarts=0,0,0',
                'Widget.maskWidths=2,2,2',
                'Client.localPlayer=new',
                'Minimenu.targetMode=' + target,
                'Minimenu.targetFlags=64',
                'Minimenu.targetChild=-1',
                'Minimenu.targetComponent=17'
            );
    for (const sub of [false, true]) add('Widget.type=0', 'Widget.noClickThrough=true', 'draw.sub=' + sub);
    for (const flag of [false, true]) add('Widget.clientCode=1405', 'Client.displayFps=' + flag);
    for (const type of [4, 5, 6, 8]) add('Widget.type=' + type, 'Client.rectDebug=2', 'Client.tooltipComponent=widget', 'Client.tooltipTimer=50', 'InterfaceList.tooltipDelay=50', 'Widget.textValue=word');
    add('Widget.clientCode=1405', 'Client.displayFps=true', 'draw.gpu=true');
    for (const id of [-1, 0, 1]) add('Widget.type=6', 'Widget.modelType=5', 'Widget.modelId=' + id, 'Client.localPid=1', 'Client.rectDebug=2', 'Client.designAppearanceInstance=null');
    add('Widget.type=5', 'Widget.if3=false', 'Client.rectDebug=2');
    return result;
}
function trace(row: string): string {
    const [limit, ...assignments] = row.split(' '),
        stop = Number(limit),
        events: string[] = [],
        writes: string[] = [];
    const widget = new IfType(),
        values = new Map(defaults),
        halt = Symbol();
    let active = false,
        guard = 119,
        sub = false;
    function observe(label: string, stack: string | undefined) {
        const frames = stack?.split('\n');
        const frame = frames?.[frames[2].includes('designAppearance ') ? 3 : 2]?.match(/(?:^|[\\/])Client\.ts:(\d+):/);
        if (!frame || Number(frame[1]) < start || Number(frame[1]) > end) return false;
        events.push(hints ? label + '@' + frame[1] : label);
        if (events.length === stop) throw halt;
        return true;
    }
    if (drawing) {
        GlRenderer.active = false;
        GlRaster.setClipping = () => {};
        Client.drawScene = () => {};
        MinimapBuilder.Draw = () => {};
        InterfaceList.GetComponent = () => widget;
        InterfaceList.DrawInterface = () => {};
        InterfaceList.subInterfaces.get = () => (sub ? new SubInterface() : null);
        Client.p12 = {
            drawRight() {},
            drawLeft() {},
            stringWidth() {
                return 4;
            },
            lineHeight: 0
        } as unknown as PixfontGeneric;
        values.set('Client.p12', Client.p12);
        Pix2D.fillRect = () => {};
        Pix2D.drawRect = () => {};
    }
    for (const [owner, field] of fields) {
        if (owner === 'Widget') continue;
        const key = owner + '.' + field;
        Object.defineProperty(owners[owner], field, {
            configurable: true,
            get() {
                if (active) observe(key, new Error().stack);
                return values.get(key);
            },
            set(value: unknown) {
                if (active && observe('set-' + key, new Error().stack)) writes.push(key + '=' + (value === null ? 'null' : value === widget ? 'widget' : typeof value === 'object' ? 'object' : String(value)));
                values.set(key, value);
            }
        });
    }
    for (const entry of assignments) {
        const [label, encoded] = entry.split('='),
            [owner, field] = label.split('.');
        if (label === 'draw.guard') {
            guard = Number(encoded);
            continue;
        }
        if (label === 'draw.gpu') {
            GlRenderer.active = process.env.RS530_GAMEPACK_IDENTITY === 'gl' && encoded === 'true';
            continue;
        }
        if (label === 'draw.sub') {
            sub = encoded === 'true';
            continue;
        }
        const object = owner === 'Widget' ? widget : owners[owner];
        let value: unknown = Number(encoded);
        if (encoded === 'new') value = label === 'Client.localPlayer' ? new ClientPlayer() : new SharedPtrList();
        else if (encoded === 'word') value = fromJsString('hello');
        else if (encoded === 'widget') value = widget;
        else if (encoded === 'null') value = null;
        else if (encoded === 'hook') value = [17];
        else if (['true', 'false'].includes(encoded)) value = encoded === 'true';
        else if (label === 'Keyboard.pressed') {
            const pressed = new Array(128).fill(false);
            if (encoded !== '-') pressed[Number(encoded)] = true;
            value = pressed;
        } else if (encoded.includes(',') || field.endsWith('Triggers') || field === 'varTriggers') value = Int32Array.from(encoded.split(',').map(Number));
        Reflect.set(object, field, value);
    }
    let outcome = 'ok';
    active = true;
    try {
        if (drawing) Client.DrawLayer(11, [widget], -1, 60, 0, 0, 80, 7, 0, guard);
        else {
            const value = Client.LoopLayer([widget], -1, 0, 0, 80, 60, 0, 0);
            if (value instanceof Promise) throw new Error('unexpected asynchronous widget');
        }
    } catch (error) {
        outcome = error === halt ? 'stop' : 'exception';
    }
    active = false;
    return events.join(',') + '|' + outcome + '|' + writes.join(',');
}
if (process.argv.includes('--trace')) {
    for (const row of readFileSync(0, 'utf8').trim().split(/\r?\n/)) console.log('result\t' + trace(row));
} else
    test('SD and HD interface walkers retain the native sequence of pointer, drag and transmit state changes', () => {
        function run(cmd: string[], input = '', identity = 'sd') {
            const result = Bun.spawnSync(cmd, { stdin: Buffer.from(input), env: { ...process.env, RS530_GAMEPACK_IDENTITY: identity } });
            if (result.exitCode !== 0) throw new Error(result.stderr.toString());
            return result.stdout
                .toString()
                .trim()
                .split(/\r?\n/)
                .filter(l => l.startsWith('result\t'))
                .map(l => l.slice(7));
        }
        const temp = mkdtempSync(join(tmpdir(), 'rs530-layer-fields-'));
        try {
            const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            run(['javac', asm, '-d', temp, join(import.meta.dir, 'ui/LayerStaticOracle.java')]);
            const failures: string[] = [];
            for (const [identity, pack] of [
                ['sd', gamepackPath],
                ['gl', hdGamepackPath]
            ])
                for (const mode of ['loop', 'draw']) {
                    const dir = join(temp, identity + '-' + mode);
                    mkdirSync(dir);
                    const java = ['java', asm, '-Drs530.siteHints=' + !!hints, '-cp', [dir, temp, pack, joglPath].join(delimiter), 'LayerStaticOracle', identity, symbols, mode];
                    run([...java, dir]);
                    const vectors = mode === 'draw' ? drawScenarios() : scenarios(),
                        baselines = run(java, vectors.map(s => '0 ' + s).join('\n'));
                    const cases: string[] = [];
                    for (const [i, s] of vectors.entries()) {
                        const n = baselines[i].split('|')[0].split(',').filter(Boolean).length;
                        for (let at = 0; at <= n; at++) cases.push(at + ' ' + s);
                    }
                    const expected = run(java, cases.join('\n')),
                        actual = run([process.execPath, import.meta.path, '--trace', ...(mode === 'draw' ? ['--draw'] : [])], cases.join('\n'), identity);
                    expect(expected.length).toBe(cases.length);
                    expect(actual.length).toBe(expected.length);
                    const evidence: { input: string; jar: string; ts: string }[] = [];
                    for (let i = 0; i < cases.length; i++) {
                        const j = expected[i].replace(/@\d+/g, ''),
                            t = actual[i].replace(/@\d+/g, '');
                        if (j !== t && (cases[i].startsWith('0 ') || failures.length === 0)) failures.push(identity + ' ' + cases[i].split('Widget.type=3').at(-1)?.slice(-75) + ' JVM=' + j + ' JS=' + t);
                        if (cases[i].startsWith('0 ')) evidence.push({ input: cases[i], jar: expected[i], ts: actual[i] });
                    }
                    if (hints) writeFileSync(join(hints, identity + '-' + mode + '.json'), JSON.stringify(evidence));
                }
            expect(failures).toEqual([]);
        } finally {
            rmSync(temp, { recursive: true, force: true });
        }
    }, 60000);
