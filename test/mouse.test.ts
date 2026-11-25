import { expect, spyOn, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import ClientMouseListener, { type MouseEvent530 } from '#/client/ClientMouseListener.js';
import MouseTracking from '#/client/MouseTracking.js';
import MouseWheel from '#/client/MouseWheel.js';
import JavaMouseWheel from '#/client/JavaMouseWheel.js';
import SafeTime from '#/io/SafeTime.js';
import ThreadUtils from '#/util/ThreadUtils.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { gamepackPath } from './reference.js';

test('mouse listeners, snapshots, wheel rotations and every sample of the capped 50-ms recorder match uk, ih and ag', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mouse-530-'));
    const previous = { ...ClientMouseListener };
    const clock = spyOn(SafeTime, 'CurrentTimeMillis');
    const internalSleep = spyOn(ThreadUtils as unknown as { sleepInternal(milliseconds: bigint): Promise<void> }, 'sleepInternal');
    try {
        const keys = ['enter', 'move', 'press', 'poll', 'poll', 'drag', 'wheel', 'release', 'wheelPoll', 'click', 'blur', 'exit', 'focus'];
        const names = ['start', 'setIdle', 'poll', ...Array.from({ length: 490 }, (_, i) => keys[(i * 7 + ((i / 13) | 0)) % keys.length]), 'wheel', 'wheel', 'wheelPoll', 'stop', 'dispose', ...keys.filter(key => key !== 'poll')];
        const commands = names.map((name, i) => [name, i === 0 ? 0 : (i * 20177) | 0, 200 - i * 1031, i % 3 === 0 ? 1 : 0, i % 4 === 0 ? 1 : 0, 1000 + i * 19]);
        const cp = dir + delimiter + gamepackPath;
        for (const cmd of [
            ['javac', '-cp', gamepackPath, '-d', dir, join(import.meta.dir, 'game', 'TimerOracle.java'), join(import.meta.dir, 'game', 'MouseOracle.java')],
            ['java', '-cp', cp, 'TimerOracle', gamepackPath, dir]
        ]) {
            const build = Bun.spawnSync(cmd);
            expect(build.exitCode, build.stderr.toString()).toBe(0);
        }
        const jar = Bun.spawnSync(['java', '-Djava.awt.headless=true', '-cp', cp, 'MouseOracle'], { stdin: Buffer.from(commands.map(c => c.join(' ')).join('\n') + '\n') });
        expect(jar.exitCode, jar.stderr.toString()).toBe(0);
        const expected = jar.stdout.toString().trimEnd().split(/\r?\n/);
        const mouse = (ClientMouseListener.instance = new ClientMouseListener());
        Object.assign(ClientMouseListener, {
            volatileX: -1,
            currentY: -1,
            currentButton: 0,
            nextClickButton: 0,
            nextClickX: 0,
            nextClickY: 0,
            nextClickTime: 0n,
            idleCycles: 0,
            mouseButton: 0,
            x: 0,
            mouseY: 0,
            clickButton: 0,
            clickX: 0,
            clickY: 0,
            clickTime: 0n
        });
        const wheel = await MouseWheel.create();
        if (!(wheel instanceof JavaMouseWheel)) throw new Error('Wheel listener failed to initialize');
        const attached = [0, 0, 0, 0];
        const surface = {
            addMouseListener() {
                attached[0]++;
            },
            removeMouseListener() {
                attached[0]--;
            },
            addMouseMotionListener() {
                attached[1]++;
            },
            removeMouseMotionListener() {
                attached[1]--;
            },
            addFocusListener() {
                attached[2]++;
            },
            removeFocusListener() {
                attached[2]--;
            },
            addMouseWheelListener() {
                attached[3]++;
            },
            removeMouseWheelListener() {
                attached[3]--;
            }
        };
        let row = 0;
        for (const [name, x, y, meta, popup, time] of commands) {
            let consumed = false,
                rotation = 0;
            const event: MouseEvent530 = {
                getX: () => +x,
                getY: () => +y,
                isMetaDown: () => meta === 1,
                getModifiers: () => 0,
                isPopupTrigger: () => popup === 1,
                consume: () => {
                    consumed = true;
                }
            };
            clock.mockReturnValue(BigInt(time));
            switch (name) {
                case 'start':
                    ClientMouseListener.addListeners(surface);
                    wheel.start(surface);
                    break;
                case 'stop':
                    ClientMouseListener.stop(surface, 0);
                    wheel.stop(surface);
                    break;
                case 'enter':
                    mouse.mouseEntered(event);
                    break;
                case 'exit':
                    mouse.mouseExited();
                    break;
                case 'move':
                    mouse.mouseMoved(event);
                    break;
                case 'drag':
                    mouse.mouseDragged(event);
                    break;
                case 'press':
                    mouse.mousePressed(event);
                    break;
                case 'release':
                    mouse.mouseReleased(event);
                    break;
                case 'click':
                    mouse.mouseClicked(event);
                    break;
                case 'focus':
                    mouse.focusGained();
                    break;
                case 'blur':
                    mouse.focusLost();
                    break;
                case 'poll':
                    ClientMouseListener.poll();
                    break;
                case 'setIdle':
                    ClientMouseListener.setIdleCycles(+x);
                    break;
                case 'dispose':
                    ClientMouseListener.dispose();
                    break;
                case 'wheel':
                    wheel.mouseWheelMoved(+x);
                    break;
                case 'wheelPoll':
                    rotation = wheel.poll();
                    break;
            }
            expect(
                [
                    ClientMouseListener.volatileX,
                    ClientMouseListener.currentY,
                    ClientMouseListener.currentButton,
                    ClientMouseListener.nextClickButton,
                    ClientMouseListener.nextClickX,
                    ClientMouseListener.nextClickY,
                    ClientMouseListener.nextClickTime,
                    ClientMouseListener.getIdleCycles(),
                    ClientMouseListener.mouseButton,
                    ClientMouseListener.x,
                    ClientMouseListener.mouseY,
                    ClientMouseListener.clickButton,
                    ClientMouseListener.clickX,
                    ClientMouseListener.clickY,
                    ClientMouseListener.clickTime,
                    consumed,
                    ClientMouseListener.instance !== null,
                    ...attached,
                    rotation
                ].join(';'),
                String(name) + ' ' + row
            ).toBe(expected[row++]);
        }
        const recorder = new MouseTracking();
        ClientMouseListener.x = -99;
        ClientMouseListener.mouseY = 101;
        let step = 0;
        const sleeps: bigint[] = [];
        const hash = (v: Int32Array) => v.reduce((a, b) => (Math.imul(a, 31) + b) | 0, 1);
        internalSleep.mockImplementation(async (millis: bigint) => {
            sleeps.push(millis);
            if (sleeps.length % 2 !== 0) return;
            expect([recorder.count, hash(requireNonNull(recorder.samplesX)), hash(requireNonNull(recorder.samplesY)), sleeps.at(-2), sleeps.at(-1)].join(';'), 'sample ' + step).toBe(expected[row++]);
            step++;
            ClientMouseListener.x = step * 17 - 381;
            ClientMouseListener.mouseY = 555 - step * 21;
            if (step === 508) recorder.running = false;
        });
        await recorder.run();
        expect(row).toBe(expected.length);
    } finally {
        Object.assign(ClientMouseListener, previous);
        internalSleep.mockRestore();
        clock.mockRestore();
        rmSync(dir, { recursive: true, force: true });
    }
}, 30000);
