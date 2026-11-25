import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import '#/client/Client.js';
import Minimenu from '#/ui/Minimenu.js';
import MinimenuOps from '#/ui/MinimenuOps.js';
import { loginFixture } from '../login-fixture.js';
import { gamepackPath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

function run(command: string[]): string {
    const child = Bun.spawnSync(command, { maxBuffer: 8 * 1024 * 1024 });
    expect(child.exitCode, child.stderr.toString()).toBe(0);
    return child.stdout.toString();
}

// Inspect the signed-short comparisons in the original dispatcher. Both JARs read
// the menu action into int local 4 and may compare either the value or its complement.
function methodBody(jar: string, owner: string, method: string): string {
    const dump = run(['javap', '-p', '-c', '-classpath', jar, owner]);
    return dump.split('  static final void ' + method + ';')[1].split('Exception table:')[0];
}

function instructions(body: string, actionLoad: string): string[] {
    return Array.from(body.matchAll(/^\s*\d+:\s+(\w+)[ \t]*([^/\r\n]*)/gm), match => {
        const [, op, argument] = match;
        if (op === 'iconst_m1') return '-1';
        if (op.startsWith('iconst_')) return op.slice(7);
        if (op === 'bipush' || op === 'sipush') return argument.trim();
        if ((op + ' ' + argument.trim()).trim() === actionLoad) return 'action';
        return op;
    });
}

function dispatchLabels(code: string[]): Set<number> {
    const labels = new Set<number>();
    for (let pc = 0; pc < code.length; pc++) {
        if (code[pc] !== 'if_icmpne' && code[pc] !== 'if_icmpeq') continue;
        const operands = code
            .slice(Math.max(pc - 4, 0), pc)
            .join(' ')
            .replace('action -1 ixor', '~action');
        const comparison = operands.match(/(~?action) (-?\d+)$|(-?\d+) (~?action)$/);
        if (!comparison) continue;
        const value = Number(comparison[2] ?? comparison[3]);
        labels.add((comparison[1] ?? comparison[4]) === '~action' ? ~value : value);
    }
    return labels;
}

for (const hd of [false, true]) {
    loginFixture(
        import.meta.url,
        (hd ? 'HD' : 'SD') + ' menu table covers every original builder action and dispatcher label',
        async () => {
            const jar = hd ? hdGamepackPath : gamepackPath;
            const dir = mkdtempSync(join(tmpdir(), '530-action-table-'));
            const fixture = hd ? 'HdMenuActionsOracle' : 'SdMenuActionsOracle';
            let rows: number[][];
            try {
                const cp = [dir, jar, ...(hd ? [joglPath] : [])].join(delimiter);
                run(['javac', '-cp', cp, '-d', dir, join(import.meta.dir, hd ? '../hd' : '.', fixture + '.java')]);
                rows = run(['java', '-Djava.awt.headless=true', '-cp', cp, fixture, 'table'])
                    .trimEnd()
                    .split(/\r?\n/)
                    .map(line => line.split(' ').map(entry => Number(entry.split(',')[0])));
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
            const m = MinimenuOps;
            const names = Object.values(m);
            expect(new Set(names).size).toBe(names.length);
            const dispatcher = methodBody(jar, hd ? 'i' : 'bd', hd ? 'p(int, int)' : 'c(int, int)');
            const labels = dispatchLabels(instructions(dispatcher, 'iload 4'));
            expect(labels).toEqual(new Set(names.filter(action => action !== m.CANCEL)));

            // The cancel row bypasses AddEntry. Read its literal at the action array's
            // actual sastore, distinguishing it from other arrays initialized by reset.
            const reset = methodBody(jar, hd ? 'ha' : 'gf', hd ? 'a(int)' : 'e(byte)');
            const owner = hd ? 'd.eb' : 'p.u';
            const cancelStores = reset.split('Field ' + owner + ':[S').slice(1);
            expect(cancelStores).toHaveLength(1);
            const cancel = Number(cancelStores[0].match(/^\s*\d+: iconst_0\s+\d+: sipush\s+(\d+)\s+\d+: sastore/)?.[1]);
            expect(cancel).toBe(m.CANCEL);

            // At each minimap AddEntry call all eight arguments are plain JVM loads.
            // The action is argument 3 in SD tb.a and argument 6 in HD hj.a.
            const minimap = hd ? methodBody(jar, 'gn', 'a(int, int, int, be[], int, int, int, int, byte, int)') : methodBody(jar, 'lf', 'a(int, aj[], int, int, int, int, int, int, boolean, int)');
            const add = hd ? 'Method hj.a:(IJBLna;ISLna;I)V' : 'Method tb.a:(BLid;SLid;IIJI)V';
            const minimapIds = minimap
                .split(add)
                .slice(0, -1)
                .map(site => {
                    const loads = instructions(site, '');
                    return Number(loads.at(hd ? -4 : -7)); // includes the invokestatic itself
                });
            expect(minimapIds).toEqual(hd ? [m.TARGET_GROUND, m.FACE_HERE, m.WALK_HERE] : [m.FACE_HERE, m.WALK_HERE, m.TARGET_GROUND]);

            const mouseLoop = methodBody(jar, hd ? 'ah' : 'ge', hd ? 'b(int)' : 'b(boolean)');
            const drag = mouseLoop.split('Field ' + owner + ':[S')[1].split(hd ? 'Field pl.e:[I' : 'Field ml.x:[I')[0];
            expect(dispatchLabels(instructions(drag, 'iload_2'))).toEqual(new Set([m.INV_BUTTON1, m.INV_BUTTON2, m.INV_BUTTON3, m.INV_BUTTON4, m.INV_BUTTON5, m.OPHELD1, m.OPHELD2, m.OPHELD3, m.OPHELD4, m.OPHELD5, m.SELECT_OBJ, m.EXAMINE_HELD]));

            // Match rows by the meaning of the assigned operations and the original
            // descending option loops. No expected action numbers are copied from TS.
            const observed = new Set<number>([cancel]);
            let index = 0;
            function check(expected: number[]) {
                const actual = rows[index++];
                expect(actual, 'native builder row ' + index).toEqual(expected);
                for (const id of actual) observed.add(id);
            }
            const buttons = [[], [m.IF_BUTTON], [m.SELECT_TARGET], [m.IF_CLOSE], [m.IF_TOGGLE], [m.IF_SET], [m.IF_CONTINUE]];
            const npc = [m.OPNPC5, m.OPNPC4, m.OPNPC3, m.OPNPC2, m.OPNPC1];
            const player = [m.OPPLAYER8, m.OPPLAYER7, m.OPPLAYER6, m.OPPLAYER5, m.OPPLAYER4, m.OPPLAYER3, m.OPPLAYER2, m.OPPLAYER1];
            const inventory = [m.OPHELD5, m.OPHELD4, m.SELECT_OBJ, m.OPHELD3, m.OPHELD2, m.OPHELD1, m.INV_BUTTON5, m.INV_BUTTON4, m.INV_BUTTON3, m.INV_BUTTON2, m.INV_BUTTON1, m.EXAMINE_HELD];
            const if3 = [...new Array<number>(5).fill(m.IF_BUTTONX_LOW_PRIORITY), m.SELECT_TARGET, ...new Array<number>(5).fill(m.IF_BUTTONX), m.IF_CONTINUE];
            for (let mode = 0; mode < 3; mode++) {
                for (let button = 0; button < buttons.length; button++) {
                    const head = mode === 2 && button === 2 ? [] : buttons[button];
                    if (mode === 0) check([...head, ...inventory, ...if3]);
                    if (mode === 1) check([...head, m.OPHELDU, ...if3]);
                    if (mode === 2) check([...head, m.OPHELDT, m.IF_BUTTONT]);
                }
                if (mode === 0) {
                    check([...npc, m.EXAMINE_NPC]);
                    check(player.map(id => id + 2000));
                    check([m.FACE_HERE, m.WALK_HERE, m.OPLOC5, m.OPLOC4, m.OPLOC3, m.OPLOC2, m.OPLOC1, m.EXAMINE_LOC]);
                } else if (mode === 1) {
                    check([m.OPNPCU]);
                    check([m.OPPLAYERU]);
                    check([m.OPLOCU]);
                } else {
                    check([m.OPNPCT]);
                    check([m.OPPLAYERT]);
                    check([m.FACE_HERE, m.WALK_HERE, m.OPLOCT]);
                }
            }
            check([m.FACE_HERE, m.WALK_HERE, m.OPOBJ5, m.OPOBJ4, m.OPOBJ3, m.OPOBJ2, m.OPOBJ1, m.EXAMINE_OBJ]);
            check([m.OPOBJU]);
            check([m.FACE_HERE, m.WALK_HERE, m.OPOBJT]);
            check([m.TARGET_GROUND]);
            check(player);
            check([...npc.map(id => id + 2000), m.EXAMINE_NPC]);
            expect(observed).toEqual(new Set([...names, ...[...player, ...npc].map(id => id + 2000)]));
            const interfaces: number[] = [],
                menuOnly: number[] = [];
            for (let id = -32768; id <= 32767; id++) {
                Minimenu.actions[0] = id;
                if (Minimenu.IsInterfaceEntry(id)) interfaces.push(id);
                if (Minimenu.MenuOnly(0)) menuOnly.push(id);
            }
            expect(interfaces).toEqual(rows[index++]);
            expect(menuOnly).toEqual(rows[index++]);
            expect(index).toBe(rows.length);
        },
        45000,
        hd ? 'gl' : 'sd'
    );
}
