import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import MouseTracking from '#/client/MouseTracking.js';
import OrbitCamera from '#/client/OrbitCamera.js';
import ReceivePlayerPositions from '#/client/ReceivePlayerPositions.js';
import MinimapBuilder from '#/dash3d/MinimapBuilder.js';
import ChatHistory from '#/game/ChatHistory.js';
import Minimenu from '#/ui/Minimenu.js';
import { mathRandom } from '#/util/JavaRandom.js';
import { loginFixture } from '../login-fixture.js';
import { gamepackPath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

const fields = [
    [OrbitCamera, 'followOffsetX'],
    [OrbitCamera, 'followYaw'],
    [OrbitCamera, 'followOffsetZ'],
    [OrbitCamera, 'minimapZoom'],
    [OrbitCamera, 'minimapAngle'],
    [OrbitCamera, 'yawOffset'],
    [Minimenu, 'objSelected'],
    [Client, 'destinationZ'],
    [MinimapBuilder, 'minimapLevel'],
    [ReceivePlayerPositions, 'm_lastNum'],
    [Client, 'minimapState'],
    [Minimenu, 'targetMode'],
    [Client, 'soundEffectCount'],
    [Client, 'destinationX'],
    [ChatHistory, 'count'],
    [Client, 'npcCount']
] as const;

function run(command: string[]): string {
    const result = Bun.spawnSync(command);
    expect(result.exitCode, result.stderr.toString()).toBe(0);
    return result.stdout.toString().trimEnd();
}

for (const identity of ['sd', 'gl'] as const) {
    loginFixture(
        import.meta.url,
        identity + ' reset camera draws and intervening stores match its gamepack at every cut',
        async () => {
            const dir = mkdtempSync(join(tmpdir(), 'rs530-reset-camera-'));
            try {
                const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
                const jar = identity === 'gl' ? hdGamepackPath : gamepackPath;
                const cp = [dir, jar, joglPath].join(delimiter);
                run(['javac', asm, '-d', dir, join(import.meta.dir, 'ResetCameraOrderOracle.java')]);
                run(['java', asm, '-cp', cp, 'ResetCameraOrderOracle', identity, jar, dir]);
                const expected = run(['java', asm, '--add-opens=java.base/java.lang=ALL-UNNAMED', '-Djava.awt.headless=true', '-cp', cp, 'ResetCameraOrderOracle', identity]).split(/\r?\n/);

                const cutSignal = new Error('cut');
                const completeSignal = new Error('end of reset block');
                const lastSlot = identity === 'gl' ? 15 : 13;
                const values: (boolean | number)[] = [];
                let cut = 0;
                let events: string[] = [];
                function event(name: string): void {
                    events.push(name);
                    if (cut === events.length) throw cutSignal;
                }
                for (const [slot, [owner, key]] of fields.entries()) {
                    Object.defineProperty(owner, key, {
                        configurable: true,
                        get: () => values[slot],
                        set: (value: number | boolean) => {
                            values[slot] = value;
                            event('w' + slot);
                            if (slot === lastSlot) throw completeSignal;
                        }
                    });
                }
                const originalDraw = mathRandom.nextDouble.bind(mathRandom);
                mathRandom.nextDouble = () => {
                    event('random');
                    return originalDraw();
                };
                Client.mouseTracking = new MouseTracking();
                let row = 0;
                for (const seed of [0n, -1n, 530n, 0x123456789abcn]) {
                    for (cut = 0; cut <= fields.length + 6; cut++) {
                        for (let slot = 0; slot < fields.length; slot++) values[slot] = slot === 11 ? true : 1000 + slot;
                        events = [];
                        mathRandom.setSeed(seed);
                        let error: unknown;
                        try {
                            await Client.resetGame();
                        } catch (thrown) {
                            error = thrown;
                        }
                        expect(error).toBe(cut === 0 ? completeSignal : cutSignal);
                        const state = [seed, cut, events.join(','), values.join(','), mathRandom.nextInt()].join('|');
                        expect(state, identity + ' seed ' + seed + ' cut ' + cut).toBe(expected[row++]);
                    }
                }
                expect(row).toBe(expected.length);
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        },
        45000,
        identity
    );
}
