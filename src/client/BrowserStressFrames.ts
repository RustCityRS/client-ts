// The optional GPU stress pass may use the time the stock timer spends asleep.
// A posted browser task gives input, timers and GPU completion callbacks a turn.
export default class BrowserStressFrames {
    private readonly channel?: MessageChannel;
    private deadline = -Infinity;
    private cost = 1;
    private queued = false;
    private retry?: ReturnType<typeof setTimeout>;
    private failure?: { error: unknown };
    private frames = 0;
    private sampleStart = performance.now();
    private refresh = 0;
    private previousRefresh = -Infinity;
    private refreshPeriod = 0;
    private lastPresentation = 0;
    private gameDrawn = false;
    fps = 0;
    extraFrames = 0;

    constructor(
        readonly render: (gameDrawn?: boolean, time?: number) => boolean,
        readonly displayPaced = false
    ) {
        if (displayPaced) {
            this.refresh = requestAnimationFrame(this.onRefresh);
            return;
        }
        this.channel = new MessageChannel();
        this.channel.port1.onmessage = () => {
            this.queued = false;
            const start = performance.now();
            if (globalThis.document?.hidden || start + this.cost >= this.deadline) return;
            try {
                if (this.render()) {
                    const end = performance.now();
                    this.cost = Math.max(0.25, end - start);
                    this.extraFrames++;
                    this.recordFrame(end);
                    if (end + this.cost < this.deadline) this.schedule();
                } else if (start + 2 + this.cost < this.deadline) {
                    // A full GPU queue should sleep rather than spin on posted tasks.
                    this.retry = setTimeout(() => this.schedule(), 2);
                }
            } catch (error) {
                this.failure = { error };
            }
        };
    }

    private readonly onRefresh = (timestamp: number): void => {
        this.refresh = requestAnimationFrame(this.onRefresh);
        const interval = timestamp - this.previousRefresh;
        this.previousRefresh = timestamp;
        if (interval > 100) this.refreshPeriod = 0;
        else if (interval > 0) this.refreshPeriod = this.refreshPeriod === 0 ? interval : Math.min(interval, this.refreshPeriod * 1.02);
        if (globalThis.document?.hidden || this.failure) return;
        const start = performance.now();
        // Two callbacks can run almost together after a long game draw. Their GPU
        // frames still reach the desktop in sequence. Give the second camera sample
        // a bounded lead, while a late frame can use the current input immediately.
        const time = Math.max(start, this.lastPresentation, Math.min(start + Math.min(4, this.refreshPeriod / 3), this.lastPresentation + this.refreshPeriod));
        try {
            if (this.render(this.gameDrawn, time)) {
                this.lastPresentation = time;
                if (!this.gameDrawn) this.extraFrames++;
                this.gameDrawn = false;
                this.countFrame(start);
            }
        } catch (error) {
            this.failure = { error };
        }
    };

    private schedule(): void {
        if (!this.queued && this.deadline !== -Infinity) {
            this.queued = true;
            this.channel?.port2.postMessage(0);
        }
    }

    async duringWait(ticks: Promise<number>, deadline: number): Promise<number> {
        this.deadline = deadline;
        // An expensive first-use upload can outlast an entire tick. Gradually allow
        // another probe as the scene warms up.
        this.cost = Math.max(0.25, this.cost * 0.98);
        if (!this.displayPaced && !globalThis.document?.hidden && performance.now() + this.cost < deadline) this.schedule();
        try {
            const count = await ticks;
            if (this.failure) throw this.failure.error;
            return count;
        } finally {
            this.deadline = -Infinity;
            clearTimeout(this.retry);
        }
    }

    recordFrame(now = performance.now()): void {
        if (this.displayPaced) this.gameDrawn = true;
        else this.countFrame(now);
    }

    private countFrame(now: number): void {
        this.frames++;
        const elapsed = now - this.sampleStart;
        if (elapsed >= 1000) {
            this.fps = Math.round((1000 * this.frames) / elapsed);
            this.sampleStart = now;
            this.frames = 0;
        }
    }

    close(): void {
        this.deadline = -Infinity;
        if (this.displayPaced) cancelAnimationFrame(this.refresh);
        clearTimeout(this.retry);
        this.channel?.port1.close();
        this.channel?.port2.close();
    }
}
