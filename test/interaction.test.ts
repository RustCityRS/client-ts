import GameClient from '#/client/Client.js';
import ReceivePlayerPositions from '#/client/ReceivePlayerPositions.js';
import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { delimiter, resolve } from 'node:path';
import ClientKeyboardListener from '#/client/ClientKeyboardListener.js';
import SeqType from '#/config/SeqType.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import CollisionMap from '#/dash3d/CollisionMap.js';
import JagString, { fromJsString } from '#/datastruct/JagString.js';
import ChatHistory from '#/game/ChatHistory.js';
import SuperPacket from '#/io/SuperPacket.js';
import { ClientScript } from '#/script/ClientScript.js';
import HookReq from '#/script/HookReq.js';
import ScriptRunner from '#/script/ScriptRunner.js';
import LocalisedText from '#/ui/LocalisedText.js';
import { arrayAt, requireNonNull } from '#/util/JavaArray.js';
import { localAssets } from './cachefile.js';
import { cachePath, gamepackPath } from './reference.js';

type Command = [number, number[], string?];
test('dialog resumes, local animation and player-by-name operations match original gh ISAAC output and state', () => {
    const saved = {
        self: GameClient.localPlayer,
        players: GameClient.players.slice(),
        ids: ReceivePlayerPositions.m_lastID.slice(),
        count: ReceivePlayerPositions.m_lastNum,
        plane: GameClient.playerLevel,
        map: CollisionMap.levelMaps[0],
        out: GameClient.out,
        x: GameClient.mapBuildBaseX,
        z: GameClient.mapBuildBaseZ,
        dx: GameClient.destinationX,
        dz: GameClient.destinationZ,
        control: ClientKeyboardListener.pressed[82],
        clock: GameClient.transmitCycle,
        changed: GameClient.chatTransmitCycle,
        countChat: ChatHistory.count,
        types: ChatHistory.types.slice(),
        text: ChatHistory.text.slice(),
        names: ChatHistory.names.slice(),
        phrases: ChatHistory.phrases.slice(),
        clans: ChatHistory.clans.slice(),
        missing: LocalisedText.unableToFind
    };
    localAssets(cachePath, []);
    const script = new ClientScript(),
        event = new HookReq(),
        errors: Error[] = [];
    const vm = new ScriptRunner(
        () => script,
        error => errors.push(error)
    );
    const cmds: Command[] = [];
    for (const s of ['', '0', '+1', '-2147483648', '2147483647', '2147483648', '-2147483649', '+', '--1', '0000019', '-291c', '55555555555', 'Hëllo', 'a_na_maria', 'X'.repeat(270)]) {
        cmds.push([3100, [], s], [3104, [], s], [3105, [], s], [3106, [], s]);
    }
    for (const name of ['aNa_maria', ' SAME ', 'undefined', 'AAA__999', '%%%']) for (let i = 0; i <= 8; i++) cmds.push([3107, [i], name]);
    for (let i = 0; i < 33; i++) cmds.push([3101, [[7, 7, 8, 9, 9, -1, 9, 9, 8, 8][i % 10], 83812 - i * 61]], [3110, [-2147483648 + i * 987321]], [3103, []]);
    const input: Buffer[] = [];
    const int = (v: number) => {
        const b = Buffer.alloc(4);
        b.writeInt32BE(v);
        input.push(b);
    };
    int(cmds.length);
    for (const [op, nums, str] of cmds) {
        int(op);
        int(nums.length);
        for (const n of nums) int(n);
        const b = str === undefined ? null : Buffer.from(str, 'latin1');
        int(b?.length ?? -1);
        if (b) input.push(b);
    }
    mkdirSync('out', { recursive: true });
    const dir = mkdtempSync(resolve('out/interactions-'));
    try {
        const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, resolve(import.meta.dir, 'ui/InteractionOracle.java')]);
        expect(compile.stderr.toString()).toBe('');
        expect(compile.exitCode).toBe(0);
        const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'InteractionOracle'], { stdin: Buffer.concat(input) });
        expect(java.stderr.toString()).toBe('');
        expect(java.exitCode).toBe(0);
        const lines = java.stdout.toString().trimEnd().split(/\r?\n/);
        expect(lines.length).toBe(cmds.length);
        const self = (GameClient.localPlayer = new ClientPlayer());
        self.pathX[0] = 34;
        self.pathZ[0] = 32;
        const map = (CollisionMap.levelMaps[0] = new CollisionMap(104, 104));
        for (const col of map.flags) col.fill(0);
        ClientKeyboardListener.pressed[82] = false;
        GameClient.playerLevel = 0;
        GameClient.mapBuildBaseX = 3210;
        GameClient.mapBuildBaseZ = 3330;
        GameClient.destinationX = GameClient.destinationZ = 0;
        ReceivePlayerPositions.m_lastID.set([4, 99, 777, 955]);
        ReceivePlayerPositions.m_lastNum = 4;
        GameClient.players[4] = null;
        GameClient.players[99] = new ClientPlayer();
        const p1 = (GameClient.players[777] = new ClientPlayer()),
            p2 = (GameClient.players[955] = new ClientPlayer());
        p1.username = fromJsString('aNa MaRiA');
        p2.username = fromJsString('Same');
        p1.pathX[0] = 41;
        p1.pathZ[0] = 37;
        p2.pathX[0] = 34;
        p2.pathZ[0] = 32;
        const p = (GameClient.out = new SuperPacket(5000));
        p.SetEnc(Int32Array.of(3, 7, 13, 17));
        LocalisedText.unableToFind = LocalisedText.englishUnableToFind;
        ChatHistory.text.fill(null);
        ChatHistory.names.fill(null);
        ChatHistory.types.fill(0);
        ChatHistory.count = GameClient.chatTransmitCycle = 0;
        for (let i = 7; i <= 9; i++) {
            const seq = new SeqType();
            seq.m_duplicateBehaviour = i % 3;
            seq.m_priority = 10 - i;
            SeqType.m_recentUse.Put(BigInt(i), seq);
        }
        const hex = (s: JagString | null) => (s === null ? '~' : Buffer.from(s.toBytes()).toString('hex'));
        for (const [i, [op, nums, str]] of cmds.entries()) {
            script.opcodes = Int32Array.from([...nums.map(() => 0), ...(str === undefined ? [] : [3]), op, 21]);
            script.intOperands = new Int32Array(script.opcodes.length);
            script.intOperands.set(nums);
            script.stringOperands = new Array(script.opcodes.length).fill(null);
            if (str !== undefined) script.stringOperands[nums.length] = fromJsString(str);
            event.args = [12300 + i];
            script.key = BigInt(12300 + i);
            p.m_pos = 0;
            GameClient.transmitCycle = i + 1234;
            self.seqLoops = i + 7;
            self.seqFrame = i + 20;
            self.seqNext = i + 23;
            self.seqDelay = i + 31;
            self.seqCycle = i + 41;
            self.pathLength = i + 62;
            self.seqPathLength = i + 79;
            expect(vm.run(event)).toBeUndefined();
            const row = [
                Buffer.from(requireNonNull(p.m_data).subarray(0, p.m_pos)).toString('hex'),
                [ChatHistory.count, GameClient.chatTransmitCycle, ChatHistory.types[0], hex(ChatHistory.text[0]), hex(ChatHistory.names[0])],
                [GameClient.destinationX, GameClient.destinationZ],
                [self.seq, self.seqLoops, self.seqFrame, self.seqNext, self.seqDelay, self.seqCycle, self.pathLength, self.seqPathLength]
            ].join('|');
            expect(row, 'step ' + i + ' opcode ' + op).toBe(arrayAt(lines, i));
        }
        expect(errors).toEqual([]);
    } finally {
        GameClient.localPlayer = saved.self;
        for (let i = 0; i < saved.players.length; i++) GameClient.players[i] = saved.players[i];
        ReceivePlayerPositions.m_lastID.set(saved.ids);
        ReceivePlayerPositions.m_lastNum = saved.count;
        GameClient.playerLevel = saved.plane;
        CollisionMap.levelMaps[0] = saved.map;
        GameClient.out = saved.out;
        ClientKeyboardListener.pressed[82] = saved.control;
        GameClient.mapBuildBaseX = saved.x;
        GameClient.mapBuildBaseZ = saved.z;
        GameClient.destinationX = saved.dx;
        GameClient.destinationZ = saved.dz;
        LocalisedText.unableToFind = saved.missing;
        ChatHistory.count = saved.countChat;
        GameClient.transmitCycle = saved.clock;
        GameClient.chatTransmitCycle = saved.changed;
        ChatHistory.types.set(saved.types);
        ChatHistory.phrases.set(saved.phrases);
        for (let i = 0; i < 100; i++) {
            ChatHistory.text[i] = saved.text[i];
            ChatHistory.names[i] = saved.names[i];
            ChatHistory.clans[i] = saved.clans[i];
        }
        SeqType.ResetCache();
        rmSync(dir, { recursive: true, force: true });
    }
}, 20000);
