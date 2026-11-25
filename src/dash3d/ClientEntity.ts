import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import { glJar } from '#/client/ClientVariant';
import LRUHashCache from '#/datastruct/LRUHashCache';
import ActorSlotAnim from './ActorSlotAnim';
import ModelLit from './ModelLit';
import ModelSource from './ModelSource';
import { intDivide } from '#/util/IntUtils';
import type ParticleSystem from './ParticleSystem';
import type BASType from '#/config/BASType';
import BASTypeList from '#/config/BASTypeList';
import SeqType from '#/config/SeqType';
import type JagString from '#/datastruct/JagString';
import { arrayAtI32, arrayAtI8, arrayPutI32, arrayPutI8, requireNonNull } from '#/util/JavaArray';
import ModelLitImpl from './ModelLitImpl';
import ModelUnlit from './ModelUnlit';
import Pix3D from './Pix3D';
import AnimFrameSet from './AnimFrameSet';
import { loadClient, loadGlModel, loadGlRenderer, loadInterfaceList, loadScriptRunner, loadSpriteLoader } from '#/util/GamepackClasses';

// ob
export default abstract class ClientEntity extends ModelSource {
    // HD fe.b(B)V
    static releaseClientEntityStatics(guard: number): void {
        try {
            if (guard > -101) {
                const SpriteLoader = loadSpriteLoader();
                releaseReferences(SpriteLoader, 'mapfunctionsRecoloured');
            }
            const ScriptRunner = loadScriptRunner();
            releaseReferences(ScriptRunner, 'frames', 'space');
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD fi stays deferred until fe.b(B)V in ClientEntity.releaseClientEntityStatics.
            const IdkType = (require('#/config/IdkType') as typeof import('#/config/IdkType')).default;
            releaseReferences(IdkType, 'm_recentUse');
            const SpriteLoader = loadSpriteLoader();
            releaseReferences(SpriteLoader, 'mapfunctionsRecoloured');
            const InterfaceList = loadInterfaceList();
            releaseReferences(InterfaceList, 'rootHeight');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'fe.K(' + guard + ')');
        }
    }

    // ml.w:Lve;
    static readonly shadowModelCache = new LRUHashCache<object>(32);

    // kc.a(IILnd;IIZILek;IZIIII)Lnd;. Both pb and bk pass true for the sixth Java argument.
    static getShadowModel(
        z: number,
        size: number,
        model: ModelLit | null,
        outerAlpha: number,
        innerColour: number,
        outerColour: number,
        seq: SeqType | null,
        x: number,
        stretches: boolean,
        yaw: number,
        innerAlpha: number,
        frame: number,
        sceneHeight: number
    ): ModelLit {
        const key = BigInt.asIntN(64, (BigInt(outerColour) << 48n) + (BigInt(innerColour) << 32n) + BigInt(((outerAlpha << 24) + size + (innerAlpha << 16)) | 0));
        const cached = ClientEntity.shadowModelCache.Find(key);
        if (cached !== null && !(cached instanceof ModelLit)) throw new TypeError('Expected ModelLit');
        let shadow = cached;
        if (shadow === null) {
            let segments = 21;
            if (size === 1) segments = 9;
            else if (size === 2) segments = 12;
            else if (size === 3) segments = 15;
            else if (size === 4) segments = 18;
            const radii = [64, 96, 128];
            const rings = Array.from({ length: 3 }, () => new Int32Array(segments));
            const mesh = new ModelUnlit(1 + 3 * segments, 5 * segments, 0);
            const center = mesh.AddPoint(0, 0, 0);
            for (let ring = 0; ring < 3; ring++) {
                for (let i = 0; i < segments; i++) {
                    const angle = ((i << 11) / segments) | 0;
                    let px: number;
                    let pz: number;
                    if (glJar) {
                        pz = (z + Math.imul(arrayAtI32(Pix3D.cosTable, angle), radii[ring])) >> 16;
                        px = (x + Math.imul(arrayAtI32(Pix3D.sinTable, angle), radii[ring])) >> 16;
                    } else {
                        px = (x + Math.imul(arrayAtI32(Pix3D.sinTable, angle), radii[ring])) >> 16;
                        pz = (Math.imul(radii[ring], arrayAtI32(Pix3D.cosTable, angle)) + z) >> 16;
                    }
                    rings[ring][i] = mesh.AddPoint(px, 0, pz);
                }
            }
            for (let ring = 0; ring < 3; ring++) {
                const weight = ((128 + ring * 256) / 3) | 0;
                const inverse = 256 - weight;
                const alpha = (((Math.imul(outerAlpha, weight) + Math.imul(inverse, innerAlpha)) >> 8) << 24) >> 24;
                const colour =
                    (((((weight * (outerColour & 896) + inverse * (innerColour & 896)) & 229376) +
                        ((inverse * (innerColour & 64512) + weight * (outerColour & 64512)) & 16515072) +
                        (((outerColour & 127) * weight + (innerColour & 127) * inverse) & 32512)) >>
                        8) <<
                        16) >>
                    16;
                for (let i = 0; i < segments; i++) {
                    const next = (i + 1) % segments;
                    if (ring === 0) {
                        mesh.AddFace(center, rings[0][next], rings[0][i], 1, colour, alpha);
                    } else {
                        mesh.AddFace(rings[ring - 1][i], rings[ring - 1][next], rings[ring][next], 1, colour, alpha);
                        mesh.AddFace(rings[ring - 1][i], rings[ring][next], rings[ring][i], 1, colour, alpha);
                    }
                }
            }
            shadow = mesh.Light(64, 768, -50, -10, -50);
            ClientEntity.shadowModelCache.Put(key, shadow);
        }
        const radius = (Math.imul(size, 64) - 1) | 0;
        let lowerZ = -radius | 0;
        let lowerX = -radius | 0;
        let upperZ = radius;
        let upperX = radius;
        if (stretches) {
            if (yaw > 1152 && yaw < 1920) upperX = (radius + 128) | 0;
            if (yaw > 1664 || yaw < 384) lowerZ = (lowerZ - 128) | 0;
            if (yaw > 640 && yaw < 1408) upperZ = (radius + 128) | 0;
            if (yaw > 128 && yaw < 896) lowerX = (lowerX - 128) | 0;
        }
        let minX = requireNonNull(model).getMinX();
        if (minX < lowerX) minX = lowerX;
        let maxX = requireNonNull(model).getMaxX();
        let minZ = requireNonNull(model).getMinZ();
        let maxZ = requireNonNull(model).getMaxZ();
        if (minZ < lowerZ) minZ = lowerZ;
        let frames: AnimFrameSet | null = null;
        if (maxZ > upperZ) maxZ = upperZ;
        if (maxX > upperX) maxX = upperX;
        if (seq !== null) {
            frame = arrayAtI32(seq.frames, frame);
            frames = AnimFrameSet.get(frame >> 16);
            frame &= 65535;
        }
        if (frames === null) {
            shadow = shadow.CopyForAnimSpot(true, true, true);
            shadow.Resize((((maxX - minX) | 0) / 2) | 0, 128, (((maxZ - minZ) | 0) / 2) | 0);
            shadow.Translate((((maxX + minX) | 0) / 2) | 0, 0, (((maxZ + minZ) | 0) / 2) | 0);
        } else {
            shadow = shadow.CopyForAnimSpot(!frames.GetAnimateTransparencies(frame), !frames.getAnimateColours(frame), true);
            shadow.Resize((((maxX - minX) | 0) / 2) | 0, 128, (((maxZ - minZ) | 0) / 2) | 0);
            shadow.Translate((((minX + maxX) | 0) / 2) | 0, 0, (((minZ + maxZ) | 0) / 2) | 0);
            shadow.animateShadow(frames, frame);
        }
        if (yaw !== 0) shadow.RotateYAxis(yaw);
        // ClientPlayer extends this class. Resolve Client only at the first height query.
        const Client = loadClient();
        if (glJar && loadGlRenderer().active) {
            const GlModel = loadGlModel();
            if (!(shadow instanceof GlModel)) throw new TypeError('ClassCastException: not a GlModel');
            if (Client.GetAvH((x + minX) | 0, (minZ + z) | 0, Client.playerLevel) !== sceneHeight || sceneHeight !== Client.GetAvH((x + maxX) | 0, (maxZ + z) | 0, Client.playerLevel)) {
                for (let i = 0; i < shadow.vertexCount; i++) {
                    const destination = shadow.pointY;
                    const oldY = arrayAtI32(shadow.pointY, i);
                    const level = Client.playerLevel;
                    const height = Client.GetAvH((x + arrayAtI32(shadow.pointX, i)) | 0, (z + arrayAtI32(shadow.pointZ, i)) | 0, level);
                    arrayPutI32(destination, i, (oldY + height - sceneHeight) | 0);
                }
                requireNonNull(shadow.bounds).valid = false;
                requireNonNull(shadow.positionStream).valid = false;
            }
        } else {
            if (!(shadow instanceof ModelLitImpl)) throw new TypeError('Expected software ModelLitImpl');
            if (Client.GetAvH((x + minX) | 0, (minZ + z) | 0, Client.playerLevel) !== sceneHeight || sceneHeight !== Client.GetAvH((x + maxX) | 0, (maxZ + z) | 0, Client.playerLevel)) {
                for (let i = 0; i < shadow.numPoints; i++) {
                    const destination = shadow.pointY;
                    const oldY = arrayAtI32(shadow.pointY, i);
                    const level = Client.playerLevel;
                    const height = Client.GetAvH((x + arrayAtI32(shadow.pointX, i)) | 0, (z + arrayAtI32(shadow.pointZ, i)) | 0, level);
                    arrayPutI32(destination, i, (oldY + height - sceneHeight) | 0);
                }
                shadow.boundsCalculated = false;
            }
        }
        return shadow;
    }

    // pg.d(I)V
    static clearShadowModelCache(): void {
        ClientEntity.shadowModelCache.Reset();
    }

    // dd.a(I)V
    static removeSoft(): void {
        ClientEntity.shadowModelCache.removeSoft();
    }

    // cf.a(BI)V
    static cleanShadowModelCache(age: number): void {
        ClientEntity.shadowModelCache.Clean(age);
    }

    turnSpeed: number; // ob.j:I
    attachmentZ: number; // ob.k:I
    healthUntil: number; // ob.n:I
    exactEndX: number; // ob.o:I
    hitUntil: Int32Array; // ob.p:[I
    stretches: boolean; // ob.r:Z
    private pitchAngle: number; // ob.s:I
    spotStart: number; // ob.t:I
    seqNext: number; // ob.w:I
    attachmentStart: number; // ob.y:I
    turnDistance: number; // ob.z:I
    private baseSize: number; // ob.A:I
    pathSpeed: Int8Array; // ob.D:[B
    spotCycle: number; // ob.E:I
    pathLength: number; // ob.F:I
    exactStartTick: number; // ob.G:I
    sceneHeight: number; // ob.H:I
    private rollTarget: number; // ob.I:I
    walkCycle: number; // ob.J:I
    exactEndZ: number; // ob.K:I
    pathX: Int32Array; // ob.L:[I
    walkSeq: number; // ob.M:I
    targetYaw: number; // ob.N:I
    walkNext: number; // ob.O:I
    overheadText: JagString | null; // ob.P:Lid;
    z: number; // ob.S:I
    seqPathLength: number; // ob.T:I
    bas: number; // ob.U:I
    private rollVelocity: number; // ob.X:I
    particles: ParticleSystem | null; // ob.Y:Lue;
    x: number; // ob.Z:I
    exactEndTick: number; // ob.ab:I
    seq: number; // ob.bb:I
    private pitchBrakeAt: number; // ob.db:I
    faceZ: number; // ob.eb:I
    spotanim: number; // ob.fb:I
    yaw: number; // ob.gb:I
    seqCycle: number; // ob.hb:I
    attachmentEnd: number; // ob.ib:I
    attachmentMinZ: number; // ob.jb:I
    spotFrame: number; // ob.lb:I
    chatColour: number; // ob.mb:I
    attachment: object | null; // ob.nb:Ljava/lang/Object;
    modelAnims: (ActorSlotAnim | null)[]; // ob.pb:[Lci;
    turnTarget: number; // ob.qb:I
    private rollAccelerating: boolean; // ob.rb:Z
    attachmentMaxZ: number; // ob.tb:I
    chatEffect: number; // ob.ub:I
    turnVelocity: number; // ob.wb:I
    movementSpeed: number; // ob.xb:I
    walkFrame: number; // ob.yb:I
    private rollAngle: number; // ob.zb:I
    spotHeight: number; // ob.Ab:I
    health: number; // ob.Bb:I
    attachmentHeight: number; // ob.Cb:I
    hitType: Int32Array; // ob.Db:[I
    private pitchTarget: number; // ob.Eb:I
    exactDirection: number; // ob.Fb:I
    exactStartZ: number; // ob.Gb:I
    turnBrakeAt: number; // ob.Jb:I
    attachmentMinX: number; // ob.Lb:I
    turnAccelerating: boolean; // ob.Mb:Z
    chatTimer: number; // ob.Nb:I
    hitDamage: Int32Array; // ob.Ob:[I
    private pitchVelocity: number; // ob.Pb:I
    modelMinY: number; // ob.Qb:I
    fineYaw: number; // ob.Rb:I
    faceX: number; // ob.Sb:I
    private pitchAccelerating: boolean; // ob.Tb:Z
    spotNext: number; // ob.Ub:I
    exactStartX: number; // ob.Vb:I
    attachmentX: number; // ob.Wb:I
    seqFrame: number; // ob.Xb:I
    turnTicks: number; // ob.Yb:I
    faceEntity: number; // ob.Zb:I
    pathZ: Int32Array; // ob.ac:[I
    movementDelay: number; // ob.bc:I
    private rollBrakeAt: number; // ob.cc:I
    lastUpdate: number; // ob.dc:I
    seqLoops: number; // ob.fc:I
    seqDelay: number; // ob.gc:I
    attachmentMaxX: number; // ob.hc:I

    // ob.<init>()V
    constructor() {
        super();
        this.attachmentZ = 0;
        this.exactEndX = 0;
        this.spotStart = 0;
        this.exactStartTick = 0;
        this.sceneHeight = 0;
        this.exactEndZ = 0;
        this.targetYaw = 0;
        this.z = 0;
        this.particles = null;
        this.x = 0;
        this.exactEndTick = 0;
        this.yaw = 0;
        this.attachmentMinZ = 0;
        this.attachment = null;
        this.attachmentMaxZ = 0;
        this.spotHeight = 0;
        this.health = 0;
        this.attachmentHeight = 0;
        this.exactDirection = 0;
        this.exactStartZ = 0;
        this.attachmentMinX = 0;
        this.exactStartX = 0;
        this.attachmentX = 0;
        this.attachmentMaxX = 0;
        this.healthUntil = -1000;
        this.bas = -1;
        this.pathSpeed = new Int8Array(10);
        this.stretches = false;
        this.rollVelocity = 0;
        this.pathLength = 0;
        this.spotanim = -1;
        this.attachmentEnd = 0;
        this.baseSize = 1;
        this.pitchAngle = 0;
        this.rollAccelerating = false;
        this.seqCycle = 0;
        this.seqNext = -1;
        this.modelAnims = new Array<ActorSlotAnim | null>(12).fill(null);
        this.turnDistance = 0;
        this.attachmentStart = 0;
        this.turnVelocity = 0;
        this.hitType = new Int32Array(4);
        this.walkCycle = 0;
        this.hitUntil = new Int32Array(4);
        this.spotFrame = 0;
        this.chatColour = 0;
        this.pitchVelocity = 0;
        this.turnAccelerating = false;
        this.turnSpeed = 32;
        this.modelMinY = -32768;
        this.chatTimer = 100;
        this.chatEffect = 0;
        this.turnTarget = 0;
        this.seqPathLength = 0;
        this.turnBrakeAt = 0;
        this.faceZ = 0;
        this.seq = -1;
        this.overheadText = null;
        this.movementSpeed = 0;
        this.fineYaw = 0;
        this.pitchBrakeAt = 0;
        this.pitchTarget = 0;
        this.walkNext = -1;
        this.spotCycle = 0;
        this.pitchAccelerating = false;
        this.faceX = 0;
        this.rollTarget = 0;
        this.walkFrame = 0;
        this.hitDamage = new Int32Array(4);
        this.faceEntity = -1;
        this.rollBrakeAt = 0;
        this.walkSeq = -1;
        this.turnTicks = 0;
        this.pathX = new Int32Array(10);
        this.lastUpdate = 0;
        this.seqFrame = 0;
        this.movementDelay = 0;
        this.pathZ = new Int32Array(10);
        this.rollAngle = 0;
        this.spotNext = -1;
        this.seqLoops = 0;
        this.seqDelay = 0;
    }

    // SD ob.a(I)V, HD fe.c(I)V.
    resetPath(hdGuard = -116): void {
        if (glJar) {
            if (hdGuard >= -75) return;
            this.pathLength = 0;
            this.seqPathLength = 0;
            return;
        }
        this.seqPathLength = 0;
        this.pathLength = 0;
    }

    // ob.c(B)I
    getOverheadHeight(): number {
        return this.modelMinY === -32768 ? 200 : -this.modelMinY | 0;
    }

    // ob.a(IIBIZ)V
    moveSized(size: number, z: number, x: number, jump: boolean): void {
        if (this.seq !== -1 && SeqType.List(this.seq).m_postanimMove === 1) this.seq = -1;
        if (!jump) {
            const dz = (z - arrayAtI32(this.pathZ, 0)) | 0;
            const dx = (x - arrayAtI32(this.pathX, 0)) | 0;
            if (dx >= -8 && dx <= 8 && dz >= -8 && dz <= 8) {
                if (this.pathLength < 9) this.pathLength = (this.pathLength + 1) | 0;
                for (let i = this.pathLength; i > 0; i--) {
                    arrayPutI32(this.pathX, i, arrayAtI32(this.pathX, i - 1));
                    arrayPutI32(this.pathZ, i, arrayAtI32(this.pathZ, i - 1));
                    arrayPutI8(this.pathSpeed, i, arrayAtI8(this.pathSpeed, i - 1));
                }
                arrayPutI8(this.pathSpeed, 0, 1);
                arrayPutI32(this.pathX, 0, x);
                arrayPutI32(this.pathZ, 0, z);
                return;
            }
        }
        this.movementDelay = 0;
        this.seqPathLength = 0;
        this.pathLength = 0;
        arrayPutI32(this.pathX, 0, x);
        arrayPutI32(this.pathZ, 0, z);
        this.z = (Math.imul(arrayAtI32(this.pathZ, 0), 128) + Math.imul(size, 64)) | 0;
        this.x = (Math.imul(size, 64) + Math.imul(128, arrayAtI32(this.pathX, 0))) | 0;
        if (glJar && loadGlRenderer().active) {
            const Client = loadClient();
            if (Client.localPlayer === (this as ClientEntity)) Client.forceImmediateEnvironmentUpdate = true; // HD fe.a -> gm.f(64)
        }
    }

    // ob.d(B)Z
    isVisible(): boolean {
        return false;
    }

    // ob.f(B)Lmg;
    getBasType(): BASType {
        const id = this.getBasId();
        return id !== -1 ? BASTypeList.List(id) : BASTypeList.defaultType;
    }

    // SD ob.a(IIII)V, HD fe.a(IIII)V.
    addHit(damage: number, tick: number, type: number, hdGuard = -8): void {
        if (glJar && hdGuard !== -8) return;
        try {
            for (let i = 0; i < 4; i++) {
                if (tick >= arrayAtI32(this.hitUntil, i)) {
                    arrayPutI32(this.hitDamage, i, damage);
                    arrayPutI32(this.hitType, i, type);
                    arrayPutI32(this.hitUntil, i, (tick + 70) | 0);
                    return;
                }
            }
        } catch (error) {
            if (!glJar || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'fe.G(' + type + ',' + hdGuard + ',' + tick + ',' + damage + ')');
        }
    }

    // ob.b(I)I
    abstract getBasId(): number;

    // ob.b(II)V
    setSize(value: number): void {
        this.baseSize = value;
    }

    // ob.c(III)V
    step(direction: number, speed: number, west: number, hdGuard = -128): void {
        if (glJar) {
            this.stepHd(speed, hdGuard, direction);
            return;
        }
        let z = arrayAtI32(this.pathZ, 0);
        let x = arrayAtI32(this.pathX, 0);
        if (direction === 0) {
            z = (z + 1) | 0;
            x = (x - 1) | 0;
        }
        if (direction === 1) z = (z + 1) | 0;
        if (direction === 2) {
            x = (x + 1) | 0;
            z = (z + 1) | 0;
        }
        if (west === direction) x = (x - 1) | 0;
        if (direction === 4) x = (x + 1) | 0;
        if (direction === 5) {
            z = (z - 1) | 0;
            x = (x - 1) | 0;
        }
        if (direction === 6) z = (z - 1) | 0;
        if (direction === 7) {
            x = (x + 1) | 0;
            z = (z - 1) | 0;
        }
        if (this.seq !== -1 && SeqType.List(this.seq).m_postanimMove === 1) this.seq = -1;
        if (this.pathLength < 9) this.pathLength = (this.pathLength + 1) | 0;
        for (let i = this.pathLength; i > 0; i--) {
            arrayPutI32(this.pathX, i, arrayAtI32(this.pathX, i - 1));
            arrayPutI32(this.pathZ, i, arrayAtI32(this.pathZ, i - 1));
            arrayPutI8(this.pathSpeed, i, arrayAtI8(this.pathSpeed, i - 1));
        }
        arrayPutI32(this.pathX, 0, x);
        arrayPutI32(this.pathZ, 0, z);
        arrayPutI8(this.pathSpeed, 0, speed);
    }

    // HD fe.a(IBI)V.
    private stepHd(speed: number, guard: number, direction: number): void {
        try {
            let x = arrayAtI32(this.pathX, 0);
            let z = arrayAtI32(this.pathZ, 0);
            if (direction === 0) {
                x = (x - 1) | 0;
                z = (z + 1) | 0;
            }
            if (this.seq !== -1 && SeqType.List(this.seq).m_postanimMove === 1) this.seq = -1;
            if (this.pathLength < 9) this.pathLength = (this.pathLength + 1) | 0;
            for (let i = this.pathLength; i > 0; i--) {
                arrayPutI32(this.pathX, i, arrayAtI32(this.pathX, i - 1));
                arrayPutI32(this.pathZ, i, arrayAtI32(this.pathZ, i - 1));
                arrayPutI8(this.pathSpeed, i, arrayAtI8(this.pathSpeed, i - 1));
            }
            if (direction === 1) z = (z + 1) | 0;
            arrayPutI8(this.pathSpeed, 0, speed);
            if (direction === 2) {
                z = (z + 1) | 0;
                x = (x + 1) | 0;
            }
            if (direction === 3) x = (x - 1) | 0;
            if (direction === 4) x = (x + 1) | 0;
            if (direction === 5) {
                z = (z - 1) | 0;
                x = (x - 1) | 0;
            }
            if (direction === 6) z = (z - 1) | 0;
            if (direction === 7) {
                z = (z - 1) | 0;
                x = (x + 1) | 0;
            }
            arrayPutI32(this.pathX, 0, x);
            intDivide(-106, ((guard + 10) / 40) | 0);
            arrayPutI32(this.pathZ, 0, z);
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'fe.E(' + speed + ',' + guard + ',' + direction + ')');
        }
    }

    // ob.g(B)I
    getSize(): number {
        return this.baseSize;
    }

    static tiltPitch = 0; // tj.b:I
    static groundTiltRoll = 0; // ug.a:I
    static tiltOffsetY = 0; // ph.l:I

    // ob.a(BLnd;)V
    updateRollPitch(model: ModelLit): void {
        const bas = this.getBasType();
        if (bas.roll === 0 && bas.pitch === 0) return;
        let roll = 0;
        let pitch = 0;
        if (this.turnAccelerating && this.turnVelocity !== 0) {
            roll = this.turnVelocity < 0 ? -bas.roll | 0 : bas.roll;
            pitch = bas.pitch;
        }
        if (this.rollTarget !== roll) {
            this.rollTarget = roll;
            if (this.rollVelocity <= 0 || roll <= this.rollAngle) {
                if (this.rollVelocity < 0 && this.rollAngle > roll) {
                    const stopping = intDivide(Math.imul(this.rollVelocity, this.rollVelocity), (2 * bas.rollAcceleration) | 0);
                    const distance = (roll - this.rollAngle) | 0;
                    if (stopping <= distance) {
                        this.rollBrakeAt = (((stopping + this.rollAngle + roll) | 0) / 2) | 0;
                        this.rollAccelerating = true;
                        const limit = intDivide(Math.imul(bas.rollMax, bas.rollMax), (bas.rollAcceleration * 2) | 0);
                        const at = (roll + limit) | 0;
                        if (at < this.rollBrakeAt) this.rollBrakeAt = at;
                    } else this.rollAccelerating = false;
                } else this.rollAccelerating = false;
            } else {
                const stopping = intDivide(Math.imul(this.rollVelocity, this.rollVelocity), (bas.rollAcceleration * 2) | 0);
                const distance = (roll - this.rollAngle) | 0;
                if (stopping > distance) this.rollAccelerating = false;
                else {
                    this.rollBrakeAt = (((roll - stopping + this.rollAngle) | 0) / 2) | 0;
                    this.rollAccelerating = true;
                    const limit = intDivide(Math.imul(bas.rollMax, bas.rollMax), (2 * bas.rollAcceleration) | 0);
                    const at = (roll - limit) | 0;
                    if (at > this.rollBrakeAt) this.rollBrakeAt = at;
                }
            }
        }
        if (this.rollVelocity !== 0) {
            if (this.rollVelocity <= 0) {
                if (this.rollAngle <= this.rollBrakeAt) this.rollAccelerating = false;
                if (this.rollAccelerating) {
                    if (this.rollVelocity > (-bas.rollMax | 0)) this.rollVelocity = (this.rollVelocity - bas.rollAcceleration) | 0;
                } else {
                    this.rollVelocity = (this.rollVelocity + bas.rollAcceleration) | 0;
                    if (this.rollVelocity > 0) this.rollVelocity = 0;
                }
            } else {
                if (this.rollAngle >= this.rollBrakeAt) this.rollAccelerating = false;
                if (this.rollAccelerating) {
                    if (bas.rollMax > this.rollVelocity) this.rollVelocity = (this.rollVelocity + bas.rollAcceleration) | 0;
                } else {
                    this.rollVelocity = (this.rollVelocity - bas.rollAcceleration) | 0;
                    if (this.rollVelocity < 0) this.rollVelocity = 0;
                }
            }
        } else {
            const distance = (this.rollTarget - this.rollAngle) | 0;
            if (distance > (-bas.rollAcceleration | 0) && distance < bas.rollAcceleration) this.rollAngle = this.rollTarget;
            else {
                this.rollAccelerating = true;
                this.rollBrakeAt = (((this.rollAngle + this.rollTarget) | 0) / 2) | 0;
                const limit = intDivide(Math.imul(bas.rollMax, bas.rollMax), (2 * bas.rollAcceleration) | 0);
                if (distance < 0) {
                    this.rollVelocity = -bas.rollAcceleration | 0;
                    const at = (this.rollTarget + limit) | 0;
                    if (this.rollBrakeAt > at) this.rollBrakeAt = at;
                } else {
                    this.rollVelocity = bas.rollAcceleration;
                    const at = (this.rollTarget - limit) | 0;
                    if (this.rollBrakeAt < at) this.rollBrakeAt = at;
                }
            }
        }
        this.rollAngle = (this.rollAngle + this.rollVelocity) | 0;
        if (this.rollAngle !== 0) {
            const angle = (65516 & this.rollAngle) >> 5;
            const midY = (model.getMinY() / 2) | 0;
            model.Translate(0, -midY | 0, 0);
            model.rotateZAxis(angle);
            model.Translate(0, midY, 0);
        }
        if (pitch !== this.pitchTarget) {
            this.pitchTarget = pitch;
            if (this.pitchVelocity > 0 && pitch > this.pitchAngle) {
                const stopping = intDivide(Math.imul(this.pitchVelocity, this.pitchVelocity), (bas.pitchAcceleration * 2) | 0);
                const distance = (pitch - this.pitchAngle) | 0;
                if (stopping <= distance) {
                    this.pitchAccelerating = true;
                    this.pitchBrakeAt = (((pitch + this.pitchAngle - stopping) | 0) / 2) | 0;
                    const limit = intDivide(Math.imul(bas.pitchMax, bas.pitchMax), (2 * bas.pitchAcceleration) | 0);
                    const at = (pitch - limit) | 0;
                    if (at > this.pitchBrakeAt) this.pitchBrakeAt = at;
                } else this.pitchAccelerating = false;
            } else if (this.pitchVelocity < 0 && this.pitchAngle > pitch) {
                const stopping = intDivide(Math.imul(this.pitchVelocity, this.pitchVelocity), (bas.pitchAcceleration * 2) | 0);
                const distance = (pitch - this.pitchAngle) | 0;
                if (stopping <= distance) {
                    const limit = intDivide(Math.imul(bas.pitchMax, bas.pitchMax), (2 * bas.pitchAcceleration) | 0);
                    this.pitchAccelerating = true;
                    this.pitchBrakeAt = (((pitch + this.pitchAngle + stopping) | 0) / 2) | 0;
                    const at = (pitch + limit) | 0;
                    if (this.pitchBrakeAt > at) this.pitchBrakeAt = at;
                } else this.pitchAccelerating = false;
            } else this.pitchAccelerating = false;
        }
        if (this.pitchVelocity === 0) {
            const distance = (this.pitchTarget - this.pitchAngle) | 0;
            if (distance <= (-bas.pitchAcceleration | 0) || distance >= bas.pitchAcceleration) {
                this.pitchAccelerating = true;
                this.pitchBrakeAt = (((this.pitchAngle + this.pitchTarget) | 0) / 2) | 0;
                const limit = intDivide(Math.imul(bas.pitchMax, bas.pitchMax), (2 * bas.pitchAcceleration) | 0);
                if (distance >= 0) {
                    this.pitchVelocity = bas.pitchAcceleration;
                    const at = (this.pitchTarget - limit) | 0;
                    if (this.pitchBrakeAt < at) this.pitchBrakeAt = at;
                } else {
                    this.pitchVelocity = -bas.pitchAcceleration | 0;
                    const at = (limit + this.pitchTarget) | 0;
                    if (at < this.pitchBrakeAt) this.pitchBrakeAt = at;
                }
            } else this.pitchAngle = this.pitchTarget;
        } else if (this.pitchVelocity > 0) {
            if (this.pitchBrakeAt <= this.pitchAngle) this.pitchAccelerating = false;
            if (!this.pitchAccelerating) {
                this.pitchVelocity = (this.pitchVelocity - bas.pitchAcceleration) | 0;
                if (this.pitchVelocity < 0) this.pitchVelocity = 0;
            } else if (this.pitchVelocity < bas.pitchMax) this.pitchVelocity = (this.pitchVelocity + bas.pitchAcceleration) | 0;
        } else {
            if (this.pitchBrakeAt >= this.pitchAngle) this.pitchAccelerating = false;
            if (!this.pitchAccelerating) {
                this.pitchVelocity = (this.pitchVelocity + bas.pitchAcceleration) | 0;
                if (this.pitchVelocity > 0) this.pitchVelocity = 0;
            } else if (this.pitchVelocity > (-bas.pitchMax | 0)) this.pitchVelocity = (this.pitchVelocity - bas.pitchAcceleration) | 0;
        }
        this.pitchAngle = (this.pitchAngle + this.pitchVelocity) | 0;
        if (this.pitchAngle === 0) return;
        const angle = (this.pitchAngle >> 5) & 2047;
        const midY = (model.getMinY() / 2) | 0;
        model.Translate(0, -midY | 0, 0);
        model.RotateXAxis(angle);
        model.Translate(0, midY, 0);
    }

    // ob.a(ILnd;Z)V. RT5 PathingEntity::CalculateHillRotateTransform.
    CalculateHillRotateTransform(yaw: number, model: ModelLit): void {
        ClientEntity.groundTiltRoll = 0;
        if (glJar) {
            ClientEntity.tiltPitch = 0;
            ClientEntity.tiltOffsetY = 0;
        } else {
            ClientEntity.tiltOffsetY = 0;
            ClientEntity.tiltPitch = 0;
        }
        const bas = this.getBasType();
        const width = bas.hillX,
            length = bas.m_hillRotateLength;
        if (width === 0 || length === 0) return;
        let sin: number;
        let cos: number;
        let west: number;
        let south: number;
        if (glJar) {
            sin = arrayAtI32(Pix3D.sinTable, yaw);
            cos = arrayAtI32(Pix3D.cosTable, yaw);
            west = ((-width | 0) / 2) | 0;
            south = ((-length | 0) / 2) | 0;
        } else {
            cos = arrayAtI32(Pix3D.cosTable, yaw);
            west = ((-width | 0) / 2) | 0;
            south = ((-length | 0) / 2) | 0;
            sin = arrayAtI32(Pix3D.sinTable, yaw);
        }
        const swX = (Math.imul(south, sin) + Math.imul(west, cos)) >> 16;
        const east = (width / 2) | 0;
        const seZ = (-Math.imul(east, sin) + Math.imul(cos, south)) >> 16;
        const seX = (Math.imul(south, sin) + Math.imul(cos, east)) >> 16;
        const swZ = (-Math.imul(west, sin) + Math.imul(south, cos)) >> 16;
        const Client = loadClient();
        let level = Client.playerLevel;
        const sw = Client.GetAvH((this.x + swX) | 0, (swZ + this.z) | 0, level);
        level = Client.playerLevel;
        const se = Client.GetAvH((seX + this.x) | 0, (seZ + this.z) | 0, level);
        const north = (length / 2) | 0;
        const nwX = (Math.imul(west, cos) + Math.imul(north, sin)) >> 16;
        const nwZ = (-Math.imul(sin, west) + Math.imul(north, cos)) >> 16;
        level = Client.playerLevel;
        const nw = Client.GetAvH((this.x + nwX) | 0, (this.z + nwZ) | 0, level);
        const neZ = (Math.imul(cos, north) - Math.imul(sin, east)) >> 16;
        const neX = (Math.imul(east, cos) + Math.imul(north, sin)) >> 16;
        level = Client.playerLevel;
        const ne = Client.GetAvH((this.x + neX) | 0, (neZ + this.z) | 0, level);
        const lowSouth = Math.min(se, sw),
            lowEast = Math.min(se, ne),
            lowNorth = Math.min(ne, nw);
        ClientEntity.tiltPitch = (325.95 * Math.atan2((lowSouth - lowNorth) | 0, length)) & 2047;
        const lowWest = Math.min(nw, sw);
        if (ClientEntity.tiltPitch !== 0) model.RotateXAxis(ClientEntity.tiltPitch);
        ClientEntity.groundTiltRoll = (325.95 * Math.atan2((lowWest - lowEast) | 0, width)) & 2047;
        if (ClientEntity.groundTiltRoll !== 0) model.rotateZAxis(ClientEntity.groundTiltRoll);
        ClientEntity.tiltOffsetY = (ne + sw) | 0;
        if (((se + nw) | 0) < ClientEntity.tiltOffsetY) ClientEntity.tiltOffsetY = (se + nw) | 0;
        ClientEntity.tiltOffsetY = (-this.sceneHeight + (ClientEntity.tiltOffsetY >> 1)) | 0;
        if (ClientEntity.tiltOffsetY !== 0) model.Translate(0, ClientEntity.tiltOffsetY, 0);
    }
}
