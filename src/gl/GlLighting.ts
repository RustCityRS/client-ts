import { GL } from '#/jogl/GL';
import { doubleToInt } from '#/util/IntUtils';
import { arrayAtF32, arrayPutF32, requireNonNull } from '#/util/JavaArray';
import { isJavaRuntimeException } from '#/util/JavaException';
import WrappedException from '#/util/WrappedException';
import { loadGlRenderer } from '#/util/GamepackClasses';

// Client's product bootstrap also reads the default colours without creating an HD renderer.
function currentGl(): GL | null {
    return loadGlRenderer().gl;
}

// mk in runescape_gl.jar. LIGHT0 is the sun, LIGHT1 supplies negative back lighting.
export default class GlLighting {
    static sunDirection: Float32Array | null = new Float32Array(4); // mk.a:[F, also read by di and td
    private static sunColour = -1; // mk.b:I
    static shadowSlopeX = 0; // mk.c:I
    static shadowSlopeZ = 0; // mk.d:I
    static defaultFogColour = 13156520; // mk.e:I
    private static diffuseIntensity = -1; // mk.f:F
    private static backIntensity = -1; // mk.g:F
    static fogColour: Float32Array | null = new Float32Array(4); // mk.h:[F
    private static ambientIntensity = 0; // mk.i:F
    private static backDirection: Float32Array | null = new Float32Array(4); // mk.j:[F
    static defaultSunColour = 16777215; // mk.k:I
    private static fogOffset = -1; // mk.l:I
    private static fogRgb = -1; // mk.m:I
    private static fogFar = 3584;

    // mk.a()V
    static applyLightPositions(): void {
        const gl = currentGl();
        requireNonNull(gl).glLightfv(GL.GL_LIGHT0, GL.GL_POSITION, GlLighting.sunDirection, 0);
        requireNonNull(gl).glLightfv(GL.GL_LIGHT1, GL.GL_POSITION, GlLighting.backDirection, 0);
    }

    // mk.b()F
    static getDiffuseIntensity(): number {
        return GlLighting.diffuseIntensity;
    }

    // mk.a(IFFF)V
    static setSun(colour: number, ambient: number, diffuse: number, back: number): void {
        ambient = Math.fround(ambient);
        diffuse = Math.fround(diffuse);
        back = Math.fround(back);
        if (GlLighting.sunColour === colour && GlLighting.ambientIntensity === ambient && GlLighting.diffuseIntensity === diffuse && GlLighting.backIntensity === back) return;
        GlLighting.sunColour = colour;
        GlLighting.ambientIntensity = ambient;
        GlLighting.diffuseIntensity = diffuse;
        GlLighting.backIntensity = back;
        const gl = currentGl();
        const red = Math.fround(((colour >> 16) & 255) / 255);
        const green = Math.fround(((colour >> 8) & 255) / 255);
        const blue = Math.fround((colour & 255) / 255);
        const ambientRgba = Float32Array.of(ambient * red, ambient * green, ambient * blue, 1);
        requireNonNull(gl).glLightModelfv(GL.GL_LIGHT_MODEL_AMBIENT, ambientRgba, 0);
        const sunRgba = Float32Array.of(diffuse * red, diffuse * green, diffuse * blue, 1);
        requireNonNull(gl).glLightfv(GL.GL_LIGHT0, GL.GL_DIFFUSE, sunRgba, 0);
        const backRgba = Float32Array.of(-back * red, -back * green, -back * blue, 1);
        requireNonNull(gl).glLightfv(GL.GL_LIGHT1, GL.GL_DIFFUSE, backRgba, 0);
    }

    // mk.c()V
    static unload(): void {
        GlLighting.sunDirection = null;
        GlLighting.backDirection = null;
        GlLighting.fogColour = null;
    }

    // mk.a(II)V
    static setFog(colour: number, offset: number): void {
        const far = loadGlRenderer().sceneFar;
        if (GlLighting.fogRgb === colour && GlLighting.fogOffset === offset && GlLighting.fogFar === far) return;
        GlLighting.fogFar = far;
        GlLighting.fogRgb = colour;
        GlLighting.fogOffset = offset;
        const gl = currentGl();
        arrayPutF32(GlLighting.fogColour, 0, ((colour >> 16) & 255) / 255);
        arrayPutF32(GlLighting.fogColour, 1, ((colour >> 8) & 255) / 255);
        arrayPutF32(GlLighting.fogColour, 2, (colour & 255) / 255);
        requireNonNull(gl).glFogi(GL.GL_FOG_MODE, GL.GL_LINEAR);
        requireNonNull(gl).glFogf(GL.GL_FOG_DENSITY, Math.fround(0.95));
        requireNonNull(gl).glHint(GL.GL_FOG_HINT, GL.GL_FASTEST);
        let start = (far - 512 - offset) | 0;
        if (start < 50) start = 50;
        requireNonNull(gl).glFogf(GL.GL_FOG_START, Math.fround(start));
        requireNonNull(gl).glFogf(GL.GL_FOG_END, far - 256);
        requireNonNull(gl).glFogfv(GL.GL_FOG_COLOR, GlLighting.fogColour, 0);
    }

    // mk.a(FFF)V
    static setDirection(x: number, y: number, z: number): void {
        x = Math.fround(x);
        y = Math.fround(y);
        z = Math.fround(z);
        if (arrayAtF32(GlLighting.sunDirection, 0) === x && arrayAtF32(GlLighting.sunDirection, 1) === y && arrayAtF32(GlLighting.sunDirection, 2) === z) return;
        arrayPutF32(GlLighting.sunDirection, 0, x);
        arrayPutF32(GlLighting.sunDirection, 1, y);
        arrayPutF32(GlLighting.sunDirection, 2, z);
        arrayPutF32(GlLighting.backDirection, 0, -x);
        arrayPutF32(GlLighting.backDirection, 1, -y);
        arrayPutF32(GlLighting.backDirection, 2, -z);
        GlLighting.shadowSlopeX = doubleToInt(Math.fround(Math.fround(x * 256) / y));
        GlLighting.shadowSlopeZ = doubleToInt(Math.fround(Math.fround(z * 256) / y));
    }

    // mk.d()I
    static getSunColour(): number {
        return GlLighting.sunColour;
    }

    // mk.e()V
    static init(): void {
        const gl = currentGl();
        requireNonNull(gl).glColorMaterial(GL.GL_FRONT, GL.GL_AMBIENT_AND_DIFFUSE);
        requireNonNull(gl).glEnable(GL.GL_COLOR_MATERIAL);
        const sunAmbient = Float32Array.of(0, 0, 0, 1);
        requireNonNull(gl).glLightfv(GL.GL_LIGHT0, GL.GL_AMBIENT, sunAmbient, 0);
        requireNonNull(gl).glEnable(GL.GL_LIGHT0);
        const backAmbient = Float32Array.of(0, 0, 0, 1);
        requireNonNull(gl).glLightfv(GL.GL_LIGHT1, GL.GL_AMBIENT, backAmbient, 0);
        requireNonNull(gl).glEnable(GL.GL_LIGHT1);
        GlLighting.sunColour = -1;
        GlLighting.fogRgb = -1;
        GlLighting.setDefaults();
    }

    // mk.a([F)V
    static applyFogColour(colour: Float32Array | null): void {
        if (colour === null) colour = GlLighting.fogColour;
        requireNonNull(currentGl()).glFogfv(GL.GL_FOG_COLOR, colour, 0);
    }

    // mk.f()V
    private static setDefaults(): void {
        GlLighting.setSun(GlLighting.defaultSunColour, 1.15234375, 0.69921875, Math.fround(1.2));
        GlLighting.setDirection(-50, -60, -50);
        GlLighting.setFog(GlLighting.defaultFogColour, 0);
    }

    // mk.g()F
    static getAmbientIntensity(): number {
        return GlLighting.ambientIntensity;
    }

    // si.a(IZ)V, called by gn.a with the stored brightness and false.
    static applyWidgetLighting(brightness: number): void {
        try {
            const scale = Math.fround(Math.fround(0.7) + Math.fround(Math.fround(brightness) * Math.fround(0.1)));
            GlLighting.setSun(GlLighting.defaultSunColour, Math.fround(scale * 1.15234375), 0.69921875, 0.69921875);
            GlLighting.setDirection(-50, -60, -50);
            GlLighting.setFog(GlLighting.defaultFogColour, 0);
            GlLighting.applyLightPositions();
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'si.Q(' + brightness + ',false)');
        }
    }
}
