import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';
import ClientNpc from '#/dash3d/ClientNpc.js';
import GameVariant from '#/client/GameVariant.js';
import SeqType from '#/config/SeqType.js';
import NpcType from '#/config/NpcType.js';
import { gamepackPath } from './reference.js';

test('ob constructor, paths, hits, interrupted sequences and bk visibility/BAS match all 82 original instance fields', () => {
    const commands = ['new', 'visible', 'bas 0 -1', 'bas 1 5', 'type 1', 'bas 1 76', 'visible', 'type 0', 'visible'];
    for (const value of [-32768, -2147483648, 0, 28]) commands.push('height ' + value);
    for (const size of [0, 5, 127, -1]) {
        commands.push('set ' + size, 'size', 'move ' + size + ' 60 50 1', 'move ' + size + ' 65 54 0', 'move ' + size + ' 74 54 0');
        for (let dir = -1; dir <= 8; dir++) commands.push('step ' + dir + ' ' + (dir + 128) + ' ' + (dir % 3 === 0 ? 6 : 3));
    }
    for (const seq of [-1, 5001, 5002]) commands.push('seq ' + seq, 'move 2 55 21 1', 'seq ' + seq, 'step 4 1 3');
    for (let i = 0; i < 10; i++) commands.push('hit ' + i + ' ' + (i === 9 ? 2147483640 : i * 11) + ' ' + (i % 4));
    for (const n of [-1, 0, 1, 2, 10, 2147483647]) commands.push('len ' + n, 'step 7 2 3', 'reset', 'move 128 -2147483648 2147483647 1');
    for (const lengths of ['0 4 10', '1 10 10', '10 1 10', '10 10 1']) commands.push('new', 'paths ' + lengths, 'len 1', 'step 2 1 3', 'move 1 1 1 0', 'move 2 3 4 1');
    const type = new NpcType();
    type.m_baseAnimationSet = 37;
    const keep = new SeqType(),
        stop = new SeqType();
    stop.m_postanimMove = 1;
    keep.m_postanimMove = 0;
    const variant = GameVariant.id;
    const src = readFileSync(join(import.meta.dir, '../src/dash3d/ClientEntity.ts'), 'utf8');
    const fields = new Map(Array.from(src.matchAll(/^\s*(?:private )?(\w+): .*; \/\/ ob\.(\w+):/gm), m => [m[2], m[1]]));
    let actor = new ClientNpc();
    const out = resolve('out');
    mkdirSync(out, { recursive: true });
    const dir = mkdtempSync(join(out, 'entity-oracle-'));
    try {
        const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game', 'ClientEntityOracle.java')]);
        expect(compile.stderr.toString()).toBe('');
        expect(compile.exitCode).toBe(0);
        const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'ClientEntityOracle'], { stdin: Buffer.from(commands.join('\n') + '\n'), maxBuffer: 8 * 1024 * 1024, timeout: 20000 });
        expect(java.stderr.toString()).toBe('');
        expect(java.exitCode).toBe(0);
        const [header, ...rows] = java.stdout.toString().trimEnd().split(/\r?\n/);
        const names = header.split(',');
        expect(names.length).toBe(82);
        expect(rows.length).toBe(commands.length);
        const properties = names.map(name => {
            const prop = fields.get(name);
            if (!prop) throw Error('Unmapped ob.' + name);
            return prop;
        });
        SeqType.m_recentUse.Put(5001n, stop);
        SeqType.m_recentUse.Put(5002n, keep);
        for (let i = 0; i < commands.length; i++) {
            const [op, ...args] = commands[i].split(' '),
                v = args.map(Number);
            let result = 'ok';
            try {
                switch (op) {
                    case 'new':
                        actor = new ClientNpc();
                        break;
                    case 'visible':
                        result = String(actor.isVisible());
                        break;
                    case 'bas':
                        GameVariant.id = v[0];
                        actor.bas = v[1];
                        result = String(actor.getBasId());
                        break;
                    case 'type':
                        actor.setType(v[0] === 0 ? null : type);
                        break;
                    case 'set':
                        actor.setSize(v[0]);
                        break;
                    case 'size':
                        result = String(actor.getSize());
                        break;
                    case 'len':
                        actor.pathLength = v[0];
                        break;
                    case 'height':
                        actor.modelMinY = v[0];
                        result = actor.getMinY() + ',' + actor.getOverheadHeight();
                        break;
                    case 'paths':
                        actor.pathX = new Int32Array(v[0]);
                        actor.pathZ = new Int32Array(v[1]);
                        actor.pathSpeed = new Int8Array(v[2]);
                        break;
                    case 'seq':
                        actor.seq = v[0];
                        break;
                    case 'step':
                        actor.step(v[0], v[1], v[2]);
                        break;
                    case 'move':
                        actor.moveSized(v[0], v[1], v[2], v[3] !== 0);
                        break;
                    case 'hit':
                        actor.addHit(v[0], v[1], v[2]);
                        break;
                    case 'reset':
                        actor.resetPath();
                        break;
                    default:
                        throw Error(op);
                }
            } catch (e) {
                if (e instanceof RangeError) result = 'bounds';
                else if (e instanceof TypeError) result = 'null';
                else throw e;
            }
            const cols = rows[i].split(';');
            expect(result, commands[i]).toBe(cols[0]);
            for (let j = 0; j < properties.length; j++) {
                const v = Reflect.get(actor, properties[j]);
                const value = Array.isArray(v) || v instanceof Int8Array || v instanceof Int32Array ? '[' + Array.from(v, x => String(x)).join(', ') + ']' : String(v);
                expect(value, commands[i] + ' ob.' + names[j] + ' ' + properties[j]).toBe(cols[j + 1]);
            }
        }
    } finally {
        GameVariant.id = variant;
        SeqType.m_recentUse.Reset();
        rmSync(dir, { recursive: true, force: true });
    }
}, 30000);
