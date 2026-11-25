import ProtocolInput from './protocol-input.js';
import { setLocalWorld, saveWorldConnection } from './world-connection.js';
import GameClient from '#/client/Client.js';
import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { delimiter, resolve } from 'node:path';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import PlayerModel from '#/dash3d/PlayerModel.js';
import Login from '#/io/Login.js';
import PacketT from '#/io/PacketT.js';
import SuperPacket from '#/io/SuperPacket.js';
import { intQuery } from './int-query.js';
import IfType from '#/ui/IfType.js';
import InterfaceList from '#/ui/InterfaceList.js';
import LocalisedText from '#/ui/LocalisedText.js';
import SubInterface from '#/ui/SubInterface.js';
import { arrayAt, requireNonNull } from '#/util/JavaArray.js';
import { localAssets } from './cachefile.js';
import HashTable from '#/datastruct/HashTable.js';
import { cachePath, gamepackPath } from './reference.js';

const ops = [3300, 3305, 3306, 3307, 3308, 3309, 3310, 3311, 3312, 3316, 3317, 3318, 3321, 3322, 3323, 3324, 3325, 3326, 3327, 3328, 3329, 3333, 3335, 3336, 3337];
function args(op: number, step: number): number[] {
    if (op >= 3305 && op <= 3307) return [step % 25];
    if (op >= 3309 && op <= 3311) return [Math.imul(0x8008f112, step)];
    if (op === 3336) return [step * 0x7031c, step - 30, 7 - step, Math.imul(0x7fffff11, step)];
    return [];
}
function hash(values: Int32Array): number {
    return values.reduce((h, v) => (Math.imul(h, 31) + v) | 0, 1);
}

test('rg stat, energy, weight and reboot packets feed IF1 redraws, transmit hooks and all non-inventory gh 33xx queries', async () => {
    const inputStream = new ProtocolInput();
    const saved = {
        bits: GameClient.members,
        member: GameClient.playerMember,
        rights: { staffModLevel: GameClient.staffModLevel, blackmarks: GameClient.blackmarks, underage: GameClient.underage, parentalChatConsent: GameClient.parentalChatConsent, mapQuickChat: GameClient.mapQuickChat },
        player: GameClient.localPlayer,
        plane: GameClient.playerLevel,
        x: GameClient.mapBuildBaseX,
        z: GameClient.mapBuildBaseZ,
        energy: GameClient.runenergy,
        weight: GameClient.runWeight,
        reboot: GameClient.rebootTimer,
        cycle: GameClient.loopCycle,
        lang: LocalisedText.language,
        login: Login.loginType,
        levels: GameClient.statEffectiveLevel.slice(),
        base: GameClient.statBaseLevel.slice(),
        xp: GameClient.statXP.slice(),
        ring: requireNonNull(GameClient.statUpdates).slice(),
        changes: GameClient.changedStatCount,
        changedAt: InterfaceList.miscTransmitAt,
        uiCycle: GameClient.transmitCycle,
        dirty: InterfaceList.dirty[9],
        table: InterfaceList.subInterfaces,
        groups: IfType.m_list,
        loaded: IfType.m_open
    };
    localAssets(cachePath, []);
    const savedWorld = saveWorldConnection();
    setLocalWorld(1);
    const parent = new IfType(),
        child = new IfType(),
        sub = new SubInterface();
    parent.drawCycle = InterfaceList.cycle;
    parent.rootIndex = 9;
    sub.group = 1;
    IfType.m_list = [[parent], [null, child]];
    IfType.m_open = [true, true];
    InterfaceList.subInterfaces = new HashTable<SubInterface>(8);
    InterfaceList.subInterfaces.put(sub, 0n);
    const packets: { op: number; bytes: Buffer }[] = [];
    const input: Buffer[] = [];
    const int = (n: number) => {
        const b = Buffer.alloc(4);
        b.writeInt32BE(n);
        input.push(b);
    };
    int(160);
    for (let step = 0; step < 160; step++) {
        const p = new PacketT(6),
            op = [38, 234, 38, 159, 38, 85, 38, 38][step % 8];
        if (op === 38) {
            p.p1(128 + step * 29);
            p.p4_alt2([GameClient.levelExperience[step % 99], GameClient.levelExperience[step % 99] - 1, 2147483647, -1][step % 4]);
            p.p1(step % 25);
        } else if (op === 234) p.p1(step * 17);
        else p.p2((step - 57) * 5983);
        const bytes = Buffer.from(requireNonNull(p.m_data).subarray(0, p.m_pos));
        int(op);
        int(bytes.length);
        input.push(bytes);
        packets.push({ op, bytes });
    }
    mkdirSync('out', { recursive: true });
    const dir = mkdtempSync(resolve('out/stat-'));
    try {
        const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, resolve(import.meta.dir, 'ui/StatOracle.java')]);
        expect(compile.stderr.toString()).toBe('');
        expect(compile.exitCode).toBe(0);
        const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'StatOracle'], { stdin: Buffer.concat(input) });
        expect(java.stderr.toString()).toBe('');
        expect(java.exitCode).toBe(0);
        const lines = java.stdout.toString().trimEnd().split(/\r?\n/);
        expect(lines.length).toBe(packets.length);
        GameClient.changedStatCount = 0;
        requireNonNull(GameClient.statUpdates).fill(0);
        InterfaceList.miscTransmitAt = 0;
        GameClient.rebootTimer = GameClient.runenergy = GameClient.runWeight = 0;
        const player = (GameClient.localPlayer = new ClientPlayer()),
            appearance = (player.appearance = new PlayerModel());
        for (const [step, { op, bytes }] of packets.entries()) {
            GameClient.transmitCycle = step * 7189 + 1;
            InterfaceList.dirty[9] = false;
            child.if3 = (step & 1) !== 0;
            const p = new SuperPacket(bytes.length);
            requireNonNull(p.m_data).set(bytes);
            expect(await inputStream.read(op, bytes, p)).toBe(true);
            LocalisedText.language = step % 4;
            GameClient.selectedWorldId = 355 + step;
            GameClient.affiliateId = step * 7;
            GameClient.loopCycle = Math.imul(step, 0x3737735);
            GameClient.staffModLevel = step % 4;
            GameClient.blackmarks = step % 15;
            GameClient.playerMember = step % 3 === 0;
            GameClient.members = step % 7 === 0;
            GameClient.underage = !!(step & 2);
            GameClient.parentalChatConsent = !!(step & 1);
            GameClient.mapQuickChat = !!(step & 4);
            player.combatLevel = 25 + step;
            appearance.female = step % 3 === 1;
            player.x = Math.imul(step, 0x1018007);
            player.z = -step * 63991;
            GameClient.mapBuildBaseX = step * 0x103729;
            GameClient.mapBuildBaseZ = step * 0x76321;
            GameClient.playerLevel = step - 10;
            Login.loginType = step - 17;
            const values = ops.map(code => intQuery(code, args(code, step)));
            const fields = [
                p.m_pos,
                InterfaceList.dirty[9],
                InterfaceList.miscTransmitAt,
                GameClient.changedStatCount,
                hash(requireNonNull(GameClient.statUpdates)),
                hash(GameClient.statEffectiveLevel),
                hash(GameClient.statBaseLevel),
                hash(GameClient.statXP),
                '[' + values.join(', ') + ']'
            ];
            expect(fields.join(' '), 'packet ' + step).toBe(arrayAt(lines, step));
        }
    } finally {
        inputStream.restore();
        Object.assign(GameClient, savedWorld);
        GameClient.playerMember = saved.member;
        GameClient.members = saved.bits;
        Object.assign(GameClient, saved.rights);
        GameClient.localPlayer = saved.player;
        GameClient.playerLevel = saved.plane;
        GameClient.mapBuildBaseX = saved.x;
        GameClient.mapBuildBaseZ = saved.z;
        GameClient.runenergy = saved.energy;
        GameClient.runWeight = saved.weight;
        GameClient.rebootTimer = saved.reboot;
        GameClient.loopCycle = saved.cycle;
        LocalisedText.language = saved.lang;
        Login.loginType = saved.login;
        GameClient.statEffectiveLevel.set(saved.levels);
        GameClient.statBaseLevel.set(saved.base);
        GameClient.statXP.set(saved.xp);
        requireNonNull(GameClient.statUpdates).set(saved.ring);
        GameClient.changedStatCount = saved.changes;
        InterfaceList.miscTransmitAt = saved.changedAt;
        GameClient.transmitCycle = saved.uiCycle;
        InterfaceList.dirty[9] = saved.dirty;
        InterfaceList.subInterfaces = saved.table;
        IfType.m_list = saved.groups;
        IfType.m_open = saved.loaded;
        rmSync(dir, { recursive: true, force: true });
    }
}, 20000);
