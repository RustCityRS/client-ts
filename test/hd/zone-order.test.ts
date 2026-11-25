import { expect } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import LocMergeQueue from '#/client/LocMergeQueue.js';
import BASTypeList from '#/config/BASTypeList.js';
import LocShape from '#/dash3d/LocShape.js';
import SpotType from '#/config/SpotType.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import ClientObj from '#/dash3d/ClientObj.js';
import ClientObjNode from '#/dash3d/ClientObjNode.js';
import SharedPtrList from '#/datastruct/SharedPtrList.js';
import MapSpotAnim from '#/dash3d/MapSpotAnim.js';
import Pix3D from '#/dash3d/Pix3D.js';
import world from '#/dash3d/world.js';
import GlRenderer from '#/gl/GlRenderer.js';
import Protocol from '#/io/Protocol.js';
import SuperPacket from '#/io/SuperPacket.js';
import Preferences from '#/ui/Preferences.js';
import { JavaError } from '#/util/JavaException.js';
import WrappedException from '#/util/WrappedException.js';
import { loginFixture } from '../login-fixture.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

class Boundary extends JavaError {}
const fields: [object, string, string][] = [
    [Protocol, 'packetType', 'na.l'],
    [Protocol, 'inPacket', 'eg.e'],
    [Protocol, 'zoneUpdateX', 'ja.q'],
    [Protocol, 'zoneBaseZ', 'og.b'],
    [LocShape, 'shapeToLayer', 'kf.h'],
    [Client, 'playerLevel', 'ee.b'],
    [Client, 'groundObj', 'mi.Y'],
    [Client, 'loopCycle', 'gj.d'],
    [Client, 'projectiles', 'rj.U'],
    [MapSpotAnim, 'active', 'hk.W'],
    [GlRenderer, 'active', 'tf.w'],
    [Client, 'localPid', 'bf.E'],
    [Client, 'npcs', 'nm.S'],
    [Client, 'players', 'mi.S'],
    [Client, 'localPlayer', 'nk.O'],
    [Pix3D, 'sinTable', 'hf.g'],
    [Pix3D, 'cosTable', 'hf.r'],
    [Preferences, 'areaSoundVolume', 'cg.f'],
    [Client, 'soundEffectCount', 'pe.j'],
    [Client, 'soundEffectIds', 'qe.t'],
    [Client, 'soundEffectLoops', 'wh.g'],
    [Client, 'soundEffectDelays', 'na.mb'],
    [Client, 'soundEffects', 'nk.n'],
    [Client, 'soundEffectPositions', 'ca.fb']
];
type Case = [number, number, number, number, number, number, number, Buffer];
const opcodes = [195, 33, 121, 17, 179, 20, 202, 14, 135, 16, 104, 97, 240, 255];
function packet(op: number): Buffer {
    const b = Buffer.alloc(24);
    if (op === 179) b[0] = 128;
    if (op === 20) b[0] = b[1] = 128;
    if (op === 240) b[0] = 128;
    if (op === 97) {
        b[2] = 18;
        b[3] = 0x26;
        b[4] = 103;
    }
    if (op === 135) {
        b[0] = 129;
    }
    return b;
}
function cases(): Case[] {
    const list: Case[] = [];
    for (const op of opcodes) {
        const b = packet(op);
        for (const active of [0, 1]) for (const base of [0, 200]) for (const guard of [-99, -82, -66]) list.push([op, base, active, guard, 0, 0, 0, b]);
        for (let length = 0; length < 19; length++) list.push([op, 200, 0, -99, 0, 0, 0, b.subarray(0, length)]);
        for (const at of [1, 5, 10, 20, 30]) list.push([op, 0, 0, -99, at, 0, 0, b]);
    }
    for (let gate = 1; gate <= 13; gate++) for (const op of opcodes) list.push([255, 200, 0, -82, 0, gate, op, packet(op)]);
    for (const signedSource of [1, -1, -2]) {
        const b = packet(104);
        b.writeInt16BE(signedSource, 3);
        list.push([104, 0, 0, -99, 0, 0, 0, b]);
    }
    return list;
}
function run([op, base, active, guard, stop, swap, replacement, bytes]: Case): string {
    Protocol.packetType = op;
    Protocol.inPacket = new SuperPacket(0);
    Protocol.inPacket.m_data = Uint8Array.from(bytes);
    Protocol.zoneUpdateX = Protocol.zoneBaseZ = base;
    GlRenderer.active = active === 1;
    Client.localPid = Client.playerLevel = 0;
    Client.loopCycle = 100;
    Client.soundEffectCount = 0;
    Preferences.areaSoundVolume = 127;
    Client.groundObj = [Array.from({ length: 8 }, () => Array(8).fill(null))];
    if (base === 0 && (op === 14 || op === 240)) {
        const items = new SharedPtrList<ClientObjNode>();
        items.push_back(new ClientObjNode(new ClientObj()));
        Client.groundObj[0][0][0] = items;
    }
    Client.projectiles.clear();
    MapSpotAnim.active.clear();
    Client.soundEffectIds.fill(0);
    Client.soundEffectLoops.fill(0);
    Client.soundEffectDelays.fill(0);
    Client.soundEffectPositions.fill(0);
    const events: string[] = [];
    let gates = 0;
    function emit(event: string): void {
        events.push(event);
        if (events.length === stop) throw new Boundary();
    }
    const restore: (() => void)[] = [];
    for (const [owner, key, tag] of fields) {
        const d = Object.getOwnPropertyDescriptor(owner, key);
        if (!d || !('value' in d)) throw new Error('Missing static ' + key);
        let value: unknown = d.value;
        Object.defineProperty(owner, key, {
            configurable: true,
            get() {
                if ((new Error().stack?.split('\n')[2] ?? '').includes('ZonePacket')) {
                    emit(tag);
                    if (tag === 'na.l' && ++gates === swap) value = replacement;
                }
                return value;
            },
            set(next: unknown) {
                if ((new Error().stack?.split('\n')[2] ?? '').includes('ZonePacket')) emit('+' + tag);
                value = next;
            }
        });
        restore.push(() => Object.defineProperty(owner, key, { ...d, value }));
    }
    const loc = Client.LocChangeCreate,
        anim = Client.attachLocAnim,
        show = Client.ShowObject,
        merge = LocMergeQueue.enqueue;
    Client.LocChangeCreate = (...args) => emit('loc=[' + args.join(', ') + ']');
    Client.attachLocAnim = (...args) => emit('anim=[' + args.slice(0, 7).join(', ') + ']');
    Client.ShowObject = (z, x) => emit('show=' + z + ',' + x);
    LocMergeQueue.enqueue = (...args) => emit('merge=[' + args.join(', ') + ']');
    let status = 'ok';
    try {
        Client.ZonePacket(guard);
    } catch (e) {
        if (e instanceof Boundary) status = 'stop';
        else if (e instanceof WrappedException) {
            const cause = e.cause;
            status = (cause instanceof RangeError ? 'ArrayIndexOutOfBoundsException' : cause instanceof TypeError ? 'NullPointerException' : String(cause)) + '@' + e.context;
        } else throw e;
    } finally {
        for (const revert of restore) revert();
        Client.LocChangeCreate = loc;
        Client.attachLocAnim = anim;
        Client.ShowObject = show;
        LocMergeQueue.enqueue = merge;
    }
    return [status, Protocol.inPacket.m_pos, Protocol.packetType, [Client.soundEffectCount, Client.soundEffectIds[0], Client.soundEffectLoops[0], Client.soundEffectDelays[0], Client.soundEffectPositions[0]].join(','), events.join(';')].join('|');
}
loginFixture(
    import.meta.url,
    'HD zone dispatcher preserves the original thirteen branch tests, operands and exceptional prefixes',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), '530-hd-zone-order-'));
        try {
            const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            execFileSync('javac', [asm, '-cp', cp, '-d', dir, join(import.meta.dir, 'HdZoneOrderOracle.java')]);
            const java = [asm, '-Djava.awt.headless=true', '-cp', cp, 'HdZoneOrderOracle'];
            execFileSync('java', [...java, dir]);
            const rows = cases();
            const input = rows.map(r => r.slice(0, 7).join(' ') + ' ' + (r[7].toString('hex') || '-')).join('\n') + '\n';
            const result = execFileSync('java', java, { input, encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 })
                .trimEnd()
                .split(/\r?\n/);
            expect(result.length).toBe(rows.length);
            SpotType.m_recentUse.Put(0n, new SpotType());
            Client.localPlayer = new ClientPlayer();
            BASTypeList.defaultType.transforms = [Int32Array.of(31, 15, 17)];
            world.levelHeightmaps = null;
            for (const [i, row] of rows.entries()) expect(run(row), row.slice(0, 7).join(' ') + ' bytes=' + row[7].toString('hex')).toBe(result[i].replace(/\b\d+:(?=\+?[A-Za-z]+\.)/g, ''));
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    30000,
    'gl'
);
