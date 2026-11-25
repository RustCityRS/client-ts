/// <reference types="@webgpu/types" />
import BrowserGlCanvas from '../../src/client/BrowserGlCanvas.js';
import BrowserMouseSurface from '../../src/client/BrowserMouseSurface.js';
import ClientMouseListener from '../../src/client/ClientMouseListener.js';
import { defaultSurface } from '../../src/gl/driver/Presenter.js';

function check(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

function close(actual: number, expected: number, message: string): void {
    check(Math.abs(actual - expected) <= 0.05, message + ': ' + actual + ' vs ' + expected);
}

function nextFrame(): Promise<number> {
    return new Promise(resolve => requestAnimationFrame(resolve));
}

async function visiblePixel(input: HTMLCanvasElement, xFraction = 0.5, yFraction = 0.5): Promise<string> {
    await nextFrame();
    await nextFrame();
    const screenshot = await createImageBitmap(await (await fetch('/screenshot')).blob());
    const pixel = new OffscreenCanvas(1, 1).getContext('2d');
    check(pixel, 'screenshot decoding context');
    const bounds = input.getBoundingClientRect();
    const scale = screenshot.width / window.innerWidth;
    pixel.drawImage(screenshot, ((bounds.left + bounds.width * xFraction) * scale) | 0, ((bounds.top + bounds.height * yFraction) * scale) | 0, 1, 1, 0, 0, 1, 1);
    screenshot.close();
    return pixel.getImageData(0, 0, 1, 1).data.join();
}

async function run() {
    document.body.innerHTML = '<main><div id="scroll"><div id="layout"><canvas id="game" width="240" height="140" tabindex="0"></canvas></div></div></main>';
    const css = document.createElement('style');
    css.textContent =
        'body{margin:0;min-height:1400px} main{position:relative;margin:25px} #scroll{position:relative;overflow:auto;width:450px;height:260px} #layout{width:720px;height:660px;padding:25px} #game{display:block;width:320px;height:160px;border:3px solid black;padding:5px 9px;margin:18px 28px} canvas{max-width:100%}';
    document.head.append(css);
    const input = document.querySelector('canvas');
    const scroller = document.getElementById('scroll');
    check(input && scroller, 'fixture input and scroll container');
    const sd = input.getContext('2d');
    check(sd, 'original 2D context');
    sd.fillStyle = '#d00';
    sd.fillRect(0, 0, input.width, input.height);
    input.focus();
    const host = new BrowserGlCanvas(input);
    const overlay = input.nextElementSibling;
    check(overlay instanceof HTMLCanvasElement, 'dedicated sibling canvas');
    const target = defaultSurface(host);
    check(target && host.isDisplayable(), 'presenter recognizes a displayable target');
    const bounds = (original: HTMLCanvasElement) => {
        const rect = original.getBoundingClientRect();
        const gpu = overlay.getBoundingClientRect();
        close(gpu.left, rect.left + 12, 'left content edge');
        close(gpu.top, rect.top + 8, 'top content edge');
        close(gpu.width, rect.width - 24, 'content width');
        close(gpu.height, rect.height - 16, 'content height');
        check(overlay.width === original.width && overlay.height === original.height, 'backing store matches Java size');
        check(target.width() === original.width && target.height() === original.height, 'presenter reads current size');
    };
    bounds(input);
    check(input.getContext('webgpu') === null, '2D context remains bound to input');
    check(document.activeElement === input, 'HD initialization preserved focus');
    overlay.focus();
    check(document.activeElement === input, 'GPU canvas cannot steal keyboard focus');
    const x = overlay.getBoundingClientRect().left + 20;
    const y = overlay.getBoundingClientRect().top + 20;
    const hit = document.elementFromPoint(x, y);
    check(hit === input, 'real hit testing passes through GPU canvas');
    let clicked = false;
    let keyed = false;
    input.addEventListener(
        'pointerdown',
        event => {
            clicked = event.isTrusted;
        },
        { once: true }
    );
    input.addEventListener(
        'keydown',
        event => {
            keyed = event.isTrusted && event.key === 'ArrowLeft';
        },
        { once: true }
    );
    await fetch('/input', { method: 'POST', body: JSON.stringify({ x, y }) });
    check(clicked && keyed, 'trusted pointer and keyboard events reach the input canvas');
    const mouseEvents = new AbortController();
    const mouse = new BrowserMouseSurface(input, { area: () => 'scene', tap() {}, cameraKey() {} }, mouseEvents.signal);
    ClientMouseListener.addListeners(mouse);
    for (const sizing of ['content-box', 'border-box']) {
        input.style.boxSizing = sizing;
        host.sync();
        const surface = overlay.getBoundingClientRect();
        for (const fraction of [0.02, 0.5, 0.98]) {
            const px = Math.round(surface.left + surface.width * fraction);
            const py = Math.round(surface.top + surface.height * (1 - fraction));
            await fetch('/input', { method: 'POST', body: JSON.stringify({ x: px, y: py }) });
            ClientMouseListener.poll();
            const wantedX = (((px - surface.left) * input.width) / surface.width) | 0;
            const wantedY = (((py - surface.top) * input.height) / surface.height) | 0;
            check(ClientMouseListener.clickX === wantedX && ClientMouseListener.clickY === wantedY, 'Java mouse click ' + ClientMouseListener.clickX + ',' + ClientMouseListener.clickY + ' expected ' + wantedX + ',' + wantedY + ' ' + sizing);
        }
    }
    ClientMouseListener.stop(mouse, 0);
    mouseEvents.abort();
    input.style.boxSizing = 'content-box';
    host.sync();

    const gpu = navigator.gpu;
    if (document.querySelector('meta[name="no-device"]')) {
        const unavailable = gpu ? await gpu.requestAdapter({ powerPreference: 'high-performance' }) : null;
        check(!unavailable, 'second browser has no WebGPU adapter');
        host.dispose();
        check(!overlay.isConnected && !host.isDisplayable() && document.activeElement === input, 'no-device fallback keeps input and focus');
        check((await visiblePixel(input)) === '221,0,0,255', 'Chrome compositor presents SD after failed HD entry');
        const retry = new BrowserGlCanvas(input);
        check(retry.isDisplayable(), 'a failed adapter can be retried with a fresh drawable');
        retry.dispose();
        return { adapter: null, dpr: devicePixelRatio };
    }
    check(gpu, 'Chrome exposes WebGPU');
    const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
    check(adapter && !adapter.info.isFallbackAdapter, 'hardware WebGPU adapter');
    const device = await adapter.requestDevice();
    const context = host.getContext('webgpu');
    check(context && target.canvasContext() === context, 'Presenter gets the real distinct WebGPU context');
    check(overlay.getContext('2d') === null, 'GPU context exclusive to overlay');
    const format = gpu.getPreferredCanvasFormat();
    context.configure({ device, format, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC, alphaMode: 'opaque' });
    const texture = context.getCurrentTexture();
    const buffer = device.createBuffer({ size: 256, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({ colorAttachments: [{ view: texture.createView(), clearValue: { r: 0, g: 1, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'store' }] });
    pass.end();
    encoder.copyTextureToBuffer({ texture }, { buffer, bytesPerRow: 256 }, [1, 1, 1]);
    device.queue.submit([encoder.finish()]);
    await buffer.mapAsync(GPUMapMode.READ);
    check(new Uint8Array(buffer.getMappedRange(), 0, 4).join() === '0,255,0,255', 'actual GPU clear pixels');
    buffer.unmap();
    buffer.destroy();
    check(sd.getImageData(0, 0, 1, 1).data.join() === '221,0,0,255', 'simultaneous software canvas pixels');
    check((await visiblePixel(input)) === '0,255,0,255', 'Chrome compositor presents the green WebGPU surface above the red 2D canvas');
    scroller.style.position = 'static';
    scroller.style.width = '210px';
    await nextFrame();
    check((await visiblePixel(input, 0.9)) === '255,255,255,255', 'GPU surface clips to the same overflow container as its input');
    check((await visiblePixel(input, 0.2)) === '0,255,0,255', 'GPU surface stays visible inside its scroll container');
    scroller.style.position = 'relative';
    scroller.style.width = '';

    input.width = 377;
    input.height = 181;
    check(target.width() === 377 && target.height() === 181, 'drawable sees both new dimensions before observer delivery');
    check(overlay.width === 377 && overlay.height === 181, 'GPU canvas follows a synchronous drawable query');
    input.style.width = '311.75px';
    input.style.marginLeft = '42.5px';
    await nextFrame();
    await nextFrame();
    bounds(input);
    scroller.scrollTo(38, 41);
    window.scrollTo(0, 15);
    await nextFrame();
    await nextFrame();
    bounds(input);
    check(context.getCurrentTexture().width === 377, 'configured GPU backing resized with physical canvas');
    check(document.activeElement === input, 'resizing and scrolling preserved focus');

    const replacement = input.cloneNode(false) as HTMLCanvasElement;
    input.replaceWith(replacement);
    replacement.focus();
    await nextFrame();
    check(!host.isDisplayable() && !overlay.isConnected, 'removing input removes stale overlay');
    host.setInput(replacement);
    check(replacement.nextElementSibling === overlay && host.isDisplayable(), 'same drawable follows remounted canvas');
    check(host.getContext('webgpu') === context && document.activeElement === replacement, 'replacement keeps GPU context and new input focus');
    bounds(replacement);
    host.dispose();
    host.dispose();
    check(!overlay.isConnected && !host.isDisplayable() && host.getContext('webgpu') === null, 'SD fallback drops GPU surface');
    const fallback = replacement.getContext('2d');
    check(fallback && document.activeElement === replacement, 'SD can continue after fallback');
    fallback.fillStyle = '#d00';
    fallback.fillRect(0, 0, replacement.width, replacement.height);
    check((await visiblePixel(replacement)) === '221,0,0,255', 'Chrome compositor presents the red 2D surface after fallback');
    const fresh = new BrowserGlCanvas(replacement);
    const nextContext = fresh.getContext('webgpu');
    check(nextContext !== null && nextContext !== context, 'HD re-entry creates a fresh context');
    fresh.dispose();
    device.destroy();
    return { adapter: adapter.info.vendor + ' ' + adapter.info.architecture, dpr: devicePixelRatio, backing: [overlay.width, overlay.height], format };
}

run().then(
    result => fetch('/result', { method: 'POST', body: JSON.stringify({ ok: true, ...result }) }),
    error => fetch('/result', { method: 'POST', body: JSON.stringify({ ok: false, error: String(error?.stack ?? error) }) })
);
