import type Occlude from './Occlude';

// All fields used by the five point projection cases in tj.a(III)Z.
const projectionFields = ['mode', 'minX', 'maxX', 'minY', 'maxY', 'minZ', 'maxZ', 'minDeltaX', 'maxDeltaX', 'minDeltaY', 'maxDeltaY', 'minDeltaZ', 'maxDeltaZ'] as const;
const slots = 16384;

export default class SceneOcclusionQueries {
    active: Float64Array | null = null;
    private count = -1;
    private planes = new Int32Array(0);
    private answers: Float64Array | null = null;
    private dirty = false;

    begin(planes: (Occlude | null)[] | null, count: number): void {
        this.active = null;
        if (count < 8 || !planes || count > planes.length) {
            this.count = -1;
            return;
        }
        const length = count * projectionFields.length;
        if (this.planes.length < length) this.planes = new Int32Array(length);
        let same = count === this.count;
        let i = 0;
        for (let p = 0; p < count; p++) {
            const plane = planes[p];
            if (!plane) {
                this.count = -1;
                return;
            }
            for (const field of projectionFields) {
                const value = plane[field];
                if (this.planes[i] !== value) same = false;
                this.planes[i++] = value;
            }
        }
        this.count = count;
        if (!same) {
            this.dirty = true;
            return;
        }
        this.answers ??= new Float64Array(slots);
        if (this.dirty) this.answers.fill(0);
        this.dirty = false;
        this.active = this.answers;
    }

    query(x: number, y: number, z: number, project: (x: number, y: number, z: number) => boolean): boolean {
        const answers = this.active;
        // Loaded scene points fit 14 bits per horizontal axis. Up to 24 height bits
        // and the sign denoting the answer still give an exact binary64 key.
        if (!answers || x !== (x | 0) || y !== (y | 0) || z !== (z | 0) || (x | z) >>> 0 >= 16384 || (y + 0x800000) >>> 0 >= 0x1000000) return project(x, y, z);
        const key = ((y + 0x800000) * 16384 + z) * 16384 + x + 1;
        const hash = Math.imul(x, 0x9e3779b1) ^ Math.imul(y, 0x85ebca77) ^ Math.imul(z, 0xc2b2ae3d);
        const first = (hash ^ (hash >>> 16)) & (slots - 1);
        let slot = first;
        for (let i = 0; i < 8; i++) {
            const stored = answers[slot];
            if (stored === 0) break;
            if (stored === key) return true;
            if (stored === -key) return false;
            slot = (slot + 1) & (slots - 1);
            if (i === 7) slot = first;
        }
        const hidden = project(x, y, z);
        answers[slot] = hidden ? key : -key;
        return hidden;
    }
}
