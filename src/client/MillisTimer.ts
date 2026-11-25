import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import SafeTime from '#/io/SafeTime';
import ThreadUtils from '#/util/ThreadUtils';
import Timer from './Timer';
import { loadClient, loadEnumType, loadGameShell, loadLocalisedText, loadRoofModeStatics } from '#/util/GamepackClasses';

export default class MillisTimer extends Timer {
    override browserWakeTime(): number {
        return performance.now() + this.sleepTime;
    }

    // HD lj.c(I)V
    static releaseMillisTimerStatics(guard: number): void {
        try {
            const LocalisedText = loadLocalisedText();
            releaseReferences(LocalisedText, 'germanDrop');
            const RoofModeStatics = loadRoofModeStatics();
            releaseReferences(RoofModeStatics, 'roofMinX');
            const GameShell = loadGameShell();
            releaseReferences(GameShell, 'progressImage');
            if (guard !== 14635) {
                const EnumType = loadEnumType();
                releaseReferences(EnumType, 'm_recentUse');
            }
            const Client = loadClient();
            releaseReferences(Client, 'hintMapMarkers');
            const EnumType = loadEnumType();
            releaseReferences(EnumType, 'm_recentUse');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'lj.G(' + guard + ')');
        }
    }

    private now: bigint; // gl.j:J
    private step: number; // gl.m:I
    private readonly times = new BigInt64Array(10); // gl.o:[J
    private fraction: number; // gl.q:I
    private index = 0; // gl.r:I
    private sleepTime: number; // gl.v:I

    // gl.a(B)V
    reset(): void {
        for (let i = 0; i < 10; i++) this.times[i] = 0n;
    }

    // gl.a(BII)I
    async wait(minimumSleep: number, cycleTime: number): Promise<number> {
        const oldStep = this.step;
        this.step = 300;
        const oldSleep = this.sleepTime;
        this.sleepTime = 1;
        this.now = SafeTime.CurrentTimeMillis();
        if (this.times[this.index] !== 0n) {
            if (this.times[this.index] < this.now) {
                const elapsed = BigInt.asIntN(64, this.now - this.times[this.index]);
                this.step = Number(BigInt.asIntN(32, BigInt(Math.imul(2560, cycleTime)) / elapsed));
            }
        } else {
            this.sleepTime = oldSleep;
            this.step = oldStep;
        }
        if (this.step < 25) this.step = 25;
        if (this.step > 256) {
            this.step = 256;
            const elapsed = BigInt.asIntN(64, this.now - this.times[this.index]);
            this.sleepTime = Number(BigInt.asIntN(32, BigInt(cycleTime) - elapsed / 10n));
        }
        if (this.sleepTime > cycleTime) this.sleepTime = cycleTime;
        this.times[this.index] = this.now;
        this.index = (this.index + 1) % 10;
        if (this.sleepTime > 1) {
            for (let i = 0; i < 10; i++) {
                if (this.times[i] !== 0n) this.times[i] += BigInt(this.sleepTime);
            }
        }
        if (this.sleepTime < minimumSleep) this.sleepTime = minimumSleep;
        await ThreadUtils.sleep(BigInt(this.sleepTime));
        let cycles = 0;
        while (this.fraction < 256) {
            this.fraction = (this.fraction + this.step) | 0;
            cycles++;
        }
        this.fraction &= 255;
        return cycles;
    }

    // gl.<init>()V
    constructor() {
        super();
        this.step = 256;
        this.fraction = 0;
        this.sleepTime = 1;
        this.now = SafeTime.CurrentTimeMillis();
        for (let i = 0; i < 10; i++) this.times[i] = this.now;
    }
}
