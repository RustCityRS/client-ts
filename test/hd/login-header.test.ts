import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Client from '#/client/Client.js';
import GameShell from '#/client/GameShell.js';
import { fromJsString } from '#/datastruct/JagString.js';
import Login from '#/io/Login.js';
import { mathRandom } from '#/util/JavaRandom.js';
import { requireNonNull } from '#/util/JavaArray.js';
import { localAssets } from '../cachefile.js';
import { javaRsaExponent, javaRsaModulus, setLoginChecksums } from '../login-fixture.js';
import { cachePath, gamepackPath } from '../reference.js';
import { hdGamepackPath, joglPath } from '../render/hd-reference.js';

const seed = 73530530n;
const challenge = Buffer.from('ffeeddcc76543210', 'hex');

for (const identity of ['sd', 'gl'] as const) {
    const name = identity + ' login writer matches the seeded revision 530 jar from build marker through RSA ciphertext';
    test(
        name,
        async () => {
            if (process.env.RS530_LOGIN_HEADER_CHILD !== identity) {
                const child = Bun.spawnSync([process.execPath, 'test', '--test-name-pattern', name, fileURLToPath(import.meta.url)], {
                    env: { ...process.env, RS530_GAMEPACK_IDENTITY: identity, RS530_LOGIN_HEADER_CHILD: identity, LOGIN_RSAE: String(javaRsaExponent), LOGIN_RSAN: String(javaRsaModulus) }
                });
                expect(child.exitCode, child.stderr.toString()).toBe(0);
                expect(child.stderr.toString()).toMatch(/^\s*1 pass$/m);
                return;
            }
            const dir = mkdtempSync(join(tmpdir(), 'rs530-login-frame-'));
            try {
                const hd = identity === 'gl',
                    cp = [dir, hd ? hdGamepackPath : gamepackPath, ...(hd ? [joglPath] : [])].join(delimiter);
                const sources = hd ? ['HdWindowStatusOracle.java', 'HdLoginFrameOracle.java'] : ['../login/LoginOracle.java'];
                const compiled = Bun.spawnSync(['javac', '-encoding', 'UTF-8', '-cp', cp, '-d', dir, ...sources.map(s => join(import.meta.dir, s))]);
                expect(compiled.exitCode, compiled.stderr.toString()).toBe(0);
                const java = ['java', '--add-opens=java.base/java.lang=ALL-UNNAMED', '-Djava.awt.headless=true', '-Drs530.seed=' + seed, '-cp', cp];
                const checks = Array.from({ length: 28 }, (_, i) => i - 17);
                setLoginChecksums(localAssets(cachePath, []), id => checks[id]);
                const app = new Client(),
                    modes = hd ? [0, 1, 2, 3] : [0];
                for (const mode of modes) {
                    const oracle = Bun.spawnSync([...java, ...(hd ? ['HdLoginFrameOracle', String(mode), 'test'] : ['LoginOracle'])], {
                        stdin: Buffer.from([challenge.toString('hex'), 'One_Two', 'pa£s', checks.join(' ')].join('\n') + '\n')
                    });
                    expect(oracle.exitCode, oracle.stderr.toString()).toBe(0);
                    const [body, rsa] = oracle.stdout.toString().trim().split(/\r?\n/);
                    let expected = Buffer.from(body, 'hex');
                    // The SD fixture publishes its observable cleartext credentials
                    // and the original gd.a ciphertext separately.
                    if (!hd) {
                        const pos = 3 + 159 + 5;
                        expected = Buffer.concat([expected.subarray(0, pos), Buffer.from(rsa, 'hex')]);
                        expected.writeUInt16BE(expected.length - 3, 1);
                    }
                    const packet = await write(app, mode);
                    expect(packet[9]).toBe(hd ? 1 : 0);
                    expect(packet[10]).toBe(mode);
                    expect(Array.from({ length: 28 }, (_, i) => packet.readInt32BE(55 + 4 * i))).toEqual(checks);
                    expect(packet.toString('hex')).toBe(expected.toString('hex'));
                }
            } finally {
                rmSync(dir, { recursive: true, force: true });
            }
        },
        30000
    );
}

async function write(app: Client, mode: number): Promise<Buffer> {
    Client.gameState = 10;
    Client.selectedWorldId = 1;
    Client.getWindowMode = () => mode;
    GameShell.m_sWid = mode < 2 ? 765 : 1024;
    GameShell.m_sHei = mode < 2 ? 503 : 768;
    Login.requestLogin(fromJsString('One_Two'), fromJsString('pa£s'), -1, 0);
    Client.settings = fromJsString('test');
    Client.loginStep = 3;
    let pending = true;
    const sent: Buffer[] = [];
    Client.stream = {
        GetAvailable: () => (pending ? 8 : 0),
        async Read(dst, off) {
            requireNonNull(dst).set(challenge, off);
            pending = false;
        },
        Write(off, src, len) {
            sent.push(Buffer.from(requireNonNull(src).subarray(off, off + len)));
        },
        async read() {
            throw Error('Unexpected read');
        },
        Close() {}
    };
    mathRandom.setSeed(seed);
    await app.LoginPoll();
    expect(sent).toHaveLength(1);
    return sent[0];
}
