import { expect, test } from 'bun:test';
import BrowserJs5Storage from '#/cache/BrowserJs5Storage.js';
import { openBrowserJs5Database } from '#/cache/Js5Resources.js';

test('530 opens its own IndexedDB cache, creates the version-1 store on upgrade, and propagates open errors', async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
    const opens: [string, number][] = [];
    const stores: string[] = [];
    const database = {
        createObjectStore(name: string) {
            stores.push(name);
        }
    };
    const denied = new DOMException('denied', 'SecurityError');
    const failed = new DOMException('blocked by newer schema', 'VersionError');
    let mode: 'upgrade' | 'existing' | 'failure' | 'denied' = 'upgrade';
    Object.defineProperty(globalThis, 'indexedDB', {
        configurable: true,
        value: {
            open(name: string, version: number) {
                opens.push([name, version]);
                if (mode === 'denied') throw denied;
                const request = {
                    get result() {
                        if (mode === 'failure') throw new Error('Read of failed IndexedDB request.result');
                        return database;
                    },
                    error: failed,
                    onupgradeneeded: null as (() => void) | null,
                    onsuccess: null as (() => void) | null,
                    onerror: null as (() => void) | null
                };
                queueMicrotask(() => {
                    if (mode === 'failure') request.onerror?.();
                    else {
                        if (mode === 'upgrade') request.onupgradeneeded?.();
                        request.onsuccess?.();
                    }
                });
                return request;
            }
        }
    });
    try {
        expect(await openBrowserJs5Database()).toBe(database as unknown as IDBDatabase);
        mode = 'existing';
        expect(await openBrowserJs5Database()).toBe(database as unknown as IDBDatabase);
        expect(stores).toEqual(['cache']);
        mode = 'failure';
        expect(await openBrowserJs5Database().catch(e => e)).toBe(failed);
        mode = 'denied';
        expect(await openBrowserJs5Database().catch(e => e)).toBe(denied);
        expect(opens).toEqual(Array(4).fill(['runescape-530', 1]));
    } finally {
        if (original) Object.defineProperty(globalThis, 'indexedDB', original);
        else Reflect.deleteProperty(globalThis, 'indexedDB');
    }
});

test('browser JS5 verification shares active reads, yields to writers and recovers from inactive or aborted transactions', async () => {
    const values = new Map<string, Uint8Array | Int8Array | ArrayBuffer | null>();
    const transactions: { mode: string; active: boolean; oncomplete: (() => void) | null; onabort: (() => void) | null }[] = [];
    const keys: string[] = [];
    function request<T>(result: T, fail = false, tx?: { active: boolean }) {
        const pending = { result, onsuccess: null as (() => void) | null, onerror: null as ((event: Event) => void) | null };
        queueMicrotask(() => {
            if (fail || tx?.active === false) {
                const event = new Event('error', { cancelable: true, bubbles: true });
                pending.onerror?.(event);
                if (tx && !event.defaultPrevented) tx.active = false;
            } else {
                pending.onsuccess?.();
            }
        });
        return pending;
    }
    const db = {
        transaction(name: string, mode: string) {
            expect(name).toBe('cache');
            const tx = {
                active: true,
                mode,
                oncomplete: null,
                onabort: null,
                objectStore: () => ({
                    get(key: string) {
                        if (!tx.active) throw new DOMException('inactive', 'TransactionInactiveError');
                        if (key === '9.0') throw new DOMException('invalid', 'InvalidStateError');
                        keys.push(key);
                        return request(values.get(key), key === '9.1', tx);
                    },
                    put(data: Uint8Array, key: string) {
                        if (!tx.active) throw new DOMException('inactive', 'TransactionInactiveError');
                        if (key === '9.2') return request(key, true, tx);
                        values.set(key, data);
                        return request(key, false, tx);
                    }
                })
            };
            transactions.push(tx);
            return tx;
        }
    };
    const disk = new BrowserJs5Storage(db as unknown as IDBDatabase);
    values.set('1.0', Int8Array.of(1, -2, 3).subarray(1, 2));
    values.set('1.1', Uint8Array.of(128, 255).buffer);
    values.set('1.2', null);
    expect(await disk.read(1, 0)).toEqual(Uint8Array.of(254));
    expect(await disk.read(1, 1)).toEqual(Uint8Array.of(128, 255));
    for (let i = 2; i < 32; i++) expect(await disk.read(1, i)).toBeUndefined();
    expect(transactions).toHaveLength(1);
    await disk.read(1, 32);
    transactions[0].oncomplete?.();
    await disk.read(1, 33);
    expect(transactions).toHaveLength(2);
    expect(keys).toEqual(Array.from({ length: 34 }, (_, i) => '1.' + i));

    transactions[1].active = false;
    await disk.read(1, 34);
    transactions[1].onabort?.();
    const groupReads = await Promise.all([disk.read(1, 0), disk.read(9, 1), disk.read(1, 1)]);
    expect(groupReads).toEqual([Uint8Array.of(254), undefined, Uint8Array.of(128, 255)]);
    await expect(disk.read(9, 0)).rejects.toMatchObject({ name: 'InvalidStateError' });
    expect(transactions).toHaveLength(3);
    transactions[2].onabort?.();
    await disk.read(1, 35);
    const write = disk.write(1, 35, Uint8Array.of(88));
    const followingRead = disk.read(1, 35);
    await write;
    expect(await followingRead).toEqual(Uint8Array.of(88));
    expect(transactions.map(tx => tx.mode)).toEqual(['readonly', 'readonly', 'readonly', 'readonly', 'readwrite', 'readonly']);
    const start = transactions.length;
    for (let i = 0; i < 31; i++) await disk.write(2, i, Uint8Array.of(i));
    await disk.write(9, 2, Uint8Array.of(1));
    await disk.write(2, 31, Uint8Array.of(31));
    expect(transactions.slice(start).map(tx => [tx.mode, tx.active])).toEqual([
        ['readwrite', true],
        ['readwrite', true]
    ]);
    transactions[start + 1].active = false;
    await disk.write(2, 32, Uint8Array.of(32));
    transactions[start + 1].onabort?.();
    await disk.write(2, 33, Uint8Array.of(33));
    expect(transactions).toHaveLength(start + 3);
    expect(await disk.read(2, 33)).toEqual(Uint8Array.of(33));
    expect(await disk.read(9, 2)).toBeUndefined();
});
