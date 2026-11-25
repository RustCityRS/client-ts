function bytesToBigInt(bytes: Uint8Array): bigint {
    let result: bigint = 0n;
    for (let index: number = 0; index < bytes.length; index++) {
        result = (result << 8n) | BigInt(bytes[index]);
    }
    return result;
}

function bigIntToBytes(bigInt: bigint): Uint8Array {
    const bytes: number[] = [];
    while (bigInt > 0n) {
        bytes.unshift(Number(bigInt & 0xffn));
        bigInt >>= 8n;
    }

    if (bytes[0] & 0x80) {
        bytes.unshift(0);
    }

    return new Uint8Array(bytes);
}

function bigIntModPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
    let result: bigint = 1n;
    while (exponent > 0n) {
        if (exponent % 2n === 1n) {
            result = (result * base) % modulus;
        }
        base = (base * base) % modulus;
        exponent >>= 1n;
    }
    return result;
}

// The 530 login buffer uses BigInteger(byte[]), modPow and toByteArray.
export function signedBigInteger(bytes: Uint8Array): bigint {
    if (bytes.length === 0) throw new RangeError('Zero length BigInteger');
    return BigInt.asIntN(bytes.length * 8, bytesToBigInt(bytes));
}

export function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
    if (modulus <= 0n) throw new RangeError('BigInteger modulus not positive');
    if (modulus === 1n) return 0n;
    base = ((base % modulus) + modulus) % modulus;
    if (exponent < 0n) {
        let r = modulus,
            nextR = base;
        let t = 0n,
            nextT = 1n;
        while (nextR !== 0n) {
            const quotient = r / nextR;
            [r, nextR] = [nextR, r - quotient * nextR];
            [t, nextT] = [nextT, t - quotient * nextT];
        }
        if (r !== 1n) throw new RangeError('BigInteger not invertible');
        base = (t + modulus) % modulus;
        exponent = -exponent;
    }
    return bigIntModPow(base, exponent, modulus);
}

export function positiveBigIntegerBytes(value: bigint): Uint8Array {
    return value === 0n ? Uint8Array.of(0) : bigIntToBytes(value);
}
