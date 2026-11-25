import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import { glJar } from './ClientVariant';
import LRUHashCache from '#/datastruct/LRUHashCache';
import ModelLit from '#/dash3d/ModelLit';
import ModelLitImpl from '#/dash3d/ModelLitImpl';
import ModelUnlit from '#/dash3d/ModelUnlit';
import { arrayAtI32, arrayPutI32, requireNonNull } from '#/util/JavaArray';
import Client from './Client';
import LocalisedTextClass from '#/ui/LocalisedText';
import GlRenderer from '#/gl/GlRenderer';
import { loadGlModel, loadWorldMap } from '#/util/GamepackClasses';
// kf
export default class HintArrow {
    // HD nc.a(B)V
    static releaseHdStatics(guard: number): void {
        try {
            if (guard <= 38) {
                HintArrow.releaseHdStatics(-126);
            }
            const WorldMap = loadWorldMap();
            releaseReferences(WorldMap, 'underlay');
            const LocalisedText = LocalisedTextClass;
            releaseReferences(LocalisedText, 'germanRating');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'nc.B(' + guard + ')');
        }
    }

    // te.a:Lve;
    static readonly modelCache = new LRUHashCache<object>(4);

    // ai.a(IIIILnd;II)Lnd;. pb passes -124 for the third (unused guard) int.
    static buildArrowModel(angle: number, z: number, model: number, base: ModelLit | null, sceneHeight: number, x: number): ModelLit | null {
        const key = BigInt(model);
        const cached = HintArrow.modelCache.Find(key);
        let modelBase: ModelLit;
        if (cached === null) {
            const unlit = ModelUnlit.Load(Client.modelsArchive, model, 0);
            if (unlit === null) return null;
            modelBase = unlit.Light(64, 768, -50, -10, -50);
            HintArrow.modelCache.Put(key, modelBase);
        } else {
            if (!(cached instanceof ModelLit)) throw new TypeError('ClassCastException: not a ModelLit');
            modelBase = cached;
        }
        const bounds = requireNonNull(base);
        const minX = bounds.getMinX();
        const maxX = bounds.getMaxX();
        const minZ = bounds.getMinZ();
        const maxZ = bounds.getMaxZ();
        const copy = modelBase.CopyForAnimSpot(true, true, true);
        if (angle !== 0) copy.RotateYAxis(angle);
        if (glJar && GlRenderer.active) {
            const GlModel = loadGlModel();
            if (!(copy instanceof GlModel)) throw new TypeError('ClassCastException: not a GlModel');
            if (sceneHeight !== Client.GetAvH((x + minX) | 0, (minZ + z) | 0, Client.playerLevel, 99) || sceneHeight !== Client.GetAvH((maxX + x) | 0, (maxZ + z) | 0, Client.playerLevel, -76)) {
                for (let i = 0; i < copy.vertexCount; i++) {
                    const ys = copy.pointY;
                    const y = arrayAtI32(ys, i);
                    const level = Client.playerLevel;
                    const ground = Client.GetAvH((arrayAtI32(copy.pointX, i) + x) | 0, (arrayAtI32(copy.pointZ, i) + z) | 0, level, 94);
                    arrayPutI32(ys, i, (y - sceneHeight + ground) | 0);
                }
                requireNonNull(copy.positionStream).valid = false;
                requireNonNull(copy.bounds).valid = false;
            }
        } else {
            if (!(copy instanceof ModelLitImpl)) throw new TypeError('ClassCastException: not a ModelLitImpl');
            if (sceneHeight !== Client.GetAvH((x + minX) | 0, (minZ + z) | 0, Client.playerLevel, 99) || sceneHeight !== Client.GetAvH((maxX + x) | 0, (maxZ + z) | 0, Client.playerLevel, -76)) {
                for (let i = 0; i < copy.numPoints; i++) {
                    const ys = copy.pointY;
                    const y = arrayAtI32(ys, i);
                    const level = Client.playerLevel;
                    const ground = Client.GetAvH((arrayAtI32(copy.pointX, i) + x) | 0, (arrayAtI32(copy.pointZ, i) + z) | 0, level, 94);
                    arrayPutI32(ys, i, (y - sceneHeight + ground) | 0);
                }
                copy.boundsCalculated = false;
            }
        }
        return copy;
    }

    // mc.f(I)V
    static clearModelCache(): void {
        HintArrow.modelCache.Reset();
    }

    // kl.b(I)V
    static removeSoft(): void {
        HintArrow.modelCache.removeSoft();
    }

    // mf.a(IB)V
    static cleanModelCache(age: number): void {
        HintArrow.modelCache.Clean(age);
    }

    actor = 0; // kf.a:I
    z = 0; // kf.e:I
    model = -1; // kf.h:I
    x = 0; // kf.i:I
    type = 0; // kf.j:I
    offsetX = 0; // kf.k:I
    offsetZ = 0; // kf.m:I
    icon = 0; // kf.o:I
    height = 0; // kf.r:I

    // kf.<init>()V
    constructor() {}
}
