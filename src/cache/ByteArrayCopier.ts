import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import ArrayUtils from '#/util/ArrayUtils';
import { loadComponentDrag, loadCookieStatics, loadLocalisedText } from '#/util/GamepackClasses';

export type StoredBytes = Uint8Array | ByteArrayCopier;

export default abstract class ByteArrayCopier {
    // HD u.a(B)V
    static releaseHdStatics(guard: number): void {
        try {
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'ignoresFull', 'englishIgnoresFull');
            if (guard < 0) {
                const ComponentDrag = loadComponentDrag();
                ComponentDrag.dragMouseX = -60;
            }
            releaseReferences(LocalisedText, 'frenchStarted3dLibrary');
            const CookieStatics = loadCookieStatics();
            releaseReferences(CookieStatics, 'paramCookieHost');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'u.F(' + guard + ')');
        }
    }

    // pj.P:Z
    static directBufferUnavailable = false;

    // mc.a([BIZ)Ljava/lang/Object;
    static wrap(bytes: Uint8Array, threshold: number, copy: boolean): StoredBytes;
    static wrap(bytes: Uint8Array | null, threshold: number, copy: boolean): StoredBytes | null;
    static wrap(bytes: Uint8Array | null, threshold: number, copy: boolean): StoredBytes | null {
        if (bytes === null) return null;
        if (threshold < bytes.length && !ByteArrayCopier.directBufferUnavailable) {
            try {
                // Class.forName("md").newInstance() resolves the subclass only on this path.
                // eslint-disable-next-line @typescript-eslint/no-require-imports -- SD md stays deferred until ByteArrayCopier.wrap.
                const { default: DirectByteArrayCopier } = require('./DirectByteArrayCopier') as typeof import('./DirectByteArrayCopier');
                const buffer = new DirectByteArrayCopier();
                buffer.set(bytes);
                return buffer;
            } catch {
                ByteArrayCopier.directBufferUnavailable = true;
            }
        }
        return copy ? ArrayUtils.copy(bytes, (threshold - 136) | 0) : bytes;
    }

    // gg.a(ZLjava/lang/Object;B)[B
    static unwrap(copy: boolean, data: StoredBytes): Uint8Array;
    static unwrap(copy: boolean, data: unknown): Uint8Array | null;
    static unwrap(copy: boolean, data: unknown): Uint8Array | null {
        if (data === null) return null;
        if (data instanceof Uint8Array) return copy ? ArrayUtils.copy(data, 0) : data;
        if (data instanceof ByteArrayCopier) return data.get();
        throw new TypeError('Invalid JS5 byte storage');
    }

    // rb.<init>()V
    constructor() {}

    // rb.a(B[B)V
    abstract set(bytes: Uint8Array | null): void;

    // rb.b(B)[B
    abstract get(): Uint8Array;
}
