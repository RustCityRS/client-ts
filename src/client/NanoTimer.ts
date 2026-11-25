import ThreadUtils from '#/util/ThreadUtils';
import Timer from './Timer';

// System.nanoTime() at the host boundary. Split before scaling to retain the
// fractional millisecond on platforms with a long-running performance clock.
export function nanoTime(): bigint {
    const now = performance.now();
    const whole = Math.floor(now);
    return BigInt(whole) * 1000000n + BigInt(((now - whole) * 1000000) | 0);
}

export default class NanoTimer extends Timer {
    private nextTick: bigint; // bl.j:J

    override browserWakeTime(): number {
        return Number(this.nextTick) / 1000000;
    }

    // bl.a(B)V
    reset(): void {
        this.nextTick = nanoTime();
    }

    // bl.a(BII)I
    async wait(minimumSleep: number, cycleTime: number): Promise<number> {
        const minimum = 1000000n * BigInt(minimumSleep);
        let delay = BigInt.asIntN(64, this.nextTick - nanoTime());
        if (delay < minimum) delay = minimum;
        await ThreadUtils.sleep(delay / 1000000n);
        const now = nanoTime();
        let cycles = 0;
        while (cycles < 10 && (cycles < 1 || now > this.nextTick)) {
            cycles++;
            this.nextTick = BigInt.asIntN(64, this.nextTick + 1000000n * BigInt(cycleTime));
        }
        if (this.nextTick < now) this.nextTick = now;
        return cycles;
    }

    // bl.<init>()V
    constructor() {
        super();
        this.nextTick = nanoTime();
    }
}
