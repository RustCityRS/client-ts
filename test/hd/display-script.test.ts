import { expect } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import Client from '#/client/Client.js';
import DisplayMode from '#/client/DisplayMode.js';
import GameShell from '#/client/GameShell.js';
import ObjType from '#/config/ObjType.js';
import Pix3D from '#/dash3d/Pix3D.js';
import { fromJsString, toJsString } from '#/datastruct/JagString.js';
import GlRenderer from '#/gl/GlRenderer.js';
import MaterialManager from '#/gl/material/MaterialManager.js';
import { ClientScript } from '#/script/ClientScript.js';
import HookReq from '#/script/HookReq.js';
import ScriptRunner from '#/script/ScriptRunner.js';
import Preferences from '#/ui/Preferences.js';
import Signlink from '#/util/Signlink.js';
import SignlinkRequest from '#/util/SignlinkRequest.js';
import WrappedException from '#/util/WrappedException.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { IllegalStateException } from '#/util/JavaException.js';
import { loginFixture } from '../login-fixture.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

const words = [640, 480, 32, 60, 1280, 720, 16, 60, 1024, 768, 0, 60, 1200, 800, 24, 60, 800, 600, -1, 70, 1024, 768, 32, 75, 1024, 768, 32, 85, 1600, 600, 32, 90, 100000, 80000, 24, 60];

loginFixture(
    import.meta.url,
    'HD script display modes, fullscreen navigation and graphics preferences follow the original dispatcher',
    async () => {
        const dir = mkdtempSync(join(tmpdir(), 'rs530-display-script-'));
        try {
            const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
            const cp = [dir, hdGamepackPath, joglPath].join(delimiter);
            const command = (args: string[], stdin?: Buffer) => {
                const result = Bun.spawnSync(args, { stdin, timeout: 30000, maxBuffer: 8 * 1024 * 1024 });
                expect(result.exitCode, result.stderr.toString()).toBe(0);
                return result.stdout.toString().trimEnd().split(/\r?\n/);
            };
            command(['javac', asm, '-cp', cp, '-sourcepath', import.meta.dir, '-d', dir, join(import.meta.dir, 'HdDisplayScriptOracle.java')]);
            command(['java', asm, '-cp', cp, 'HdDisplayScriptOracle', hdGamepackPath, dir]);
            const cases: number[][] = [];
            for (const op of [5300, 5301, 5302, 5303, 5305, 5411, 5421]) for (const value of [-1, 0, 1, 3, 5]) for (const full of [0, 1]) for (const provider of [0, 1]) cases.push([op, value, 1, 0, 2, 10, full, provider, 0]);
            for (const op of [6001, 6012, 6014, 6015])
                for (const value of [-1, 0, 1, 3, 5]) for (const active of [0, 1]) for (const detail of [0, 1]) for (const state of [5, 10, 30]) for (const mutate of [0, 1]) cases.push([op, value, active, detail, 2, state, 0, 1, mutate]);
            for (const op of [6011, 6013]) for (const value of [-2147483648, -1, 0, 1, 2, 3, 2147483647]) for (const active of [0, 1]) cases.push([op, value, active, 0, 2, 30, 0, 1, 0]);
            // Record the last successful side effect if the operand is missing or a callback faults.
            // 6012 can enter the material callback before its first stack read.
            for (const op of [6011, 6012, 6013, 6014, 6015]) for (const active of [0, 1]) for (const pushValue of [0, 1]) for (const failure of [0, 2, 3, 4, 5]) cases.push([op, 1, active, 0, 3, 30, 0, 1, failure, pushValue]);
            for (const op of [6012, 6014]) for (const gameState of [10, 30]) cases.push([op, 1, 1, 0, 3, gameState, 0, 1, 6, 1]);
            for (const brightness of [0, 1, 2, 3, 4, 5]) for (const value of [0, 1]) for (const active of [0, 1]) cases.push([6012, value, active, 0, brightness, 30, 0, 1, 0]);
            for (const op of [6111, 6112, 6113, 6114, 6115, 6121]) for (const value of [-1, 0, 1, 2]) for (const active of [0, 1]) cases.push([op, value, active, value === 2 ? 1 : 0, 2, 30, 0, 1, 0]);
            const oracle = command(['java', asm, '-Djava.awt.headless=true', '-cp', cp, 'HdDisplayScriptOracle'], Buffer.from(cases.join('\n') + '\n'));
            expect(oracle).toHaveLength(cases.length);

            let log: string[] = [],
                provider = 0,
                mutate = 0;
            const state = () =>
                [Preferences.brightness, Preferences.highDetailLighting, Preferences.highWaterDetail, Preferences.fogEnabled, Client.forceImmediateEnvironmentUpdate, Preferences.sent, Client.gameState, Preferences.sceneryShadows].join(',');
            const event = (name: string) => log.push(name + '@' + state());
            const frame = { getSize: () => ({ width: 944, height: 712 }), getInsets: () => ({ left: 0, right: 0, top: 0, bottom: 0 }) };
            const link = Object.create(Signlink.prototype) as Signlink;
            link.supportsFullscreen = () => true;
            link.getDisplayModes = () => {
                event('modes');
                const request = new SignlinkRequest();
                request.status = 1;
                request.result = Int32Array.from(provider === 0 ? [] : words);
                return request;
            };
            GameShell.signlink = link;
            GameShell.frame = null;
            Signlink.osNameLower = 'linux';
            Client.setWindowMode = async (width, _apply, mode, _replace, height) => {
                event('window=' + [mode, width, height].join(','));
                await Promise.resolve();
                GameShell.fullScreenFrame = mode === 3 && provider === 1 ? frame : null;
            };
            Client.getWebsiteUrlPrefix = () => {
                event('prefix');
                return fromJsString('home');
            };
            GameShell.openUrl = (blank, address) => {
                event('open=' + toJsString(requireNonNull(address)) + ',' + blank);
            };
            Pix3D.setBrightness = v => {
                event('gamma=' + new Int32Array(Float32Array.of(v).buffer)[0]);
                if (mutate === 1) GlRenderer.active = !GlRenderer.active;
                if (mutate === 3) throw new RangeError('gamma');
            };
            MaterialManager.setMaterial = (arg, material) => {
                event('material=' + arg + ',' + material);
                if (mutate === 1) GlRenderer.active = !GlRenderer.active;
                if (mutate === 2) throw new RangeError('material');
            };
            ObjType.ResetSpriteCache = () => {
                event('sprites');
            };
            Preferences.write = () => {
                event('write');
                if (mutate === 5) throw new RangeError('write');
            };
            Client.SetMainState = next => {
                event('state=' + next);
                if (mutate === 4) throw new RangeError('state');
                if (mutate === 6) throw WrappedException.wrap(new RangeError('state'), 'state callback');
                Client.gameState = next;
            };
            for (const [i, row] of cases.entries()) {
                const [op, value, active, detail, brightness, gameState, full] = row;
                provider = row[7];
                mutate = row[8];
                GlRenderer.active = active === 1;
                Preferences.highDetailLighting = detail === 1;
                Preferences.brightness = brightness;
                Client.gameState = gameState;
                GameShell.fullScreenFrame = full ? frame : null;
                Preferences.windowMode = 2;
                Preferences.highWaterDetail = false;
                Preferences.fogEnabled = false;
                Preferences.sent = true;
                Preferences.sceneryShadows = 1;
                if (op >= 6100 && op < 6200) {
                    Preferences.sceneryShadows = value;
                    Preferences.highWaterDetail = value === 1;
                    Preferences.fogEnabled = value === 0;
                    GlRenderer.multisampleSupported = value === 1;
                }
                Client.forceImmediateEnvironmentUpdate = false;
                DisplayMode.available = null;
                Preferences.fullscreenWidth = value === 1 ? 1600 : 1024;
                Preferences.fullscreenHeight = value === 1 ? 600 : 768;
                const codes: number[] = [],
                    operands: number[] = [];
                if (op === 5300) {
                    codes.push(0, 0);
                    operands.push(944, 712);
                }
                if (op === 5421) {
                    codes.push(3);
                    operands.push(0);
                }
                if ((op === 5303 || op === 5421 || (op >= 6000 && op < 6100)) && row[9] !== 0) {
                    codes.push(0);
                    operands.push(value);
                }
                codes.push(op);
                operands.push(0);
                if (op === 5302) {
                    codes.push(op);
                    operands.push(0);
                }
                codes.push(0, 21);
                operands.push(7117, 0);
                const script = new ClientScript();
                script.opcodes = Int32Array.from(codes);
                script.intOperands = Int32Array.from(operands);
                script.stringOperands = new Array(codes.length).fill(null);
                if (op === 5421) script.stringOperands[0] = fromJsString('page');
                const hook = new HookReq();
                hook.args = [i + 87000];
                const runner = new ScriptRunner(
                    () => script,
                    error => {
                        const fault = error.cause;
                        const cause = fault instanceof WrappedException ? fault.cause : fault;
                        const context = fault instanceof WrappedException ? ' ' + fault.context : '';
                        event('fault=' + (cause instanceof RangeError ? 'bounds' : cause instanceof IllegalStateException ? 'IllegalStateException' : 'other') + context);
                    }
                );
                ScriptRunner.intStack.fill(-913);
                log = [];
                await runner.ExecuteScript(hook, 200);
                const modes = DisplayMode.available as DisplayMode[] | null;
                const listing = modes === null ? '-' : modes.map(m => m.width + 'x' + m.height + ':' + m.depth + ':' + m.refresh).join('/');
                const result = [state(), GameShell.fullScreenFrame !== null, '[' + ScriptRunner.intStack.slice(0, 4).join(', ') + ']', listing, log.join(';')].join('|');
                expect(result, row.join(',')).toBe(oracle[i]);
            }
            // The provider can leave a Java request pending while the browser resumes other tasks.
            // The instruction after 5302 must wait for completion. Once cached, the same script runs synchronously.
            const pending = new SignlinkRequest();
            let requests = 0;
            link.getDisplayModes = () => {
                requests++;
                return pending;
            };
            DisplayMode.available = null;
            const script = new ClientScript();
            script.opcodes = Int32Array.of(5302, 0, 21);
            script.intOperands = Int32Array.of(0, 7117, 0);
            script.stringOperands = [null, null, null];
            const hook = new HookReq();
            hook.args = [93000];
            const runner = new ScriptRunner(() => script);
            ScriptRunner.intStack.fill(-913);
            const suspended = runner.run(hook);
            expect(suspended).toBeInstanceOf(Promise);
            expect(Array.from(ScriptRunner.intStack.slice(0, 2))).toEqual([-913, -913]);
            pending.result = Int32Array.from(words);
            pending.status = 1;
            await suspended;
            expect(Array.from(ScriptRunner.intStack.slice(0, 2))).toEqual([5, 7117]);
            expect(runner.run(hook)).toBeUndefined();
            expect(requests).toBe(1);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    },
    60000,
    'gl'
);
