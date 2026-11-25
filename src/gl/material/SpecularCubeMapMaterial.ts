import { GL } from '#/jogl/GL';
import Preferences from '#/ui/Preferences';
import { doubleToInt } from '#/util/IntUtils';
import { arrayAtI32, arrayPutI8, requireNonNull } from '#/util/JavaArray';
import ByteBuffer from '#/util/nio/ByteBuffer';
import GlCleaner from '#/gl/GlCleaner';
import GlRenderer from '#/gl/GlRenderer';
import type MaterialRenderer from './MaterialRenderer';

// vm in runescape_gl.jar (HD only): material 1, a specular highlight from three 64x64 GL_ALPHA cube maps (exponents
// 96, 36 and 12) on texture unit 1, addressed by GL_NORMAL_MAP texture coordinate generation on S, T and R and a
// texture matrix rotated 22.5 degrees about X. The argument (1..3) picks the cube map. With fewer than three texture
// units (twoUnits) unit 1 adds the highlight scaled by the source alpha; with three or more, unit 2 adds it on top
// of the white texture tf.z. Without GL_ARB_texture_cube_map or a second unit there are no cube maps and the lists
// only switch the alpha source. Everything is gated on high-detail lighting (od.c).
export default class SpecularCubeMapMaterial implements MaterialRenderer {
    // vm.<init>()V stores a, c and b in this order before its body.
    private listBase = -1; // vm.a:I
    private cubeMaps: Int32Array | null = null; // vm.c:[I
    private twoUnits = false; // vm.b:Z

    // vm.d()V. Two display lists: listBase binds, listBase + 1 unbinds.
    private compileLists(): void {
        const gl = requireNonNull(GlRenderer.gl);
        this.listBase = gl.glGenLists(2);
        gl.glNewList(this.listBase, GL.GL_COMPILE);
        if (this.cubeMaps !== null) {
            gl.glActiveTexture(GL.GL_TEXTURE1);
            gl.glTexGeni(GL.GL_S, GL.GL_TEXTURE_GEN_MODE, GL.GL_NORMAL_MAP);
            gl.glTexGeni(GL.GL_T, GL.GL_TEXTURE_GEN_MODE, GL.GL_NORMAL_MAP);
            gl.glTexGeni(GL.GL_R, GL.GL_TEXTURE_GEN_MODE, GL.GL_NORMAL_MAP);
            gl.glEnable(GL.GL_TEXTURE_GEN_S);
            gl.glEnable(GL.GL_TEXTURE_GEN_T);
            gl.glEnable(GL.GL_TEXTURE_GEN_R);
            gl.glEnable(GL.GL_TEXTURE_CUBE_MAP);
            gl.glMatrixMode(GL.GL_TEXTURE);
            gl.glLoadIdentity();
            gl.glRotatef(22.5, 1.0, 0.0, 0.0);
            gl.glMatrixMode(GL.GL_MODELVIEW);
            if (!this.twoUnits) {
                gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_RGB, GL.GL_REPLACE);
                gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_SOURCE0_RGB, GL.GL_PREVIOUS);
                gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_ALPHA, GL.GL_MODULATE);
                gl.glActiveTexture(GL.GL_TEXTURE2);
                gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_TEXTURE_ENV_MODE, GL.GL_COMBINE);
                gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_RGB, GL.GL_ADD);
                gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_SOURCE0_RGB, GL.GL_PREVIOUS);
                gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_SOURCE1_RGB, GL.GL_PREVIOUS);
                gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_OPERAND1_RGB, GL.GL_SRC_ALPHA);
                gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_ALPHA, GL.GL_REPLACE);
                gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_SOURCE0_ALPHA, GL.GL_PRIMARY_COLOR);
                gl.glBindTexture(GL.GL_TEXTURE_2D, GlRenderer.whiteTexture);
                gl.glEnable(GL.GL_TEXTURE_2D);
            } else {
                gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_RGB, GL.GL_ADD);
                gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_OPERAND0_RGB, GL.GL_SRC_ALPHA);
                gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_ALPHA, GL.GL_REPLACE);
                gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_SOURCE0_ALPHA, GL.GL_PRIMARY_COLOR);
            }
            gl.glActiveTexture(GL.GL_TEXTURE0);
        } else {
            gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_SOURCE0_ALPHA, GL.GL_PRIMARY_COLOR);
        }
        gl.glEndList();
        gl.glNewList((this.listBase + 1) | 0, GL.GL_COMPILE);
        if (this.cubeMaps !== null) {
            gl.glActiveTexture(GL.GL_TEXTURE1);
            gl.glDisable(GL.GL_TEXTURE_GEN_S);
            gl.glDisable(GL.GL_TEXTURE_GEN_T);
            gl.glDisable(GL.GL_TEXTURE_GEN_R);
            gl.glDisable(GL.GL_TEXTURE_CUBE_MAP);
            gl.glMatrixMode(GL.GL_TEXTURE);
            gl.glLoadIdentity();
            gl.glMatrixMode(GL.GL_MODELVIEW);
            if (!this.twoUnits) {
                gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_RGB, GL.GL_MODULATE);
                gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_SOURCE0_RGB, GL.GL_TEXTURE);
                gl.glActiveTexture(GL.GL_TEXTURE2);
                gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_TEXTURE_ENV_MODE, GL.GL_MODULATE);
                gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_RGB, GL.GL_MODULATE);
                gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_SOURCE0_RGB, GL.GL_TEXTURE);
                gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_OPERAND1_RGB, GL.GL_SRC_COLOR);
                gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_ALPHA, GL.GL_MODULATE);
                gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_SOURCE0_ALPHA, GL.GL_TEXTURE);
                gl.glDisable(GL.GL_TEXTURE_2D);
            } else {
                gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_RGB, GL.GL_MODULATE);
                gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_OPERAND0_RGB, GL.GL_SRC_COLOR);
                gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_COMBINE_ALPHA, GL.GL_MODULATE);
                gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_SOURCE0_ALPHA, GL.GL_TEXTURE);
            }
            gl.glActiveTexture(GL.GL_TEXTURE0);
        } else {
            gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_SOURCE0_ALPHA, GL.GL_TEXTURE);
        }
        gl.glEndList();
    }

    // vm.a()V
    unbind(): void {
        const gl = requireNonNull(GlRenderer.gl);
        if (Preferences.graphics.highDetailLighting) {
            gl.glCallList((this.listBase + 1) | 0);
        } else {
            gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_SOURCE0_ALPHA, GL.GL_TEXTURE);
        }
    }

    // vm.c()I
    flags(): number {
        return 4;
    }

    // vm.b()V
    bind(): void {
        const gl0 = GlRenderer.gl;
        GlRenderer.setTextureCombineAlpha(1);
        const gl = requireNonNull(gl0);
        if (Preferences.graphics.highDetailLighting) {
            gl.glCallList(this.listBase);
        } else {
            gl.glTexEnvi(GL.GL_TEXTURE_ENV, GL.GL_SOURCE0_ALPHA, GL.GL_PRIMARY_COLOR);
        }
    }

    // vm.a(I)V
    setArgument(argument: number): void {
        const gl0 = GlRenderer.gl;
        if (Preferences.graphics.highDetailLighting && this.cubeMaps !== null) {
            const gl = requireNonNull(gl0);
            gl.glActiveTexture(GL.GL_TEXTURE1);
            gl.glBindTexture(GL.GL_TEXTURE_CUBE_MAP, arrayAtI32(this.cubeMaps, (argument - 1) | 0));
            gl.glActiveTexture(GL.GL_TEXTURE0);
        }
    }

    // vm.e()V. Builds the six faces of the three cube maps. Each texel holds pow(d, e) * 255 (e = 96, 36, 12),
    // divided by 5 with fewer than three texture units and by 2 otherwise, where d is the face-axis component of
    // the normalised direction through the texel.
    private buildCubeMaps(): void {
        const gl0 = GlRenderer.gl;
        if (this.cubeMaps === null) {
            this.cubeMaps = new Int32Array(3);
            requireNonNull(gl0).glGenTextures(3, this.cubeMaps, 0);
        }
        const size = 4096;
        const exponent12 = new Int8Array(size);
        const exponent96 = new Int8Array(size);
        const exponent36 = new Int8Array(size);
        for (let face = 0; face < 6; face++) {
            let texel = 0;
            for (let y = 0; y < 64; y++) {
                for (let x = 0; x < 64; x++) {
                    let u = Math.fround(Math.fround(Math.fround(2.0 * x) / 64.0) - 1.0);
                    let v = Math.fround(Math.fround(Math.fround(2.0 * y) / 64.0) - 1.0);
                    const length = Math.fround(1.0 / Math.sqrt(Math.fround(Math.fround(Math.fround(u * u) + 1.0) + Math.fround(v * v))));
                    u = Math.fround(u * length);
                    v = Math.fround(v * length);
                    let component: number;
                    if (face === 0) {
                        component = -u;
                    } else if (face === 1) {
                        component = u;
                    } else if (face === 2) {
                        component = v;
                    } else if (face === 3) {
                        component = -v;
                    } else if (face === 4) {
                        component = length;
                    } else {
                        component = -length;
                    }
                    let highlight96: number;
                    let highlight36: number;
                    let highlight12: number;
                    if (component > 0.0) {
                        highlight96 = doubleToInt(Math.pow(component, 96.0) * 255.0);
                        highlight36 = doubleToInt(Math.pow(component, 36.0) * 255.0);
                        highlight12 = doubleToInt(Math.pow(component, 12.0) * 255.0);
                    } else {
                        highlight12 = 0;
                        highlight36 = 0;
                        highlight96 = 0;
                    }
                    if (GlRenderer.maxTextureUnits < 3) {
                        highlight96 = (highlight96 / 5) | 0;
                        highlight36 = (highlight36 / 5) | 0;
                        highlight12 = (highlight12 / 5) | 0;
                    } else {
                        highlight96 = (highlight96 / 2) | 0;
                        highlight36 = (highlight36 / 2) | 0;
                        highlight12 = (highlight12 / 2) | 0;
                    }
                    arrayPutI8(exponent96, texel, highlight96);
                    arrayPutI8(exponent36, texel, highlight36);
                    arrayPutI8(exponent12, texel, highlight12);
                    texel++;
                }
            }
            const gl = requireNonNull(gl0);
            gl.glBindTexture(GL.GL_TEXTURE_CUBE_MAP, arrayAtI32(this.cubeMaps, 0));
            gl.glTexImage2D((GL.GL_TEXTURE_CUBE_MAP_POSITIVE_X + face) | 0, 0, GL.GL_ALPHA, 64, 64, 0, GL.GL_ALPHA, GL.GL_UNSIGNED_BYTE, ByteBuffer.wrap(exponent96));
            gl.glBindTexture(GL.GL_TEXTURE_CUBE_MAP, arrayAtI32(this.cubeMaps, 1));
            gl.glTexImage2D((GL.GL_TEXTURE_CUBE_MAP_POSITIVE_X + face) | 0, 0, GL.GL_ALPHA, 64, 64, 0, GL.GL_ALPHA, GL.GL_UNSIGNED_BYTE, ByteBuffer.wrap(exponent36));
            gl.glBindTexture(GL.GL_TEXTURE_CUBE_MAP, arrayAtI32(this.cubeMaps, 2));
            gl.glTexImage2D((GL.GL_TEXTURE_CUBE_MAP_POSITIVE_X + face) | 0, 0, GL.GL_ALPHA, 64, 64, 0, GL.GL_ALPHA, GL.GL_UNSIGNED_BYTE, ByteBuffer.wrap(exponent12));
            GlCleaner.textureMemory = (GlCleaner.textureMemory + Math.imul(size, 3)) | 0;
        }
    }

    // vm.<init>()V
    constructor() {
        if (GlRenderer.cubeMapSupported && GlRenderer.maxTextureUnits >= 2) {
            this.buildCubeMaps();
            const gl = requireNonNull(GlRenderer.gl);
            gl.glBindTexture(GL.GL_TEXTURE_CUBE_MAP, arrayAtI32(this.cubeMaps, 0));
            gl.glTexParameteri(GL.GL_TEXTURE_CUBE_MAP, GL.GL_TEXTURE_MIN_FILTER, GL.GL_LINEAR);
            gl.glTexParameteri(GL.GL_TEXTURE_CUBE_MAP, GL.GL_TEXTURE_MAG_FILTER, GL.GL_LINEAR);
            gl.glTexParameteri(GL.GL_TEXTURE_CUBE_MAP, GL.GL_TEXTURE_WRAP_R, GL.GL_CLAMP_TO_EDGE);
            gl.glTexParameteri(GL.GL_TEXTURE_CUBE_MAP, GL.GL_TEXTURE_WRAP_S, GL.GL_CLAMP_TO_EDGE);
            gl.glTexParameteri(GL.GL_TEXTURE_CUBE_MAP, GL.GL_TEXTURE_WRAP_T, GL.GL_CLAMP_TO_EDGE);
            gl.glBindTexture(GL.GL_TEXTURE_CUBE_MAP, arrayAtI32(this.cubeMaps, 1));
            gl.glTexParameteri(GL.GL_TEXTURE_CUBE_MAP, GL.GL_TEXTURE_MIN_FILTER, GL.GL_LINEAR);
            gl.glTexParameteri(GL.GL_TEXTURE_CUBE_MAP, GL.GL_TEXTURE_MAG_FILTER, GL.GL_LINEAR);
            gl.glTexParameteri(GL.GL_TEXTURE_CUBE_MAP, GL.GL_TEXTURE_WRAP_R, GL.GL_CLAMP_TO_EDGE);
            gl.glTexParameteri(GL.GL_TEXTURE_CUBE_MAP, GL.GL_TEXTURE_WRAP_S, GL.GL_CLAMP_TO_EDGE);
            gl.glTexParameteri(GL.GL_TEXTURE_CUBE_MAP, GL.GL_TEXTURE_WRAP_T, GL.GL_CLAMP_TO_EDGE);
            gl.glBindTexture(GL.GL_TEXTURE_CUBE_MAP, arrayAtI32(this.cubeMaps, 2));
            gl.glTexParameteri(GL.GL_TEXTURE_CUBE_MAP, GL.GL_TEXTURE_MIN_FILTER, GL.GL_LINEAR);
            gl.glTexParameteri(GL.GL_TEXTURE_CUBE_MAP, GL.GL_TEXTURE_MAG_FILTER, GL.GL_LINEAR);
            gl.glTexParameteri(GL.GL_TEXTURE_CUBE_MAP, GL.GL_TEXTURE_WRAP_R, GL.GL_CLAMP_TO_EDGE);
            gl.glTexParameteri(GL.GL_TEXTURE_CUBE_MAP, GL.GL_TEXTURE_WRAP_S, GL.GL_CLAMP_TO_EDGE);
            gl.glTexParameteri(GL.GL_TEXTURE_CUBE_MAP, GL.GL_TEXTURE_WRAP_T, GL.GL_CLAMP_TO_EDGE);
            this.twoUnits = GlRenderer.maxTextureUnits < 3;
        }
        this.compileLists();
    }
}
