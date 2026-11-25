// Host errors normally represent RuntimeException; Java Error and checked
// exceptions escape the gamepack's catch (RuntimeException) handlers.
export class JavaError extends Error {}
export class JavaCheckedException extends Error {}
export class IllegalStateException extends Error {
    override name = 'IllegalStateException';
}

// A recursive Java call exhausts the VM stack with StackOverflowError. Browser
// engines surface their own stack exhaustion as RangeError or InternalError.
export function isStackOverflow(error: unknown): boolean {
    return error instanceof Error && ((error instanceof RangeError && /maximum call stack size exceeded/i.test(error.message)) || (error.name === 'InternalError' && /too much recursion/i.test(error.message)));
}

export function isJavaRuntimeException(error: unknown): error is Error {
    return error instanceof Error && !(error instanceof JavaError) && !(error instanceof JavaCheckedException) && !isStackOverflow(error);
}
