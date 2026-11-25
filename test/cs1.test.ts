import ObjType from '#/config/ObjType.js';
import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { delimiter, resolve } from 'node:path';
import GameShell from '#/client/GameShell.js';
import ClientVarCache from '#/util/ClientVarCache.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import { fromJsString } from '#/datastruct/JagString.js';
import { readPacketBody } from './packet-body-fixture.js';
import PacketT from '#/io/PacketT.js';
import IfType from '#/ui/IfType.js';
import GameClient from '#/client/Client.js';
import { arrayAt, requireNonNull } from '#/util/JavaArray.js';
import Signlink from '#/util/Signlink.js';
import SignlinkRequest from '#/util/SignlinkRequest.js';
import { localAssets } from './cachefile.js';
import { cachePath, gamepackPath } from './reference.js';

interface Sample {
    component: IfType;
    bytes: Uint8Array | null;
}

test('the original CS1 evaluates every scripted archive 3 widget, signed arithmetic, conditions, substituted text and packet 164', async () => {
    const saved = {
        inventory: IfType.m_list,
        loaded: IfType.m_open,
        archive: IfType.m_pInterfaces,
        player: GameClient.localPlayer,
        x: GameClient.mapBuildBaseX,
        z: GameClient.mapBuildBaseZ,
        energy: GameClient.runenergy,
        weight: GameClient.runWeight,
        request: GameClient.dnsRequest,
        signlink: GameShell.signlink,
        members: GameClient.members,
        base: GameClient.statBaseLevel.slice(),
        effective: GameClient.statEffectiveLevel.slice(),
        xp: GameClient.statXP.slice(),
        vars: ClientVarCache.m_var.slice()
    };
    const assets = localAssets(cachePath, [3, 22]),
        samples: Sample[] = [];
    const bitIds = new Set<number>([49]);
    for (const group of requireNonNull(requireNonNull(assets.index(3)).groupIds)) {
        for (const bytes of requireNonNull(assets.files(3, group))) {
            if (!bytes || bytes[0] === 255) continue;
            const component = new IfType();
            component.Decode(new PacketT(bytes));
            if (component.scripts === null) continue;
            samples.push({ component, bytes });
            for (const script of component.scripts) {
                for (let pc = 0; pc < script.length;) {
                    const opcode = script[pc++];
                    if (opcode === 0) break;
                    if (opcode === 14) bitIds.add(script[pc]);
                    if (opcode === 4 || opcode === 10) pc += 3;
                    else if (opcode === 13) pc += 2;
                    else if ([1, 2, 3, 5, 6, 7, 14, 20].includes(opcode)) pc++;
                }
            }
        }
    }
    expect(samples.length).toBe(984);
    const add = (scripts: number[][] | null, ops: number[] | null, values: number[] | null) => {
        const component = new IfType();
        component.scripts = scripts?.map(row => Int32Array.from(row)) ?? null;
        component.comparisonOps = ops === null ? null : Int32Array.from(ops);
        component.comparisonValues = values === null ? null : Int32Array.from(values);
        samples.push({ component, bytes: null });
    };
    add(null, null, null);
    add([], [], null);
    add([[20, 42, 0]], [1], null);
    const programs = [
        [0],
        [1, 3, 0],
        [2, 24, 0],
        [3, 16, 0],
        [4, 149, 0, 5562, 0],
        [4, 149, 0, 5565, 0],
        [5, 2499, 0],
        [6, 0, 0],
        [6, 1, 0],
        [7, 967, 0],
        [8, 0],
        [9, 0],
        [10, 149, 0, 5562, 0],
        [10, 149, 0, 5567, 0],
        [11, 0],
        [12, 0],
        [13, 127, -1, 0],
        [14, 49, 0],
        [18, 0],
        [19, 0],
        [20, 2147483647, 20, 1, 0],
        [20, -2147483648, 16, 20, -1, 0],
        [20, 63, 16, 20, 0, 0],
        [20, 5386919, 17, 20, -8378393, 0],
        [20, -31, 15, 16, 17, 20, -95, 0],
        [77, 0],
        [1, -1, 0],
        [5, 2500, 0],
        [4, 149, 0, -1, 0],
        [4, 155, 0, 5562, 0],
        [20],
        [20, 999999998, 0],
        [20, 999999999, 0],
        [],
        [6, 25, 0],
        [13, 1234, 64, 0],
        [20, 58, 15, 9, 17, 8, 16, 12, 19, 0]
    ];
    for (let i = 0; i < 770; i++) {
        const scripts = Array.from({ length: (i % 7) + 1 }, (_, j) => programs[(i * 11 + j * 7) % programs.length]);
        const ops = Array.from({ length: i % 5 }, (_, j) => (i + j) % 6);
        add(
            scripts,
            ops,
            ops.map((_, j) => [0, -1, 1, 63, 83, -189, 999999999][(i + 3 * j) % 7])
        );
    }
    const packets = ['00000000', '8ab0d9ff', 'ffffffff', '00010000', 'ffab0122'].map(v => Buffer.from(v, 'hex'));
    const input: Uint8Array[] = [];
    const int = (n: number) => {
        const b = Buffer.alloc(4);
        b.writeInt32BE(n);
        input.push(b);
    };
    const ints = (values: Int32Array | null) => {
        int(values?.length ?? -1);
        if (values) for (const value of values) int(value);
    };
    int(bitIds.size);
    for (const id of bitIds) {
        const bytes = assets.archive(22).FetchFile(id & 1023, null, id >>> 10) ?? Uint8Array.of(0);
        int(id);
        int(bytes.length);
        input.push(bytes);
    }
    int(samples.length);
    for (const { component: c, bytes } of samples) {
        int(bytes?.length ?? -1);
        if (bytes) input.push(bytes);
        else {
            int(c.scripts?.length ?? -1);
            if (c.scripts) for (const row of c.scripts) ints(row);
            ints(c.comparisonOps);
            ints(c.comparisonValues);
        }
    }
    int(packets.length);
    input.push(...packets);
    mkdirSync('out', { recursive: true });
    const dir = mkdtempSync(resolve('out/cs1-'));
    let signlink: Signlink | null = null;
    try {
        const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, resolve(import.meta.dir, 'ui/Cs1Oracle.java')]);
        expect(compile.stderr.toString()).toBe('');
        expect(compile.exitCode).toBe(0);
        const result = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'Cs1Oracle'], { stdin: Buffer.concat(input) });
        expect(result.stderr.toString()).toBe('');
        expect(result.exitCode).toBe(0);
        const lines = result.stdout.toString().trimEnd().split(/\r?\n/);
        expect(lines.length).toBe(samples.length + packets.length);
        IfType.m_list = new Array(150).fill(null);
        IfType.m_open = new Array<boolean>(150).fill(false);
        const inv = new IfType();
        inv.itemIds = Int32Array.of(5563, 5563, 5566, 0);
        inv.itemCounts = Int32Array.of(2147483647, 4, 69, 0);
        IfType.m_list[149] = [inv];
        IfType.m_open[149] = true;
        for (let id = 5562; id <= 5567; id++) {
            const t = new ObjType();
            t.members = (id & 1) === 0;
            ObjType.types.Put(BigInt(id), t);
        }
        for (let i = 0; i < 2500; i++) ClientVarCache.m_var[i] = Math.imul(i + 1, 7325681);
        for (let i = 0; i < 25; i++) {
            GameClient.statBaseLevel[i] = (i * 5) % 99;
            GameClient.statEffectiveLevel[i] = (i * 17) % 121;
            GameClient.statXP[i] = 292341 * i;
        }
        GameClient.localPlayer = new ClientPlayer();
        GameClient.localPlayer.combatLevel = 83;
        GameClient.localPlayer.x = -12304;
        GameClient.localPlayer.z = 1485;
        GameClient.mapBuildBaseX = 3200;
        GameClient.mapBuildBaseZ = 3460;
        GameClient.runenergy = 63;
        GameClient.runWeight = -189;
        for (const [i, { component: c }] of samples.entries()) {
            GameClient.members = (i & 1) === 0;
            GameClient.dnsRequest = i % 3 === 0 ? null : new SignlinkRequest<string>();
            if (GameClient.dnsRequest) {
                GameClient.dnsRequest.intArg = 0x8009feff | 0;
                GameClient.dnsRequest.result = i % 3 === 2 ? 'ä\0☃' : null;
            }
            let hash = 1;
            for (let j = -1; j <= 6; j++) hash = (Math.imul(31, hash) + GameClient.GetIfVar(c, j)) | 0;
            let cond: string;
            try {
                cond = String(GameClient.GetIfActive(c, -69));
            } catch {
                cond = 'error';
            }
            const before = fromJsString(i % 7 === 0 ? 'unchanged' : 'n%1/%2/%3/%4/%5 repeat%1 == %dns');
            const after = GameClient.SubstituteVars(before, c);
            const hex = Buffer.from(requireNonNull(after.bytes).subarray(0, after.length)).toString('hex');
            expect([hash, cond, before === after, hex].join(' '), 'widget ' + i).toBe(arrayAt(lines, i));
        }
        signlink = new Signlink();
        GameShell.signlink = signlink;
        for (const [i, bytes] of packets.entries()) {
            const p = await readPacketBody(164, bytes);
            const request = requireNonNull(GameClient.dnsRequest);
            await new Promise(resolve => setTimeout(resolve, 0));
            expect([p.m_pos, request.type, request.intArg, request.status, String(request.result)].join(' ')).toBe(arrayAt(lines, samples.length + i));
        }
    } finally {
        if (signlink) await signlink.stopWorker();
        GameShell.signlink = saved.signlink;
        GameClient.dnsRequest = saved.request;
        GameClient.members = saved.members;
        GameClient.mapBuildBaseX = saved.x;
        GameClient.mapBuildBaseZ = saved.z;
        GameClient.localPlayer = saved.player;
        GameClient.runenergy = saved.energy;
        GameClient.runWeight = saved.weight;
        GameClient.statBaseLevel.set(saved.base);
        GameClient.statEffectiveLevel.set(saved.effective);
        GameClient.statXP.set(saved.xp);
        ClientVarCache.m_var.set(saved.vars);
        ObjType.types.Reset();
        IfType.m_list = saved.inventory;
        IfType.m_open = saved.loaded;
        IfType.m_pInterfaces = saved.archive;
        rmSync(dir, { recursive: true, force: true });
    }
}, 30000);
