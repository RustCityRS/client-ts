import MinimapBuilder from '#/dash3d/MinimapBuilder.js';
import SuperPacket from '#/io/SuperPacket.js';
import { freshGame } from './actor-fixture.js';
import { loginFixture } from './login-fixture.js';
import ClientBuild from '#/client/ClientBuild.js';
import MouseTracking from '#/client/MouseTracking.js';
import Preferences from '#/ui/Preferences.js';
import { receivePacket } from './receive-packet.js';
import ObjType from '#/config/ObjType.js';
import InterfaceInputFixture from './interfaceInputFixture.js';
import Client from '#/client/Client.js';
import { expect } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import JagString from '#/datastruct/JagString.js';
import SafeTime from '#/io/SafeTime.js';
import PacketT from '#/io/PacketT.js';
import IfType from '#/ui/IfType.js';
import DelayedStateChange from '#/ui/DelayedStateChange.js';
import InterfaceList from '#/ui/InterfaceList.js';
import InterfaceSession from '#/ui/InterfaceSession.js';
import GameShell from '#/client/GameShell.js';
import InterfaceView from '#/ui/InterfaceView.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { localAssets } from './cachefile.js';
import { cachePath, gamepackPath } from './reference.js';

const packet = (op: number, encode: (p: PacketT) => void): string => {
    const p = new PacketT(64);
    encode(p);
    return op + '-' + Buffer.from(requireNonNull(p.m_data).subarray(0, p.m_pos)).toString('hex');
};

function describe(change: DelayedStateChange | null): string {
    return change === null ? '-' : [change.type(), change.id(), change.value, change.value2, change.value3].join(',');
}

function order(): string[] {
    const changes = DelayedStateChange;
    changes.clear();
    const a = changes.get(15, 7),
        b = changes.get(16, 7),
        ignored = changes.get(17, 1);
    const same = a === changes.get(15, 7);
    changes.clientHidden(15);
    changes.serverHidden(0, 15);
    changes.serverHidden(0, 16);
    changes.clientVarc(17);
    const first = [same, describe(changes.poll()), describe(changes.poll())].join(' ');
    a.secondaryKey = -(1n << 63n) | 1n;
    ignored.secondaryKey = 1n;
    const expired = [describe(changes.poll()), describe(changes.poll()), changes.get(15, 7) === a].join(' ');
    const negative = changes.get(-2, 13);
    const signed = [describe(negative), negative === changes.get(-2, 1)].join(' ');
    expect(b.id()).toBe(16);
    changes.clear();
    return [first, expired, signed];
}

function text(value: JagString | null): string {
    return value === null ? '-' : Buffer.from(requireNonNull(value.bytes).subarray(0, value.length)).toString('hex');
}

async function events(ui: InterfaceSession, app: Client): Promise<string[]> {
    const c = new IfType();
    c.id = 7;
    c.parentId = -1;
    c.if3 = c.hasHook = true;
    c.type = 3;
    c.width = 30;
    c.height = 40;
    c.x = 4;
    c.y = 5;
    const hooks = ['onTimer', 'onVarcTransmit', 'onVarcstrTransmit', 'onVarTransmit', 'onInvTransmit', 'onStatTransmit', 'onKey', 'onClick', 'onRelease', 'onHold', 'onMouseOver', 'onMouseRepeat', 'onMouseLeave', 'onClickRepeat'] as const;
    for (const [i, hook] of hooks.entries()) c[hook] = [i + 1];
    c.varcTriggers = c.varcstrTriggers = c.varTriggers = c.invTriggers = c.statTriggers = Int32Array.of(90);
    Client.varcChanges = Client.varcStrChangeCount = 0;
    Client.varpTransmitCount = Client.invTransmitCount = Client.changedStatCount = 0;
    for (const ring of [Client.updatedVarcs, Client.updatedVarcStrings, Client.varpUpdates, Client.changedInvs, Client.statUpdates]) requireNonNull(ring).fill(0);
    const rows: string[] = [];
    let traces: string[] = [];
    ui['runner'].run = e => {
        traces.push([requireNonNull(e.args)[0], e.mouseX, e.mouseY, e.keyCode, e.keyChar, e.mouseInput, e.component === c].join(':'));
    };
    InterfaceList.top = 0;
    requireNonNull(IfType.m_open)[0] = true;
    requireNonNull(IfType.m_list)[0] = Array.from({ length: 8 }, (_, i) => (i === 7 ? c : null));
    const nativeInput = new InterfaceInputFixture(ui, app);
    try {
        for (const [step, count] of [1, 32, 33, 2, 0].entries()) {
            for (let i = 0; i < count; i++) {
                const id = step === 3 ? 90 : 17;
                requireNonNull(Client.updatedVarcs)[Client.varcChanges++ & 31] = id;
                requireNonNull(Client.updatedVarcStrings)[Client.varcStrChangeCount++ & 31] = id;
                requireNonNull(Client.varpUpdates)[Client.varpTransmitCount++ & 31] = id;
                requireNonNull(Client.changedInvs)[Client.invTransmitCount++ & 31] = id;
                requireNonNull(Client.statUpdates)[Client.changedStatCount++ & 31] = id;
            }
            traces = [];
            await nativeInput.tick({ x: step < 2 ? 10 : 76, y: 12, held: step === 0, click: step === 0 ? { x: 9, y: 11 } : undefined, keys: [{ keyCode: 14, keyChar: 65 }] }, step + 1);
            rows.push([c.lastVarcTransmit, c.lastVarcStringTransmit, c.lastVarTransmit, c.lastInvTransmit, c.lastStatTransmit, traces.join(',')].join(' '));
        }
    } finally {
        nativeInput.restore();
    }
    return rows;
}

async function varcFaults(app: Client): Promise<string[]> {
    const text = JagString.fromInt(981);
    const changes = DelayedStateChange;
    const rows: string[] = [];
    const hash = (array: Int32Array | null) => (array === null ? 0 : array.reduce((h, v) => (Math.imul(h, 31) + v) | 0, 1));
    InterfaceList.top = -1;
    for (const type of [1, 2]) {
        for (const size of [-1, 0, 2])
            for (const length of [-1, 0, 1, 32]) {
                for (const index of [0, 1, 2])
                    for (const cursor of [-1, 0, 31, 2147483647]) {
                        changes.clear();
                        const ints = size < 0 ? null : new Int32Array(size);
                        const strings = size < 0 ? null : new Array<JagString | null>(size).fill(null);
                        const intRing = length < 0 ? null : new Int32Array(length);
                        const stringRing = length < 0 ? null : new Int32Array(length);
                        Object.assign(changes, { varcs: ints, varcStrings: strings });
                        Client.updatedVarcs = intRing;
                        Client.updatedVarcStrings = stringRing;
                        Client.varcChanges = Client.varcStrChangeCount = cursor;
                        const first = changes.get(index, type);
                        first['pushServer']();
                        first.value = 981;
                        first.text = text;
                        changes.get(8, 99)['pushServer']();
                        let status = 'ok';
                        try {
                            await app.GameLoop();
                        } catch (error) {
                            if (error instanceof TypeError) status = 'null';
                            else if (error instanceof RangeError) status = 'bounds';
                            else throw error;
                        }
                        rows.push([status, Client.varcChanges, Client.varcStrChangeCount, hash(ints), strings?.[index] === text, hash(intRing), hash(stringRing), describe(changes.poll())].join(' '));
                    }
            }
    }
    return rows;
}

loginFixture(
    import.meta.url,
    'the original rg messages and t.c bytecode agree on queue priority, delay, fields and redraws',
    async () => {
        const expected = order();
        const commands = [
            packet(69, p => {
                p.p2_alt3(2);
                p.p4(0x1243567);
                p.p2_alt2(15);
            }),
            packet(123, p => {
                p.p2_alt1(15);
                p.p2_alt2(3);
                p.p1(255);
                p.p1(0);
            }),
            packet(2, p => {
                p.p4_alt2(0);
                p.p2_alt2(4);
                p.p2_alt3(0x593f);
            }),
            packet(21, p => {
                p.p1(-1);
                p.p2(5);
                p.p4_alt1(0);
            }),
            packet(36, p => {
                p.p4_alt3(0);
                p.p2_alt1(-1);
                p.p2_alt2(6);
            }),
            packet(73, p => {
                p.p2_alt2(37);
                p.p4_alt1(0);
                p.p2_alt1(7);
            }),
            packet(119, p => {
                p.p2_alt2(8);
                p.p4_alt1(0);
                p.p2(-150);
                p.p2_alt2(300);
            }),
            packet(171, p => {
                p.p4_alt3(0);
                p.p1(255);
                p.p1(232);
                p.p1(0);
                p.p2_alt2(9);
            }),
            packet(220, p => {
                p.p4_alt3(0);
                p.p2_alt1(150);
                p.p2(10);
            }),
            'tick',
            packet(50, p => {
                p.p4(20);
                p.p4_alt3(0);
                p.p2_alt3(995);
                p.p2_alt1(11);
            }),
            'tick',
            packet(132, p => {
                p.p2(104);
                p.p2_alt2(12);
                p.p2_alt3(1000);
                p.p2_alt3(55);
                p.p4(0);
            }),
            packet(207, p => {
                p.p4_alt3(0);
                p.p2_alt2(13);
                p.p2(0xfffe);
                p.p2_alt2(3);
            }),
            'tick',
            packet(111, p => {
                p.p2_alt2(14);
                p.p4_alt3(0);
                p.p2_alt3(103);
                p.p2_alt1(101);
                p.p2_alt3(102);
            }),
            packet(65, p => {
                p.p2_alt1(15);
                p.p1(-217);
                p.p2_alt3(15);
            }),
            'tick',
            'client',
            packet(65, p => {
                p.p2_alt1(16);
                p.p1(-97);
                p.p2_alt3(15);
            }),
            packet(171, p => {
                p.p4_alt3(0);
                p.p1(65);
                p.p1(0);
                p.p2_alt2(17);
            }),
            'tick',
            'expire',
            'tick',
            'old',
            packet(50, p => {
                p.p4(11);
                p.p4_alt3(0);
                p.p2_alt3(995);
                p.p2_alt1(18);
            }),
            'tick',
            packet(50, p => {
                p.p4(0);
                p.p4_alt3(0);
                p.p2_alt3(65535);
                p.p2_alt1(19);
            }),
            'tick'
        ];
        const assets = localAssets(cachePath, [3]);
        const ui = new InterfaceSession(new InterfaceView([]), assets);
        const outbound = new SuperPacket(5000);
        outbound.SetEnc(new Int32Array(4));
        const game = freshGame({ outgoing: outbound, rebuild: null, account: null });
        const app = (Client.activeClient = new Client());
        app.game = game;
        app.ui = ui;
        ui.beginGame(game);
        Client.gameState = 30;
        Client.loopCycle = 1; // client.a increments the cycle before t.c.
        Client.mouseTracking = new MouseTracking();
        MinimapBuilder.minimapLevel = ClientBuild.buildLevel = Client.playerLevel;
        Client.lastSentFocus = GameShell.m_focus;
        Preferences.sent = true;
        const c = new IfType();
        c.if3 = true;
        c.id = 0;
        c.drawCycle = InterfaceList.cycle;
        c.rootIndex = 12;
        c.type = 0;
        c.baseWidth = 64;
        c.scrollHeight = 32;
        c.height = 98;
        c.modelFrame = c.modelNext = c.modelCycle = 8;
        const rows = requireNonNull(IfType.m_list),
            loaded = requireNonNull(IfType.m_open);
        rows[0] = [c];
        loaded[0] = true;
        const obj = new ObjType();
        obj.id = 995;
        obj.zoom2d = 1234;
        obj.xAngle2d = 11;
        obj.yAngle2d = 22;
        obj.zAngle2d = 33;
        obj.xOffset2d = -25;
        obj.yOffset2d = 37;
        ObjType.types.Put(995n, obj);
        const changes = DelayedStateChange;
        Client.varcChanges = Client.varcStrChangeCount = 0;
        const clock = SafeTime.CurrentTimeMillis;
        SafeTime.CurrentTimeMillis = () => 1000n;
        try {
            for (const command of commands) {
                if (command === 'tick') {
                    await app.GameLoop();
                    const values = [
                        c.itemId,
                        c.itemCount,
                        c.modelType,
                        c.modelId,
                        c.modelThirdKit,
                        c.modelXAngle,
                        c.modelYAngle,
                        c.modelZAngle,
                        c.modelZoom,
                        c.modelOffsetX,
                        c.modelOffsetY,
                        c.modelAnim,
                        c.modelFrame,
                        c.modelCycle,
                        c.modelNext,
                        c.colour,
                        +c.hidden,
                        c.baseX,
                        c.baseY,
                        c.x,
                        c.y,
                        c.xMode,
                        c.yMode,
                        c.scrollY,
                        c.modelRotationSpeed,
                        DelayedStateChange.varcs[15],
                        Client.varcChanges,
                        Client.varcStrChangeCount,
                        +InterfaceList.dirty[12],
                        Client.verifyId
                    ];
                    expected.push('[' + values.join(', ') + '] ' + text(c.textValue) + ' ' + text(DelayedStateChange.varcStrings[15]));
                    InterfaceList.dirty[12] = false;
                } else if (command === 'old') c.if3 = false;
                else if (command === 'client') {
                    changes.clientText(0);
                    changes.clientVarc(15);
                } else if (command === 'expire') {
                    for (let node = changes['delayed'].head(); node !== null; node = changes['delayed'].next()) node.secondaryKey = (node.secondaryKey & -(1n << 63n)) | 1n;
                } else {
                    const [op, body] = command.split('-');
                    expect(await receivePacket(Number(op), Buffer.from(body, 'hex'))).toBe(true);
                }
            }
        } finally {
            SafeTime.CurrentTimeMillis = clock;
            changes.clear();
            ObjType.types.Reset();
        }
        const windowWidth = GameShell.m_sWid,
            windowHeight = GameShell.m_sHei;
        try {
            GameShell.m_sWid = GameShell.m_sHei = 100;
            expected.push(...(await events(ui, app)));
            expected.push(...(await varcFaults(app)));
        } finally {
            GameShell.m_sWid = windowWidth;
            GameShell.m_sHei = windowHeight;
        }
        const out = resolve(import.meta.dir, '../out');
        mkdirSync(out, { recursive: true });
        const work = mkdtempSync(join(out, 'delayed-state-'));
        try {
            const exports = ['asm', 'asm.tree'].flatMap(name => ['--add-exports', 'java.base/jdk.internal.org.objectweb.' + name + '=ALL-UNNAMED']);
            const src = resolve(import.meta.dir, 'ui/DelayedChangeOracle.java');
            const compile = Bun.spawnSync(['javac', ...exports, '-cp', gamepackPath, '-d', work, src]);
            if (compile.exitCode) throw new Error(compile.stderr.toString());
            const oracle = Bun.spawnSync(['java', ...exports, '-Djava.awt.headless=true', '-cp', work + delimiter + gamepackPath, 'DelayedChangeOracle', ...commands]);
            if (oracle.exitCode) throw new Error(oracle.stderr.toString());
            expect(expected).toEqual(oracle.stdout.toString().trim().split(/\r?\n/));
        } finally {
            rmSync(work, { recursive: true, force: true });
        }
    },
    60000
);
