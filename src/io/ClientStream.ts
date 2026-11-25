import { releaseReferences } from '#/util/StaticReferences';
import { glJar } from '#/client/ClientVariant';
import { isJavaRuntimeException } from '#/util/JavaException';
import WrappedException from '#/util/WrappedException';
import { requireNonNull } from '#/util/JavaArray';
import BrokenInputStream from './BrokenInputStream';
import BrokenOutputStream from './BrokenOutputStream';
import { byteAt } from './JavaByteArray';
import type Signlink from '#/util/Signlink';
import type { SignlinkThread } from '#/util/Signlink';
import type SignlinkRequest from '#/util/SignlinkRequest';
import ThreadUtils from '#/util/ThreadUtils';
import { reportClientError } from '#/util/ClientError';
import { SocketIoError, type SocketHandle, type SocketInput, type SocketOutput } from './SocketPlatform';
import { loadAreaSoundManager, loadWorldMap } from '#/util/GamepackClasses';

// se
export default class ClientStream {
    // HD ma.b(I)V
    static releaseHdStatics(guard: number): void {
        try {
            if (guard !== 0) {
                const AreaSoundManager = loadAreaSoundManager();
                releaseReferences(AreaSoundManager, 'npcs');
            }
            const AreaSoundManager = loadAreaSoundManager();
            releaseReferences(AreaSoundManager, 'npcs');
            const WorldMap = loadWorldMap();
            releaseReferences(WorldMap, 'font12');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ma.I(' + guard + ')');
        }
    }

    private output: SocketOutput; // se.c:Ljava/io/OutputStream;
    private input: SocketInput; // se.f:Ljava/io/InputStream;
    private readonly signlink: Signlink | null; // se.i:Lfb;
    private closed = false; // se.m:Z
    private writer: SignlinkRequest<SignlinkThread> | null = null; // se.n:Ldj;
    private tail = 0; // se.o:I
    private readonly socket: SocketHandle | null; // se.p:Ljava/net/Socket;
    private head = 0; // se.q:I
    private writeFailed = false; // se.y:Z
    private buffer: Uint8Array<ArrayBuffer> | null = null; // se.B:[B

    // Promise waiter for the Java object monitor used by se.run, write and close.
    private wake: (() => void) | null = null;

    // se.<init>(Ljava/net/Socket;Lfb;)V
    constructor(socket: SocketHandle | null, signlink: Signlink | null) {
        try {
            this.signlink = signlink;
            this.socket = socket;
            const handle = requireNonNull(socket);
            handle.setSoTimeout?.(30000);
            handle.setTcpNoDelay?.(true);
            this.input = handle.input;
            this.output = handle.output;
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, (glJar ? 'ma.<init>(' : 'se.<init>(') + (socket === null ? 'null' : '{...}') + ',' + (signlink === null ? 'null' : '{...}') + ')');
        }
    }

    // se.run()V
    async run(): Promise<void> {
        try {
            for (;;) {
                if (this.head === this.tail) {
                    if (this.closed) break;
                    await new Promise<void>(resolve => {
                        this.wake = resolve;
                    });
                    this.wake = null;
                }
                const length = this.tail >= this.head ? (this.tail - this.head) | 0 : (5000 - this.head) | 0;
                const offset = this.head;
                if (length > 0) {
                    try {
                        this.output.write(requireNonNull(this.buffer), offset, length);
                    } catch (error) {
                        if (!(error instanceof SocketIoError)) throw error;
                        this.writeFailed = true;
                    }
                    this.head = (this.head + length) % 5000;
                    try {
                        if (this.head === this.tail) this.output.flush();
                    } catch (error) {
                        if (!(error instanceof SocketIoError)) throw error;
                        this.writeFailed = true;
                    }
                }
            }
            try {
                this.input?.close();
                this.output?.close();
                this.socket?.close();
            } catch (error) {
                if (!(error instanceof SocketIoError)) throw error;
            }
            this.buffer = null;
        } catch (error) {
            await reportClientError(error instanceof Error ? error : new Error(String(error)), null);
        }
    }

    // se.finalize()V
    finalize(): Promise<void> {
        return this.Close();
    }

    // SD se.a(I)I / HD ma.c(I)I. Stock HD call sites supply -18358.
    GetAvailable(site = 1): number {
        try {
            return this.closed ? 0 : this.input.available;
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, glJar ? 'ma.B(-18358)' : 'se.D(' + site + ')');
        }
    }

    // se.b(I)V
    checkError(): void {
        if (!this.closed && this.writeFailed) {
            this.writeFailed = false;
            throw new SocketIoError();
        }
    }

    // se.c(I)V
    breakConnection(): void {
        if (!this.closed) {
            this.input = new BrokenInputStream();
            this.output = new BrokenOutputStream();
        }
    }

    // se.a(B[BII)V
    async Read(bytes: Uint8Array | null, offset: number, length: number): Promise<void> {
        if (!this.closed) {
            while (length > 0) {
                const count = await this.input.readBytes(requireNonNull(bytes), offset, length);
                if (count <= 0) throw new SocketIoError('End of stream');
                length = (length - count) | 0;
                offset = (offset + count) | 0;
            }
        }
    }

    // JS5 has already checked the buffered byte count. Other socket hosts keep the blocking Read path.
    tryReadBuffered(bytes: Uint8Array | null, offset: number, length: number): boolean {
        if (this.closed || length <= 0) return true;
        return this.input.tryReadBuffered?.(requireNonNull(bytes), offset, length) ?? false;
    }

    // se.d(I)I
    async read(): Promise<number> {
        try {
            return this.closed ? 0 : await this.input.read();
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, glJar ? 'ma.E(0)' : 'se.I(17506)');
        }
    }

    // se.a(B)V
    async Close(): Promise<void> {
        if (!this.closed) {
            this.closed = true;
            this.wake?.();
            if (this.writer !== null) {
                while (this.writer.status === 0) await ThreadUtils.sleep(1n);
                if (this.writer.status === 1) await requireNonNull(this.writer.result).join();
            }
            this.writer = null;
        }
    }

    // se.a(I[BIB)V
    Write(offset: number, bytes: Uint8Array | null, length: number): void {
        if (this.closed) return;
        if (this.writeFailed) {
            this.writeFailed = false;
            throw new SocketIoError();
        }
        this.buffer ??= new Uint8Array(5000);
        for (let i = 0; i < length; i++) {
            this.buffer[this.tail] = byteAt(bytes, (offset + i) | 0);
            this.tail = (this.tail + 1) % 5000;
            if (this.tail === (this.head + 4900) % 5000) throw new SocketIoError('Socket buffer full');
        }
        if (this.writer === null) this.writer = requireNonNull(this.signlink).startThread(this, 3);
        this.wake?.();
    }
}
