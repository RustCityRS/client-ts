import { releaseReferences } from '#/util/StaticReferences';
import { requireNonNull } from '#/util/JavaArray';
import { glJar } from '#/client/ClientVariant';
import { isJavaRuntimeException } from '#/util/JavaException';
import WrappedException from '#/util/WrappedException';
import Isaac from './Isaac';
import { byteAt, putByte } from './JavaByteArray';
import PacketT from './PacketT';
import { loadClient, loadClientPlayer, loadProceduralTexture, loadTitleFlames } from '#/util/GamepackClasses';

// Revision 530 SD gamepack, be extends gd.
export default class SuperPacket extends PacketT {
    // HD i.q(I)V
    static releaseSuperPacketStatics(guard: number): void {
        try {
            const Client = loadClient();
            releaseReferences(Client, 'mapFilePrefix');
            if (guard !== 1) {
                const ProceduralTexture = loadProceduralTexture();
                releaseReferences(ProceduralTexture, 'gammaTable');
            }
            const TitleFlames = loadTitleFlames();
            releaseReferences(TitleFlames, 'blurBuffer');
            const ProceduralTexture = loadProceduralTexture();
            releaseReferences(ProceduralTexture, 'gammaTable');
            const ClientPlayer = loadClientPlayer();
            releaseReferences(ClientPlayer, 'titlePrefixes');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'i.V(' + guard + ')');
        }
    }

    // je.bb:[I
    static readonly bitMasks = Int32Array.of(
        0,
        1,
        3,
        7,
        15,
        31,
        63,
        127,
        255,
        511,
        1023,
        2047,
        4095,
        8191,
        16383,
        32767,
        65535,
        131071,
        262143,
        524287,
        1048575,
        2097151,
        4194303,
        8388607,
        16777215,
        33554431,
        67108863,
        134217727,
        268435455,
        536870911,
        1073741823,
        2147483647,
        -1
    );
    private bitPos = 0; // be.Db:I
    private m_pIsaac: Isaac | null = null; // be.Jb:Lij;

    // be.<init>(I)V
    constructor(size: number) {
        super(size);
    }

    // be.h(BI)I
    gBit(count: number): number {
        let index = this.bitPos >> 3;
        let available = 8 - (this.bitPos & 7);
        this.bitPos = (this.bitPos + count) | 0;
        let value = 0;
        while (count > available) {
            value = (value + ((byteAt(this.m_data, index++) & SuperPacket.bitMasks[available]) << (count - available))) | 0;
            count -= available;
            available = 8;
        }

        const byte = (byteAt(this.m_data, index) << 24) >> 24;
        if (available !== count) {
            if (count < 0) throw new RangeError('bit mask index ' + count);
            return (value + ((byte >> (available - count)) & SuperPacket.bitMasks[count])) | 0;
        }
        return (value + (byte & SuperPacket.bitMasks[available])) | 0;
    }

    // be.m(I)V
    GBitStart(): void {
        this.bitPos = this.m_pos << 3;
    }

    // be.n(I)I
    g1Enc(): number {
        const pos = this.m_pos;
        this.m_pos = (pos + 1) | 0;
        return (byteAt(this.m_data, pos) - requireNonNull(this.m_pIsaac).TakeNextValue()) & 255;
    }

    // be.a([BIII)V
    gArrayBufferEncrypted(dest: Uint8Array, offset: number, length: number): void {
        for (let i = 0; i < length; i++) {
            const pos = this.m_pos;
            this.m_pos = (pos + 1) | 0;
            putByte(dest, (offset + i) | 0, byteAt(this.m_data, pos) - requireNonNull(this.m_pIsaac).TakeNextValue());
        }
    }

    // be.a([II)V
    SetEnc(seed: Int32Array): void {
        this.m_pIsaac = new Isaac(seed);
    }

    // be.o(I)V
    GBitEnd(): void {
        this.m_pos = (((this.bitPos + 7) | 0) / 8) | 0;
    }

    // SD be.k(II)V / HD i.r(II)V, with the gamepack's guard 0.
    pHead(opcode: number): void {
        try {
            const pos = this.m_pos;
            this.m_pos = (pos + 1) | 0;
            putByte(this.m_data, pos, requireNonNull(this.m_pIsaac).TakeNextValue() + opcode);
        } catch (error) {
            if (!glJar || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'i.B(0,' + opcode + ')');
        }
    }

    // be.l(II)I
    BitsLeft(length: number): number {
        return ((length << 3) - this.bitPos) | 0;
    }
}
