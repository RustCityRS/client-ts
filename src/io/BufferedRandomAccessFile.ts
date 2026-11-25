import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import { requireNonNull } from '#/util/JavaArray';
import ArrayUtils from '#/util/ArrayUtils';
import File, { EndOfFile, FileIoError } from './File';
import { putByte } from './JavaByteArray';
import { loadClient, loadNpcType, loadProtocol } from '#/util/GamepackClasses';

const long = (value: bigint) => BigInt.asIntN(64, value);
const int = (value: bigint) => Number(BigInt.asIntN(32, value)) | 0;

// sa
export default class BufferedRandomAccessFile {
    // HD en.a(Z)V
    static releaseHdStatics(guard: boolean): void {
        try {
            const Client = loadClient();
            releaseReferences(Client, 'urlProtocol');
            if (!guard) {
                return;
            }
            const NpcType = loadNpcType();
            releaseReferences(NpcType, 'layerNextFrames');
            const Protocol = loadProtocol();
            releaseReferences(Protocol, 'chalReqTag');
            releaseReferences(Client, 'fpsOffCommand');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'en.G(' + guard + ')');
        }
    }

    private filePosition = 0n; // sa.a:J
    private fileLength: bigint; // sa.c:J
    private readPosition = -1n; // sa.d:J
    private readonly readBuffer: Uint8Array; // sa.f:[B
    private readonly file: File; // sa.i:Lne;
    private logicalLength: bigint; // sa.j:J
    private writePosition = -1n; // sa.k:J
    private writeLength = 0; // sa.l:I
    private readonly writeBuffer: Uint8Array; // sa.n:[B
    private readLength = 0; // sa.r:I
    private position = 0n; // sa.y:J

    // sa.<init>(Lne;II)V
    constructor(file: File, readCapacity: number, writeCapacity: number) {
        this.file = file;
        this.logicalLength = this.fileLength = file.length();
        this.writeBuffer = new Uint8Array(writeCapacity);
        this.readBuffer = new Uint8Array(readCapacity);
    }

    // sa.a(B)V
    private fill(): void {
        this.readLength = 0;
        if (this.filePosition !== this.position) {
            this.file.seek(this.position);
            this.filePosition = this.position;
        }
        this.readPosition = this.position;
        while (this.readLength < this.readBuffer.length) {
            let length = (this.readBuffer.length - this.readLength) | 0;
            if (length > 200000000) length = 200000000;
            const count = this.file.read(length, this.readBuffer, this.readLength);
            if (count === -1) break;
            this.readLength = (this.readLength + count) | 0;
            this.filePosition = long(this.filePosition + BigInt(count));
        }
    }

    // sa.a(I[B)V
    readFully(data: Uint8Array): void {
        this.Read(data.length, data, 0);
    }

    // sa.a(I[BBI)V
    Read(length: number, data: Uint8Array | null, offset: number): void {
        try {
            data = requireNonNull(data);
            if (data.length < ((length + offset) | 0)) throw new RangeError('Read exceeds byte array');
            if (this.writePosition !== -1n && this.position >= this.writePosition && long(this.writePosition + BigInt(this.writeLength)) >= long(this.position + BigInt(length))) {
                ArrayUtils.copyBytes(this.writeBuffer, int(this.position - this.writePosition), data, offset, length);
                this.position = long(this.position + BigInt(length));
                return;
            }
            const initialOffset = offset;
            const start = this.position;
            const requested = length;
            if (this.readPosition <= this.position && this.position < long(this.readPosition + BigInt(this.readLength))) {
                let count = int(BigInt(this.readLength) + this.readPosition - this.position);
                if (count > length) count = length;
                ArrayUtils.copyBytes(this.readBuffer, int(this.position - this.readPosition), data, offset, count);
                length = (length - count) | 0;
                this.position = long(this.position + BigInt(count));
                offset = (offset + count) | 0;
            }
            if (this.readBuffer.length >= length) {
                if (length > 0) {
                    this.fill();
                    let count = length;
                    if (length > this.readLength) count = this.readLength;
                    ArrayUtils.copyBytes(this.readBuffer, 0, data, offset, count);
                    offset = (offset + count) | 0;
                    this.position = long(this.position + BigInt(count));
                    length = (length - count) | 0;
                }
            } else {
                this.file.seek(this.position);
                this.filePosition = this.position;
                while (length > 0) {
                    const count = this.file.read(length, data, offset);
                    if (count === -1) break;
                    this.filePosition = long(this.filePosition + BigInt(count));
                    length = (length - count) | 0;
                    this.position = long(this.position + BigInt(count));
                    offset = (offset + count) | 0;
                }
            }
            if (this.writePosition !== -1n) {
                if (this.writePosition > this.position && length > 0) {
                    let until = (offset + int(this.writePosition - this.position)) | 0;
                    if (until > ((offset + length) | 0)) until = (length + offset) | 0;
                    while (offset < until) {
                        length = (length - 1) | 0;
                        putByte(data, offset++, 0);
                        this.position = long(this.position + 1n);
                    }
                }
                const writeEnd = long(this.writePosition + BigInt(this.writeLength));
                const end = long(start + BigInt(requested));
                let overlapEnd = -1n;
                if (start < writeEnd && writeEnd <= end) overlapEnd = writeEnd;
                else if (end > this.writePosition && end <= writeEnd) overlapEnd = end;
                let overlapStart = -1n;
                if (this.writePosition >= start && this.writePosition < end) overlapStart = this.writePosition;
                else if (start >= this.writePosition && start < writeEnd) overlapStart = start;
                if (overlapStart > -1n && overlapEnd > overlapStart) {
                    const count = int(overlapEnd - overlapStart);
                    ArrayUtils.copyBytes(this.writeBuffer, int(overlapStart - this.writePosition), data, (int(overlapStart - start) + initialOffset) | 0, count);
                    if (this.position < overlapEnd) {
                        length = int(BigInt(length) - (overlapEnd - this.position));
                        this.position = overlapEnd;
                    }
                }
            }
        } catch (error) {
            if (error instanceof FileIoError) this.filePosition = -1n;
            throw error;
        }
        if (length > 0) throw new EndOfFile();
    }

    // sa.a(JI)V
    seek(position: bigint): void {
        if (position < 0n) throw new FileIoError('Invalid seek to ' + position + ' in file ' + this.getFile());
        this.position = position;
    }

    // sa.a(I)J
    GetSize(): bigint {
        return this.logicalLength;
    }

    // sa.a(BI[BI)V
    Write(offset: number, data: Uint8Array | null, length: number): void {
        try {
            if (long(this.position + BigInt(length)) > this.logicalLength) this.logicalLength = long(this.position + BigInt(length));
            if (this.writePosition !== -1n && (this.position < this.writePosition || this.position > long(this.writePosition + BigInt(this.writeLength)))) this.FlushToDisk();
            if (this.writePosition !== -1n && long(this.writePosition + BigInt(this.writeBuffer.length)) < long(this.position + BigInt(length))) {
                const count = int(this.writePosition + BigInt(this.writeBuffer.length) - this.position);
                length = (length - count) | 0;
                ArrayUtils.copyBytes(data, offset, this.writeBuffer, int(this.position - this.writePosition), count);
                this.position = long(this.position + BigInt(count));
                this.writeLength = this.writeBuffer.length;
                offset = (offset + count) | 0;
                this.FlushToDisk();
            }
            if (length > this.writeBuffer.length) {
                if (this.position !== this.filePosition) {
                    this.file.seek(this.position);
                    this.filePosition = this.position;
                }
                this.file.write(length, data, offset);
                const end = long(this.position + BigInt(length));
                const readEnd = long(this.readPosition + BigInt(this.readLength));
                let overlapStart = -1n;
                if (this.readPosition <= this.position && readEnd > this.position) overlapStart = this.position;
                else if (this.readPosition >= this.position && this.readPosition < end) overlapStart = this.readPosition;
                this.filePosition = long(this.filePosition + BigInt(length));
                if (this.fileLength < this.filePosition) this.fileLength = this.filePosition;
                let overlapEnd = -1n;
                if (this.readPosition < end && end <= readEnd) overlapEnd = end;
                else if (this.position < readEnd && readEnd <= end) overlapEnd = readEnd;
                if (overlapStart > -1n && overlapEnd > overlapStart) {
                    ArrayUtils.copyBytes(data, int(BigInt(offset) + overlapStart - this.position), this.readBuffer, int(overlapStart - this.readPosition), int(overlapEnd - overlapStart));
                }
                this.position = long(this.position + BigInt(length));
            } else if (length > 0) {
                if (this.writePosition === -1n) this.writePosition = this.position;
                ArrayUtils.copyBytes(data, offset, this.writeBuffer, int(this.position - this.writePosition), length);
                this.position = long(this.position + BigInt(length));
                if (long(this.position - this.writePosition) > BigInt(this.writeLength)) this.writeLength = int(this.position - this.writePosition);
            }
        } catch (error) {
            if (error instanceof FileIoError) this.filePosition = -1n;
            throw error;
        }
    }

    // sa.b(I)V
    Close(): void {
        this.FlushToDisk();
        this.file.close();
    }

    // sa.c(I)Ljava/io/File;
    private getFile(): string | null {
        return this.file.getFile();
    }

    // sa.d(I)V
    private FlushToDisk(): void {
        if (this.writePosition !== -1n) {
            if (this.writePosition !== this.filePosition) {
                this.file.seek(this.writePosition);
                this.filePosition = this.writePosition;
            }
            this.file.write(this.writeLength, this.writeBuffer, 0);
            this.filePosition = long(this.filePosition + BigInt(this.writeLength));
            if (this.fileLength < this.filePosition) this.fileLength = this.filePosition;
            const readEnd = long(this.readPosition + BigInt(this.readLength));
            const writeEnd = long(this.writePosition + BigInt(this.writeLength));
            let start = -1n;
            if (this.writePosition >= this.readPosition && this.writePosition < readEnd) start = this.writePosition;
            else if (this.readPosition >= this.writePosition && this.readPosition < writeEnd) start = this.readPosition;
            let end = -1n;
            if (writeEnd > this.readPosition && writeEnd <= readEnd) end = writeEnd;
            else if (this.writePosition < readEnd && readEnd <= writeEnd) end = readEnd;
            if (start > -1n && end > start) {
                ArrayUtils.copyBytes(this.writeBuffer, int(start - this.writePosition), this.readBuffer, int(start - this.readPosition), int(end - start));
            }
            this.writePosition = -1n;
            this.writeLength = 0;
        }
    }
}
