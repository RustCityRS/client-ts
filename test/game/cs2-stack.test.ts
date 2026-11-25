import { expect } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import PlayerModel from '#/dash3d/PlayerModel.js';
import JagString, { fromJsString } from '#/datastruct/JagString.js';
import SharedPtrList from '#/datastruct/SharedPtrList.js';
import { ClientScript } from '#/script/ClientScript.js';
import HookReq from '#/script/HookReq.js';
import ScriptRunner from '#/script/ScriptRunner.js';
import MapArea from '#/ui/MapArea.js';
import WorldMap from '#/ui/WorldMap.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { loginFixture } from '../login-fixture.js';
import { gamepackPath } from '../reference.js';

// Original bytecode positions inside gh.a(Lwf;II)V. The debugger changes one field only after the VM
// has reached the indicated instruction. TypeScript performs the same change at the corresponding read.
type Row = [op: number, intInputs: number, stringInputs: number, intSize: number, stringSize: number, replacementSize: number, mode: string, pc: number];
function vectors(): Row[] {
    const rows: Row[] = [];
    for (const [op, ni, ns] of [
        [3309, 1, 0],
        [3310, 1, 0],
        [3311, 1, 0],
        [4105, 0, 2],
        [4117, 0, 1],
        [5207, 0, 1],
        [5217, 1, 0]
    ]) {
        for (const [ints, strs] of [
            [ni, ns],
            [0, 0],
            [ni + 1, ns + 1],
            [2, 2]
        ]) {
            for (const [ilen, slen] of [
                [5, 5],
                [-1, 3],
                [3, -1],
                [0, 3],
                [2, 0],
                [1, 1],
                [2, 2]
            ]) {
                rows.push([op, ints, strs, ilen, slen, 4, 'normal', -1]);
            }
        }
        for (const [ints, strs] of [
            [1000, ns],
            [1001, ns],
            [ni, 1000],
            [ni, 1001]
        ]) {
            rows.push([op, ints, strs, 1000, 1000, 3, 'normal', -1]);
        }
    }
    for (const mode of ['female', 'no-model', 'no-player', 'null-arg']) rows.push([4105, 1, 2, 5, 5, 5, mode, -1]);
    for (const mode of ['miss', 'null-arg', 'no-name', 'null-group']) rows.push([5207, 1, 1, 5, 5, 5, mode, -1]);
    for (const mode of ['negative', 'no-flags']) rows.push([5217, 1, 2, 5, 5, 5, mode, -1]);
    rows.push([4117, 1, 1, 5, 5, 5, 'null-arg', -1]);
    const probes = [
        [3309, 0x5fc8, 2, 1],
        [3310, 0x5ff3, 2, 1],
        [3311, 0x6019, 2, 1],
        [4105, 0x1780, 1, 3],
        [4105, 0x1797, 1, 3],
        [4117, 0x1a53, 1, 2],
        [5207, 0x2e35, 1, 2],
        [5207, 0x2e62, 1, 2],
        [5217, 0x313b, 2, 1]
    ];
    for (const [op, pc, ni, ns] of probes) {
        for (const n of [-1, 0, 1, 2, 5]) rows.push([op, ni, ns, 5, 5, n, 'normal', pc]);
    }
    rows.push([4105, 0, 2, 4, 5, 4, 'female', 0x1780], [4117, 0, 1, 0, 5, 5, 'normal', 0x1a53], [4117, 0, 1, -1, 5, 5, 'normal', 0x1a53]);
    return rows;
}

function hash(values: Int32Array | null): number {
    return values === null ? 0 : values.reduce((h, v) => (Math.imul(31, h) + v) | 0, 1);
}

function run([op, ni, ns, ilen, slen, alen, mode, pc]: Row, key: number): string {
    const strings: (JagString | null)[] = [null, ScriptRunner.emptyString, ...['male', 'female', 'area', 'Display', 'replacement', 'changed', 'tail'].map(fromJsString)];
    const initialInts = ilen < 0 ? null : new Int32Array(ilen).fill(-315);
    const initialStrings = slen < 0 ? null : new Array<JagString | null>(slen).fill(strings[2]);
    const otherInts = alen < 0 ? null : new Int32Array(alen).fill(937);
    const otherStrings = alen < 0 ? null : new Array<JagString | null>(alen).fill(strings[6]);
    let ints = initialInts,
        strs = initialStrings,
        changed = 0,
        intReads = 0,
        stringReads = 0;
    const intSwap = () => {
        changed = 1;
        ints = otherInts;
    };
    const stringSwap = () => {
        changed = 1;
        strs = otherStrings;
    };
    const intGetter = Object.getOwnPropertyDescriptor(ScriptRunner, 'intStack');
    const stringGetter = Object.getOwnPropertyDescriptor(ScriptRunner, 'stringStack');
    const getArea = MapArea.get,
        iconDisabled = WorldMap.iconDisabled;
    Object.defineProperty(ScriptRunner, 'intStack', {
        configurable: true,
        get() {
            if (++intReads === ni + 2 && (pc === 0x5fc8 || pc === 0x5ff3 || pc === 0x6019)) intSwap();
            return ints;
        }
    });
    Object.defineProperty(ScriptRunner, 'stringStack', {
        configurable: true,
        get() {
            if (++stringReads === ns + 2 && pc === 0x1780) stringSwap();
            return strs;
        }
    });
    try {
        Client.localPlayer = mode === 'no-player' ? null : new ClientPlayer();
        if (Client.localPlayer !== null && mode !== 'no-model') {
            const appearance = (Client.localPlayer.appearance = new PlayerModel());
            appearance.female = mode === 'female';
            if (pc === 0x1797)
                Object.defineProperty(appearance, 'female', {
                    get() {
                        stringSwap();
                        return mode === 'female';
                    }
                });
        }
        MapArea.areas = new SharedPtrList<MapArea>();
        const area = new MapArea(mode === 'null-group' ? null : strings[4], mode === 'no-name' ? null : strings[5], 0, 0, 0, true, 1);
        MapArea.areas.push_back(area);
        if (pc === 0x2e35)
            MapArea.get = name => {
                stringSwap();
                return getArea.call(MapArea, name);
            };
        if (pc === 0x2e62) {
            let nameReads = 0;
            Object.defineProperty(area, 'displayName', {
                get() {
                    if (++nameReads === 2) stringSwap();
                    return nameReads < 2 ? strings[5] : strings[7];
                }
            });
        }
        if (pc === 0x1a53)
            requireNonNull(strings[2]).getLength = () => {
                intSwap();
                return 4;
            };
        WorldMap.disabled = mode === 'no-flags' || mode === 'negative' ? null : [false, true];
        if (pc === 0x313b)
            WorldMap.iconDisabled = icon => {
                intSwap();
                return iconDisabled.call(WorldMap, icon);
            };
        const arg = op === 5217 ? (mode === 'negative' ? -1 : 1) : 0xdeadbeef | 0;
        const code = new ClientScript(),
            event = new HookReq();
        const n = ni + ns + 4;
        code.opcodes = new Int32Array(n);
        code.intOperands = new Int32Array(n);
        code.stringOperands = new Array<JagString | null>(n).fill(null);
        let index = 0;
        for (let i = 0; i < ni; i++, index++) code.intOperands[index] = i === ni - 1 ? arg : 41;
        for (let i = 0; i < ns; i++, index++) {
            code.opcodes[index] = 3;
            code.stringOperands[index] = mode === 'null-arg' ? null : op === 4105 ? strings[i === ns - 1 ? 3 : 2] : op === 5207 && mode !== 'miss' ? strings[4] : strings[2];
        }
        code.opcodes[index++] = op;
        code.intOperands[index++] = -78;
        code.opcodes[index] = 3;
        code.stringOperands[index++] = strings[8];
        code.opcodes[index] = 21;
        code.key = BigInt(key);
        event.args = [key];
        let fault = '-';
        const runner = new ScriptRunner(
            () => code,
            error => {
                const match = / op:(-?\d+)/.exec(error.message);
                fault = requireNonNull(match)[1] + '/' + (error.cause instanceof TypeError ? 'null' : error.cause instanceof RangeError ? 'bounds' : 'other');
            }
        );
        const result = runner.ExecuteScript(event, 4000);
        if (result !== undefined) throw new Error('unexpected suspended script');
        const stringHash = (values: (JagString | null)[] | null) => {
            if (values === null) {
                return 0;
            } else {
                return values.reduce((h, v) => {
                    const tag = strings.indexOf(v);
                    if (tag < 0) throw new Error('unknown string');
                    return (Math.imul(h, 31) + tag) | 0;
                }, 1);
            }
        };
        return [fault, hash(initialInts), stringHash(initialStrings), hash(otherInts), stringHash(otherStrings), +(ints !== initialInts), +(strs !== initialStrings), changed].join(' ');
    } finally {
        Object.defineProperty(ScriptRunner, 'intStack', requireNonNull(intGetter));
        Object.defineProperty(ScriptRunner, 'stringStack', requireNonNull(stringGetter));
        MapArea.get = getArea;
        WorldMap.iconDisabled = iconDisabled;
    }
}

loginFixture(
    import.meta.url,
    'gh stack-array loads and stores match the unchanged JAR at each operand boundary',
    async () => {
        const rows = vectors(),
            dir = mkdtempSync(join(tmpdir(), 'rs530-cs2-stack-'));
        try {
            const cases = join(dir, 'cases.txt');
            writeFileSync(cases, rows.map(row => row.join(' ')).join('\n') + '\n');
            execFileSync('javac', ['--add-modules', 'jdk.jdi', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'cs2-stack', 'Cs2StackOracle.java')]);
            const lines = execFileSync('java', ['--add-modules', 'jdk.jdi', '-cp', dir + delimiter + gamepackPath, 'Cs2StackDebugger', cases], { encoding: 'utf8', timeout: 30000 })
                .trimEnd()
                .split(/\r?\n/);
            expect(lines.length).toBe(rows.length);
            for (const [i, row] of rows.entries()) {
                if (row[7] !== -1) expect(lines[i].endsWith(' 1'), row.join(' ')).toBe(true);
                expect(run(row, 92700 + i), row.join(' ')).toBe(lines[i]);
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    45000
);
