import { releaseReferences } from '#/util/StaticReferences';
import Linkable from '#/datastruct/Linkable';
import JagString from '#/datastruct/JagString';
import ByteArrayPool from './ByteArrayPool';
import Crc32 from './Crc32';
import { byteAt, putByte } from './JavaByteArray';
import { signedBigInteger, modPow, positiveBigIntegerBytes } from './JavaBigInteger';
import { requireNonNull } from '#/util/JavaArray';
import { isJavaRuntimeException } from '#/util/JavaException';
import WrappedException from '#/util/WrappedException';
import { glJar } from '#/client/ClientVariant';
import { loadClient, loadLocalisedText, loadObjType, loadSpriteLoader, loadWorldMap } from '#/util/GamepackClasses';

// A JS number can lose a NaN's payload when read from float storage. A caller
// with the original binary32 word can pass those bits through unchanged.
type JavaFloat = number | { readonly bits: number };
const floatBytes = new DataView(new ArrayBuffer(4));

function floatToRawIntBits(value: JavaFloat, rawWord: boolean): number {
    if (typeof value !== 'number') return value.bits | 0;
    // A float[] read through its signed word view already has the original JVM bits.
    if (rawWord) return value | 0;
    floatBytes.setFloat32(0, value);
    return floatBytes.getInt32(0);
}

// Java post-increment stores a signed int before the array access can throw.
function advance(packet: PacketT): number {
    const pos = packet.m_pos;
    packet.m_pos = (pos + 1) | 0;
    return pos;
}

// Revision 530 SD gamepack, gd extends jf.
export default class PacketT extends Linkable {
    // HD wa.j(I)V
    static releasePacketTStatics(guard: number): void {
        try {
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'frenchChateffect4');
            const SpriteLoader = loadSpriteLoader();
            releaseReferences(SpriteLoader, 'yOffsets');
            releaseReferences(LocalisedText, 'loadedInterfaces');
            const WorldMap = loadWorldMap();
            releaseReferences(WorldMap, 'current');
            releaseReferences(LocalisedText, 'frenchLoadedFonts');
            const ObjType = loadObjType();
            releaseReferences(ObjType, 'groundOps');
            releaseReferences(LocalisedText, 'englishLoadedInterfaces');
            const Client = loadClient();
            releaseReferences(Client, 'js5Providers');
            releaseReferences(LocalisedText, 'TAG_BREAK');
            if (guard !== 0) {
                releaseReferences(SpriteLoader, 'yOffsets');
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'wa.IC(' + guard + ')');
        }
    }

    // lh.a(ILid;)I
    static pjstrLength(value: JagString): number {
        return (1 + value.getLength()) | 0;
    }
    // gd.fb:[B
    m_data: Uint8Array | null;
    // gd.yb:I
    m_pos: number;

    // gd.<init>(I)V
    constructor(size: number);
    // gd.<init>([B)V
    constructor(bytes: Uint8Array | null);
    constructor(source: number | Uint8Array | null) {
        super();
        if (typeof source === 'number') {
            this.m_data = ByteArrayPool.allocate(source);
            this.m_pos = 0;
        } else {
            this.m_pos = 0;
            this.m_data = source;
        }
    }

    // SD gd.f(B)I, HD wa.p(B)I
    g1(guard?: number): number {
        try {
            return byteAt(this.m_data, advance(this));
        } catch (error) {
            if (guard === undefined || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, (glJar ? 'wa.RC(' : 'gd.AB(') + guard + ')');
        }
    }

    // SD gd.m(B)B, HD wa.d(Z)B.
    g1s(guard?: number | boolean): number {
        try {
            if (guard === true) return -13;
            return (byteAt(this.m_data, advance(this)) << 24) >> 24;
        } catch (error) {
            if (guard === undefined || !isJavaRuntimeException(error)) throw error;
            if (typeof guard === 'boolean') throw WrappedException.wrap(error, 'wa.TA(' + guard + ')');
            throw WrappedException.wrap(error, 'gd.CB(' + guard + ')');
        }
    }

    // SD gd.q(B)I, HD wa.g(B)I.
    g1_alt1(guard?: number): number {
        try {
            return (byteAt(this.m_data, advance(this)) - 128) & 255;
        } catch (error) {
            if (guard === undefined || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, (glJar ? 'wa.DC(' : 'gd.UA(') + guard + ')');
        }
    }

    // SD gd.e(B)I, HD wa.g(Z)I.
    g1_alt2(guard?: number | boolean): number {
        try {
            return -byteAt(this.m_data, advance(this)) & 255;
        } catch (error) {
            if (guard === undefined || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, (glJar ? 'wa.CB(' : 'gd.U(') + guard + ')');
        }
    }

    // SD gd.i(I)I; HD wa.c(Z)I.
    g1_alt3(guard?: number | boolean): number {
        try {
            return (128 - byteAt(this.m_data, advance(this))) & 255;
        } catch (error) {
            if (guard === undefined || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, (glJar ? 'wa.PB(' : 'gd.MB(') + guard + ')');
        }
    }

    // SD gd.e(I)B, HD wa.i(B)B.
    g1s_alt2(guard?: number): number {
        try {
            if (guard !== undefined) {
                if (glJar && guard < 98) return 95;
                if (!glJar && guard > -112) return -89;
            }
            return (-byteAt(this.m_data, advance(this)) << 24) >> 24;
        } catch (error) {
            if (guard === undefined || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, (glJar ? 'wa.BC(' : 'gd.OA(') + guard + ')');
        }
    }

    // SD gd.n(B)B, HD wa.b(Z)B.
    g1s_alt3(guard?: number | boolean): number {
        try {
            return ((128 - byteAt(this.m_data, advance(this))) << 24) >> 24;
        } catch (error) {
            if (guard === undefined || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, (glJar ? 'wa.JB(' : 'gd.R(') + guard + ')');
        }
    }

    // SD gd.t(B)B, HD wa.n(I)B.
    g1s_alt1(guard?: number): number {
        try {
            return ((byteAt(this.m_data, advance(this)) - 128) << 24) >> 24;
        } catch (error) {
            if (guard === undefined || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, (glJar ? 'wa.CA(' : 'gd.KA(') + guard + ')');
        }
    }

    // gd.c(I)I
    g2(guard?: number): number {
        try {
            this.m_pos = (this.m_pos + 2) | 0;
            return (byteAt(this.m_data, this.m_pos - 2) << 8) + byteAt(this.m_data, this.m_pos - 1);
        } catch (error) {
            if (guard === undefined || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, (glJar ? 'wa.EB(' : 'gd.WB(') + guard + ')');
        }
    }

    // SD gd.d(B)I, HD wa.g(I)I.
    g2_alt2(guard?: number): number {
        try {
            this.m_pos = (this.m_pos + 2) | 0;
            if (glJar) return ((byteAt(this.m_data, this.m_pos - 1) - 128) & 255) + (byteAt(this.m_data, this.m_pos - 2) << 8);
            return (byteAt(this.m_data, this.m_pos - 2) << 8) + ((byteAt(this.m_data, this.m_pos - 1) - 128) & 255);
        } catch (error) {
            if (guard === undefined || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, (glJar ? 'wa.LC(' : 'gd.TB(') + guard + ')');
        }
    }

    // SD gd.g(B)I, HD wa.i(I)I.
    g2_alt1(guard?: number): number {
        try {
            this.m_pos = (this.m_pos + 2) | 0;
            return byteAt(this.m_data, this.m_pos - 2) + (byteAt(this.m_data, this.m_pos - 1) << 8);
        } catch (error) {
            if (guard === undefined || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, (glJar ? 'wa.BB(' : 'gd.PB(') + guard + ')');
        }
    }

    // SD gd.r(B)I, HD wa.k(B)I.
    g2_alt3(guard?: number): number {
        try {
            this.m_pos = (this.m_pos + 2) | 0;
            return (byteAt(this.m_data, this.m_pos - 1) << 8) + ((byteAt(this.m_data, this.m_pos - 2) - 128) & 255);
        } catch (error) {
            if (guard === undefined || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, (glJar ? 'wa.TB(' : 'gd.MA(') + guard + ')');
        }
    }

    // SD gd.p(B)I; HD wa.l(B)I loads the low byte first.
    g2s(guard?: number): number {
        try {
            this.m_pos = (this.m_pos + 2) | 0;
            let value = glJar ? byteAt(this.m_data, this.m_pos - 1) + (byteAt(this.m_data, this.m_pos - 2) << 8) : (byteAt(this.m_data, this.m_pos - 2) << 8) + byteAt(this.m_data, this.m_pos - 1);
            if (value > 32767) value -= 65536;
            return value;
        } catch (error) {
            if (guard === undefined || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, (glJar ? 'wa.TC(' : 'gd.W(') + guard + ')');
        }
    }

    // gd.i(B)I
    g2s_alt2(): number {
        this.m_pos = (this.m_pos + 2) | 0;
        let value = (byteAt(this.m_data, this.m_pos - 2) << 8) + ((byteAt(this.m_data, this.m_pos - 1) - 128) & 255);
        if (value > 32767) value -= 65536;
        return value;
    }

    // gd.c(B)I
    g2s_alt1(): number {
        this.m_pos = (this.m_pos + 2) | 0;
        let value = byteAt(this.m_data, this.m_pos - 2) + (byteAt(this.m_data, this.m_pos - 1) << 8);
        if (value > 32767) value -= 65536;
        return value;
    }

    // SD gd.j(B)I, HD wa.m(I)I.
    ig2bAdd(guard?: number): number {
        try {
            this.m_pos = (this.m_pos + 2) | 0;
            let value = glJar ? (byteAt(this.m_data, this.m_pos - 1) << 8) + ((byteAt(this.m_data, this.m_pos - 2) - 128) & 255) : ((byteAt(this.m_data, this.m_pos - 2) - 128) & 255) + (byteAt(this.m_data, this.m_pos - 1) << 8);
            if (value > 32767) value -= 65536;
            return value;
        } catch (error) {
            if (guard === undefined || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, (glJar ? 'wa.EC(' : 'gd.FB(') + guard + ')');
        }
    }

    // SD gd.j(I)I loads the middle byte first. HD wa.n(B)I loads the high byte first.
    g3(): number {
        this.m_pos = (this.m_pos + 3) | 0;
        if (glJar) {
            return (byteAt(this.m_data, this.m_pos - 3) << 16) + ((byteAt(this.m_data, this.m_pos - 2) << 8) + byteAt(this.m_data, this.m_pos - 1));
        }
        return (byteAt(this.m_data, this.m_pos - 2) << 8) + (byteAt(this.m_data, this.m_pos - 3) << 16) + byteAt(this.m_data, this.m_pos - 1);
    }

    // SD gd.h(I)I; HD wa.h(B)I reads the middle byte first.
    ig3(): number {
        this.m_pos = (this.m_pos + 3) | 0;
        if (glJar) return (byteAt(this.m_data, this.m_pos - 2) << 8) + (byteAt(this.m_data, this.m_pos - 1) << 16) + byteAt(this.m_data, this.m_pos - 3);
        return byteAt(this.m_data, this.m_pos - 3) + (byteAt(this.m_data, this.m_pos - 2) << 8) + (byteAt(this.m_data, this.m_pos - 1) << 16);
    }

    // SD gd.h(B)I reads byte 2 first. HD wa.e(I)I reads bytes 0 through 3 in order.
    g4(guard?: number): number {
        try {
            this.m_pos = (this.m_pos + 4) | 0;
            if (glJar) {
                return ((byteAt(this.m_data, this.m_pos - 4) << 24) + ((byteAt(this.m_data, this.m_pos - 3) << 16) + ((byteAt(this.m_data, this.m_pos - 2) << 8) + byteAt(this.m_data, this.m_pos - 1)))) | 0;
            }
            return ((byteAt(this.m_data, this.m_pos - 2) << 8) + (byteAt(this.m_data, this.m_pos - 4) << 24) + (byteAt(this.m_data, this.m_pos - 3) << 16) + byteAt(this.m_data, this.m_pos - 1)) | 0;
        } catch (error) {
            if (guard === undefined || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, (glJar ? 'wa.KA(' : 'gd.NA(') + guard + ')');
        }
    }

    // SD gd.b(I)I takes the cursor advance. HD wa.l(I)I takes a guard and advances by four.
    g4_alt1(argument = glJar ? -105 : 4): number {
        if (glJar) {
            try {
                this.m_pos = (this.m_pos + 4) | 0;
                if (argument >= -42) this.g1s_alt2(-14);
                return (byteAt(this.m_data, this.m_pos - 4) + (byteAt(this.m_data, this.m_pos - 2) << 16) + ((byteAt(this.m_data, this.m_pos - 1) << 24) + (byteAt(this.m_data, this.m_pos - 3) << 8))) | 0;
            } catch (error) {
                if (!isJavaRuntimeException(error)) throw error;
                throw WrappedException.wrap(error, 'wa.EA(' + argument + ')');
            }
        }
        this.m_pos = (this.m_pos + argument) | 0;
        return (byteAt(this.m_data, this.m_pos - 4) + (byteAt(this.m_data, this.m_pos - 1) << 24) + (byteAt(this.m_data, this.m_pos - 2) << 16) + (byteAt(this.m_data, this.m_pos - 3) << 8)) | 0;
    }

    // SD gd.s(B)I; HD wa.k(I)I.
    g4_alt2(): number {
        this.m_pos = (this.m_pos + 4) | 0;
        if (glJar) return ((byteAt(this.m_data, this.m_pos - 2) << 24) + ((byteAt(this.m_data, this.m_pos - 1) << 16) + (byteAt(this.m_data, this.m_pos - 4) << 8)) + byteAt(this.m_data, this.m_pos - 3)) | 0;
        return ((byteAt(this.m_data, this.m_pos - 4) << 8) + (byteAt(this.m_data, this.m_pos - 1) << 16) + (byteAt(this.m_data, this.m_pos - 2) << 24) + byteAt(this.m_data, this.m_pos - 3)) | 0;
    }

    // SD gd.l(B)I; HD wa.o(B)I.
    g4_alt3(): number {
        this.m_pos = (this.m_pos + 4) | 0;
        if (glJar) return ((byteAt(this.m_data, this.m_pos - 3) << 24) + (byteAt(this.m_data, this.m_pos - 4) << 16) + ((byteAt(this.m_data, this.m_pos - 1) << 8) + byteAt(this.m_data, this.m_pos - 2))) | 0;
        return ((byteAt(this.m_data, this.m_pos - 1) << 8) + (byteAt(this.m_data, this.m_pos - 3) << 24) + (byteAt(this.m_data, this.m_pos - 4) << 16) + byteAt(this.m_data, this.m_pos - 2)) | 0;
    }

    // gd.b(BI)V
    p1(value: number): void {
        putByte(this.m_data, advance(this), value);
    }

    // gd.d(II)V
    p1_alt1(value: number): void {
        putByte(this.m_data, advance(this), value + 128);
    }

    // gd.a(IB)V
    p1_alt3(value: number): void {
        putByte(this.m_data, advance(this), 128 - value);
    }

    // SD gd.i(II)V / HD wa.o(II)V.
    p2(value: number): void {
        try {
            putByte(this.m_data, advance(this), value >> 8);
            putByte(this.m_data, advance(this), value);
        } catch (error) {
            if (!glJar || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'wa.JC(-20037,' + value + ')');
        }
    }

    // gd.g(II)V
    p2_alt1(value: number): void {
        putByte(this.m_data, advance(this), value);
        putByte(this.m_data, advance(this), value >> 8);
    }

    // gd.f(II)V
    p2_alt2(value: number): void {
        putByte(this.m_data, advance(this), value >> 8);
        putByte(this.m_data, advance(this), value + 128);
    }

    // SD gd.f(BI)V / HD wa.a(IB)V, with the gamepack's byte guard 3.
    p2_alt3(value: number): void {
        try {
            putByte(this.m_data, advance(this), value + 128);
            putByte(this.m_data, advance(this), value >> 8);
        } catch (error) {
            if (!glJar || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'wa.MA(' + value + ',3)');
        }
    }

    // gd.c(II)V
    p3(value: number): void {
        putByte(this.m_data, advance(this), value >> 16);
        putByte(this.m_data, advance(this), value >> 8);
        putByte(this.m_data, advance(this), value);
    }

    // gd.h(II)V
    p4(value: number): void {
        const bytes = this.m_data;
        const pos = this.m_pos;
        // All four Java stores can complete. On a short array or signed cursor overflow
        // the individual advances below preserve the partial bytes and exact fault index.
        if (bytes !== null && pos >= 0 && pos <= bytes.length - 4 && pos <= 0x7ffffffc) {
            bytes[pos] = value >> 24;
            bytes[pos + 1] = value >> 16;
            bytes[pos + 2] = value >> 8;
            bytes[pos + 3] = value;
            this.m_pos = (pos + 4) | 0;
            return;
        }
        putByte(this.m_data, advance(this), value >> 24);
        putByte(this.m_data, advance(this), value >> 16);
        putByte(this.m_data, advance(this), value >> 8);
        putByte(this.m_data, advance(this), value);
    }

    // SD gd.e(BI)V, HD wa.b(IB)V (the little-endian protocol writer).
    p4_alt1(value: number): void {
        putByte(this.m_data, advance(this), value);
        putByte(this.m_data, advance(this), value >> 8);
        putByte(this.m_data, advance(this), value >> 16);
        putByte(this.m_data, advance(this), value >> 24);
    }

    // SD gd.b(II)V, HD wa.j(II)V.
    p4_alt2(value: number): void {
        putByte(this.m_data, advance(this), value >> 8);
        putByte(this.m_data, advance(this), value);
        putByte(this.m_data, advance(this), value >> 24);
        putByte(this.m_data, advance(this), value >> 16);
    }

    // HD wa.e(II)V. Geometry callers select this writer on little-endian hosts.
    p4PlatformEndian(value: number): void {
        const bytes = this.m_data;
        const pos = this.m_pos;
        if (bytes !== null && pos >= 0 && pos <= bytes.length - 4 && pos <= 0x7ffffffc) {
            bytes[pos] = value;
            bytes[pos + 1] = value >> 8;
            bytes[pos + 2] = value >> 16;
            bytes[pos + 3] = value >> 24;
            this.m_pos = (pos + 4) | 0;
            return;
        }
        putByte(this.m_data, advance(this), value);
        putByte(this.m_data, advance(this), value >> 8);
        putByte(this.m_data, advance(this), value >> 16);
        putByte(this.m_data, advance(this), value >> 24);
    }

    // HD wa.a(IF)V.
    pFloat(value: JavaFloat, rawWord = false): void {
        const bits = floatToRawIntBits(value, rawWord);
        putByte(this.m_data, advance(this), bits >> 24);
        putByte(this.m_data, advance(this), bits >> 16);
        putByte(this.m_data, advance(this), bits >> 8);
        putByte(this.m_data, advance(this), bits);
    }

    // HD wa.a(FB)V.
    pFloatPlatformEndian(value: JavaFloat, rawWord = false): void {
        const bits = floatToRawIntBits(value, rawWord);
        putByte(this.m_data, advance(this), bits);
        putByte(this.m_data, advance(this), bits >> 8);
        putByte(this.m_data, advance(this), bits >> 16);
        putByte(this.m_data, advance(this), bits >> 24);
    }

    // gd.a(II)V
    p4_alt3(value: number): void {
        putByte(this.m_data, advance(this), value >> 16);
        putByte(this.m_data, advance(this), value >> 24);
        putByte(this.m_data, advance(this), value);
        putByte(this.m_data, advance(this), value >> 8);
    }

    // gd.a(I)J
    g8(): bigint {
        const high = BigInt(this.g4()) & 0xffffffffn;
        const low = BigInt(this.g4()) & 0xffffffffn;
        return BigInt.asIntN(64, low + (high << 32n));
    }

    // gd.a(IJ)V
    p8(value: bigint): void {
        putByte(this.m_data, advance(this), Number(BigInt.asUintN(8, value >> 56n)));
        putByte(this.m_data, advance(this), Number(BigInt.asUintN(8, value >> 48n)));
        putByte(this.m_data, advance(this), Number(BigInt.asUintN(8, value >> 40n)));
        putByte(this.m_data, advance(this), Number(BigInt.asUintN(8, value >> 32n)));
        putByte(this.m_data, advance(this), Number(BigInt.asUintN(8, value >> 24n)));
        putByte(this.m_data, advance(this), Number(BigInt.asUintN(8, value >> 16n)));
        putByte(this.m_data, advance(this), Number(BigInt.asUintN(8, value >> 8n)));
        putByte(this.m_data, advance(this), Number(BigInt.asUintN(8, value)));
    }

    // gd.d(BI)J
    gX(size: number): bigint {
        size--;
        if (size < 0 || size > 7) throw new RangeError('Invalid long width');
        let shift = size * 8;
        let value = 0n;
        while (shift >= 0) {
            value |= BigInt(byteAt(this.m_data, advance(this))) << BigInt(shift);
            shift -= 8;
        }
        return BigInt.asIntN(64, value);
    }

    // gd.a(IJI)V
    pX(size: number, value: bigint): void {
        size--;
        if (size < 0 || size > 7) throw new RangeError('Invalid long width');
        let shift = 8 * size;
        while (shift >= 0) {
            putByte(this.m_data, advance(this), Number(BigInt.asUintN(8, value >> BigInt(shift))));
            shift -= 8;
        }
    }

    // gd.g(I)I
    gSmart1or2(): number {
        const value = byteAt(this.m_data, this.m_pos);
        return value < 128 ? this.g1() : this.g2() - 32768;
    }

    // gd.d(I)I
    gSmart1or2s(): number {
        const value = byteAt(this.m_data, this.m_pos);
        return value >= 128 ? this.g2() - 49152 : this.g1() - 64;
    }

    // gd.o(B)I
    gSmartsExtend(): number {
        let value = this.gSmart1or2();
        let total = 0;
        while (value === 32767) {
            total = (total + 32767) | 0;
            value = this.gSmart1or2();
        }
        return (total + value) | 0;
    }

    // gd.c(BI)V
    pSmart1or2(value: number): void {
        if (value >= 0 && value < 128) {
            this.p1(value);
        } else if (value >= 0 && value < 32768) {
            this.p2(value + 32768);
        } else {
            throw new RangeError('Invalid smart value');
        }
    }

    // gd.k(B)I
    gMidiVarLen(): number {
        let next = (byteAt(this.m_data, advance(this)) << 24) >> 24;
        let value = 0;
        while (next < 0) {
            value = ((next & 127) | value) << 7;
            next = (byteAt(this.m_data, advance(this)) << 24) >> 24;
        }
        return value | next;
    }

    // gd.a(BI)V
    pMidiVarLen(value: number): void {
        if ((value & -128) !== 0) {
            if ((value & -16384) !== 0) {
                if ((value & -2097152) !== 0) {
                    if ((value & -268435456) !== 0) this.p1(128 | (value >>> 28));
                    this.p1((value >>> 21) | 128);
                }
                this.p1((value >>> 14) | 128);
            }
            this.p1((value >>> 7) | 128);
        }
        this.p1(127 & value);
    }

    // gd.a(I[BII)V
    pArrayBuffer(src: Uint8Array | null, length: number, offset: number): void {
        for (let i = offset; i < ((offset + length) | 0); i++) {
            putByte(this.m_data, advance(this), byteAt(src, i));
        }
    }

    // gd.a(III[B)V
    gArrayBuffer(length: number, offset: number, dest: Uint8Array | null): void {
        for (let i = offset; i < ((offset + length) | 0); i++) {
            putByte(dest, i, byteAt(this.m_data, advance(this)));
        }
    }

    // gd.a(II[BB)V
    gdataReverse(length: number, offset: number, dest: Uint8Array | null): void {
        for (let i = (offset + length - 1) | 0; i >= offset; i--) {
            putByte(dest, i, byteAt(this.m_data, advance(this)));
        }
    }

    // gd.j(II)V
    pSize1(size: number): void {
        putByte(this.m_data, (this.m_pos - size - 1) | 0, size);
    }

    // gd.e(II)V
    pSize4(size: number): void {
        putByte(this.m_data, (this.m_pos - size - 4) | 0, size >> 24);
        putByte(this.m_data, (this.m_pos - size - 3) | 0, size >> 16);
        putByte(this.m_data, (this.m_pos - size - 2) | 0, size >> 8);
        putByte(this.m_data, (this.m_pos - size - 1) | 0, size);
    }

    // gd.l(I)Lid;
    gStringNoConversion(): JagString {
        const start = this.m_pos;
        while (byteAt(this.m_data, advance(this)) !== 0) {
            // The condition advances the packet cursor through the terminating zero.
        }
        return JagString.fromBytes(this.m_data, start, (this.m_pos - start - 1) | 0, 0);
    }

    // gd.k(I)Lid;
    readNullableJagString(): JagString | null {
        if (byteAt(this.m_data, this.m_pos) === 0) {
            this.m_pos = (this.m_pos + 1) | 0;
            return null;
        } else {
            return this.gStringNoConversion();
        }
    }

    // gd.b(Z)Lid;
    readVersionedJagString(): JagString {
        const version = byteAt(this.m_data, advance(this));
        if (version !== 0) throw new Error('Bad version number in gjstr2');
        const start = this.m_pos;
        while (byteAt(this.m_data, advance(this)) !== 0) {
            // The condition advances the packet cursor through the terminating zero.
        }
        return JagString.fromBytes(this.m_data, start, (this.m_pos - start - 1) | 0, 0);
    }

    // SD gd.a(Lid;B)V uses the argument as the terminator.
    // HD wa.a(ILna;)V uses it as the source offset and appends a zero.
    pStringNoConversion(value: JagString, argument: number): void {
        this.m_pos = (this.m_pos + value.copyTo(this.m_pos, value.getLength(), glJar ? argument : 0, this.m_data)) | 0;
        putByte(this.m_data, advance(this), glJar ? 0 : argument);
    }

    // gd.g(BI)I
    addCrc(start: number): number {
        const crc = Crc32.compute(start, this.m_data, this.m_pos);
        this.p4(crc);
        return crc;
    }

    // gd.a(Ljava/math/BigInteger;BLjava/math/BigInteger;)V
    rsaEncrypt(exponent: bigint | null, modulus: bigint | null): void {
        const size = this.m_pos;
        const plain = new Uint8Array(size);
        this.m_pos = 0;
        this.gArrayBuffer(size, 0, plain);
        const message = signedBigInteger(plain);
        const cipher = modPow(message, requireNonNull(exponent), requireNonNull(modulus));
        const bytes = positiveBigIntegerBytes(cipher);
        this.m_pos = 0;
        this.p1(bytes.length);
        this.pArrayBuffer(bytes, bytes.length, 0);
    }

    // gd.a(I[III)V
    tinyKeyDecrypt(key: Int32Array, start: number, end: number): void {
        const saved = this.m_pos;
        this.m_pos = start;
        const blocks = (((end - start) | 0) / 8) | 0;
        for (let block = 0; block < blocks; block++) {
            let left = this.g4();
            let right = this.g4();
            let sum = -957401312;
            const delta = -1640531527;
            let rounds = 32;
            while (rounds-- > 0) {
                const index = (sum >>> 11) & 3;
                if (index >= key.length) throw new RangeError('XTEA key index ' + index);
                right = (right - ((key[index] + sum) ^ (((left << 4) ^ (left >>> 5)) + left))) | 0;
                sum = (sum - delta) | 0;
                if ((sum & 3) >= key.length) throw new RangeError('XTEA key index ' + (sum & 3));
                left = (left - ((sum + key[sum & 3]) ^ (right + ((right >>> 5) ^ (right << 4))))) | 0;
            }
            this.m_pos -= 8;
            this.p4(left);
            this.p4(right);
        }
        this.m_pos = saved;
    }
}
