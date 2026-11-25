import type Buffer from '#/util/nio/Buffer';
import { bufferElementSize } from '#/util/nio/BufferBytes';
import { GLX as E } from './GlEnums';
import type { ArrayPointer } from './GlState';

// OpenGL captures a client pointer's byte address when the pointer is specified. DrawElements may
// later read up to the last component of its highest indexed vertex, leaving the array cursor untouched.
export interface ClientVertexRange {
    start: number;
    end: number;
}

interface DrawRange extends ClientVertexRange {
    source?: Buffer;
    gpu?: GPUBuffer;
    offset: number;
}

// One entry per distinct NIO store in the six client array slots. Records are reused across
// draws. Their NIO and GPU references are released by the renderer's draw finally block.
export class ClientVertexRanges {
    private readonly entries: DrawRange[] = [];
    size = 0;

    get(source: Buffer): DrawRange | undefined {
        for (let i = 0; i < this.size; i++) {
            if (this.entries[i].source === source) return this.entries[i];
        }
        return undefined;
    }

    add(source: Buffer, start: number, end: number): void {
        let entry = this.entries[this.size];
        if (entry === undefined) {
            entry = { start, end, offset: 0 };
            this.entries.push(entry);
        }
        entry.source = source;
        entry.start = start;
        entry.end = end;
        this.size++;
    }

    clear(): void {
        for (let i = 0; i < this.size; i++) {
            const entry = this.entries[i];
            entry.source = undefined;
            entry.gpu = undefined;
        }
        this.size = 0;
    }
}

export function includeClientPointer(ranges: Map<Buffer, ClientVertexRange> | ClientVertexRanges, buffer: Buffer, pointer: ArrayPointer, highest: number): void {
    const elementBytes = bufferElementSize(buffer);
    const start = pointer.offset + pointer.clientPosition * elementBytes;
    const componentBytes = pointer.type === E.GL_FLOAT ? 4 : 1;
    const width = pointer.size * componentBytes;
    const stride = pointer.stride || width;
    const end = start + highest * stride + width;
    if (start < 0 || end > buffer.capacity() * elementBytes) throw new RangeError('indexed draw exceeds client vertex store');
    // These attributes are repacked individually into aligned float4 values. They consume no shared GPU slice.
    if (start & 3 || stride & 3 || (componentBytes === 1 && pointer.size !== 4)) return;
    const range = ranges.get(buffer);
    if (range === undefined) {
        if (ranges instanceof ClientVertexRanges) ranges.add(buffer, start, end);
        else ranges.set(buffer, { start, end });
    } else {
        range.start = Math.min(range.start, start);
        range.end = Math.max(range.end, end);
    }
}
