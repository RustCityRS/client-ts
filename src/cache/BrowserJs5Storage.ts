import type { Js5Storage } from './Js5Resources';

// IndexedDB backs the browser's Java disk handles. Consecutive operations of
// the same kind can share a transaction, including from a request's callback.
export default class BrowserJs5Storage implements Js5Storage {
    private store: IDBObjectStore | null = null;
    private mode: IDBTransactionMode = 'readonly';
    private operations = 0;

    constructor(private readonly db: IDBDatabase) {}

    private request(key: string): IDBRequest<Uint8Array | Int8Array | ArrayBuffer | null | undefined>;
    private request(key: string, bytes: Uint8Array): IDBRequest<IDBValidKey>;
    private request(key: string, bytes?: Uint8Array): IDBRequest {
        const mode = bytes === undefined ? 'readonly' : 'readwrite';
        // Switching modes opens a later transaction. The bound also gives a
        // transaction already waiting in another tab its turn.
        if (this.store !== null && this.mode === mode && this.operations < 32) {
            try {
                const request = bytes === undefined ? this.store.get(key) : this.store.put(bytes, key);
                this.operations++;
                return request;
            } catch (error) {
                // A different browser task can run after IndexedDB deactivates
                // the transaction but before its complete/abort event arrives.
                if (!(error instanceof DOMException) || error.name !== 'TransactionInactiveError') throw error;
            }
        }
        const transaction = this.db.transaction('cache', mode);
        const store = transaction.objectStore('cache');
        this.store = store;
        this.mode = mode;
        this.operations = 1;
        transaction.oncomplete = transaction.onabort = () => {
            if (this.store === store) this.store = null;
        };
        return bytes === undefined ? store.get(key) : store.put(bytes, key);
    }

    read(archive: number, group: number): Promise<Uint8Array | undefined> {
        return new Promise(resolve => {
            const request = this.request(`${archive}.${group}`);
            request.onsuccess = () => {
                const bytes = request.result;
                if (bytes instanceof Int8Array) resolve(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
                else if (bytes instanceof ArrayBuffer) resolve(new Uint8Array(bytes));
                else resolve(bytes ?? undefined);
            };
            request.onerror = event => {
                // One unreadable group is a cache miss. Let sibling gets finish in the same transaction.
                event.preventDefault();
                event.stopPropagation();
                resolve(undefined);
            };
        });
    }

    write(archive: number, group: number, bytes: Uint8Array): Promise<void> {
        return new Promise(resolve => {
            const request = this.request(`${archive}.${group}`, bytes);
            request.onsuccess = () => resolve();
            request.onerror = event => {
                // Leave other groups in this transaction intact on a failed write.
                event.preventDefault();
                event.stopPropagation();
                resolve();
            };
        });
    }
}
