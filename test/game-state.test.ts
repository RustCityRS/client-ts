import TitleScreen from '#/title/TitleScreen.js';
import MidiManager from '#/sound/MidiManager.js';
import Protocol from '#/io/Protocol.js';
import { setLocalWorld, saveWorldConnection } from './world-connection.js';
import Login from '#/io/Login.js';
import Js5NetQueue from '#/io/Js5NetQueue.js';
import Client from '#/client/Client.js';
import { expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';
import Preferences from '../src/ui/Preferences.js';
import { localAssets } from './cachefile.js';
import { gamepackPath, cachePath } from './reference.js';

test('ej transitions preserve side-effect order and the Java loading, music, socket and title states', () => {
    const states = [5, 5, 10, 25, 30, 40, 40, 28, 25, 40, 30, 10, 1000, 10, 28, 30, 5, 25, 0, 30];
    const trace = states.map((state, i) => [state, i % 4 ? 255 : 0, i % 3 ? 1 : 2, i % 5 === 3 ? 1 : 0, i % 5 === 0 ? 1 : 0, 0]);
    for (const state of [5, 10, 28, 30, 40, 40, 10, 25, 1000, -1, 5, 30]) for (const missing of [1, 0]) trace.push([state, 255, 1, 0, 1, missing]);
    const java = Bun.spawnSync(['java', '-Djava.awt.headless=true', '--add-opens', 'java.base/java.lang=ALL-UNNAMED', '-cp', gamepackPath, fileURLToPath(new URL('./login/LoginStagesOracle.java', import.meta.url)), 'states'], {
        stdin: Buffer.from(trace.map(row => row.join(' ')).join('\n') + '\n'),
        timeout: 15000
    });
    expect(java.stderr.toString()).toBe('');
    expect(java.exitCode).toBe(0);
    const rows = java.stdout.toString().trim().split(/\r?\n/);
    expect(rows).toHaveLength(trace.length);
    const savedMidi = { ...MidiManager };
    const oldSocket = Protocol.oldSocket;
    const titleState = { ...TitleScreen },
        nativeState = {
            midiSong: Client.midiSong,
            sceneState: Client.sceneState,
            mapFilesMissing: Client.mapFilesMissing,
            gameState: Client.gameState,
            titleSong: Client.titleSong,
            locsNotReadyCount: Client.locsNotReadyCount,
            maxLocModelsMissing: Client.maxLocModelsMissing,
            mapLoadingTotal: Client.mapLoadingTotal
        },
        oldNet = Client.js5NetQueue;
    const beginLogin = Login.beginLogin;
    const oldLogin = [Login.reply, Login.hopTime, Login.disallowResult, Login.loops, Client.loginStep, Client.loginRetryCount];
    const savedWorld = saveWorldConnection();
    const oldAdverts = Client.advertSuppressed,
        oldActive = Client.activeClient;
    const oldSocketError = Client.socketError;
    const savedVolume = Preferences.musicVolume,
        savedMusic = Client.m_pMidi;
    try {
        const assets = localAssets(cachePath, [6]);
        Client.m_pMidi = assets.archive(6);
        Client.gameState = 0;
        Client.titleSong = 42;
        Client.midiSong = -1;
        Protocol.oldSocket = null;
        setLocalWorld(1);
        let js5 = 0,
            restarts = 0,
            refreshes = 0;
        TitleScreen.m_open = false;
        const net = (Client.js5NetQueue = new Js5NetQueue());
        net.setLoggedIn = () => {
            js5++;
        };
        Login.beginLogin = hop => {
            restarts++;
            beginLogin(hop);
        };
        Client.activeClient = Object.assign(Object.create(Client.prototype) as Client, {
            call(name: string) {
                expect(name).toBe('tbrefresh');
                refreshes++;
            }
        });
        trace.forEach(([next, volume, environment, adverts, socket, missing], i) => {
            if (next === 5) TitleScreen.m_open = true;
            if (socket)
                Protocol.oldSocket = {
                    GetAvailable() {
                        return 0;
                    },
                    Write() {},
                    async read() {
                        return -1;
                    },
                    async Read() {},
                    Close() {}
                };
            Preferences.musicVolume = volume;
            Client.modeWhere = environment;
            Client.advertSuppressed = adverts === 1;
            Client.locsNotReadyCount = Client.mapFilesMissing = Client.mapLoadingTotal = Client.maxLocModelsMissing = Client.sceneState = 77;
            Client.js5NetQueue = missing ? null : net;
            Client.socketError = true;
            Login.disallowResult = Client.loginRetryCount = Login.reply = Login.loops = Client.loginStep = Login.hopTime = 81;
            let outcome = 'ok';
            try {
                Client.SetMainState(next);
            } catch {
                outcome = 'runtime';
            }
            const fields = [
                Client.gameState,
                Client.locsNotReadyCount,
                Client.mapFilesMissing,
                Client.mapLoadingTotal,
                Client.maxLocModelsMissing,
                Client.sceneState,
                Client.midiSong,
                MidiManager.status,
                MidiManager.trackGroupId,
                MidiManager.trackFileId,
                MidiManager.loop,
                MidiManager.targetVolume,
                MidiManager.fadeSpeed,
                TitleScreen.m_open,
                js5,
                restarts,
                refreshes,
                +(Protocol.oldSocket !== null),
                +(MidiManager.trackArchive !== null),
                outcome,
                Login.disallowResult,
                Client.socketError,
                Client.loginRetryCount,
                Login.reply,
                Login.loops,
                Client.loginStep,
                Login.hopTime
            ];
            expect(fields.join(';'), 'transition ' + i + ' to ' + next).toBe(rows[i]);
        });
    } finally {
        Object.assign(Client, savedWorld);
        Client.advertSuppressed = oldAdverts;
        Client.activeClient = oldActive;
        Login.beginLogin = beginLogin;
        Client.js5NetQueue = oldNet;
        Client.socketError = oldSocketError;
        [Login.reply, Login.hopTime, Login.disallowResult, Login.loops, Client.loginStep, Client.loginRetryCount] = oldLogin;
        Object.assign(MidiManager, savedMidi);
        Protocol.oldSocket = oldSocket;
        Object.assign(TitleScreen, titleState);
        Object.assign(Client, nativeState);
        Client.m_pMidi = savedMusic;
        Preferences.musicVolume = savedVolume;
    }
});
