import { GL } from '#/jogl/GL';
import { doubleToInt } from '#/util/IntUtils';
import { arrayAtI32, arrayPutF32, requireNonNull } from '#/util/JavaArray';
import GlRenderer from '#/gl/GlRenderer';
import NoiseTextures from '#/gl/NoiseTextures';
import MaterialManager from './MaterialManager';
import type MaterialRenderer from './MaterialRenderer';

// ob in runescape_gl.jar (HD only): material 5, scrolling detail. Texture unit 1 adds the second noise volume (or its
// 2D slices) with world-space eye-linear S and T planes, specified under a modelview built from the camera; T scrolls
// with the cycle and the volume's R coordinate (or the slice) animates. The argument packs the parameters: bit 7
// lays the scale on world x (else z), bit 6 picks 1/1024 (else 1/2048), bits 0-1 the scroll speed (-0.01 * (n + 1))
// and bits 3-4 the animation speed (0.01 * (n + 1)).
//
// Only ob's instance members are the material. Its statics belong to other classes per membermap-hd.json (OrbitCamera,
// Minimenu, TextureOpSprite, ...), and its RuntimeException wrappers, call counters and client.mb predicates are
// obfuscator artifacts, stripped.
export default class ScrollingDetailMaterial implements MaterialRenderer {
    // ob.<init>()V stores n before its body; g has no initializer.
    private plane: Float32Array | null = new Float32Array(4); // ob.n:[F
    private listBase = 0; // ob.g:I

    // ob.c()I
    flags(): number {
        return 0;
    }

    // ob.a(I)V
    setArgument(argument: number): void {
        const gl0 = GlRenderer.gl;
        const animation = Math.fround(Math.fround((1 + ((argument >> 3) & 3)) | 0) * Math.fround(0.01));
        const scroll = Math.fround(Math.fround(-0.01) * Math.fround((1 + (argument & 3)) | 0));
        const scale = (argument & 0x40) === 0 ? Math.fround(4.8828125e-4) : Math.fround(9.765625e-4);
        const alongX = (argument & 0x80) !== 0;
        if (alongX) {
            arrayPutF32(this.plane, 0, scale);
            arrayPutF32(this.plane, 1, 0.0);
            arrayPutF32(this.plane, 2, 0.0);
            arrayPutF32(this.plane, 3, 0.0);
        } else {
            arrayPutF32(this.plane, 2, scale);
            arrayPutF32(this.plane, 1, 0.0);
            arrayPutF32(this.plane, 3, 0.0);
            arrayPutF32(this.plane, 0, 0.0);
        }
        const gl = requireNonNull(gl0);
        gl.glActiveTexture(GL.GL_TEXTURE1);
        gl.glMatrixMode(GL.GL_MODELVIEW);
        gl.glPushMatrix();
        gl.glLoadIdentity();
        gl.glRotatef(180.0, 1.0, 0.0, 0.0);
        gl.glRotatef(Math.fround(Math.fround(Math.fround(MaterialManager.cameraPitch) * 360.0) / 2048.0), 1.0, 0.0, 0.0);
        gl.glRotatef(Math.fround(Math.fround(360.0 * Math.fround(MaterialManager.cameraYaw)) / 2048.0), 0.0, 1.0, 0.0);
        gl.glTranslatef(Math.fround(-MaterialManager.cameraX | 0), Math.fround(-MaterialManager.cameraY | 0), Math.fround(-MaterialManager.cameraZ | 0));
        gl.glTexGenfv(GL.GL_S, GL.GL_EYE_PLANE, this.plane, 0);
        arrayPutF32(this.plane, 3, Math.fround(scroll * Math.fround(GlRenderer.cycle)));
        arrayPutF32(this.plane, 0, 0.0);
        arrayPutF32(this.plane, 2, 0.0);
        arrayPutF32(this.plane, 1, scale);
        gl.glTexGenfv(GL.GL_T, GL.GL_EYE_PLANE, this.plane, 0);
        gl.glPopMatrix();
        if (!NoiseTextures.texture3d) {
            const frame = doubleToInt(Math.fround(Math.fround(Math.fround(GlRenderer.cycle) * animation) * 64.0));
            gl.glBindTexture(GL.GL_TEXTURE_2D, arrayAtI32(NoiseTextures.fractalSlices, frame % 64));
        } else {
            arrayPutF32(this.plane, 3, Math.fround(Math.fround(GlRenderer.cycle) * animation));
            arrayPutF32(this.plane, 1, 0.0);
            arrayPutF32(this.plane, 0, 0.0);
            arrayPutF32(this.plane, 2, 0.0);
            gl.glTexGenfv(GL.GL_R, GL.GL_OBJECT_PLANE, this.plane, 0);
        }
        gl.glActiveTexture(GL.GL_TEXTURE0);
    }

    // ob.a()V
    unbind(): void {
        const gl = requireNonNull(GlRenderer.gl);
        gl.glCallList((1 + this.listBase) | 0);
    }

    // ob.b()V
    bind(): void {
        const gl = requireNonNull(GlRenderer.gl);
        gl.glCallList(this.listBase);
    }

    // ob.b(I)V. `count` display lists (2 at the only call): listBase binds unit 1's noise texture and the S/T
    // (and R) generation, listBase + 1 disables them.
    private compileLists(count: number): void {
        const gl = requireNonNull(GlRenderer.gl);
        this.listBase = gl.glGenLists(count);
        gl.glNewList(this.listBase, GL.GL_COMPILE);
        gl.glActiveTexture(GL.GL_TEXTURE1);
        if (!NoiseTextures.texture3d) {
            gl.glEnable(GL.GL_TEXTURE_2D);
        } else {
            gl.glBindTexture(GL.GL_TEXTURE_3D, NoiseTextures.fractalTexture);
            gl.glTexGeni(GL.GL_R, GL.GL_TEXTURE_GEN_MODE, GL.GL_OBJECT_LINEAR);
            gl.glEnable(GL.GL_TEXTURE_GEN_R);
            gl.glEnable(GL.GL_TEXTURE_3D);
        }
        gl.glTexGeni(GL.GL_S, GL.GL_TEXTURE_GEN_MODE, GL.GL_EYE_LINEAR);
        gl.glTexGeni(GL.GL_T, GL.GL_TEXTURE_GEN_MODE, GL.GL_EYE_LINEAR);
        gl.glEnable(GL.GL_TEXTURE_GEN_S);
        gl.glEnable(GL.GL_TEXTURE_GEN_T);
        gl.glActiveTexture(GL.GL_TEXTURE0);
        gl.glEndList();
        gl.glNewList((this.listBase + 1) | 0, GL.GL_COMPILE);
        gl.glActiveTexture(GL.GL_TEXTURE1);
        if (NoiseTextures.texture3d) {
            gl.glDisable(GL.GL_TEXTURE_3D);
            gl.glDisable(GL.GL_TEXTURE_GEN_R);
        } else {
            gl.glDisable(GL.GL_TEXTURE_2D);
        }
        gl.glDisable(GL.GL_TEXTURE_GEN_S);
        gl.glDisable(GL.GL_TEXTURE_GEN_T);
        gl.glActiveTexture(GL.GL_TEXTURE0);
        gl.glEndList();
    }

    // ob.<init>()V
    constructor() {
        this.compileLists(2);
    }
}
