// java.util.Random. Each instance retains its own low 48 bits.
export default class JavaRandom {
    private static uniquifier = 8682522807148012n;
    private seed: bigint;

    constructor(seed?: bigint) {
        if (seed === undefined) {
            JavaRandom.uniquifier = BigInt.asIntN(64, JavaRandom.uniquifier * 1181783497276652981n);
            // System.nanoTime is supplied by the monotonic clock of the host.
            seed = JavaRandom.uniquifier ^ BigInt(Math.floor(performance.now() * 1000000));
        }
        this.seed = BigInt.asUintN(48, seed ^ 0x5deece66dn);
    }

    setSeed(seed: bigint): void {
        this.seed = BigInt.asUintN(48, seed ^ 0x5deece66dn);
    }

    private next(bits: number): number {
        this.seed = BigInt.asUintN(48, this.seed * 0x5deece66dn + 11n);
        return Number(this.seed >> BigInt(48 - bits)) | 0;
    }

    nextInt(): number {
        return this.next(32);
    }

    nextDouble(): number {
        return (this.next(26) * 134217728 + this.next(27)) / 9007199254740992;
    }
}

// java.lang.Math.RandomNumberGeneratorHolder.randomNumberGenerator
export const mathRandom = new JavaRandom();
