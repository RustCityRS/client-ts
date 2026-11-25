import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import { loadClientBuild, loadClientKeyboardListener, loadCookieStatics, loadLocalisedText } from '#/util/GamepackClasses';
export default abstract class Timer {
    // HD s.a(I)V
    static releaseTimerStatics(guard: number): void {
        try {
            const ClientBuild = loadClientBuild();
            releaseReferences(ClientBuild, 'm_huetot');
            if (guard !== 24241) {
                Timer.releaseTimerStatics(84);
            }
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD rd stays deferred until s.a(I)V in Timer.releaseTimerStatics.
            const BZip2Decompressor = (require('#/cache/BZip2Decompressor') as typeof import('#/cache/BZip2Decompressor')).default;
            releaseReferences(BZip2Decompressor, 'block');
            const ClientKeyboardListener = loadClientKeyboardListener();
            releaseReferences(ClientKeyboardListener, 'eventCodes');
            const CookieStatics = loadCookieStatics();
            releaseReferences(CookieStatics, 'cookiePrefix');
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'germanSelfFriend');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 's.E(' + guard + ')');
        }
    }

    // e.<init>()V
    constructor() {}

    // e.a(B)V
    abstract reset(): void;

    // e.a(BII)I
    abstract wait(minimumSleep: number, cycleTime: number): Promise<number>;

    // Browser monotonic deadline for optional GPU work during an outstanding wait.
    browserWakeTime?(): number;

    // kl.b(B)Le;
    static async create(): Promise<Timer> {
        try {
            const { default: NanoTimer } = await import('./NanoTimer');
            return new NanoTimer();
        } catch {
            const { default: MillisTimer } = await import('./MillisTimer');
            return new MillisTimer();
        }
    }
}
