import { delimiter } from 'node:path';
import { hdGamepackPath, joglPath } from './render/hd-reference.js';
import { glJar } from '../src/client/ClientVariant.js';
import WrappedException from '../src/util/WrappedException.js';
import { gamepackPath } from './reference.js';
import { requireNonNull } from '../src/util/JavaArray.js';
import { afterEach, beforeEach, expect, test } from 'bun:test';
import { fileURLToPath } from 'node:url';
import PacketT from '../src/io/PacketT.js';
import Preferences from '../src/ui/Preferences.js';
import GameShell from '../src/client/GameShell.js';
import ParticleSystem from '../src/dash3d/ParticleSystem.js';
import LocType from '../src/config/LocType.js';

let restore: () => void;
beforeEach(() => {
    const saved = { ...Preferences };
    const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: { getItem: () => null } } });
    const level = ParticleSystem.getDetailLevel(),
        memory = GameShell.maxMemory,
        lowDetail = LocType.m_lowMem;
    restore = () => {
        if (windowDescriptor) Object.defineProperty(globalThis, 'window', windowDescriptor);
        else Reflect.deleteProperty(globalThis, 'window');
        Object.assign(Preferences, saved);
        ParticleSystem.setDetailLevel(level);
        GameShell.maxMemory = memory;
        LocType.m_lowMem = lowDetail;
    };
});
afterEach(() => restore());

const fields = [
    'brightness',
    'allLevelsVisible',
    'removeRoofsSelectively',
    'showGroundDecorations',
    'highDetailTextures',
    'manyIdleAnimations',
    'flickeringEffects',
    'highDetailTextures2',
    'characterShadows',
    'sceneryShadows',
    'highDetailLighting',
    'highWaterDetail',
    'fogEnabled',
    'currentAntiAliasingMode',
    'antiAliasingMode',
    'stereo',
    'soundEffectVolume',
    'musicVolume',
    'areaSoundVolume',
    'fullscreenWidth',
    'fullscreenHeight',
    'windowMode',
    'steppedCameraKeys',
    'favouriteWorld',
    'buildArea',
    'version10Option',
    'cursorsEnabled',
    'safeMode'
] as const;

function accessOrder(): [string, string] {
    const events: string[] = [];
    const slots = new Map<string, number>(fields.map((key, index) => [key, index]));
    let loading = true;
    const prefs = new Proxy(Preferences, {
        get(target, key, receiver) {
            if (!loading && typeof key === 'string' && slots.has(key)) events.push(String(slots.get(key)));
            return Reflect.get(target, key, receiver);
        },
        set(target, key, value, receiver) {
            if (loading && typeof key === 'string' && slots.has(key)) events.push(String(slots.get(key)));
            return Reflect.set(target, key, value, receiver);
        }
    });
    const get = ParticleSystem.getDetailLevel,
        set = ParticleSystem.setDetailLevel;
    try {
        ParticleSystem.setDetailLevel = level => {
            events.push('particles');
            set.call(ParticleSystem, level);
        };
        ParticleSystem.getDetailLevel = () => {
            events.push('particles');
            return get.call(ParticleSystem);
        };
        prefs.load();
        const stores = events.join(',');
        events.length = 0;
        loading = false;
        prefs.packPreferences();
        return [stores, events.join(',')];
    } finally {
        ParticleSystem.getDetailLevel = get;
        ParticleSystem.setDetailLevel = set;
    }
}

type Input = [memory: number, start: number, bytes: Uint8Array | null, mode?: 'file' | 'null'];

function comparePreferences(): void {
    const inputs: Input[] = [];
    const lengths = [19, 23, 22, 23, 24, 28, 28, 29, 30, 31, 32, 33];
    for (let version = 0; version < 12; version++) {
        const size = lengths[version];
        for (const seed of [0, 1, 31, 191]) {
            const bytes = Uint8Array.from({ length: 1 + size }, (_, i) => (i * seed + seed) & 255);
            bytes[0] = version;
            for (const memory of [95, 96]) {
                inputs.push([memory, 0, bytes], [memory, 0, bytes.slice(0, -1)], [memory, 2, Uint8Array.of(9, 9, ...bytes, 255)]);
            }
            if (seed === 31) inputs.push([96, 0, bytes, 'file'], [95, 0, bytes.slice(0, -1), 'file']);
        }
        for (let offset = 1; offset <= size; offset++) {
            const bytes = new Uint8Array(size + 1);
            bytes[0] = version;
            bytes[offset] = 1;
            inputs.push([96, 0, bytes]);
        }
    }
    for (const start of [-2147483648, -2147483647, -1, 0, 1, 2147483647]) {
        for (const bytes of [null, new Uint8Array(0), Uint8Array.of(255)]) inputs.push([128, start, bytes]);
    }
    inputs.push([128, 0, Uint8Array.of(12)], [128, 0, null, 'null']);
    const source = fileURLToPath(new URL('./game/PreferencesOracle.java', import.meta.url));
    const cp = glJar ? [hdGamepackPath, joglPath].join(delimiter) : gamepackPath;
    const java = Bun.spawnSync(['java', '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED', '-Djava.awt.headless=true', '-cp', cp, source, glJar ? 'gl' : 'sd'], {
        stdin: Buffer.from(inputs.map(([m, p, b, mode]) => [m, p, mode ?? 'packet', b === null ? 'null' : Buffer.from(b).toString('hex')].join(' ')).join('\n') + '\n'),
        timeout: 20000
    });
    expect(java.exitCode, java.stderr.toString()).toBe(0);
    const [stores, reads, ...expected] = java.stdout.toString().trimEnd().split(/\r?\n/);
    expect(accessOrder()).toEqual([stores, reads]);
    expect(expected).toHaveLength(inputs.length);
    inputs.forEach(([memory, start, bytes, mode], i) => {
        GameShell.maxMemory = memory;
        const packet = mode === 'null' ? null : new PacketT(bytes);
        if (packet !== null) packet.m_pos = start;
        let status = 'ok';
        if (mode === 'file') {
            const prior = Object.getOwnPropertyDescriptor(globalThis, 'window');
            const data = Buffer.from(requireNonNull(bytes)).toString('base64');
            try {
                Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: { getItem: () => data } } });
                Preferences.load();
            } finally {
                if (prior) Object.defineProperty(globalThis, 'window', prior);
                else Reflect.deleteProperty(globalThis, 'window');
            }
        } else {
            Preferences.load();
            try {
                Preferences.decode(packet);
            } catch (error) {
                if (!(error instanceof WrappedException)) throw error;
                const root = error.cause;
                if (root instanceof TypeError) status = 'NullPointerException';
                else if (root instanceof RangeError) status = 'ArrayIndexOutOfBoundsException';
                else throw error;
                status += ' ' + error.context;
            }
        }
        const written = Preferences.encode();
        const state = [...fields.map(key => Preferences[key]), ParticleSystem.getDetailLevel()];
        const value = [status, packet?.m_pos ?? '-', Buffer.from(requireNonNull(written.m_data).subarray(0, written.m_pos)).toString('hex'), Preferences.packPreferences(), state.join(',')].join(';');
        expect(value, 'sample ' + i + ' memory ' + memory + ' start ' + start + ' version ' + bytes?.[start]).toBe(expected[i]);
    });
}

test('both gamepacks match preference file loads, decode, encode and login flags across formats 0 through 11', () => {
    comparePreferences();
    if (!glJar) {
        const hd = Bun.spawnSync([process.execPath, 'test', fileURLToPath(import.meta.url)], { env: { ...process.env, RS530_GAMEPACK_IDENTITY: 'gl' } });
        expect(hd.exitCode, hd.stderr.toString()).toBe(0);
        expect(hd.stderr.toString()).toMatch(/^\s*3 pass$/m);
    }
}, 60000);

test('the browser GL launcher defaults to resizable HD and 4x AA unless a packet supplies those settings', () => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
    let saved: string | null = null;
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: { getItem: () => saved } } });
    try {
        Preferences.load(true);
        const modes = () => [Preferences.windowMode, Preferences.antiAliasingMode, Preferences.currentAntiAliasingMode];
        expect(modes()).toEqual(glJar ? [2, 2, 2] : [0, 0, 0]);
        for (const mode of [0, 1, 2]) {
            for (const aa of [0, 1, 2]) {
                Preferences.windowMode = mode;
                Preferences.antiAliasingMode = aa;
                saved = Buffer.from(requireNonNull(Preferences.encode().m_data)).toString('base64');
                Preferences.load(true);
                expect(modes()).toEqual([mode, aa, aa]);
            }
        }
        saved = Buffer.alloc(20).toString('base64'); // Version 0 predates the window-mode byte.
        Preferences.load(true);
        expect(modes()).toEqual([glJar ? 2 : 0, 0, 0]);
        saved = null;
        Preferences.load();
        expect(modes()).toEqual([0, 0, 0]);
    } finally {
        if (previous) Object.defineProperty(globalThis, 'window', previous);
        else Reflect.deleteProperty(globalThis, 'window');
    }
});

test('saving a favourite world migrates existing browser settings to the Java preferences packet', () => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const old = Array(29).fill(null);
    old[1] = 4;
    old[19] = 68;
    old[20] = 111;
    let value = JSON.stringify(old);
    Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: {
            localStorage: {
                getItem: () => value,
                setItem: (_key: string, updated: string) => {
                    value = updated;
                }
            }
        }
    });
    try {
        Preferences.load();
        expect(Preferences.favouriteWorld).toBe(0);
        Preferences.favouriteWorld = 0x81122334 | 0;
        Preferences.write();
        const bytes = Buffer.from(value, 'base64');
        expect(bytes[0]).toBe(11);
        expect(bytes.length).toBe(34);
        expect(bytes.readInt32BE(24)).toBe(0x81122334 | 0);
        Preferences.load();
        expect([Preferences.brightness, Preferences.musicVolume, Preferences.areaSoundVolume, Preferences.favouriteWorld]).toEqual([4, 68, 111, 0x81122334 | 0]);
    } finally {
        if (previous) Object.defineProperty(globalThis, 'window', previous);
        else Reflect.deleteProperty(globalThis, 'window');
    }
});
