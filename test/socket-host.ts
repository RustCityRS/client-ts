import { requireNonNull } from '#/util/JavaArray.js';
import { setLocalWorld, saveWorldConnection } from './world-connection.js';
import { afterEach } from 'bun:test';
import GameShell from '#/client/GameShell.js';
import Client from '#/client/Client.js';
import Signlink from '#/util/Signlink.js';
import type { Js5Stream, SocketHandle } from '#/io/SocketPlatform.js';

// Let the runnable on the Signlink worker finish the current request between Java client ticks.
export function settleSignlink(): Promise<void> {
    return new Promise(resolve => setImmediate(resolve));
}

export function openWorldSocket(): void {
    Client.socketRequest = requireNonNull(GameShell.signlink).openSocket(Client.worldListHost, Client.worldListPort);
}

export function socketHandle(stream: Js5Stream): SocketHandle {
    return {
        input: {
            get available() {
                return stream.GetAvailable();
            },
            async read() {
                await settleSignlink();
                return stream.read();
            },
            async readBytes(dst, off, len) {
                const n = await stream.Read(dst, off, len);
                return typeof n === 'number' ? n : len;
            },
            close() {}
        },
        output: {
            write(bytes, off, len) {
                stream.Write(off, bytes, len);
            },
            flush() {},
            close() {}
        },
        close() {
            stream.Close();
        }
    };
}
let restore: (() => void) | null = null;
export function installRawHost(open: (host: string, port: number) => Promise<SocketHandle>, world = 1, applet: object | null = null) {
    restore?.();
    const previous = GameShell.signlink,
        oldWorld = saveWorldConnection();
    const saved = Object.getOwnPropertyDescriptors(Signlink);
    setLocalWorld(world);
    const platform = new Signlink(applet, { openSocket: open });
    GameShell.signlink = platform;
    restore = () => {
        Object.assign(Client, oldWorld);
        GameShell.signlink = previous;
        void platform.stopWorker();
        Object.defineProperties(Signlink, saved);
        restore = null;
    };
}
export function installSocketHost(open: (alternate: boolean) => Promise<Js5Stream>, world = 1, applet: object | null = null) {
    installRawHost(async (_host, port) => socketHandle(await open(port === Client.secondaryPort || port === Client.worldListSecondaryPort)), world, applet);
}
export function restoreSocketHost(): void {
    restore?.();
}
afterEach(restoreSocketHost);

export function closeGameStream(): void | Promise<void> {
    const closed = Client.stream?.Close();
    Client.stream = null;
    return closed;
}
