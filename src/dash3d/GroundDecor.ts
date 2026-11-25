import { intDivide } from '#/util/IntUtils';
import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import { glJar } from '#/client/ClientVariant';
import type ModelSource from './ModelSource';
import { loadClient, loadIfType, loadLocalisedText, loadStructType } from '#/util/GamepackClasses';

// pk in the revision 530 SD gamepack (NXT jag::oldscape::dash3d::GroundDecor): the ground decoration on a square.
// world.SetGroundDecor creates it and fills every field. Field names follow the rev 225 GroundDecor (530 drops
// typecode2: the typecode is a long, and its bit 31 makes world.Fill draw it before the wall).
//
// pk.c(I)V is an unload artifact. b, h and i are invocation counters; c, f, j, k,
// pk.a(I), pk.b(I) and pk.a(Throwable,String,I) are placed in other classes by the member map.
export default class GroundDecor {
    // HD bm.a(B)V
    static releaseHdStatics(guard: number): void {
        try {
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'englishCheckingForUpdates', 'checkingForUpdates');
            const Client = loadClient();
            releaseReferences(Client, 'percent1');
            const StructType = loadStructType();
            releaseReferences(StructType, 'm_pConfigClient');
            const IfType = loadIfType();
            releaseReferences(IfType, 'm_pSprites');
            releaseReferences(LocalisedText, 'frenchLoadedTitleScreen');
            intDivide(-93, intDivide((2 - guard) | 0, 50));
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'bm.A(' + guard + ')');
        }
    }

    // pk.a:I
    z = 0;
    // pk.d:Lug;
    model: ModelSource | null = null;
    // pk.e:J
    typecode = 0n;
    // pk.g:I
    x = 0;
    // pk.l:I
    y = 0;
    declare depthOffset: boolean; // HD bm.n

    // pk.<init>()V
    constructor() {
        if (glJar) this.depthOffset = false;
    }

    // pk.c(I)V artifact: applet-shutdown unload that only nulls statics homed in other classes (membermap kind
    // unload, like the other 117).
}
