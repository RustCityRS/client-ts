import { freshActors, freshGame } from './actor-fixture.js';
import { gamepackPath } from './reference.js';
import Minimenu from '#/ui/Minimenu.js';
import IfType from '#/ui/IfType.js';
import ServerActiveProperties from '#/ui/ServerActiveProperties.js';
import Client from '#/client/Client.js';
import { fileURLToPath } from 'node:url';
import { pressedKeys } from '#/Keyboard.js';
import CollisionMap from '../src/dash3d/CollisionMap.js';
import SuperPacket from '../src/io/SuperPacket.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import ClientNpc from '#/dash3d/ClientNpc.js';
import { requireNonNull } from '../src/util/JavaArray.js';

function movementTrace() {
    Client.stream = {
        GetAvailable() {
            return 0;
        },
        Write() {
            throw new Error('Movement writes are queued until t.c');
        },
        async read() {
            return -1;
        },
        async Read() {},
        Close() {}
    };

    const outgoing = new SuperPacket(5000);

    outgoing.SetEnc(Int32Array.of(1, 2, 3, 4));
    // MovementOracle receives an already loaded scene and installs hk.e and vj.t directly.
    Client.mapBuildBaseX = 3072;
    Client.mapBuildBaseZ = 3168;
    const actors = freshActors();
    const game = freshGame({
        outgoing,
        account: null,
        actors,
        rebuild: { zoneX: 390, zoneZ: 402, baseX: 3072, baseZ: 3168, level: 0, localX: 30, localZ: 30, squares: [] }
    });
    const npc = new ClientNpc();
    const player = new ClientPlayer();
    Client.npcs[407] = npc;
    Client.players[407] = player;
    const component = 0x10103;
    const widget = new IfType();
    widget.properties = new ServerActiveProperties(0x7fe, -1);
    widget.childSlots = [null, null, widget];
    const widgets = new Array<IfType | null>(260).fill(null);
    widgets[259] = widget;
    IfType.m_list = [null, widgets];
    const map = new CollisionMap(104, 104);
    CollisionMap.levelMaps[0] = map;
    for (let x = 20; x < 80; x++) {
        for (let z = 20; z < 80; z++) {
            map.flags[x][z] = x % 9 === 0 && z % 12 < 8 ? 256 : 0;
            if ((x * 29 + z * 7) % 13 === 0) map.flags[x][z] |= 1 << ((x + z) % 8);
        }
    }
    const cases = Array.from({ length: 510 }, (_, i) => [(i % 4) + 1, 21 + ((i * 17) % 53), 21 + ((i * 23) % 53), 21 + ((i * 7) % 53), 21 + ((i * 29) % 53), i < 39 ? i : i < 130 ? i % 14 : 26 + (i % 13), i & 1]);
    const input = Buffer.alloc(104 * 104 * 4 + 4 + cases.length * 7);
    let offset = 0;
    for (const column of map.flags) for (const flags of column) offset = input.writeInt32BE(flags, offset);
    offset = input.writeInt32BE(cases.length, offset);
    const trace = [];
    for (const args of cases) {
        input.set(args, offset);
        offset += args.length;
        const [width, sx, sz, tx, tz, op, ctrl] = args;
        pressedKeys[82] = ctrl !== 0;
        game.actors.self.setSize(width);
        game.actors.self.move(true, sz, sx);
        player.move(true, tz, tx);
        npc.moveSized(npc.getSize(), tz, tx, true);
        outgoing.m_pos = 0;
        if (!op) game.walk(map, tx, tz, !!ctrl);
        else if (op <= 5) game.opNpc(map, op, 407, !!ctrl);
        else if (op <= 13) game.opPlayer(map, op - 5, 407, !!ctrl);
        else if (op <= 23) Client.IfButtonX(null, 2, component, op - 13);
        else if (op === 24) {
            Minimenu.actions[0] = 13;
            Minimenu.paramC[0] = component;
            Client.DoAction(0);
        } else if (op === 25) Minimenu.resumePauseButton(2, 0x10103);
        else if (op <= 31) game.opLoc(map, op - 25, 407, tx, tz, trace.length % 23, ((trace.length / 7) | 0) % 4, { width: 3, length: 2, forceApproach: 5 }, !!ctrl);
        else if (op <= 37) game.opObj(map, op - 31, 407, tx, tz, !!ctrl);
        else game.walkMinimap(map, tx, tz, !!ctrl, -41, 18, 1856, -15, 46);
        trace.push(Buffer.from(requireNonNull(outgoing.m_data).subarray(0, outgoing.m_pos)).toString('hex'));
    }
    return { trace, input, cases };
}

if (process.argv[2] === 'movement') {
    const { trace, input, cases } = movementTrace();
    console.log(JSON.stringify({ trace, input: input.toString('base64'), cases }));
} else {
    const { expect, test } = await import('bun:test');
    test('530 destination, compressed walks, actor ops and component clicks match the Java gamepack', () => {
        const ts = Bun.spawnSync([process.execPath, fileURLToPath(import.meta.url), 'movement']);
        expect(ts.exitCode, ts.stderr.toString()).toBe(0);
        const { trace, input, cases }: { trace: string[]; input: string; cases: number[][] } = JSON.parse(ts.stdout.toString());
        const source = fileURLToPath(new URL('./game/MovementOracle.java', import.meta.url));
        const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', gamepackPath, source], { stdin: Buffer.from(input, 'base64'), timeout: 25000 });
        expect(java.stderr.toString()).toBe('');
        expect(java.exitCode).toBe(0);
        const lines = java.stdout.toString().trimEnd().split(/\r?\n/);
        expect(lines.length).toBe(cases.length);
        for (let i = 0; i < cases.length; i++) expect(trace[i], String(cases[i])).toBe(lines[i]);
    }, 30000);
}
