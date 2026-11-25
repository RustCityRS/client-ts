import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import Linkable from '#/datastruct/Linkable';
import type LocType from '#/config/LocType';
import type ClientEntity from '#/dash3d/ClientEntity';
import type ClientPlayer from '#/dash3d/ClientPlayer';
import type ClientNpc from '#/dash3d/ClientNpc';
import type WaveStream from './WaveStream';
import { requireNonNull } from '#/util/JavaArray';
import AudioEngine from './AudioEngine';
import { loadClient, loadMinimenu, loadScriptRunner } from '#/util/GamepackClasses';

export default class bgsound extends Linkable {
    // HD fl.d(I)V
    static releasebgsoundStatics(guard: number): void {
        try {
            const ScriptRunner = loadScriptRunner();
            releaseReferences(ScriptRunner, 'crownTag0');
            const Minimenu = loadMinimenu();
            releaseReferences(Minimenu, 'closeParen');
            if (guard !== -3) {
                const Client = loadClient();
                Client.varcStrChangeCount = 98;
            }
            releaseReferences(ScriptRunner, 'emptyString');
            const Client = loadClient();
            releaseReferences(Client, 'socketRequest', 'mapBuildKeys');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'fl.D(' + guard + ')');
        }
    }

    // ik.q:[I
    randomIds: Int32Array | null = null;
    // ik.t:I
    delay = 0;
    // ik.u:I
    minDelay = 0;
    // ik.v:I
    maxDelay = 0;
    // ik.x:Ljb;
    loc: LocType | null = null;
    // ik.y:Z
    multi = false;
    // ik.z:Ljc;
    loop: WaveStream | null = null;
    // ik.A:I
    radius = 0;
    // ik.B:I
    maxX = 0;
    // ik.C:I
    minX = 0;
    // ik.E:I
    maxZ = 0;
    // ik.I:Lbk;
    npc: ClientNpc | null = null;
    // ik.J:Ljc;
    random: WaveStream | null = null;
    // ik.K:I
    movement = 0;
    // ik.L:I
    plane = 0;
    // ik.M:I
    minZ = 0;
    // ik.N:I
    sound = 0;
    // ik.S:Lpb;
    player: ClientPlayer | null = null;
    // ik.<init>()V
    constructor() {
        super();
    }
    // tk.a(BIIII)V movement comparisons shared with da.a(ILpb;)I and s.a(BLbk;)I.
    static movementType(actor: ClientEntity): number {
        const bas = actor.getBasType(),
            seq = actor.walkSeq;
        if (seq === bas.ready) return 0;
        if (seq === bas.m_runForward || seq === bas.m_runBackward || seq === bas.m_runRight || seq === bas.m_runLeft) return 2;
        if (seq === bas.m_crawlForward || seq === bas.m_crawlBackward || seq === bas.m_crawlRight || seq === bas.m_crawlLeft) return 3;
        return 1;
    }
    // da.a(ILpb;)I
    static playerSound(player: ClientPlayer): number {
        switch (this.movementType(player)) {
            case 0:
                return player.idleSound;
            case 2:
                return player.runSound;
            case 3:
                return player.slowSound;
            default:
                return player.walkSound;
        }
    }
    // s.a(BLbk;)I
    static npcSound(npc: ClientNpc): number {
        let type = requireNonNull(npc.npcType);
        if (type.multi !== null) {
            const multi = type.GetMultiNpc();
            if (multi === null) return -1;
            type = multi;
        }
        switch (this.movementType(npc)) {
            case 0:
                return type.m_backgroundSoundReady;
            case 2:
                return type.m_backgroundSoundRun;
            case 3:
                return type.m_backgroundSoundCrawl;
            default:
                return type.m_backgroundSoundWalk;
        }
    }
    // ik.a(I)V
    refresh(): void {
        const old = this.sound;
        if (this.loc !== null) {
            const type = this.loc.GetMultiLoc();
            this.radius = type === null ? 0 : Math.imul(type.soundRadius, 128);
            this.sound = type === null ? -1 : type.ambientSound;
            this.randomIds = type === null ? null : type.randomSounds;
            this.minDelay = type === null ? 0 : type.minDelay;
            this.maxDelay = type === null ? 0 : type.maxDelay;
        } else if (this.npc !== null) {
            const sound = bgsound.npcSound(this.npc);
            if (old !== sound) {
                this.sound = sound;
                const type = requireNonNull(this.npc.npcType),
                    multi = type.multi === null ? type : type.GetMultiNpc();
                this.radius = multi === null ? 0 : Math.imul(multi.m_backgroundSoundRange, 128);
            }
        } else if (this.player !== null) {
            this.sound = bgsound.playerSound(this.player);
            this.radius = Math.imul(this.player.soundRadius, 128);
        }
        if (this.sound !== old && this.loop !== null) {
            requireNonNull(AudioEngine.effects).StopStream(this.loop);
            this.loop = null;
        }
    }
}
