export default class ThreadUtils {
    private static timerTasks?: MessageChannel;
    private static readonly shortSleeps: { delay: number; resolve: () => void }[] = [];

    // qa.a(IJ)V
    static async sleep(milliseconds: bigint): Promise<void> {
        if (milliseconds > 0n) {
            if (milliseconds % 10n === 0n) {
                await this.sleepInternal(milliseconds - 1n);
                await this.sleepInternal(1n);
            } else {
                await this.sleepInternal(milliseconds);
            }
        }
    }

    // kh.a(IJ)V. setTimeout accepts a signed 32-bit delay at the browser boundary.
    private static async sleepInternal(milliseconds: bigint): Promise<void> {
        while (milliseconds > 2147483647n) {
            await new Promise<void>(resolve => setTimeout(resolve, 2147483647));
            milliseconds -= 2147483647n;
        }
        const delay = Number(milliseconds);
        if (delay < 4 && typeof window !== 'undefined' && typeof MessageChannel !== 'undefined') {
            // The game loop can otherwise nest timers indefinitely. Browsers clamp a nested
            // 1 ms timeout to 4 ms. Start the requested timeout from a fresh browser task.
            if (this.timerTasks === undefined) {
                this.timerTasks = new MessageChannel();
                this.timerTasks.port1.onmessage = () => {
                    const next = this.shortSleeps.shift();
                    if (next) setTimeout(next.resolve, next.delay);
                };
            }
            const port = this.timerTasks.port2;
            await new Promise<void>(resolve => {
                this.shortSleeps.push({ delay, resolve });
                port.postMessage(0);
            });
        } else {
            await new Promise<void>(resolve => setTimeout(resolve, delay));
        }
    }
}
