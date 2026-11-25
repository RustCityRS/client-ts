import { freshGame } from './actor-fixture.js';
import ScriptRunner from '#/script/ScriptRunner.js';
import { ClientScript } from '#/script/ClientScript.js';
import HookReq from '#/script/HookReq.js';
import { expect } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Client from '#/client/Client.js';
import ClientStream from '#/io/ClientStream.js';
import GameWorld from '#/io/GameWorld.js';
import PacketT from '#/io/PacketT.js';
import Protocol from '#/io/Protocol.js';
import SafeTime from '#/io/SafeTime.js';
import WorldList from '#/io/WorldList.js';
import DelayedStateChange from '#/ui/DelayedStateChange.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import InterfaceSession from '#/ui/InterfaceSession.js';
import InterfaceView from '#/ui/InterfaceView.js';
import Minimenu from '#/ui/Minimenu.js';
import SubInterface from '#/ui/SubInterface.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { localAssets, readGroup } from './cachefile.js';
import { loginFixture } from './login-fixture.js';
import { cachePath, gamepackPath } from './reference.js';
import { closeGameStream, installSocketHost, openWorldSocket, settleSignlink, socketHandle } from './socket-host.js';
import { DelayedSocket, program } from './world-list-script.js';

const a = 20,
    b = 21,
    base = 192000;
const key = a << 16;
const modes = ['load', 'null', 'change', 'stale', 'top', 'abort', 'script', 'open', 'close', 'move', 'modal'];

function frame(mode: string): [number, Uint8Array] {
    let op = -1;
    const buf = new PacketT(16);
    switch (mode) {
        case 'top':
            op = 145;
            buf.p2_alt3(a);
            buf.p1_alt1(0);
            buf.p2_alt3(40);
            break;
        case 'abort':
            op = 209;
            break;
        case 'script':
            op = 115;
            buf.p2(41);
            buf.p1(0);
            buf.p4(base);
            break;
        case 'open':
            op = 155;
            buf.p1(0);
            buf.p4_alt3(key);
            buf.p2_alt2(42);
            buf.p2(b);
            break;
        case 'close':
            op = 149;
            buf.p2(43);
            buf.p4(key);
            break;
        case 'move':
            op = 176;
            buf.p4_alt2(key);
            buf.p2_alt2(44);
            buf.p4_alt2(key + 1);
            break;
    }
    return [op, requireNonNull(buf.m_data).slice(0, buf.m_pos)];
}
function mount(id: number, group: number): void {
    const sub = new SubInterface();
    sub.group = group;
    InterfaceList.subInterfaces.put(sub, BigInt(id));
}
function prepare(mode: string) {
    DelayedStateChange.varcs.fill(0);
    InterfaceList.dirty.fill(false);
    Client.verifyId = 7;
    InterfaceList.top = a;
    Protocol.packetType = -1;
    Minimenu.count = 1;
    Minimenu.actions[0] = 1002;
    InterfaceList.subInterfaces.clear();
    const rows = requireNonNull(IfType.m_list),
        loaded = requireNonNull(IfType.m_open);
    loaded[a] = loaded[b] = true;
    const widget = (id: number, type: number) => {
        const c = new IfType();
        c.id = id;
        c.type = type;
        return c;
    };
    const root = widget(key, 0),
        child = widget(key, 3),
        sibling = widget(key + 1, 3),
        mounted = widget(b << 16, 3);
    child.childId = 0;
    root.childSlots = [child];
    InterfaceList.pressedContinue = sibling;
    rows[a] = [root, sibling];
    rows[b] = [mounted];
    root.onLoad = [base];
    sibling.onLoad = [base + 2];
    mounted.onLoad = [base + 3];
    child.onDialogAbort = [base];
    root.onDialogAbort = [base + 3];
    sibling.onDialogAbort = [base + 4];
    mounted.onDialogAbort = [base + 2];
    child.onSubChange = [base + 1];
    root.onSubChange = [base + 3];
    sibling.onSubChange = [base + 4];
    mounted.onSubChange = [base + 2];
    if (['change', 'move', 'close', 'modal'].includes(mode)) {
        mount(key, b);
        child.onSubChange = [base];
    }
    if (mode === 'stale') {
        root.onSubChange = [base];
        child.childId = 1;
    }
    if (mode === 'open') mounted.onLoad = [base];
    if (mode === 'null') rows[a][1] = null;
    return { rows, sibling, mounted };
}
function state(): string {
    return [
        DelayedStateChange.varcs[0],
        DelayedStateChange.varcs[1],
        InterfaceList.top,
        Client.verifyId,
        Protocol.packetType,
        InterfaceList.dirty.filter(Boolean).length,
        InterfaceList.pressedContinue !== null,
        InterfaceList.subInterfaces.get(BigInt(key))?.group ?? -1,
        InterfaceList.subInterfaces.get(BigInt(key + 1))?.group ?? -1,
        Buffer.from(requireNonNull(Client.out.m_data).subarray(0, Client.out.m_pos)).toString('hex')
    ].join('/');
}
loginFixture(
    import.meta.url,
    'gd and ri interface hooks stop inside the original world-list read before mount, refresh and packet completion',
    async () => {
        const cases = modes.map(frame);
        const dir = mkdtempSync(join(tmpdir(), 'rs530-interface-hooks-'));
        let expected: string[];
        try {
            const sources = ['game/WorldListOracle', 'game/WorldListBlockingOracle', 'ui/FloorConfigOracle', 'ui/SubInterfaceOracle', 'ui/InterfaceHookOracle'].map(file => fileURLToPath(new URL('./' + file + '.java', import.meta.url)));
            const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, ...sources]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const index = join(dir, 'index');
            writeFileSync(index, readGroup(cachePath, 255, 3));
            const args = cases.map(([op, data]) => op + '-' + Buffer.from(data).toString('hex'));
            const reference = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'InterfaceHookOracle', index, ...args], { timeout: 12000 });
            expect(reference.exitCode, reference.stderr.toString() + '\n' + reference.stdout.toString()).toBe(0);
            expected = reference.stdout.toString().trim().split(/\r?\n/);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
        const mark = (n: number) => `42:0 0:10 4002 0:${n} 4000 43:0`;
        const assets = localAssets(cachePath, [3, 12]);
        program(base, 0, 0, 0, 0, mark(7) + ' 6500 43:1 ' + mark(8) + ' 21');
        for (let n = 1; n < 10; n++) program(base + n, 0, 0, 0, 0, mark(n) + ' 21');
        program(base + 10, 0, 0, 0, 0, mark(5) + ' 3103 ' + mark(6) + ' 21');
        const reports: Error[] = [],
            actual: string[] = [];
        const ui = new InterfaceSession(new InterfaceView([]), assets, e => reports.push(e));
        const client = (Client.activeClient = new Client());
        client['ui'] = ui;
        client.game = freshGame({ outgoing: Client.out, rebuild: null, account: null });
        ui.beginGame(client.game);
        Client.gameState = 10;
        for (const [i, mode] of modes.entries()) {
            const { rows, sibling, mounted } = prepare(mode);
            Client.out.m_pos = 0;
            Client.out.SetEnc(Int32Array.of(0, 1, 5, 3));
            WorldList.fetchStep = 1;
            WorldList.fetchAttempts = 0;
            GameWorld.fetchStartTime = SafeTime.CurrentTimeMillis();
            WorldList.lastFetchTime = 0n;
            GameWorld.m_num = 0;
            GameWorld.worldListBuffer = null;
            const socket = new DelayedSocket(Uint8Array.of(0, 0, 2, 1, 0));
            installSocketHost(async () => socket);
            openWorldSocket();
            await settleSignlink();
            const [op, data] = cases[i];
            let pending: void | Promise<unknown>;
            if (mode === 'load' || mode === 'null') pending = ScriptRunner.OnLoad(a, ui.runner);
            else if (mode === 'change' || mode === 'stale') pending = Client.RunHookImmediate(a, 1, ui.runner);
            else if (mode === 'modal') {
                client.ui = undefined;
                const standalone = new ScriptRunner(
                    id => ClientScript.Get(id),
                    error => reports.push(error)
                );
                const event = new HookReq();
                event.args = [base + 10];
                pending = standalone.run(event);
            } else {
                const wire = new Uint8Array(data.length + 1);
                wire.set(data);
                Client.stream = new ClientStream(socketHandle(new DelayedSocket(wire)), null);
                Protocol.packetType = op;
                Protocol.packetSize = data.length;
                pending = Protocol.TcpIn();
            }
            expect(pending).toBeInstanceOf(Promise);
            await Promise.race([
                socket.entered.promise,
                Promise.resolve(pending).then(() => {
                    throw Error('no socket read in ' + mode);
                })
            ]);
            actual.push(mode + ' before ' + state());
            if (mode === 'load') {
                sibling.onLoad = [base + 9];
                rows[a] = [sibling];
            }
            if (mode === 'abort') mount(key, b);
            if (mode === 'change') {
                sibling.onSubChange = [base + 9];
                mounted.onSubChange = [base + 5];
            }
            socket.release.resolve();
            let failed = false;
            try {
                await pending;
            } catch (err) {
                if (mode !== 'null') throw err;
                failed = true;
            }
            actual.push(mode + ' after ' + failed + '/' + state());
            client.ui = ui;
            await closeGameStream();
        }
        expect(reports).toEqual([]);
        expect(actual).toEqual(expected);
    },
    25000
);
