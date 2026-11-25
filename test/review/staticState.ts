import Pix2D from '../../src/graphics/Pix2D.js';
import SpriteLoader from '../../src/graphics/SpriteLoader.js';

// Every review oracle runs its Java side in a fresh JVM, so a TS fixture that shares static classes with other suites
// starts those classes from their <clinit> values and puts the incoming values back afterwards. That keeps each
// review test independent of the order the full suite runs in.

type Statics = Record<string, unknown>;

// td.<clinit>: no buffer, zero size, zero clip, no clip mask.
export function pix2dClinit(): Statics {
    return { pixels: null, width: 0, height: 0, clipMinX: 0, clipMinY: 0, clipMaxX: 0, clipMaxY: 0, maskOffsets: null, maskLengths: null };
}

// The decoder scratch of ja/og/pk/df/tf/ed (SpriteLoader): no group decoded yet.
export function spriteLoaderScratchClinit(): Statics {
    return { count: 0, hasAlpha: null, xOffsets: null, yOffsets: null, widths: null, innerHeights: null, alphas: null, pixels: null, canvasWidth: 0, height: 0, palette: null };
}

export interface StaticReset {
    target: object;
    clinit: Statics;
}

export const PIX2D: () => StaticReset = () => ({ target: Pix2D, clinit: pix2dClinit() });
export const SPRITE_LOADER: () => StaticReset = () => ({ target: SpriteLoader, clinit: spriteLoaderScratchClinit() });

// Applies the <clinit> values, runs the fixture and restores whatever the classes held before, even when it throws.
export function withClinitStatics<T>(resets: StaticReset[], run: () => T): T {
    const saved = resets.map(({ target, clinit }) => {
        const state = target as Statics;
        const before = Object.keys(clinit).map(key => [key, state[key]] as const);
        Object.assign(state, clinit);
        return { state, before };
    });
    try {
        return run();
    } finally {
        for (const { state, before } of saved) for (const [key, value] of before) state[key] = value;
    }
}

// The same for an async fixture.
export async function withClinitStaticsAsync<T>(resets: StaticReset[], run: () => Promise<T>): Promise<T> {
    const saved = resets.map(({ target, clinit }) => {
        const state = target as Statics;
        const before = Object.keys(clinit).map(key => [key, state[key]] as const);
        Object.assign(state, clinit);
        return { state, before };
    });
    try {
        return await run();
    } finally {
        for (const { state, before } of saved) for (const [key, value] of before) state[key] = value;
    }
}
