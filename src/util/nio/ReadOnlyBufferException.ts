// java.nio.ReadOnlyBufferException (an UnsupportedOperationException, so a RuntimeException): a content mutation,
// array() or arrayOffset() on a read-only buffer.
export default class ReadOnlyBufferException extends Error {
    // java.nio.ReadOnlyBufferException.<init>()V
    constructor() {
        super('ReadOnlyBufferException');
        this.name = 'ReadOnlyBufferException';
    }
}
