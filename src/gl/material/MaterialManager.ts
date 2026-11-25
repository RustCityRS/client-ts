import Preferences from '#/ui/Preferences';
import { isJavaRuntimeException } from '#/util/JavaException';
import WrappedException from '#/util/WrappedException';
import { arrayAtF32, arrayAtObj, arrayPutF32, arrayPutObj, requireNonNull } from '#/util/JavaArray';
import NoiseTextures from '#/gl/NoiseTextures';
import GlLighting from '#/gl/GlLighting';
import GlRenderer from '#/gl/GlRenderer';
import HighDetailWaterMaterial from './HighDetailWaterMaterial';
import type MaterialRenderer from './MaterialRenderer';
import ScrollingDetailMaterial from './ScrollingDetailMaterial';
import SpecularCubeMapMaterial from './SpecularCubeMapMaterial';
import UnderwaterMaterial from './UnderwaterMaterial';
import UnlitMaterial from './UnlitMaterial';
import WaterProgramMaterial from './WaterProgramMaterial';

// The HD material statics. runescape_gl.jar scatters them over holder classes; membermap-hd.json gives aa.t:[Lpc;,
// cb.b(III)V and te.e(I)V this home (HD_PLAN.md 1.3). The other statics below have no target in the member map yet.
// Each is read or written only by the material code and its parameter setters, so they live here too until the map
// says otherwise (reported to the board):
// - dl.c, mh.eb: the current material and argument (also read by ka.b(II)V and ef.a(I)I, H6).
// - je.R: the switch lock set around the underwater pass (mf.a(...), uc.a(...)).
// - bb.M, qc.cb, sj.D, ej.X, uj.H: the material camera, written only by ld.a(IIIIZI)V (from ui.a).
// - nh.Z (lh.b(II)V) and v.c (bk.a(BI)V): the underwater fog depth and colour.
// - jj.a(B)[F and its scratch ug.b: the underwater fog colour, used by UnderwaterMaterial and the scene (ub, uc).
// - gj.b(I)V and nj.a(I)V: GlRenderer's material reset (tf.f()V) and release (tf.o()V); ef.a(I)I: the current
//   material's flags (GlSolidTexture, sd.g(B)V).
// NXT has no GL 1.x classes, so the names are descriptive.
export default class MaterialManager {
    // aa.t:[Lpc;. Indexed by material id; slot 0 stays null. Built by createMaterials, cleared by releaseMaterials.
    static materials: (MaterialRenderer | null)[] | null = null;

    // dl.c:I. The bound material (0: none).
    static current = 0;

    // mh.eb:I. The current material's argument.
    static currentArgument = 0;

    // je.R:Z. While set, setMaterial ignores requests for a different material.
    static locked = false;

    // The camera position the materials build their world-space planes from.
    static cameraX = 0; // bb.M:I
    static cameraY = 0; // qc.cb:I
    static cameraZ = 0; // sj.D:I

    // ej.X:I. Camera yaw (2048 units per turn).
    static cameraYaw = 0;

    // uj.H:I. Camera pitch (2048 units per turn).
    static cameraPitch = 0;

    // nh.Z:I. The underwater fog depth: UnderwaterMaterial's ramp spans this many units below the surface.
    static underwaterDepth = 0;

    // v.c:[F. The underwater colour (RGBA). v.<clinit>()V stores {0.073f, 0.169f, 0.24f, 1.0f}.
    static underwaterColour: Float32Array | null = new Float32Array([0.073, 0.169, 0.24, 1.0]);

    // ug.b:[F. Scratch RGBA that underwaterFogColour fills and returns (pf.a also writes it). ug.<clinit>()V.
    static fogColour: Float32Array | null = new Float32Array(4);

    // ka.b(II)V
    private static refreshMaterial(material: number): void {
        try {
            if (material === MaterialManager.current && material !== 0) {
                const renderer = arrayAtObj(MaterialManager.materials, material);
                const argument = MaterialManager.currentArgument;
                requireNonNull(renderer).setArgument(argument);
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ka.A(-32584,' + material + ')');
        }
    }

    // bk.a(BI)V
    static setUnderwaterColour(colour: number): void {
        try {
            arrayPutF32(MaterialManager.underwaterColour, 0, ((colour >> 16) & 255) / 255);
            arrayPutF32(MaterialManager.underwaterColour, 1, ((colour >> 8) & 255) / 255);
            arrayPutF32(MaterialManager.underwaterColour, 2, (colour & 255) / 255);
            MaterialManager.refreshMaterial(3);
            MaterialManager.refreshMaterial(4);
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'bk.A(56,' + colour + ')');
        }
    }

    // lh.b(II)V, called by ub.a with guard 121.
    static setUnderwaterDepth(depth: number): void {
        try {
            MaterialManager.underwaterDepth = depth;
            MaterialManager.refreshMaterial(3);
            MaterialManager.refreshMaterial(4);
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'lh.E(' + depth + ',121)');
        }
    }

    // pf.a(II)[F, called by mf.a() with index 0.
    static waterSurfaceColour(rgb: number, redIndex = 0): Float32Array | null {
        try {
            const light = Math.fround(GlLighting.getAmbientIntensity() + GlLighting.getDiffuseIntensity());
            const sun = GlLighting.getSunColour();
            const tint = Math.fround(0.58823526);
            arrayPutF32(MaterialManager.fogColour, 3, 1);
            const r = Math.fround(((sun >> 16) & 255) / 255);
            const g = Math.fround(((sun & 0xff1e) >> 8) / 255);
            arrayPutF32(MaterialManager.fogColour, 1, light * Math.fround(Math.fround(Math.fround(((rgb >> 8) & 255) / 255) * g) * tint));
            arrayPutF32(MaterialManager.fogColour, redIndex, light * Math.fround(tint * Math.fround(r * Math.fround(((rgb & 16754958) >> 16) / 255))));
            const b = Math.fround((sun & 255) / 255);
            arrayPutF32(MaterialManager.fogColour, 2, Math.fround(Math.fround(Math.fround((rgb & 255) / 255) * b) * tint) * light);
            return MaterialManager.fogColour;
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'pf.F(' + rgb + ',' + redIndex + ')');
        }
    }

    // ld.a(IIIIZI)V, called with false before and after drawing the scene.
    static setCamera(pitch: number, z: number, y: number, x: number, yaw: number): void {
        MaterialManager.cameraZ = z;
        MaterialManager.cameraYaw = yaw;
        MaterialManager.cameraPitch = pitch;
        MaterialManager.cameraX = x;
        MaterialManager.cameraY = y;
    }

    // cb.b(III)V. Switches to `material` with `argument`. Material 4 (high-detail water) falls back to material 2 with
    // argument 2 when high water detail is off. The same material only re-applies a changed argument; a different
    // one (unless locked) unbinds the current material, then binds and parameterises the new one. The dummy first
    // parameter (0 at all 14 call sites) and its guard are stripped.
    static setMaterial(argument: number, material: number): void {
        if (material === 4 && !Preferences.graphics.highWaterDetail) {
            material = 2;
            argument = 2;
        }
        if (MaterialManager.current === material) {
            if (material !== 0 && argument !== MaterialManager.currentArgument) {
                requireNonNull(arrayAtObj(MaterialManager.materials, material)).setArgument(argument);
                MaterialManager.currentArgument = argument;
            }
        } else {
            if (MaterialManager.locked) {
                return;
            }
            if (MaterialManager.current !== 0) {
                requireNonNull(arrayAtObj(MaterialManager.materials, MaterialManager.current)).unbind();
            }
            if (material !== 0) {
                const renderer = requireNonNull(arrayAtObj(MaterialManager.materials, material));
                renderer.bind();
                renderer.setArgument(argument);
            }
            MaterialManager.current = material;
            MaterialManager.currentArgument = argument;
        }
        if (Preferences.enhancedGraphicsEnabled && (material === 2 || material === 4)) {
            const sunlight = GlRenderer.stressDrawable?.currentTargets()?.worldSunlight;
            if (sunlight) sunlight.waterRate = 1 << (argument & 3);
        }
    }

    // te.e(I)V. Called by tf.s()V (GlRenderer) at context creation with 6: uploads the noise volumes, then builds the
    // six material renderers in id order, the unlit one in slot `unlitSlot`.
    static createMaterials(unlitSlot: number): void {
        try {
            NoiseTextures.createTextures();
            MaterialManager.materials = new Array<MaterialRenderer | null>(7).fill(null);
            arrayPutObj(MaterialManager.materials, 1, new SpecularCubeMapMaterial());
            arrayPutObj(MaterialManager.materials, 2, new WaterProgramMaterial());
            arrayPutObj(MaterialManager.materials, 3, new UnderwaterMaterial());
            arrayPutObj(MaterialManager.materials, 4, new HighDetailWaterMaterial());
            arrayPutObj(MaterialManager.materials, 5, new ScrollingDetailMaterial());
            arrayPutObj(MaterialManager.materials, unlitSlot, new UnlitMaterial());
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'te.T(' + unlitSlot + ')');
        }
    }

    // gj.b(I)V. Unbinds the current material (tf.f()V, at context creation). The dummy argument (97 at the only call)
    // and its guard are stripped.
    static resetMaterial(): void {
        MaterialManager.setMaterial(0, 0);
    }

    // nj.a(I)V. Drops the material table and deletes the noise textures (tf.o()V, at teardown). The dummy argument (90
    // at the only call) and its guard (<= 49) are stripped.
    static releaseMaterials(): void {
        MaterialManager.materials = null;
        NoiseTextures.deleteTextures();
    }

    // ef.a(I)I. The current material's flags, 0 with no material. The dummy argument (1536 at both calls) and its
    // guard (otherwise 96) are stripped.
    static getMaterialFlags(): number {
        if (MaterialManager.current === 0) {
            return 0;
        }
        return requireNonNull(arrayAtObj(MaterialManager.materials, MaterialManager.current)).flags();
    }

    // jj.a(B)[F. The underwater fog colour: the underwater colour tinted by the light colour, times 0.58823526 and
    // the summed ambient and diffuse intensities, alpha 1. The dummy byte (-50 at all three calls) and its guard are
    // stripped.
    static underwaterFogColour(): Float32Array | null {
        const intensity = Math.fround(GlLighting.getAmbientIntensity() + GlLighting.getDiffuseIntensity());
        const colour = GlLighting.getSunColour();
        const red = Math.fround(Math.fround(255 & (colour >> 16)) / 255.0);
        arrayPutF32(MaterialManager.fogColour, 3, 1.0);
        const green = Math.fround(Math.fround((0xff59 & colour) >> 8) / 255.0);
        const tint = Math.fround(0.58823526);
        const blue = Math.fround(Math.fround(255 & colour) / 255.0);
        arrayPutF32(MaterialManager.fogColour, 2, Math.fround(Math.fround(Math.fround(arrayAtF32(MaterialManager.underwaterColour, 2) * blue) * tint) * intensity));
        arrayPutF32(MaterialManager.fogColour, 0, Math.fround(Math.fround(Math.fround(arrayAtF32(MaterialManager.underwaterColour, 0) * red) * tint) * intensity));
        arrayPutF32(MaterialManager.fogColour, 1, Math.fround(intensity * Math.fround(tint * Math.fround(green * arrayAtF32(MaterialManager.underwaterColour, 1)))));
        return MaterialManager.fogColour;
    }
}
