import { arrayAtObj } from '#/util/JavaArray';
export default class ByteArrayPool {
    // wg.e:[[B
    static small = new Array<Uint8Array | null>(1000).fill(null);
    // j.a:I
    static smallCount = 0;
    // wk.r:[[B
    static medium = new Array<Uint8Array | null>(250).fill(null);
    // lc.C:I
    static mediumCount = 0;
    // nb.b:[[B
    static large = new Array<Uint8Array | null>(50).fill(null);
    // ek.q:I
    static largeCount = 0;

    // oi.a(BI)[B
    static allocate(size: number): Uint8Array | null {
        if (size === 100 && this.smallCount > 0) {
            const bytes = arrayAtObj(this.small, --this.smallCount);
            this.small[this.smallCount] = null;
            return bytes;
        } else if (size === 5000 && this.mediumCount > 0) {
            const bytes = arrayAtObj(this.medium, --this.mediumCount);
            this.medium[this.mediumCount] = null;
            return bytes;
        } else if (size === 30000 && this.largeCount > 0) {
            const bytes = arrayAtObj(this.large, --this.largeCount);
            this.large[this.largeCount] = null;
            return bytes;
        }
        return new Uint8Array(size);
    }
}
