import { expect } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import Environment from '#/dash3d/Environment.js';
import { capsProfileFromJson } from '#/gl/CapsProfile.js';
import GlLighting from '#/gl/GlLighting.js';
import GlRenderer from '#/gl/GlRenderer.js';
import { GlTraceWriter } from '#/gl/GlTrace.js';
import NullGL from '#/gl/NullGL.js';
import RecordingGL from '#/gl/RecordingGL.js';
import Preferences from '#/ui/Preferences.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { loginFixture } from '../login-fixture.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

loginFixture(
    import.meta.url,
    'HD environment interpolation matches native intermediate colours, lighting and fog commands',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-environment-'));
        try {
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            for (const command of [
                ['javac', '-encoding', 'UTF-8', '-cp', cp, '-sourcepath', import.meta.dir, '-d', dir, join(import.meta.dir, 'HdEnvironmentTransitionOracle.java')],
                ['java', '-Dgltrace.stacks=false', '-cp', cp, 'HdEnvironmentTransitionOracle', dir]
            ]) {
                const result = Bun.spawnSync(command);
                expect(result.exitCode, result.stderr.toString()).toBe(0);
                if (command[0] !== 'java') continue;
                const native = result.stdout.toString().trim().split(/\r?\n/);
                const writer = new GlTraceWriter();
                const profile = capsProfileFromJson(readFileSync(join(import.meta.dir, 'rtx5070.json'), 'utf8'));
                GlRenderer.gl = new RecordingGL(new NullGL(profile), writer);
                Environment.resetGrid();
                const zones = requireNonNull(Environment.grid);
                zones[3][7] = Object.assign(new Environment(), { sunColour: 0x7523bd, fogColour: 0xf50410, fogDepth: 500, ambient: 0.875, diffuse: 0.375, back: 1.3125, sunX: 35, sunY: -132, sunZ: -26 });
                zones[8][2] = Object.assign(new Environment(), { sunColour: 0xc62106, fogColour: 0x01c4f0, fogDepth: 123, ambient: 1.125, diffuse: 0.5, back: 0.75, sunX: -187, sunY: -32, sunZ: 11 });
                const float = (v: number) => new Int32Array(Float32Array.of(v).buffer)[0];
                function state(label: string, returned: number): string {
                    return [
                        label,
                        returned,
                        Environment['transition'],
                        Environment['fogColour'],
                        Environment['sunColour'],
                        Environment['fogDepth'],
                        float(Environment['ambient']),
                        float(Environment['diffuse']),
                        float(Environment['back']),
                        float(Environment['targetAmbient']),
                        float(Environment['targetDiffuse']),
                        float(Environment['targetBack']),
                        Environment['targetSunColour'],
                        Environment['targetFogColour'],
                        Environment['targetFogDepth'],
                        GlLighting.shadowSlopeX,
                        GlLighting.shadowSlopeZ,
                        Client.forceImmediateEnvironmentUpdate
                    ].join(' ');
                }
                const states = [state('clinit', 0)];
                const elapsed = [0, 1, 125, 1, 40, 0, 3, 262, 0, 2, 1, 3];
                for (let n = 0; n < elapsed.length; n++) {
                    const x = n < 3 || n === 8 || n === 9 ? 3 : 8;
                    const z = x === 3 ? 7 : 2;
                    if (n === 8) Client.forceImmediateEnvironmentUpdate = true;
                    Preferences.fogEnabled = n !== 5 && n !== 6;
                    writer.mark('env.' + n);
                    Environment.setCurrent(z, x);
                    states.push(state('env.' + n, Environment.update(elapsed[n], z, n === 11 ? 4 : 3, x)));
                }
                expect(states).toEqual(native);
                expect(
                    writer
                        .text()
                        .split('\n')
                        .filter(l => /^\d/.test(l))
                ).toEqual(
                    readFileSync(join(dir, 'trace.tsv'), 'utf8')
                        .split(/\r?\n/)
                        .filter(l => /^\d/.test(l))
                );
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    30000,
    'gl'
);
