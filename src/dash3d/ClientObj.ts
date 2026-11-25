import { glJar } from '#/client/ClientVariant';
import { isJavaRuntimeException } from '#/util/JavaException';
import WrappedException from '#/util/WrappedException';
import ObjType from '#/config/ObjType';
import ModelSource from './ModelSource';
import type ParticleSystem from './ParticleSystem';

// ig, one ground item in a tile's b.H list.
export default class ClientObj extends ModelSource {
    private minY = -32768; // ig.j:I
    id = 0; // ig.m:I
    count = 0; // ig.p:I

    // ig.<init>()V
    constructor() {
        super(); // ug.<init>()V
    }

    // ig.b()I (overrides ug.b()I)
    override getMinY(): number {
        return this.minY;
    }

    // ig.a(IIIII)V (overrides ug.a(IIIII)V; the body is only the stripped invocation counter)
    override update(_yaw: number, _plane: number, _x: number, _z: number, _time: number): void {}

    // ig.a(IIIIIIIIJILue;)V (overrides ug.a(IIIIIIIIJILue;)V)
    // NXT ClientObj::GetTempModel (clientobj.h, ObjType::List(id) then GetModelLit) is the model half of this body; 530
    // inlines it into the draw, so the method keeps ModelSource's draw name. Draws the obj's lit model for this stack
    // count (no animation: seq null, frame 0, cycle 0, next frame -1) with the caller's particle system var12 and records
    // its min Y. kl's dummy int is -93 here.
    // HD uj.a(IIIIIIIIJILga;)V
    override draw(var1: number, var2: number, var3: number, var4: number, var5: number, var6: number, var7: number, var8: number, var9: bigint, var11: number, var12: ParticleSystem | null): void {
        try {
            const var13 = ObjType.List(this.id).GetModelLit(null, 0, this.count, 0, -1);
            if (var13 === null) {
                return;
            }

            var13.draw(var1, var2, var3, var4, var5, var6, var7, var8, var9, var11, var12);
            this.minY = var13.getMinY();
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(
                error,
                (glJar ? 'uj.IA(' : 'ig.H(') + var1 + ',' + var2 + ',' + var3 + ',' + var4 + ',' + var5 + ',' + var6 + ',' + var7 + ',' + var8 + ',' + var9 + ',' + var11 + ',' + (var12 !== null ? '{...}' : 'null') + ')'
            );
        }
    }
}
