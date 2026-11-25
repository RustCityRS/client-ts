import { GL } from '#/jogl/GL';
import { arrayAtI32, requireNonNull } from '#/util/JavaArray';
import ByteBuffer from '#/util/nio/ByteBuffer';
import GlCleaner from './GlCleaner';
import GlRenderer from './GlRenderer';
import FractalNoiseVolume from '#/gl/noise/FractalNoiseVolume';
import RidgedNoiseVolume from '#/gl/noise/RidgedNoiseVolume';

// lm in runescape_gl.jar (HD only): the two 64x64x64 LUMINANCE_ALPHA noise volumes the HD materials sample. Load
// stage 150 (client.i(I)V) builds both through buildVolumes (lm.a()V). createTextures (lm.c()V, the first call of
// te.e(I)V at context creation) uploads each one as a 3D texture when GL_EXT_texture3D is usable (tf.r), otherwise as
// 64 2D slices, all LINEAR. The ridged volume (RidgedNoiseVolume, ng) feeds the water materials (rd, wg, pd), the
// fractal volume (FractalNoiseVolume, sb) the scrolling detail material (ob). deleteTextures (lm.b()V) releases the
// textures at teardown (nj.a(I)V) and unload (lm.d()V) drops the statics at shutdown. NXT has no GL 1.x classes, so
// the names are descriptive (HD_PLAN.md 1.3).
export default class NoiseTextures {
    // lm.<clinit>()V stores a, b, g and f in this order; c, d and e keep their JVM defaults.
    static fractalSlices: Int32Array | null = null; // lm.a:[I
    static ridgedSlices: Int32Array | null = null; // lm.b:[I
    static fractalTexture = -1; // lm.g:I
    static ridgedTexture = -1; // lm.f:I
    private static fractalVolume: ByteBuffer | null = null; // lm.c:Ljava/nio/ByteBuffer;
    private static ridgedVolume: ByteBuffer | null = null; // lm.d:Ljava/nio/ByteBuffer;
    static texture3d = false; // lm.e:Z

    // lm.a()V
    static buildVolumes(): void {
        if (NoiseTextures.ridgedVolume === null) {
            const generator = new RidgedNoiseVolume();
            const bytes = generator.build(64, 64, 64);
            NoiseTextures.ridgedVolume = ByteBuffer.allocateDirect(requireNonNull(bytes).length);
            NoiseTextures.ridgedVolume.position(0);
            NoiseTextures.ridgedVolume.put(bytes);
            NoiseTextures.ridgedVolume.flip();
        }
        if (NoiseTextures.fractalVolume === null) {
            const generator = new FractalNoiseVolume();
            const bytes = generator.build(64, 64, 64);
            NoiseTextures.fractalVolume = ByteBuffer.allocateDirect(requireNonNull(bytes).length);
            NoiseTextures.fractalVolume.position(0);
            NoiseTextures.fractalVolume.put(bytes);
            NoiseTextures.fractalVolume.flip();
        }
    }

    // lm.b()V
    static deleteTextures(): void {
        if (NoiseTextures.ridgedTexture !== -1) {
            const gl = GlRenderer.gl;
            const names = Int32Array.of(NoiseTextures.ridgedTexture);
            requireNonNull(gl).glDeleteTextures(1, names, 0);
            NoiseTextures.ridgedTexture = -1;
            GlCleaner.textureMemory = (GlCleaner.textureMemory - Math.imul(requireNonNull(NoiseTextures.ridgedVolume).limit(), 2)) | 0;
        }
        if (NoiseTextures.ridgedSlices !== null) {
            const gl = GlRenderer.gl;
            requireNonNull(gl).glDeleteTextures(64, NoiseTextures.ridgedSlices, 0);
            NoiseTextures.ridgedSlices = null;
            GlCleaner.textureMemory = (GlCleaner.textureMemory - Math.imul(requireNonNull(NoiseTextures.ridgedVolume).limit(), 2)) | 0;
        }
        if (NoiseTextures.fractalTexture !== -1) {
            const gl = GlRenderer.gl;
            const names = Int32Array.of(NoiseTextures.fractalTexture);
            requireNonNull(gl).glDeleteTextures(1, names, 0);
            NoiseTextures.fractalTexture = -1;
            GlCleaner.textureMemory = (GlCleaner.textureMemory - Math.imul(requireNonNull(NoiseTextures.fractalVolume).limit(), 2)) | 0;
        }
        if (NoiseTextures.fractalSlices !== null) {
            const gl = GlRenderer.gl;
            requireNonNull(gl).glDeleteTextures(64, NoiseTextures.fractalSlices, 0);
            NoiseTextures.fractalSlices = null;
            GlCleaner.textureMemory = (GlCleaner.textureMemory - Math.imul(requireNonNull(NoiseTextures.fractalVolume).limit(), 2)) | 0;
        }
    }

    // lm.c()V
    static createTextures(): void {
        NoiseTextures.texture3d = GlRenderer.texture3d;
        NoiseTextures.buildVolumes();
        NoiseTextures.uploadRidged();
        NoiseTextures.uploadFractal();
    }

    // lm.d()V
    static unload(): void {
        NoiseTextures.ridgedSlices = null;
        NoiseTextures.fractalSlices = null;
        NoiseTextures.ridgedVolume = null;
        NoiseTextures.fractalVolume = null;
    }

    // lm.e()V
    private static uploadRidged(): void {
        const gl = GlRenderer.gl;
        if (NoiseTextures.texture3d) {
            const names = new Int32Array(1);
            requireNonNull(gl).glGenTextures(1, names, 0);
            requireNonNull(gl).glBindTexture(GL.GL_TEXTURE_3D, arrayAtI32(names, 0));
            requireNonNull(NoiseTextures.ridgedVolume).position(0);
            requireNonNull(gl).glTexImage3D(GL.GL_TEXTURE_3D, 0, GL.GL_LUMINANCE_ALPHA, 64, 64, 64, 0, GL.GL_LUMINANCE_ALPHA, GL.GL_UNSIGNED_BYTE, NoiseTextures.ridgedVolume);
            requireNonNull(gl).glTexParameteri(GL.GL_TEXTURE_3D, GL.GL_TEXTURE_MIN_FILTER, GL.GL_LINEAR);
            requireNonNull(gl).glTexParameteri(GL.GL_TEXTURE_3D, GL.GL_TEXTURE_MAG_FILTER, GL.GL_LINEAR);
            NoiseTextures.ridgedTexture = arrayAtI32(names, 0);
            GlCleaner.textureMemory = (GlCleaner.textureMemory + Math.imul(requireNonNull(NoiseTextures.ridgedVolume).limit(), 2)) | 0;
        } else {
            NoiseTextures.ridgedSlices = new Int32Array(64);
            requireNonNull(gl).glGenTextures(64, NoiseTextures.ridgedSlices, 0);
            for (let i = 0; i < 64; i++) {
                GlRenderer.bindTexture2D(arrayAtI32(NoiseTextures.ridgedSlices, i));
                requireNonNull(NoiseTextures.ridgedVolume).position(Math.imul(Math.imul(Math.imul(i, 64), 64), 2));
                requireNonNull(gl).glTexImage2D(GL.GL_TEXTURE_2D, 0, GL.GL_LUMINANCE_ALPHA, 64, 64, 0, GL.GL_LUMINANCE_ALPHA, GL.GL_UNSIGNED_BYTE, NoiseTextures.ridgedVolume);
                requireNonNull(gl).glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_MIN_FILTER, GL.GL_LINEAR);
                requireNonNull(gl).glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_MAG_FILTER, GL.GL_LINEAR);
            }
            GlCleaner.textureMemory = (GlCleaner.textureMemory + Math.imul(requireNonNull(NoiseTextures.ridgedVolume).limit(), 2)) | 0;
        }
    }

    // lm.f()V
    private static uploadFractal(): void {
        const gl = GlRenderer.gl;
        if (NoiseTextures.texture3d) {
            const names = new Int32Array(1);
            requireNonNull(gl).glGenTextures(1, names, 0);
            requireNonNull(gl).glBindTexture(GL.GL_TEXTURE_3D, arrayAtI32(names, 0));
            requireNonNull(NoiseTextures.fractalVolume).position(0);
            requireNonNull(gl).glTexImage3D(GL.GL_TEXTURE_3D, 0, GL.GL_LUMINANCE_ALPHA, 64, 64, 64, 0, GL.GL_LUMINANCE_ALPHA, GL.GL_UNSIGNED_BYTE, NoiseTextures.fractalVolume);
            requireNonNull(gl).glTexParameteri(GL.GL_TEXTURE_3D, GL.GL_TEXTURE_MIN_FILTER, GL.GL_LINEAR);
            requireNonNull(gl).glTexParameteri(GL.GL_TEXTURE_3D, GL.GL_TEXTURE_MAG_FILTER, GL.GL_LINEAR);
            NoiseTextures.fractalTexture = arrayAtI32(names, 0);
            GlCleaner.textureMemory = (GlCleaner.textureMemory + Math.imul(requireNonNull(NoiseTextures.fractalVolume).limit(), 2)) | 0;
        } else {
            NoiseTextures.fractalSlices = new Int32Array(64);
            requireNonNull(gl).glGenTextures(64, NoiseTextures.fractalSlices, 0);
            for (let i = 0; i < 64; i++) {
                GlRenderer.bindTexture2D(arrayAtI32(NoiseTextures.fractalSlices, i));
                requireNonNull(NoiseTextures.fractalVolume).position(Math.imul(Math.imul(Math.imul(i, 64), 64), 2));
                requireNonNull(gl).glTexImage2D(GL.GL_TEXTURE_2D, 0, GL.GL_LUMINANCE_ALPHA, 64, 64, 0, GL.GL_LUMINANCE_ALPHA, GL.GL_UNSIGNED_BYTE, NoiseTextures.fractalVolume);
                requireNonNull(gl).glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_MIN_FILTER, GL.GL_LINEAR);
                requireNonNull(gl).glTexParameteri(GL.GL_TEXTURE_2D, GL.GL_TEXTURE_MAG_FILTER, GL.GL_LINEAR);
            }
            GlCleaner.textureMemory = (GlCleaner.textureMemory + Math.imul(requireNonNull(NoiseTextures.fractalVolume).limit(), 2)) | 0;
        }
    }
}
