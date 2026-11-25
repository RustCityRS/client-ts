import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import SeqType from '#/config/SeqType.js';
import CollisionMap from '#/dash3d/CollisionMap.js';
import ParticleSystem from '#/dash3d/ParticleSystem.js';
import { fromJsString, toJsString } from '#/datastruct/JagString.js';
import ChatHistory from '#/game/ChatHistory.js';
import Js5NetQueue from '#/io/Js5NetQueue.js';
import SuperPacket from '#/io/SuperPacket.js';
import Minimenu from '#/ui/Minimenu.js';
import Preferences from '#/ui/Preferences.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { gamepackPath } from './reference.js';

function commands(): string[] {
    const statements = [
        '::ordinary',
        'x',
        '::fpSon',
        '::fpSoff',
        '::pcachesize',
        '::rect_debug  -23 ',
        '::rect_debug',
        '::rect_debug 2147483648',
        '::setparticles 0',
        '::setparticles -1',
        '::SETparticles 2',
        '::setparticles 4',
        '::setparticles',
        '::fps 50',
        '::fps -30',
        '::fps 0',
        '::fps 123x',
        '::qa_op_test',
        '::tween',
        '::TWEEN',
        '::shiftclick',
        '::SHIFTCLICK',
        '::replacecanvas',
        '::errortest',
        '::ERRORTEST ',
        '::clientjs5drop',
        '::serverjs5drop',
        '::breakcon',
        '::rebuild',
        '::clientdrop',
        '::noclip',
        '::gc',
        '::mm',
        '::tele 1,12,2,3,4'
    ];
    const rows = [];
    for (const rights of [0, 1, 2, 3]) for (const build of [0, 1]) for (const command of statements) rows.push([rights, build, 0, command].join('|'));
    for (const command of ['::noclip', '::gc', '::mm']) rows.push([2, 1, 1, command].join('|'));
    return rows;
}

// Runtime heap usage is provided by the host; preserve all other chat bytes and the order of both readings.
function heapText(s: string): string {
    return s.replace(/((?:mem|Memory before cleanup|Memory after cleanup)=)-?[0-9]+k/g, '$1<heap>k');
}

function trace(): void {
    const output = console.log.bind(console);
    for (let i = 0; i < 4; i++) CollisionMap.levelMaps[i] = new CollisionMap(104, 104);
    Client.js5NetQueue = new Js5NetQueue();
    Client.gameState = 30;
    for (const row of commands()) {
        const [rights, build, missing, command] = row.split('|');
        Client.staffModLevel = Number(rights);
        Client.modewhat = Number(build);
        CollisionMap.levelMaps[2] = Number(missing) === 0 ? new CollisionMap(104, 104) : null;
        const packet = (Client.out = new SuperPacket(2048));
        packet.SetEnc(Int32Array.of(1, 2, 3, 4));
        ChatHistory.count = 0;
        ChatHistory.text[0] = ChatHistory.text[1] = null;
        let log = '',
            error = false;
        console.log = value => {
            log += String(value);
        };
        try {
            Client.DoCheat(fromJsString(command));
        } catch {
            error = true;
        }
        console.log = output;
        let hash = 1;
        for (const map of CollisionMap.levelMaps) {
            let deep = 1;
            if (map) for (const column of map.flags) deep = (Math.imul(deep, 31) + column.reduce((v, n) => (Math.imul(v, 31) + n) | 0, 1)) | 0;
            hash = (Math.imul(hash, 31) + (map ? deep : 0)) | 0;
        }
        const text = (i: number) => (ChatHistory.text[i] === null ? '-' : toJsString(requireNonNull(ChatHistory.text[i])));
        output(
            [
                error,
                packet.m_pos,
                Buffer.from(requireNonNull(packet.m_data).subarray(0, packet.m_pos)).toString('hex'),
                Client.displayFps,
                Client.rectDebug,
                SeqType.forceTween,
                Minimenu.shiftClick,
                Client.qaOpTest,
                GameShell.canvasInvalid,
                GameShell.m_delTime,
                ParticleSystem.getDetailLevel(),
                Preferences.sent,
                Client.gameState,
                hash,
                ChatHistory.count,
                text(0),
                text(1),
                log
            ].join('|')
        );
    }
}

if (process.argv[2] === 'trace') trace();
else
    test('DoCheat matches every native command, privilege gate, parse failure, packet cursor, flag and collision map', () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-cheat-'));
        try {
            const build = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game', 'CheatOracle.java')]);
            expect(build.exitCode, build.stderr.toString()).toBe(0);
            const rows = commands();
            const jar = Bun.spawnSync(['java', '-Xmx256m', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'CheatOracle'], {
                stdin: Buffer.from(rows.join('\n') + '\n')
            });
            expect(jar.exitCode, jar.stderr.toString()).toBe(0);
            const ts = Bun.spawnSync([process.execPath, fileURLToPath(import.meta.url), 'trace']);
            expect(ts.exitCode, ts.stderr.toString()).toBe(0);
            const expected = jar.stdout.toString().trimEnd().split(/\r?\n/),
                actual = ts.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected).toHaveLength(rows.length);
            expect(actual).toHaveLength(rows.length);
            for (const [i, row] of rows.entries()) expect(heapText(actual[i]), row).toBe(heapText(expected[i]));
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
