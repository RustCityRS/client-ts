import { expect } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { loginFixture } from '../login-fixture.js';
import { cachePath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';
import Client from '#/client/Client.js';
import ClientPlayer from '#/dash3d/ClientPlayer.js';
import TextureCache from '#/dash3d/TextureCache.js';
import LocType from '#/config/LocType.js';
import LocEntity from '#/dash3d/LocEntity.js';
import Pix3D from '#/dash3d/Pix3D.js';
import world from '#/dash3d/world.js';
import MinimapBuilder from '#/dash3d/MinimapBuilder.js';
import GlRenderer from '#/gl/GlRenderer.js';
import PointLightManager from '#/gl/PointLightManager.js';
import GlModel from '#/dash3d/GlModel.js';
import GroundShadows from '#/dash3d/GroundShadows.js';
import NullGL from '#/gl/NullGL.js';
import { capsProfileFromJson } from '#/gl/CapsProfile.js';
import TitleScreen from '#/title/TitleScreen.js';
import Minimenu from '#/ui/Minimenu.js';
import WorldMap from '#/ui/WorldMap.js';
import WrappedException from '#/util/WrappedException.js';
import type Js5 from '#/cache/Js5.js';

type Fault = 'ready' | 'texture' | 'gl';
type Scenario = { active: boolean; state: number; fault: Fault };
const scenarios: Scenario[] = [];
for (const active of [false, true]) {
    for (const state of [0, 5, 10, 30]) scenarios.push({ active, state, fault: 'ready' });
    scenarios.push({ active, state: 0, fault: 'texture' });
}
scenarios.push({ active: true, state: 0, fault: 'gl' });

function run(command: string[]): string {
    const child = Bun.spawnSync(command, { timeout: 30000 });
    expect(child.exitCode, child.stderr.toString()).toBe(0);
    return child.stdout.toString().trimEnd();
}

function gamepackTraces(directory: string): string[] {
    const classpath = [directory, hdGamepackPath, joglPath].join(delimiter);
    const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
    run(['javac', asm, '-encoding', 'UTF-8', '-cp', classpath, '-d', directory, ...['GlRecorder', 'HdTitleFrameOracle', 'WindowResourceReloadOracle'].map(name => join(import.meta.dir, name + '.java'))]);
    const java = ['java', asm, '--add-opens=java.base/java.lang=ALL-UNNAMED', '-Djava.awt.headless=true', '-Xmx1g', '-cp', classpath, 'WindowResourceReloadOracle'];
    run([...java, 'instrument', directory]);
    return scenarios.map(({ active, state, fault }) => run([...java, active ? 'active' : 'software', String(state), fault, cachePath, join(import.meta.dir, 'rtx5070.json')]).replaceAll('\r\n', '\n'));
}

// Observe the dispatcher at the same boundary as the Java bytecode probe. Individual renderer,
// title and cache routines have their own oracles. The fault cases run their actual failing call.
function observer(events: string[]) {
    const restore: (() => void)[] = [];
    let inCall = false;
    function replace(owner: object, key: PropertyKey, observation: PropertyDescriptor): void {
        const original = Object.getOwnPropertyDescriptor(owner, key);
        Object.defineProperty(owner, key, { configurable: true, ...observation });
        restore.push(() => {
            if (original) Object.defineProperty(owner, key, original);
            else Reflect.deleteProperty(owner, key);
        });
    }
    function call<T extends object>(owner: T, key: keyof T, name: string, action?: (...args: unknown[]) => void): void {
        expect(typeof owner[key], String(key)).toBe('function');
        replace(owner, key, {
            value(...args: unknown[]) {
                events.push(name);
                inCall = true;
                try {
                    action?.(...args);
                } finally {
                    inCall = false;
                }
            }
        });
    }
    function field<T extends object, K extends keyof T>(owner: T, key: K, name: string, verify?: (value: T[K]) => void): void {
        let value = owner[key];
        replace(owner, key, {
            get: () => value,
            set(next: T[K]) {
                value = next;
                events.push(name);
                verify?.(next);
            }
        });
    }
    return {
        call,
        field,
        replace,
        inCall: () => inCall,
        finish: () => {
            for (const undo of restore.reverse()) undo();
        }
    };
}

async function clientTrace({ active, state, fault }: Scenario): Promise<string> {
    const game: Client = Object.create(Client.prototype);
    const events: string[] = [];
    const watch = observer(events);
    const archive = (): Js5 => Object.assign(Object.create(null), { DiscardAllFiles() {} });
    for (const key of ['animFramesArchive', 'basesArchive', 'interfacesArchive', 'm_pJagFx', 'mapsArchive', 'm_pMidi', 'modelsArchive', 'm_pSprites', 'binaryArchive', 'jingleArchive', 'm_pClientScripts', 'fontMetricsArchive'] as const) {
        watch.replace(Client, key, { value: archive() });
    }
    const players = new Array<ClientPlayer | null>(2049).fill(null);
    const slots = [0, 42, 2047, 2048];
    const cleared = (value: unknown) => expect(value).toBeNull();
    for (const index of slots) {
        const player = new ClientPlayer();
        player.attachment = {};
        watch.field(player, 'attachment', 'e.nb=' + index, cleared);
        players[index] = player;
    }
    watch.replace(Client, 'players', { value: players });
    watch.replace(Client, 'gameState', {
        get() {
            if (!watch.inCall()) events.push('tl.d?');
            return state;
        }
    });
    GlRenderer.active = active;
    GlRenderer.gl = active && fault !== 'gl' ? new NullGL(capsProfileFromJson(readFileSync(join(import.meta.dir, 'rtx5070.json'), 'utf8'))) : null;
    MinimapBuilder.minimapLevel = 67;
    const previous = LocType.modelResult;
    PointLightManager.lightCount = 17;
    PointLightManager.lights = null;
    watch.call(world, 'ResetMap', 'fc.a');
    watch.field(MinimapBuilder, 'minimapImage', 'ha.i=', cleared);
    watch.field(MinimapBuilder, 'minimapLevel', 'id.b=');
    const resourceCache = Client.windowResourceCache;
    if (!resourceCache) throw new Error('HD window resource cache');
    const resetResourceCache = resourceCache.Reset;
    watch.call(resourceCache, 'Reset', 'gn.c', () => resetResourceCache.call(resourceCache));
    watch.field(LocType, 'modelResult', 'ni.n=', next => {
        expect(next).toBeInstanceOf(LocEntity);
        expect(next).not.toBe(previous);
    });
    watch.field(PointLightManager, 'lightCount', 'jf.l=');
    watch.field(PointLightManager, 'lights', 'jf.a=', next => {
        expect(next).toHaveLength(255);
        expect(next?.every(value => value === null)).toBe(true);
    });
    const resetModels = GlModel.resetTempModels;
    watch.call(GlModel, 'resetTempModels', 'td.v', () => resetModels.call(GlModel));
    const unloadShadows = GroundShadows.unload;
    watch.call(GroundShadows, 'unload', 'tj.a', () => unloadShadows.call(GroundShadows));
    const initShadows = GroundShadows.init;
    watch.call(GroundShadows, 'init', 'tj.a(104,104)', (width, height) => {
        expect([width, height]).toEqual([104, 104]);
        initShadows.call(GroundShadows, Number(width), Number(height));
    });
    const initPoints = GlRenderer.initPointParameters;
    watch.call(GlRenderer, 'initPointParameters', 'ga.a', () => initPoints.call(GlRenderer));
    const reset = Client.ResetCache;
    watch.call(Client, 'ResetCache', 'rj.f', () => reset.call(Client));
    const texture: TextureCache = Object.create(TextureCache.prototype);
    texture.ClearCache = () => {
        if (!watch.inCall()) events.push('nk.b');
    };
    watch.replace(Pix3D, 'textureProvider', {
        get() {
            // The JVM records an invokevirtual before a null receiver throws.
            if (fault === 'texture' && !watch.inCall() && events[events.length - 1] === 'ni.n=') events.push('nk.b');
            return fault === 'texture' ? null : texture;
        }
    });
    watch.call(Client, 'clearWindowSprites', 'ja.a');
    watch.call(WorldMap, 'Reset', 'jb.a', flag => expect(flag).toBe(false));
    watch.call(TitleScreen, 'Close', 'je.f');
    watch.call(Client, 'loadFonts', 'hn.a', (sprites, metrics) => {
        expect(sprites).toBe(Client.m_pSprites);
        expect(metrics).toBe(Client.fontMetricsArchive);
    });
    watch.call(Client, 'loadSprites', 'cg.a', sprites => expect(sprites).toBe(Client.m_pSprites));
    watch.field(Minimenu, 'spriteBottomCorner', 'qi.z=', cleared);
    watch.field(Minimenu, 'titleBarSprite', 'd.ib=', cleared);
    watch.field(Minimenu, 'styleSideSprite', 'hd.e=', cleared);
    watch.field(Minimenu, 'bottomEdgeSprite', 'nb.i=', cleared);
    watch.field(Minimenu, 'skinTitleEndSprite2', 'oi.h=', cleared);
    watch.call(TitleScreen, 'Open', 'oi.a', sprites => expect(sprites).toBe(Client.m_pSprites));
    watch.call(game, 'resetToTitle', 'fm.a', open => expect(open).toBe(false));
    watch.call(Client, 'SetMainState', 'pl.a(25,5)', next => expect(next).toBe(25));
    try {
        let result = 'ok';
        try {
            await game.reloadWindowResources();
        } catch (error) {
            const cause = error instanceof WrappedException ? error.cause : error;
            if (!(cause instanceof TypeError) || fault === 'ready') throw error;
            result = 'NullPointerException';
        }
        const occupied = slots.map(index => (players[index]?.attachment == null ? '0' : '1')).join('');
        // Read via Reflect because TypeScript narrows this fixture's initial null across the call.
        const lights: unknown[] | null = Reflect.get(PointLightManager, 'lights');
        return 'calls=' + events.join('|') + '\nstate=' + [result, MinimapBuilder.minimapLevel, LocType.modelResult !== previous, PointLightManager.lightCount, lights?.length ?? -1, occupied].join('|');
    } finally {
        watch.finish();
    }
}

loginFixture(
    import.meta.url,
    'HD window resource reset follows lb.a in software and active renderer modes',
    async () => {
        const directory = mkdtempSync(join(tmpdir(), 'rs530-window-resource-reload-'));
        try {
            const traces = gamepackTraces(directory);
            for (const [index, scenario] of scenarios.entries()) {
                expect(await clientTrace(scenario), JSON.stringify(scenario)).toBe(traces[index]);
            }
        } finally {
            rmSync(directory, { recursive: true, force: true });
        }
    },
    120000,
    'gl'
);
