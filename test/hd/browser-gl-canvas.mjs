// bun test/hd/browser-gl-canvas.mjs
// Requires a hardware WebGPU adapter and Chrome/Chromium. Set CHROME_BIN for a nonstandard installation.
// Serves only an isolated, synthetic page on an ephemeral loopback port.
import { build, serve, spawn as spawnBun, which } from 'bun';
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

const executable = [
    process.env.CHROME_BIN,
    which('google-chrome'),
    which('chromium'),
    which('chromium-browser'),
    join(process.env.PROGRAMFILES || '', 'Google/Chrome/Application/chrome.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].find(candidate => candidate && existsSync(candidate));
if (!executable) throw new Error('Hardware browser gate requires Chrome. Set CHROME_BIN to the browser executable.');
const bundle = await build({
    entrypoints: [join(import.meta.dir, 'BrowserGlCanvas.browser.ts')],
    target: 'browser',
    define: { 'process.env': JSON.stringify({ RS530_GAMEPACK_IDENTITY: 'gl' }) }
});
if (!bundle.success) throw new AggregateError(bundle.logs, 'Browser fixture did not build');
const noDevice = process.argv.includes('--no-device');
const report = Promise.withResolvers();
const commands = new Map();
let commandId = 0;
let sessionId;
let socket;
async function connectBrowser() {
    const [port, endpoint] = readFileSync(join(profile, 'DevToolsActivePort'), 'utf8').trim().split(/\r?\n/);
    socket = new WebSocket('ws://127.0.0.1:' + port + endpoint);
    socket.addEventListener('message', event => {
        const message = JSON.parse(event.data);
        const pending = commands.get(message.id);
        if (!pending) return;
        commands.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
    });
    await new Promise((resolve, reject) => {
        socket.addEventListener('open', resolve, { once: true });
        socket.addEventListener('error', reject, { once: true });
    });
}
function cdp(method, params = {}, session) {
    const id = ++commandId;
    const { promise, resolve, reject } = Promise.withResolvers();
    commands.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params, sessionId: session }));
    return promise;
}
async function attachPage() {
    if (sessionId) return;
    await connectBrowser();
    const { targetInfos } = await cdp('Target.getTargets');
    const page = targetInfos.find(target => target.type === 'page' && target.url === server.url.href);
    if (!page) throw new Error('Missing test tab');
    ({ sessionId } = await cdp('Target.attachToTarget', { targetId: page.targetId, flatten: true }));
}
const server = serve({
    port: 0,
    idleTimeout: 30,
    hostname: '127.0.0.1',
    async fetch(request) {
        const url = new URL(request.url);
        if (url.pathname === '/') {
            const mode = noDevice ? '<meta name="no-device">' : '';
            const startup = "import('/test.js').catch(error => fetch('/result', { method: 'POST', body: JSON.stringify({ ok: false, error: String(error.stack ?? error) }) }));";
            return new Response('<!doctype html><html><head>' + mode + '</head><body><script type="module">' + startup + '</script></body></html>', { headers: { 'Content-Type': 'text/html' } });
        }
        if (url.pathname === '/test.js') return new Response(bundle.outputs[0], { headers: { 'Content-Type': 'application/javascript' } });
        if (url.pathname === '/screenshot') {
            await attachPage();
            const { data } = await cdp('Page.captureScreenshot', { format: 'png' }, sessionId);
            return new Response(Buffer.from(data, 'base64'), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' } });
        }
        if (url.pathname === '/input' && request.method === 'POST' && request.headers.get('origin') === server.url.origin) {
            await attachPage();
            const { x, y } = await request.json();
            for (const type of ['mousePressed', 'mouseReleased']) await cdp('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }, sessionId);
            for (const type of ['keyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', { type, key: 'ArrowLeft', code: 'ArrowLeft', windowsVirtualKeyCode: 37 }, sessionId);
            return new Response('OK');
        }
        if (url.pathname === '/result' && request.method === 'POST' && request.headers.get('origin') === server.url.origin) {
            const result = await request.json();
            report.resolve(result);
            return new Response('OK');
        }
        return new Response(null, { status: 404 });
    }
});
const profile = mkdtempSync(join(tmpdir(), 'rs530-browser-gl-canvas-'));
const chrome = spawn(
    executable,
    [
        '--headless=new',
        '--remote-debugging-address=127.0.0.1',
        '--remote-debugging-port=0',
        '--disable-background-networking',
        '--disable-component-update',
        '--disable-extensions',
        '--disable-sync',
        '--no-first-run',
        '--window-size=900,700',
        '--force-device-scale-factor=2',
        '--user-data-dir=' + profile,
        ...(noDevice ? ['--disable-gpu', '--disable-software-rasterizer', '--disable-features=WebGPU'] : []),
        server.url.href
    ],
    { stdio: 'ignore', windowsHide: true }
);
const exited = once(chrome, 'exit');
const timer = setTimeout(() => report.reject(new Error('Chrome did not report the WebGPU fixture within 30s')), 30000);
try {
    const result = await Promise.race([
        report.promise,
        exited.then(([code]) => {
            throw new Error('Chrome exited before reporting: ' + code);
        })
    ]);
    if (!result.ok) throw new Error(result.error);
    console.log(JSON.stringify(result));
} finally {
    clearTimeout(timer);
    server.stop(true);
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ id: ++commandId, method: 'Browser.close' }));
    const kill = setTimeout(() => chrome.kill(), 3000);
    await exited;
    clearTimeout(kill);
    rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}

if (!noDevice) {
    const fallback = spawnBun([process.execPath, import.meta.path, '--no-device'], { stdin: 'ignore', stdout: 'inherit', stderr: 'inherit' });
    if ((await fallback.exited) !== 0) throw new Error('Chrome no-device fallback gate failed');
}
