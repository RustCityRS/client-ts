import { expect, spyOn } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ClientBuild from '#/client/ClientBuild.js';
import LocType from '#/config/LocType.js';
import ClientKeyboardListener from '#/client/ClientKeyboardListener.js';
import ClientMouseListener from '#/client/ClientMouseListener.js';
import GameShell from '#/client/GameShell.js';
import MouseWheel from '#/client/MouseWheel.js';
import NanoTimer, { nanoTime } from '#/client/NanoTimer.js';
import ClientEntity from '#/dash3d/ClientEntity.js';
import CollisionMap from '#/dash3d/CollisionMap.js';
import world from '#/dash3d/world.js';
import type ModelSource from '#/dash3d/ModelSource.js';
import ParticleSystem from '#/dash3d/ParticleSystem.js';
import ProceduralTexture from '#/dash3d/ProceduralTexture.js';
import TextureOpMonochromeFill from '#/dash3d/TextureOpMonochromeFill.js';
import EnumStringEntry from '#/datastruct/EnumStringEntry.js';
import LongNode from '#/datastruct/LongNode.js';
import ImageProducerPixMap from '#/graphics/ImageProducerPixMap.js';
import type { ImageConsumer } from '#/graphics/PixScreen.js';
import BrokenInputStream from '#/io/BrokenInputStream.js';
import File, { type RandomAccessFile } from '#/io/File.js';
import Js5NetQueue from '#/io/Js5NetQueue.js';
import { SocketIoError } from '#/io/SocketPlatform.js';
import WorldMap from '#/ui/WorldMap.js';
import Preferences from '#/ui/Preferences.js';
import { requireNonNull } from '#/util/JavaArray.js';
import WrappedException from '#/util/WrappedException.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

type Row = (...args: unknown[]) => void;

class Actor extends ClientEntity {
    getBasId(): number {
        throw new Error('unused');
    }
    draw(): void {
        throw new Error('unused');
    }
    getMinY(): number {
        throw new Error('unused');
    }
    update(): void {
        throw new Error('unused');
    }
}

function defaults(row: Row) {
    const text = new EnumStringEntry(),
        number = new LongNode();
    row('entries', text.value, text.key, text.next, text.prev, number.value, number.key, number.next, number.prev);
    const texture = new ProceduralTexture(),
        other = new ProceduralTexture(),
        ops = requireNonNull(texture['operators']);
    row(
        'texture',
        ops.length,
        ops[0] === texture['colour'],
        ops[1] === texture['alpha'],
        texture['colour'] !== texture['alpha'],
        requireNonNull(texture['textureIds']).length,
        requireNonNull(texture['spriteIds']).length,
        texture['spriteIds'] !== texture['textureIds'],
        other['textureIds'] !== texture['textureIds'],
        other['colour'] !== texture['colour']
    );
    for (const op of ops) {
        expect(op).toBeInstanceOf(TextureOpMonochromeFill);
        const fill = op as TextureOpMonochromeFill;
        row('fill', fill instanceof TextureOpMonochromeFill, fill.cacheCapacity, fill.monochrome, requireNonNull(fill.children).length, fill['value']);
    }
    const actor = new Actor(),
        neighbor = new Actor();
    actor.pathX[0] = 81;
    neighbor.pathX[0] = 35;
    for (const hide of [false, true]) {
        actor.mergeNormals(neighbor, -3, 0, 2147483647, hide);
        actor.mergeNormals(null as unknown as ModelSource, -2147483648, 5, 2, !hide);
        row('model', actor.light(23, -7, 0) === actor, neighbor.light(-1, 2, 3) === neighbor, actor.isVisible(), actor.isVisible(), actor.pathX[0], neighbor.pathX[0]);
    }
    const particles = new ParticleSystem();
    for (const detail of [0, 2]) {
        ParticleSystem.setDetailLevel(detail);
        particles.reset();
        row('particles', ParticleSystem.getDetailLevel());
    }
}

function pixmap(row: Row) {
    const source = new ImageProducerPixMap();
    let calls = 0;
    const a = new Proxy({} as ImageConsumer, {
            get: () => () => {
                calls++;
            }
        }),
        b = new Proxy({} as ImageConsumer, {
            get: () => {
                throw new Error('unused');
            }
        });
    for (let state = 0; state < 3; state++) {
        if (state === 1) source.addConsumer(a);
        if (state === 2) source.removeConsumer(a);
        source.requestTopDownLeftRightResend(b);
        source.requestTopDownLeftRightResend(null);
        row('image', state, source.isConsumer(null), source.isConsumer(a), source.isConsumer(b), calls);
    }
}

async function shell(row: Row) {
    const applet = new Client();
    row('applet', applet instanceof GameShell, applet['errorShown'], new Client() !== applet);
    for (const focus of [false, true]) {
        GameShell.m_focusIn = focus;
        GameShell.fullRedraw = false;
        applet['focusLost']();
        row('lost', GameShell.m_focusIn, GameShell.fullRedraw);
        applet['focusGained']();
        row('gained', GameShell.m_focusIn, GameShell.fullRedraw);
        applet['focusLost']();
        row('lost', GameShell.m_focusIn, GameShell.fullRedraw);
        for (const name of ['windowOpened', 'windowActivated', 'windowIconified', 'windowDeiconified', 'windowDeactivated', 'windowClosed'] as const) {
            GameShell.m_focusIn = focus;
            GameShell.fullRedraw = !focus;
            applet[name]();
            row(name, GameShell.m_focusIn, GameShell.fullRedraw, applet['errorShown']);
        }
    }
    Client.js5NetQueue = new Js5NetQueue();
    Client.loopCycle = 86;
    ClientKeyboardListener.idleCycles = 17;
    ClientMouseListener.idleCycles = 9;
    MouseWheel.rotation = 34;
    for (const state of [1000, 20, 20, 1000]) {
        Client.gameState = state;
        await applet['MainLoop']();
        row('mainloop', state, Client.gameState, Client.loopCycle, ClientKeyboardListener.idleCycles, ClientMouseListener.idleCycles, MouseWheel.rotation);
    }
    Client.gameState = 20;
    Client.js5NetQueue = null;
    try {
        await applet['MainLoop']();
        throw new Error('Missing queue must fail');
    } catch (err) {
        if (!(err instanceof WrappedException)) throw err;
        row('mainloop-error', err.cause instanceof TypeError, err.context, Client.loopCycle, ClientKeyboardListener.idleCycles, ClientMouseListener.idleCycles);
    }
    WorldMap.progress = 57;
    WorldMap.targetX = 18;
    WorldMap.targetZ = 42;
    WorldMap.overlayIds = [null];
    WorldMap.reload(25);
    row('map', Client.gameState, WorldMap.progress, WorldMap.targetX, WorldMap.targetZ, WorldMap.overlayIds === null);
    const checked = new SocketIoError('socket closed');
    Client.gameState = 20;
    Client.js5NetQueue = new Js5NetQueue();
    Client.js5NetQueue.Service = async () => {
        throw checked;
    };
    await expect(applet['MainLoop']()).rejects.toBe(checked);
    Client.js5NetQueue.Service = async () => {
        applet['closed'] = true;
        throw new TypeError('closed while the queue was pending');
    };
    await applet['MainLoop']();
    const cycle = Client.loopCycle;
    await applet['MainLoop']();
    expect(Client.loopCycle).toBe(cycle);
}

async function timer(row: Row) {
    const timer = new NanoTimer();
    for (const ms of [-20000, -120000, -1400000]) {
        const before = nanoTime(),
            start = before + BigInt(ms) * 1000000n;
        timer['nextTick'] = start;
        const ticks = await timer.wait(0, 100000),
            end = timer['nextTick'];
        row('nano', ms, ticks, end === start + BigInt(ticks) * 100000000000n, end >= before);
    }
}

function locations(row: Row) {
    world.init(4, 12, 12, 3, false);
    const flags = (ClientBuild.m_mapl = Array.from({ length: 4 }, () => Array.from({ length: 12 }, () => new Uint8Array(12))));
    for (let p = 0; p < 4; p++) CollisionMap.levelMaps[p] = new CollisionMap(12, 12);
    const type = new LocType();
    type.blockwalk = 1;
    LocType.m_recentUse.Put(17n, type);
    LocType.m_recentUse.Put(0n, new LocType());
    const key = (17n << 32n) | (22n << 14n) | (3n << 20n);
    for (let action = 0; action < 5; action++) {
        const plane = 1,
            x = 4,
            z = 5;
        world.SetGroundDecor(plane, x, z, 0, new Actor(), key, false);
        const map = requireNonNull(CollisionMap.levelMaps[plane]);
        map.flags[x][z] = 0x40008;
        Preferences.allLevelsVisible = action !== 1;
        ClientBuild.buildLevel = 0;
        Preferences.showGroundDecorations = false;
        flags[1][x][z] = action === 2 ? 2 : 0;
        Client.LocChangeUnchecked(22, plane, action === 4 ? 17 : -1, 3, action === 3 ? 0 : x, 3, z);
        row('loc', action, world.GdType(plane, x, z), map.flags[x][z], Preferences.showGroundDecorations);
    }
}

function file(row: Row) {
    let open = true;
    const endpoint = {
        close() {
            open = false;
        }
    } as RandomAccessFile;
    const handle = File.open(endpoint, 'sd-member-cache', 1024n);
    const warning = spyOn(console, 'log').mockImplementation((message: string) => row(message));
    try {
        for (let i = 0; i < 2; i++) {
            handle.finalize();
            row('finalize', i, open, handle['file'] === null, handle.getFile() === 'sd-member-cache');
        }
    } finally {
        warning.mockRestore();
    }
}

async function brokenStream(row: Row) {
    const waits: number[] = [];
    const sleep = spyOn(globalThis, 'setTimeout').mockImplementation(((resume: () => void, delay: number) => {
        waits.push(delay);
        queueMicrotask(resume);
    }) as typeof setTimeout);
    try {
        const eof = await new BrokenInputStream().read();
        row('eof', eof, '[' + waits.join(', ') + ']');
    } finally {
        sleep.mockRestore();
    }
}

loginFixture(
    import.meta.url,
    'SD scene defaults, timing, applet callbacks, file finalization and game loop match the stock gamepack',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'sd-platform-members-'));
        try {
            const source = join(import.meta.dir, 'game/SdPlatformMemberOracle.java');
            const compile = Bun.spawnSync(['javac', '-cp', gamepackPath, '-d', dir, source]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const java = Bun.spawnSync(['java', '-Djava.awt.headless=false', '-cp', dir + delimiter + gamepackPath, 'SdPlatformMemberOracle', join(dir, 'file'), join(dir, 'sleep.jfr')]);
            expect(java.exitCode, java.stderr.toString()).toBe(0);
            const rows: string[] = [],
                row: Row = (...args) => {
                    rows.push(args.map(String).join('|'));
                };
            defaults(row);
            pixmap(row);
            await shell(row);
            locations(row);
            await timer(row);
            file(row);
            await brokenStream(row);
            expect(rows).toEqual(java.stdout.toString().trimEnd().split(/\r?\n/));
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    45000,
    'sd'
);
