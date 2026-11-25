// java.nio.BufferOverflowException, a RuntimeException: a relative put found fewer than the needed elements before
// the limit. Like other host errors it is caught by the gamepack's catch (RuntimeException) handlers.
export default class BufferOverflowException extends Error {
    // java.nio.BufferOverflowException.<init>()V
    constructor() {
        super('BufferOverflowException');
        this.name = 'BufferOverflowException';
    }
}
