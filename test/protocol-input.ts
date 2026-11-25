import Client from '#/client/Client.js';
import Protocol from '#/io/Protocol.js';
import SuperPacket from '#/io/SuperPacket.js';
import { requireNonNull } from '#/util/JavaArray.js';

// Mirrors JAR oracles which install ek.s and enter rg.a with o.Y and af.I
// already decoded. A following byte keeps the zero-length packet readable.
export default class ProtocolInput {
    private readonly stream = Client.stream;
    private readonly state = {
        inPacket: Protocol.inPacket,
        packetType: Protocol.packetType,
        packetSize: Protocol.packetSize,
        lastPacketType0: Protocol.lastPacketType0,
        ptype1: Protocol.ptype1,
        ptype2: Protocol.ptype2,
        idleReads: Protocol.idleReads
    };

    async read(opcode: number, bytes: Uint8Array, packet = new SuperPacket(bytes.length)): Promise<boolean> {
        Client.stream = {
            GetAvailable: () => Math.max(1, bytes.length),
            async Read(destination, start, length) {
                requireNonNull(destination).set(bytes.subarray(0, length), start);
            },
            async read() {
                return -1;
            },
            Write() {},
            Close() {}
        };
        Protocol.packetType = opcode;
        Protocol.packetSize = bytes.length;
        Protocol.inPacket = packet;
        return Protocol.TcpIn();
    }

    restore(): void {
        Client.stream = this.stream;
        Object.assign(Protocol, this.state);
    }
}
