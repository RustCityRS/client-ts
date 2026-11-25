import { GL } from '#/jogl/GL';
import { intDivide } from '#/util/IntUtils';
import { requireNonNull } from '#/util/JavaArray';
import IntBuffer from '#/util/nio/IntBuffer';
import GlRenderer from './GlRenderer';
import type GlSprite from './GlSprite';

// dj in runescape_gl.jar (HD only, all static): the GL counterpart of Pix2D. Lines, outlines and fills are
// immediate-mode GL_LINES, GL_LINE_LOOP and GL_TRIANGLE_FAN primitives in the 2D ortho projection (GlRenderer
// begin2dUntextured, tf.i()V), with y flipped against the GL height (GlRenderer.height, tf.A) and outlines nudged by
// 0.3 px onto pixel centres. The clip rectangle is the GL scissor box; the clip mask is a GlSprite whose height must
// equal the clip height, cleared by every clip change. drawPixels blits a raw ARGB int[] with glDrawPixels, blending
// and alpha test off. Callers are the GL arms of the shared 2D code (ha.a(I)V, ui.a(IIZIII)V, gn.a, ...). NXT has no
// GL 1.x classes, so the names are descriptive and mirror Pix2D's (HD_PLAN.md 1.3). Statics are declared in
// classfile order; dj.<clinit>()V stores b, a, c, e, d, each its JVM default.
export default class GlRaster {
    static mask: GlSprite | null = null; // dj.a:Lcf; (the clip mask)
    static clipMinY = 0; // dj.b:I
    static clipMinX = 0; // dj.c:I
    private static clipMaxX = 0; // dj.d:I
    static clipMaxY = 0; // dj.e:I

    // dj.a()V
    static clearClipMask(): void {
        GlRaster.mask = null;
    }

    // dj.a(IIII)V
    static hline(x: number, y: number, width: number, colour: number): void {
        GlRenderer.begin2dUntextured();
        const x0 = Math.fround(Math.fround(x) + Math.fround(0.3));
        const x1 = Math.fround(x0 + Math.fround(width));
        const y0 = Math.fround(Math.fround(GlRenderer.height) - Math.fround(Math.fround(y) + Math.fround(0.3)));
        const gl = GlRenderer.gl;
        requireNonNull(gl).glBegin(GL.GL_LINES);
        requireNonNull(gl).glColor3ub(((colour >> 16) << 24) >> 24, ((colour >> 8) << 24) >> 24, (colour << 24) >> 24);
        requireNonNull(gl).glVertex2f(x0, y0);
        requireNonNull(gl).glVertex2f(x1, y0);
        requireNonNull(gl).glEnd();
    }

    // dj.b()V
    static unload(): void {
        GlRaster.mask = null;
    }

    // dj.b(IIII)V
    static vline(x: number, y: number, height: number, colour: number): void {
        GlRenderer.begin2dUntextured();
        const x0 = Math.fround(Math.fround(x) + Math.fround(0.3));
        const y0 = Math.fround(Math.fround(GlRenderer.height) - Math.fround(Math.fround(y) + Math.fround(0.3)));
        const y1 = Math.fround(y0 - Math.fround(height));
        const gl = GlRenderer.gl;
        requireNonNull(gl).glBegin(GL.GL_LINES);
        requireNonNull(gl).glColor3ub(((colour >> 16) << 24) >> 24, ((colour >> 8) << 24) >> 24, (colour << 24) >> 24);
        requireNonNull(gl).glVertex2f(x0, y0);
        requireNonNull(gl).glVertex2f(x0, y1);
        requireNonNull(gl).glEnd();
    }

    // dj.c()V
    static resetClipping(): void {
        GlRaster.clipMinX = 0;
        GlRaster.clipMinY = 0;
        GlRaster.clipMaxX = GlRenderer.width;
        GlRaster.clipMaxY = GlRenderer.height;
        const gl = GlRenderer.gl;
        requireNonNull(gl).glDisable(GL.GL_SCISSOR_TEST);
        GlRaster.clearClipMask();
    }

    // dj.a([IIIII)V. Blits width x height ARGB pixels with the top-left corner at (x, y): the raster position is the
    // flipped y and the pixel zoom -1 draws the rows downwards. GL_BGRA with UNSIGNED_BYTE reads a little-endian int
    // as B, G, R, A; a big-endian host (GlRenderer.bigEndian, tf.f) needs UNSIGNED_INT_8_8_8_8_REV for the same order.
    static drawPixels(pixels: Int32Array | null, x: number, y: number, width: number, height: number): void {
        GlRenderer.begin2dUntextured();
        const gl = GlRenderer.gl;
        requireNonNull(gl).glRasterPos2i(x, (GlRenderer.height - y) | 0);
        requireNonNull(gl).glPixelZoom(1.0, -1.0);
        requireNonNull(gl).glDisable(GL.GL_BLEND);
        requireNonNull(gl).glDisable(GL.GL_ALPHA_TEST);
        requireNonNull(gl).glDrawPixels(width, height, GL.GL_BGRA, GlRenderer.bigEndian ? GL.GL_UNSIGNED_INT_8_8_8_8_REV : GL.GL_UNSIGNED_BYTE, IntBuffer.wrap(pixels));
        requireNonNull(gl).glEnable(GL.GL_ALPHA_TEST);
        requireNonNull(gl).glEnable(GL.GL_BLEND);
        requireNonNull(gl).glPixelZoom(1.0, 1.0);
    }

    // dj.a(IIIII)V
    static drawRect(x: number, y: number, width: number, height: number, colour: number): void {
        GlRenderer.begin2dUntextured();
        const x0 = Math.fround(Math.fround(x) + Math.fround(0.3));
        const x1 = Math.fround(x0 + Math.fround((width - 1) | 0));
        const y0 = Math.fround(Math.fround(GlRenderer.height) - Math.fround(Math.fround(y) + Math.fround(0.3)));
        const y1 = Math.fround(y0 - Math.fround((height - 1) | 0));
        const gl = GlRenderer.gl;
        requireNonNull(gl).glBegin(GL.GL_LINE_LOOP);
        requireNonNull(gl).glColor3ub(((colour >> 16) << 24) >> 24, ((colour >> 8) << 24) >> 24, (colour << 24) >> 24);
        requireNonNull(gl).glVertex2f(x0, y0);
        requireNonNull(gl).glVertex2f(x0, y1);
        requireNonNull(gl).glVertex2f(x1, y1);
        requireNonNull(gl).glVertex2f(x1, y0);
        requireNonNull(gl).glEnd();
    }

    // dj.a(IIIIII)V. An alpha above 255 is opaque.
    static drawRectTrans(x: number, y: number, width: number, height: number, colour: number, alpha: number): void {
        GlRenderer.begin2dUntextured();
        const x0 = Math.fround(Math.fround(x) + Math.fround(0.3));
        const x1 = Math.fround(x0 + Math.fround((width - 1) | 0));
        const y0 = Math.fround(Math.fround(GlRenderer.height) - Math.fround(Math.fround(y) + Math.fround(0.3)));
        const y1 = Math.fround(y0 - Math.fround((height - 1) | 0));
        const gl = GlRenderer.gl;
        requireNonNull(gl).glBegin(GL.GL_LINE_LOOP);
        requireNonNull(gl).glColor4ub(((colour >> 16) << 24) >> 24, ((colour >> 8) << 24) >> 24, (colour << 24) >> 24, alpha > 255 ? -1 : (alpha << 24) >> 24);
        requireNonNull(gl).glVertex2f(x0, y0);
        requireNonNull(gl).glVertex2f(x0, y1);
        requireNonNull(gl).glVertex2f(x1, y1);
        requireNonNull(gl).glVertex2f(x1, y0);
        requireNonNull(gl).glEnd();
    }

    // dj.b(IIIIII)V. A line `thickness` px wide as a quad: the 16.16 unit normal of the dominant axis, scaled by half
    // the thickness, offsets both ends to either side; the corner order keeps the fan counter-clockwise.
    static drawThickLine(x0: number, y0: number, x1: number, y1: number, colour: number, thickness: number): void {
        const dx = (x1 - x0) | 0;
        const absDx = dx >= 0 ? dx : -dx | 0;
        let length = absDx;
        let dy: number;
        let absDy: number;
        if (length < (absDy = (dy = (y1 - y0) | 0) >= 0 ? dy : -dy | 0)) {
            length = absDy;
        }
        if (length === 0) {
            return;
        }
        let normalX = intDivide(dy << 16, length);
        let normalY = intDivide(dx << 16, length);
        if (normalX <= normalY) {
            normalY = -normalY | 0;
        } else {
            normalX = -normalX | 0;
        }
        const offsetX0 = Math.imul(thickness, normalX) >> 17;
        const offsetX1 = (Math.imul(thickness, normalX) + 1) >> 17;
        const offsetY0 = Math.imul(thickness, normalY) >> 17;
        const offsetY1 = (Math.imul(thickness, normalY) + 1) >> 17;
        const ax = (x0 + offsetX0) | 0;
        const bx = (x0 - offsetX1) | 0;
        const cx = (x0 + dx - offsetX1) | 0;
        const dxEnd = (x0 + dx + offsetX0) | 0;
        const ay = (y0 + offsetY0) | 0;
        const by = (y0 - offsetY1) | 0;
        const cy = (y0 + dy - offsetY1) | 0;
        const dyEnd = (y0 + dy + offsetY0) | 0;
        GlRenderer.begin2dUntextured();
        const gl = GlRenderer.gl;
        requireNonNull(gl).glColor3ub(((colour >> 16) << 24) >> 24, ((colour >> 8) << 24) >> 24, (colour << 24) >> 24);
        requireNonNull(gl).glBegin(GL.GL_TRIANGLE_FAN);
        if (normalX <= normalY) {
            requireNonNull(gl).glVertex2f(Math.fround(dxEnd), Math.fround((GlRenderer.height - dyEnd) | 0));
            requireNonNull(gl).glVertex2f(Math.fround(cx), Math.fround((GlRenderer.height - cy) | 0));
            requireNonNull(gl).glVertex2f(Math.fround(bx), Math.fround((GlRenderer.height - by) | 0));
            requireNonNull(gl).glVertex2f(Math.fround(ax), Math.fround((GlRenderer.height - ay) | 0));
        } else {
            requireNonNull(gl).glVertex2f(Math.fround(ax), Math.fround((GlRenderer.height - ay) | 0));
            requireNonNull(gl).glVertex2f(Math.fround(bx), Math.fround((GlRenderer.height - by) | 0));
            requireNonNull(gl).glVertex2f(Math.fround(cx), Math.fround((GlRenderer.height - cy) | 0));
            requireNonNull(gl).glVertex2f(Math.fround(dxEnd), Math.fround((GlRenderer.height - dyEnd) | 0));
        }
        requireNonNull(gl).glEnd();
    }

    // dj.c(IIIIII)V. An alpha above 255 is opaque.
    static fillRectTrans(x: number, y: number, width: number, height: number, colour: number, alpha: number): void {
        GlRenderer.begin2dUntextured();
        const x0 = Math.fround(x);
        const x1 = Math.fround(x0 + Math.fround(width));
        const y0 = Math.fround((GlRenderer.height - y) | 0);
        const y1 = Math.fround(y0 - Math.fround(height));
        const gl = GlRenderer.gl;
        requireNonNull(gl).glBegin(GL.GL_TRIANGLE_FAN);
        requireNonNull(gl).glColor4ub(((colour >> 16) << 24) >> 24, ((colour >> 8) << 24) >> 24, (colour << 24) >> 24, alpha > 255 ? -1 : (alpha << 24) >> 24);
        requireNonNull(gl).glVertex2f(x0, y0);
        requireNonNull(gl).glVertex2f(x0, y1);
        requireNonNull(gl).glVertex2f(x1, y1);
        requireNonNull(gl).glVertex2f(x1, y0);
        requireNonNull(gl).glEnd();
    }

    // dj.c(IIII)V. Narrows the clip to its intersection with the rectangle; an empty clip is a zero scissor box.
    static intersectClipping(left: number, top: number, right: number, bottom: number): void {
        if (GlRaster.clipMinX < left) {
            GlRaster.clipMinX = left;
        }
        if (GlRaster.clipMinY < top) {
            GlRaster.clipMinY = top;
        }
        if (GlRaster.clipMaxX > right) {
            GlRaster.clipMaxX = right;
        }
        if (GlRaster.clipMaxY > bottom) {
            GlRaster.clipMaxY = bottom;
        }
        const gl = GlRenderer.gl;
        requireNonNull(gl).glEnable(GL.GL_SCISSOR_TEST);
        if (GlRaster.clipMinX > GlRaster.clipMaxX || GlRaster.clipMinY > GlRaster.clipMaxY) {
            requireNonNull(gl).glScissor(0, 0, 0, 0);
        } else {
            requireNonNull(gl).glScissor(GlRaster.clipMinX, (GlRenderer.height - GlRaster.clipMaxY) | 0, (GlRaster.clipMaxX - GlRaster.clipMinX) | 0, (GlRaster.clipMaxY - GlRaster.clipMinY) | 0);
        }
        GlRaster.clearClipMask();
    }

    // dj.d()V
    static clear(): void {
        requireNonNull(GlRenderer.gl).glClear(GL.GL_COLOR_BUFFER_BIT | GL.GL_DEPTH_BUFFER_BIT);
    }

    // dj.b(IIIII)V
    static drawLine(x0: number, y0: number, x1: number, y1: number, colour: number): void {
        GlRenderer.begin2dUntextured();
        const fx0 = Math.fround(Math.fround(x0) + Math.fround(0.3));
        const fx1 = Math.fround(Math.fround(x1) + Math.fround(0.3));
        const fy0 = Math.fround(Math.fround(GlRenderer.height) - Math.fround(Math.fround(y0) + Math.fround(0.3)));
        const fy1 = Math.fround(Math.fround(GlRenderer.height) - Math.fround(Math.fround(y1) + Math.fround(0.3)));
        const gl = GlRenderer.gl;
        requireNonNull(gl).glBegin(GL.GL_LINE_LOOP);
        requireNonNull(gl).glColor3ub(((colour >> 16) << 24) >> 24, ((colour >> 8) << 24) >> 24, (colour << 24) >> 24);
        requireNonNull(gl).glVertex2f(fx0, fy0);
        requireNonNull(gl).glVertex2f(fx1, fy1);
        requireNonNull(gl).glEnd();
    }

    // dj.c(IIIII)V
    static fillRect(x: number, y: number, width: number, height: number, colour: number): void {
        GlRenderer.begin2dUntextured();
        const x0 = Math.fround(x);
        const x1 = Math.fround(x0 + Math.fround(width));
        const y0 = Math.fround((GlRenderer.height - y) | 0);
        const y1 = Math.fround(y0 - Math.fround(height));
        const gl = GlRenderer.gl;
        requireNonNull(gl).glBegin(GL.GL_TRIANGLE_FAN);
        requireNonNull(gl).glColor3ub(((colour >> 16) << 24) >> 24, ((colour >> 8) << 24) >> 24, (colour << 24) >> 24);
        requireNonNull(gl).glVertex2f(x0, y0);
        requireNonNull(gl).glVertex2f(x0, y1);
        requireNonNull(gl).glVertex2f(x1, y1);
        requireNonNull(gl).glVertex2f(x1, y0);
        requireNonNull(gl).glEnd();
    }

    // dj.d(IIII)V. Sets the clip to the rectangle cut to the GL surface; an empty clip is a zero scissor box.
    static setClipping(left: number, top: number, right: number, bottom: number): void {
        if (left < 0) {
            left = 0;
        }
        if (top < 0) {
            top = 0;
        }
        if (right > GlRenderer.width) {
            right = GlRenderer.width;
        }
        if (bottom > GlRenderer.height) {
            bottom = GlRenderer.height;
        }
        GlRaster.clipMinX = left;
        GlRaster.clipMinY = top;
        GlRaster.clipMaxX = right;
        GlRaster.clipMaxY = bottom;
        const gl = GlRenderer.gl;
        requireNonNull(gl).glEnable(GL.GL_SCISSOR_TEST);
        if (GlRaster.clipMinX > GlRaster.clipMaxX || GlRaster.clipMinY > GlRaster.clipMaxY) {
            requireNonNull(gl).glScissor(0, 0, 0, 0);
        } else {
            requireNonNull(gl).glScissor(GlRaster.clipMinX, (GlRenderer.height - GlRaster.clipMaxY) | 0, (GlRaster.clipMaxX - GlRaster.clipMinX) | 0, (GlRaster.clipMaxY - GlRaster.clipMinY) | 0);
        }
        GlRaster.clearClipMask();
    }

    // dj.a(Lcf;)V. The mask must be exactly as tall as the clip.
    static setClipMask(mask: GlSprite | null): void {
        if (requireNonNull(mask).height !== ((GlRaster.clipMaxY - GlRaster.clipMinY) | 0)) {
            throw new Error('IllegalArgumentException');
        }
        GlRaster.mask = mask;
    }
}
