import SafeTime from '#/io/SafeTime.js';
import { loginFixture } from './login-fixture.js';
import GameWorld from '#/io/GameWorld.js';
import { installSocketHost, settleSignlink } from './socket-host.js';
import SuperPacket from '#/io/SuperPacket.js';
import { gamepackPath } from './reference.js';
import { requireNonNull } from '../src/util/JavaArray.js';
import { expect } from 'bun:test';
import { fileURLToPath } from 'node:url';
import type JagString from '../src/datastruct/JagString.js';
import WorldList from '../src/io/WorldList.js';
import Login from '#/io/Login.js';
import AccountCreation from '#/io/AccountCreation.js';
import AudioEngine from '#/sound/AudioEngine.js';
import PCMPlayer from '#/sound/PCMPlayer.js';
import Client from '#/client/Client.js';
import TitleScreen from '#/title/TitleScreen.js';
import ScriptRunner from '../src/script/ScriptRunner.js';
import { ClientScript } from '#/script/ClientScript.js';
import HookReq from '#/script/HookReq.js';
import { program } from './world-list-script.js';

const hex = (b: Uint8Array | null) => (b === null ? '~' : Buffer.from(b).toString('hex'));
const string = (s: JagString | null) => (s === null ? '~' : hex(s.toBytes()));
const smart = (v: number) => (v < 128 ? [v] : [128 | (v >>> 8), v & 255]);
const text = (s: string) => [0, ...Buffer.from(s, 'latin1'), 0];

function full(offsets: number[]): Uint8Array {
    const bytes = [1, 1, 3, 0, ...text('USA'), ...smart(160), ...text('Éire'), 19, ...text('eire'), ...smart(300), ...smart(312), offsets.length];
    const names = ['-', 'Trade', 'Trade', 'Évent', 'trade', '-', 'Event', 'Event'];
    offsets.forEach((offset, i) => bytes.push(...smart(offset), i % 3, 0, 0, 0, (i * 5) & 15, ...text(names[i]), ...text('world' + offset)));
    bytes.push(0xca, 0xfe, 0xba, 0xbe);
    offsets.forEach((offset, i) =>
        bytes.push(
            ...smart(offset),
            ...[
                [255, 255],
                [0, 1],
                [0, 1],
                [7, 209]
            ][i % 4]
        )
    );
    return Uint8Array.from(bytes);
}
function frame(body: Uint8Array): string {
    return hex(Uint8Array.of(0, body.length >>> 8, body.length, ...body));
}

class Socket {
    visible = 1;
    offset = 0;
    beforeRead: (() => void) | null = null;
    constructor(readonly bytes: Uint8Array) {}
    GetAvailable() {
        return this.visible;
    }
    async read() {
        if (!this.visible) return -1;
        this.visible--;
        return this.bytes[this.offset++];
    }
    async Read(dst: Uint8Array, off: number, len: number) {
        this.beforeRead?.();
        dst.set(this.bytes.subarray(this.offset, this.offset + len), off);
        this.visible -= len;
        this.offset += len;
    }
    Write() {}
    Close() {}
}

function state(result: string): string {
    const countries = WorldList.countries?.map(c => (c === null ? '~' : c.flag + ':' + string(c.name))).join('|') ?? '~';
    const entries = WorldList.worlds?.map(w => (w === null ? '~' : [w.id, w.country, w.flags, w.players, string(w.activity), string(w.host)].join(':'))).join('|') ?? '~';
    return [
        result,
        GameWorld.minId,
        GameWorld.maxId,
        GameWorld.m_num,
        GameWorld.listChecksum,
        WorldList.loaded,
        GameWorld.m_next,
        WorldList.fetchAttempts,
        WorldList.fetchStep,
        GameWorld.fetchLength,
        GameWorld.worldListBufferPos,
        countries,
        entries,
        GameWorld.m_list.map(w => w?.id ?? '~').join('|'),
        hex(GameWorld.worldListBuffer),
        hex(requireNonNull(Client.out.m_data).subarray(0, Client.out.m_pos)),
        Client.worldListPort
    ].join(';');
}

loginFixture(import.meta.url, 'world-list replies, retry stages, field sorting and 6500-series opcodes match the gamepack', async () => {
    const payload = full([7, 2, 1, 12, 0, 4, 10, 5]);
    const commands: string[] = ['parse 0100', 'parse 0200', 'open ' + frame(payload), 'scriptNow 6500 1 0', 'more 1', 'more 1', 'scriptNow 6500 1 0', 'more 2', 'more 3', 'more ' + (payload.length - 5), 'fresh'];
    for (let field = -1; field <= 8; field++) {
        for (const rev of [0, 1]) {
            commands.push(`sort ${field} ${rev} -1 0`, `sort ${field} ${rev} 3 1`);
        }
    }
    for (const state of [0, 5, 10, 20, 25, 28, 30, 40, 1000]) {
        for (const busy of ['0 0 0', '1 0 0', '0 3 0', '0 0 4']) {
            commands.push(`session ${state} ${busy}`, 'script 6500,0:301,6503 2 0');
        }
    }
    commands.push('session 10 0 0 0');
    commands.push('country 300 96', 'sort 0 0 -1 0', 'script 6501 4 2', 'script 0:300,6506 3 2', 'country 300 1');
    commands.push('script 0:4,6507 4 0', 'script 6506 3 2', 'script 6504 1 0');
    commands.push(
        'script 6500 1 0',
        'script 6501 4 2',
        'script 6502 4 2',
        'script 0:301,6506 3 2',
        'script 0:303,6506 3 2',
        'script 0:1,0:0,0:3,0:1,6507,6501 4 2',
        'script 0:65539,6504,6505 1 0',
        'script 0:303,6503 1 0',
        'script 0:307,6503 1 0',
        'switch 302'
    );
    for (let i = 0; i < 11; i++) commands.push('script 6502 4 2');
    const delta = Uint8Array.from([1, 0, 2, 7, 233, 3, 0, 12, 1, 0, 99, 0, 255, 255, 7, 0, 0, 4, 0, 6, 5, 0, 72, 12, 1, 75]);
    commands.push(
        'open ' + frame(delta),
        'more 2',
        'more ' + delta.length,
        'open 00000104',
        'more 3',
        'open 09',
        'port 60005',
        'failed',
        'timeout',
        'failed',
        'timeout',
        'open 0b',
        'open 0c',
        'open 0d',
        'open 0e',
        'open 0f',
        'parse 010001ffff7fff',
        'parse 0101010080',
        'parse 010100050103',
        'parse 0101000102010300',
        'parse 0101000101010000'
    );
    const dup = full([1, 1]);
    commands.push('open ' + frame(dup), 'more ' + (2 + dup.length), 'script 6501 4 2', 'script 6502 4 2', 'sort 3 0 -1 0');
    commands.push('open ' + frame(payload), 'more 2', 'slow ' + payload.length);
    const source = fileURLToPath(new URL('./game/WorldListOracle.java', import.meta.url));
    const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', gamepackPath, source], {
        stdin: Buffer.from(commands.join('\n') + '\n'),
        timeout: 20000,
        maxBuffer: 3 * 1024 * 1024
    });
    expect(java.stderr.toString()).toBe('');
    expect(java.exitCode).toBe(0);
    const expected = java.stdout.toString().trim().split(/\r?\n/);
    expect(expected).toHaveLength(commands.length);
    const savedOutbound = Client.out;
    const savedState = [Client.gameState, Login.worldLookupStep, Client.loginStep, AccountCreation.step];
    const savedMusic = AudioEngine.musicPlayer,
        savedEffects = AudioEngine.effectsPlayer;
    Client.out = new SuperPacket(5000);
    try {
        let audioMarks = 0,
            polls = 0;
        class CountedPlayer extends PCMPlayer {
            override DoneUpdate(): void {
                audioMarks++;
                super.DoneUpdate();
            }
        }
        AudioEngine.musicPlayer = new CountedPlayer();
        AudioEngine.effectsPlayer = new CountedPlayer();
        const fetch = GameWorld.ListFetch.bind(GameWorld);
        GameWorld.ListFetch = () => {
            polls++;
            return fetch();
        };
        [Client.gameState, Login.worldLookupStep, Client.loginStep, AccountCreation.step] = [10, 0, 0, 0];
        let socket = new Socket(new Uint8Array(0));
        let open = async () => socket;
        installSocketHost(() => open());
        const vm = new ScriptRunner(ClientScript.Get, () => {});
        let now = BigInt(Date.now());
        SafeTime.CurrentTimeMillis = () => now;
        for (let i = 0; i < commands.length; i++) {
            const p = commands[i].split(' ');
            let result = 'ok';
            audioMarks = polls = 0;
            try {
                if (p[0] === 'port') Client.worldListPort = +p[1];
                if (p[0] === 'country') requireNonNull(GameWorld.GetByID(+p[1])).country = +p[2];
                if (p[0] === 'session') [Client.gameState, Login.worldLookupStep, Client.loginStep, AccountCreation.step] = p.slice(1).map(Number);
                if (p[0] === 'parse') result = String(WorldList.decode(Buffer.from(p[1], 'hex')));
                if (p[0] === 'open') {
                    now += 5001n;
                    socket = new Socket(Buffer.from(p[1], 'hex'));
                    open = async () => socket;
                    await GameWorld.ListFetch();
                    await settleSignlink();
                    result = String(await GameWorld.ListFetch());
                }
                if (p[0] === 'more') {
                    socket.visible += +p[1];
                    result = String(await GameWorld.ListFetch());
                }
                if (p[0] === 'slow') {
                    socket.visible += +p[1];
                    socket.beforeRead = () => {
                        now += 12000n;
                        socket.beforeRead = null;
                    };
                    result = String(await GameWorld.ListFetch()) + ':' + (WorldList.lastFetchTime - GameWorld.fetchStartTime >= 12000n);
                }
                if (p[0] === 'fresh') {
                    now += 100n;
                    result = String(await GameWorld.ListFetch());
                }
                if (p[0] === 'failed' || p[0] === 'timeout') {
                    now += 5001n;
                    open = async () => {
                        throw new Error('socket refused');
                    };
                    await GameWorld.ListFetch();
                    await settleSignlink();
                    now += p[0] === 'timeout' ? 30001n : 0n;
                    result = String(await GameWorld.ListFetch());
                }
                if (p[0] === 'sort') GameWorld.ListSort(+p[1], p[2] === '1', +p[3], p[4] === '1');
                if (p[0] === 'switch') {
                    const success = TitleScreen.SwitchToWorld(+p[1]);
                    result = [success, Client.gameHost, Client.selectedWorldId, Client.primaryPort, Client.secondaryPort, Client.currentPort].join(':');
                }
                if (p[0] === 'script' || p[0] === 'scriptNow') {
                    const key = 81000 + i;
                    program(key, 0, 0, 0, 0, p[1].replaceAll(',', ' ') + ' 21');
                    ScriptRunner.intStack.fill(0x12345678);
                    ScriptRunner.stringStack.fill(null);
                    const hook = new HookReq();
                    hook.args = [key];
                    const pending = vm.ExecuteScript(hook, 200000);
                    if (p[0] === 'scriptNow') expect(pending).toBeUndefined();
                    await pending;
                    result = [...ScriptRunner.intStack.subarray(0, +p[2]), ...ScriptRunner.stringStack.slice(0, +p[3]).map(string)].join(',') + '/' + polls;
                }
            } catch {
                result = 'runtime';
            }
            expect(state(result) + ';' + audioMarks, commands[i] + ' at ' + i).toBe(expected[i]);
        }
    } finally {
        Client.out = savedOutbound;
        [Client.gameState, Login.worldLookupStep, Client.loginStep, AccountCreation.step] = savedState;
        AudioEngine.musicPlayer = savedMusic;
        AudioEngine.effectsPlayer = savedEffects;
    }
});
