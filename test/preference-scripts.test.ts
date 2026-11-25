import TitleScreen from '#/title/TitleScreen.js';
import DevicePcmPlayer from '#/sound/DevicePcmPlayer.js';
import LocType from '#/config/LocType.js';
import Client from '#/client/Client.js';
import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { tmpdir } from 'node:os';
import { ClientScript } from '#/script/ClientScript.js';
import ScriptRunner from '#/script/ScriptRunner.js';
import HookReq from '#/script/HookReq.js';
import GameShell from '#/client/GameShell.js';
import ObjType from '#/config/ObjType.js';
import LRUHashCache from '#/datastruct/LRUHashCache.js';
import Pix3D from '#/dash3d/Pix3D.js';
import SecondaryNode from '#/datastruct/SecondaryNode.js';
import ParticleSystem from '#/dash3d/ParticleSystem.js';
import RoofModeStatics from '#/dash3d/RoofModeStatics.js';
import Preferences from '#/ui/Preferences.js';
import AudioEngine from '#/sound/AudioEngine.js';
import MidiManager from '#/sound/MidiManager.js';
import PCMPlayer from '#/sound/PCMPlayer.js';
import MidiPlayer from '#/sound/MidiPlayer.js';
import Pix32 from '#/graphics/Pix32.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { gamepackPath } from './reference.js';
import { freshWorldMap } from './world-map-fixture.js';
import { emptyTextureCache } from './texture-cache-fixture.js';

test('every CS2 preference setter and getter matches Java disk, login, cache, scene and music state', () => {
    const rows: number[][] = [];
    for (const id of [1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 23, 24, 28]) {
        for (const value of [-2147483648, -1, 0, 1, 2, 3, 4, 126, 127, 128, 254, 255, 256, 2147483647]) {
            rows.push([6000 + id, value, 95, 0], [6000 + id, value, 96, 128]);
        }
    }
    for (const value of [-1, 0, 1, 2]) {
        rows.push([6006, value, 96, 128, 1], [6006, value, 96, 128, 2]);
    }
    const dir = mkdtempSync(join(tmpdir(), 'rs530-preference-script-'));
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const owners = [Client, Preferences, GameShell, TitleScreen, AudioEngine, DevicePcmPlayer, MidiManager, PCMPlayer, LocType, ObjType, Pix3D, RoofModeStatics];
    const descriptors = owners.map(owner => Object.getOwnPropertyDescriptors(owner));
    const detail = ParticleSystem.getDetailLevel();
    using _map = freshWorldMap();
    try {
        const built = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game', 'PreferenceScriptOracle.java'), join(import.meta.dir, 'game', 'GameProtocolOracle.java')], { timeout: 15000 });
        expect(built.stderr.toString()).toBe('');
        expect(built.exitCode).toBe(0);
        const run = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'PreferenceScriptOracle'], {
            stdin: Buffer.from(rows.map(row => row.join(' ')).join('\n') + '\n'),
            timeout: 25000
        });
        expect(run.stderr.toString()).toBe('');
        expect(run.exitCode).toBe(0);
        const lines = run.stdout.toString().trim().split(/\r?\n/);
        expect(lines.length).toBe(rows.length);
        let writes = 0;
        Object.defineProperty(globalThis, 'window', {
            configurable: true,
            value: {
                localStorage: {
                    getItem: () => null,
                    setItem: () => {
                        writes++;
                    }
                }
            }
        });
        const midi = new MidiPlayer();
        MidiManager['stream'] = midi;
        AudioEngine.musicPlayer = AudioEngine.effectsPlayer = null;
        DevicePcmPlayer.audioSystem = null;
        TitleScreen.m_open = false;
        Client.modeWhere = 0;
        const interfaces = [
            [LocType, 'm_recentUse', 64],
            [LocType, 'm_mc1', 500],
            [LocType, 'm_mc2', 30],
            [LocType, 'm_mc3', 50],
            [ObjType, 'spriteCache', 100]
        ] as const;
        for (const [owner, field, capacity] of interfaces) Object.defineProperty(owner, field, { value: new LRUHashCache(capacity) });
        const tex = emptyTextureCache();
        const wrongProvider = {
            setLowMemory: () => {
                throw new Error('unexpected dispatch');
            },
            isAvailable: () => false,
            getTextureSmall: () => false,
            getPixels: () => null,
            isLoaded: () => false,
            getTextureData: () => null,
            getTextureColour: () => 0,
            getTextureSolid: () => false
        };
        Pix3D.colourTable = new Int32Array(65536);
        const loc = new LocType(),
            icon = new Pix32(1, 1);
        const script = new ClientScript();
        let fault = 'ok';
        const runner = new ScriptRunner(
            () => script,
            error => {
                if (!(error.cause instanceof TypeError)) throw error;
                fault = error.cause.message.includes('ClassCastException') ? 'cast' : 'null';
            }
        );
        const event = new HookReq();
        event.args = [700];
        for (const [i, [op, value, memory, volume, provider = 0]] of rows.entries()) {
            GameShell.maxMemory = memory;
            Preferences.load();
            Preferences.sent = true;
            RoofModeStatics.roofRemovalDisabled = false;
            RoofModeStatics.roofMarks = Array.from({ length: 4 }, () => Array.from({ length: 104 }, () => new Uint8Array(104)));
            RoofModeStatics.roofMarks[0][0][0] = 19;
            RoofModeStatics.hideMinZ = new Int32Array(3);
            RoofModeStatics.markStamp = 24;
            Client.gameState = 30;
            Client.midiSong = 42;
            MidiManager.status = 0;
            MidiManager.trackGroupId = -1;
            MidiManager.targetVolume = 0;
            Client.jingleActive = true;
            Preferences.musicVolume = volume;
            midi.QueueSetGlobalVolume(256);
            tex.setLowMemory(false);
            tex['recentUse'].Put(11n, new SecondaryNode());
            Pix3D.textureProvider = provider === 1 ? null : provider === 2 ? wrongProvider : tex;
            fault = 'ok';
            LocType.m_recentUse.Put(1n, loc);
            ObjType.spriteCache.Put(1n, icon);
            writes = 0;
            script.opcodes = Int32Array.of(0, op, op + 100, 0, 21);
            script.intOperands = Int32Array.of(value, 0, 0, 0x1234abcd, 0);
            ScriptRunner.intStack.fill(-991);
            runner.ExecuteScript(event, 1000);
            const disk = Preferences.encode();
            const row = [
                ...ScriptRunner.intStack.subarray(0, 3),
                Buffer.from(requireNonNull(disk.m_data).subarray(0, disk.m_pos)).toString('hex'),
                Preferences.packPreferences(),
                Preferences.sent,
                writes,
                Client.gameState,
                RoofModeStatics.getRoofMode(),
                LocType.m_lowMem,
                Preferences.currentAntiAliasingMode,
                tex['lowMemory'],
                LocType.m_recentUse.Find(1n) !== null,
                ObjType.spriteCache.Find(1n) !== null,
                MidiManager.status,
                MidiManager.trackGroupId,
                MidiManager.targetVolume,
                Client.jingleActive,
                midi.GetGlobalVolume(),
                fault,
                tex['recentUse'].Find(11n) !== null,
                RoofModeStatics.roofMarks === null ? -1 : RoofModeStatics.roofMarks[0][0][0],
                requireNonNull(RoofModeStatics.hideMinZ).length
            ];
            expect(row.join(';'), rows[i].join(' ')).toBe(lines[i]);
        }
    } finally {
        owners.forEach((owner, i) => Object.defineProperties(owner, descriptors[i]));
        ParticleSystem.setDetailLevel(detail);
        if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
        else Reflect.deleteProperty(globalThis, 'window');
        rmSync(dir, { recursive: true, force: true });
    }
}, 45000);
