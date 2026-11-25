import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { tmpdir } from 'node:os';
import { gamepackPath } from './reference.js';
import JagString, { fromJsString } from '#/datastruct/JagString.js';
import HashTable from '#/datastruct/HashTable.js';
import IntNode from '#/datastruct/IntNode.js';
import IfType from '#/ui/IfType.js';
import { ClientScript } from '#/script/ClientScript.js';
import HookReq from '#/script/HookReq.js';
import ScriptRunner from '#/script/ScriptRunner.js';
import { replaceText } from '#/util/ClientError.js';
import { mathRandom } from '#/util/JavaRandom.js';
import LocalisedText from '#/ui/LocalisedText.js';
import Client from '#/client/Client.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import PlayerModel from '#/dash3d/PlayerModel.js';
import SoftwareFont from '#/graphics/SoftwareFont.js';
import { requireNonNull } from '#/util/JavaArray.js';
import LRUHashCache from '#/datastruct/LRUHashCache.js';
import Preferences from '#/ui/Preferences.js';
import ChatHistory from '#/game/ChatHistory.js';

const asmExport = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';

function hash(values: ArrayLike<number> | null): number {
    if (values === null) return 0;
    let result = 1;
    for (let i = 0; i < values.length; i++) result = (Math.imul(result, 31) + values[i]) | 0;
    return result;
}

function strings(values: (JagString | null)[] | null): number {
    if (values === null) return 0;
    return hash(
        values.map(value => {
            if (value === null) return 0;
            const signed = value.bytes === null ? null : new Int8Array(value.bytes.buffer, value.bytes.byteOffset, value.bytes.length);
            return (Math.imul(hash(signed), 31) + value.length) | 0;
        })
    );
}

function frames(): number {
    let result = 1;
    for (const frame of ScriptRunner.frames) {
        result = Math.imul(result, 31);
        if (frame === null || frame.script === null) continue;
        const key = frame.script.key;
        result = (result + Number(BigInt.asIntN(32, key ^ (key >> 32n)))) | 0;
        result = (Math.imul(result, 31) + frame.pc) | 0;
        result = (Math.imul(result, 31) + hash(frame.ints)) | 0;
        result = (Math.imul(result, 31) + strings(frame.strings)) | 0;
    }
    return result;
}

function hex(value: JagString | null): string {
    return value === null ? '-' : Buffer.from(value.toBytes()).toString('hex');
}

function freshVM() {
    const oldPlayer = Client.localPlayer,
        archive = Client.fontMetricsArchive,
        fontCache = SoftwareFont.cache;
    const windowMode = Preferences.windowMode,
        modeWhere = Client.modeWhere;
    Client.modeWhere = 0;
    Client.localPlayer = new ClientPlayer();
    Client.fontMetricsArchive = null;
    SoftwareFont.cache = new LRUHashCache<SoftwareFont>(4);
    const seed = mathRandom['seed'],
        language = LocalisedText.language;
    const ints = ScriptRunner.intStack.slice(),
        texts = ScriptRunner.stringStack.slice(),
        lengths = ScriptRunner.lengths.slice();
    const arrays = ScriptRunner.arrays.map(array => array.slice()),
        frameTable = ScriptRunner.frames.slice();
    const oldInts = ScriptRunner.intLocals,
        oldStrings = ScriptRunner.stringLocals,
        count = ScriptRunner.frameCount;
    ScriptRunner.intStack.fill(0);
    ScriptRunner.stringStack.fill(null);
    ScriptRunner.frames.fill(null);
    ScriptRunner.lengths.fill(0);
    for (const array of ScriptRunner.arrays) array.fill(0);
    ScriptRunner.intLocals = ScriptRunner.stringLocals = null;
    ScriptRunner.frameCount = 0;
    return {
        [Symbol.dispose]() {
            Client.localPlayer = oldPlayer;
            Client.fontMetricsArchive = archive;
            SoftwareFont.cache = fontCache;
            Preferences.windowMode = windowMode;
            Client.modeWhere = modeWhere;
            mathRandom['seed'] = seed;
            LocalisedText.language = language;
            ScriptRunner.intStack.set(ints);
            ScriptRunner.stringStack.splice(0, texts.length, ...texts);
            ScriptRunner.frames.splice(0, frameTable.length, ...frameTable);
            ScriptRunner.lengths.set(lengths);
            arrays.forEach((array, i) => ScriptRunner.arrays[i].set(array));
            ScriptRunner.intLocals = oldInts;
            ScriptRunner.stringLocals = oldStrings;
            ScriptRunner.frameCount = count;
        }
    };
}

test('wf event substitution, gh script frames, stacks, arrays and error reports agree with the Java interpreter', () => {
    using _vm = freshVM();
    const programs = new Map<number, ClientScript>();
    const commands: string[] = [],
        labels: string[] = [],
        results: string[] = [];
    let report = '';
    const metrics = new Uint8Array(257).fill(4);
    metrics[32] = 2;
    metrics[256] = 10;
    SoftwareFont.cache.Put(16n, new SoftwareFont(metrics));
    const runner = new ScriptRunner(
        id => programs.get(id) ?? null,
        error => {
            report = error.message;
        }
    );
    commands.push('font');
    function define(id: number, instructions: [number, number | string][], locals = 0, args = 0, noOperands = false, named = true): void {
        const s = new ClientScript();
        s.key = BigInt(id);
        s.name = named ? fromJsString('script ' + id) : null;
        s.intLocals = s.stringLocals = locals;
        s.intArgs = s.stringArgs = args;
        s.opcodes = Int32Array.from(instructions, ([op]) => op);
        s.intOperands = noOperands ? null : Int32Array.from(instructions, ([, v]) => (typeof v === 'number' ? v : 0));
        s.stringOperands = instructions.map(([, v]) => (typeof v === 'number' ? null : fromJsString(v)));
        const table = new HashTable<IntNode>(1);
        table.put(new IntNode(2), 17n);
        s.switches = [table];
        programs.set(id, s);
        commands.push(['def', id, hex(s.name), locals, locals, args, args, s.opcodes.join(','), s.intOperands?.join(',') ?? '-', s.stringOperands.map(hex).join(',')].join('\t'));
    }
    function run(id: number, limit = 1000, args: (number | JagString | null)[] = [], event = new HookReq()): void {
        event.args = [id, ...args];
        const command = [
            'run',
            id,
            limit,
            event.mouseX,
            event.mouseY,
            event.opIndex,
            event.component?.id ?? '-',
            event.component?.childId ?? '-',
            event.dragTarget?.id ?? '-',
            event.dragTarget?.childId ?? '-',
            event.keyCode,
            event.keyChar,
            hex(event.opBase),
            ...args.map(arg => (typeof arg === 'number' ? 'i' + arg : 's' + hex(arg)))
        ].join('\t');
        commands.push(command);
        labels.push(command);
        report = '';
        let threw = false;
        try {
            runner.ExecuteScript(event, limit);
        } catch {
            threw = true;
        }
        const locals = ScriptRunner.stringLocals;
        results.push(
            [
                threw,
                ScriptRunner.frameCount,
                hash(ScriptRunner.intLocals),
                strings(locals),
                hash(ScriptRunner.intStack),
                strings(ScriptRunner.stringStack),
                hash(ScriptRunner.lengths),
                hash(ScriptRunner.arrays.map(hash)),
                frames(),
                locals !== null && locals.length > 0 && locals[0] === event.opBase,
                Buffer.from(replaceText('\n', '%0a', report)).toString('hex')
            ].join('/')
        );
    }
    const end: [number, number] = [21, 0];
    define(1, [end], 12, 0, true);
    const tokens = Array.from({ length: 9 }, (_, i) => -2147483647 + i);
    const args = [fromJsString('event_opbase'), ...tokens, 981, null, fromJsString('literal')];
    run(1, 100, args);
    const event = new HookReq();
    event.component = new IfType();
    event.dragTarget = new IfType();
    event.component.id = 915;
    event.component.childId = 43;
    event.dragTarget.id = 1881;
    event.dragTarget.childId = 8;
    event.keyCode = 88;
    event.keyChar = 171;
    event.mouseX = 123;
    event.mouseY = -61;
    event.opIndex = 6;
    event.opBase = fromJsString('Operate');
    run(1, 100, args, event);
    [event.mouseX, event.mouseY, event.component.id, event.opIndex, event.component.childId, event.dragTarget.id, event.dragTarget.childId, event.keyCode] = tokens.slice(1);
    run(1, 100, args, event);
    run(1, 100, Array(13).fill(19), event);
    run(1, 100, Array(13).fill(fromJsString('event_opbase')), event);
    define(2, [[3, 'base'], end], 0, 0, true);
    run(2);
    define(3, [[0, 2], [44, 65536 + 105], [0, 0], [0, 88], [46, 1], [0, 0], [45, 1], end]);
    run(3);
    define(4, [[0, 1], [45, 1], end]);
    run(4);
    define(5, [[0, 3], [44, 0], [0, 0], [45, 0], end]);
    run(5);
    define(6, [[38, 0], [39, 0], end], 0, 0, true);
    run(6);
    define(7, [[0, 113], [3, 'one'], [0, 17], [3, 'two'], [40, 8], end]);
    define(8, [[33, 0], [35, 0], [33, 1], [35, 1], [37, 2], [36, 1], [51, 0], [0, 999], [38, 0], end], 2, 2);
    run(7);
    define(9, [[40, 8], end]);
    run(9);
    define(10, [[40, 10], end]);
    run(10, 10000);
    define(11, [[6, -1]]);
    run(11, 2);
    run(11, 0);
    define(12, [[40, 9999], end]);
    run(12);
    define(13, [[40, 12], end], 0, 0, false, false);
    run(13);
    define(14, [[3, 'A'], [3, 'B'], [37, 2], [36, 0], [35, 0], end], 1);
    run(14);
    let next = 15;
    for (const op of [7, 8, 9, 10, 31, 32]) {
        for (const [a, b] of [
            [1, 2],
            [2, 1],
            [-1, -1],
            [-2147483648, 2147483647]
        ]) {
            define(next, [[0, a], [0, b], [op, 1], [0, 125], end]);
            run(next++);
        }
    }
    for (const index of [-1, 0, 1, 4, 5]) {
        for (const length of [-1, 0, 5000, 5001]) {
            define(next, [[0, length], [44, (index << 16) | 105], end]);
            run(next++);
        }
    }
    for (const op of [33, 34, 35, 36, 37, 45, 46, 51]) {
        define(next, [[op, 0], end]);
        run(next++);
    }
    for (const seed of [-9223372036854775808n, 96727438008861n]) {
        commands.push('seed\t' + seed);
        mathRandom.setSeed(seed);
        for (let op = 4000; op <= 4018; op++) {
            for (const [a, b] of [
                [0, 0],
                [0, -1],
                [-4, 2],
                [-1, 31],
                [4097, 3],
                [2147483647, -2147483648],
                [-2147483648, -1],
                [7, 2147483647]
            ]) {
                const args = op === 4006 ? [a, b, 2147483647, a, b] : op === 4018 ? [a, b, a] : op === 4004 || op === 4005 ? [a] : [a, b];
                define(next, [...args.map((v): [number, number] => [0, v]), [op, 0], end]);
                run(next++);
            }
            define(next, [[op, 0], end]);
            run(next++);
        }
    }
    for (const appearance of ['-', '0', '1']) {
        commands.push('appearance\t' + appearance);
        const player = requireNonNull(Client.localPlayer);
        player.appearance = appearance === '-' ? null : new PlayerModel();
        if (player.appearance !== null) player.appearance.female = appearance === '1';
        for (const [op, inputs] of [
            [4100, ['visible', -2147483648]],
            [4101, ['L', 'R']],
            [4102, ['cost', 93]],
            [4103, ['aB\xff']],
            [4104, [-11745]],
            [4105, ['a', 'b']],
            [4106, [2147483647]],
            [4107, ['\xc6', 'Ae']],
            [4108, ['ab ab-<br>cd', 12, 16]],
            [4109, ['ab ab-<br>cd', 12, 16]],
            [4108, ['missing', 17, 27]],
            [4110, ['a', 'b', 1]],
            [4110, ['a', 'b', 2]],
            [4111, ['<a>']],
            [4112, ['A', -1]],
            [4112, ['A', 255]],
            [4113, [128]],
            [4114, [65]],
            [4115, [48]],
            [4116, [56]],
            [4117, ['12']],
            [4118, ['lobby', 2, 3]],
            [4119, ['a<c>x<d']],
            [4120, ['area', 97, 1]],
            [4121, ['abaz', 'az', 1]],
            [4122, [159]],
            [4123, [156]],
            [4124, [-2147483648, 1]]
        ] as [number, (number | string)[]][]) {
            define(next, [...inputs.map((value): [number, number | string] => [typeof value === 'number' ? 0 : 3, value]), [op, 0], end]);
            run(next++);
        }
    }
    for (let op = 4100; op <= 4124; op++) {
        define(next, [[op, 0], end]);
        run(next++);
    }
    for (const mode of [-2147483648, -1, 0, 1, 2, 3, 2147483647]) {
        define(next, [[0, 483], [0, 830], [0, mode], [5300, 0], [5301, 0], [5302, 0], [5303, 0], [5305, 0], [5306, 0], [0, mode], [5309, 0], [5308, 0], end]);
        run(next++);
    }
    for (const language of [0, 1, 2, 3, 7]) {
        commands.push('language\t' + language);
        LocalisedText.language = language;
        define(next, [[0, 1293499370], [0, 1], [4124, 0], end]);
        run(next++);
    }
    const scratch = mkdtempSync(join(tmpdir(), 'rs530-interpreter-'));
    try {
        const build = Bun.spawnSync(['javac', asmExport, '-cp', gamepackPath, '-d', scratch, join(import.meta.dir, 'game/InterpreterOracle.java')]);
        expect(build.stderr.toString()).toBe('');
        expect(build.exitCode).toBe(0);
        const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const java = Bun.spawnSync(['java', asmExport, '--add-opens', 'java.base/java.lang=ALL-UNNAMED', '-Djava.awt.headless=true', '-Duser.timezone=' + zone, '-cp', scratch + delimiter + gamepackPath, 'InterpreterOracle'], {
            stdin: Buffer.from(commands.join('\n') + '\n'),
            timeout: 20000
        });
        expect(java.stderr.toString()).toBe('');
        expect(java.exitCode).toBe(0);
        const records = java.stdout.toString().trimEnd().split(/\r?\n/);
        expect(results.length).toBe(records.length);
        records.forEach((record, i) => expect(results[i], labels[i]).toBe(record));
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
}, 30000);

test('gh preserves script error chat rows, JagString identity, and report order even without an applet', () => {
    using _vm = freshVM();
    const priorClient = Client.activeClient,
        priorMode = Client.modeWhere;
    const priorTransmit = Client.transmitCycle,
        priorChat = Client.chatTransmitCycle;
    const priorRows = { names: ChatHistory.names, text: ChatHistory.text, clans: ChatHistory.clans, types: ChatHistory.types, phrases: ChatHistory.phrases, count: ChatHistory.count };
    const scratch = mkdtempSync(join(tmpdir(), 'rs530-interpreter-chat-'));
    const markers = [null, fromJsString('a'), fromJsString('b'), fromJsString('c')];
    const high = fromJsString('R\x80\xc3\xa9\xe2\x82\xac\xff'),
        caller = fromJsString('Caller');
    const fields = ['types', 'names', 'text', 'clans', 'phrases'] as const;
    const inputs: string[] = [],
        expected: string[] = [];
    function snapshot(): string {
        const name = ChatHistory.names?.[0] ?? null,
            message = ChatHistory.text?.[0] ?? null;
        return [
            ChatHistory.count,
            Client.chatTransmitCycle,
            hash(ChatHistory.types),
            hash(ChatHistory.phrases),
            strings(ChatHistory.names),
            strings(ChatHistory.text),
            strings(ChatHistory.clans),
            hex(name),
            hex(message),
            name === ScriptRunner.emptyString,
            message === ScriptRunner.scriptErrorMessage
        ].join(',');
    }
    function check(mode: number, kind: number, damage: number, capacity: number, count: number): void {
        const programs = new Map<number, ClientScript>();
        let keyState = '-';
        function script(id: number, name: JagString | null, op: number, operand: number | null): void {
            const code = new ClientScript();
            code.name = name;
            code.opcodes = Int32Array.of(op, 21);
            Object.defineProperty(code, 'key', {
                get() {
                    keyState = snapshot();
                    return BigInt(id);
                }
            });
            code.intOperands = operand === null ? null : Int32Array.of(operand, 0);
            code.stringOperands = [null, null];
            programs.set(id, code);
        }
        switch (kind) {
            case 0:
                script(8001, null, 9999, 0);
                break;
            case 1:
                script(8001, high, 9999, 0);
                break;
            case 2:
                script(8001, caller, 40, 8002);
                script(8002, fromJsString('mid'), 40, 8003);
                script(8003, high, 40, 9911);
                break;
            case 3:
                script(8001, caller, 40, 8002);
                script(8002, null, 9999, 0);
                break;
            case 4:
                script(8001, null, 40, 8002);
                script(8002, high, 9999, 0);
                break;
            case 5:
                script(8001, high, 40, null);
                break;
            case 6:
                script(8001, high, 21, 0);
                break;
            case 7:
                script(8001, high, 40, 9911);
                break;
            case 8:
                script(8001, null, 40, 9911);
                break;
            default:
                throw new Error('unknown fixture program');
        }
        for (const [i, field] of fields.entries()) {
            const length = damage === i ? capacity : 100;
            const rows = length < 0 ? null : field === 'types' || field === 'phrases' ? Int32Array.from({ length }, (_, row) => (field === 'types' ? 773 : -249) + row) : Array.from({ length }, (_, row) => markers[(row + i) % markers.length]);
            Reflect.set(ChatHistory, field, rows);
        }
        Client.modeWhere = mode;
        Client.transmitCycle = 431;
        Client.chatTransmitCycle = -22;
        ChatHistory.count = count;
        const event = new HookReq();
        event.args = [8001];
        let atReport = '-',
            report = '',
            outcome = 'ok';
        const runner = new ScriptRunner(
            id => programs.get(id) ?? null,
            e => {
                atReport = snapshot();
                report = e.message;
            }
        );
        const countWrite = damage >= 10 && damage < 20;
        const observed = countWrite ? ChatHistory : Client,
            property = countWrite ? 'count' : 'chatTransmitCycle';
        const descriptor = requireNonNull(Object.getOwnPropertyDescriptor(observed, property));
        let scalar = countWrite ? ChatHistory.count : Client.chatTransmitCycle;
        if (damage >= 10) {
            Object.defineProperty(observed, property, {
                configurable: true,
                get: () => scalar,
                set: (value: number) => {
                    scalar = value;
                    const field = fields[damage % 10];
                    const rows = capacity < 0 ? null : field === 'types' || field === 'phrases' ? new Int32Array(capacity) : new Array(capacity).fill(null);
                    Reflect.set(ChatHistory, field, rows);
                }
            });
        }
        try {
            runner.ExecuteScript(event, 100);
        } catch (e) {
            outcome = e instanceof RangeError ? 'ArrayIndexOutOfBoundsException' : e instanceof TypeError ? 'NullPointerException' : String(e);
        } finally {
            if (damage >= 10) Object.defineProperty(observed, property, { ...descriptor, value: scalar });
        }
        inputs.push(['chat', mode, kind, damage, capacity, count].join('\t'));
        expected.push([outcome, ScriptRunner.frameCount, snapshot(), atReport, Buffer.from(replaceText('\n', '%0a', report)).toString('hex'), keyState].join('/'));
    }
    try {
        Client.activeClient = null;
        for (const mode of [0, 1, -1, 2, -2147483648, 2147483647]) {
            for (let kind = 0; kind <= 8; kind++) check(mode, kind, -1, 100, 2147483647);
        }
        for (let field = 0; field < fields.length; field++) {
            for (const length of [-1, 0, 98, 99, 100, 101]) {
                for (const kind of [0, 1, 2, 4, 5, 6]) check(1, kind, field, length, 17);
                check(0, 1, field, length, -3);
            }
        }
        const ordinaryCases = inputs.length;
        for (const afterWrite of [10, 20]) {
            for (let field = 0; field < fields.length; field++) {
                for (const capacity of [-1, 0, 1]) {
                    for (const kind of [0, 1, 2]) check(1, kind, afterWrite + field, capacity, 2147483647);
                }
            }
        }
        const javac = Bun.spawnSync(['javac', asmExport, '-cp', gamepackPath, '-d', scratch, join(import.meta.dir, 'game/InterpreterOracle.java')]);
        expect(javac.stderr.toString()).toBe('');
        expect(javac.exitCode).toBe(0);
        const launch = ['java', asmExport, '-Djava.awt.headless=true', '-Dfile.encoding=UTF-8', '-cp', scratch + delimiter + gamepackPath, 'InterpreterOracle'];
        const original = Bun.spawnSync(launch, { stdin: Buffer.from(inputs.slice(0, ordinaryCases).join('\n') + '\n'), timeout: 20000 });
        expect(original.stderr.toString()).toBe('');
        expect(original.exitCode).toBe(0);
        const unmodifiedRows = original.stdout.toString().trimEnd().split(/\r?\n/);
        expect(unmodifiedRows.length).toBe(ordinaryCases);
        unmodifiedRows.forEach((row, i) => expect(expected[i].split('/').slice(0, -1), inputs[i]).toEqual(row.split('/').slice(0, -1)));
        const instrument = Bun.spawnSync([...launch, gamepackPath, scratch]);
        expect(instrument.stderr.toString()).toBe('');
        expect(instrument.exitCode).toBe(0);
        const java = Bun.spawnSync(launch, { stdin: Buffer.from(inputs.join('\n') + '\n'), timeout: 20000 });
        expect(java.stderr.toString()).toBe('');
        expect(java.exitCode).toBe(0);
        const rows = java.stdout.toString().trimEnd().split(/\r?\n/);
        expect(rows.length).toBe(expected.length);
        rows.forEach((row, i) => expect(expected[i], inputs[i]).toBe(row));
    } finally {
        Object.assign(ChatHistory, priorRows);
        Client.transmitCycle = priorTransmit;
        Client.chatTransmitCycle = priorChat;
        Client.modeWhere = priorMode;
        Client.activeClient = priorClient;
        rmSync(scratch, { recursive: true, force: true });
    }
}, 30000);
