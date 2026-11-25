import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import BrowserControl from '#/util/BrowserControl.js';
import { gamepackPath } from './reference.js';

test('original LiveConnect members dispatch through the JDK plugin boundary and preserve object and exception identity', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sd-liveconnect-members-'));
    try {
        const cp = dir + delimiter + gamepackPath,
            patch = join(dir, 'jdk');
        const asm = '--add-exports=java.base/jdk.internal.org.objectweb.asm=ALL-UNNAMED';
        const compile = Bun.spawnSync(['javac', asm, '-cp', cp, '-d', dir, join(import.meta.dir, 'game/SdLiveConnectMemberOracle.java')]);
        expect(compile.exitCode, compile.stderr.toString()).toBe(0);
        const install = Bun.spawnSync(['java', asm, '-cp', cp, 'SdLiveConnectMemberOracle', patch]);
        expect(install.exitCode, install.stderr.toString()).toBe(0);
        const run = Bun.spawnSync(['java', asm, '--add-reads=jdk.jsobject=java.desktop', '--patch-module', 'jdk.jsobject=' + patch, '-Djava.awt.headless=false', '-cp', cp, 'SdLiveConnectMemberOracle']);
        expect(run.exitCode, run.stderr.toString()).toBe(0);
        const rows: string[] = [],
            token = {},
            failure = new Error('host fault');
        let action: string;
        const host = {
            call(text: string | null) {
                expect(arguments.length).toBe(1);
                action = 'call/' + text;
                if (text === 'fail') throw failure;
                return token;
            },
            evaluate(text: string | null) {
                action = 'eval/' + text;
                if (text === 'fail') throw failure;
                return token;
            }
        };
        for (const call of [false, true])
            for (const enabled of [false, true])
                for (const present of [false, true])
                    for (const text of [null, 'hello', 'fail']) {
                        let result: string;
                        action = '-';
                        try {
                            if (call) {
                                const r = BrowserControl.call(enabled ? -11594 : -11593, present ? host : null, text);
                                result = r === token ? 'same' : r === null ? 'null' : 'different';
                            } else {
                                BrowserControl.eval(enabled ? 13 : 12, text, present ? host : null);
                                result = 'void';
                            }
                        } catch (error) {
                            if (error instanceof TypeError) result = 'null applet';
                            else if (error === failure) result = 'same exception';
                            else throw error;
                        }
                        rows.push([call, enabled, present, text, action, result].map(String).join('|'));
                    }
        expect(rows).toEqual(run.stdout.toString().trimEnd().split(/\r?\n/));
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}, 45000);
