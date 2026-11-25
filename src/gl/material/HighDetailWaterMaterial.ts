import { GL } from '#/jogl/GL';
import { arrayAtI32, arrayPutF32, requireNonNull } from '#/util/JavaArray';
import ByteBuffer from '#/util/nio/ByteBuffer';
import GlRenderer from '#/gl/GlRenderer';
import NoiseTextures from '#/gl/NoiseTextures';
import MaterialManager from './MaterialManager';
import type MaterialRenderer from './MaterialRenderer';

// pd in runescape_gl.jar (HD only): material 4, high-detail water. Unit 0 doubles the texture (RGB_SCALE 2) with
// world-space texture coordinates (object-linear S and T, 1/1024) and adds the noise: the volume's R coordinate
// scrolls with the cycle when 3D noise textures exist, otherwise the argument's bit 0 animates the 2D noise slices.
// Unit 1 fades towards the underwater colour (v.c) through a two-texel GL_ALPHA ramp addressed by an eye-linear S
// plane that bind() derives from the camera pitch. MaterialManager.setMaterial routes material 4 to material 2 when
// high water detail (rm.g) is off.
export default class HighDetailWaterMaterial implements MaterialRenderer {
    // pd.b:[F. The texture environment colour bind() restores on unit 0. pd.<clinit>()V.
    static environmentColour: Float32Array | null = new Float32Array([0.1, 0.1, 0.15, 0.1]);

    // pd.<init>()V stores a, c, d and e in this order before its body.
    private listBase = -1; // pd.a:I
    private plane: Float32Array | null = new Float32Array(4); // pd.c:[F
    private rampTexture = -1; // pd.d:I
    private planeCycle = -1; // pd.e:I

    // pd.d()V. A two-texel GL_ALPHA 1D ramp (0, 255), linear and clamped.
    private createRamp(): void {
        const ramp = new Int8Array([0, -1]);
        const gl = requireNonNull(GlRenderer.gl);
        const textures = new Int32Array(1);
        gl.glGenTextures(1, textures, 0);
        gl.glBindTexture(GL.GL_TEXTURE_1D, arrayAtI32(textures, 0));
        gl.glTexImage1D(GL.GL_TEXTURE_1D, 0, GL.GL_ALPHA, 2, 0, GL.GL_ALPHA, GL.GL_UNSIGNED_BYTE, ByteBuffer.wrap(ramp));
        gl.glTexParameteri(GL.GL_TEXTURE_1D, GL.GL_TEXTURE_MIN_FILTER, GL.GL_LINEAR);
        gl.glTexParameteri(GL.GL_TEXTURE_1D, GL.GL_TEXTURE_MAG_FILTER, GL.GL_LINEAR);
        gl.glTexParameteri(GL.GL_TEXTURE_1D, GL.GL_TEXTURE_WRAP_S, GL.GL_CLAMP_TO_EDGE);
        this.rampTexture = arrayAtI32(textures, 0);
    }

    // pd.e()V
    static unload(): void {
        HighDetailWaterMaterial.environmentColour = null;
    }

    // pd.f()V. Two display lists: listBase sets up both units and leaves unit 1 active with a pushed, identity
    // matrix for bind()'s eye plane; listBase + 1 restores the defaults.
    private compileLists(): void {
        const gl = requireNonNull(GlRenderer.gl);
        this.listBase = gl.glGenLists(2);
        gl.glNewList(this.listBase, GL.GL_COMPILE);
        gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_OPERAND0_RGB, GL.GL_SRC_COLOR);
        gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_SOURCE1_RGB, GL.GL_CONSTANT);
        gl.glTexEnvf(GL.GL_TEXTURE_ENV, GL.GL_RGB_SCALE, 2.0);
        gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_SOURCE1_ALPHA, GL.GL_CONSTANT);
        gl.glTexGeni(GL.GL_S, GL.GL_TEXTURE_GEN_MODE, GL.GL_OBJECT_LINEAR);
        gl.glTexGeni(GL.GL_T, GL.GL_TEXTURE_GEN_MODE, GL.GL_OBJECT_LINEAR);
        gl.glTexGenfv(GL.GL_S, GL.GL_OBJECT_PLANE, new Float32Array([9.765625e-4, 0.0, 0.0, 0.0]), 0);
        gl.glTexGenfv(GL.GL_T, GL.GL_OBJECT_PLANE, new Float32Array([0.0, 0.0, 9.765625e-4, 0.0]), 0);
        gl.glEnable(GL.GL_TEXTURE_GEN_S);
        gl.glEnable(GL.GL_TEXTURE_GEN_T);
        if (NoiseTextures.texture3d) {
            gl.glBindTexture(GL.GL_TEXTURE_3D, NoiseTextures.ridgedTexture);
            gl.glTexGeni(GL.GL_R, GL.GL_TEXTURE_GEN_MODE, GL.GL_OBJECT_LINEAR);
            gl.glTexGeni(GL.GL_Q, GL.GL_TEXTURE_GEN_MODE, GL.GL_OBJECT_LINEAR);
            gl.glTexGenfv(GL.GL_Q, GL.GL_OBJECT_PLANE, new Float32Array([0.0, 0.0, 0.0, 1.0]), 0);
            gl.glEnable(GL.GL_TEXTURE_GEN_R);
            gl.glEnable(GL.GL_TEXTURE_GEN_Q);
            gl.glEnable(GL.GL_TEXTURE_3D);
        }
        gl.glActiveTexture(GL.GL_TEXTURE1);
        gl.glEnable(GL.GL_TEXTURE_1D);
        gl.glBindTexture(GL.GL_TEXTURE_1D, this.rampTexture);
        gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_RGB, GL.GL_INTERPOLATE);
        gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_SOURCE0_RGB, GL.GL_CONSTANT);
        gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_SOURCE2_RGB, GL.GL_TEXTURE);
        gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_ALPHA, GL.GL_INTERPOLATE);
        gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_SOURCE0_ALPHA, GL.GL_CONSTANT);
        gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_SOURCE2_ALPHA, GL.GL_TEXTURE);
        gl.glEnable(GL.GL_TEXTURE_GEN_S);
        gl.glTexGeni(GL.GL_S, GL.GL_TEXTURE_GEN_MODE, GL.GL_EYE_LINEAR);
        gl.glPushMatrix();
        gl.glLoadIdentity();
        gl.glEndList();
        gl.glNewList((this.listBase + 1) | 0, GL.GL_COMPILE);
        gl.glActiveTexture(GL.GL_TEXTURE1);
        gl.glDisable(GL.GL_TEXTURE_1D);
        gl.glDisable(GL.GL_TEXTURE_GEN_S);
        gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_RGB, GL.GL_MODULATE);
        gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_SOURCE0_RGB, GL.GL_TEXTURE);
        gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_SOURCE2_RGB, GL.GL_CONSTANT);
        gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_ALPHA, GL.GL_MODULATE);
        gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_SOURCE0_ALPHA, GL.GL_TEXTURE);
        gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_SOURCE2_ALPHA, GL.GL_CONSTANT);
        gl.glActiveTexture(GL.GL_TEXTURE0);
        gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_OPERAND0_RGB, GL.GL_SRC_COLOR);
        gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_SOURCE1_RGB, GL.GL_PREVIOUS);
        gl.glTexEnvf(GL.GL_TEXTURE_ENV, GL.GL_RGB_SCALE, 1.0);
        gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_SOURCE1_ALPHA, GL.GL_PREVIOUS);
        gl.glDisable(GL.GL_TEXTURE_GEN_S);
        gl.glDisable(GL.GL_TEXTURE_GEN_T);
        if (NoiseTextures.texture3d) {
            gl.glDisable(GL.GL_TEXTURE_GEN_R);
            gl.glDisable(GL.GL_TEXTURE_GEN_Q);
            gl.glDisable(GL.GL_TEXTURE_3D);
        }
        gl.glEndList();
    }

    // pd.a()V
    unbind(): void {
        requireNonNull(GlRenderer.gl).glCallList((this.listBase + 1) | 0);
    }

    // pd.a(I)V
    setArgument(argument: number): void {
        const gl = requireNonNull(GlRenderer.gl);
        gl.glActiveTexture(GL.GL_TEXTURE1);
        gl.glTexEnvfv(GL.GL_TEXTURE_ENV, GL.GL_TEXTURE_ENV_COLOR, MaterialManager.underwaterColour, 0);
        gl.glActiveTexture(GL.GL_TEXTURE0);
        if ((argument & 1) === 1) {
            if (NoiseTextures.texture3d) {
                if (this.planeCycle !== GlRenderer.cycle) {
                    arrayPutF32(this.plane, 0, 0.0);
                    arrayPutF32(this.plane, 1, 0.0);
                    arrayPutF32(this.plane, 2, 0.0);
                    arrayPutF32(this.plane, 3, Math.fround(Math.fround(GlRenderer.cycle) * Math.fround(0.005)));
                    gl.glTexGenfv(GL.GL_R, GL.GL_OBJECT_PLANE, this.plane, 0);
                    this.planeCycle = GlRenderer.cycle;
                }
            } else {
                GlRenderer.bindTexture2D(arrayAtI32(NoiseTextures.ridgedSlices, ((Math.imul(GlRenderer.cycle, 64) / 100) | 0) % 64));
            }
        } else if (NoiseTextures.texture3d) {
            arrayPutF32(this.plane, 0, 0.0);
            arrayPutF32(this.plane, 1, 0.0);
            arrayPutF32(this.plane, 2, 0.0);
            arrayPutF32(this.plane, 3, 0.0);
            gl.glTexGenfv(GL.GL_R, GL.GL_OBJECT_PLANE, this.plane, 0);
        } else {
            GlRenderer.bindTexture2D(arrayAtI32(NoiseTextures.ridgedSlices, 0));
        }
    }

    // pd.b()V. The ramp plane maps eye-space z to s = (z + d) / (d - 3328), d = 2662.4 + (pitch - 128) / 2 capped
    // at 3327.
    bind(): void {
        const gl0 = GlRenderer.gl;
        GlRenderer.setTextureCombineRgb(2);
        GlRenderer.setTextureCombineAlpha(2);
        GlRenderer.resetTextureMatrix();
        const gl = requireNonNull(gl0);
        gl.glCallList(this.listBase);
        const fogEnd = GlRenderer.sceneFar - 256;
        let distance = Math.fround(2662.4001 + (fogEnd - 3328));
        distance = Math.fround(distance + Math.fround(Math.fround((MaterialManager.cameraPitch - 128) | 0) * 0.5));
        if (distance >= fogEnd) {
            distance = fogEnd - 1;
        }
        arrayPutF32(this.plane, 0, 0.0);
        arrayPutF32(this.plane, 1, 0.0);
        arrayPutF32(this.plane, 2, Math.fround(1.0 / Math.fround(distance - fogEnd)));
        arrayPutF32(this.plane, 3, Math.fround(distance / Math.fround(distance - fogEnd)));
        gl.glTexGenfv(GL.GL_S, GL.GL_EYE_PLANE, this.plane, 0);
        gl.glPopMatrix();
        gl.glActiveTexture(GL.GL_TEXTURE0);
        gl.glTexEnvfv(GL.GL_TEXTURE_ENV, GL.GL_TEXTURE_ENV_COLOR, HighDetailWaterMaterial.environmentColour, 0);
    }

    // pd.c()I
    flags(): number {
        return 15;
    }

    // pd.<init>()V
    constructor() {
        this.createRamp();
        this.compileLists();
    }
}
