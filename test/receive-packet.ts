import Client from '#/client/Client.js';
import Protocol from '#/io/Protocol.js';
import SuperPacket from '#/io/SuperPacket.js';
import { requireNonNull } from '#/util/JavaArray.js';

// rg.a begins with a pending header. An extra available byte represents the following packet.
export function supplyPacket(op: number, body: Uint8Array, buffer: SuperPacket): void {
    Client.stream = {
        GetAvailable: () => body.length + 1,
        Read: async (dst, offset, length) => {
            requireNonNull(dst).set(body.subarray(0, length), offset);
        },
        Write() {},
        Close() {},
        async read() {
            return -1;
        }
    };
    Protocol.inPacket = buffer;
    Protocol.packetType = op;
    Protocol.packetSize = body.length;
}

export async function receivePacket(op: number, body: Uint8Array, buffer = new SuperPacket(body.length)): Promise<boolean> {
    const stream = Client.stream,
        saved = { inPacket: Protocol.inPacket, packetType: Protocol.packetType, packetSize: Protocol.packetSize, idleReads: Protocol.idleReads, ptype1: Protocol.ptype1, ptype2: Protocol.ptype2, lastPacketType0: Protocol.lastPacketType0 };
    try {
        supplyPacket(op, body, buffer);
        return await Protocol.TcpIn();
    } finally {
        Client.stream = stream;
        Object.assign(Protocol, saved);
    }
}
