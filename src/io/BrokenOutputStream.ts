import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import { SocketIoError, type SocketOutput } from './SocketPlatform';
import { loadClient, loadClientPlayer, loadCookieStatics, loadMinimenu, loadTitleFlames } from '#/util/GamepackClasses';

// sf extends java.io.OutputStream.
export default class BrokenOutputStream implements SocketOutput {
    // HD vg.a(Z)V
    static releaseHdStatics(guard: boolean): void {
        try {
            const Minimenu = loadMinimenu();
            releaseReferences(Minimenu, 'chartreuse');
            const ClientPlayer = loadClientPlayer();
            releaseReferences(ClientPlayer, 'nameSuffixes');
            if (!guard) {
                const Client = loadClient();
                Client.clearInterfaceModelDepth = true;
            }
            const TitleFlames = loadTitleFlames();
            releaseReferences(TitleFlames, 'flameBuffer1');
            const CookieStatics = loadCookieStatics();
            releaseReferences(CookieStatics, 'expiresAttribute');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'vg.B(' + guard + ')');
        }
    }

    // sf.<init>()V
    constructor() {}

    // sf.write(I)V
    writeByte(_value: number): void {
        throw new SocketIoError();
    }

    // Inherited OutputStream behavior.
    write(bytes: Uint8Array, offset: number, length: number): void {
        if (offset < 0 || length < 0 || length > bytes.length - offset) throw new RangeError('Invalid socket write range');
        if (length !== 0) this.writeByte(bytes[offset]);
    }
    flush(): void {}
    close(): void {}
}
