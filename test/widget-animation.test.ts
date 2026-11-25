import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import SeqType from '#/config/SeqType.js';
import HashTable from '#/datastruct/HashTable.js';
import AreaSoundManager from '#/sound/AreaSoundManager.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import ServerActiveProperties from '#/ui/ServerActiveProperties.js';
import SubInterface from '#/ui/SubInterface.js';
import { gamepackPath } from './reference.js';

test('nested and dynamic widget animations, conditional loops, rotations and map destination match fk.a/g.a/th.a', () => {
    const dir = mkdtempSync(join(tmpdir(), 'widget-animation-530-')),
        base = 28000;
    const old = {
        loaded: IfType.m_open,
        groups: IfType.m_list,
        sub: InterfaceList.subInterfaces,
        cycle: InterfaceList.cycle,
        dirty: [...InterfaceList.dirty],
        qa: Client.qaOpTest,
        hover: InterfaceList.mouseOverComponent,
        elapsed: AreaSoundManager.elapsed,
        self: Client.localPlayer,
        destinationX: Client.destinationX,
        destinationZ: Client.destinationZ
    };
    const steps = Array.from({ length: 120 }, (_, n) => [n, n % 12 === 0 ? 80 : [0, 1, 2, 3, 5, 13, 17, -1, 9, 32][n % 10]]);
    for (let i = 0; i < 32; i++) steps.push([120 + i, [2, 5, -1, 2147483647][i >> 3]]);
    try {
        const build = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'ui/WidgetAnimationOracle.java')]);
        expect(build.stderr.toString()).toBe('');
        expect(build.exitCode).toBe(0);
        const oracle = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'WidgetAnimationOracle'], { stdin: Buffer.from(steps.map(row => row.join(' ')).join('\n') + '\n'), timeout: 8000 });
        expect(oracle.stderr.toString()).toBe('');
        expect(oracle.exitCode).toBe(0);
        const lines = oracle.stdout.toString().trimEnd().split(/\r?\n/);
        expect(lines.length).toBe(steps.length);
        const parent = [-1, 0, 0, 77, 0, 4, -1, 6],
            widgets = parent.map((parentId, i) => {
                const c = new IfType();
                c.parentId = parentId;
                c.id = i;
                c.type = [0, 2, 4, 6].includes(i) ? 0 : 6;
                c.drawCycle = 2;
                c.rootIndex = i;
                c.modelXAngle = 100 + i;
                c.modelYAngle = 200 + i;
                c.modelCycle = i - 3;
                return c;
            });
        IfType.m_open = [true, true];
        IfType.m_list = [
            [widgets[0], null, widgets[1], widgets[2], widgets[3]],
            [widgets[6], widgets[7]]
        ];
        widgets[0].childSlots = [widgets[4], widgets[5]];
        InterfaceList.subInterfaces = new HashTable(8);
        const sub = new SubInterface();
        sub.group = 1;
        InterfaceList.subInterfaces.put(sub, 2n);
        InterfaceList.cycle = 2;
        const self = (Client.localPlayer = new ClientPlayer());
        for (let i = 0; i < 4; i++) {
            const seq = new SeqType();
            seq.id = base + i;
            seq.delays = Int32Array.of(1 + i, 1, 3 + i);
            seq.frames = Int32Array.of(910, 911, 912);
            seq.m_loops = [0, 1, -1, 5][i];
            SeqType.m_recentUse.Put(BigInt(seq.id), seq);
        }
        for (const [n, elapsed] of steps) {
            if (n >= 120) {
                const mode = (n - 120) % 8;
                const c = new IfType(),
                    other = new IfType();
                Object.assign(c, { parentId: -1, type: 6, modelAnim: base + 4, activeAnim: -1, drawCycle: 2, rootIndex: mode === 6 ? 100 : 0, modelCycle: 2, modelFrame: mode === 4 ? -1 : 0, modelNext: 66, modelRotationSpeed: 0x8000ffff | 0 });
                Object.assign(other, { parentId: -1, type: 6, modelRotationSpeed: 0x004a0031, drawCycle: 2, rootIndex: 1 });
                IfType.m_list = [[c, other]];
                InterfaceList.dirty.fill(false);
                Client.qaOpTest = false;
                const seq = new SeqType();
                seq.id = base + 4;
                seq.m_loops = mode === 7 ? -2147483648 : 0;
                seq.frames = mode === 0 ? null : mode === 1 ? new Int32Array(0) : Int32Array.of(4, 8);
                seq.delays = mode === 2 ? null : mode === 3 ? new Int32Array(0) : mode === 5 ? Int32Array.of(3) : Int32Array.of(3, 5);
                SeqType.m_recentUse.Put(BigInt(seq.id), seq);
                AreaSoundManager.elapsed = elapsed;
                let status = 'ok';
                try {
                    Client.AnimateInterface(0);
                } catch (e) {
                    status = e instanceof TypeError ? 'null' : e instanceof RangeError ? 'bounds' : String(e);
                }
                expect([status, c.modelFrame, c.modelNext, c.modelCycle, c.modelXAngle, c.modelYAngle, other.modelXAngle, other.modelYAngle, InterfaceList.dirty[0], InterfaceList.dirty[1]].join(' '), 'step ' + n).toBe(lines[n]);
                continue;
            }
            AreaSoundManager.elapsed = elapsed;
            Client.qaOpTest = n % 5 === 0;
            InterfaceList.mouseOverComponent = widgets[(n % 3) * 2];
            InterfaceList.dirty.fill(false);
            widgets.forEach((c, i) => {
                c.if3 = (n + i) % 3 === 0;
                c.hidden = (n + 2 * i) % 7 === 0;
                c.properties = new ServerActiveProperties((n + i) % 2, -1);
                c.modelAnim = base + ((n + i) & 3);
                c.activeAnim = (i & 1) === 0 ? -1 : base + ((n ^ i) & 3);
                c.comparisonOps = (n + i) % 4 === 0 ? new Int32Array(0) : null;
                c.modelRotationSpeed = Math.imul(n + i, 0xf3130751);
                c.drawCycle = (i + n) % 9 === 0 ? 3 : 2;
                if (n % 12 === 0) c.modelCycle = 2147483647 - i;
                if (n % 12 === 1) c.modelCycle = 0;
            });
            Client.AnimateInterface(0);
            self.x = n * 59107;
            self.z = -n * 61;
            Client.destinationX = (self.x >> 7) + (n % 2);
            Client.destinationZ = (self.z >> 7) + (n % 3);
            Client.GdmCheckRemoveMapFlag();
            const out = widgets.map(c => [c.modelFrame, c.modelNext, c.modelCycle, c.modelXAngle, c.modelYAngle, InterfaceList.dirty[c.rootIndex]].join(','));
            expect([...out, [Client.destinationX, Client.destinationZ].join(',')].join('|'), 'step ' + n).toBe(lines[n]);
        }
    } finally {
        IfType.m_open = old.loaded;
        IfType.m_list = old.groups;
        InterfaceList.subInterfaces = old.sub;
        InterfaceList.cycle = old.cycle;
        InterfaceList.dirty.splice(0, 100, ...old.dirty);
        Client.qaOpTest = old.qa;
        InterfaceList.mouseOverComponent = old.hover;
        AreaSoundManager.elapsed = old.elapsed;
        Client.localPlayer = old.self;
        Client.destinationX = old.destinationX;
        Client.destinationZ = old.destinationZ;
        for (let i = 0; i < 5; i++) SeqType.m_recentUse.Remove(BigInt(base + i));
        rmSync(dir, { recursive: true, force: true });
    }
}, 15000);
