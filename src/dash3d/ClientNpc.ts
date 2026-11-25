import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import { glJar } from '#/client/ClientVariant';
import ActorSlotAnim from './ActorSlotAnim';
import SeqType from '#/config/SeqType';
import ClientApp from '#/client/Client';
import type NpcType from '#/config/NpcType';
import GameVariant from '#/client/GameVariant';
import { arrayAtI32, arrayAtObj, requireNonNull } from '#/util/JavaArray';
import ClientEntity from './ClientEntity';
import SpotType from '#/config/SpotType';
import Preferences from '#/ui/Preferences';
import type ModelLit from './ModelLit';
import ModelLitImpl from './ModelLitImpl';
import type ParticleSystem from './ParticleSystem';
import World from './world';
import LocalisedTextClass from '#/ui/LocalisedText';
import GlRenderer from '#/gl/GlRenderer';
import { loadCookieStatics, loadProtocol } from '#/util/GamepackClasses';

// bk, the per-NPC entity.
export default class ClientNpc extends ClientEntity {
    // HD km.e(I)V
    static releaseClientNpcStatics(guard: number): void {
        try {
            const Client = ClientApp;
            releaseReferences(Client, 'updatedVarcs');
            const CookieStatics = loadCookieStatics();
            releaseReferences(CookieStatics, 'mar', 'nov', 'jan');
            if (guard !== -3) {
                return;
            }
            releaseReferences(Client, 'instrumentsArchive');
            const world = World;
            releaseReferences(world, 'preTab');
            releaseReferences(CookieStatics, 'oct');
            const LocalisedText = LocalisedTextClass;
            releaseReferences(LocalisedText, 'frenchChateffect1');
            const Protocol = loadProtocol();
            releaseReferences(Protocol, 'tradeTag');
            releaseReferences(CookieStatics, 'apr');
            releaseReferences(Client, 'imageHeadiconsPrayer');
            releaseReferences(CookieStatics, 'dec');
            releaseReferences(Client, 'loginScreenName');
            releaseReferences(CookieStatics, 'feb', 'aug');
            releaseReferences(LocalisedText, 'defaultChatcol8');
            releaseReferences(Client, 'enumsArchive');
            releaseReferences(LocalisedText, 'englishChatcol8');
            releaseReferences(CookieStatics, 'monthNames', 'may');
            releaseReferences(LocalisedText, 'chatcol8');
            releaseReferences(CookieStatics, 'jul', 'sep', 'jun');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'km.N(' + guard + ')');
        }
    }

    npcType: NpcType | null = null; // bk.mc:Lja;

    // bk.<init>()V
    constructor() {
        super();
    }

    // bk.b()I (overrides ug.b()I)
    getMinY(): number {
        return this.modelMinY;
    }

    // bk.a(IIIIIIIIJILue;)V (overrides ug.a(IIIIIIIIJILue;)V)
    // NXT ClientNpc::GetTempModel (clientnpc.h) is the model half of this body. 530 builds and draws in one method, so it
    // keeps ModelSource's draw name. The steps:
    //   1. Build the NpcType model: the primary seq only while its delay is 0, and the walk seq unless it is the BAS ready
    //      anim and a primary seq plays.
    //   2. Record its min Y.
    //   3. Character shadows on and the (multinpc-resolved) type allows a shadow: draw the shadow model, sized and tinted
    //      by the type, at typecode -1 with the actor's particles.
    //   4. Apply ob's roll/pitch lean and hill tilt.
    //   5. Append the spot anim model, hill-skewed when its SpotType says so.
    //   6. Draw with the actor's particles (ob.Y, not var12). useAABBMouseCheck is set only for a size-1 NPC.
    // The requireNonNull on the resolved variant mirrors Java's getfield ja.jb, which only runs when shadows are on; a
    // null variant has already made GetTempModel return null, so it cannot fire with unchanged varps.
    // Callee dummies at these call sites: tb.b -32 (SeqType.List), ob.f -87 (getBasType), ja.a -105
    // (NpcType.GetTempModel), ja.b -1 (GetMultiNpc), bf.b -17177 (SpotType.List), li.a -50 (SpotType.GetTempModel),
    // ob.a(BLnd;)V 123, ob.a(ILnd;Z)V true, kc.a true.
    draw(var1: number, var2: number, var3: number, var4: number, var5: number, var6: number, var7: number, var8: number, var9: bigint, var11: number, _var12: ParticleSystem | null): void {
        if (this.npcType === null) {
            return;
        }

        const var13 = this.seq !== -1 && this.seqDelay === 0 ? SeqType.List(this.seq) : null;
        const var14 = this.walkSeq !== -1 && (this.walkSeq !== this.getBasType().ready || var13 === null) ? SeqType.List(this.walkSeq) : null;
        let var15 = this.npcType.GetTempModel(this.modelAnims, this.seqFrame, var13, this.walkCycle, this.seqNext, this.seqCycle, this.walkNext, this.walkFrame, var14);
        if (var15 === null) {
            return;
        }

        this.modelMinY = var15.getMinY();
        let var16: NpcType | null = this.npcType;
        if (var16.multi !== null) {
            var16 = var16.GetMultiNpc();
        }

        if (Preferences.graphics.characterShadows && !Preferences.enhancedGraphicsEnabled && requireNonNull(var16).spotShadow) {
            const var17 = ClientEntity.getShadowModel(
                this.z,
                this.npcType.m_gridSize,
                var15,
                this.npcType.shadowModifier2,
                this.npcType.shadowColour1,
                this.npcType.shadowColour2,
                var14 === null ? var13 : var14,
                this.x,
                this.stretches,
                var1,
                this.npcType.shadowModifier1,
                var14 !== null ? this.walkFrame : this.seqFrame,
                this.sceneHeight
            );
            if (glJar && GlRenderer.active) {
                const renderer = GlRenderer;
                const distance = renderer.getDepthBiasDistance();
                const bias = renderer.getDepthBias();
                renderer.disableDepthWrite();
                renderer.setDepthBias(distance, Math.fround(bias - 150));
                requireNonNull(var17).draw(0, var2, var3, var4, var5, var6, var7, var8, -1n, var11, this.particles);
                renderer.enableDepthWrite();
                renderer.setDepthBias(distance, bias);
            } else {
                requireNonNull(var17).draw(0, var2, var3, var4, var5, var6, var7, var8, -1n, var11, this.particles);
            }
        }

        let var20: ModelLit | null = null;
        this.updateRollPitch(var15);
        this.CalculateHillRotateTransform(var1, var15);
        if (this.spotanim !== -1 && this.spotFrame !== -1) {
            const var18 = SpotType.List(this.spotanim);
            var20 = var18.GetTempModel(this.spotNext, this.spotCycle, this.spotFrame);
            if (var20 !== null) {
                var20.Translate(0, -this.spotHeight | 0, 0);
                if (var18.hillSkew) {
                    if (ClientEntity.tiltPitch !== 0) {
                        var20.RotateXAxis(ClientEntity.tiltPitch);
                    }

                    if (ClientEntity.groundTiltRoll !== 0) {
                        var20.rotateZAxis(ClientEntity.groundTiltRoll);
                    }

                    if (ClientEntity.tiltOffsetY !== 0) {
                        var20.Translate(0, ClientEntity.tiltOffsetY, 0);
                    }
                }
            }
        }

        if (glJar && GlRenderer.active) {
            if (this.npcType.m_gridSize === 1) var15.useAABBMouseCheck = true;
            var15.draw(var1, var2, var3, var4, var5, var6, var7, var8, var9, var11, this.particles);
            if (var20 !== null) {
                if (this.npcType.m_gridSize === 1) var20.useAABBMouseCheck = true;
                var20.draw(var1, var2, var3, var4, var5, var6, var7, var8, var9, var11, this.particles);
            }
        } else {
            if (var20 !== null) {
                if (!(var15 instanceof ModelLitImpl)) throw new TypeError('ClassCastException: not a ModelLitImpl');
                var15 = var15.AppendModel(var20);
            }

            if (this.npcType.m_gridSize === 1) {
                var15.useAABBMouseCheck = true;
            }

            var15.draw(var1, var2, var3, var4, var5, var6, var7, var8, var9, var11, this.particles);
        }
    }

    // bk.b(I)I
    getBasId(): number {
        if (GameVariant.id !== 0 && requireNonNull(this.npcType).multi !== null) {
            const type = requireNonNull(this.npcType).GetMultiNpc();
            if (type !== null && type.m_baseAnimationSet !== -1) return type.m_baseAnimationSet;
        }
        return this.bas;
    }

    // bk.a(BLja;)V
    setType(type: NpcType | null): void {
        this.npcType = type;
        if (this.particles !== null) this.particles.reset();
    }

    // SD bk.a(IIIII)V, HD km.a(IIIII)V. Both gamepacks read the NPC type before returning.
    override update(angle: number, plane: number, x: number, z: number, time: number): void {
        try {
            if (this.npcType === null) return;
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, (glJar ? 'km.IB(' : 'bk.E(') + angle + ',' + plane + ',' + x + ',' + z + ',' + time + ')');
        }
    }

    // bk.d(B)Z
    override isVisible(): boolean {
        return this.npcType !== null;
    }

    // m.a(IIBLbk;)V
    static setPrimarySeq(delay: number, seq: number, p: ClientNpc): void {
        if (seq === p.seq && seq !== -1) {
            const type = SeqType.List(seq);
            const replayMode = type.m_duplicateBehaviour;
            if (replayMode === 1) {
                p.seqDelay = delay;
                p.seqFrame = 0;
                p.seqNext = 1;
                p.seqCycle = 0;
                p.seqLoops = 0;
                ClientApp.TriggerSeqSound(type, p.z, p.x, false, p.seqFrame);
            }
            if (replayMode === 2) p.seqLoops = 0;
        } else if (seq === -1 || p.seq === -1 || SeqType.List(seq).m_priority >= SeqType.List(p.seq).m_priority) {
            p.seqFrame = 0;
            p.seqCycle = 0;
            p.seqLoops = 0;
            p.seq = seq;
            p.seqNext = 1;
            p.seqPathLength = p.pathLength;
            p.seqDelay = delay;
            if (p.seq !== -1) ClientApp.TriggerSeqSound(SeqType.List(p.seq), p.z, p.x, false, p.seqFrame);
        }
    }

    // ik.a(Lbk;[II[I[I)V
    static applySlotAnims(npc: ClientNpc | null, delays: Int32Array | null, start: number, slots: Int32Array | null, seqs: Int32Array | null, guard = 92): void {
        if (glJar) return ClientNpc.applyNpcSlots(slots, guard, npc, delays, seqs);
        for (let i = start; i < requireNonNull(seqs).length; i++) {
            const seq = arrayAtI32(seqs, i);
            let mask = arrayAtI32(slots, i);
            const delay = arrayAtI32(delays, i);
            for (let index = 0; mask !== 0 && requireNonNull(npc).modelAnims.length > index; index++) {
                const p = requireNonNull(npc);
                if ((mask & 1) !== 0) {
                    if (seq !== -1) {
                        const type = SeqType.List(seq);
                        let slot = arrayAtObj(p.modelAnims, index);
                        const replay = type.m_duplicateBehaviour;
                        if (slot !== null) {
                            if (slot.seq === seq) {
                                if (replay !== 0) {
                                    if (replay === 1) {
                                        slot.frame = 0;
                                        slot.delay = delay;
                                        slot.next = 1;
                                        slot.loops = 0;
                                        slot.cycle = 0;
                                        ClientApp.TriggerSeqSound(type, p.z, p.x, false, 0);
                                    } else if (replay === 2) slot.loops = 0;
                                } else slot = p.modelAnims[index] = null;
                            } else if (type.m_priority >= SeqType.List(slot.seq).m_priority) slot = p.modelAnims[index] = null;
                        }
                        if (slot === null) {
                            slot = p.modelAnims[index] = new ActorSlotAnim();
                            slot.next = 1;
                            slot.seq = seq;
                            slot.delay = delay;
                            slot.cycle = 0;
                            slot.frame = 0;
                            slot.loops = 0;
                            ClientApp.TriggerSeqSound(type, p.z, p.x, false, 0);
                        }
                    } else p.modelAnims[index] = null;
                }
                mask >>>= 1;
            }
        }
    }

    // HD mi.a([IBLkm;[I[I)V
    private static applyNpcSlots(masks: Int32Array | null, guard: number, npc: ClientNpc | null, delays: Int32Array | null, seqs: Int32Array | null): void {
        try {
            if (guard <= 81) return;
            for (let i = 0; i < requireNonNull(seqs).length; i++) {
                const seq = arrayAtI32(seqs, i);
                let mask = arrayAtI32(masks, i);
                const delay = arrayAtI32(delays, i);
                let index = 0;
                while (mask !== 0 && index < requireNonNull(npc).modelAnims.length) {
                    const actor = requireNonNull(npc);
                    if ((mask & 1) !== 0 && seq === -1) actor.modelAnims[index] = null;
                    else if ((mask & 1) !== 0) {
                        const type = SeqType.List(seq);
                        let slot = arrayAtObj(actor.modelAnims, index);
                        const replay = type.m_duplicateBehaviour;
                        if (slot !== null) {
                            if (slot.seq !== seq) {
                                if (type.m_priority >= SeqType.List(slot.seq).m_priority) slot = actor.modelAnims[index] = null;
                            } else if (replay === 0) slot = actor.modelAnims[index] = null;
                            else if (replay === 1) {
                                slot.frame = 0;
                                slot.loops = 0;
                                slot.next = 1;
                                slot.cycle = 0;
                                slot.delay = delay;
                                ClientApp.TriggerSeqSound(type, actor.z, actor.x, false, 0);
                            } else if (replay === 2) slot.loops = 0;
                        }
                        if (slot === null) {
                            slot = actor.modelAnims[index] = new ActorSlotAnim();
                            slot.next = 1;
                            slot.cycle = 0;
                            slot.delay = delay;
                            slot.seq = seq;
                            slot.loops = 0;
                            slot.frame = 0;
                            ClientApp.TriggerSeqSound(type, actor.z, actor.x, false, 0);
                        }
                    }
                    mask >>>= 1;
                    index++;
                }
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            const args = [masks, guard, npc, delays, seqs].map(value => (typeof value === 'number' ? value : value === null ? 'null' : '{...}'));
            throw WrappedException.wrap(error, 'mi.B(' + args.join(',') + ')');
        }
    }
}
