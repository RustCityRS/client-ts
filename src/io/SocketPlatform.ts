import Client from '#/client/Client';
import { JavaCheckedException } from '#/util/JavaException';
import { onSignlinkRequestSettled } from '#/util/Signlink';
import type SignlinkRequest from '#/util/SignlinkRequest';

export interface Js5Stream {
    GetAvailable(site?: number): number;
    Write(offset: number, src: Uint8Array | null, length: number): void;
    read(): Promise<number>;
    Read(dst: Uint8Array | null, offset: number, length: number): Promise<unknown>;
    tryReadBuffered?(dst: Uint8Array | null, offset: number, length: number): boolean;
    Close(): void | Promise<void>;
    checkError?(): void;
    breakConnection?(): void;
}

export class SocketIoError extends JavaCheckedException {}

export interface SocketInput {
    readonly available: number;
    read(): Promise<number>;
    readBytes(bytes: Uint8Array, offset: number, length: number): Promise<number>;
    // Copies the entire range immediately or returns false without consuming input.
    tryReadBuffered?(bytes: Uint8Array, offset: number, length: number): boolean;
    close(): void;
}

export interface SocketOutput {
    write(bytes: Uint8Array<ArrayBuffer>, offset: number, length: number): void;
    flush(): void;
    close(): void;
}

export interface SocketHandle {
    setSoTimeout?(milliseconds: number): void;
    setTcpNoDelay?(enabled: boolean): void;
    readonly input: SocketInput;
    readonly output: SocketOutput;
    close(): void;
}

// A browser can close the applet while its Signlink DNS/WebSocket task is still opening.
export function discardSocket(request: SignlinkRequest<SocketHandle>): void {
    onSignlinkRequestSettled(request, () => request.result?.close());
}

// Release the connected peer and any still-opening Signlink request on browser teardown.
export function cancelSocket(): void | Promise<void> {
    const closed = Client.stream?.Close();
    Client.stream = null;
    if (Client.socketRequest !== null) discardSocket(Client.socketRequest);
    Client.socketRequest = null;
    return closed;
}
