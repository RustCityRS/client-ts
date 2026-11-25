// java.nio.BufferUnderflowException, a RuntimeException: a relative get found fewer than the needed elements before
// the limit. Like other host errors it is caught by the gamepack's catch (RuntimeException) handlers.
export default class BufferUnderflowException extends Error {
    // java.nio.BufferUnderflowException.<init>()V
    constructor() {
        super('BufferUnderflowException');
        this.name = 'BufferUnderflowException';
    }
}
