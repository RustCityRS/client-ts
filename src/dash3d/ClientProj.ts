import { glJar } from '#/client/ClientVariant';
import SeqType from '#/config/SeqType';
import SpotType from '#/config/SpotType';
import { arrayAtI32, requireNonNull } from '#/util/JavaArray';
import { doubleToInt } from '#/util/IntUtils';
import { projectileTangent } from '#/util/ProjectileTangent';
import { isJavaRuntimeException } from '#/util/JavaException';
import WrappedException from '#/util/WrappedException';
import type ParticleSystem from './ParticleSystem';
import type ModelLit from './ModelLit';
import ModelSource from './ModelSource';
import { loadClient } from '#/util/GamepackClasses';

// hl. The model for this entity is supplied by li (SpotType).
export default class ClientProj extends ModelSource {
    // HD ra.b(Z)V
    static releaseHdStatics(release: boolean): void {
        try {
            if (!release) return;
            const Client = loadClient();
            Client.m_pSprites = null;
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ra.C(' + release + ')');
        }
    }

    private velocityZ = 0; // hl.j:D
    particles: ParticleSystem | null = null; // hl.k:Lue;
    readonly slope: number; // hl.n:I
    yaw = 0; // hl.o:I
    readonly sourceX: number; // hl.q:I
    readonly distance: number; // hl.r:I
    readonly target: number; // hl.s:I
    readonly sourceY: number; // hl.t:I
    readonly endCycle: number; // hl.u:I
    z = 0; // hl.v:D
    private moving = false; // hl.y:Z
    frame = 0; // hl.D:I
    private velocityY = 0; // hl.F:D
    readonly id: number; // hl.I:I
    frameCycle = 0; // hl.J:I
    y = 0; // hl.L:D
    pitch = 0; // hl.M:I
    minY = -32768; // hl.N:I
    x = 0; // hl.O:D
    private readonly seq: SeqType | null; // hl.P:Lek;
    private acceleration = 0; // hl.R:D
    readonly endHeight: number; // hl.T:I
    readonly startCycle: number; // hl.U:I
    readonly plane: number; // hl.V:I
    readonly sourceZ: number; // hl.Z:I
    nextFrame = -1; // hl.ab:I
    private speed = 0; // hl.bb:D
    private velocityX = 0; // hl.cb:D

    // hl.<init>(IIIIIIIIIII)V
    constructor(id: number, plane: number, x: number, z: number, y: number, start: number, end: number, slope: number, distance: number, target: number, endHeight: number) {
        super(); // ug.<init>()V
        this.distance = distance;
        this.startCycle = start;
        this.sourceX = x;
        this.sourceZ = z;
        this.plane = plane;
        this.id = id;
        this.endCycle = end;
        this.sourceY = y;
        this.target = target;
        this.endHeight = endHeight;
        this.slope = slope;
        const seq = SpotType.List(id).seq;
        this.seq = seq === -1 ? null : SeqType.List(seq);
    }

    // hl.a(BIIII)V
    setTarget(x: number, y: number, z: number, cycle: number): void {
        if (!this.moving) {
            const dz = (z - this.sourceZ) | 0;
            const dx = (x - this.sourceX) | 0;
            const length = Math.sqrt(dx * dx + dz * dz);
            this.y = this.sourceY;
            this.z = (this.distance * dz) / length + this.sourceZ;
            this.x = this.sourceX + (dx * this.distance) / length;
        }
        const time = (1 - cycle + this.endCycle) | 0;
        this.velocityX = (x - this.x) / time;
        this.velocityZ = (z - this.z) / time;
        this.speed = Math.sqrt(this.velocityZ * this.velocityZ + this.velocityX * this.velocityX);
        if (this.slope !== -1) {
            if (!this.moving) this.velocityY = -this.speed * projectileTangent(this.slope);
            this.acceleration = ((y - this.y - this.velocityY * time) * 2) / (time * time);
        } else this.velocityY = (y - this.y) / time;
    }

    // hl.a(BI)V
    advance(delta: number): void {
        this.moving = true;
        this.x = this.x + delta * this.velocityX;
        if (this.slope === -1) this.y = this.y + delta * this.velocityY;
        else {
            this.y += delta * this.velocityY + delta * (0.5 * this.acceleration) * delta;
            this.velocityY = this.velocityY + delta * this.acceleration;
        }
        this.z = this.z + delta * this.velocityZ;
        this.yaw = (1024 + doubleToInt(Math.atan2(this.velocityX, this.velocityZ) * 325.949)) & 2047;
        this.pitch = doubleToInt(325.949 * Math.atan2(this.velocityY, this.speed)) & 2047;
        if (this.seq !== null) {
            this.frameCycle = (this.frameCycle + delta) | 0;
            while (this.frameCycle > arrayAtI32(this.seq.delays, this.frame)) {
                this.frameCycle = (this.frameCycle - arrayAtI32(this.seq.delays, this.frame)) | 0;
                this.frame = (this.frame + 1) | 0;
                const length = requireNonNull(this.seq.frames).length;
                if (this.frame >= length) {
                    this.frame = (this.frame - this.seq.m_loops) | 0;
                    if (this.frame < 0 || this.frame >= length) this.frame = 0;
                }
                this.nextFrame = (1 + this.frame) | 0;
                if (this.nextFrame >= length) {
                    this.nextFrame = (this.nextFrame - this.seq.m_loops) | 0;
                    if (this.nextFrame < 0 || this.nextFrame >= length) this.nextFrame = -1;
                }
            }
        }
    }

    // hl.a(IIIII)V (overrides ug.a(IIIII)V; the body is only the stripped invocation counter)
    override update(_angle: number, _plane: number, _x: number, _z: number, _time: number): void {}

    // hl.b()I (overrides ug.b()I)
    override getMinY(): number {
        return this.minY;
    }

    // hl.a(IIIIIIIIJILue;)V (overrides ug.a(IIIIIIIIJILue;)V)
    // Draws the pitched spot model with this projectile's own particle system (hl.k, not the var12 argument) and
    // records its min Y for getMinY.
    // HD ra.a(IIIIIIIIJILga;)V
    override draw(var1: number, var2: number, var3: number, var4: number, var5: number, var6: number, var7: number, var8: number, var9: bigint, var11: number, var12: ParticleSystem | null): void {
        try {
            const var13 = this.GetTempModel();
            if (var13 === null) {
                return;
            }

            var13.draw(var1, var2, var3, var4, var5, var6, var7, var8, var9, var11, this.particles);
            this.minY = var13.getMinY();
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(
                error,
                (glJar ? 'ra.IA(' : 'hl.H(') + var1 + ',' + var2 + ',' + var3 + ',' + var4 + ',' + var5 + ',' + var6 + ',' + var7 + ',' + var8 + ',' + var9 + ',' + var11 + ',' + (var12 !== null ? '{...}' : 'null') + ')'
            );
        }
    }

    // hl.a(I)Lnd; (NXT ClientProj::GetTempModel, clientproj.cpp:165: SpotType::List(id)->GetTempModel2(frame), then the
    // model's pitch rotation)
    // The spot model at (nextFrame, frameCycle, frame), rotated about the X axis by pitch. The Java int argument is a
    // stripped dummy: the live caller (draw) passes 2047, so `if (var1 != 2047) this.k = null` never runs; the only other
    // call (`this.a(47)` in hl.a(BI)V) sits behind that method's own dead guard `var1 != 28` (its one caller, pk, passes
    // 28). SpotType.GetTempModel's dummy byte is -67 here.
    private GetTempModel(): ModelLit | null {
        const var2 = SpotType.List(this.id);
        const var3 = var2.GetTempModel(this.nextFrame, this.frameCycle, this.frame);
        if (var3 === null) {
            return null;
        }

        var3.RotateXAxis(this.pitch);
        return var3;
    }
}
