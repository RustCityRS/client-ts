import { expect } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import PlayerModel from '#/dash3d/PlayerModel.js';
import Preferences from '#/ui/Preferences.js';
import SeqType from '#/config/SeqType.js';
import type ActorSlotAnim from '#/dash3d/ActorSlotAnim.js';
import type ClientEntity from '#/dash3d/ClientEntity.js';
import ClientNpc from '#/dash3d/ClientNpc.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import WrappedException from '#/util/WrappedException.js';
import { localAssets } from '../cachefile.js';
import { loginFixture } from '../login-fixture.js';
import { cachePath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

function commands(): string[] {
    const rows: string[] = [];
    for (const actor of [0, 1]) {
        rows.push('new ' + actor, 'path 10 10 10 30 60 0 4 -1');
        const guards = [-128, -104, -126, -109, 46, -92, 88, 113, 32, -122, 85, -80];
        for (let i = 0; i < 36; i++) rows.push('step ' + (i % 3) + ' ' + guards[i % guards.length] + ' ' + (i % 9));
        for (const seq of [0, 25, 618]) rows.push('path 10 10 10 2147483647 -2147483648 8 7 ' + seq, 'step 257 -128 7');
        rows.push('move 2 88 91 1', 'step 2 85 0', 'move 2 87 92 0', 'reset -75', 'reset -76');
        for (const guard of [-2147483648, -116, -98, -75, -74, 0, 2147483647]) {
            rows.push('path 10 10 10 81 64 5 7 -1', 'reset ' + guard);
        }
        for (let guard = -128; guard <= 127; guard++) {
            rows.push('path 10 10 10 48 81 -1 4 618', 'step -129 ' + guard + ' 2');
        }
        // Paired corrupt arrays distinguish the first native read, individual shift stores and head writes.
        for (const shape of ['-1 0 3', '0 -1 3', '1 0 3', '4 1 4', '4 4 1', '2 4 4', '4 4 -1', '4 4 0']) {
            for (const n of [-1, 1, 2, 9]) rows.push('path ' + shape + ' 70 79 ' + n + ' 5 618', 'step 12 -80 0');
        }
        rows.push('hits 4 4 4 0', 'hit 0 -8 -1 90');
        for (let i = 0; i < 6; i++) rows.push('hit ' + (3 + i) + ' -8 20 ' + (14 + i));
        rows.push('hit 7 -8 89 21', 'hit 2 -8 90 0', 'hit 1 -8 2147483647 255', 'hit 6 -8 2147483647 8');
        for (const shape of ['0 -1 4', '-1 0 4', '4 0 4', '4 -1 4', '4 4 0', '4 4 -1', '4 4 2']) {
            rows.push('hits ' + shape + ' 0', 'hit 2 15 90 12', 'hit 2 -8 90 12');
        }
    }
    return rows;
}

function ints(length: number, start: number, stride: number): Int32Array | null {
    return length < 0 ? null : Int32Array.from({ length }, (_, i) => (start + i * stride) | 0);
}

function snapshot(actor: ClientEntity, outcome: string): string {
    const arrays = [actor.pathX, actor.pathZ, actor.pathSpeed, actor.hitDamage, actor.hitType, actor.hitUntil];
    return [outcome, actor.pathLength, actor.seqPathLength, actor.seq, actor.x, actor.z, ...arrays.map(a => (a === null ? 'null' : '[' + a.join(',') + ']'))].join(' ');
}

function outcome(error: unknown): string {
    if (!(error instanceof WrappedException)) throw error;
    const cause = error.cause;
    if (cause instanceof TypeError) return error.context + '|null';
    if (cause instanceof RangeError) return error.context + '|' + cause.message.replace(/^array index /, 'bounds:');
    throw error;
}

function slotTests(): string[] {
    for (let id = 23030; id < 23034; id++) {
        const seq = SeqType.List(id);
        seq.m_duplicateBehaviour = (id - 23030) % 3;
        seq.m_priority = id === 23033 ? 1 : 5;
        seq.sounds = [Int32Array.of((id << 8) | (2 << 5) | 3)];
    }
    const rows: string[] = [];
    const vector = (length: number, first: number, second: number) => (length < 0 ? null : Int32Array.of(first, second).slice(0, length));
    for (const actor of [new ClientPlayer(), new ClientNpc()]) {
        Preferences.areaSoundVolume = 127;
        actor.z = -192;
        actor.x = 576;
        const identities = new Map<ActorSlotAnim, number>();
        for (const v of [
            [2, 2, 2, 23030, 23031, 3, 4, 3, 12],
            [2, 2, 2, 23030, 23031, 8, 9, 3, 12],
            [2, 2, 2, 23032, 23033, 2, 7, 16, 12],
            [2, 2, 2, 23032, -1, 9, 8, 16, 2],
            [2, 2, 2, -1, 23033, 0, 5, -1, 7],
            [2, 2, 2, 23033, 23031, -1, 6, 4096, 3],
            [2, 1, 2, 23031, -1, 44, 5, 4, 2],
            [2, 2, 1, 23031, -1, 45, 5, 4, 2],
            [1, -1, 0, 23031, 0, 4, 0, 1, 0],
            [1, 0, -1, 23031, 0, 4, 0, 1, 0],
            [-1, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, -1, -1, 0, 0, 0, 0, 0, 0]
        ]) {
            for (const slot of actor.modelAnims) if (slot) Object.assign(slot, { loops: 6, next: 3, cycle: 5, frame: 4, delay: 2 });
            const seqs = vector(v[0], v[3], v[4]),
                delays = vector(v[1], v[5], v[6]),
                masks = vector(v[2], v[7], v[8]);
            Client.soundEffectCount = 0;
            let result = 'ok';
            try {
                if (actor instanceof ClientPlayer) ClientPlayer.applySlotAnims(seqs, delays, actor, masks);
                else ClientNpc.applySlotAnims(actor, delays, 0, masks, seqs);
            } catch (error) {
                result = outcome(error);
            }
            const slots = actor.modelAnims.map(slot => {
                if (slot === null) return '-';
                if (!identities.has(slot)) identities.set(slot, identities.size + 1);
                return [identities.get(slot), slot.seq, slot.loops, slot.next, slot.cycle, slot.frame, slot.delay].join(',');
            });
            const sounds: string[] = [];
            for (let i = 0; i < Client.soundEffectCount; i++) {
                sounds.push('sound', [Client.soundEffectIds[i], Client.soundEffectLoops[i], Client.soundEffectDelays[i], Client.soundEffectPositions[i]].join(','));
            }
            rows.push([result, ...slots, ...sounds].join(' '));
        }
        if (actor instanceof ClientNpc) {
            for (const guard of [-128, 81, 82, 127]) {
                let result = 'ok';
                try {
                    ClientNpc.applySlotAnims(actor, null, 0, null, null, guard);
                } catch (error) {
                    result = outcome(error);
                }
                rows.push('guard ' + guard + ' ' + result);
            }
        }
        if (actor instanceof ClientPlayer)
            for (const guard of [-128, -97, -96, 127]) {
                Object.assign(PlayerModel, { recolourDestinations2Alt: [] });
                ClientPlayer.applySlotAnims(new Int32Array(0), null, actor, null, guard);
                rows.push('guard ' + guard + ' ' + (PlayerModel.recolourDestinations2Alt === null));
            }
        if (actor instanceof ClientPlayer)
            for (const height of [-32768, -1, 0, 2147483647]) {
                actor.modelMinY = height;
                actor.update(7, 2, 48, 90, 120);
                rows.push('height ' + actor.getMinY());
            }
    }
    return rows;
}

loginFixture(
    import.meta.url,
    'HD entity steps, path resets and hits preserve original queue stores, faults and animation cancellation',
    async () => {
        SeqType.Init(localAssets(cachePath, [20]).archive(20), null, null);
        expect([0, 25, 618].map(id => SeqType.List(id).m_postanimMove)).toEqual([0, 2, 1]);
        const rows = commands();
        const work = mkdtempSync(join(tmpdir(), 'rs530-hd-entity-steps-'));
        try {
            const input = join(work, 'input.txt'),
                output = join(work, 'output.txt');
            writeFileSync(input, rows.join('\n'));
            const cp = [work, hdGamepackPath, joglPath].join(delimiter);
            const sources = ['GlRecorder', 'HdTitleFrameOracle', 'HdGlModelAnimationOracle', 'HdEntityStepsOracle'].map(n => join(import.meta.dir, n + '.java'));
            const build = Bun.spawnSync(['javac', '-encoding', 'UTF-8', '-cp', cp, '-d', work, ...sources]);
            expect(build.exitCode, build.stderr.toString()).toBe(0);
            const run = Bun.spawnSync([
                'java',
                '--add-opens=java.base/java.lang=ALL-UNNAMED',
                '-XX:-OmitStackTraceInFastThrow',
                '-Djava.awt.headless=true',
                '-Dgltrace.stacks=false',
                '-cp',
                cp,
                'HdEntityStepsOracle',
                cachePath,
                join(import.meta.dir, 'rtx5070.json'),
                input,
                output,
                hdGamepackPath
            ]);
            expect(run.exitCode, run.stderr.toString()).toBe(0);
            const native = readFileSync(output, 'utf8').trimEnd().split(/\r?\n/);
            expect(native).toHaveLength(rows.length + 36);
            let actor: ClientEntity = new ClientPlayer();
            for (const [i, row] of rows.entries()) {
                const words = row.split(' '),
                    v = words.slice(1).map(Number);
                let result = 'ok';
                try {
                    switch (words[0]) {
                        case 'new':
                            actor = v[0] === 0 ? new ClientPlayer() : new ClientNpc();
                            break;
                        case 'path':
                            Object.assign(actor, { pathX: ints(v[0], v[3], 3), pathZ: ints(v[1], v[4], -2), pathSpeed: v[2] < 0 ? null : Int8Array.from({ length: v[2] }, (_, k) => k - 5), pathLength: v[5], seqPathLength: v[6], seq: v[7] });
                            break;
                        case 'hits':
                            Object.assign(actor, { hitDamage: ints(v[0], -12, 3), hitType: ints(v[1], 5, 2), hitUntil: ints(v[2], v[3], 0) });
                            break;
                        case 'step':
                            actor.step(v[2], v[0], 3, v[1]);
                            break;
                        case 'reset':
                            actor.resetPath(v[0]);
                            break;
                        case 'hit':
                            actor.addHit(v[3], v[2], v[0], v[1]);
                            break;
                        case 'move':
                            actor.moveSized(v[0], v[2], v[1], v[3] !== 0);
                            break;
                        default:
                            throw new Error(row);
                    }
                } catch (e) {
                    result = outcome(e);
                }
                expect(snapshot(actor, result), i + ' ' + row).toBe(native[i]);
            }
            expect(slotTests()).toEqual(native.slice(rows.length));
        } finally {
            rmSync(work, { recursive: true, force: true });
        }
    },
    60000,
    'gl'
);
