import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ClientBuild from '#/client/ClientBuild.js';
import WrappedException from '#/util/WrappedException.js';
import SeqType from '#/config/SeqType.js';
import SpotType from '#/config/SpotType.js';
import ClientNpc from '#/dash3d/ClientNpc.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import ClientProj from '#/dash3d/ClientProj.js';
import ClientProjNode from '#/dash3d/ClientProjNode.js';
import MapSpotAnim from '#/dash3d/MapSpotAnim.js';
import MapSpotAnimNode from '#/dash3d/MapSpotAnimNode.js';
import world from '#/dash3d/world.js';
import Linkable from '#/datastruct/Linkable.js';
import SharedPtrList from '#/datastruct/SharedPtrList.js';
import AreaSoundManager from '#/sound/AreaSoundManager.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

type Row = [map: number, variant: number, target: number, editAt: number, mutation: number];

function vectors(): Row[] {
    const rows: Row[] = [];
    for (let variant = 0; variant < 17; variant++) {
        rows.push([1, variant, 0, 0, 0]);
        for (const target of [0, 1, 2, 4, -1, -3, -5, -7, -2147483648]) rows.push([0, variant, target, 0, 0]);
    }
    for (const [map, target, limit] of [
        [1, 0, 28],
        [0, 2, 64],
        [0, -5, 64],
        [0, -3, 64]
    ]) {
        for (let at = 1; at <= limit; at++) {
            for (let mutation = 1; mutation <= 5; mutation++) rows.push([map, 0, target, at, mutation]);
        }
    }
    return rows;
}

loginFixture(
    import.meta.url,
    'map animations and projectiles match native 530 field reads, queue continuation and scene submissions',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-gdm-effects-'));
        try {
            const asm = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED'];
            const cc = Bun.spawnSync(['javac', ...asm, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game/GdmEffectsOracle.java')]);
            expect(cc.exitCode, cc.stderr.toString()).toBe(0);
            const java = ['java', ...asm, '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'GdmEffectsOracle'];
            const prepare = Bun.spawnSync([...java, gamepackPath, dir]);
            expect(prepare.exitCode, prepare.stderr.toString()).toBe(0);
            const rows = vectors();
            const jvm = Bun.spawnSync(java, { stdin: Buffer.from(rows.map(row => row.join(' ')).join('\n') + '\n'), maxBuffer: 4 * 1024 * 1024 });
            expect(jvm.exitCode, jvm.stderr.toString()).toBe(0);
            const expected = jvm.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected.length).toBe(rows.length);

            const spotType = new SpotType();
            spotType.seq = 3;
            SpotType.m_recentUse.Put(7n, spotType);
            const seq = new SeqType();
            seq.delays = Int32Array.of(1, 2, 3);
            seq.frames = Int32Array.of(0, 1, 2);
            seq.m_loops = 2;
            SeqType.m_recentUse.Put(3n, seq);
            const heights = Array.from({ length: 4 }, (_, p) => Array.from({ length: 105 }, (_, x) => Int32Array.from({ length: 105 }, (_, z) => p * 210 + x * 3 - z * 17)));
            ClientBuild.m_mapl = Array.from({ length: 4 }, () => Array.from({ length: 104 }, () => new Uint8Array(104)));
            ClientBuild.m_mapl[1][4][6] = 2;
            world.underwaterHeightmap = null;

            let active = false;
            let observe: (event: string) => void = () => {};
            const ids = new Map<object, number>();
            const ident = (object: object | null) => (object === null ? -9 : (ids.get(object) ?? -9));
            function watch<T extends object>(owner: T, fields: Partial<Record<keyof T, string>>): void {
                for (const [key, name] of Object.entries(fields)) {
                    let slot = Reflect.get(owner, key);
                    Object.defineProperty(owner, key, {
                        configurable: true,
                        get() {
                            const previous = slot;
                            if (active) observe(String(name));
                            return previous;
                        },
                        set(value) {
                            slot = value;
                        }
                    });
                }
            }
            function call<T>(event: string, original: () => T): T {
                observe(event);
                active = false;
                try {
                    return original();
                } finally {
                    active = true;
                }
            }
            const getHeight = Client.GetAvH,
                aim = ClientProj.prototype.setTarget;
            const step = ClientProj.prototype.advance,
                spotStep = MapSpotAnim.prototype.advance,
                add = world.AddDynamic;
            Client.GetAvH = (x, z, level, guard) => call('height' + [level, x, z, guard], () => getHeight(x, z, level, guard));
            ClientProj.prototype.setTarget = function (x, y, z, tick) {
                return call('aim' + [ident(this), x, y, z, tick], () => aim.call(this, x, y, z, tick));
            };
            ClientProj.prototype.advance = function (delta) {
                return call('advance' + [ident(this), delta], () => step.call(this, delta));
            };
            MapSpotAnim.prototype.advance = function (delta) {
                return call('advance' + [ident(this), delta], () => spotStep.call(this, delta));
            };
            world.AddDynamic = (level, x, z, y, radius, model, yaw, key, extend) => call('add' + [ident(model), level, x, z, y, radius, yaw, key, extend], () => add(level, x, z, y, radius, model, yaw, key, extend));
            watch(Client, { projectiles: 'cg.f', playerLevel: 'ah.f', loopCycle: 'hh.kb', npcs: 'uc.l', players: 'tf.J', localPlayer: 'te.g', localPid: 'mi.y' });
            watch(MapSpotAnim, { active: 'ph.g' });
            watch(AreaSoundManager, { elapsed: 'id.p' });

            for (const [i, row] of rows.entries()) {
                const [map, variant, target, editAt, mutation] = row;
                const list = new SharedPtrList(),
                    alt = new SharedPtrList();
                const publish = (queue: SharedPtrList) => Reflect.set(map ? MapSpotAnim : Client, map ? 'active' : 'projectiles', queue);
                publish(list);
                Client.playerLevel = 1;
                Client.loopCycle = 10;
                AreaSoundManager.elapsed = 1;
                Client.localPid = 4;
                const npc = Object.assign(new ClientNpc(), { x: 521, z: 833 });
                const player = Object.assign(new ClientPlayer(), { x: 702, z: 901 });
                const self = Object.assign(new ClientPlayer(), { x: 883, z: 401 });
                Reflect.set(Client, 'npcs', [null, npc, null]);
                Reflect.set(Client, 'players', [null, null, player, null]);
                Client.localPlayer = self;
                world.squares = Array.from({ length: 4 }, () => Array.from({ length: 16 }, () => Array(16).fill(null)));
                world.maxTileX = world.maxTileZ = 16;
                world.dynamicSprites = Array(40).fill(null);
                world.dynamicCount = 0;
                world.levelHeightmaps = heights;
                const proj = new ClientProj(7, 1, 411, 654, 19, 10, 16, -1, 2, target, 15);
                proj.x = 511.75;
                proj.z = 712.5;
                proj.y = -98.75;
                const spot = new MapSpotAnim(7, 1, 610, 720, -360, 0, 10);
                const p2 = new ClientProj(7, 1, 330, 490, -15, 2, 9, -1, 2, 0, 25),
                    p3 = new ClientProj(7, 1, 330, 490, -15, 12, 180, -1, 2, 0, 25);
                const s2 = new MapSpotAnim(7, 1, 382, 421, -39, 0, 13),
                    s3 = new MapSpotAnim(7, 2, 431, 400, 8, 0, 9);
                ids.clear();
                function put(owner: SharedPtrList, model: MapSpotAnim | ClientProj, id: number): void {
                    const node = model instanceof MapSpotAnim ? new MapSpotAnimNode(model) : new ClientProjNode(model);
                    if (node instanceof MapSpotAnimNode) watch(node, { spot: 'qg.E' });
                    else watch(node, { projectile: 'tf.G' });
                    ids.set(model, id);
                    ids.set(node, id);
                    owner.push_back(node);
                }
                if (map) {
                    put(list, s3, 2);
                    put(list, spot, 1);
                    put(list, s2, 3);
                } else {
                    put(list, p2, 2);
                    put(list, proj, 1);
                    put(list, p3, 3);
                }
                if (variant === 1) AreaSoundManager.elapsed = 20;
                if (variant === 2) {
                    Client.loopCycle = 17;
                    spot.finished = true;
                }
                if (variant === 3) {
                    npc.z = 13312;
                    self.x = -1;
                    player.x = 13311;
                }
                if (variant === 4) {
                    proj.x = NaN;
                    proj.z = Infinity;
                    proj.y = -Infinity;
                }
                if (variant === 5) {
                    proj.x = -2147483649;
                    proj.z = 2147483648;
                    proj.y = -0;
                }
                if (variant === 6) world.dynamicSprites = [];
                if (variant === 7) {
                    const extra = new Linkable();
                    list.push_back(extra);
                    ids.set(extra, 4);
                }
                if (variant === 8) {
                    const extra = map ? new MapSpotAnimNode(spot) : new ClientProjNode(proj);
                    if (extra instanceof MapSpotAnimNode) {
                        Reflect.set(extra, 'spot', null);
                        watch(extra, { spot: 'qg.E' });
                    } else {
                        Reflect.set(extra, 'projectile', null);
                        watch(extra, { projectile: 'tf.G' });
                    }
                    list.push_back(extra);
                    ids.set(extra, 4);
                }
                if (variant === 9) {
                    Reflect.set(Client, 'npcs', null);
                    Reflect.set(Client, 'players', null);
                }
                if (variant === 10) Client.playerLevel = 2;
                if (variant === 11) world.levelHeightmaps = null;
                if (variant === 12) Client.loopCycle = 16;
                if (variant === 13) Client.loopCycle = -2147483648;
                if (variant === 14) {
                    npc.x = 0;
                    npc.z = 0;
                    self.x = 13311;
                    self.z = 13311;
                    player.x = 13312;
                }
                if (variant === 15) {
                    AreaSoundManager.elapsed = -3;
                    player.z = -1;
                    npc.x = 13312;
                    self.x = 13312;
                }
                if (variant === 16) {
                    Reflect.set(proj, 'endHeight', -2147483648);
                    Reflect.set(proj, 'endCycle', 2147483647);
                }
                put(alt, map ? s2 : p3, 5);
                alt.head();
                for (const actor of [npc, player, self]) watch(actor, { x: 'ob.Z', z: 'ob.S' });
                for (const p of [proj, p2, p3]) watch(p, { plane: 'hl.V', endCycle: 'hl.u', startCycle: 'hl.U', target: 'hl.s', endHeight: 'hl.T', x: 'hl.O', z: 'hl.v', y: 'hl.L', yaw: 'hl.o' });
                for (const s of [spot, s2, s3]) watch(s, { plane: 'ac.m', finished: 'ac.x', startCycle: 'ac.y', x: 'ac.C', z: 'ac.u', y: 'ac.n' });
                let reads = 0,
                    trace = '',
                    fault = 'ok';
                observe = event => {
                    trace += event + ';';
                    if (++reads !== editAt) return;
                    switch (mutation) {
                        case 1:
                            Client.playerLevel = 2;
                            Client.loopCycle = 13;
                            AreaSoundManager.elapsed = 3;
                            break;
                        case 2:
                            Reflect.set(proj, 'target', -5);
                            Reflect.set(proj, 'plane', 2);
                            Reflect.set(proj, 'endHeight', -47);
                            spot.plane = 2;
                            spot.finished = true;
                            break;
                        case 3:
                            publish(alt);
                            break;
                        case 4:
                            throw Error('fixture');
                        case 5:
                            npc.x = 1111;
                            self.z = 188;
                            player.x = 13312;
                            Client.localPid = 2;
                            break;
                    }
                };
                active = true;
                try {
                    if (map) Client.GdmAddMapAnim();
                    else Client.GdmAddProjectiles();
                } catch (caught) {
                    let e = caught;
                    while (e instanceof WrappedException) e = e.cause;
                    fault = e instanceof TypeError ? (e.message.includes('ClassCastException') ? 'cast' : 'null') : e instanceof RangeError ? 'bounds' : e instanceof Error && e.message === 'fixture' ? 'fixture' : String(e);
                } finally {
                    active = false;
                }
                const state = (queue: SharedPtrList) => {
                    let result = '';
                    for (let n = queue.sentinel.next; n !== queue.sentinel; n = requireNonNull(n).next) result += ident(n);
                    const next = queue['cursor'];
                    return result + ':' + (next === null ? 'n' : next === queue.sentinel ? 's' : ident(next));
                };
                let inserted = '';
                for (const sprite of requireNonNull(world.dynamicSprites))
                    if (sprite !== null) {
                        inserted += [ident(sprite.model), sprite.level, sprite.x, sprite.z, sprite.y, sprite.yaw].join(',') + ';';
                    }
                expect([fault, trace, state(list), state(alt), world.dynamicCount, inserted].join('|'), row.join(' ')).toBe(expected[i]);
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    40000
);
