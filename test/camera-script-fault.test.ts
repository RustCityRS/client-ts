import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import CinematicCamera from '#/client/CinematicCamera.js';
import OrbitCamera from '#/client/OrbitCamera.js';
import { ClientScript } from '#/script/ClientScript.js';
import HookReq from '#/script/HookReq.js';
import ScriptRunner from '#/script/ScriptRunner.js';
import Minimenu from '#/ui/Minimenu.js';
import { gamepackPath } from './reference.js';

const cameraFields = ['positionPath', 'lookPath', 'positionSegment', 'lookSegment', 'progress', 'startRate', 'endRate'] as const;
const menuFields = ['backgroundColour', 'transparency', 'highlightColour', 'skinHoverAlpha', 'skinTitleSpriteId', 'skinTitleEndSprite', 'bottomSpriteId', 'sideSpriteId', 'skinBottomCornerSprite', 'textColour', 'skinHighlightTextColour'] as const;

function vectors(): number[][] {
    const rows: number[][] = [];
    for (const layout of [0, 1, 2, 3, 6]) {
        for (const path of [-1, 0, 1, 2]) {
            rows.push([5407, layout, path]);
            for (const index of [-2147483648, -1, 0, 1, 2, 2147483647]) {
                rows.push([5405, layout, path, index], [5406, layout, path, index, 3045383, 185, 675012, -91, 440]);
                for (const look of [-1, 0, 1, 2]) {
                    rows.push([5502, layout, path, index, 621, 389, look, index], [5502, layout, path, index, -48, 95, look, 0]);
                }
            }
        }
    }
    for (const [op, count] of [
        [5405, 2],
        [5406, 7],
        [5407, 1],
        [5502, 6],
        [5424, 11],
        [5426, 1],
        [5427, 2]
    ]) {
        for (let n = 0; n <= count + 1; n++) rows.push([op, 3, ...Array.from({ length: n }, (_, i) => i + 1)]);
    }
    // The extended dispatch reads the operand for every hole in these groups before throwing.
    const commands = new Set([5400, 5401, 5405, 5406, 5407, 5411, 5419, 5420, 5421, 5422, 5423, 5424, 5425, 5426, 5427, 5500, 5501, 5502, 5503, 5504, 5505, 5506, 6405, 6406, 6600, 6601]);
    for (const base of [5400, 5500, 6400, 6600]) {
        for (let op = base; op < base + 100; op++) if (!commands.has(op)) rows.push([op, 1]);
    }
    return rows;
}

const fold = (h: number, n: number) => (Math.imul(h, 31) + n) | 0;
const hash = (a: Int32Array) => a.reduce(fold, 1);

test('gh preserves spline and skin writes before bounds, null, invalid length and unknown opcode faults', () => {
    const rows = vectors(),
        dir = mkdtempSync(join(tmpdir(), 'cs2-camera-fault-'));
    const saved = {
        camera: cameraFields.map(k => CinematicCamera[k]),
        paths: CinematicCamera.paths.slice(),
        mode: OrbitCamera.mode,
        menu: menuFields.map(k => Minimenu[k]),
        style: Minimenu.spriteStyle,
        cursor: Client.defaultCursor,
        obj: Minimenu.objCursor,
        examine: Minimenu.examineCursor,
        sprites: Client.m_pSprites,
        stack: ScriptRunner.intStack.slice()
    };
    try {
        const build = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'ui/CameraScriptFaultOracle.java')]);
        expect(build.exitCode, build.stderr.toString()).toBe(0);
        const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'CameraScriptFaultOracle'], { stdin: Buffer.from(rows.map(r => r.join(' ')).join('\n') + '\n'), maxBuffer: 4000000 });
        expect(java.exitCode, java.stderr.toString()).toBe(0);
        const expected = java.stdout.toString().trimEnd().split(/\r?\n/);
        expect(expected.length).toBe(rows.length);
        const code = new ClientScript(),
            event = new HookReq();
        let fault = '-';
        const vm = new ScriptRunner(
            () => code,
            error => {
                const cause = error.cause;
                const kind = cause instanceof TypeError ? 'null' : cause instanceof RangeError ? (cause.message.startsWith('array index ') ? 'bounds' : 'length') : cause instanceof Error && cause.message === '' ? 'illegal' : 'runtime';
                fault = error.message.split(' op:')[1] + '/' + kind;
            }
        );
        for (const [rowIndex, [op, layout, ...values]] of rows.entries()) {
            const curve = (length: number) => Array.from({ length }, () => new Int32Array(4));
            CinematicCamera.paths[0] = layout === 0 ? null : curve(layout);
            CinematicCamera.paths[1] = curve(6);
            for (const field of cameraFields) CinematicCamera[field] = 511;
            OrbitCamera.mode = 2;
            for (const field of menuFields) Minimenu[field] = 181;
            Minimenu.spriteStyle = false;
            Minimenu.objCursor = 75;
            Minimenu.examineCursor = 69;
            Client.defaultCursor = 18;
            Client.m_pSprites = null;
            ScriptRunner.intStack.fill(-691);
            code.opcodes = Int32Array.from([...values.map(() => 0), op, 0, 21]);
            code.intOperands = Int32Array.from([...values, 0, -72, 0]);
            code.stringOperands = new Array(code.opcodes.length).fill(null);
            code.key = BigInt(85500 + rowIndex);
            event.args = [85500 + rowIndex];
            fault = '-';
            expect(vm.run(event)).toBeUndefined();
            const pathHash = CinematicCamera.paths.reduce((h, c) => fold(h, c === null ? 0 : c.reduce((v, p) => fold(v, p === null ? 0 : hash(p)), 1)), 1);
            const fields = [...cameraFields.map(k => CinematicCamera[k]), OrbitCamera.mode, ...menuFields.map(k => Minimenu[k]), +Minimenu.spriteStyle, Minimenu.objCursor, Minimenu.examineCursor, Client.defaultCursor];
            expect([fault, hash(ScriptRunner.intStack), pathHash, '[' + fields.join(', ') + ']'].join(';'), rows[rowIndex].join(' ')).toBe(expected[rowIndex]);
        }
    } finally {
        cameraFields.forEach((k, i) => {
            CinematicCamera[k] = saved.camera[i];
        });
        CinematicCamera.paths.splice(0, CinematicCamera.paths.length, ...saved.paths);
        OrbitCamera.mode = saved.mode;
        menuFields.forEach((k, i) => {
            Minimenu[k] = saved.menu[i];
        });
        Minimenu.spriteStyle = saved.style;
        Minimenu.objCursor = saved.obj;
        Minimenu.examineCursor = saved.examine;
        Client.defaultCursor = saved.cursor;
        Client.m_pSprites = saved.sprites;
        ScriptRunner.intStack.set(saved.stack);
        rmSync(dir, { recursive: true, force: true });
    }
}, 30000);
