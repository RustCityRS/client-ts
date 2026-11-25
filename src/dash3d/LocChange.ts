import { releaseReferences } from '#/util/StaticReferences';
import Linkable from '#/datastruct/Linkable';
import LocType from '#/config/LocType';
import AreaSoundManager from '#/sound/AreaSoundManager';
import { arrayAtI32, requireNonNull } from '#/util/JavaArray';
import { glJar } from '#/client/ClientVariant';
import ClientBuild from '#/client/ClientBuild';
import { isJavaRuntimeException } from '#/util/JavaException';
import WrappedException from '#/util/WrappedException';
import type ModelSource from './ModelSource';
import ClientLocAnim from './ClientLocAnim';
import GroundShadows from './GroundShadows';
import type CollisionMap from './CollisionMap';
import world from './world';
import LocalisedTextClass from '#/ui/LocalisedText';
import GlRenderer from '#/gl/GlRenderer';
import { loadClient } from '#/util/GamepackClasses';

// The scene supplies the four key lookups for de.a while 530's scene graph is ported.
export interface LocChangeScene {
    animateLoc?(plane: number, x: number, z: number, layer: number, shape: number, angle: number, seq: number): void;
    getLoc(plane: number, x: number, z: number, layer: number): { id: number; shape: number; angle: number } | null;
    setLoc(plane: number, x: number, z: number, layer: number, id: number, shape: number, angle: number): void;
    setGroundItems?(plane: number, x: number, z: number, items: readonly { id: number; count: number }[]): void;
    getEntity?(plane: number, x: number, z: number, layer: number): object | null;
}

export default class LocChange extends Linkable {
    // HD cd.c(I)V
    static releaseLocChangeStatics(guard: number): void {
        try {
            const LocalisedText = LocalisedTextClass;
            releaseReferences(LocalisedText, 'germanCheckingForUpdates', 'germanLoadingWordpack', 'frenchWalkHere');
            if (guard !== 2) {
                LocChange.releaseLocChangeStatics(-22);
            }
            const Client = loadClient();
            releaseReferences(Client, 'quickChatGlobalArchive');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'cd.A(' + guard + ')');
        }
    }

    remaining = -1; // ff.r:I
    plane = 0; // ff.t:I
    x = 0; // ff.w:I
    layer = 0; // ff.z:I
    oldAngle = 0; // ff.B:I
    shape = 0; // ff.C:I
    oldShape = 0; // ff.D:I
    delay = 0; // ff.F:I
    oldId = 0; // ff.K:I
    id = 0; // ff.L:I
    z = 0; // ff.N:I
    angle = 0; // ff.O:I

    static scene: LocChangeScene | null = null;

    // ff.<init>()V
    constructor() {
        super();
    }

    // af.a(Lke;IBIIII)V. o.a passes 36 for the byte guard and supplies the bridge-adjusted height level.
    static removeUnchecked(collision: CollisionMap | null, x: number, heightLevel: number, plane: number, z: number, layer: number): void {
        if (glJar) {
            // HD dg.a(IIIIIILmj;)V, called by ge.b with -96.
            try {
                let key = 0n;
                if (layer === 0) key = world.WallType(plane, x, z);
                else if (layer === 1) key = world.DecorType(plane, x, z);
                else if (layer === 2) key = world.SceneType(plane, x, z);
                else if (layer === 3) key = world.GdType(plane, x, z);
                const shape = (Number(BigInt.asIntN(32, key)) & 0x7ebd8) >> 14;
                const id = Number((key >> 32n) & 0x7fffffffn);
                const type = LocType.List(id);
                if (type.HasBgSound()) AreaSoundManager.removeLoc(plane, z, x, type);
                const angle = (Number(BigInt.asIntN(32, key)) & 0x3eb4ac) >> 20;
                if (key === 0n) return;
                let first: ModelSource | null = null,
                    second: ModelSource | null = null;
                if (layer === 0) {
                    const wall = world.DelWall(plane, x, z);
                    if (wall !== null) {
                        first = wall.model1;
                        second = wall.model2;
                    }
                    if (type.blockwalk !== 0) requireNonNull(collision).delWall(x, z, shape, angle, type.blockrange);
                } else if (layer !== 1) {
                    if (layer === 2) {
                        const loc = world.DelLoc(plane, x, z);
                        if (loc !== null) first = loc.model;
                        if (type.blockwalk !== 0 && ((type.width + x) | 0) < 104 && ((type.width + z) | 0) < 104 && ((x + type.length) | 0) < 104 && ((z + type.length) | 0) < 104) {
                            requireNonNull(collision).delLoc(x, z, type.width, type.length, angle, type.blockrange);
                        }
                    } else if (layer === 3) {
                        const decor = world.DelGroundDecor(plane, x, z);
                        if (decor !== null) first = decor.model;
                        if (type.blockwalk === 1) requireNonNull(collision).unblockGroundDecor(x, z);
                    }
                } else {
                    const decor = world.DelDecor(plane, x, z);
                    if (decor !== null) {
                        first = decor.model;
                        second = decor.model2;
                    }
                }
                if (!GlRenderer.active || !type.flag88) return;
                if (shape === 2) {
                    if (first instanceof ClientLocAnim) first.removeShadow(-1);
                    else GroundShadows.removeStaticLoc(type, -76, 0, angle + 4, 0, shape, x, z, heightLevel);
                    if (second instanceof ClientLocAnim) second.removeShadow(-1);
                    else GroundShadows.removeStaticLoc(type, -100, 0, (angle + 1) & 3, 0, shape, x, z, heightLevel);
                } else if (shape === 5) {
                    if (first instanceof ClientLocAnim) first.removeShadow(-1);
                    else GroundShadows.removeStaticLoc(type, -119, Math.imul(8, arrayAtI32(ClientBuild.DECORZOF, angle)), angle, Math.imul(8, arrayAtI32(ClientBuild.DECORXOF, angle)), 4, x, z, heightLevel);
                } else if (shape === 6) {
                    if (first instanceof ClientLocAnim) first.removeShadow(-1);
                    else GroundShadows.removeStaticLoc(type, -28, Math.imul(8, arrayAtI32(ClientBuild.DECORZOF2, angle)), angle + 4, Math.imul(8, arrayAtI32(ClientBuild.DECORXOF2, angle)), 4, x, z, heightLevel);
                } else if (shape === 7) {
                    if (first instanceof ClientLocAnim) first.removeShadow(-1);
                    else GroundShadows.removeStaticLoc(type, -120, 0, 4 + ((angle + 2) & 3), 0, 4, x, z, heightLevel);
                } else if (shape === 8) {
                    if (first instanceof ClientLocAnim) first.removeShadow(-1);
                    else GroundShadows.removeStaticLoc(type, -45, Math.imul(8, arrayAtI32(ClientBuild.DECORZOF2, angle)), angle + 4, Math.imul(8, arrayAtI32(ClientBuild.DECORXOF2, angle)), 4, x, z, heightLevel);
                    if (second instanceof ClientLocAnim) second.removeShadow(-1);
                    else GroundShadows.removeStaticLoc(type, -24, Math.imul(8, arrayAtI32(ClientBuild.DECORZOF2, angle)), 4 + ((angle + 2) & 3), Math.imul(8, arrayAtI32(ClientBuild.DECORXOF2, angle)), 4, x, z, heightLevel);
                } else if (shape !== 11) {
                    if (first instanceof ClientLocAnim) first.removeShadow(-1);
                    else GroundShadows.removeStaticLoc(type, -113, 0, angle, 0, shape, x, z, heightLevel);
                } else if (first instanceof ClientLocAnim) first.removeShadow(-1);
                else GroundShadows.removeStaticLoc(type, -115, 0, angle + 4, 0, 10, x, z, heightLevel);
                return;
            } catch (error) {
                if (!isJavaRuntimeException(error)) throw error;
                throw WrappedException.wrap(error, 'dg.B(' + [-96, z, x, plane, layer, heightLevel].join(',') + ',' + (collision === null ? 'null' : '{...}') + ')');
            }
        }
        let key = 0n;
        if (layer === 0) key = world.WallType(plane, x, z);
        else if (layer === 1) key = world.DecorType(plane, x, z);
        else if (layer === 2) key = world.SceneType(plane, x, z);
        else if (layer === 3) key = world.GdType(plane, x, z);

        const angle = (Number(BigInt.asIntN(32, key)) >> 20) & 3;
        const id = Number((key >> 32n) & 0x7fffffffn);
        const type = LocType.List(id);
        const shape = (Number(BigInt.asIntN(32, key)) >> 14) & 31;
        if (type.HasBgSound()) AreaSoundManager.removeLoc(plane, z, x, type);
        if (key === 0n) return;
        if (layer === 0) {
            world.DelWall(plane, x, z);
            if (type.blockwalk !== 0) {
                const blockRange = type.blockrange;
                requireNonNull(collision).delWall(x, z, shape, angle, blockRange);
            }
        } else if (layer === 1) {
            world.DelDecor(plane, x, z);
        } else if (layer !== 2) {
            if (layer === 3) {
                world.DelGroundDecor(plane, x, z);
                if (type.blockwalk === 1) requireNonNull(collision).unblockGroundDecor(x, z);
            }
        } else {
            world.DelLoc(plane, x, z);
            if (type.blockwalk !== 0 && ((type.width + x) | 0) < 104 && ((z + type.width) | 0) < 104 && ((type.length + x) | 0) < 104 && ((z + type.length) | 0) < 104) {
                const blockRange = type.blockrange;
                const width = type.width;
                const length = type.length;
                requireNonNull(collision).delLoc(x, z, width, length, angle, blockRange);
            }
        }
    }
}
