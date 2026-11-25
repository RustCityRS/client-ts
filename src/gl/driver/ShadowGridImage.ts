// The HD shadow mesh (wm.a([[III)V) uses the same 9 × 9 positions, texture coordinates
// and triangle order for every block. Recognize the actual upload bits before discarding
// those lanes. An unrelated GL buffer of the same length always takes the ordinary path.
const texCoord = new Uint32Array(Float32Array.from({ length: 9 }, (_, n) => n / 8).buffer);
const worldCoord = new Uint32Array(Float32Array.from({ length: 9 }, (_, n) => n * 128).buffer);
const indexOffsets = [9, 0, 1, 9, 1, 10];

function indexWord(i: number): number {
    const square = (i / 6) | 0;
    return (square >> 3) * 9 + (square & 7) + indexOffsets[i % 6];
}

function vertexCoordinatesMatch(view: DataView, i: number): boolean {
    const x = i % 9,
        z = (i / 9) | 0,
        at = i * 20;
    return view.getUint32(at, true) === texCoord[x] && view.getUint32(at + 4, true) === texCoord[z] && view.getUint32(at + 8, true) === worldCoord[x] && view.getUint32(at + 16, true) === worldCoord[z];
}

export class ShadowGridImage {
    // null denotes the one common index mesh. Vertices need only their exact height bits.
    private constructor(private readonly heights: number | Uint32Array | null) {}

    static capture(source: Uint8Array): ShadowGridImage | undefined {
        if (source.length !== 1536 && source.length !== 1620) return;
        const view = new DataView(source.buffer, source.byteOffset, source.length);
        if (source.length === 1536) {
            for (let i = 0; i < 384; i++) if (view.getUint32(i * 4, true) !== indexWord(i)) return;
            return new ShadowGridImage(null);
        }
        const first = view.getUint32(12, true);
        let heights: Uint32Array | undefined;
        for (let i = 0; i < 81; i++) {
            if (!vertexCoordinatesMatch(view, i)) return;
            const height = view.getUint32(i * 20 + 12, true);
            if (height !== first && heights === undefined) heights = new Uint32Array(81).fill(first);
            if (heights) heights[i] = height;
        }
        return new ShadowGridImage(heights ?? first);
    }

    get retainedByteLength(): number {
        return this.heights instanceof Uint32Array ? this.heights.byteLength : 0;
    }

    matches(source: Uint8Array): boolean {
        const view = new DataView(source.buffer, source.byteOffset, source.length);
        if (this.heights === null) {
            for (let i = 0; i < 384; i++) if (view.getUint32(i * 4, true) !== indexWord(i)) return false;
        } else {
            for (let i = 0; i < 81; i++) {
                const height = typeof this.heights === 'number' ? this.heights : this.heights[i];
                if (!vertexCoordinatesMatch(view, i) || view.getUint32(i * 20 + 12, true) !== height) return false;
            }
        }
        return true;
    }

    bytes(): Uint8Array<ArrayBuffer> {
        if (this.heights === null) {
            const bytes = new Uint8Array(1536),
                view = new DataView(bytes.buffer);
            for (let i = 0; i < 384; i++) view.setUint32(i * 4, indexWord(i), true);
            return bytes;
        }
        const bytes = new Uint8Array(1620),
            view = new DataView(bytes.buffer);
        for (let i = 0; i < 81; i++) {
            const x = i % 9,
                z = (i / 9) | 0,
                at = i * 20;
            view.setUint32(at, texCoord[x], true);
            view.setUint32(at + 4, texCoord[z], true);
            view.setUint32(at + 8, worldCoord[x], true);
            view.setUint32(at + 12, typeof this.heights === 'number' ? this.heights : this.heights[i], true);
            view.setUint32(at + 16, worldCoord[z], true);
        }
        return bytes;
    }
}
