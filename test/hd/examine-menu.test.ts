import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { tmpdir } from 'node:os';
import Client from '#/client/Client.js';
import ClientMouseListener from '#/client/ClientMouseListener.js';
import ObjType from '#/config/ObjType.js';
import { fromJsString, toJsString } from '#/datastruct/JagString.js';
import ChatHistory from '#/game/ChatHistory.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import Minimenu from '#/ui/Minimenu.js';
import { JavaError } from '#/util/JavaException.js';
import WrappedException from '#/util/WrappedException.js';
import { loginFixture } from '../login-fixture.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

loginFixture(
    import.meta.url,
    'HD cancel and both examine actions retain raw classification, encrypted packets, chat and feedback writes',
    async () => {
        const testDir = mkdtempSync(join(tmpdir(), 'rs530-hd-examine-'));
        const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
        const cp = [testDir, hdGamepackPath, joglPath].join(delimiter);
        type Row = [action: number, widget: number, count: number, capacity: number, offset: number, selected: number, failure?: number];
        const rows: Row[] = [];
        for (const action of [1002, 1005, 1006, 3002, 3005, 3006]) {
            for (const selected of [0, 1]) for (const which of [0, 1, 2, 3]) for (const count of [99999, 100000, 1073741824]) rows.push([action, which, count, 7, 2, selected]);
            for (const capacity of [0, 1, 2, 3]) for (const start of [-1, 0, 1]) rows.push([action, 0, 99999, capacity, start, 1]);
        }
        rows.push([1006, 0, 99999, 7, 2, 0, 1], [1006, 0, 99999, 7, 2, 0, 2]);
        for (const failure of [3, 4, 5, 6]) rows.push([3005, 0, 99999, 7, 2, 1, failure]);
        try {
            const javac = Bun.spawnSync(['javac', asm, '-cp', cp, '-d', testDir, join(import.meta.dir, 'HdExamineMenuOracle.java')]);
            expect(javac.exitCode, javac.stderr.toString()).toBe(0);
            const java = ['java', asm, '-Djava.awt.headless=true', '-cp', cp, 'HdExamineMenuOracle'];
            const instrument = Bun.spawnSync([...java, testDir]);
            expect(instrument.exitCode, instrument.stderr.toString()).toBe(0);
            const original = Bun.spawnSync(java, { stdin: Buffer.from(rows.map(row => row.join(' ')).join('\n') + '\n') });
            expect(original.exitCode, original.stderr.toString()).toBe(0);
            const reference = original.stdout.toString().trimEnd().split(/\r?\n/);
            expect(reference).toHaveLength(rows.length);
            const widget = Object.assign(new IfType(), { id: 2, drawCycle: 19, rootIndex: 0 });
            const old = Object.assign(new IfType(), { drawCycle: 19, rootIndex: 1 });
            IfType.m_list = [[null, null, widget, null]];
            IfType.m_open = [true];
            InterfaceList.cycle = 19;
            const item = Object.assign(new ObjType(), { id: 0x95bc, name: fromJsString('Arrow') });
            ObjType.types.Put(0x95bcn, item);
            ClientMouseListener.clickX = -141;
            ClientMouseListener.clickY = 941;
            let writes: string[] = [];
            const fields = { crossMode: 'mode', crossX: 'x', crossY: 'y', crossTicks: 'crossTicks', highlightTicks: 'highlightTicks', highlightComponent: 'highlight', highlightSlot: 'slot', objSelected: 'selected' } as const;
            for (const [field, name] of Object.entries(fields)) {
                let value: unknown = Reflect.get(Minimenu, field);
                Object.defineProperty(Minimenu, field, {
                    configurable: true,
                    get: () => value,
                    set(next) {
                        value = next;
                        writes.push(name);
                    }
                });
            }
            const leave = Minimenu.EndTargetMode;
            const runtime = new Error('target leave'),
                fatal = new JavaError('target leave');
            for (const [i, row] of rows.entries()) {
                const [action, which, count, capacity, start, selected, failure = 0] = row;
                Minimenu.paramB[0] = which === 2 ? 3 : 1;
                Minimenu.paramC[0] = which === 1 ? 3 : 2;
                Reflect.set(Minimenu, 'actions', failure === 1 ? new Int16Array(0) : failure === 2 ? null : Int16Array.of(action));
                Reflect.set(Minimenu, 'keys', failure === 1 ? null : failure === 2 ? new BigInt64Array(0) : BigInt64Array.of(0x56781234000095bcn));
                widget.itemCounts = which === 3 ? null : Int32Array.of(2, count);
                Object.assign(Minimenu, { objComponent: 2, objSelected: selected, targetMode: failure >= 3, highlightComponent: old, highlightTicks: 9, highlightSlot: -52, crossMode: 3, crossTicks: 45, crossX: 57, crossY: 68 });
                if (failure < 3) {
                    Minimenu.EndTargetMode = leave;
                } else {
                    Minimenu.EndTargetMode = () => {
                        const error = (failure & 1) !== 0 ? runtime : fatal;
                        if (failure > 4) return Promise.reject(error);
                        throw error;
                    };
                }
                InterfaceList.dirty[0] = InterfaceList.dirty[1] = false;
                ChatHistory.count = 0;
                ChatHistory.text[0] = null;
                const packet = Client.out;
                packet.m_data = new Uint8Array(capacity).fill(0xa5);
                packet.m_pos = start;
                packet.SetEnc(Int32Array.of(1, 22, 4, 8));
                writes = [];
                let fault = '-',
                    context = '-';
                try {
                    const result = Client.DoAction(0);
                    if (failure > 4) expect(result).toBeInstanceOf(Promise);
                    await result;
                } catch (e) {
                    let cause: unknown = e;
                    if (cause instanceof WrappedException) {
                        context = String(cause.context);
                        cause = cause.cause;
                    }
                    if (cause === fatal) {
                        expect(e).toBe(fatal);
                        fault = 'Error';
                    } else if (cause === runtime) fault = 'IllegalStateException';
                    else if (cause instanceof TypeError) fault = 'null';
                    else if (cause instanceof RangeError) fault = 'bounds';
                    else throw e;
                }
                const pos = packet.m_pos,
                    bytes = Buffer.from(packet.m_data).toString('hex');
                packet.m_data = new Uint8Array(1);
                packet.m_pos = 0;
                packet.pHead(251);
                const packetState = [pos, bytes, packet.m_data[0]];
                const cross = [Minimenu.crossMode, Minimenu.crossTicks, Minimenu.crossX, Minimenu.crossY];
                const highlight = [Minimenu.highlightTicks, Minimenu.highlightComponent === widget ? 1 : Minimenu.highlightComponent === old ? 2 : 0, Minimenu.highlightSlot];
                const selection = [Minimenu.objSelected, InterfaceList.dirty[0], InterfaceList.dirty[1]];
                const chat = [ChatHistory.count, ChatHistory.text[0] === null ? '-' : toJsString(ChatHistory.text[0])];
                const actual = [String(Minimenu.IsInterfaceEntry(action)), fault, packetState.join(','), cross.join(','), highlight.join(','), selection.join(','), chat.join(','), writes.join(','), context];
                const expected = reference[i].split('|');
                expect(actual, row.join(' ')).toEqual(expected);
            }
        } finally {
            rmSync(testDir, { recursive: true, force: true });
        }
    },
    30000,
    'gl'
);
