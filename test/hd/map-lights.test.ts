import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import ClientBuild from '#/client/ClientBuild.js';
import LightType from '#/config/LightType.js';
import CollisionMap from '#/dash3d/CollisionMap.js';
import Environment from '#/dash3d/Environment.js';
import Pix3D from '#/dash3d/Pix3D.js';
import StaticPointLight from '#/dash3d/StaticPointLight.js';
import world from '#/dash3d/world.js';
import GlRenderer from '#/gl/GlRenderer.js';
import PointLightManager from '#/gl/PointLightManager.js';
import PacketT from '#/io/PacketT.js';
import { requireNonNull } from '#/util/JavaArray.js';
import WrappedException from '#/util/WrappedException.js';
import { localAssets } from '../cachefile.js';
import { loginFixture } from '../login-fixture.js';
import { cachePath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

const bits = (f: number) => new Int32Array(Float32Array.of(f).buffer)[0];

loginFixture(
    import.meta.url,
    'HD title ground regions match the original light placements, all four spatial grids and every environment',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-hd-map-lights-'));
        try {
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const compile = Bun.spawnSync(['javac', '-encoding', 'UTF-8', '-cp', cp, '-sourcepath', import.meta.dir, '-d', dir, ...['GlRecorder', 'HdTitleFrameOracle', 'HdMapLightOracle'].map(file => join(import.meta.dir, file + '.java'))]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const run = Bun.spawnSync(['java', '--add-opens=java.base/java.lang=ALL-UNNAMED', '-Xmx1536m', '-Djava.awt.headless=true', '-Dgltrace.stacks=false', '-cp', cp, 'HdMapLightOracle', cachePath, dir, join(import.meta.dir, 'rtx5070.json')]);
            expect(run.exitCode, run.stderr.toString()).toBe(0);
            const original = run.stdout.toString().trimEnd().split(/\r?\n/);

            const assets = localAssets(cachePath, [2, 5]);
            LightType.Init(assets.archive(2));
            const maps = assets.archive(5);
            const palette = requireNonNull(Pix3D.colourTable);
            for (let i = 0; i < palette.length; i++) palette[i] = (Math.imul(i, 0x73a753) + 0x552318) & 0xffffff;
            GlRenderer.active = true;
            world.init(4, 104, 104, 28, false);
            ClientBuild.Init(false);
            const collisions = Array.from({ length: 4 }, () => new CollisionMap(104, 104));
            PointLightManager.setDimensions(4, 104, 104);
            PointLightManager.allocate();
            Environment.resetGrid();
            const regions = original.filter(line => line.startsWith('M '));
            expect(regions.length).toBeGreaterThan(0);
            for (const region of regions) {
                const [group, x, z, noiseZ, noiseX] = region.slice(2).split(' ').map(Number);
                ClientBuild.LoadGround(z, false, noiseZ, x, requireNonNull(maps.GetFile(0, group)), noiseX, collisions);
            }
            PointLightManager.buildGrid();
            expect(PointLightManager.lightCount).toBe(36);
            expect('lights ' + PointLightManager.lightCount).toBe(requireNonNull(original.find(row => row.startsWith('lights '))));
            const expectLights = original.filter(line => line.startsWith('L '));
            for (let i = 0; i < PointLightManager.lightCount; i++) {
                const l = requireNonNull(requireNonNull(PointLightManager.lights)[i]);
                expect(
                    [
                        'L',
                        l.m_level,
                        l.m_lightLevelsBelow,
                        l.m_lightLevelsAbove,
                        l.x,
                        l.y,
                        l.z,
                        l.m_radius,
                        '[' + requireNonNull(l.influenceRanges).join(', ') + ']',
                        l.m_rGB,
                        l.m_flickerType,
                        l.m_phase,
                        l.bridge,
                        bits(l.attenuation),
                        l.waveType,
                        l.frequency,
                        l.amplitude,
                        l.offset
                    ].join(' '),
                    'light ' + i
                ).toBe(expectLights[i]);
            }
            const noise = requireNonNull(StaticPointLight.mPerlinNoise);
            expect(noise.length).toBe(2048);
            expect('noise ' + noise.reduce((h, n) => (Math.imul(h, 31) + n) | 0, 1)).toBe(requireNonNull(original.find(line => line.startsWith('noise '))));
            const grid = requireNonNull(PointLightManager['tileLights']);
            expect(grid.flatMap(level => level.map(row => 'G [' + row.join(', ') + ']'))).toEqual(original.filter(line => line.startsWith('G ')));
            const identities = new Map<Environment, number>();
            const environments = requireNonNull(Environment.grid).flatMap(row =>
                row.map(entry => {
                    const e = requireNonNull(entry);
                    if (!identities.has(e)) identities.set(e, identities.size);
                    return ['E', identities.get(e), e.sunColour, bits(e.ambient), bits(e.diffuse), bits(e.back), e.sunX, e.sunY, e.sunZ, e.fogColour, e.fogDepth].join(' ');
                })
            );
            expect(environments).toEqual(original.filter(line => line.startsWith('E ')));
            const direction = requireNonNull(original.find(line => line.startsWith('sun ')))
                .split(' ')
                .slice(1)
                .map(Number);
            Environment.setCurrent(direction[4], direction[3]);
            expect([Environment.currentSunX, Environment.currentSunY, Environment.currentSunZ]).toEqual(direction.slice(0, 3));
            const cases = original.filter(line => /^(environment|flicker) /.test(line));
            expect(cases).toHaveLength(256 + 23 + 256 + 17);
            for (const row of cases) {
                const [recipe, expected] = row.split('|');
                const [kind, hex] = recipe.split(' ');
                const packet = new PacketT(Buffer.from(hex, 'hex'));
                let output: (number | string)[] = [];
                try {
                    if (kind === 'environment') {
                        const e = new Environment(packet);
                        output = [e.sunColour, bits(e.ambient), bits(e.diffuse), bits(e.back), e.sunX, e.sunY, e.sunZ, e.fogColour, e.fogDepth];
                    } else {
                        const light = new StaticPointLight(packet);
                        for (const tick of [-2147483648, -5711, 0, 5, 33, 1267, 2147483647]) {
                            for (const disabled of [false, true]) {
                                light.CalculateIntensity(disabled, tick);
                                output.push(bits(light.m_intensity), ...Array.from(light.diffuse, bits));
                            }
                        }
                    }
                } catch (error) {
                    if (!(error instanceof WrappedException)) throw error;
                    output = [requireNonNull(error.context)];
                }
                expect([packet.m_pos, ...output].join(' '), recipe).toBe(expected);
            }
            const defaults = original.filter(line => line.startsWith('default '));
            expect(defaults).toHaveLength(3);
            for (let mode = 0; mode < 3; mode++) {
                if (mode === 0) StaticPointLight.mPerlinNoise = null;
                if (mode === 2) StaticPointLight.mPerlinNoise = Int32Array.of(5, -3, 2);
                const previous = StaticPointLight.mPerlinNoise;
                const light = new StaticPointLight();
                const hash = requireNonNull(StaticPointLight.mPerlinNoise).reduce((h, n) => (Math.imul(h, 31) + n) | 0, 1);
                expect(
                    [
                        'default',
                        StaticPointLight.mPerlinNoise === previous,
                        hash,
                        light.waveType,
                        light.frequency,
                        light.amplitude,
                        light.offset,
                        light.bridge,
                        light.diffuse.length,
                        bits(light.m_intensity),
                        bits(light.attenuation),
                        light.influenceRanges === null
                    ].join(' ')
                ).toBe(defaults[mode]);
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    90000,
    'gl'
);
