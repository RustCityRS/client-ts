import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import JagString, { fromJsString } from '#/datastruct/JagString.js';
import SharedPtrList from '#/datastruct/SharedPtrList.js';
import Pix2D from '#/graphics/Pix2D.js';
import SoftwareFont from '#/graphics/SoftwareFont.js';
import WorldMapFont from '#/graphics/WorldMapFont.js';
import { mapFontSurface } from '#/graphics/WorldMapFontSurface.js';
import LocalisedText from '#/ui/LocalisedText.js';
import MapElementInstance from '#/ui/MapElementInstance.js';
import WorldMap from '#/ui/WorldMap.js';
import WorldMapLabels from '#/ui/WorldMapLabels.js';
import { requireNonNull } from '#/util/JavaArray.js';
import WrappedException from '#/util/WrappedException.js';
import { loginFixture } from './login-fixture.js';
import { gamepackPath } from './reference.js';

const cases = ['load,2', 'zoom,2', 'zoom,2147483647', 'zoom,-2147483648', ...[-2147483648, -3, 0, 2, 32, 41, 42, 127, 2147483647, -116 ^ -90, -116 ^ -89].map(scale => 'guard,' + scale), 'label,0', 'split,0', 'sprite,0'];

function observe(input: string, mapFont: WorldMapFont): string {
    const [scenario, n] = input.split(',');
    const scale = Number(n);
    const trace: string[] = [];
    const restore: (() => void)[] = [];
    function watch<T extends object, K extends keyof T>(owner: T, key: K, id: string, effect?: () => void): void {
        const descriptor = requireNonNull(Object.getOwnPropertyDescriptor(owner, key));
        Object.defineProperty(owner, key, {
            configurable: true,
            get() {
                trace.push(id);
                effect?.();
                return descriptor.value;
            }
        });
        restore.push(() => Object.defineProperty(owner, key, descriptor));
    }
    function replace<T extends object, K extends keyof T>(owner: T, key: K, replacement: T[K]): void {
        const previous = owner[key];
        owner[key] = replacement;
        restore.push(() => {
            owner[key] = previous;
        });
    }
    WorldMap.current = null;
    WorldMap.progress = 100;
    WorldMap.centerX = 10;
    WorldMap.centerZ = 20;
    WorldMap.zoom = 3;
    WorldMap.flashCount = 0;
    Client.displayFps = false;
    WorldMap.displayHeight = WorldMap.displayWidth = WorldMap.viewTop = WorldMap.viewMinX = 0;
    Pix2D.setPixels(new Int32Array(120 * 80), 120, 80);
    let status = 'ok';
    try {
        if (scenario === 'zoom' || scenario === 'guard' || scenario === 'load') {
            watch(WorldMap, 'zoom', 'zoom', () => {
                if (scenario === 'zoom') {
                    WorldMap.centerX -= 7;
                    WorldMap.centerZ += 5;
                }
            });
            watch(LocalisedText, 'LOADINGDOTDOTDOT', 'loading');
            replace(WorldMap, 'drawTiles', (_r, top, mapRight, _b, mapBottom, left) => {
                trace.push('tiles:' + left + ',' + top + ',' + mapRight + ',' + mapBottom);
            });
            replace(WorldMap, 'drawScaled', () => {});
            replace(WorldMap, 'drawLabels', () => {});
            const format = JagString.fromInt;
            replace(JagString, 'fromInt', value => {
                trace.push('format');
                return format(value);
            });
            Client.displayFps = scenario === 'guard';
            const font = new SoftwareFont(new Uint8Array(257));
            font.drawRight = text => {
                trace.push(text === null ? 'debug:null' : 'debug:text');
            };
            Client.p12 = font;
            if (scenario === 'load') {
                WorldMap.progress = 0;
                Client.fontBold12 = null;
            }
            WorldMap.draw(3, scale, 4, 37, 52);
        } else if (scenario === 'label' || scenario === 'split') {
            const labels = new WorldMapLabels(1);
            labels.z[0] = 19;
            labels.x[0] = 28;
            labels.flags[0] = 8;
            labels.colors[0] = -1;
            labels.text[0] = fromJsString('AB<br>C');
            WorldMap.labels = labels;
            WorldMap.baseX = 10;
            WorldMap.baseZ = 20;
            WorldMap.height = 80;
            const lines = new Array<JagString | null>(3).fill(null);
            WorldMap.labelLines = lines;
            WorldMap.font11 = mapFont;
            Client.fontPlain11 = scenario === 'split' ? null : new SoftwareFont(new Uint8Array(257));
            watch(labels, 'z', 'labelZ', () => {
                WorldMap.baseZ += 17;
            });
            watch(labels, 'x', 'labelX', () => {
                WorldMap.baseX += 11;
            });
            watch(WorldMap, 'labelLines', 'lines');
            const length = JagString.prototype.getLength;
            replace(JagString.prototype, 'getLength', function (this: JagString) {
                if (this === lines[0]) trace.push('length');
                return length.call(this);
            });
            replace(mapFont, 'drawStringCentered', (text, x, y) => {
                trace.push('label:' + x + ',' + y + ',' + requireNonNull(text).length);
            });
            WorldMap.drawLabels(0, 0, 0, 120, 80, 80, 120, 0);
        } else {
            const list = new SharedPtrList<MapElementInstance>(),
                icon = new MapElementInstance();
            icon.x = 24;
            icon.z = 37;
            icon.mapFunction = 0;
            list.push_back(icon);
            WorldMap.deferredIcons = list;
            WorldMap.mapFunctions = [null];
            WorldMap.locIds = [];
            watch(icon, 'x', 'iconX');
            watch(icon, 'z', 'iconZ');
            WorldMap.drawMapFunctions(65536, 0, 0, 0, 0, 0, 0, 0, 65536, 0);
        }
    } catch (error) {
        let cause = error;
        while (cause instanceof WrappedException) cause = cause.cause;
        if (!(cause instanceof TypeError)) throw error;
        status = 'null';
    } finally {
        for (const undo of restore.reverse()) undo();
    }
    return input + '|' + status + '|' + trace.join(';') + '|' + [WorldMap.displayHeight, WorldMap.viewTop, WorldMap.viewMinX, WorldMap.displayWidth].join(',');
}

loginFixture(
    import.meta.url,
    'original world map field order, argument evaluation and debug string guard',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-world-map-order-'));
        try {
            const flags = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED', '--add-exports', 'java.base/jdk.internal.org.objectweb.asm.tree=ALL-UNNAMED'];
            const compiled = Bun.spawnSync(['javac', ...flags, '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game', 'WorldMapReadOrderOracle.java')]);
            expect(compiled.exitCode, compiled.stderr.toString()).toBe(0);
            const oracle = Bun.spawnSync(['java', '-Djava.awt.headless=true', ...flags, '-cp', dir + delimiter + gamepackPath, 'WorldMapReadOrderOracle', ...cases]);
            expect(oracle.exitCode, oracle.stderr.toString()).toBe(0);
            const expected = oracle.stdout.toString().trimEnd().split(/\r?\n/);
            expect(expected).toHaveLength(cases.length);
            GameShell.canvas = mapFontSurface;
            const font = new WorldMapFont(11, true, mapFontSurface);
            for (const [i, input] of cases.entries()) expect(observe(input, font), input).toBe(expected[i]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    30000
);
