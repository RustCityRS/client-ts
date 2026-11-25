import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import { JavaError } from '#/util/ClientError';
import RawInflater from './RawInflater';

import { byteAt } from '#/io/JavaByteArray';
import { requireNonNull } from '#/util/JavaArray';
import PacketT from '#/io/PacketT';
import BZip2Decompressor from './BZip2Decompressor';
import Js5 from './Js5';
import { loadInvType, loadMinimapBuilder, loadWorld } from '#/util/GamepackClasses';

function outputBytes(size: number, scratch?: Uint8Array): Uint8Array {
    if (scratch === undefined || size > scratch.length) return new Uint8Array(size);
    // A short GZIP member can legally return fewer bytes than the declared
    // length. Its unwritten tail must match a newly allocated Java byte[].
    return scratch.subarray(0, size).fill(0);
}

export default class Js5Compression {
    // HD ha.b(I)V
    static releaseHdStatics(guard: number): void {
        try {
            const MinimapBuilder = loadMinimapBuilder();
            releaseReferences(MinimapBuilder, 'minimapImage');
            if (guard < 54) {
                const world = loadWorld();
                world.clickX = -109;
            }
            const InvType = loadInvType();
            releaseReferences(InvType, 'm_recentUse');
            const world = loadWorld();
            releaseReferences(world, 'cornerVisibility');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ha.F(' + guard + ')');
        }
    }

    // bi.e:Ljava/util/zip/Inflater;
    private inflater: RawInflater | null = null;

    // bi.<init>()V delegates to the empty bi.<init>(III)V.
    constructor() {}

    // ec.a([BZ)[B
    static Decompress(src: Uint8Array | null, scratch?: Uint8Array): Uint8Array {
        const packet = new PacketT(src);
        const type = packet.g1();
        const packed = packet.g4();
        if (packed < 0 || (Js5.maxContainerSize !== 0 && packed > Js5.maxContainerSize)) throw new Error();
        if (type === 0) {
            const bytes = outputBytes(packed, scratch);
            packet.gArrayBuffer(packed, 0, bytes);
            return bytes;
        }
        const size = packet.g4();
        if (size < 0 || (Js5.maxContainerSize !== 0 && size > Js5.maxContainerSize)) throw new Error();
        const bytes = outputBytes(size, scratch);
        if (type !== 1) requireNonNull(Js5.gzipDecompressor).DecompressGZip(bytes, packet);
        else BZip2Decompressor.DecompressBZip2(bytes, size, requireNonNull(src), 9);
        return bytes;
    }

    // bi.a([BBLgd;)V
    DecompressGZip(dest: Uint8Array, source: PacketT): void {
        if (byteAt(source.m_data, source.m_pos) !== 31 || byteAt(source.m_data, source.m_pos + 1) !== 139) throw new Error('Invalid GZIP header!');
        if (this.inflater === null) {
            this.inflater = new RawInflater();
        }
        const stream = this.inflater;
        try {
            // Inflater(true) makes one bounded zlib call. A partial input may produce bytes without reaching the end marker.
            const offset = (source.m_pos + 10) | 0;
            const bytes = requireNonNull(source.m_data);
            const length = (bytes.length - 18 - source.m_pos) | 0;
            if (offset < 0 || length < 0 || offset + length > bytes.length) throw new RangeError();
            const result = stream.inflate(bytes, offset, length, dest);
            // Z_OK, Z_STREAM_END, Z_NEED_DICT and Z_BUF_ERROR return normally from java.util.zip.Inflater.inflate.
            if (result !== 0 && result !== 1 && result !== 2 && result !== -5) throw new Error();
        } catch (cause) {
            if (!(cause instanceof Error) || cause instanceof JavaError) throw cause;
            stream.reset();
            throw new Error('Invalid GZIP compressed data!');
        }
        stream.reset();
    }
}
