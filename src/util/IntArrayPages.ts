// Each view is a distinct, zero-initialized Java int[]. Small neighboring
// arrays can share backing storage while keeping independent bounds and writes.
export default class IntArrayPages {
    private page: ArrayBuffer | null = null;
    private next = 0;

    constructor(private readonly capacity: number) {}

    allocate(length: number): Int32Array {
        if (length <= 0 || length > this.capacity) return new Int32Array(length);
        if (this.page === null || this.next + length > this.capacity) {
            this.page = new ArrayBuffer(this.capacity * Int32Array.BYTES_PER_ELEMENT);
            this.next = 0;
        }
        const array = new Int32Array(this.page, this.next * Int32Array.BYTES_PER_ELEMENT, length);
        this.next += length;
        if (this.next === this.capacity) this.page = null;
        return array;
    }
}
