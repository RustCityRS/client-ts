import { JavaError } from '#/util/ClientError';
import { requireNonNull } from '#/util/JavaArray';
import JagString, { fromLiteral } from '#/datastruct/JagString';
import type Huffman from './Huffman';
import type PacketT from './PacketT';

export default class WordPack {
    // mf.e:Ldd;
    static codec: Huffman | null = null;
    // SD mk.C:Lid; and HD vl.f:Lna;
    static readonly cabbage = fromLiteral('Cabbage');

    // kc.a(Ldd;I)V
    static setCodec(codec: Huffman): void {
        this.codec = codec;
    }

    // gj.a(ILid;Lgd;)I
    static write(text: JagString | null, packet: PacketT): number {
        const start = packet.m_pos;
        const bytes = requireNonNull(text).toBytes();
        packet.pSmart1or2(bytes.length);
        packet.m_pos = (packet.m_pos + requireNonNull(this.codec).Encode(0, bytes.length, packet.m_data, packet.m_pos, bytes)) | 0;
        return (packet.m_pos - start) | 0;
    }

    // oa.a(IILgd;)Lid;
    static readLimited(max: number, offset: number, packet: PacketT): JagString {
        try {
            let length = packet.gSmart1or2();
            if (length > max) length = max;
            const bytes = new Uint8Array(length);
            packet.m_pos = (packet.m_pos + requireNonNull(this.codec).Decode(packet.m_data, bytes, packet.m_pos, length, 0)) | 0;
            return JagString.fromBytes(bytes, offset, length);
        } catch (error) {
            if (!(error instanceof Error) || error instanceof JavaError) throw error;
            return this.cabbage;
        }
    }

    // gk.a(Lgd;I)Lid;
    static read(packet: PacketT): JagString {
        return this.readLimited(32767, 0, packet);
    }
}
