import { releaseReferences } from '#/util/StaticReferences';
import Client from '#/client/Client';
import GameVariant from '#/client/GameVariant';
import { glJar } from '#/client/ClientVariant';
import LocType from '#/config/LocType';
import SeqType from '#/config/SeqType';
import type Pix8 from '#/graphics/Pix8';
import type LocEntity from './LocEntity';
import GroundShadows from './GroundShadows';
import { isJavaRuntimeException } from '#/util/JavaException';
import WrappedException from '#/util/WrappedException';
import Preferences from '#/ui/Preferences';
import { doubleToInt, intRemainder } from '#/util/IntUtils';
import { arrayAtI32, arrayAtObj, requireNonNull } from '#/util/JavaArray';
import { mathRandom } from '#/util/JavaRandom';
import ModelSource from './ModelSource';
import type ParticleSystem from './ParticleSystem';
import world from './world';
import LocalisedTextClass from '#/ui/LocalisedText';
import ByteArrayPoolClass from '#/io/ByteArrayPool';
import GlRenderer from '#/gl/GlRenderer';
import { loadMinimenu } from '#/util/GamepackClasses';

// ml in the revision 530 SD gamepack (NXT jag::oldscape::ClientLocAnim, libs/oldscape/jagex3/client/clientlocanim.cpp):
// an animated loc in the scene graph. It keeps the loc id, shape, angle, level and tile position plus the SeqType
// animation state (frame, next frame, frame cycle and frame-start cycle). Each draw advances the animation to
// Client.loopCycle, firing the frame sounds through Client.TriggerSeqSound, and builds the posed loc model through
// LocType.GetTempModel (or LocType.GetModel once the sequence has ended).
//
// Naming: NXT ClientLocAnim::GetTempModel does the frame advance and the model build in one public routine. 530 splits
// it into the public ml.b(B)Lug; (GetTempModel), the private model build ml.a(ZI)Lug; (GetTempModel2, the API sheet's
// suffix convention for two 530 methods sharing one NXT name) and the private frame advance ml.a(BII)V (advanceFrame,
// no NXT symbol). Fields follow the NXT member hints where clientlocanim.h names them (index, shape, angle, level, x, z,
// seq, frame, cycle); the rest are camelCase descriptions. Overrides of ModelSource keep the base names.
//
// Stripped obfuscation: the static invocation counters (l, p, z, E, H, J, N, r, S; finalize() only bumps H, so it is
// not ported), the od.a catch/rethrow wrappers, the client.wb opaque branches (labelled breaks and the duplicated
// loop entries in a(BII)V) and three constant dummy parameters (see each method). ml's statics belong to other classes
// in the member map (k/n/v/C LocalisedText, m/Q WorldMap, t Client, u IdkType, w ClientEntity, x Minimenu, T Client,
// a(IIIB)I Client.GetAvH, a(Lal;III)Lvc; SpriteLoader.loadSprite2); ml.a(I)V is the shutdown unload artifact.
export default class ClientLocAnim extends ModelSource {
    // HD dc.b(I)V
    static releaseClientLocAnimStatics(guard: number): void {
        try {
            const LocalisedText = LocalisedTextClass;
            releaseReferences(LocalisedText, 'chateffect1', 'drop');
            const Minimenu = loadMinimenu();
            releaseReferences(Minimenu, 'yellowGreen');
            releaseReferences(Client, 'interfacesArchive');
            releaseReferences(LocalisedText, 'englishChateffect1');
            if (guard !== 2) {
                ClientLocAnim.releaseClientLocAnimStatics(64);
            }
            releaseReferences(LocalisedText, 'defaultChateffect1');
            const ByteArrayPool = ByteArrayPoolClass;
            releaseReferences(ByteArrayPool, 'large');
            releaseReferences(Client, 'urlSlash');
            releaseReferences(LocalisedText, 'englishDrop');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'dc.G(' + guard + ')');
        }
    }

    // al.R:Lch;
    // SD al.R stays null. HD ci.q retains a reusable projected shadow until a loc adopts it.
    static defaultShadow: Pix8 | null = null;

    // ml.j:I
    private level: number;
    // ml.o:I
    private shape: number;
    // ml.q:I
    // HD dc.gb records the last loc type considered for a shadow update.
    private lastLocId: number;
    // ml.s:I
    private angle: number;
    // ml.y:I
    private z: number;
    // ml.A:I
    private x: number;
    // ml.B:I
    private nextFrame = 0;
    // ml.D:I
    private minY = -32768;
    // ml.F:Lek;
    private seq: SeqType | null = null;
    // ml.G:I
    // The loop cycle at which the current frame started.
    private cycle = 0;
    // ml.I:I
    private frame = 0;
    // ml.K:Lue;
    // Never assigned in 530: draw passes null particles to the model.
    private particles: ParticleSystem | null = null;
    // ml.L:I
    private index: number;
    // ml.M:Lch;
    // HD dc.Q holds the sprite this loc last stamped into the terrain bitmap.
    private shadow: Pix8 | null;
    // ml.O:I
    // HD dc.ib tracks the last animation frame considered for a shadow update.
    private lastFrame = -1;
    // ml.P:Z
    // Set when the loc is a multiloc placed without a previous entity: GetTempModel2 then re-resolves the sequence
    // from the current variant (only when GameVariant.id != 0).
    private hasMulti = false;
    // ml.R:I
    // Cycles already spent in the current frame.
    private frameCycle = 0;
    private shadowX = 0; // HD dc.x
    private shadowY = 0; // HD dc.s
    private shadowZ = 0; // HD dc.eb
    private checkShadow = true; // HD dc.B

    // ml.<init>(IIIIIIIZLug;)V
    // var1 loc id, var2 shape, var3 angle, var4 level, var5 x, var6 z (tiles), var7 seq id (-1 for none), var8 random
    // start, var9 the entity this one replaces (its animation state is kept when it plays the same sequence and the
    // sequence's duplicate behaviour is 0).
    constructor(var1: number, var2: number, var3: number, var4: number, var5: number, var6: number, var7: number, var8: boolean, var9: ModelSource | null) {
        super();
        this.lastLocId = -1;
        this.shadow = null;
        this.angle = var3;
        this.level = var4;
        this.x = var5;
        this.z = var6;
        this.shape = var2;
        this.index = var1;
        if (glJar && GlRenderer.active && var9 !== null) {
            if (var9 instanceof ClientLocAnim) {
                var9.removeShadow(-1);
            } else {
                let type: LocType | null = LocType.List(this.index);
                if (type.multi !== null) type = type.GetMultiLoc();
                if (type !== null) GroundShadows.removeStaticLoc(type, -76, 0, this.angle, 0, this.shape, this.x, this.z, this.level);
            }
        }
        if (var7 !== -1) {
            this.seq = SeqType.List(var7);
            this.frame = 0;
            if (requireNonNull(this.seq.frames).length > 1) {
                this.nextFrame = 1;
            } else {
                this.nextFrame = 0;
            }

            this.frameCycle = 1;
            this.cycle = (-1 + Client.loopCycle) | 0;
            if (this.seq.m_duplicateBehaviour === 0 && var9 !== null && var9 instanceof ClientLocAnim) {
                const var10 = var9;
                if (this.seq === var10.seq) {
                    this.nextFrame = var10.nextFrame;
                    this.cycle = var10.cycle;
                    this.frame = var10.frame;
                    this.frameCycle = var10.frameCycle;
                    return;
                }
            }

            if (var8 && this.seq.m_loops !== -1) {
                this.frame = doubleToInt(mathRandom.nextDouble() * requireNonNull(this.seq.frames).length);
                this.nextFrame = (1 + this.frame) | 0;
                if (this.nextFrame >= requireNonNull(this.seq.frames).length) {
                    this.nextFrame = (this.nextFrame - this.seq.m_loops) | 0;
                    if (this.nextFrame < 0 || this.nextFrame >= requireNonNull(this.seq.frames).length) {
                        this.nextFrame = -1;
                    }
                }

                this.frameCycle = (doubleToInt(mathRandom.nextDouble() * arrayAtI32(this.seq.delays, this.frame)) + 1) | 0;
                this.cycle = (Client.loopCycle - this.frameCycle) | 0;
            }
        }

        if (glJar && GlRenderer.active && var9 !== null) this.GetTempModel2(true);
        if (var9 === null) {
            const var12 = LocType.List(this.index);
            if (var12.multi !== null) {
                this.hasMulti = true;
                return;
            }
        }
    }

    // ml.a(BII)V
    // Advances the animation to Client.loopCycle: x and z are the fine coordinates passed to the frame sounds. After
    // more than 100 cycles away a looping sequence (m_loops > 0) skips whole loops (the remainder modulo the loop's
    // total delay). Each frame stepped over first triggers its sound (Client.TriggerSeqSound, sf.a at javap offset
    // 0x116); a non-looping sequence that runs out clears seq. Stripped: the byte dummy var1. Every caller passes at
    // least 124 (GetTempModel2: 125, update: 127; the third, GetTempModel's guard call with 9, is itself stripped),
    // so `if (var1 < 124) ml.x = null` never runs.
    private advanceFrame(x: number, z: number): void {
        if (this.seq !== null) {
            let var4 = (Client.loopCycle - this.cycle) | 0;
            if (var4 > 100 && requireNonNull(this.seq).m_loops > 0) {
                const var5 = (requireNonNull(requireNonNull(this.seq).frames).length - requireNonNull(this.seq).m_loops) | 0;
                while (this.frame < var5 && var4 > arrayAtI32(requireNonNull(this.seq).delays, this.frame)) {
                    var4 = (var4 - arrayAtI32(requireNonNull(this.seq).delays, this.frame)) | 0;
                    this.frame = (this.frame + 1) | 0;
                }

                if (this.frame >= var5) {
                    let var6 = 0;
                    for (let var7 = var5; requireNonNull(requireNonNull(this.seq).frames).length > var7; var7++) {
                        var6 = (var6 + arrayAtI32(requireNonNull(this.seq).delays, var7)) | 0;
                    }

                    var4 = intRemainder(var4, var6);
                }

                this.nextFrame = (1 + this.frame) | 0;
                if (this.nextFrame >= requireNonNull(requireNonNull(this.seq).frames).length) {
                    this.nextFrame = (this.nextFrame - requireNonNull(this.seq).m_loops) | 0;
                    if (this.nextFrame < 0 || this.nextFrame >= requireNonNull(requireNonNull(this.seq).frames).length) {
                        this.nextFrame = -1;
                    }
                }
            }

            while (var4 > arrayAtI32(requireNonNull(this.seq).delays, this.frame)) {
                Client.TriggerSeqSound(this.seq, z, x, false, this.frame);
                var4 = (var4 - arrayAtI32(requireNonNull(this.seq).delays, this.frame)) | 0;
                this.frame = (this.frame + 1) | 0;
                if (requireNonNull(requireNonNull(this.seq).frames).length <= this.frame) {
                    this.frame = (this.frame - requireNonNull(this.seq).m_loops) | 0;
                    if (this.frame < 0 || this.frame >= requireNonNull(requireNonNull(this.seq).frames).length) {
                        this.seq = null;
                        break;
                    }
                }

                this.nextFrame = (1 + this.frame) | 0;
                if (requireNonNull(requireNonNull(this.seq).frames).length <= this.nextFrame) {
                    this.nextFrame = (this.nextFrame - requireNonNull(this.seq).m_loops) | 0;
                    if (this.nextFrame < 0 || this.nextFrame >= requireNonNull(requireNonNull(this.seq).frames).length) {
                        this.nextFrame = -1;
                    }
                }
            }

            this.frameCycle = var4;
            this.cycle = (Client.loopCycle - var4) | 0;
        }
    }

    // ml.b(B)Lug; (NXT ClientLocAnim::GetTempModel)
    // The current model, built without the shadow-change test. Also called by ClientPlayer's draw for its attached
    // loc (pb.a(IIIIIIIIJILue;)V, javap offset 1029). Stripped: the byte dummy var1. Both callers (that pb draw and
    // draw here) pass 35, so `if (var1 != 35) this.a((byte) 9, -40, -1)` never runs.
    GetTempModel(): ModelSource | null {
        return this.GetTempModel2(false);
    }

    // HD dc.c(I)V
    removeShadow(frame: number): void {
        try {
            if (this.shadow !== null) GroundShadows.removeLoc(this.shadow, this.shadowX, this.shadowY, this.shadowZ);
            this.lastLocId = -1;
            this.lastFrame = frame;
            this.shadow = null;
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'dc.F(' + frame + ')');
        }
    }

    // ml.a(ZI)Lug; (the model build of NXT ClientLocAnim::GetTempModel)
    // Resolves the multiloc variant (null when there is none), re-picks the sequence for a multiloc when the variant's
    // animation changed (GameVariant.id != 0 only), advances the animation at the footprint centre, then builds the
    // model on the ground heightmap (averaged footprint corner heights, centre fine position) with the next layer's
    // heightmap (or the main layer 0 heightmap while underwater) for hill skew: LocType.GetTempModel while seq is set,
    // LocType.GetModel otherwise. var13 says whether the shadow needs rebuilding; with var1 set the build is skipped
    // (null) unless it does. var1 is a real flag: GetTempModel, the only caller, passes false. Stripped: the int dummy
    // var2. That caller passes 0, so `if (var2 != 0) this.O = 120` never runs.
    private GetTempModel2(var1: boolean): ModelSource | null {
        const var3 = world.mainGroundh !== world.levelHeightmaps;
        const hardware = glJar && GlRenderer.active;
        let var4: LocType | null = LocType.List(this.index);
        const var5 = var4.animation;
        if (var4.multi !== null) {
            var4 = var4.GetMultiLoc();
        }

        if (var4 === null) {
            if (hardware && !var3) this.removeShadow(-1);
            return null;
        }

        if (GameVariant.id !== 0 && this.hasMulti && (this.seq === null || (this.seq !== null && var4.animation !== this.seq.id))) {
            let var6 = var4.animation;
            if (var4.animation === -1) {
                var6 = var5;
            }

            if (var6 !== -1) {
                this.seq = SeqType.List(var6);
            } else {
                this.seq = null;
            }

            if (this.seq !== null) {
                if (var4.randomAnimFrame && this.seq.m_loops !== -1) {
                    this.frame = doubleToInt(mathRandom.nextDouble() * requireNonNull(this.seq.frames).length);
                    this.cycle = (this.cycle - doubleToInt(mathRandom.nextDouble() * arrayAtI32(this.seq.delays, this.frame))) | 0;
                } else {
                    this.frame = 0;
                    this.cycle = (-1 + Client.loopCycle) | 0;
                }
            }
        }

        let var7: number;
        let var8: number;
        const var23 = 3 & this.angle;
        if (var23 === 1 || var23 === 3) {
            var8 = var4.width;
            var7 = var4.length;
        } else {
            var8 = var4.length;
            var7 = var4.width;
        }

        const var9 = (this.x + (var7 >> 1)) | 0;
        const var10 = ((((1 + var7) | 0) >> 1) + this.x) | 0;
        const var11 = (this.z + (var8 >> 1)) | 0;
        const var12 = (this.z + (((var8 + 1) | 0) >> 1)) | 0;
        this.advanceFrame(Math.imul(128, var9), Math.imul(var11, 128));
        const var13 =
            !var3 && var4.flag88 && (this.lastLocId !== var4.id || ((this.frame !== this.lastFrame || (this.seq !== null && (this.seq.flag16 || SeqType.forceTween) && this.frame !== this.nextFrame)) && Preferences.graphics.sceneryShadows >= 2));
        if (var1 && !var13) {
            return null;
        }

        const var14 = arrayAtObj(world.levelHeightmaps, this.level);
        const var15 = (arrayAtI32(arrayAtObj(var14, var9), var11) + arrayAtI32(arrayAtObj(var14, var10), var11) + arrayAtI32(arrayAtObj(var14, var9), var12) + arrayAtI32(arrayAtObj(var14, var10), var12)) >> 2;
        const var16 = ((this.x << 7) + (var7 << 6)) | 0;
        const var17 = ((this.z << 7) + (var8 << 6)) | 0;
        let var18: Int32Array[] | null = null;
        if (var3) {
            var18 = arrayAtObj(world.mainGroundh, 0);
        } else if (this.level < 3) {
            var18 = arrayAtObj(world.levelHeightmaps, (this.level + 1) | 0);
        }

        if (hardware && var13) GroundShadows.removeLoc(this.shadow, this.shadowX, this.shadowY, this.shadowZ);
        const var19 = this.shadow === null;
        let result: LocEntity | null;
        if (this.seq !== null) {
            result = var4.GetTempModel(var15, this.shape, this.nextFrame, this.frameCycle, var17, var16, var14, this.angle, var13, this.frame, var19 ? ClientLocAnim.defaultShadow : this.shadow, var18, this.seq);
        } else {
            result = var4.GetModel(var18, this.shape, this.angle, var15, false, var14, !var19 ? this.shadow : ClientLocAnim.defaultShadow, var17, var16, var13);
        }
        if (result === null) return null;
        if (hardware && var13) {
            if (var19) ClientLocAnim.defaultShadow = result.shadow;
            let shadowY = 0;
            if (this.level !== 0) {
                const surface = arrayAtObj(world.levelHeightmaps, 0);
                shadowY = (var15 - ((arrayAtI32(arrayAtObj(surface, var10), var11) + arrayAtI32(arrayAtObj(surface, var9), var11) - (-arrayAtI32(arrayAtObj(surface, var9), var12) - arrayAtI32(arrayAtObj(surface, var10), var12))) >> 2)) | 0;
            }
            const stamp = result.shadow;
            if (this.checkShadow && GroundShadows.testLoc(stamp, var16, shadowY, var17)) this.checkShadow = false;
            if (!this.checkShadow) {
                GroundShadows.addLoc(stamp, var16, shadowY, var17);
                this.shadow = stamp;
                this.shadowZ = var17;
                if (var19) ClientLocAnim.defaultShadow = null;
                this.shadowY = shadowY;
                this.shadowX = var16;
            }
            this.lastLocId = var4.id;
            this.lastFrame = this.frame;
        }
        return result.model;
    }

    // ml.b()I
    override getMinY(): number {
        return this.minY;
    }

    // ml.a(IIIIIIIIJILue;)V
    // Draws the current model with this entity's own particle system (never set) in place of var12.
    override draw(var1: number, var2: number, var3: number, var4: number, var5: number, var6: number, var7: number, var8: number, var9: bigint, var11: number, _var12: ParticleSystem | null): void {
        const var13 = this.GetTempModel();
        if (var13 !== null) {
            var13.draw(var1, var2, var3, var4, var5, var6, var7, var8, var9, var11, this.particles);
        }
    }

    // ml.a(IIIII)V
    // Advances the animation with var4/var5 as the sound position.
    override update(_var1: number, _var2: number, _var3: number, var4: number, var5: number): void {
        if (glJar && GlRenderer.active) this.GetTempModel2(true);
        else this.advanceFrame(var4, var5);
    }
}
