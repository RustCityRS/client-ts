import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Client from '#/client/Client.js';
import { glJar } from '#/client/ClientVariant.js';
import GameShell, { gameClient } from '#/client/GameShell.js';
import Signlink from '#/util/Signlink.js';
import { JavaError } from '#/util/JavaException.js';
import WrappedException from '#/util/WrappedException.js';
import { gamepackPath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

const fields = ['m_frameWidth', 'm_frameHeight', 'm_sWid', 'm_sHei', 'leftMargin', 'topMargin'] as const;
const names = ['fw', 'fh', 'w', 'h', 'x', 'y'];

function compare(): void {
    const dir = mkdtempSync(join(tmpdir(), 'rs530-window-layout-'));
    const properties = Object.getOwnPropertyDescriptors(GameShell);
    const previousClient = gameClient.instance;
    try {
        const variant = glJar ? 'gl' : 'sd';
        const cp = [dir, ...(glJar ? [hdGamepackPath, joglPath] : [gamepackPath])].join(delimiter);
        const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
        const javac = Bun.spawnSync(['javac', asm, '-encoding', 'UTF-8', '-d', dir, join(import.meta.dir, 'WindowLayoutOracle.java')]);
        expect(javac.exitCode, javac.stderr.toString()).toBe(0);
        const command = ['java', asm, '-Djava.awt.headless=true', '-cp', cp, 'WindowLayoutOracle', variant];
        const instrument = Bun.spawnSync([...command, dir]);
        expect(instrument.exitCode, instrument.stderr.toString()).toBe(0);
        const original = Bun.spawnSync(command);
        expect(original.exitCode, original.stderr.toString()).toBe(0);
        const rows = original.stdout.toString().trimEnd().split(/\r?\n/);

        let events: string[] = [];
        let fault = 0,
            width = 0,
            height = 0,
            row = 0;
        const stop = new JavaError('end of window layout');
        const event = (value: string) => {
            events.push(value);
            if (events.length === fault) throw new TypeError('probe');
        };
        const page = {
            getSize() {
                event('size');
                return { width, height };
            }
        };
        const frame = {
            ...page,
            getInsets() {
                event('insets');
                return { top: 7, left: 3, bottom: 13, right: 8 };
            }
        };
        gameClient.instance = new Client();
        GameShell.canvas = {
            setSize(w: number, h: number) {
                event('canvas=' + w + 'x' + h);
            },
            setLocation(x: number, y: number) {
                event('at=' + x + ',' + y);
                throw stop;
            }
        };
        GameShell.fullScreenFrame = null;
        GameShell.signlink = Object.assign(Object.create(Signlink.prototype), { applet: page });
        const values = Array<number>(6);
        for (const [i, field] of fields.entries()) {
            Object.defineProperty(GameShell, field, {
                configurable: true,
                get: () => values[i],
                set(n: number) {
                    values[i] = n;
                    event(names[i] + '=' + n);
                }
            });
        }
        for (let host = 0; host <= 1; host++)
            for (let size = 0; size <= 1; size++) {
                GameShell.frame = host === 0 ? null : frame;
                width = size === 0 ? 610 : 1181;
                height = size === 0 ? 407 : 803;
                for (const mode of [-1, 0, 1, 2, 4])
                    for (fault = 0; fault <= 14; fault++) {
                        events = [];
                        values.fill(-77);
                        let status: string | null;
                        try {
                            GameShell.applyWindowMode(mode, 123, 2, false, false, 456);
                            throw new Error('missed end of window sizing');
                        } catch (error) {
                            if (error === stop) status = 'at-window';
                            else if (error instanceof WrappedException) status = error.context;
                            else throw error;
                        }
                        expect(events.join(' ') + '|' + status + '|' + values.join(','), [variant, host, size, mode, fault].join(' ')).toBe(rows[row++]);
                    }
            }
        const marginError = new JavaError('host graphics');
        let marginFailure = 0;
        function marginEvent(call: string) {
            events.push(call);
            if (marginFailure === 1) throw new TypeError('host graphics');
            if (marginFailure === 2) throw marginError;
        }
        const marginFrame = {
            getSize: () => ({ width: 80, height: 60 }),
            getInsets() {
                marginEvent('insets');
                return { top: 7, left: 3, bottom: 13, right: 8 };
            },
            getGraphics() {
                marginEvent('frame.graphics');
                return null;
            }
        };
        const marginPage = {
            ...page,
            getGraphics() {
                marginEvent('page.graphics');
                return null;
            }
        };
        GameShell.signlink = Object.assign(Object.create(Signlink.prototype), { applet: marginPage });
        for (let host = 0; host < 3; host++) {
            GameShell.frame = host === 0 ? null : marginFrame;
            GameShell.fullScreenFrame = host === 2 ? { ...marginFrame } : null;
            for (let margin = 0; margin < 2; margin++) {
                values.splice(0, 6, 80, 60, 80, 60, margin, 0);
                for (marginFailure = 0; marginFailure < 3; marginFailure++) {
                    events = [];
                    let result = 'ok';
                    try {
                        GameShell.clearCanvasMargins();
                    } catch (error) {
                        if (error !== marginError) throw error;
                        result = 'error';
                    }
                    expect(events.join(' ') + '|' + result, [variant, host, margin, marginFailure].join(' ')).toBe(rows[row++]);
                }
            }
        }
        expect(rows).toHaveLength(row);
    } finally {
        Object.defineProperties(GameShell, properties);
        gameClient.instance = previousClient;
        rmSync(dir, { recursive: true, force: true });
    }
}

test('both gamepacks preserve window sizing order and partial state across host failures', () => {
    compare();
    if (!glJar) {
        const hd = Bun.spawnSync([process.execPath, 'test', fileURLToPath(import.meta.url)], { env: { ...process.env, RS530_GAMEPACK_IDENTITY: 'gl' } });
        expect(hd.exitCode, hd.stderr.toString()).toBe(0);
        expect(hd.stderr.toString()).toMatch(/^\s*1 pass$/m);
    }
}, 120000);
