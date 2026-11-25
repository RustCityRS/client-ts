import { glJar } from '#/client/ClientVariant';
import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import BufferedRandomAccessFile from '#/io/BufferedRandomAccessFile';
import { EndOfFile, FileIoError } from '#/io/File';
import { arrayAtU8, arrayPutU8, requireNonNull } from '#/util/JavaArray';
import type { Js5BrowserDiskStore } from './Js5DiskRequest';
import { loadCursorType, loadRoofModeStatics } from '#/util/GamepackClasses';

// cg
export default class DataFile {
    // HD ge.a(Z)V
    static releaseHdStatics(guard: boolean): void {
        try {
            const RoofModeStatics = loadRoofModeStatics();
            releaseReferences(RoofModeStatics, 'roofMaxY');
            const CursorType = loadCursorType();
            releaseReferences(CursorType, 'types');
            if (!guard) {
                releaseReferences(CursorType, 'types');
            }
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'ge.G(' + guard + ')');
        }
    }

    static sectorBuffer: Uint8Array | null = new Uint8Array(520); // le.h:[B
    static masterIndexFile: BufferedRandomAccessFile | null = null; // q.c:Lsa;
    private readonly archive: number; // cg.a:I
    private readonly dataFile: BufferedRandomAccessFile; // cg.b:Lsa;
    private readonly maximumSize: number; // cg.e:I
    private readonly indexFile: BufferedRandomAccessFile | null; // cg.k:Lsa;

    // cg.<init>(ILsa;Lsa;I)V
    constructor(archive: number, dataFile: BufferedRandomAccessFile, indexFile: BufferedRandomAccessFile | null, maximumSize: number) {
        this.dataFile = dataFile;
        this.maximumSize = maximumSize;
        this.indexFile = indexFile;
        this.archive = archive;
    }

    // cg.a(II[BB)Z
    write(length: number, group: number, bytes: Uint8Array | null): boolean {
        if (length < 0 || this.maximumSize < length) throw new RangeError('Cache group size ' + length);
        let success = this.writeSectors(group, length, true, bytes);
        if (!success) success = this.writeSectors(group, length, false, bytes);
        return success;
    }

    // cg.a(IIBZ[B)Z
    private writeSectors(group: number, length: number, overwrite: boolean, bytes: Uint8Array | null): boolean {
        try {
            let current: number;
            if (!overwrite) {
                current = Number(BigInt.asIntN(32, BigInt.asIntN(64, this.dataFile.GetSize() + 519n) / 520n)) | 0;
                if (current === 0) current = 1;
            } else {
                if (BigInt((Math.imul(group, 6) + 6) | 0) > requireNonNull(this.indexFile).GetSize()) return false;
                requireNonNull(this.indexFile).seek(BigInt(Math.imul(group, 6)));
                requireNonNull(this.indexFile).Read(6, DataFile.sectorBuffer, 0);
                current = (arrayAtU8(DataFile.sectorBuffer, 3) << 16) + (arrayAtU8(DataFile.sectorBuffer, 4) << 8) + arrayAtU8(DataFile.sectorBuffer, 5);
                if (current <= 0 || BigInt(current) > this.dataFile.GetSize() / 520n) return false;
            }
            let pos = 0;
            if (glJar) {
                // ge.a(BII[BZ)Z writes the new index entry in this order.
                arrayPutU8(DataFile.sectorBuffer, 0, length >> 16);
                arrayPutU8(DataFile.sectorBuffer, 4, current >> 8);
                arrayPutU8(DataFile.sectorBuffer, 5, current);
                arrayPutU8(DataFile.sectorBuffer, 2, length);
                arrayPutU8(DataFile.sectorBuffer, 3, current >> 16);
                arrayPutU8(DataFile.sectorBuffer, 1, length >> 8);
            } else {
                arrayPutU8(DataFile.sectorBuffer, 4, current >> 8);
                arrayPutU8(DataFile.sectorBuffer, 1, length >> 8);
                arrayPutU8(DataFile.sectorBuffer, 5, current);
                arrayPutU8(DataFile.sectorBuffer, 2, length);
                arrayPutU8(DataFile.sectorBuffer, 0, length >> 16);
                arrayPutU8(DataFile.sectorBuffer, 3, current >> 16);
            }
            requireNonNull(this.indexFile).seek(BigInt(Math.imul(group, 6)));
            let part = 0;
            requireNonNull(this.indexFile).Write(0, DataFile.sectorBuffer, 6);
            while (pos < length) {
                let next = 0;
                if (overwrite) {
                    this.dataFile.seek(BigInt(Math.imul(current, 520)));
                    try {
                        this.dataFile.Read(8, DataFile.sectorBuffer, 0);
                    } catch (error) {
                        if (error instanceof EndOfFile) break;
                        throw error;
                    }
                    next = (arrayAtU8(DataFile.sectorBuffer, 4) << 16) + (arrayAtU8(DataFile.sectorBuffer, 5) << 8) + arrayAtU8(DataFile.sectorBuffer, 6);
                    const storedGroup = arrayAtU8(DataFile.sectorBuffer, 1) + (arrayAtU8(DataFile.sectorBuffer, 0) << 8);
                    const storedPart = arrayAtU8(DataFile.sectorBuffer, 3) + (arrayAtU8(DataFile.sectorBuffer, 2) << 8);
                    if (group !== storedGroup || part !== storedPart || arrayAtU8(DataFile.sectorBuffer, 7) !== this.archive) return false;
                    if (next < 0 || BigInt(next) > this.dataFile.GetSize() / 520n) return false;
                }
                if (next === 0) {
                    overwrite = false;
                    next = Number(BigInt.asIntN(32, BigInt.asIntN(64, 519n + this.dataFile.GetSize()) / 520n)) | 0;
                    if (next === 0) next++;
                    if (current === next) next = (next + 1) | 0;
                }
                let count = (length - pos) | 0;
                if (glJar) {
                    arrayPutU8(DataFile.sectorBuffer, 7, this.archive);
                    arrayPutU8(DataFile.sectorBuffer, 0, group >> 8);
                    if (length - pos <= 512) next = 0;
                    arrayPutU8(DataFile.sectorBuffer, 4, next >> 16);
                    if (count > 512) count = 512;
                    arrayPutU8(DataFile.sectorBuffer, 1, group);
                    arrayPutU8(DataFile.sectorBuffer, 6, next);
                    arrayPutU8(DataFile.sectorBuffer, 2, part >> 8);
                    arrayPutU8(DataFile.sectorBuffer, 3, part);
                    part++;
                    arrayPutU8(DataFile.sectorBuffer, 5, next >> 8);
                } else {
                    arrayPutU8(DataFile.sectorBuffer, 3, part);
                    arrayPutU8(DataFile.sectorBuffer, 0, group >> 8);
                    if (length - pos <= 512) next = 0;
                    arrayPutU8(DataFile.sectorBuffer, 7, this.archive);
                    arrayPutU8(DataFile.sectorBuffer, 1, group);
                    arrayPutU8(DataFile.sectorBuffer, 4, next >> 16);
                    arrayPutU8(DataFile.sectorBuffer, 2, part++ >> 8);
                    arrayPutU8(DataFile.sectorBuffer, 6, next);
                    if (count > 512) count = 512;
                    arrayPutU8(DataFile.sectorBuffer, 5, next >> 8);
                }
                this.dataFile.seek(BigInt(Math.imul(520, current)));
                current = next;
                this.dataFile.Write(0, DataFile.sectorBuffer, 8);
                this.dataFile.Write(pos, bytes, count);
                pos = (pos + count) | 0;
            }
            return true;
        } catch (error) {
            if (error instanceof FileIoError) return false;
            throw error;
        }
    }

    // cg.toString()Ljava/lang/String;
    toString(): string {
        return 'Cache:' + this.archive;
    }

    // cg.a(II)[B
    read(lengthMask: number, group: number): Uint8Array | null {
        try {
            if (BigInt((Math.imul(group, 6) + 6) | 0) > requireNonNull(this.indexFile).GetSize()) return null;
            requireNonNull(this.indexFile).seek(BigInt(Math.imul(group, 6)));
            requireNonNull(this.indexFile).Read(6, DataFile.sectorBuffer, 0);
            const length = arrayAtU8(DataFile.sectorBuffer, 2) + (lengthMask & ((arrayAtU8(DataFile.sectorBuffer, 1) << 24) >> 16)) + (arrayAtU8(DataFile.sectorBuffer, 0) << 16);
            let current = arrayAtU8(DataFile.sectorBuffer, 5) + (arrayAtU8(DataFile.sectorBuffer, 4) << 8) + (arrayAtU8(DataFile.sectorBuffer, 3) << 16);
            if (length < 0 || length > this.maximumSize) return null;
            if (current <= 0 || BigInt(current) > this.dataFile.GetSize() / 520n) return null;
            const out = new Uint8Array(length);
            let pos = 0;
            let part = 0;
            while (pos < length) {
                if (current === 0) return null;
                let count = (length - pos) | 0;
                if (count > 512) count = 512;
                this.dataFile.seek(BigInt(Math.imul(current, 520)));
                this.dataFile.Read(8 + count, DataFile.sectorBuffer, 0);
                const storedGroup = (arrayAtU8(DataFile.sectorBuffer, 0) << 8) + arrayAtU8(DataFile.sectorBuffer, 1);
                const storedPart = (arrayAtU8(DataFile.sectorBuffer, 2) << 8) + arrayAtU8(DataFile.sectorBuffer, 3);
                const next = (arrayAtU8(DataFile.sectorBuffer, 5) << 8) + (arrayAtU8(DataFile.sectorBuffer, 4) << 16) + arrayAtU8(DataFile.sectorBuffer, 6);
                if (storedGroup !== group || storedPart !== part || arrayAtU8(DataFile.sectorBuffer, 7) !== this.archive) return null;
                if (next < 0 || BigInt(next) > this.dataFile.GetSize() / 520n) return null;
                current = next;
                for (let i = 0; i < count; i++) out[pos++] = arrayAtU8(DataFile.sectorBuffer, 8 + i);
                part++;
            }
            return out;
        } catch (error) {
            if (error instanceof FileIoError) return null;
            throw error;
        }
    }
}

export function sectorDiskStore(cache: DataFile): Js5BrowserDiskStore {
    return {
        read(group) {
            return cache.read(0xff00, group);
        },
        write(group, bytes) {
            cache.write(bytes.length, group, bytes);
        }
    };
}
