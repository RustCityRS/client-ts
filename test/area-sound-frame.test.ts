import { expect } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import HashTable from '#/datastruct/HashTable.js';
import Linkable from '#/datastruct/Linkable.js';
import SharedPtrList from '#/datastruct/SharedPtrList.js';
import AreaSoundManager from '#/sound/AreaSoundManager.js';
import bgsound from '#/sound/bgsound.js';
import JagFX from '#/sound/JagFX.js';
import Preferences from '#/ui/Preferences.js';
import { JavaCheckedException, JavaError } from '#/util/JavaException.js';
import WrappedException from '#/util/WrappedException.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

type Vector = [site: number, failure: number, plane: number, elapsed: number, x: number, z: number];
loginFixture(
    import.meta.url,
    '530 area sound frame preserves original runtime wrapper identity argument order and partial updates',
    async () => {
        const temp = mkdtempSync(join(tmpdir(), '530-area-frame-')),
            observed = join(temp, 'observed');
        try {
            mkdirSync(observed);
            const asm = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'],
                cp = temp + delimiter + gamepackPath;
            function exec(args: string[], stdin?: string): string {
                const child = Bun.spawnSync(args, { stdin: stdin === undefined ? undefined : Buffer.from(stdin) });
                expect(child.exitCode, child.stderr.toString()).toBe(0);
                return child.stdout.toString().trimEnd();
            }
            exec(['javac', ...asm, '-cp', gamepackPath, '-d', temp, join(import.meta.dir, 'game/AreaSoundFrameOracle.java')]);
            exec(['java', ...asm, '-cp', cp, 'AreaSoundFrameOracle', gamepackPath, observed]);
            const raw = new Error('raw runtime'),
                checked = new JavaCheckedException(),
                serious = new JavaError(),
                original = JagFX.load;
            try {
                for (const probe of [false, true]) {
                    const rows: Vector[] = [];
                    for (const [plane, elapsed, x, z] of [
                        [0, 3, 49, 57],
                        [-1, -41, -6584, 65537],
                        [3, 2147483647, -2147483648, 2147483647],
                        [2, -2147483648, 2147483647, -2147483648]
                    ]) {
                        if (probe) {
                            for (const site of [12, 13]) for (const failure of [0, 1, 2, 3]) rows.push([site, failure, plane, elapsed, x, z]);
                        } else for (let site = 0; site <= 11; site++) rows.push([site, -1, plane, elapsed, x, z]);
                    }
                    const reference = exec(['java', ...asm, '-cp', probe ? observed + delimiter + cp : cp, 'AreaSoundFrameOracle'], rows.map(row => row.join(' ')).join('\n') + '\n').split(/\r?\n/);
                    expect(reference.length).toBe(rows.length);
                    for (const [index, row] of rows.entries()) {
                        const [site, failure, plane, elapsed, x, z] = row;
                        let loads = 0;
                        const wrapped = new WrappedException(raw, 'earlier.context');
                        const failures: Error[] = [raw, wrapped, checked, serious];
                        if (probe) {
                            JagFX.load = () => {
                                loads++;
                                throw failures[failure];
                            };
                        } else {
                            JagFX.load = original;
                        }
                        // The original list and table hold jf: all three CHECKCAST ik sites accept heterogeneous inputs.
                        const locs = new SharedPtrList<Linkable>(),
                            npcs = new SharedPtrList<Linkable>(),
                            players = new HashTable<Linkable>(16);
                        Object.assign(AreaSoundManager, { locs, npcs, players });
                        Client.m_pJagFx = null;
                        Preferences.areaSoundVolume = 91;
                        function emitter(): bgsound {
                            return Object.assign(new bgsound(), { minX: x, maxX: x, minZ: z, maxZ: z, plane, radius: 128, sound: -1, randomIds: Int32Array.of(53), delay: (elapsed + 5) | 0 });
                        }
                        const before = emitter(),
                            subject = emitter(),
                            after = emitter();
                        locs.push_back(before);
                        switch (site) {
                            case 0:
                                Reflect.set(AreaSoundManager, 'locs', null);
                                break;
                            case 1:
                                Reflect.set(AreaSoundManager, 'npcs', null);
                                break;
                            case 2:
                                Reflect.set(AreaSoundManager, 'players', null);
                                break;
                            case 3:
                                npcs.push_back(subject);
                                break;
                            case 4:
                                players.put(subject, 91n);
                                break;
                            case 5:
                                locs.push_back(new Linkable());
                                break;
                            case 6:
                                npcs.push_back(new Linkable());
                                break;
                            case 7:
                                players.put(new Linkable(), 91n);
                                break;
                            case 8:
                                subject.delay = (elapsed - 3) | 0;
                                subject.randomIds = new Int32Array(0);
                                locs.push_back(subject);
                                break;
                            case 9:
                            case 12:
                                subject.sound = 71;
                                locs.push_back(subject);
                                break;
                            case 13:
                                subject.delay = (elapsed - 3) | 0;
                                locs.push_back(subject);
                                break;
                        }
                        if (site !== 0) locs.push_back(after);
                        let fault = 'ok',
                            context = '-',
                            sameThrown = false,
                            sameCause = false;
                        try {
                            if (site === 10) AreaSoundManager.updateSource(null, x, elapsed, z, plane);
                            else AreaSoundManager.update(plane, elapsed, x, z);
                        } catch (error) {
                            let cause = error;
                            sameThrown = error === failures[failure];
                            if (error instanceof WrappedException) {
                                context = String(error.context);
                                cause = error.cause;
                            }
                            sameCause = cause === raw;
                            if (cause === checked) fault = 'checked';
                            else if (cause === serious) fault = 'error';
                            else if (cause === raw) fault = 'raw';
                            else if (cause instanceof RangeError) fault = 'bounds';
                            else if (cause instanceof TypeError) fault = cause.message.includes('ClassCastException') ? 'cast' : 'null';
                            else throw error;
                        }
                        expect([fault, context, [sameThrown, sameCause].join(','), loads, [before.delay, subject.delay, after.delay].join(',')].join('|'), row.join(' ')).toBe(reference[index]);
                    }
                }
            } finally {
                JagFX.load = original;
            }
        } finally {
            rmSync(temp, { recursive: true, force: true });
        }
    },
    30000
);
