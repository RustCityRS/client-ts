// Java keeps the game thread's call stack while a socket read blocks. Run all
// synchronous instructions immediately and resume on the same activation when
// the browser socket supplies its result or throws.
export function runToCompletion<T>(frame: Generator<Promise<unknown>, T, void>): T | Promise<T> {
    function advance(result: IteratorResult<Promise<unknown>, T>): T | Promise<T> {
        if (result.done) return result.value;
        return result.value.then(
            () => advance(frame.next()),
            error => advance(frame.throw(error))
        );
    }
    return advance(frame.next());
}
