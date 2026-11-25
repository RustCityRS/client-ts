import JagString from '#/datastruct/JagString.js';
import { requireNonNull } from '#/util/JavaArray.js';
import Minimenu from '#/ui/Minimenu.js';

export function entries(): string {
    const m = Minimenu;
    let hash = 1;
    const mul = (add: number) => {
        hash = (Math.imul(31, hash) + add) | 0;
    };
    const text = (s: JagString | null) => {
        const value = s === null ? '-' : Buffer.from(requireNonNull(s.bytes).subarray(0, s.length)).toString('hex');
        let code = 0;
        for (let i = 0; i < value.length; i++) code = (Math.imul(31, code) + value.charCodeAt(i)) | 0;
        mul(code);
    };
    for (let i = 0; i < m.count; i++) {
        text(m.option[i]);
        text(m.target[i]);
        text(m.label(i));
        for (const v of [BigInt(m.actions[i]), BigInt(m.cursor[i]), BigInt(m.paramB[i]), BigInt(m.paramC[i]), m.keys[i]]) {
            mul(Number(BigInt.asIntN(32, v)));
            mul(Number(BigInt.asIntN(32, v >> 32n)));
        }
    }
    return m.count + ',' + hash;
}

export function menuArrayHash(values: ArrayLike<number | bigint | JagString | null> | null): number {
    if (values === null) return 0;
    let result = 1;
    for (let i = 0; i < values.length; i++) {
        const v = values[i];
        const h = v === null ? 0 : typeof v === 'number' ? v : typeof v === 'bigint' ? Number(BigInt.asIntN(32, v ^ (v >> 32n))) : v.hashCode();
        result = (Math.imul(result, 31) + h) | 0;
    }
    return result;
}
