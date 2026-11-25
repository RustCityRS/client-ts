import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import type DataFile from './DataFile';
import Js5Request from '#/io/Js5Request';
import LocalisedTextClass from '#/ui/LocalisedText';
import { loadClient, loadWorld } from '#/util/GamepackClasses';

// Browser storage can complete asynchronously. A sector-backed cache can
// satisfy the identical group read/write contract synchronously.
export type Js5DiskStore = DataFile | Js5BrowserDiskStore;
export interface Js5BrowserDiskStore {
    read(group: number): Uint8Array | null | Promise<Uint8Array | null>;
    write(group: number, bytes: Uint8Array): void | Promise<void>;
}

export default class Js5DiskRequest extends Js5Request {
    // HD c.g(B)V
    static releaseJs5DiskRequestStatics(guard: number): void {
        try {
            const world = loadWorld();
            releaseReferences(world, 'spriteBuffer');
            const Client = loadClient();
            releaseReferences(Client, 'memLabel');
            if (guard <= 33) {
                return;
            }
            const LocalisedText = LocalisedTextClass;
            releaseReferences(LocalisedText, 'loggedIn', 'englishLoggedIn');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'c.P(' + guard + ')');
        }
    }

    // qc.Q:I
    type = 0;
    // qc.T:Lcg;
    store: Js5DiskStore | null = null;
    // qc.X:[B
    data: Uint8Array | null = null;

    // qc.<init>()V
    constructor() {
        super();
    }

    // qc.e(I)[B
    override getData(): Uint8Array | null {
        if (this.incomplete) throw new Error('Incomplete JS5 disk request');
        return this.data;
    }

    // qc.c(B)I
    override getPercentage(): number {
        return this.incomplete ? 0 : 100;
    }
}
