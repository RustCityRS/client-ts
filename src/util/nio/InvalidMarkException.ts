// java.nio.InvalidMarkException (an IllegalStateException, so a RuntimeException): reset() found no mark.
export default class InvalidMarkException extends Error {
    // java.nio.InvalidMarkException.<init>()V
    constructor() {
        super('InvalidMarkException');
        this.name = 'InvalidMarkException';
    }
}
