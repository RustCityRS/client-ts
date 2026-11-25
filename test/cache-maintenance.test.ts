import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { gamepackPath } from './reference.js';
import LRUHashCache from '#/datastruct/LRUHashCache.js';
import AnimFrameSet from '#/dash3d/AnimFrameSet.js';
import BASTypeList from '#/config/BASTypeList.js';
import Client from '#/client/Client.js';
import ClientEntity from '#/dash3d/ClientEntity.js';
import IfType from '#/ui/IfType.js';
import CursorType from '#/config/CursorType.js';
import FloType from '#/config/FloType.js';
import FluType from '#/config/FluType.js';
import HintArrow from '#/client/HintArrow.js';
import IdkType from '#/config/IdkType.js';
import LightType from '#/config/LightType.js';
import LocType from '#/config/LocType.js';
import MSITypeList from '#/config/MSITypeList.js';
import NpcType from '#/config/NpcType.js';
import ObjType from '#/config/ObjType.js';
import PlayerModel from '#/dash3d/PlayerModel.js';
import SeqType from '#/config/SeqType.js';
import SoftwareFont from '#/graphics/SoftwareFont.js';
import SpotType from '#/config/SpotType.js';
import VarBitType from '#/config/VarBitType.js';
import VarpType from '#/config/VarpType.js';

const fields = [
    [FloType, 'm_list'], // ik.U:Lve;
    [FluType, 'm_list'], // vj.h:Lve;
    [IdkType, 'm_recentUse'], // hh.S:Lve;
    [LocType, 'm_recentUse'], // he.w:Lve;
    [LocType, 'm_mc1'], // lj.c:Lve;
    [LocType, 'm_mc2'], // vf.T:Lve;
    [LocType, 'm_mc3'], // uj.f:Lve;
    [NpcType, 'm_recentUse'], // gf.Z:Lve;
    [NpcType, 'm_modelCache'], // uk.k:Lve;
    [NpcType, 'headModelCache'], // pb.xc:Lve;
    [ObjType, 'types'], // fa.b:Lve;
    [ObjType, 'modelCache'], // ra.M:Lve;
    [ObjType, 'spriteCache'], // gb.r:Lve;
    [SeqType, 'm_recentUse'], // ga.B:Lve;
    [AnimFrameSet, 'cache'], // gl.x:Lve;
    [SpotType, 'm_recentUse'], // r.V:Lve;
    [SpotType, 'm_modelCache'], // m.O:Lve;
    [VarBitType, 'm_recentUse'], // cd.d:Lve;
    [VarpType, 'm_recentUse'], // vf.S:Lve;
    [BASTypeList, 'types'], // ig.n:Lve;
    [MSITypeList, 'types'], // hj.f:Lve;
    [MSITypeList, 'spriteCache'], // mk.A:Lve;
    [LightType, 'cache'], // ak.d:Lve;
    [CursorType, 'types'], // r.X:Lve;
    [CursorType, 'spriteCache'], // ii.i:Lve;
    [PlayerModel, 'modelCache2'], // vk.S:Lve;
    [PlayerModel, 'modelCache'], // gl.u:Lve;
    [IfType, 'm_spriteCache'], // bj.b:Lve;
    [IfType, 'm_modelCache'], // gf.S:Lve;
    [IfType, 'm_fontCache'], // cf.f:Lve;
    [HintArrow, 'modelCache'], // te.a:Lve;
    [ClientEntity, 'shadowModelCache'], // ml.w:Lve;
    [Client, 'npcHitbarSprites'], // wk.o:Lve;
    [SoftwareFont, 'cache'] // fa.p:Lve;
] as const;

test('ea ages and gf purges soft references across the 34 physical caches in Java order', () => {
    const dir = mkdtempSync(join(import.meta.dir, '../out/cache-maintenance-'));
    const saved = fields.map(([owner, name]) => Reflect.get(owner, name) as LRUHashCache<object>);
    const caches = fields.map(() => new LRUHashCache<object>(2));
    const value = {};
    const rows: string[] = [];
    const snapshot = (event: string): void => {
        const entries = caches.map(cache => {
            const node = cache['table'].get(1n);
            if (node === null) throw new Error('missing cache node');
            return (node.isSoft() ? 's' : 'h') + node.secondaryKey;
        });
        rows.push(event + ' ' + entries.join(' '));
    };
    function reset(): void {
        for (let i = 0; i < fields.length; i++) {
            const [owner, name] = fields[i];
            Reflect.set(owner, name, caches[i]);
            caches[i].Reset();
            caches[i].Put(1n, value);
        }
    }
    try {
        const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game/CacheMaintenanceOracle.java')]);
        expect(compile.stderr.toString()).toBe('');
        const oracle = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'CacheMaintenanceOracle']);
        expect(oracle.stderr.toString()).toBe('');
        expect(oracle.exitCode).toBe(0);
        rows.push('capacity ' + saved.map(cache => cache['m_cacheSize']).join(' '));
        for (let i = 0; i < fields.length; i++) {
            reset();
            const [owner, name] = fields[i];
            Reflect.set(owner, name, null);
            expect(() => Client.cleanCaches()).toThrow();
            snapshot('stop' + i);
        }
        reset();
        for (let tick = 0; tick <= 52; tick++) {
            if (tick !== 0) Client.cleanCaches();
            snapshot('tick' + tick);
            if (tick === 6 || tick === 50) {
                for (const i of [0, 10, 28]) expect(caches[i].Find(1n)).toBe(value);
            }
        }
        for (let interrupted = 0; interrupted <= fields.length; interrupted++) {
            reset();
            for (const cache of caches) {
                cache.Clean(0);
                cache.Put(2n, value);
            }
            if (interrupted < fields.length) {
                Reflect.set(fields[interrupted][0], fields[interrupted][1], null);
                expect(() => Client.removeSoftCaches()).toThrow();
            } else {
                Client.removeSoftCaches();
                Client.removeSoftCaches();
            }
            const state = caches.map(cache => {
                const kind = (key: bigint) => {
                    const node = cache['table'].get(key);
                    return node === null ? '-' : node.isSoft() ? 's' : 'h';
                };
                return kind(1n) + kind(2n) + cache['remaining'];
            });
            rows.push('removeSoft' + interrupted + ' ' + state.join(' '));
        }
        const native = oracle.stdout.toString().trim().split(/\r?\n/);
        expect(rows.length).toBe(native.length);
        for (let i = 0; i < rows.length; i++) expect(rows[i]).toBe(native[i]);
    } finally {
        for (let i = 0; i < fields.length; i++) Reflect.set(fields[i][0], fields[i][1], saved[i]);
        rmSync(dir, { recursive: true });
    }
});
