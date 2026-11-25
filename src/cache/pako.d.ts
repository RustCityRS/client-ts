declare module 'pako/lib/zlib/crc32.js' {
    export default function crc32(crc: number, input: Uint8Array, length: number, offset: number): number;
}

declare module 'pako/lib/zlib/zstream.js' {
    export default class ZStream {
        input: Uint8Array | null;
        next_in: number;
        avail_in: number;
        output: Uint8Array | null;
        next_out: number;
        avail_out: number;
    }
}

declare module 'pako/lib/zlib/inflate.js' {
    import type ZStream from 'pako/lib/zlib/zstream.js';
    export function inflateInit2(stream: ZStream, windowBits: number): number;
    export function inflate(stream: ZStream, flush: number): number;
    export function inflateReset(stream: ZStream): number;
}

declare module 'pako/lib/zlib/deflate.js' {
    import type ZStream from 'pako/lib/zlib/zstream.js';
    export function deflateInit2(stream: ZStream, level: number, method: number, windowBits: number, memLevel: number, strategy: number): number;
    export function deflate(stream: ZStream, flush: number): number;
    export function deflateReset(stream: ZStream): number;
}
