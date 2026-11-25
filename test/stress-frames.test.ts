import { expect, test } from 'bun:test';
import BrowserStressFrames from '#/client/BrowserStressFrames';

test('browser stress presents once per refresh and retains a new game frame while the GPU is busy', async () => {
    const previousRequest = Object.getOwnPropertyDescriptor(globalThis, 'requestAnimationFrame');
    const previousCancel = Object.getOwnPropertyDescriptor(globalThis, 'cancelAnimationFrame');
    let callback: FrameRequestCallback = () => {
        throw new Error('No animation frame was requested');
    };
    let requested = 0;
    let cancelled = 0;
    Object.defineProperty(globalThis, 'requestAnimationFrame', {
        configurable: true,
        value: (fn: FrameRequestCallback) => {
            callback = fn;
            return ++requested;
        }
    });
    Object.defineProperty(globalThis, 'cancelAnimationFrame', {
        configurable: true,
        value: (id: number) => {
            cancelled = id;
        }
    });
    const sources: boolean[] = [];
    const frames = new BrowserStressFrames((gameDrawn = false) => {
        sources.push(gameDrawn);
        return sources.length !== 1;
    });
    try {
        expect(frames.displayPaced).toBe(true);
        frames.recordFrame();
        frames.recordFrame();
        expect(await frames.duringWait(Promise.resolve(3), Infinity)).toBe(3);
        expect(sources).toEqual([]);
        callback(10);
        callback(15);
        callback(20);
        expect(sources).toEqual([true, true, false]);
        expect(frames.extraFrames).toBe(1);
    } finally {
        frames.close();
        if (previousRequest) Object.defineProperty(globalThis, 'requestAnimationFrame', previousRequest);
        else Reflect.deleteProperty(globalThis, 'requestAnimationFrame');
        if (previousCancel) Object.defineProperty(globalThis, 'cancelAnimationFrame', previousCancel);
        else Reflect.deleteProperty(globalThis, 'cancelAnimationFrame');
    }
    expect(cancelled).toBe(requested);
});

test('extra GPU frames run between ticks, back off when busy, and keep the original catch-up count', async () => {
    const ticks = Promise.withResolvers<number>();
    let attempts = 0;
    const frames = new BrowserStressFrames(() => {
        if (++attempts === 1) return false;
        if (attempts === 4) ticks.resolve(3);
        return true;
    });
    try {
        expect(await frames.duringWait(ticks.promise, Infinity)).toBe(3);
        await Bun.sleep(10);
        expect(attempts).toBe(4);
        expect(frames.extraFrames).toBe(3);
        expect(await frames.duringWait(Promise.resolve(10), performance.now() - 1)).toBe(10);
        expect(frames.extraFrames).toBe(3);
    } finally {
        frames.close();
    }
});

test('closing the stress session cancels queued work while the Java timer still completes', async () => {
    const frames = new BrowserStressFrames(() => {
        throw new Error('Closed frame pump ran');
    });
    const ticks = Promise.withResolvers<number>();
    const pending = frames.duringWait(ticks.promise, Infinity);
    frames.close();
    await Bun.sleep(5);
    ticks.resolve(1);
    expect(await pending).toBe(1);
    expect(frames.extraFrames).toBe(0);
});

test('a hidden tab services the Java timer without issuing extra draws', async () => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { hidden: true } });
    const frames = new BrowserStressFrames(() => {
        throw new Error('Hidden frame pump ran');
    });
    try {
        expect(
            await frames.duringWait(
                Bun.sleep(8).then(() => 2),
                Infinity
            )
        ).toBe(2);
        expect(frames.extraFrames).toBe(0);
    } finally {
        frames.close();
        if (previous) Object.defineProperty(globalThis, 'document', previous);
        else Reflect.deleteProperty(globalThis, 'document');
    }
});
