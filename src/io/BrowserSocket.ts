import { SocketIoError, type SocketHandle, type SocketInput } from './SocketPlatform';

// Browser boundary for Socket.getInputStream(). A WebSocket message can span
// several reads, and a blocking gamepack read can span several messages.
class BrowserSocketInput implements SocketInput {
    private chunks: Uint8Array[] = [];
    private head = 0;
    private offset = 0;
    private length = 0;
    private ended = false;
    private failed = false;
    private wake: (() => void) | null = null;

    constructor(socket: WebSocket) {
        socket.binaryType = 'arraybuffer';
        socket.addEventListener('message', event => {
            const chunk = new Uint8Array(event.data);
            if (!this.ended && chunk.length !== 0) {
                this.chunks.push(chunk);
                this.length += chunk.length;
                this.wake?.();
            }
        });
        socket.addEventListener('close', () => {
            this.ended = true;
            this.wake?.();
        });
        socket.addEventListener('error', () => {
            this.failed = this.ended = true;
            this.wake?.();
        });
    }

    get available(): number {
        if (this.failed && this.length === 0) throw new SocketIoError('Socket read failed');
        return this.length;
    }

    private async waitForData(): Promise<boolean> {
        while (this.available === 0 && !this.ended) {
            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    this.wake = null;
                    reject(new SocketIoError('Socket read timed out'));
                }, 30000);
                this.wake = () => {
                    clearTimeout(timeout);
                    this.wake = null;
                    resolve();
                };
            });
        }
        return this.available !== 0;
    }

    private consume(count: number): void {
        this.length -= count;
        this.offset += count;
        const chunk = this.chunks[this.head];
        if (this.offset === chunk.length) {
            // Only copies or scalar bytes leave the adapter. Once an entire
            // frame is consumed, retire its backing immediately on browsers
            // with transferable ArrayBuffers. Let small packets go through GC.
            if (chunk.length >= 512 && chunk.buffer instanceof ArrayBuffer) chunk.buffer.transfer?.(0);
            this.head++;
            this.offset = 0;
            if (this.head === this.chunks.length || this.head >= 64) {
                this.chunks.splice(0, this.head);
                this.head = 0;
            }
        }
    }

    async read(): Promise<number> {
        if (!this.available && !(await this.waitForData())) return -1;
        const value = this.chunks[this.head][this.offset];
        this.consume(1);
        return value;
    }

    private checkRange(bytes: Uint8Array, offset: number, length: number): void {
        if (offset < 0 || length < 0 || length > bytes.length - offset) throw new RangeError('Invalid socket read range');
    }

    private copyChunk(bytes: Uint8Array, offset: number, length: number): number {
        const chunk = this.chunks[this.head];
        const count = Math.min(length, chunk.length - this.offset);
        bytes.set(count === chunk.length ? chunk : chunk.subarray(this.offset, this.offset + count), offset);
        this.consume(count);
        return count;
    }

    async readBytes(bytes: Uint8Array, offset: number, length: number): Promise<number> {
        this.checkRange(bytes, offset, length);
        if (length === 0) return 0;
        if (!this.available && !(await this.waitForData())) return -1;
        return this.copyChunk(bytes, offset, length);
    }

    tryReadBuffered(bytes: Uint8Array, offset: number, length: number): boolean {
        this.checkRange(bytes, offset, length);
        if (length === 0) return true;
        if (this.available < length) return false;
        while (length > 0) {
            const count = this.copyChunk(bytes, offset, length);
            offset += count;
            length -= count;
        }
        return true;
    }

    close(): void {
        this.ended = true;
        this.chunks = [];
        this.head = this.offset = this.length = 0;
        this.wake?.();
    }
}

// The WebSocket origin is a host boundary. Majula's proxy accepts the game and JS5 channels on the same origin.
export async function openBrowserSocketHandle(host: string, port: number, secured = false): Promise<SocketHandle> {
    const endpoint = new URL((secured ? 'wss://' : 'ws://') + host);
    if (port > 0) endpoint.port = String(port);
    const socket = new WebSocket(endpoint, 'binary');
    const input = new BrowserSocketInput(socket);
    await new Promise<void>((resolve, reject) => {
        function finished(): void {
            socket.removeEventListener('open', opened);
            socket.removeEventListener('error', failed);
            socket.removeEventListener('close', failed);
        }
        function opened(): void {
            finished();
            resolve();
        }
        function failed(): void {
            finished();
            reject(new SocketIoError('Socket open failed'));
        }
        socket.addEventListener('open', opened);
        socket.addEventListener('error', failed);
        socket.addEventListener('close', failed);
    });
    return {
        input,
        output: {
            write(bytes, offset, length) {
                if (socket.readyState !== WebSocket.OPEN) throw new SocketIoError('Socket closed');
                try {
                    socket.send(bytes.subarray(offset, offset + length));
                } catch (cause) {
                    throw new SocketIoError('Socket write failed', { cause });
                }
            },
            flush() {},
            close() {}
        },
        close: () => {
            input.close();
            socket.close();
        }
    };
}
