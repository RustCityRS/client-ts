import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import { loadClient, loadCookieStatics, loadOrbitCamera, loadPlayerModel, loadWorld } from '#/util/GamepackClasses';
export default class EnvelopeSet {
    // HD wh.a(B)V
    static releaseHdStatics(guard: number): void {
        try {
            const OrbitCamera = loadOrbitCamera();
            releaseReferences(OrbitCamera, 'shakeAmplitude');
            const world = loadWorld();
            releaseReferences(world, 'underwaterSquares');
            const Client = loadClient();
            releaseReferences(Client, 'percent2', 'rectDebugPrefix');
            if (guard >= -126) {
                releaseReferences(Client, 'percent2');
            }
            releaseReferences(Client, 'soundEffectLoops');
            const PlayerModel = loadPlayerModel();
            releaseReferences(PlayerModel, 'slotFramesets');
            releaseReferences(Client, 'hintHeadicons');
            const CookieStatics = loadCookieStatics();
            releaseReferences(CookieStatics, 'cookiePathDomain');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'wh.B(' + guard + ')');
        }
    }

    // uf.a:I
    volumeKeyScale = 0;
    // uf.c:I
    vibratoRate = 0;
    // uf.d:I
    vibratoDepth = 0;
    // uf.e:I
    decay = 0;
    // uf.h:[B
    volumeEnvelope: Int8Array | null = null;
    // uf.i:I
    vibratoDelay = 0;
    // uf.k:I
    decayKeyScale = 0;
    // uf.o:I
    releaseKeyScale = 0;
    // uf.u:[B
    releaseEnvelope: Int8Array | null = null;
    // uf.<init>()V
    constructor() {}
}
