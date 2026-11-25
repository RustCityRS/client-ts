import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type ModelSource from './ModelSource';
import { loadClient, loadScriptRunner } from '#/util/GamepackClasses';

// hk in the revision 530 SD gamepack (NXT jag::oldscape::dash3d::Wall): the wall on a square, with up to two models
// and the wall-type masks they occupy. world.SetWall creates it and fills every field. Field names follow the rev 225
// Wall (530 drops typecode2: the typecode is a long).
//
// None of hk's statics belong here: b and g are invocation counters, and a, d, e, hk.a(Z) and hk.a(II) are placed in
// other classes by the member map.
export default class Wall {
    // HD jh.a(B)V
    static releaseHdStatics(guard: number): void {
        try {
            if (guard !== -87) {
                const Client = loadClient();
                releaseReferences(Client, 'friendUsername');
            }
            const Client = loadClient();
            releaseReferences(Client, 'spotTypeArchive', 'dnsTag', 'friendUsername');
            const ScriptRunner = loadScriptRunner();
            releaseReferences(ScriptRunner, 'activeQuickChatMessage');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'jh.A(' + guard + ')');
        }
    }

    // hk.c:Lug;
    model2: ModelSource | null = null;
    // hk.f:J
    // Stored as 0 by hk.<init> (lconst_0).
    typecode = 0n;
    // hk.h:I
    x = 0;
    // hk.i:Lug;
    model1: ModelSource | null = null;
    // hk.j:I
    angle2 = 0;
    // hk.k:I
    angle1 = 0;
    // hk.l:I
    y = 0;
    // hk.m:I
    z = 0;

    // hk.<init>()V
    constructor() {}
}
