import SuperPacket from '#/io/SuperPacket.js';
import { receivePacket } from './receive-packet.js';

// These Java fixtures enter rg.a with o.Y and af.I set and inspect hd.b after it returns.
export async function readPacketBody(opcode: number, bytes: Uint8Array, packet = new SuperPacket(5000)): Promise<SuperPacket> {
    if (!(await receivePacket(opcode, bytes, packet))) throw new Error('packet body not consumed');
    return packet;
}
