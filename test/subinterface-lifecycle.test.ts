import { expect } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import HashTable from '#/datastruct/HashTable.js';
import JagString, { fromLiteral } from '#/datastruct/JagString.js';
import SoftwareFont from '#/graphics/SoftwareFont.js';
import DelayedStateChange from '#/ui/DelayedStateChange.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import InterfaceSession from '#/ui/InterfaceSession.js';
import InterfaceView from '#/ui/InterfaceView.js';
import Minimenu from '#/ui/Minimenu.js';
import ServerActiveProperties from '#/ui/ServerActiveProperties.js';
import SubInterface from '#/ui/SubInterface.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { localAssets, readGroup } from './cachefile.js';
import { loginFixture } from './login-fixture.js';
import { cachePath, gamepackPath } from './reference.js';
import { program } from './world-list-script.js';

const a = 20,
    b = 21,
    id = a << 16,
    script = 193000;
const actions = [[1002], [1002, 46, 6, 1001, 57], [46, 46, 46, 46], [57, 57, 57, 57], [1001, 57, 1001, 57]];
function widget(id: number, type: number, root: number, marker: number): IfType {
    const c = new IfType();
    c.id = id;
    c.type = type;
    c.drawCycle = 23;
    c.rootIndex = root;
    c.modelFrame = 30 + root;
    c.modelCycle = 40 + root;
    c.modelNext = 50 + root;
    c.onSubChange = [script, marker];
    return c;
}
function digest(c: IfType): number {
    return c.modelNext * 10000 + c.modelFrame * 100 + c.modelCycle;
}
function text(s: JagString | null): string {
    return s === null ? '~' : Buffer.from(s.toBytes()).toString('hex');
}
loginFixture(
    import.meta.url,
    'subinterface open, close, frame reset and active-property purge retain the same partial writes on 400 original gamepack paths',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-subinterface-life-'));
        let expected: string[];
        try {
            const sources = ['SubInterfaceOracle', 'SubInterfaceLifecycleOracle'].map(name => fileURLToPath(new URL('./ui/' + name + '.java', import.meta.url)));
            const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, ...sources]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const index = join(dir, 'index');
            writeFileSync(index, readGroup(cachePath, 255, 3));
            const original = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'SubInterfaceLifecycleOracle', index], { timeout: 20000, maxBuffer: 8 * 1024 * 1024 });
            expect(original.exitCode, original.stderr.toString()).toBe(0);
            expected = original.stdout.toString().trim().split(/\r?\n/);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
        const assets = localAssets(cachePath, [3, 12]),
            archive = assets.archive(3),
            font = new SoftwareFont(new Uint8Array(257).fill(7));
        const ui = new InterfaceSession(new InterfaceView([]), assets);
        const rows = requireNonNull(IfType.m_list),
            loaded = requireNonNull(IfType.m_open),
            m = Minimenu,
            r = InterfaceList;
        program(script, 1, 0, 0, 0, '42:0 0:10 4002 33:0 4000 43:0 21');
        const keys = [BigInt(b) << 48n, (BigInt(b + 1) << 48n) - 1n, BigInt(a) << 48n, -1n];
        const names = Array.from({ length: 6 }, (_, i) => fromLiteral('Op' + i)),
            targets = names.map((_, i) => fromLiteral('<col=ff0000>Item' + i));
        for (let i = 0; i < 400; i++) {
            const mode = i % 5,
                fault = ((i / 5) | 0) % 16,
                parent = fault === 12 ? id + 2 : id;
            let group = fault === 8 ? rows.length : b;
            const host = widget(id, 0, 0, 2),
                pressed = widget(id + 1, 3, 1, 4),
                first = widget(b << 16, 2, 2, 6),
                last = widget((b << 16) + 1, 3, 3, 8);
            first.onLoad = [script, 1];
            last.onLoad = [script, 3];
            InterfaceList.pressedContinue = pressed;
            rows[a] = [host, pressed];
            rows[b] = [first, last];
            loaded[a] = loaded[b] = true;
            IfType.m_pInterfaces = archive;
            InterfaceList.top = a;
            r.cycle = 23;
            r.rootCount = 1;
            r.rootX[0] = r.rootY[0] = 0;
            r.rootWidth[0] = r.rootHeight[0] = 100;
            m.x = m.y = 4;
            m.width = 50;
            m.height = 80;
            GameShell.m_sWid = 765;
            GameShell.m_sHei = 503;
            r.dirty.fill(false);
            DelayedStateChange.varcs[0] = 0;
            InterfaceList.subInterfaces = new HashTable<SubInterface>(8);
            Client.serverActiveProperties = new HashTable<ServerActiveProperties>(8);
            for (const key of keys) Client.serverActiveProperties.put(new ServerActiveProperties(1, 2), key);
            const sub = new SubInterface();
            sub.group = group;
            sub.type = 1;
            if (mode === 1 || mode === 2) InterfaceList.subInterfaces.put(sub, BigInt(parent));
            const ops = actions[(i / 80) | 0];
            m.count = ops.length;
            m.isOpen = true;
            m.spriteStyle = (i & 1) !== 0;
            Client.fontBold12 = font;
            for (let j = 0; j < 500; j++) {
                m.option[j] = names[j % 6];
                m.target[j] = j % 2 === 0 ? JagString.empty : targets[j % 6];
                m.actions[j] = j < ops.length ? ops[j] : 57;
                m.paramB[j] = m.cursor[j] = j;
                m.paramC[j] = j + 11;
                m.keys[j] = BigInt(100 + j);
            }
            switch (fault) {
                case 1:
                    Client.fontBold12 = null;
                    break;
                case 2:
                    host.rootIndex = 100;
                    break;
                case 3:
                    pressed.rootIndex = 100;
                    break;
                case 4:
                    rows[b] = null;
                    break;
                case 5:
                    loaded[b] = false;
                    IfType.m_pInterfaces = null;
                    break;
                case 6:
                    rows[b][1] = null;
                    break;
                case 7:
                    InterfaceList.top = -1;
                    break;
                case 9:
                    m.target[0] = null;
                    break;
                case 10:
                    if (mode === 4) group = 65535;
                    break;
                case 11:
                    r.rootCount = 101;
                    break;
                case 13:
                    m.count = 501;
                    break;
                case 14:
                    first.type = last.type = 2;
                    break;
                case 15:
                    if (mode === 4) group = -1;
                    break;
            }
            let failed = false;
            try {
                if (mode === 0) await Client.OpenSubinterface(parent, group, 1, ui);
                else if (mode === 1 || mode === 2) await Client.CloseSubinterface(sub, mode === 2, ui);
                else if (mode === 3) Client.IfAnimReset(group);
                else Client.PurgeServerActive(group);
            } catch {
                failed = true;
            }
            const row = rows[b];
            const sample = [
                failed,
                InterfaceList.subInterfaces.get(BigInt(parent)) !== null,
                InterfaceList.pressedContinue !== null,
                loaded[b],
                row === null ? '~' : (row[0] !== null) + ',' + (row[1] !== null),
                digest(first) + ',' + digest(last),
                DelayedStateChange.varcs[0],
                '[' + r.dirty.slice(0, 4).join(', ') + ']',
                ...keys.map(key => Client.serverActiveProperties.get(key) !== null),
                [m.count, m.isOpen, m.width, m.height].join(',')
            ];
            for (let j = 0; j < 6; j++) sample.push([text(m.option[j]), text(m.target[j]), m.actions[j], m.cursor[j], m.paramB[j], m.paramC[j], m.keys[j]].join(','));
            expect(sample.join('/'), 'mode ' + mode + ' fault ' + fault + ' ops ' + ops.join(',')).toBe(expected[i]);
        }
    },
    30000
);
