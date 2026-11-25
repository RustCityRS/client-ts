import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import ArrayUtils from '#/util/ArrayUtils';
import { glJar } from '#/client/ClientVariant';
import SafeTime from '#/io/SafeTime';
import { arrayAtObj, arrayPutObj, requireNonNull } from '#/util/JavaArray';
import { intDivide } from '#/util/IntUtils';
import type PCMStream from './PCMStream';
import type Signlink from '#/util/Signlink';
import PlayerTask from './PlayerTask';
import { loadClientKeyboardListener, loadCookieStatics, loadInterfaceList, loadLocalisedText, loadQuickChatPhraseType } from '#/util/GamepackClasses';

export default class PCMPlayer {
    // HD vh.c(I)V
    static releasePCMPlayerStatics(guard: number): void {
        try {
            const CookieStatics = loadCookieStatics();
            releaseReferences(CookieStatics, 'timeSeparator');
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'germanConnectingToUpdateServer');
            const QuickChatPhraseType = loadQuickChatPhraseType();
            releaseReferences(QuickChatPhraseType, 'paramCounts');
            if (guard !== 0) {
                PCMPlayer.releasePCMPlayerStatics(-20);
            }
            const InterfaceList = loadInterfaceList();
            releaseReferences(InterfaceList, 'rootX');
            const ClientKeyboardListener = loadClientKeyboardListener();
            releaseReferences(ClientKeyboardListener, 'eventChars');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'vh.G(' + guard + ')');
        }
    }

    // mj.e:I
    static m_frequency = 0;
    // db.v:Z
    static m_stereo = false;
    // bj.l:I
    static threadPriority = 0;

    // me.a(IIZI)V
    static Init(threadPriority: number, stereo: boolean, rate: number): void {
        if (rate < 8000 || rate > 48000) throw new RangeError('Invalid audio sample rate');
        PCMPlayer.m_stereo = stereo;
        PCMPlayer.m_frequency = rate;
        PCMPlayer.threadPriority = threadPriority;
    }

    // lg.a(ILfb;IILjava/awt/Component;)Ldg;
    static GetPlayer(frames: number, signlink: Signlink | null, channel: number, component: object | null): PCMPlayer {
        if (PCMPlayer.m_frequency === 0) throw new Error('Sample rate is unset');
        if (channel < 0 || channel >= 2) throw new RangeError('Invalid PCM channel');
        if (frames < 256) frames = 256;
        try {
            // The JVM resolves ua by Class.forName inside this try. Load the bundled subclass at the same point.
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD ua stays deferred until lg.a(ILfb;IILjava/awt/Component;)Ldg; in PCMPlayer.GetPlayer.
            const { default: DevicePcmPlayer } = require('./DevicePcmPlayer') as typeof import('./DevicePcmPlayer');
            const player = new DevicePcmPlayer();
            player.requestedFrames = frames;
            player.samples = new Int32Array(PCMPlayer.m_stereo ? 512 : 256);
            player.SubclassInit(component);
            player.capacity = ((frames & -1024) + 1024) | 0;
            if (player.capacity > 16384) player.capacity = 16384;
            player.Open(player.capacity);
            if (PCMPlayer.threadPriority > 0 && PlayerTask.active === null) {
                PlayerTask.active = new PlayerTask();
                PlayerTask.active.signlink = signlink;
                requireNonNull(signlink).startThread(PlayerTask.active, PCMPlayer.threadPriority);
            }
            if (PlayerTask.active !== null) {
                if (PlayerTask.active.players[channel] !== null) throw new RangeError('PCM channel already open');
                PlayerTask.active.players[channel] = player;
            }
            return player;
        } catch {
            try {
                // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD qb stays deferred until lg.a(ILfb;IILjava/awt/Component;)Ldg; in PCMPlayer.GetPlayer.
                const { default: NativePcmPlayer } = require('./NativePcmPlayer') as typeof import('./NativePcmPlayer');
                const player = new NativePcmPlayer(signlink, channel);
                player.requestedFrames = frames;
                player.samples = new Int32Array(PCMPlayer.m_stereo ? 512 : 256);
                player.SubclassInit(component);
                player.capacity = 16384;
                player.Open(player.capacity);
                if (PCMPlayer.threadPriority > 0 && PlayerTask.active === null) {
                    PlayerTask.active = new PlayerTask();
                    PlayerTask.active.signlink = signlink;
                    requireNonNull(signlink).startThread(PlayerTask.active, PCMPlayer.threadPriority);
                }
                if (PlayerTask.active !== null) {
                    if (PlayerTask.active.players[channel] !== null) throw new RangeError('PCM channel already open');
                    PlayerTask.active.players[channel] = player;
                }
                return player;
            } catch {
                return new PCMPlayer();
            }
        }
    }

    // dg.e:J
    private streamTime: bigint;
    // dg.g:[I
    samples: Int32Array | null = null;
    // dg.q:I
    private readonly budget = 32;
    // dg.r:Ljj;
    private stream: PCMStream | null = null;
    // dg.D:J
    private reopenAt = 0n;
    // dg.E:I
    capacity = 0;
    // dg.F:I
    private maxDrain = 0;
    // dg.G:J
    private checkAt = 0n;
    // dg.H:Z
    private fresh = true;
    // dg.I:I
    private framesUntilSchedule = 0;
    // dg.J:I
    private previousQueued = 0;
    // dg.K:I
    private extraFrames = 0;
    // dg.L:[Ljj;
    private readonly tails: (PCMStream | null)[] = new Array(8).fill(null);
    // dg.M:I
    requestedFrames = 0;
    // dg.N:I
    private previousDrain = 0;
    // dg.O:[Ljj;
    private readonly heads: (PCMStream | null)[] = new Array(8).fill(null);

    // dg.<init>()V
    constructor() {
        this.streamTime = SafeTime.CurrentTimeMillis();
    }
    // dg.a(I)V
    DoneUpdate(): void {
        this.fresh = true;
    }
    // dg.a(ILjj;)V
    SetInput(stream: PCMStream | null): void {
        this.stream = stream;
    }
    // tj.a(ILjj;)V
    private static ResetWantMix(stream: PCMStream): void {
        if (stream.sound !== null) stream.sound.position = 0;
        stream.active = false;
        for (let child = stream.SubstreamStart(); child !== null; child = stream.SubstreamNext()) this.ResetWantMix(child);
    }
    // dg.a([II)V
    private Generate(buffer: Int32Array | null, frames: number): void {
        ArrayUtils.clearInts(buffer, 0, PCMPlayer.m_stereo ? frames << 1 : frames);
        this.framesUntilSchedule = (this.framesUntilSchedule - frames) | 0;
        if (this.stream !== null && this.framesUntilSchedule <= 0) {
            this.framesUntilSchedule = (this.framesUntilSchedule + (PCMPlayer.m_frequency >> 4)) | 0;
            PCMPlayer.ResetWantMix(this.stream);
            this.AddToBands(this.stream.Priority(), this.stream);
            let cost = 0,
                mask = 255;
            schedule: for (let pass = 7; mask !== 0; pass--) {
                let bucket = pass < 0 ? pass & 3 : pass;
                let limit = pass < 0 ? -(pass >> 2) : 0;
                for (let bits = (mask >>> bucket) & 0x11111111; bits !== 0; bits >>>= 4) {
                    if ((bits & 1) !== 0) {
                        mask &= ~(1 << bucket);
                        let prev: PCMStream | null = null,
                            stream = this.heads[bucket];
                        while (stream !== null) {
                            const sound = stream.sound;
                            if (sound !== null && sound.position > limit) {
                                mask |= 1 << bucket;
                                prev = stream;
                                stream = stream.nextStream;
                            } else {
                                stream.active = true;
                                const work = stream.SelfMixCost();
                                cost = (cost + work) | 0;
                                if (sound !== null) sound.position = (sound.position + work) | 0;
                                if (cost >= this.budget) break schedule;
                                let child = stream.SubstreamStart();
                                if (child !== null) {
                                    const weight = stream.schedulerWeight;
                                    for (; child !== null; child = stream.SubstreamNext()) this.AddToBands(Math.imul(weight, child.Priority()) >> 8, child);
                                }
                                const next: PCMStream | null = stream.nextStream;
                                stream.nextStream = null;
                                if (prev === null) this.heads[bucket] = next;
                                else prev.nextStream = next;
                                if (next === null) this.tails[bucket] = prev;
                                stream = next;
                            }
                        }
                    }
                    bucket += 4;
                    limit++;
                }
            }
            for (let i = 0; i < 8; i++) {
                let stream = this.heads[i];
                this.heads[i] = this.tails[i] = null;
                while (stream !== null) {
                    const next: PCMStream | null = stream.nextStream;
                    stream.nextStream = null;
                    stream = next;
                }
            }
        }
        if (this.framesUntilSchedule < 0) this.framesUntilSchedule = 0;
        this.stream?.DoMix(buffer, 0, frames);
        this.streamTime = SafeTime.CurrentTimeMillis();
    }
    // dg.a(II)V
    private PretendToGenerate(frames: number): void {
        this.framesUntilSchedule = (this.framesUntilSchedule - frames) | 0;
        if (this.framesUntilSchedule < 0) this.framesUntilSchedule = 0;
        this.stream?.PretendToMix(frames);
    }
    // dg.a()I
    protected AlreadyWritten(): number {
        return this.capacity;
    }
    // dg.b()V
    protected DiscardBufferInner(): void {}
    // dg.b(I)V
    QueueDiscardBuffer(): void {
        this.fresh = true;
        try {
            this.DiscardBufferInner();
        } catch {
            this.Close();
            this.reopenAt = BigInt.asIntN(64, SafeTime.CurrentTimeMillis() + 2000n);
        }
    }
    // dg.a(IILjj;)V
    private AddToBands(weight: number, stream: PCMStream): void {
        const bucket = weight >> 5,
            last = arrayAtObj(this.tails, bucket);
        if (last === null) arrayPutObj(this.heads, bucket, stream);
        else last.nextStream = stream;
        arrayPutObj(this.tails, bucket, stream);
        stream.schedulerWeight = weight;
    }
    // dg.a(Z)V
    Service(): void {
        if (this.samples === null) return;
        let now = SafeTime.CurrentTimeMillis();
        try {
            if (this.reopenAt !== 0n) {
                if (now < this.reopenAt) return;
                this.Open(this.capacity);
                this.fresh = true;
                this.reopenAt = 0n;
            }
            let queued = this.AlreadyWritten();
            const drain = (this.previousQueued - queued) | 0;
            if (drain > this.maxDrain) this.maxDrain = drain;
            let target = (this.requestedFrames + this.extraFrames) | 0;
            if (((target + 256) | 0) > 16384) target = 16128;
            if (((target + 256) | 0) > this.capacity) {
                queued = 0;
                this.capacity = (this.capacity + 1024) | 0;
                if (this.capacity > 16384) this.capacity = 16384;
                this.Close();
                this.Open(this.capacity);
                this.fresh = true;
                if (((target + 256) | 0) > this.capacity) {
                    target = (this.capacity - 256) | 0;
                    this.extraFrames = (target - this.requestedFrames) | 0;
                }
            }
            while (queued < target) {
                this.Generate(this.samples, 256);
                queued = (queued + 256) | 0;
                this.write();
            }
            if (now > this.checkAt) {
                if (!this.fresh) {
                    if (this.maxDrain === 0 && this.previousDrain === 0) {
                        this.Close();
                        this.reopenAt = BigInt.asIntN(64, now + 2000n);
                        return;
                    }
                    this.extraFrames = Math.min(this.previousDrain, this.maxDrain);
                    this.previousDrain = this.maxDrain;
                } else this.fresh = false;
                this.checkAt = BigInt.asIntN(64, now + 2000n);
                this.maxDrain = 0;
            }
            this.previousQueued = queued;
        } catch {
            this.Close();
            this.reopenAt = BigInt.asIntN(64, now + 2000n);
        }
        try {
            if (now > BigInt.asIntN(64, this.streamTime + 500000n)) now = this.streamTime;
            while (BigInt.asIntN(64, this.streamTime + 5000n) < now) {
                this.PretendToGenerate(256);
                this.streamTime = BigInt.asIntN(64, this.streamTime + BigInt(intDivide(256000, PCMPlayer.m_frequency)));
            }
        } catch {
            this.streamTime = now;
        }
    }
    // dg.c(I)V
    Open(_capacity: number): void {}
    // dg.d(I)V
    QueueQuit(): void {
        try {
            const system = PlayerTask.active;
            if (system !== null) {
                let empty = true;
                for (let i = 0; i < 2; i++) {
                    if (system.players[i] === this) system.players[i] = null;
                    if (system.players[i] !== null) empty = false;
                }
                if (empty) {
                    system.stop();
                    PlayerTask.active = null;
                }
            }
            this.Close();
            this.samples = null;
        } catch (error) {
            if (!glJar || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'vh.P(false)');
        }
    }
    // dg.a(Ljava/awt/Component;)V
    SubclassInit(_component: object | null): void {}
    // dg.c()V
    protected write(): void {}
    // dg.d()V
    protected Close(): void {}
}
