import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import GameVariant from '#/client/GameVariant.js';
import ModelLitImpl from '#/dash3d/ModelLitImpl.js';
import ModelUnlit from '#/dash3d/ModelUnlit.js';
import Pix3D from '#/dash3d/Pix3D.js';
import PlayerModel from '#/dash3d/PlayerModel.js';
import Minimenu from '#/ui/Minimenu.js';
import Signlink from '#/util/Signlink.js';
import { attachMainInitHost } from './main-init-fixture.js';
import { localAssets } from './cachefile.js';
import { loginFixture } from './login-fixture.js';
import { cachePath, gamepackPath } from './reference.js';

type Row = [variant: number, stop: number];
const transitions: Row[] = [
    [0, 0],
    [1, 0],
    [0, 0],
    [0, 0],
    [1, 0],
    [2, 0],
    [-1, 0]
];
const rows = [...transitions];
for (const variant of [0, 1]) {
    for (let stop = 1; stop <= (variant === 0 ? 4 : 5); stop++) {
        rows.push([1 - variant, 0], [variant, stop]);
    }
}

function hash(values: Int16Array | Int32Array | null): number {
    if (values === null) return 0;
    let result = 1;
    for (const value of values) result = (Math.imul(result, 31) + value) | 0;
    return result;
}

function head(female: boolean): string {
    PlayerModel.modelCache.Reset();
    const player = new PlayerModel();
    player.setAppearance(female, Int32Array.of(2, 3, 4, 1, 3), 0, null, -1);
    const model = player.GetHeadModel(0, 0, null, 0);
    expect(model).toBeInstanceOf(ModelLitImpl);
    if (!(model instanceof ModelLitImpl)) throw new Error('missing kit head');
    expect(model['numFaces']).toBeGreaterThan(0);
    return [model === player.GetHeadModel(0, 0, null, 0), model['numFaces'], hash(model['faceColour']), hash(model['faceColourA']), hash(model['faceColourB']), hash(model['faceColourC'])].join(',');
}

loginFixture(
    import.meta.url,
    'client.b publishes both live player palettes in Java order and recolours real player heads',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-init-recolour-'));
        const asm = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
        try {
            const build = Bun.spawnSync([
                'javac',
                ...asm,
                '-cp',
                gamepackPath,
                '-d',
                dir,
                join(import.meta.dir, 'game', 'InitRecolourOracle.java'),
                join(import.meta.dir, 'game', 'ClientBootOracle.java'),
                join(import.meta.dir, 'review', 'model-mesh', 'ModelMeshOracle.java')
            ]);
            expect(build.exitCode, build.stderr.toString()).toBe(0);
            const java = ['java', ...asm, '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'InitRecolourOracle'];
            const oracle = (commands: Row[]) => {
                const run = Bun.spawnSync([...java, cachePath], { stdin: Buffer.from(commands.map(row => row.join(' ')).join('\n') + '\n'), timeout: 20000 });
                expect(run.exitCode, run.stderr.toString()).toBe(0);
                const output = run.stdout.toString().trimEnd().split(/\r?\n/);
                expect(output.length).toBe(commands.length);
                return output;
            };
            const plain = oracle(transitions);
            const patch = Bun.spawnSync([...java, 'instrument', gamepackPath, dir]);
            expect(patch.exitCode, patch.stderr.toString()).toBe(0);
            const expected = oracle(rows);
            const publicState = (line: string) => line.split('|').slice(0, 3).join('|');
            expect(expected.slice(0, transitions.length).map(publicState)).toEqual(plain.map(publicState));
            expect(plain[0].split('|')[2]).not.toBe(plain[1].split('|')[2]);
            expect(plain[2].split('|')[2]).toBe(plain[0].split('|')[2]);

            localAssets(cachePath, [2, 7]);
            // The original pc stand-in used when fc lights a textured face in ModelMeshOracle.
            Pix3D.textureProvider = {
                getTextureSmall: () => true,
                isAvailable: id => id % 7 !== 3,
                getPixels: () => null,
                isLoaded: () => true,
                getTextureData: () => null,
                getTextureColour: id => (Math.imul(id, 0x1f3d) + 0x123) & 0xffff,
                getTextureSolid: id => (id & 1) === 0
            };
            const game = new Client();
            attachMainInitHost(game);
            await using _worker = {
                link: (GameShell.signlink = new Signlink({ getSize: () => ({ width: 765, height: 503 }) })),
                async [Symbol.asyncDispose]() {
                    await this.link.stopWorker();
                }
            };
            Client.modeWhere = 2;
            const ids = new Map<unknown, string>([
                [null, '-'],
                [false, 'false'],
                [true, 'true'],
                [PlayerModel.recolourSources2Alt, 'gj.U'],
                [PlayerModel.recolourDestinations2Alt, 'gk.o'],
                [PlayerModel.recolourSourcesAlt, 'uh.Y'],
                [PlayerModel.recolourDestinationsAlt, 'gk.b'],
                [PlayerModel.recolourSources2Rs, 'lh.e'],
                [PlayerModel.recolourDestinations2Rs, 'ie.J'],
                [PlayerModel.recolourSourcesRs, 'ik.Z'],
                [PlayerModel.recolourDestinationsRs, 'pk.c']
            ]);
            function id(value: unknown): string {
                const tag = ids.get(value);
                if (tag === undefined) throw new Error('unexpected palette identity');
                return tag;
            }
            function state() {
                return [PlayerModel.recolourSources2, PlayerModel.recolourDestinations2, PlayerModel.recolourSources, PlayerModel.recolourDestinations, Minimenu.shiftClick].map(id).join('/');
            }
            const writes: string[] = [],
                recolours: string[] = [];
            const interrupt = new Error('palette write watchpoint');
            let stop = 0;
            function watch<T, K extends keyof T>(owner: T, key: K, slot: string) {
                let current = owner[key];
                Object.defineProperty(owner, key, {
                    configurable: true,
                    get: () => current,
                    set(value: T[K]) {
                        writes.push(slot + '=' + id(value) + '@' + state());
                        if (writes.length === stop) throw interrupt;
                        current = value;
                    }
                });
            }
            watch(PlayerModel, 'recolourSources2', 'wg.b');
            watch(PlayerModel, 'recolourDestinations2', 'ij.j');
            watch(PlayerModel, 'recolourSources', 'sa.u');
            watch(PlayerModel, 'recolourDestinations', 'm.C');
            watch(Minimenu, 'shiftClick', 'pb.sc');
            const original = ModelUnlit.prototype.Recolour;
            ModelUnlit.prototype.Recolour = function (from, to) {
                const before = hash(this.faceColour);
                original.call(this, from, to);
                recolours.push(from + '>' + to + ':' + before + '>' + hash(this.faceColour));
            };

            for (const [i, [variant, fail]] of rows.entries()) {
                GameVariant.id = variant;
                stop = fail;
                writes.length = recolours.length = 0;
                let status = 'ok',
                    heads = '-';
                try {
                    await game['MainInit']();
                    heads = head(false) + ';' + head(true);
                } catch (error) {
                    if (error !== interrupt) throw error;
                    status = 'stop';
                } finally {
                    await Client.js5DiskQueue?.EndAndJoin();
                }
                expect([status, state(), heads, writes.join(';'), recolours.join(';')].join('|'), 'row ' + i + ' variant ' + variant + ' write ' + fail).toBe(expected[i]);
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    50000,
    'sd'
);
