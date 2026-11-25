import JagString, { fromLiteral } from '#/datastruct/JagString';
import type Pix8 from '#/graphics/Pix8';
import type Js5 from '#/cache/Js5';
import Pix32 from '#/graphics/Pix32';
import Pix2D from '#/graphics/Pix2D';
import SpriteLoader from '#/graphics/SpriteLoader';
import { mathRandom } from '#/util/JavaRandom';
import { arrayAtI32, arrayAtObj, arrayAtU8, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import Client from '#/client/Client';
import { glJar } from '#/client/ClientVariant';
import GlRenderer from '#/gl/GlRenderer';
import { loadGlRaster } from '#/util/GamepackClasses';
import { isJavaRuntimeException } from '#/util/JavaException';
import WrappedException from '#/util/WrappedException';

export default class TitleFlames {
    static flameBuffer: Int32Array | null = null; // ea.k:[I
    static runeSprites: (Pix8 | null)[] | null = null; // ij.a:[Lch;
    static flameLineOffset: Int32Array | null = new Int32Array(256); // ed.m:[I
    static flameGradient: Int32Array | null = null; // t.H:[I
    static flameBuffer0: Int32Array | null = null; // rc.f:[I
    static flameSprite: Pix32 | null = null; // uf.g:Lrh;
    static flameBuffer1: Int32Array | null = null; // f.a:[I
    static blurBuffer: Int32Array | null = null; // qj.K:[I
    static flameColours: Int32Array | null = Int32Array.of(12543016, 15504954, 15914854, 16773818); // sc.P:[I
    static sparks = 0; // jg.v:I
    static phase = 0; // ka.h:I
    static coolingCycle = 0; // m.M:I
    static runesGroup = 0; // wi.i:I
    static runesName: JagString | null = fromLiteral('runes'); // ek.J:Lid;

    // fk.Y:I. Logic cycles since the last flame draw: client.g adds one per cycle (ng.c), vb.b runs nl.c with the
    // total (clamped to 10 there) and clears it.
    static pendingCycles = 0;

    // ng.c(B)V. client.g calls it right after bb.e++, before the timer queue. The only caller passes -81, so the
    // `var0 >= -62` dummy guard (which would call vb.b(72, 116, 30)) is stripped with the counter.
    static tick(): void {
        TitleFlames.pendingCycles = (TitleFlames.pendingCycles + 1) | 0;
    }

    // od.a(Lal;I)V. NXT TitleFlames::SetupFire.
    static SetupFire(archive: Js5 | null): void {
        TitleFlames.runeSprites = SpriteLoader.loadIndexedSprites(archive, TitleFlames.runesGroup);
        TitleFlames.flameGradient = new Int32Array(256);
        for (let ramp = 0; ramp < 3; ramp++) {
            const nextRed = (arrayAtI32(TitleFlames.flameColours, ramp + 1) & 0xff0000) >> 16;
            let red = (arrayAtI32(TitleFlames.flameColours, ramp) & 0xff0000) >> 16;
            const redStep = (nextRed - red) / 64;
            let green = (arrayAtI32(TitleFlames.flameColours, ramp) & 0xff00) >> 8;
            const greenStep = (((arrayAtI32(TitleFlames.flameColours, ramp + 1) & 0xff00) >> 8) - green) / 64;
            let blue = arrayAtI32(TitleFlames.flameColours, ramp) & 0xff;
            const blueStep = ((arrayAtI32(TitleFlames.flameColours, ramp + 1) & 0xff) - blue) / 64;
            // Values and increments are exact multiples of 1/64 in the Java float range.
            for (let i = 0; i < 64; i++) {
                arrayPutI32(TitleFlames.flameGradient, ramp * 64 + i, (red << 16) | (green << 8) | blue);
                green += greenStep;
                blue += blueStep;
                red += redStep;
            }
        }
        for (let i = 192; i < 255; i++) arrayPutI32(TitleFlames.flameGradient, i, arrayAtI32(TitleFlames.flameColours, 3));
        TitleFlames.flameBuffer0 = new Int32Array(32768);
        TitleFlames.flameBuffer1 = new Int32Array(32768);
        TitleFlames.GenerateFlameCoolingMap(null);
        TitleFlames.blurBuffer = new Int32Array(32768);
        TitleFlames.flameBuffer = new Int32Array(32768);
        TitleFlames.flameSprite = new Pix32(128, 254);
    }

    // ca.a(ILch;)V. NXT TitleFlames::GenerateFlameCoolingMap.
    static GenerateFlameCoolingMap(rune: Pix8 | null): void {
        requireNonNull(TitleFlames.flameBuffer0).fill(0);
        for (let i = 0; i < 5000; i++) {
            const pos = (128 * mathRandom.nextDouble() * 256) | 0;
            arrayPutI32(TitleFlames.flameBuffer0, pos, (284 * mathRandom.nextDouble()) | 0);
        }
        for (let pass = 0; pass < 20; pass++) {
            for (let y = 1; y < 255; y++) {
                for (let x = 1; x < 127; x++) {
                    const pos = (y << 7) + x;
                    const sum = (arrayAtI32(TitleFlames.flameBuffer0, pos + 1) + arrayAtI32(TitleFlames.flameBuffer0, pos - 1) + arrayAtI32(TitleFlames.flameBuffer0, pos - 128) + arrayAtI32(TitleFlames.flameBuffer0, pos + 128)) | 0;
                    arrayPutI32(TitleFlames.flameBuffer1, pos, (sum / 4) | 0);
                }
            }
            const tmp = TitleFlames.flameBuffer0;
            TitleFlames.flameBuffer0 = TitleFlames.flameBuffer1;
            TitleFlames.flameBuffer1 = tmp;
        }
        if (rune !== null) {
            let pos = 0;
            for (let y = 0; y < rune.height; y++) {
                for (let x = 0; x < rune.width; x++) {
                    if (arrayAtU8(rune.pixels, pos++) !== 0) {
                        arrayPutI32(TitleFlames.flameBuffer0, ((rune.yOffset + 16 + y) << 7) + rune.xOffset + x + 16, 0);
                    }
                }
            }
        }
    }

    // SD nl.c(II)V, HD vl.a(II)V. NXT TitleFlames::UpdateFlames.
    static UpdateFlames(cycles: number): void {
        try {
            if (cycles > 256) cycles = 256;
            if (cycles > 10) cycles = 10;
            TitleFlames.coolingCycle = (TitleFlames.coolingCycle + Math.imul(128, cycles)) | 0;
            if (requireNonNull(TitleFlames.flameBuffer0).length < TitleFlames.coolingCycle) {
                if (glJar) TitleFlames.coolingCycle = (TitleFlames.coolingCycle - requireNonNull(TitleFlames.flameBuffer0).length) | 0;
                const index = (12 * mathRandom.nextDouble()) | 0;
                if (!glJar) TitleFlames.coolingCycle = (TitleFlames.coolingCycle - requireNonNull(TitleFlames.flameBuffer0).length) | 0;
                TitleFlames.GenerateFlameCoolingMap(arrayAtObj(TitleFlames.runeSprites, index));
            }
            const first = Math.imul(cycles, 128),
                rows = (256 - cycles) | 0,
                count = Math.imul(rows, 128);
            for (let i = 0; i < count; i++) {
                const heat = arrayAtI32(TitleFlames.flameBuffer, first + i);
                const cooling = arrayAtI32(TitleFlames.flameBuffer0, (requireNonNull(TitleFlames.flameBuffer0).length - 1) & (TitleFlames.coolingCycle + i));
                arrayPutI32(TitleFlames.flameBuffer, i, Math.max(0, (heat - ((Math.imul(cycles, cooling) / 6) | 0)) | 0));
                // Retain the previous draw's heat until the first Java store succeeds.
                if (i === 0) Pix2D.spanTarget?.invalidate(TitleFlames.flameBuffer);
            }
            for (let y = rows; y < 256; y++) {
                for (let x = 0; x < 128; x++) {
                    const random = (100 * mathRandom.nextDouble()) | 0;
                    arrayPutI32(TitleFlames.flameBuffer, (y << 7) + x, random < 50 && x > 10 && x < 118 ? 255 : 0);
                    // A wrapped row count can make this the first store instead.
                    if (count <= 0 && y === rows && x === 0) Pix2D.spanTarget?.invalidate(TitleFlames.flameBuffer);
                }
            }
            for (let i = 0; i < rows; i++) arrayPutI32(TitleFlames.flameLineOffset, i, arrayAtI32(TitleFlames.flameLineOffset, i + cycles));
            for (let i = rows; i < 256; i++) {
                const phase = TitleFlames.phase;
                arrayPutI32(TitleFlames.flameLineOffset, i, (Math.sin(phase / 14) * 16 + Math.sin(phase / 15) * 14 + Math.sin(phase / 16) * 12) | 0);
                TitleFlames.phase = (TitleFlames.phase + 1) | 0;
            }
            const radius = ((((Client.loopCycle & 1) + cycles) | 0) / 2) | 0;
            TitleFlames.sparks = (TitleFlames.sparks + cycles) | 0;
            if (radius <= 0) return;
            for (let i = 0; i < TitleFlames.sparks; i++) {
                const x = 2 + ((mathRandom.nextDouble() * 124) | 0);
                const y = 128 + ((mathRandom.nextDouble() * 128) | 0);
                arrayPutI32(TitleFlames.flameBuffer, (y << 7) + x, 192);
            }
            TitleFlames.sparks = 0;
            const span = 1 + 2 * radius;
            for (let y = 0; y < 256; y++) {
                const row = y << 7;
                let sum = 0;
                for (let x = -radius; x < 128; x++) {
                    if (x + radius < 128) sum = (sum + arrayAtI32(TitleFlames.flameBuffer, row + x + radius)) | 0;
                    if (x - radius - 1 >= 0) sum = (sum - arrayAtI32(TitleFlames.flameBuffer, row + x - radius - 1)) | 0;
                    if (x >= 0) arrayPutI32(TitleFlames.blurBuffer, row + x, (sum / span) | 0);
                }
            }
            for (let x = 0; x < 128; x++) {
                let sum = 0;
                for (let y = -radius; y < 256; y++) {
                    if (y + radius < 256) sum = (sum + arrayAtI32(TitleFlames.blurBuffer, ((y + radius) << 7) + x)) | 0;
                    if (y - radius - 1 >= 0) sum = (sum - arrayAtI32(TitleFlames.blurBuffer, ((y - radius - 1) << 7) + x)) | 0;
                    if (y >= 0) arrayPutI32(TitleFlames.flameBuffer, (y << 7) + x, (sum / span) | 0);
                }
            }
        } catch (error) {
            if (!glJar || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'vl.E(' + cycles + ',0)');
        }
    }

    // vb.b(III)V. NXT TitleFlames::RenderFlames. The 530 method composites a complete 128 x 254
    // sprite against the framebuffer before rh.a applies the 2D clip in its final opaque blit.
    static RenderFlames(x: number, y: number): void {
        if (TitleFlames.pendingCycles > 0) {
            TitleFlames.UpdateFlames(TitleFlames.pendingCycles);
            TitleFlames.pendingCycles = 0;
        }
        const capture = Pix2D.spanTarget;
        if (capture !== null && capture.flames(Pix2D.pixels, x, y, requireNonNull(TitleFlames.flameSprite).pixels, TitleFlames.flameLineOffset, TitleFlames.flameBuffer, TitleFlames.flameGradient)) {
            requireNonNull(TitleFlames.flameSprite).drawOpaque(x, y);
            return;
        }
        let heatPos = 0,
            background = Math.imul(y, Pix2D.width),
            dest = 0;
        for (let row = 1; row < 255; row++) {
            let shift = (Math.imul(256 - row, arrayAtI32(TitleFlames.flameLineOffset, row)) / 256) | 0;
            if (shift < 0) shift = 0;
            heatPos = (heatPos + shift) | 0;
            for (let col = shift; col < 128; col++) {
                const bg = arrayAtI32(Pix2D.pixels, x + background++);
                const heat = arrayAtI32(TitleFlames.flameBuffer, heatPos++);
                if (heat === 0) {
                    arrayPutI32(requireNonNull(TitleFlames.flameSprite).pixels, dest++, bg);
                } else {
                    const alpha = Math.min(255, (heat + 18) | 0);
                    const colour = arrayAtI32(TitleFlames.flameGradient, heat);
                    const inv = Math.min(255, (238 - heat) | 0);
                    const green = (Math.imul(inv, bg & 0xff00) + Math.imul(alpha, colour & 0xff00)) & 0xff0000;
                    const redBlue = (Math.imul(alpha, colour & 0xff00ff) + Math.imul(inv, bg & 0xff00ff)) & 0xff00ff00;
                    arrayPutI32(requireNonNull(TitleFlames.flameSprite).pixels, dest++, (green + redBlue) >> 8);
                }
            }
            for (let i = 0; i < shift; i++) {
                arrayPutI32(requireNonNull(TitleFlames.flameSprite).pixels, dest++, arrayAtI32(Pix2D.pixels, x + background++));
            }
            background = (background + Pix2D.width - 128) | 0;
        }
        // HD s.b(III)V draws the completed software buffer through dj.a([IIIII)V when GL is active.
        if (glJar && GlRenderer.active) {
            const sprite = requireNonNull(TitleFlames.flameSprite);
            loadGlRaster().drawPixels(sprite.pixels, x, y, sprite.width, sprite.height);
        } else {
            requireNonNull(TitleFlames.flameSprite).drawOpaque(x, y);
        }
    }
}
