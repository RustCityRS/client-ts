import { GL } from '#/jogl/GL';
import { arrayAtI32, arrayPutF32, arrayPutI8, requireNonNull } from '#/util/JavaArray';
import ByteBuffer from '#/util/nio/ByteBuffer';
import GlRenderer from '#/gl/GlRenderer';
import NoiseTextures from '#/gl/NoiseTextures';
import MaterialManager from './MaterialManager';
import type MaterialRenderer from './MaterialRenderer';

// wg in runescape_gl.jar (HD only): material 3, the underwater pass. With three or more texture units and 3D
// textures (threeUnits), unit 1 adds caustics from the 3D noise volume, addressed by eye-linear S/T/R planes in world
// space (R scrolls with the cycle) and an object-linear Q of 1. The last unit (2, else 1) fades towards the underwater
// fog colour through an 8-texel GL_ALPHA ramp addressed by an eye-linear S plane on world height: the argument is the
// surface height and MaterialManager.underwaterDepth (nh.Z) the depth scale; a negative argument switches the ramp
// off. The world-space planes are specified under a modelview built from the camera (MaterialManager camera statics).
export default class UnderwaterMaterial implements MaterialRenderer {
    // wg.b:Z. wg.<clinit>()V stores false; the constructor sets it to (tf.e > 2 && tf.r).
    private static threeUnits = false;

    // wg.<init>()V stores c, a and d in this order before its body.
    private rampTexture = -1; // wg.c:I
    private plane: Float32Array | null = new Float32Array(4); // wg.a:[F
    private listBase = -1; // wg.d:I

    // wg.d()V. Two display lists: listBase binds, listBase + 1 restores the defaults.
    private compileLists(): void {
        const gl = requireNonNull(GlRenderer.gl);
        this.listBase = gl.glGenLists(2);
        gl.glNewList(this.listBase, GL.GL_COMPILE);
        gl.glActiveTexture(GL.GL_TEXTURE1);
        if (UnderwaterMaterial.threeUnits) {
            gl.glBindTexture(GL.GL_TEXTURE_3D, NoiseTextures.ridgedTexture);
            gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_RGB, GL.GL_ADD);
            gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_OPERAND0_RGB, GL.GL_SRC_COLOR);
            gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_ALPHA, GL.GL_REPLACE);
            gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_SOURCE0_ALPHA, GL.GL_PREVIOUS);
            gl.glTexGeni(GL.GL_S, GL.GL_TEXTURE_GEN_MODE, GL.GL_EYE_LINEAR);
            gl.glTexGeni(GL.GL_R, GL.GL_TEXTURE_GEN_MODE, GL.GL_EYE_LINEAR);
            gl.glTexGeni(GL.GL_T, GL.GL_TEXTURE_GEN_MODE, GL.GL_EYE_LINEAR);
            gl.glTexGeni(GL.GL_Q, GL.GL_TEXTURE_GEN_MODE, GL.GL_OBJECT_LINEAR);
            gl.glTexGenfv(GL.GL_Q, GL.GL_OBJECT_PLANE, new Float32Array([0.0, 0.0, 0.0, 1.0]), 0);
            gl.glEnable(GL.GL_TEXTURE_GEN_S);
            gl.glEnable(GL.GL_TEXTURE_GEN_T);
            gl.glEnable(GL.GL_TEXTURE_GEN_R);
            gl.glEnable(GL.GL_TEXTURE_GEN_Q);
            gl.glEnable(GL.GL_TEXTURE_3D);
            gl.glActiveTexture(GL.GL_TEXTURE2);
            gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_TEXTURE_ENV_MODE, GL.GL_COMBINE);
        }
        gl.glBindTexture(GL.GL_TEXTURE_1D, this.rampTexture);
        gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_RGB, GL.GL_INTERPOLATE);
        gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_SOURCE0_RGB, GL.GL_CONSTANT);
        gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_SOURCE2_RGB, GL.GL_TEXTURE);
        gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_ALPHA, GL.GL_REPLACE);
        gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_SOURCE0_ALPHA, GL.GL_PREVIOUS);
        gl.glTexGeni(GL.GL_S, GL.GL_TEXTURE_GEN_MODE, GL.GL_EYE_LINEAR);
        gl.glEnable(GL.GL_TEXTURE_1D);
        gl.glEnable(GL.GL_TEXTURE_GEN_S);
        gl.glActiveTexture(GL.GL_TEXTURE0);
        gl.glEndList();
        gl.glNewList((this.listBase + 1) | 0, GL.GL_COMPILE);
        gl.glActiveTexture(GL.GL_TEXTURE1);
        if (UnderwaterMaterial.threeUnits) {
            gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_RGB, GL.GL_MODULATE);
            gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_OPERAND0_RGB, GL.GL_SRC_COLOR);
            gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_ALPHA, GL.GL_MODULATE);
            gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_SOURCE0_ALPHA, GL.GL_TEXTURE);
            gl.glDisable(GL.GL_TEXTURE_GEN_S);
            gl.glDisable(GL.GL_TEXTURE_GEN_T);
            gl.glDisable(GL.GL_TEXTURE_GEN_R);
            gl.glDisable(GL.GL_TEXTURE_GEN_Q);
            gl.glDisable(GL.GL_TEXTURE_3D);
            gl.glActiveTexture(GL.GL_TEXTURE2);
            gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_TEXTURE_ENV_MODE, GL.GL_MODULATE);
        }
        gl.glTexEnvfv(GL.GL_TEXTURE_ENV, GL.GL_TEXTURE_ENV_COLOR, new Float32Array([0.0, 1.0, 0.0, 1.0]), 0);
        gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_RGB, GL.GL_MODULATE);
        gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_SOURCE0_RGB, GL.GL_TEXTURE);
        gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_SOURCE2_RGB, GL.GL_CONSTANT);
        gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_ALPHA, GL.GL_MODULATE);
        gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_SOURCE0_ALPHA, GL.GL_TEXTURE);
        gl.glDisable(GL.GL_TEXTURE_1D);
        gl.glDisable(GL.GL_TEXTURE_GEN_S);
        gl.glActiveTexture(GL.GL_TEXTURE0);
        gl.glEndList();
    }

    // wg.e()I. The texture unit that carries the fog ramp.
    static rampUnit(): number {
        return UnderwaterMaterial.threeUnits ? GL.GL_TEXTURE2 : GL.GL_TEXTURE1;
    }

    // wg.f()V
    static disableRampCoordArray(): void {
        const gl = requireNonNull(GlRenderer.gl);
        gl.glClientActiveTexture(UnderwaterMaterial.rampUnit());
        gl.glDisableClientState(GL.GL_TEXTURE_COORD_ARRAY);
        gl.glClientActiveTexture(GL.GL_TEXTURE0);
    }

    // wg.b()V
    bind(): void {
        const gl = requireNonNull(GlRenderer.gl);
        gl.glCallList(this.listBase);
    }

    // wg.g()V
    static enableRampCoordArray(): void {
        const gl = requireNonNull(GlRenderer.gl);
        gl.glClientActiveTexture(UnderwaterMaterial.rampUnit());
        gl.glEnableClientState(GL.GL_TEXTURE_COORD_ARRAY);
        gl.glClientActiveTexture(GL.GL_TEXTURE0);
    }

    // wg.c()I
    flags(): number {
        return 0;
    }

    // wg.a()V
    unbind(): void {
        const gl = requireNonNull(GlRenderer.gl);
        gl.glCallList((this.listBase + 1) | 0);
    }

    // wg.a(I)V
    setArgument(argument: number): void {
        const gl = requireNonNull(GlRenderer.gl);
        gl.glActiveTexture(GL.GL_TEXTURE1);
        if (UnderwaterMaterial.threeUnits || argument >= 0) {
            gl.glPushMatrix();
            gl.glLoadIdentity();
            gl.glRotatef(180.0, 1.0, 0.0, 0.0);
            gl.glRotatef(Math.fround(Math.fround(Math.fround(MaterialManager.cameraPitch) * 360.0) / 2048.0), 1.0, 0.0, 0.0);
            gl.glRotatef(Math.fround(Math.fround(Math.fround(MaterialManager.cameraYaw) * 360.0) / 2048.0), 0.0, 1.0, 0.0);
            gl.glTranslatef(Math.fround(-MaterialManager.cameraX | 0), Math.fround(-MaterialManager.cameraY | 0), Math.fround(-MaterialManager.cameraZ | 0));
            if (UnderwaterMaterial.threeUnits) {
                arrayPutF32(this.plane, 0, Math.fround(0.001));
                arrayPutF32(this.plane, 1, Math.fround(9.0e-4));
                arrayPutF32(this.plane, 2, 0.0);
                arrayPutF32(this.plane, 3, 0.0);
                gl.glTexGenfv(GL.GL_S, GL.GL_EYE_PLANE, this.plane, 0);
                arrayPutF32(this.plane, 0, 0.0);
                arrayPutF32(this.plane, 1, Math.fround(9.0e-4));
                arrayPutF32(this.plane, 2, Math.fround(0.001));
                arrayPutF32(this.plane, 3, 0.0);
                gl.glTexGenfv(GL.GL_T, GL.GL_EYE_PLANE, this.plane, 0);
                arrayPutF32(this.plane, 0, 0.0);
                arrayPutF32(this.plane, 1, 0.0);
                arrayPutF32(this.plane, 2, 0.0);
                arrayPutF32(this.plane, 3, Math.fround(Math.fround(GlRenderer.cycle) * Math.fround(0.005)));
                gl.glTexGenfv(GL.GL_R, GL.GL_EYE_PLANE, this.plane, 0);
                gl.glActiveTexture(GL.GL_TEXTURE2);
            }
            gl.glTexEnvfv(GL.GL_TEXTURE_ENV, GL.GL_TEXTURE_ENV_COLOR, MaterialManager.underwaterFogColour(), 0);
            if (argument >= 0) {
                arrayPutF32(this.plane, 0, 0.0);
                arrayPutF32(this.plane, 1, Math.fround(1.0 / Math.fround(MaterialManager.underwaterDepth)));
                arrayPutF32(this.plane, 2, 0.0);
                arrayPutF32(this.plane, 3, Math.fround(Math.fround(1.0 * Math.fround(argument)) / Math.fround(MaterialManager.underwaterDepth)));
                gl.glTexGenfv(GL.GL_S, GL.GL_EYE_PLANE, this.plane, 0);
                gl.glEnable(GL.GL_TEXTURE_GEN_S);
            } else {
                gl.glDisable(GL.GL_TEXTURE_GEN_S);
            }
            gl.glPopMatrix();
        } else {
            gl.glDisable(GL.GL_TEXTURE_GEN_S);
        }
        gl.glActiveTexture(GL.GL_TEXTURE0);
    }

    // wg.<init>()V. The ramp texels are 96 + (i + 1) * 159 / 8 for i < 8 (115 .. 255), linear and clamped.
    constructor() {
        if (GlRenderer.maxTextureUnits >= 2) {
            const textures = new Int32Array(1);
            const ramp = new Int8Array(8);
            let i = 0;
            while (i < 8) {
                const index = i++;
                arrayPutI8(ramp, index, (96 + ((Math.imul(i, 159) / 8) | 0)) | 0);
            }
            const gl = requireNonNull(GlRenderer.gl);
            gl.glGenTextures(1, textures, 0);
            gl.glBindTexture(GL.GL_TEXTURE_1D, arrayAtI32(textures, 0));
            gl.glTexImage1D(GL.GL_TEXTURE_1D, 0, GL.GL_ALPHA, 8, 0, GL.GL_ALPHA, GL.GL_UNSIGNED_BYTE, ByteBuffer.wrap(ramp));
            gl.glTexParameteri(GL.GL_TEXTURE_1D, GL.GL_TEXTURE_MIN_FILTER, GL.GL_LINEAR);
            gl.glTexParameteri(GL.GL_TEXTURE_1D, GL.GL_TEXTURE_MAG_FILTER, GL.GL_LINEAR);
            gl.glTexParameteri(GL.GL_TEXTURE_1D, GL.GL_TEXTURE_WRAP_S, GL.GL_CLAMP_TO_EDGE);
            this.rampTexture = arrayAtI32(textures, 0);
            UnderwaterMaterial.threeUnits = GlRenderer.maxTextureUnits > 2 && GlRenderer.texture3d;
            this.compileLists();
        }
    }
}
