import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import GameVariant from '#/client/GameVariant.js';
import PlayerModel from '#/dash3d/PlayerModel.js';
import GlLighting from '#/gl/GlLighting.js';
import Minimenu from '#/ui/Minimenu.js';
import Signlink from '#/util/Signlink.js';
import { loginFixture } from '../login-fixture.js';
import { attachMainInitHost } from '../main-init-fixture.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

const variants = [0, 1, 0, 2, 1, -1];

function oracle(): string[][] {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-hd-init-recolour-'));
    const asm = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
    const classpath = [dir, hdGamepackPath, joglPath].join(delimiter);
    const java = ['java', ...asm, '-Djava.awt.headless=true', '-Duser.home=' + dir, '-cp', classpath, 'HdInitRecolourOracle'];
    try {
        const compile = Bun.spawnSync(['javac', ...asm, '-cp', classpath, '-d', dir, join(import.meta.dir, 'HdInitRecolourOracle.java')]);
        expect(compile.exitCode, compile.stderr.toString()).toBe(0);
        const instrument = Bun.spawnSync([...java, 'instrument', hdGamepackPath, dir]);
        expect(instrument.exitCode, instrument.stderr.toString()).toBe(0);
        const run = Bun.spawnSync([...java, ...variants.map(String)], { timeout: 20000 });
        expect(run.exitCode, run.stderr.toString()).toBe(0);
        return run.stdout
            .toString()
            .trim()
            .split(/\r?\n/)
            .map(line => line.split(' '));
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

function hash(array: Int16Array | Int16Array[]): number {
    let result = 1;
    for (const item of array) result = (Math.imul(result, 31) + (typeof item === 'number' ? item : hash(item))) | 0;
    return result;
}

loginFixture(
    import.meta.url,
    'HD client.g publishes each product palette in JAR order with the original table identities and contents',
    async () => {
        const expected = oracle();
        expect(expected).toHaveLength(variants.length);
        const ids = new Map<unknown, string>([
            [PlayerModel.recolourDestinationsRs, 'md.V'],
            [PlayerModel.recolourSources2Rs, 'pk.V'],
            [PlayerModel.recolourDestinations2Rs, 'dg.c'],
            [PlayerModel.recolourSourcesRs, 'vd.B'],
            [PlayerModel.recolourDestinationsAlt, 'q.d'],
            [PlayerModel.recolourDestinations2Alt, 'ci.u'],
            [PlayerModel.recolourSourcesAlt, 'aa.h'],
            [PlayerModel.recolourSources2Alt, 'bj.t']
        ]);
        const writes: string[] = [];
        function watch<T, K extends keyof T>(owner: T, key: K, slot: string) {
            let current = owner[key];
            Object.defineProperty(owner, key, {
                configurable: true,
                get: () => current,
                set(value: T[K]) {
                    current = value;
                    if (typeof value === 'boolean' || typeof value === 'number') {
                        writes.push(slot + '=' + value);
                    } else if (ids.has(value) && (Array.isArray(value) || value instanceof Int16Array)) {
                        writes.push(slot + '=' + ids.get(value) + ':' + hash(value));
                    } else {
                        throw new Error('unexpected reference assigned to ' + slot);
                    }
                }
            });
        }
        watch(PlayerModel, 'recolourDestinations', 'cj.e');
        watch(PlayerModel, 'recolourSources2', 'mj.C');
        watch(PlayerModel, 'recolourDestinations2', 'nj.m');
        watch(PlayerModel, 'recolourSources', 'qe.r');
        watch(Minimenu, 'shiftClick', 'nj.a');
        watch(GlLighting, 'defaultSunColour', 'mk.k');
        watch(GlLighting, 'defaultFogColour', 'mk.e');

        const game = new Client();
        attachMainInitHost(game);
        Client.modeWhere = 2;
        GameShell.signlink = new Signlink({ getSize: () => ({ width: 765, height: 503 }) });
        try {
            for (const [index, variant] of variants.entries()) {
                GameVariant.id = variant;
                writes.length = 0;
                try {
                    await game['MainInit']();
                    expect(writes, 'product ' + variant).toEqual(expected[index]);
                } finally {
                    await Client.js5DiskQueue?.EndAndJoin();
                }
            }
        } finally {
            await GameShell.signlink.stopWorker();
        }
    },
    45000,
    'gl'
);
