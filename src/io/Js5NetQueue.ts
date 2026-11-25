import { byteAt, putByte } from './JavaByteArray';
import { JavaError } from '#/util/ClientError';
import { requireNonNull } from '#/util/JavaArray';
import { mathRandom } from '#/util/JavaRandom';
import SecondaryLinkedList from '#/datastruct/SecondaryLinkedList';
import Js5NetQueueRequest from './Js5NetQueueRequest';
import SafeTime from './SafeTime';
import PacketT from './PacketT';
import { SocketIoError, type Js5Stream } from './SocketPlatform';

// ej
export default class Js5NetQueue {
    private readonly urgent = new SecondaryLinkedList<Js5NetQueueRequest>(); // ej.c:Ltb;
    private readonly urgentSent = new SecondaryLinkedList<Js5NetQueueRequest>(); // ej.x:Ltb;
    private readonly prefetch = new SecondaryLinkedList<Js5NetQueueRequest>(); // ej.y:Ltb;
    private readonly prefetchSent = new SecondaryLinkedList<Js5NetQueueRequest>(); // ej.z:Ltb;
    private stream: Js5Stream | null = null; // ej.B:Lse;
    private idleTime = 0; // ej.C:I
    private readonly outbound = new PacketT(4); // ej.D:Lgd;
    private lastTick = 0n; // ej.E:J
    response = 0; // ej.F:I
    errors = 0; // ej.G:I
    private xorKey = 0; // ej.H:B
    private header: PacketT | null = new PacketT(8); // ej.I:Lgd;
    private current: Js5NetQueueRequest | null = null; // ej.J:Lfd;

    // ej.<init>()V
    constructor() {}

    // ej.a(I)I
    private GetPrefetchQueueSize(guard: number): number {
        if (guard !== 2) this.header = null;
        return (this.prefetch.size() + this.prefetchSent.size()) | 0;
    }

    // ej.b(B)I
    GetUrgentQueueSize(): number {
        return (this.urgent.size() + this.urgentSent.size()) | 0;
    }

    // ej.a(B)Z
    IsUrgentQueueFull(): boolean {
        return this.GetUrgentQueueSize() >= 20;
    }

    // ej.e(I)Z
    IsPrefetchQueueFull(): boolean {
        return this.GetPrefetchQueueSize(2) >= 20;
    }

    // ej.a(BZ)V
    setLoggedIn(loggedIn: boolean): void {
        if (this.stream !== null) {
            try {
                this.outbound.m_pos = 0;
                this.outbound.p1(loggedIn ? 2 : 3);
                this.outbound.p3(0);
                requireNonNull(this.stream).Write(0, this.outbound.m_data, 4);
            } catch (error) {
                if (!(error instanceof SocketIoError)) throw error;
                try {
                    requireNonNull(this.stream).Close();
                } catch (closing) {
                    if (!(closing instanceof Error) || closing instanceof JavaError) throw closing;
                }
                this.response = -2;
                this.errors = (this.errors + 1) | 0;
                this.stream = null;
            }
        }
    }

    // ej.c(I)V
    private sendConnected(): void {
        if (this.stream !== null) {
            try {
                this.outbound.m_pos = 0;
                this.outbound.p1(6);
                this.outbound.p3(3);
                requireNonNull(this.stream).Write(0, this.outbound.m_data, 4);
            } catch (error) {
                if (!(error instanceof SocketIoError)) throw error;
                try {
                    requireNonNull(this.stream).Close();
                } catch (closing) {
                    if (!(closing instanceof Error) || closing instanceof JavaError) throw closing;
                }
                this.response = -2;
                this.errors = (this.errors + 1) | 0;
                this.stream = null;
            }
        }
    }

    // ej.a(Z)V
    RequestServerDrop(): void {
        if (this.stream !== null) {
            try {
                this.outbound.m_pos = 0;
                this.outbound.p1(7);
                this.outbound.p3(0);
                requireNonNull(this.stream).Write(0, this.outbound.m_data, 4);
            } catch (error) {
                if (!(error instanceof SocketIoError)) throw error;
                try {
                    requireNonNull(this.stream).Close();
                } catch (closing) {
                    if (!(closing instanceof Error) || closing instanceof JavaError) throw closing;
                }
                this.response = -2;
                this.errors = (this.errors + 1) | 0;
                this.stream = null;
            }
        }
    }

    // ej.a(ZBLse;)V
    ProvideConnection(loggedIn: boolean, stream: Js5Stream | null): void {
        if (this.stream !== null) {
            try {
                this.stream.Close();
            } catch (closing) {
                if (!(closing instanceof Error) || closing instanceof JavaError) throw closing;
            }
            this.stream = null;
        }
        this.stream = stream;
        this.sendConnected();
        this.setLoggedIn(loggedIn);
        requireNonNull(this.header).m_pos = 0;
        this.current = null;
        for (let node = this.urgentSent.removeHead(); node !== null; node = this.urgentSent.removeHead()) {
            this.urgent.addTail(node);
        }
        for (let node = this.prefetchSent.removeHead(); node !== null; node = this.prefetchSent.removeHead()) {
            this.prefetch.addTail(node);
        }
        if (this.xorKey !== 0) {
            try {
                this.outbound.m_pos = 0;
                this.outbound.p1(4);
                this.outbound.p1(this.xorKey);
                this.outbound.p2(0);
                requireNonNull(this.stream).Write(0, this.outbound.m_data, 4);
            } catch (error) {
                if (!(error instanceof SocketIoError)) throw error;
                try {
                    requireNonNull(this.stream).Close();
                } catch (closing) {
                    if (!(closing instanceof Error) || closing instanceof JavaError) throw closing;
                }
                this.response = -2;
                this.errors = (this.errors + 1) | 0;
                this.stream = null;
            }
        }
        this.idleTime = 0;
        this.lastTick = SafeTime.CurrentTimeMillis();
    }

    // ej.a(BIIBZ)Lfd;
    RequestData(padding: number, group: number, archive: number, urgent: boolean): Js5NetQueueRequest {
        const key = BigInt(((archive << 16) + group) | 0);
        const request = new Js5NetQueueRequest();
        request.secondaryKey = key;
        request.urgent = urgent;
        request.m_footerLength = (padding << 24) >> 24;
        if (!urgent) {
            if (this.GetPrefetchQueueSize(2) >= 20) throw new Error('JS5 prefetch queue is full');
            this.prefetch.addTail(request);
            return request;
        }
        if (this.GetUrgentQueueSize() >= 20) throw new Error('JS5 urgent queue is full');
        this.urgent.addTail(request);
        return request;
    }

    // ej.f(I)V
    breakConnection(): void {
        this.stream?.breakConnection?.();
    }

    // ej.c(B)V
    RecordCRCFailure(): void {
        try {
            this.stream?.Close();
        } catch (closing) {
            if (!(closing instanceof Error) || closing instanceof JavaError) throw closing;
        }
        this.xorKey = (((1 + mathRandom.nextDouble() * 255) | 0) << 24) >> 24;
        this.errors = (this.errors + 1) | 0;
        this.stream = null;
        this.response = -1;
    }

    // ej.b(Z)V
    close(): void | Promise<void> {
        return this.stream?.Close();
    }

    // ej.g(I)Z
    async Service(firstIteration = 0): Promise<boolean> {
        if (this.stream !== null) {
            const now = SafeTime.CurrentTimeMillis();
            let elapsed = Number(BigInt.asIntN(32, now - this.lastTick));
            if (elapsed > 200) elapsed = 200;
            this.lastTick = now;
            this.idleTime = (this.idleTime + elapsed) | 0;
            if (this.idleTime > 30000) {
                try {
                    this.stream.Close();
                } catch (closing) {
                    if (!(closing instanceof Error) || closing instanceof JavaError) throw closing;
                }
                this.stream = null;
            }
        }
        if (this.stream === null) return this.GetUrgentQueueSize() === 0 && this.GetPrefetchQueueSize(firstIteration ^ 2) === 0;
        try {
            this.stream.checkError?.();
            for (let request = this.urgent.head(); request !== null; request = this.urgent.next()) {
                this.outbound.m_pos = 0;
                this.outbound.p1(1);
                this.outbound.p3(Number(BigInt.asIntN(32, request.secondaryKey)));
                requireNonNull(this.stream).Write(0, this.outbound.m_data, 4);
                this.urgentSent.addTail(request);
            }
            for (let request = this.prefetch.head(); request !== null; request = this.prefetch.next()) {
                this.outbound.m_pos = 0;
                this.outbound.p1(0);
                this.outbound.p3(Number(BigInt.asIntN(32, request.secondaryKey)));
                requireNonNull(this.stream).Write(0, this.outbound.m_data, 4);
                this.prefetchSent.addTail(request);
            }
            for (let i = firstIteration; i < 100; i++) {
                const available = this.stream.GetAvailable(1);
                if (available < 0) throw new SocketIoError('JS5 stream closed');
                if (available === 0) break;
                this.idleTime = 0;
                const needed = this.current === null ? 8 : this.current.blockPosition === 0 ? 1 : 0;
                if (needed > 0) {
                    let length = (needed - requireNonNull(this.header).m_pos) | 0;
                    if (length > available) length = available;
                    const header = requireNonNull(this.header);
                    if (!this.stream.tryReadBuffered?.(header.m_data, header.m_pos, length)) await this.stream.Read(header.m_data, header.m_pos, length);
                    if (this.xorKey !== 0) {
                        for (let i = 0; i < length; i++) {
                            const pos = (header.m_pos + i) | 0;
                            putByte(header.m_data, pos, byteAt(header.m_data, pos) ^ this.xorKey);
                        }
                    }
                    requireNonNull(this.header).m_pos = (requireNonNull(this.header).m_pos + length) | 0;
                    if (requireNonNull(this.header).m_pos < needed) continue;
                    if (this.current === null) {
                        requireNonNull(this.header).m_pos = 0;
                        const archive = requireNonNull(this.header).g1();
                        const group = requireNonNull(this.header).g2();
                        const flags = requireNonNull(this.header).g1();
                        const size = requireNonNull(this.header).g4();
                        const compression = flags & 127;
                        const key = BigInt(((archive << 16) + group) | 0);
                        const sent = flags & 128 ? this.prefetchSent : this.urgentSent;
                        let request = sent.head();
                        while (request !== null && request.secondaryKey !== key) request = sent.next();
                        if (request === null) throw new SocketIoError('JS5 unknown response');
                        const headerSize = compression === 0 ? 5 : 9;
                        this.current = request;
                        request.packet = new PacketT((headerSize + size + request.m_footerLength) | 0);
                        request.packet.p1(compression);
                        request.packet.p4(size);
                        requireNonNull(this.header).m_pos = 0;
                        request.blockPosition = 8;
                        continue;
                    }
                    if (this.current.blockPosition !== 0) throw new SocketIoError('JS5 block position');
                    if (byteAt(requireNonNull(this.header).m_data, 0) !== 255) {
                        this.current = null;
                        continue;
                    }
                    this.current.blockPosition = 1;
                    requireNonNull(this.header).m_pos = 0;
                } else {
                    const request = requireNonNull(this.current);
                    const packet = requireNonNull(request.packet);
                    const end = (requireNonNull(packet.m_data).length - request.m_footerLength) | 0;
                    let length = (512 - request.blockPosition) | 0;
                    if (((end - packet.m_pos) | 0) < length) length = (end - packet.m_pos) | 0;
                    if (available < length) length = available;
                    if (!this.stream.tryReadBuffered?.(packet.m_data, packet.m_pos, length)) await this.stream.Read(packet.m_data, packet.m_pos, length);
                    if (this.xorKey !== 0) {
                        for (let i = 0; i < length; i++) {
                            const pos = (packet.m_pos + i) | 0;
                            putByte(packet.m_data, pos, byteAt(packet.m_data, pos) ^ this.xorKey);
                        }
                    }
                    request.blockPosition = (request.blockPosition + length) | 0;
                    packet.m_pos = (packet.m_pos + length) | 0;
                    if (packet.m_pos === end) {
                        request.unlinkSecondary();
                        request.incomplete = false;
                        this.current = null;
                        continue;
                    }
                    if (request.blockPosition === 512) request.blockPosition = 0;
                }
            }
            return true;
        } catch (error) {
            if (!(error instanceof SocketIoError)) throw error;
            try {
                requireNonNull(this.stream).Close();
            } catch (closing) {
                if (!(closing instanceof Error) || closing instanceof JavaError) throw closing;
            }
            this.response = -2;
            this.errors = (this.errors + 1) | 0;
            this.stream = null;
            return this.GetUrgentQueueSize() === 0 && this.GetPrefetchQueueSize(2) === 0;
        }
    }
}
