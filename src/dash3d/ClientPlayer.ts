import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import { glJar } from '#/client/ClientVariant';
import ActorSlotAnim from './ActorSlotAnim';
import SeqType from '#/config/SeqType';
import ClientApp from '#/client/Client';
import type PacketT from '#/io/PacketT';
import ObjType from '#/config/ObjType';
import NpcType from '#/config/NpcType';
import JagString from '#/datastruct/JagString';
import PlayerModel from './PlayerModel';
import AreaSoundManager from '#/sound/AreaSoundManager';
import { arrayAtI32, arrayAtObj, arrayPutObj, requireNonNull } from '#/util/JavaArray';
import ClientEntity from './ClientEntity';
import SpotType from '#/config/SpotType';
import HintArrow from '#/client/HintArrow';
import Preferences from '#/ui/Preferences';
import { doubleToInt } from '#/util/IntUtils';
import ClientLocAnim from './ClientLocAnim';
import ModelLit from './ModelLit';
import ModelLitImpl from './ModelLitImpl';
import type ParticleSystem from './ParticleSystem';
import LocalisedTextClass from '#/ui/LocalisedText';
import GlRenderer from '#/gl/GlRenderer';
import GameShell from '#/client/GameShell';
import World from './world';
import { loadInterfaceList, loadMinimenu, loadRoofModeStatics, loadWorldMapLabels } from '#/util/GamepackClasses';

// pb
export default class ClientPlayer extends ClientEntity {
    // HD e.d(B)V
    static releaseClientPlayerStatics(guard: number): void {
        try {
            const Client = ClientApp;
            releaseReferences(Client, 'wtqaHost');
            const LocalisedText = LocalisedTextClass;
            releaseReferences(LocalisedText, 'frenchLoadedInputHandler');
            const Minimenu = loadMinimenu();
            releaseReferences(Minimenu, 'tooltipBounds');
            releaseReferences(Client, 'tweenEnabled');
            const RoofModeStatics = loadRoofModeStatics();
            releaseReferences(RoofModeStatics, 'roofMaxZ');
            if (guard <= 116) {
                ClientPlayer.releaseClientPlayerStatics(-48);
            }
            const InterfaceList = loadInterfaceList();
            releaseReferences(InterfaceList, 'rootY');
            const WorldMapLabels = loadWorldMapLabels();
            releaseReferences(WorldMapLabels, 'suffix');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'e.R(' + guard + ')');
        }
    }

    static readonly nameAffixSlotCounts = Int32Array.of(1, 4); // cg.m:[I
    static titlePrefixes: (JagString | null)[] | null = null; // jb.N:[Lid;
    static nameSuffixes: (JagString | null)[] | null = null; // hh.bb:[Lid;
    static debugBallast: (Uint8Array | null)[] | null = null; // oh.g:[[B
    static memoryPaddingCount = 0; // vg.Q:I
    soundRadius = 0; // pb.ic:I
    skullIcon = -1; // pb.jc:I
    lowDetail = false; // pb.lc:Z
    slowSound = -1; // pb.mc:I
    appearance: PlayerModel | null = null; // pb.pc:Lcl;
    combatLevelWithSummoning = 0; // pb.qc:I
    skillLevel = 0; // pb.rc:I
    combatLevel = 0; // pb.uc:I
    runSound = -1; // pb.vc:I
    combatRange = -1; // pb.zc:I
    headIcon = -1; // pb.Ac:I
    team = 0; // pb.Bc:I
    walkSound = -1; // pb.Ec:I
    username: JagString | null = null; // pb.Gc:Lid;
    idleSound = -1; // pb.Lc:I
    title = 0; // pb.Mc:I

    // pb.<init>()V
    constructor() {
        super();
    }

    // pb.a(IIIII)V (overrides ug.a(IIIII)V; the body is only the stripped invocation counter)
    update(_a: number, _b: number, _c: number, _d: number, _e: number): void {}

    // pb.g(B)I
    override getSize(): number {
        return this.appearance !== null && this.appearance.npcId !== -1 ? NpcType.List(this.appearance.npcId).m_gridSize : super.getSize();
    }

    // pb.b(I)I
    getBasId(): number {
        return this.bas;
    }

    // pb.d(B)Z
    override isVisible(): boolean {
        return this.appearance !== null;
    }

    // pb.a(ZIII)V
    move(jump: boolean, z: number, x: number): void {
        this.moveSized(this.getSize(), z, x, jump);
    }

    // pb.a(Lgd;I)V
    readAppearance(buf: PacketT): void {
        buf.m_pos = 0;
        const info = buf.g1();
        const sex = info & 1;
        const showSkill = (info & 4) !== 0;
        const previousSize = super.getSize();
        const equipment = new Int32Array(12);
        let npcId = -1;
        this.setSize((((info & 57) >> 3) + 1) | 0);
        this.title = (218 & info) >> 6;
        this.x = (this.x + Math.imul((this.getSize() - previousSize) | 0, 64)) | 0;
        this.z = (this.z + Math.imul((this.getSize() - previousSize) | 0, 64)) | 0;
        this.skullIcon = buf.g1s();
        this.headIcon = buf.g1s();
        this.team = 0;
        for (let i = 0; i < 12; i++) {
            const hi = buf.g1();
            if (hi === 0) equipment[i] = 0;
            else {
                const lo = buf.g1();
                let id = ((hi << 8) + lo) | 0;
                if (i === 0 && id === 65535) {
                    npcId = buf.g2();
                    this.team = buf.g1();
                    break;
                }
                if (id >= 32768) {
                    id = arrayAtI32(ObjType.wearables, (id - 32768) | 0);
                    equipment[i] = 0x40000000 | id;
                    const team = ObjType.List(id).team;
                    if (team !== 0) this.team = team;
                } else equipment[i] = (id - 256) | 0 | -2147483648;
            }
        }
        const colours = new Int32Array(5);
        for (let i = 0; i < 5; i++) {
            let colour = buf.g1();
            if (colour < 0 || arrayAtObj(PlayerModel.recolourDestinations, i).length <= colour) colour = 0;
            colours[i] = colour;
        }
        this.bas = buf.g2();
        const name = buf.g8();
        this.username = requireNonNull(JagString.fromBase37(name)).formatName(0);
        this.combatLevel = buf.g1();
        if (!showSkill) {
            this.skillLevel = 0;
            this.combatLevelWithSummoning = buf.g1();
            this.combatRange = buf.g1();
            if (this.combatRange === 255) this.combatRange = -1;
        } else {
            this.skillLevel = buf.g2();
            this.combatLevelWithSummoning = this.combatLevel;
            this.combatRange = -1;
        }
        const oldRadius = this.soundRadius;
        this.soundRadius = buf.g1();
        if (this.soundRadius === 0) AreaSoundManager.removePlayer(this);
        else {
            const oldSlow = this.slowSound,
                oldIdle = this.idleSound,
                oldWalk = this.walkSound,
                oldRun = this.runSound;
            this.idleSound = buf.g2();
            this.slowSound = buf.g2();
            this.walkSound = buf.g2();
            this.runSound = buf.g2();
            if (this.soundRadius !== oldRadius || oldIdle !== this.idleSound || this.slowSound !== oldSlow || oldWalk !== this.walkSound || this.runSound !== oldRun) AreaSoundManager.updatePlayer(this, ClientApp.playerLevel);
        }
        if (this.appearance === null) this.appearance = new PlayerModel();
        const previousNpc = this.appearance.npcId;
        this.appearance.setAppearance(sex === 1, colours, this.bas, equipment, npcId);
        if (npcId !== previousNpc) {
            this.x = (Math.imul(arrayAtI32(this.pathX, 0), 128) + Math.imul(this.getSize(), 64)) | 0;
            this.z = (Math.imul(128, arrayAtI32(this.pathZ, 0)) + Math.imul(64, this.getSize())) | 0;
        }
        if (this.particles !== null) this.particles.reset();
    }

    // pb.a(IIIIIIIIJILue;)V (overrides ug.a(IIIIIIIIJILue;)V)
    // NXT ClientPlayer::GetTempModel (clientplayer.h) is the model half of this body. 530 builds and draws in one
    // method, so it keeps ModelSource's draw name. The steps:
    //   1. Build the appearance model (PlayerModel.GetTempModel): the primary seq only while its delay is 0, and the
    //      walk seq unless lowDetail or (it is the BAS ready anim and a primary seq plays).
    //   2. modewhat != 0 only: grow or shrink the debug ballast to 50 minus the body-cache hard count.
    //   3. Record the model's min Y.
    //   4. Character shadows on (and, for an NPC transform, the NpcType allows it): draw the shadow model at typecode
    //      -1 with no particles.
    //   5. Local player only: draw each NPC, tile and player hint arrow (private drawHintArrow).
    //   6. Apply ob's roll/pitch lean and hill tilt.
    //   7. Append the spot anim model (hill-skewed when its SpotType says so) and the attached loc model (a ModelLit or
    //      a ClientLocAnim's current model, moved to the attachment offset and turned by targetYaw while the loopCycle
    //      is inside its window).
    //   8. Draw with useAABBMouseCheck and the actor's particles (ob.Y, not var12).
    //   9. Undo the attachment's turn and offset.
    // Callee dummies at these call sites (stripped by their own ports): tb.b -32 (SeqType.List), ob.f -74
    // (getBasType), uk.a 91 (NpcType.List), bf.b -17177 (SpotType.List), li.a -71 (SpotType.GetTempModel), ob.a(BLnd;)V
    // -118, ob.a(ILnd;Z)V true, kc.a true, uf.a false (PlayerModel.modelCacheCount).
    draw(var1: number, var2: number, var3: number, var4: number, var5: number, var6: number, var7: number, var8: number, var9: bigint, var11: number, _var12: ParticleSystem | null): void {
        if (this.appearance === null) {
            return;
        }

        const var13 = this.seq !== -1 && this.seqDelay === 0 ? SeqType.List(this.seq) : null;
        const var14 = this.walkSeq !== -1 && !this.lowDetail && (this.walkSeq !== this.getBasType().ready || var13 === null) ? SeqType.List(this.walkSeq) : null;
        let var15 = this.appearance.GetTempModel(this.walkFrame, this.seqNext, var13, this.seqFrame, true, this.modelAnims, this.walkCycle, this.seqCycle, true, var14, this.walkNext);
        const var16 = PlayerModel.modelCacheCount();
        if (glJar && GlRenderer.active && GameShell.maxMemory < 96 && var16 > 50) {
            World.releaseGlModels();
        }
        if (ClientApp.modewhat !== 0 && var16 < 50) {
            const var17 = (50 - var16) | 0;
            while (ClientPlayer.memoryPaddingCount < var17) {
                arrayPutObj(ClientPlayer.debugBallast, ClientPlayer.memoryPaddingCount, new Uint8Array(102400));
                ClientPlayer.memoryPaddingCount = (ClientPlayer.memoryPaddingCount + 1) | 0;
            }

            while (ClientPlayer.memoryPaddingCount > var17) {
                ClientPlayer.memoryPaddingCount = (ClientPlayer.memoryPaddingCount - 1) | 0;
                arrayPutObj(ClientPlayer.debugBallast, ClientPlayer.memoryPaddingCount, null);
            }
        }

        if (var15 === null) {
            return;
        }

        this.modelMinY = var15.getMinY();
        if (Preferences.graphics.characterShadows && !Preferences.enhancedGraphicsEnabled && (this.appearance.npcId === -1 || NpcType.List(this.appearance.npcId).spotShadow)) {
            const var24 = ClientEntity.getShadowModel(this.z, 1, var15, 240, 0, 0, var14 !== null ? var14 : var13, this.x, this.stretches, var1, 160, var14 !== null ? this.walkFrame : this.seqFrame, this.sceneHeight);
            if (glJar && GlRenderer.active) {
                const renderer = GlRenderer;
                const distance = renderer.getDepthBiasDistance();
                const bias = renderer.getDepthBias();
                renderer.disableDepthWrite();
                renderer.setDepthBias(distance, Math.fround(bias - 150));
                requireNonNull(var24).draw(0, var2, var3, var4, var5, var6, var7, var8, -1n, var11, null);
                renderer.enableDepthWrite();
                renderer.setDepthBias(distance, bias);
            } else {
                requireNonNull(var24).draw(0, var2, var3, var4, var5, var6, var7, var8, -1n, var11, null);
            }
        }

        if (this === ClientApp.localPlayer) {
            for (let var25 = (ClientApp.hintArrows.length - 1) | 0; var25 >= 0; var25--) {
                const var18 = arrayAtObj(ClientApp.hintArrows, var25);
                if (var18 !== null && var18.model !== -1) {
                    if (var18.type === 1 && var18.actor >= 0 && ClientApp.npcs.length > var18.actor) {
                        const var19 = arrayAtObj(ClientApp.npcs, var18.actor);
                        if (var19 !== null) {
                            const var20 = (((var19.x / 32) | 0) - ((requireNonNull(ClientApp.localPlayer).x / 32) | 0)) | 0;
                            const var21 = (((var19.z / 32) | 0) - ((requireNonNull(ClientApp.localPlayer).z / 32) | 0)) | 0;
                            this.drawHintArrow(var21, var8, var6, var18.model, var7, var20, var2, null, var4, var3, var1, var11, var5, var15);
                        }
                    }

                    if (var18.type === 2) {
                        let var29: number;
                        let var31: number;
                        if (glJar) {
                            var29 = (Math.imul(4, (-ClientApp.mapBuildBaseX + var18.x) | 0) + (2 - ((requireNonNull(ClientApp.localPlayer).x / 32) | 0))) | 0;
                            var31 = (2 + (Math.imul(4, (var18.z - ClientApp.mapBuildBaseZ) | 0) - ((requireNonNull(ClientApp.localPlayer).z / 32) | 0))) | 0;
                        } else {
                            var31 = (-((requireNonNull(ClientApp.localPlayer).z / 32) | 0) + 2 + Math.imul((-ClientApp.mapBuildBaseZ + var18.z) | 0, 4)) | 0;
                            var29 = (-((requireNonNull(ClientApp.localPlayer).x / 32) | 0) + (2 + Math.imul((-ClientApp.mapBuildBaseX + var18.x) | 0, 4))) | 0;
                        }
                        this.drawHintArrow(var31, var8, var6, var18.model, var7, var29, var2, null, var4, var3, var1, var11, var5, var15);
                    }

                    if (var18.type === 10 && var18.actor >= 0 && var18.actor < ClientApp.players.length) {
                        const var30 = arrayAtObj(ClientApp.players, var18.actor);
                        if (var30 !== null) {
                            const var33 = (((var30.z / 32) | 0) - ((requireNonNull(ClientApp.localPlayer).z / 32) | 0)) | 0;
                            const var32 = (((var30.x / 32) | 0) - ((requireNonNull(ClientApp.localPlayer).x / 32) | 0)) | 0;
                            this.drawHintArrow(var33, var8, var6, var18.model, var7, var32, var2, null, var4, var3, var1, var11, var5, var15);
                        }
                    }
                }
            }
        }

        this.updateRollPitch(var15);
        let var26: ModelLit | null = null;
        this.CalculateHillRotateTransform(var1, var15);
        if (!this.lowDetail && this.spotanim !== -1 && this.spotFrame !== -1) {
            const var27 = SpotType.List(this.spotanim);
            var26 = var27.GetTempModel(this.spotNext, this.spotCycle, this.spotFrame);
            if (var26 !== null) {
                var26.Translate(0, -this.spotHeight | 0, 0);
                if (var27.hillSkew) {
                    if (ClientEntity.tiltPitch !== 0) {
                        var26.RotateXAxis(ClientEntity.tiltPitch);
                    }

                    if (ClientEntity.groundTiltRoll !== 0) {
                        var26.rotateZAxis(ClientEntity.groundTiltRoll);
                    }

                    if (ClientEntity.tiltOffsetY !== 0) {
                        var26.Translate(0, ClientEntity.tiltOffsetY, 0);
                    }
                }
            }
        }

        let var28: ModelLit | null = null;
        if (!this.lowDetail && this.attachment !== null) {
            if (ClientApp.loopCycle >= this.attachmentEnd) {
                this.attachment = null;
            }

            if (this.attachmentStart <= ClientApp.loopCycle && ClientApp.loopCycle < this.attachmentEnd) {
                // checkcast nd on the field (a ModelLit) or on the ClientLocAnim's current model; null passes the cast and
                // throws at the Translate below.
                if (!(this.attachment instanceof ClientLocAnim)) {
                    const var34 = this.attachment;
                    if (var34 !== null && !(var34 instanceof ModelLit)) throw new TypeError('ClassCastException: not a ModelLit');
                    var28 = var34;
                } else {
                    const var35 = this.attachment.GetTempModel();
                    if (var35 !== null && !(var35 instanceof ModelLit)) throw new TypeError('ClassCastException: not a ModelLit');
                    var28 = var35;
                }

                const var36 = requireNonNull(var28);
                var36.Translate((this.attachmentX - this.x) | 0, (this.attachmentHeight - this.sceneHeight) | 0, (this.attachmentZ - this.z) | 0);
                if (this.targetYaw === 512) {
                    var36.Rotate270();
                } else if (this.targetYaw === 1024) {
                    var36.Rotate180();
                } else if (this.targetYaw === 1536) {
                    var36.Rotate90();
                }
            }
        }

        if (glJar && GlRenderer.active) {
            var15.useAABBMouseCheck = true;
            var15.draw(var1, var2, var3, var4, var5, var6, var7, var8, var9, var11, this.particles);
            if (var26 !== null) {
                var26.useAABBMouseCheck = true;
                var26.draw(var1, var2, var3, var4, var5, var6, var7, var8, var9, var11, this.particles);
            }
        } else {
            if (var26 !== null) {
                if (!(var15 instanceof ModelLitImpl)) throw new TypeError('ClassCastException: not a ModelLitImpl');
                var15 = var15.AppendModel(var26);
            }

            if (var28 !== null) {
                if (!(var15 instanceof ModelLitImpl)) throw new TypeError('ClassCastException: not a ModelLitImpl');
                var15 = var15.AppendModel(var28);
            }

            var15.useAABBMouseCheck = true;
            var15.draw(var1, var2, var3, var4, var5, var6, var7, var8, var9, var11, this.particles);
        }
        if (var28 !== null) {
            if (this.targetYaw === 512) {
                var28.Rotate90();
            } else if (this.targetYaw === 1024) {
                var28.Rotate180();
            } else if (this.targetYaw === 1536) {
                var28.Rotate270();
            }

            var28.Translate((this.x - this.attachmentX) | 0, (this.sceneHeight - this.attachmentHeight) | 0, (this.z - this.attachmentZ) | 0);
        }
    }

    // pb.b()I (overrides ug.b()I)
    getMinY(): number {
        return this.modelMinY;
    }

    // pb.c(I)Lid;
    getDisplayName(): JagString | null {
        let name = this.username;
        if (ClientPlayer.titlePrefixes !== null) name = JagString.join([arrayAtObj(ClientPlayer.titlePrefixes, this.title), name]);
        if (ClientPlayer.nameSuffixes !== null) name = JagString.join([name, arrayAtObj(ClientPlayer.nameSuffixes, this.title)]);
        return name;
    }

    // pb.a(IIIBIIIILue;IIIIILnd;)V
    // Draws one hint arrow around the local player (no NXT counterpart: oldscape draws hint arrows in 2D). var1/var7 are
    // the target's z/x offset in 1/4-tile units, var5 the HintArrow model id, var15 the player model it is built against,
    // var9 the particle system (null at every call). var2, var3, var6, var8, var10, var11, var13 and var14 receive the
    // draw's var8, var6, var7, var2, var4, var3, var11 and var5, so the arrow draws with the player's camera arguments.
    // Nothing is drawn when the squared offset is below 16 or above 360000. Otherwise the arrow is built facing
    // atan2(var7, var1) and drawn at yaw 0 with typecode -1.
    // Stripped: the byte dummy var4. All three callers (pb's draw, offsets 552, 651 and 780) pass 16, so
    // `if (var4 != 16) return` never returns. Kept: var12, pb's draw var1, which the body never reads but which is not
    // constant. Callee dummy: ai.a's third int is -124 here (HintArrow.buildArrowModel strips it).
    private drawHintArrow(
        var1: number,
        var2: number,
        var3: number,
        var5: number,
        var6: number,
        var7: number,
        var8: number,
        var9: ParticleSystem | null,
        var10: number,
        var11: number,
        _var12: number,
        var13: number,
        var14: number,
        var15: ModelLit
    ): void {
        const var16 = (Math.imul(var1, var1) + Math.imul(var7, var7)) | 0;
        if (var16 < 16 || var16 > 360000) {
            return;
        }

        const var17 = 2047 & doubleToInt(325.949 * Math.atan2(var7, var1));
        const var18 = HintArrow.buildArrowModel(var17, this.z, var5, var15, this.sceneHeight, this.x);
        if (var18 !== null) {
            if (glJar && GlRenderer.active) {
                const renderer = GlRenderer;
                const distance = renderer.getDepthBiasDistance();
                const bias = renderer.getDepthBias();
                renderer.disableDepthWrite();
                renderer.setDepthBias(distance, Math.fround(bias - 150));
                var18.draw(0, var8, var11, var10, var14, var3, var6, var2, -1n, var13, var9);
                renderer.enableDepthWrite();
                renderer.setDepthBias(distance, bias);
            } else {
                var18.draw(0, var8, var11, var10, var14, var3, var6, var2, -1n, var13, var9);
            }
        }
    }

    // pi.a(B[I[ILpb;[I)V
    static applySlotAnims(seqs: Int32Array | null, delays: Int32Array | null, player: ClientPlayer | null, slots: Int32Array | null, guard = -113): void {
        if (glJar) return ClientPlayer.applyPlayerSlots(delays, seqs, player, guard, slots);
        for (let i = 0; i < requireNonNull(seqs).length; i++) {
            const seq = arrayAtI32(seqs, i),
                delay = arrayAtI32(delays, i);
            let mask = arrayAtI32(slots, i);
            for (let index = 0; mask !== 0 && index < requireNonNull(player).modelAnims.length; index++) {
                const p = requireNonNull(player);
                if ((mask & 1) !== 0) {
                    if (seq !== -1) {
                        const type = SeqType.List(seq),
                            replay = type.m_duplicateBehaviour;
                        let slot = arrayAtObj(p.modelAnims, index);
                        if (slot !== null) {
                            if (seq !== slot.seq) {
                                if (type.m_priority >= SeqType.List(slot.seq).m_priority) slot = p.modelAnims[index] = null;
                            } else if (replay === 0) slot = p.modelAnims[index] = null;
                            else if (replay === 1) {
                                slot.delay = delay;
                                slot.next = 1;
                                slot.frame = 0;
                                slot.loops = 0;
                                slot.cycle = 0;
                                ClientApp.TriggerSeqSound(type, p.z, p.x, ClientApp.localPlayer === p, 0);
                            } else if (replay === 2) slot.loops = 0;
                        }
                        if (slot === null) {
                            slot = p.modelAnims[index] = new ActorSlotAnim();
                            slot.next = 1;
                            slot.cycle = 0;
                            slot.loops = 0;
                            slot.seq = seq;
                            slot.frame = 0;
                            slot.delay = delay;
                            ClientApp.TriggerSeqSound(type, p.z, p.x, ClientApp.localPlayer === p, 0);
                        }
                    } else p.modelAnims[index] = null;
                }
                mask >>>= 1;
            }
        }
    }

    // HD ci.a([I[ILe;B[I)V
    private static applyPlayerSlots(delays: Int32Array | null, seqs: Int32Array | null, player: ClientPlayer | null, guard: number, masks: Int32Array | null): void {
        try {
            if (guard > -97) {
                // eslint-disable-next-line @typescript-eslint/no-require-imports -- The guard is the only path to the native ci teardown.
                const TextureShapeLine = (require('./TextureShapeLine') as typeof import('./TextureShapeLine')).default;
                TextureShapeLine.releaseTextureShapeLineStatics(true);
            }
            for (let i = 0; i < requireNonNull(seqs).length; i++) {
                const seq = arrayAtI32(seqs, i);
                let mask = arrayAtI32(masks, i);
                const delay = arrayAtI32(delays, i);
                let index = 0;
                while (mask !== 0 && index < requireNonNull(player).modelAnims.length) {
                    const actor = requireNonNull(player);
                    if ((mask & 1) !== 0 && seq === -1) actor.modelAnims[index] = null;
                    else if ((mask & 1) !== 0) {
                        const type = SeqType.List(seq);
                        const replay = type.m_duplicateBehaviour;
                        let slot = arrayAtObj(actor.modelAnims, index);
                        if (slot !== null) {
                            if (slot.seq !== seq) {
                                if (type.m_priority >= SeqType.List(slot.seq).m_priority) slot = actor.modelAnims[index] = null;
                            } else if (replay === 0) slot = actor.modelAnims[index] = null;
                            else if (replay === 1) {
                                slot.loops = 0;
                                slot.next = 1;
                                slot.frame = 0;
                                slot.delay = delay;
                                slot.cycle = 0;
                                ClientApp.TriggerSeqSound(type, actor.z, actor.x, actor === ClientApp.localPlayer, 0);
                            } else if (replay === 2) slot.loops = 0;
                        }
                        if (slot === null) {
                            slot = actor.modelAnims[index] = new ActorSlotAnim();
                            slot.seq = seq;
                            slot.next = 1;
                            slot.cycle = 0;
                            slot.delay = delay;
                            slot.frame = 0;
                            slot.loops = 0;
                            ClientApp.TriggerSeqSound(type, actor.z, actor.x, actor === ClientApp.localPlayer, 0);
                        }
                    }
                    index++;
                    mask >>>= 1;
                }
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            const args = [delays, seqs, player, guard, masks].map(value => (typeof value === 'number' ? value : value === null ? 'null' : '{...}'));
            throw WrappedException.wrap(error, 'ci.B(' + args.join(',') + ')');
        }
    }
}
