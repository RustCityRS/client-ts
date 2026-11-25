import { glJar } from '#/client/ClientVariant';
import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import SeqType from '#/config/SeqType';
import SpotType from '#/config/SpotType';
import SharedPtrList from '#/datastruct/SharedPtrList';
import type ParticleSystem from './ParticleSystem';
import type MapSpotAnimNode from './MapSpotAnimNode';
import { arrayAtI32, requireNonNull } from '#/util/JavaArray';
import type ModelLit from './ModelLit';
import ModelSource from './ModelSource';
import { loadClient, loadFonts } from '#/util/GamepackClasses';

// ac. Scene model construction is owned by the SoftwareModel/SpotType port.
export default class MapSpotAnim extends ModelSource {
    // HD bh.b(I)V
    static releaseMapSpotAnimStatics(guard: number): void {
        try {
            if (guard !== 0) {
                return;
            }
            const Client = loadClient();
            releaseReferences(Client, 'floorshadowsSpriteName');
            const Fonts = loadFonts();
            releaseReferences(Fonts, 'p11FullName');
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD be stays deferred until bh.b(I)V in MapSpotAnim.releaseMapSpotAnimStatics.
            const SuperPacket = (require('#/io/SuperPacket') as typeof import('#/io/SuperPacket')).default;
            releaseReferences(SuperPacket, 'bitMasks');
            releaseReferences(Client, 'loadingDoneSuffix');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'bh.B(' + guard + ')');
        }
    }

    static readonly active = new SharedPtrList<MapSpotAnimNode>(); // ph.g:Lgk;
    plane: number; // ac.m:I
    y: number; // ac.n:I
    id: number; // ac.p:I
    nextFrame = -1; // ac.q:I
    private minY = -32768; // ac.s:I
    frame = 0; // ac.t:I
    z: number; // ac.u:I
    frameCycle = 0; // ac.v:I
    particles: ParticleSystem | null = null; // ac.w:Lue;
    finished = false; // ac.x:Z
    startCycle: number; // ac.y:I
    private seq: SeqType | null = null; // ac.z:Lek;
    x: number; // ac.C:I

    // ac.<init>(IIIIIII)V
    constructor(id: number, plane: number, x: number, z: number, y: number, delay: number, cycle: number) {
        super(); // ug.<init>()V
        this.x = x;
        this.z = z;
        this.plane = plane;
        this.id = id;
        this.y = y;
        this.startCycle = (delay + cycle) | 0;
        const sequence = SpotType.List(this.id).seq;
        if (sequence !== -1) {
            this.finished = false;
            this.seq = SeqType.List(sequence);
        } else this.finished = true;
    }

    // ac.a(IIIII)V (overrides ug.a(IIIII)V; the body is only the stripped invocation counter)
    override update(_angle: number, _plane: number, _x: number, _z: number, _time: number): void {}

    // ac.b(B)Lnd; (NXT MapSpotAnim::GetTempModel, MapSpotAnim.h:100: SpotType::List(id) then GetTempModel2 with frame -1
    // once finished)
    // The spot model for the current frame: unanimated (next frame -1, cycle 0, frame -1) once the sequence finished,
    // else animated at (nextFrame, frameCycle, frame). The Java byte argument is a stripped dummy: the only caller (draw)
    // passes -25, so `56 % ((10 - var1) / 32)` divides by 1 and never throws. The two SpotType.GetTempModel calls pass
    // -44 and -47 for li's own dummy byte. `var4 == null ? null : var4` returns var4 unchanged.
    private GetTempModel(): ModelLit | null {
        const var2 = SpotType.List(this.id);
        if (this.finished) {
            return var2.GetTempModel(-1, 0, -1);
        }

        return var2.GetTempModel(this.nextFrame, this.frameCycle, this.frame);
    }

    // ac.a(IIIIIIIIJILue;)V (overrides ug.a(IIIIIIIIJILue;)V)
    // Draws the current frame's model with this anim's own particle system (ac.w, not the var12 argument) and records
    // its min Y for getMinY.
    // HD bh.a(IIIIIIIIJILga;)V
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
                (glJar ? 'bh.IA(' : 'ac.H(') + var1 + ',' + var2 + ',' + var3 + ',' + var4 + ',' + var5 + ',' + var6 + ',' + var7 + ',' + var8 + ',' + var9 + ',' + var11 + ',' + (var12 !== null ? '{...}' : 'null') + ')'
            );
        }
    }

    // ac.a(II)V
    advance(delta: number): void {
        if (!this.finished) {
            this.frameCycle = (this.frameCycle + delta) | 0;
            const seq = requireNonNull(this.seq);
            while (arrayAtI32(seq.delays, this.frame) < this.frameCycle) {
                this.frameCycle = (this.frameCycle - arrayAtI32(seq.delays, this.frame)) | 0;
                this.frame = (this.frame + 1) | 0;
                if (this.frame >= requireNonNull(seq.frames).length) {
                    this.finished = true;
                    return;
                }
            }
        }
    }

    // ac.b()I (overrides ug.b()I)
    override getMinY(): number {
        return this.minY;
    }
}
