import { SocketIoError } from '#/io/SocketPlatform.js';
import { ClientScript } from '#/script/ClientScript.js';
import { fromLiteral } from '#/datastruct/JagString.js';
import { requireNonNull } from '#/util/JavaArray.js';

export function program(key: number, ints: number, strings: number, intArgs: number, strArgs: number, code: string): void {
    const script = new ClientScript(),
        ins = code.split(' ');
    script.intLocals = ints;
    script.stringLocals = strings;
    script.intArgs = intArgs;
    script.stringArgs = strArgs;
    script.opcodes = new Int32Array(ins.length);
    script.intOperands = new Int32Array(ins.length);
    script.stringOperands = new Array(ins.length).fill(null);
    ins.forEach((word, i) => {
        const [op, arg] = word.split(':');
        requireNonNull(script.opcodes)[i] = +op;
        if (+op === 3) requireNonNull(script.stringOperands)[i] = fromLiteral(arg);
        else if (arg !== undefined) requireNonNull(script.intOperands)[i] = +arg;
    });
    ClientScript.m_cache.Put(BigInt(key), script);
}

export class DelayedSocket {
    readonly entered = Promise.withResolvers<void>();
    readonly release = Promise.withResolvers<void>();
    readonly sent: number[] = [];
    position = 0;
    closed = false;
    constructor(
        readonly data: Uint8Array,
        readonly fail = false
    ) {}
    GetAvailable() {
        return this.data.length - this.position;
    }
    async read() {
        if (this.position === 0) {
            this.entered.resolve();
            await this.release.promise;
        }
        if (this.closed || this.fail) throw new SocketIoError();
        return this.position < this.data.length ? this.data[this.position++] : -1;
    }
    async Read(dst: Uint8Array | null, offset: number, length: number) {
        requireNonNull(dst).set(this.data.subarray(this.position, this.position + length), offset);
        this.position += length;
    }
    Write(offset: number, src: Uint8Array | null, length: number) {
        this.sent.push(...requireNonNull(src).slice(offset, offset + length));
    }
    Close() {
        this.closed = true;
        this.release.resolve();
    }
}
