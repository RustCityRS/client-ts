import { intDivide } from '#/util/IntUtils';
import ThreadUtils from '#/util/ThreadUtils';
import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type { SocketInput } from './SocketPlatform';
import { loadBrowserControl, loadClient, loadLocalisedText, loadWorld } from '#/util/GamepackClasses';

// lf extends java.io.InputStream.
export default class BrokenInputStream implements SocketInput {
    // HD qk.a(I)V
    static releaseHdStatics(guard: number): void {
        try {
            intDivide(10, intDivide((-37 - guard) | 0, 33));
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'englishMenuSeparator');
            const Client = loadClient();
            releaseReferences(Client, 'js5ConnectStream');
            releaseReferences(LocalisedText, 'MINISEPERATOR');
            const BrowserControl = loadBrowserControl();
            releaseReferences(BrowserControl, 'tbrefresh');
            releaseReferences(Client, 'zeroPercent');
            const world = loadWorld();
            releaseReferences(world, 'roofHideMinZ');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'qk.C(' + guard + ')');
        }
    }

    // lf.<init>()V
    constructor() {}

    // SD lf.read()I, HD qk.read()I
    async read(): Promise<number> {
        await ThreadUtils.sleep(30000n);
        return -1;
    }

    // Inherited InputStream behavior.
    get available(): number {
        return 0;
    }
    async readBytes(bytes: Uint8Array, offset: number, length: number): Promise<number> {
        if (offset < 0 || length < 0 || length > bytes.length - offset) throw new RangeError('Invalid socket read range');
        return length === 0 ? 0 : this.read();
    }
    close(): void {}
}
