import { captureSdFrame } from '#/dash3d/SdWorldRaster.js';
import type { SdRasterFrame } from '#/dash3d/SdRasterSpans.js';
import { renderSdFrames } from '../render/sd-device.js';
import { expect } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import ClientBuild from '#/client/ClientBuild.js';
import CollisionMap from '#/dash3d/CollisionMap.js';
import ModelLit from '#/dash3d/ModelLit.js';
import world from '#/dash3d/world.js';
import Minimenu from '#/ui/Minimenu.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { loginFixture } from '../login-fixture.js';
import { cachePath, gamepackPath } from '../reference.js';
import { buildScene } from './lumbridge-scene.js';

const width = 512,
    height = 334;

function oracle(dir: string, dynamic: boolean): { rows: string[]; pixels: Buffer; region: string } {
    const exports = ['--add-exports', 'java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED', '--add-exports', 'java.base/jdk.internal.org.objectweb.asm.tree=ALL-UNNAMED'];
    const compile = Bun.spawnSync([
        'javac',
        ...exports,
        '-cp',
        gamepackPath,
        '-d',
        dir,
        join(import.meta.dir, '../review/provider-config/ProviderConfigOracle.java'),
        join(import.meta.dir, 'FinishBuildOracle.java'),
        join(import.meta.dir, 'NativeSceneClickOracle.java')
    ]);
    expect(compile.exitCode, compile.stderr.toString()).toBe(0);
    // Neither kk.a nor its callees are instrumented. FinishBuildOracle supplies the real cache setup.
    const java = Bun.spawnSync(['java', ...exports, '--add-opens=java.base/java.lang=ALL-UNNAMED', '-Djava.awt.headless=true', '-cp', dir + delimiter + gamepackPath, 'NativeSceneClickOracle', cachePath, dir, ...(dynamic ? ['dynamic'] : [])]);
    expect(java.exitCode, java.stderr.toString()).toBe(0);
    const region = java.stdout
        .toString()
        .split(/\r?\n/)
        .find(line => line.startsWith('region '));
    expect(region).toBeDefined();
    return {
        region: requireNonNull(region).slice(7),
        rows: java.stdout
            .toString()
            .trimEnd()
            .split(/\r?\n/)
            .filter(s => s.startsWith('scene '))
            .map(s => s.slice(6)),
        pixels: readFileSync(join(dir, 'scene-click.bin'))
    };
}

function regionHash(values: (Int32Array | Uint8Array | (Int32Array | Uint8Array)[])[]): number {
    let hash = 1;
    for (const row of values) {
        let item = 1;
        if (row instanceof Int32Array || row instanceof Uint8Array) {
            for (const value of row) item = (Math.imul(item, 31) + (row instanceof Uint8Array ? (value << 24) >> 24 : value)) | 0;
        } else {
            item = regionHash(row);
        }
        hash = (Math.imul(hash, 31) + item) | 0;
    }
    return hash;
}

for (const dynamic of [false, true])
    loginFixture(
        import.meta.url,
        (dynamic ? 'rotated instanced' : 'normal') + ' Lumbridge rebuild, native scene pixels, menu picks and eight crosshair frames match gj.e and kk.a',
        async () => {
            const dir = mkdtempSync(join(tmpdir(), 'rs530-real-scene-click-'));
            try {
                const pixels = buildScene(dynamic),
                    reference = oracle(dir, dynamic);
                expect([regionHash(requireNonNull(world.levelHeightmaps)), regionHash(CollisionMap.levelMaps.map(map => requireNonNull(map).flags)), regionHash(requireNonNull(ClientBuild.m_mapl)), world.numOccluders].join(',')).toBe(
                    reference.region
                );
                expect(reference.rows).toHaveLength(9);
                expect(reference.pixels.length).toBe(9 * pixels.length * 4);
                if (!dynamic) {
                    expect(reference.rows[0]).toBe('50,50||57,0,0,0');
                    expect(reference.rows[5]).toBe('48,50|158244849850800|57,-144,-121,0;20,48,51,158244849850800;1004,48,51,36844');
                }
                const baseline = reference.pixels.subarray(0, pixels.length * 4);
                const captures: SdRasterFrame[] = [];
                const painted = new Set<string>();
                const compare = (pixels: Int32Array, index: number): void => {
                    const rgba = reference.pixels.subarray(index * pixels.length * 4, (index + 1) * pixels.length * 4);
                    for (let j = 0; j < pixels.length; j++) {
                        const expected = rgba.readInt32BE(j * 4);
                        if (expected !== pixels[j]) throw new Error('Java pixel mismatch at x=' + (j % width) + ', y=' + ((j / width) | 0) + ', frame ' + index + ', actual ' + pixels[j] + ', expected ' + expected);
                    }
                };
                for (let i = 0; i < 9; i++) {
                    const mode = i === 0 ? 0 : i <= 4 ? 1 : 2,
                        x = mode === 2 ? 112 : 256,
                        y = mode === 2 ? 46 : 167;
                    world.updateMousePicking(0, x - 256, y - 167);
                    Minimenu.crossMode = mode;
                    Minimenu.crossTicks = i === 0 ? 0 : ((i - 1) % 4) * 100;
                    Minimenu.crossX = Minimenu.mouseX = x;
                    Minimenu.crossY = Minimenu.mouseY = y;
                    Minimenu.count = 0;
                    pixels.fill(0);
                    const draw = () => Client.drawScene(height, width, 0, 0, false);
                    if (process.env.RS530_NATIVE_SCENE_GPU === '1') captures.push(captureSdFrame(draw));
                    else draw();
                    const picks = Array.from(requireNonNull(ModelLit.pickedTypecodes).subarray(0, ModelLit.pickedCount)).join(',');
                    const menu = Array.from({ length: Minimenu.count }, (_, j) => [Minimenu.actions[j], Minimenu.paramB[j], Minimenu.paramC[j], Minimenu.keys[j]].join(',')).join(';');
                    expect([world.groundX + ',' + world.groundZ, picks, menu].join('|'), 'picking frame ' + i).toBe(reference.rows[i]);
                    const rgba = reference.pixels.subarray(i * pixels.length * 4, (i + 1) * pixels.length * 4);
                    if (captures.length === 0) compare(pixels, i);
                    if (i !== 0) {
                        const differences: string[] = [];
                        for (let j = 0; j < pixels.length; j++) {
                            const value = rgba.readInt32BE(j * 4);
                            if (value !== baseline.readInt32BE(j * 4)) {
                                const dx = (j % width) - x,
                                    dy = ((j / width) | 0) - y;
                                if (dx < -8 || dx >= 8 || dy < -8 || dy >= 8) throw new Error('change outside cross at ' + j);
                                differences.push(dx + ',' + dy + '=' + value);
                            }
                        }
                        expect(differences.length).toBeGreaterThan(0);
                        painted.add(differences.join(';'));
                    }
                }
                if (captures.length) {
                    const frames = await renderSdFrames(dir, captures);
                    expect(frames).toHaveLength(9);
                    frames.forEach(compare);
                }
                expect(painted.size).toBe(8);
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        },
        60000
    );
