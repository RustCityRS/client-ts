import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import InterfaceList from '#/ui/InterfaceList.js';
import Signlink from '#/util/Signlink.js';
import WrappedException from '#/util/WrappedException.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';
import { loginFixture } from '../login-fixture.js';

loginFixture(
    import.meta.url,
    'HD resizeCanvas matches qh.a writes, live drawable dimensions and canvas replacement during setSize',
    async () => {
        const { default: renderer } = await import('#/gl/GlRenderer.js');
        const dir = mkdtempSync(join(tmpdir(), 'rs530-resize-'));
        const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
        const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
        try {
            const compile = Bun.spawnSync(['javac', asm, '-encoding', 'UTF-8', '-cp', cp, '-d', dir, join(import.meta.dir, 'WindowLayoutOracle.java'), join(import.meta.dir, 'HdCanvasResizeOracle.java')]);
            expect(compile.exitCode, compile.stderr.toString()).toBe(0);
            const java = ['java', asm, '-Djava.awt.headless=true', '-cp', cp, 'HdCanvasResizeOracle'];
            const instrument = Bun.spawnSync([...java, dir]);
            expect(instrument.exitCode, instrument.stderr.toString()).toBe(0);
            const original = Bun.spawnSync(java, { maxBuffer: 4 * 1024 * 1024 });
            expect(original.exitCode, original.stderr.toString()).toBe(0);
            const rows = original.stdout.toString().trimEnd().split(/\r?\n/);
            const fields = ['m_frameWidth', 'm_frameHeight', 'm_sWid', 'm_sHei', 'leftMargin', 'topMargin'] as const;
            const labels = ['fw', 'fh', 'w', 'h', 'x', 'y'];
            let events: string[] = [],
                mutation = 0,
                fault = 0,
                sizes = 0,
                width = 0,
                height = 0;
            const event = (note: string) => {
                events.push(note);
                if (events.length === fault) throw new TypeError('probe');
            };
            const container = (name: string) => ({
                getSize() {
                    event(name + '.size');
                    return { width: width + sizes++, height: height + sizes };
                },
                getInsets() {
                    event(name + '.insets');
                    return { top: 7, left: 3, bottom: 13, right: 8 };
                },
                getGraphics() {
                    event(name + '.graphics');
                    return null;
                }
            });
            const display = (id: number) => ({
                setSize(w: number, h: number) {
                    event('canvas' + id + '.size=' + w + ',' + h + '/gl=' + renderer.width + ',' + renderer.height);
                    if (mutation === 1) GameShell.canvas = second;
                    if (mutation === 2) GameShell.canvas = null;
                },
                setLocation(x: number, y: number) {
                    event('canvas' + id + '.location=' + x + ',' + y);
                }
            });
            const page = container('page'),
                frame = container('frame'),
                full = container('full');
            const first = display(0),
                second = display(1);
            GameShell.signlink = Object.assign(Object.create(Signlink.prototype), { applet: page });
            const values = new Array<number>(fields.length);
            for (const [i, field] of fields.entries())
                Object.defineProperty(GameShell, field, {
                    configurable: true,
                    get: () => values[i],
                    set(value: number) {
                        values[i] = value;
                        event(labels[i] + '=' + value);
                    }
                });
            InterfaceList.top = -1;
            let row = 0;
            for (let host = 0; host < 3; host++)
                for (let mode = 0; mode < 4; mode++)
                    for (let size = 0; size < 2; size++)
                        for (mutation = 0; mutation < 3; mutation++)
                            for (fault = 0; fault < 16; fault++) {
                                width = size === 0 ? 610 : 1181;
                                height = size === 0 ? 407 : 803;
                                sizes = 0;
                                events = [];
                                renderer.active = (mode & 1) !== 0;
                                GameShell.resizable = (mode & 2) !== 0;
                                renderer.width = 43;
                                renderer.height = 47;
                                GameShell.frame = host === 0 ? null : frame;
                                GameShell.fullScreenFrame = host === 2 ? full : null;
                                GameShell.canvas = first;
                                values.fill(-77);
                                let result = 'ok';
                                try {
                                    Client.resizeCanvas();
                                } catch (error) {
                                    if (!(error instanceof WrappedException)) throw error;
                                    result = String(error.context);
                                }
                                const state = [...values, renderer.width, renderer.height, GameShell.canvas === null ? -1 : GameShell.canvas === first ? 0 : 1];
                                expect(events.join(' ') + '|' + result + '|' + state.join(','), [host, mode, size, mutation, fault].join(',')).toBe(rows[row++]);
                            }
            expect(rows).toHaveLength(row);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    45000,
    'gl'
);
