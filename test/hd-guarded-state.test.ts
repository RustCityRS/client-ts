import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Environment from '#/dash3d/Environment.js';
import PlayerModel from '#/dash3d/PlayerModel.js';
import type ModelLit from '#/dash3d/ModelLit.js';
import HashTable from '#/datastruct/HashTable.js';
import Linkable from '#/datastruct/Linkable.js';
import LRUHashCache from '#/datastruct/LRUHashCache.js';
import SecondaryLinkedList from '#/datastruct/SecondaryLinkedList.js';
import { fromLiteral, toJsString } from '#/datastruct/JagString.js';
import ScriptRunner from '#/script/ScriptRunner.js';
import DelayedStateChange from '#/ui/DelayedStateChange.js';
import IfType from '#/ui/IfType.js';
import LocalisedText from '#/ui/LocalisedText.js';
import WorldMap from '#/ui/WorldMap.js';
import WorldMapLabels from '#/ui/WorldMapLabels.js';
import WrappedException from '#/util/WrappedException.js';
import { hdGamepackPath, joglPath } from './render/hd-reference.js';

function outcome(call: () => void): string {
    try {
        call();
        return 'ok';
    } catch (error) {
        if (!(error instanceof WrappedException) || !(error.cause instanceof TypeError)) throw error;
        const kind = error.cause.message.startsWith('ClassCastException:') ? 'ClassCastException' : 'NullPointerException';
        return kind + ' ' + error.context;
    }
}

function change(server: boolean, guard: number, damage: number): string {
    Reflect.set(DelayedStateChange, 'changes', new HashTable(16));
    Reflect.set(DelayedStateChange, 'delayed', new SecondaryLinkedList());
    Reflect.set(DelayedStateChange, 'immediate', new SecondaryLinkedList());
    Reflect.set(ScriptRunner, 'dateSeparator', fromLiteral('sep'));
    Environment.sunColour = 771;
    const id = server ? 7 : 99;
    const entry = DelayedStateChange.get(id, server ? 8 : 3);
    if (damage === 1) Reflect.set(DelayedStateChange, 'changes', null);
    if (damage === 2) Reflect.set(DelayedStateChange, server ? 'immediate' : 'delayed', null);
    if (damage === 3) {
        const table = new HashTable(16);
        table.put(new Linkable(), entry.key);
        Reflect.set(DelayedStateChange, 'changes', table);
    }
    const status = outcome(() => {
        if (server) DelayedStateChange.serverAngles(id, 24, -83, -91, guard === -124 ? undefined : guard);
        else DelayedStateChange.clientText(id, guard === 91 ? undefined : guard);
    });
    return [status, Environment.sunColour, ScriptRunner.dateSeparator === null, [entry.value3, entry.value, entry.value2].join(','), entry.secondaryKey < 0n, entry.time() !== 0n].join('|');
}

function clean(guard: number, damage: number): string {
    const body = new LRUHashCache<ModelLit>(2),
        head = new LRUHashCache<ModelLit>(2);
    const value = {} as ModelLit;
    body.Put(1n, value);
    head.Put(2n, value);
    Reflect.set(PlayerModel, 'modelCache2', damage === 1 ? null : body);
    Reflect.set(PlayerModel, 'modelCache', damage === 2 ? null : head);
    const status = outcome(() => PlayerModel.cleanModelCaches(-51, guard === 64 ? undefined : guard));
    return status + '|' + body.countHard() + ',' + head.countHard();
}

function label(target: boolean, guard: number, fixture: number): string {
    Reflect.set(LocalisedText, 'frenchMembersObject', fromLiteral('members'));
    const labels = fixture === 0 ? null : new WorldMapLabels(1);
    WorldMap.labels = labels;
    const prefix = fixture <= 1 ? null : fromLiteral('FiR');
    if (labels !== null) {
        if (fixture !== 2) labels.text[0] = fromLiteral('first<br>label');
        labels.x[0] = 41;
        labels.z[0] = 59;
    }
    WorldMap.component = fixture === 3 ? null : new IfType();
    if (WorldMap.component) {
        WorldMap.component.width = 20;
        WorldMap.component.height = 30;
    }
    WorldMap.baseX = 17;
    WorldMap.baseZ = 19;
    WorldMap.width = 80;
    WorldMap.height = 70;
    WorldMap.zoom = 2;
    WorldMap.targetX = -1;
    WorldMap.targetZ = -2;
    let text = '-';
    const status = outcome(() => {
        if (target) WorldMap.targetLabel(prefix, guard === -801 ? undefined : guard);
        else text = toJsString(WorldMap.completeLabel(prefix, guard === 1 ? undefined : false));
    });
    return [status, LocalisedText.frenchMembersObject === null, WorldMap.targetX + ',' + WorldMap.targetZ, text].join('|');
}

if (process.argv.includes('--trace')) {
    for (const guard of [-128, -124, -120, -45]) for (let damage = 0; damage <= 3; damage++) console.log(change(true, guard, damage));
    for (const guard of [91, 87, 86, -14]) for (let damage = 0; damage <= 3; damage++) console.log(change(false, guard, damage));
    for (const guard of [64, -76]) for (let damage = 0; damage <= 2; damage++) console.log(clean(guard, damage));
    for (const guard of [-801, 89]) for (let fixture = 0; fixture <= 4; fixture++) console.log(label(true, guard, fixture));
    for (const guard of [1, 0]) for (let fixture = 0; fixture <= 4; fixture++) console.log(label(false, guard, fixture));
} else
    test('HD state, cache and map label guards preserve JAR calls, partial stores and exception chains', () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-state-guards-'));
        const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
        function output(cmd: string[]): string[] {
            const result = Bun.spawnSync(cmd, { env: { ...process.env, RS530_GAMEPACK_IDENTITY: 'gl' } });
            expect(result.exitCode, result.stderr.toString()).toBe(0);
            return result.stdout.toString().trimEnd().split(/\r?\n/);
        }
        try {
            output(['javac', '-cp', cp, '-d', dir, join(import.meta.dir, 'hd/HdGuardedStateOracle.java')]);
            const reference = output(['java', '-Djava.awt.headless=true', '-cp', cp, 'HdGuardedStateOracle']);
            const actual = output([process.execPath, import.meta.path, '--trace']);
            expect(reference).toHaveLength(58);
            expect(actual).toEqual(reference);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    }, 30000);
