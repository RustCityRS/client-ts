import { requireNonNull } from '#/util/JavaArray';
import { byteAt, putByte } from '#/io/JavaByteArray';
import BZip2State from './BZip2State';
import BzipOutputWasm from './BzipOutputWasm';

function index(array: ArrayLike<number>, i: number): number {
    i |= 0;
    if (i < 0 || i >= array.length) throw new RangeError('BZip2 array index ' + i);
    return i;
}

export default class BZip2Decompressor {
    // rd.a:Lme; initialized by rd.<clinit>()V
    private static state: BZip2State | null = new BZip2State();
    // ij.d:[I
    static block: Int32Array | null = null;

    // rd.a([BI[BII)I
    static DecompressBZip2(dest: Uint8Array, length: number, source: Uint8Array, offset: number): number {
        const state = requireNonNull(this.state);
        state.input = source;
        state.nextInput = offset;
        state.output = dest;
        state.nextOutput = 0;
        state.outputRemaining = length;
        state.liveBits = 0;
        state.bitBuffer = 0;
        state.inputTotal = 0;
        state.outputTotal = 0;
        this.decodeBlocks(state);
        length = (length - state.outputRemaining) | 0;
        state.input = null;
        state.output = null;
        return length;
    }

    // rd.a()V
    static clear(): void {
        this.state = null;
    }

    // rd.a(Lme;)V
    private static writeOutput(state: BZip2State): void {
        let previous = state.lastByte;
        let repeat = state.repeatCount;
        let used = state.blockUsed;
        let currentByte = state.currentByte;
        const table = requireNonNull(this.block);
        let blockPos = state.blockPos;
        const dest = state.output;
        let nextOut = state.nextOutput;
        let space = state.outputRemaining;
        const previousSpace = space;
        const end = state.blockLength + 1;

        const native = BzipOutputWasm.write(table, dest, nextOut, space, previous, repeat, used, currentByte, blockPos, state.blockLength);
        if (native !== null) {
            previous = (native[0] << 24) >> 24;
            repeat = native[1];
            used = native[2];
            currentByte = (native[3] << 24) >> 24;
            blockPos = native[4];
            nextOut += native[5];
            space -= native[5];
        } else
            output: while (true) {
                if (repeat > 0) {
                    while (true) {
                        if (space === 0) {
                            break output;
                        }

                        if (repeat === 1) {
                            if (space === 0) {
                                repeat = 1;
                                break output;
                            }

                            putByte(dest, nextOut, previous);
                            nextOut++;
                            space--;
                            break;
                        }

                        putByte(dest, nextOut, previous);
                        repeat--;
                        nextOut++;
                        space--;
                    }
                }

                let advance = true;

                while (advance) {
                    advance = false;
                    if (used === end) {
                        repeat = 0;
                        break output;
                    }

                    previous = (currentByte << 24) >> 24;
                    blockPos = table[index(table, blockPos)];
                    const nextByte = (blockPos << 24) >> 24;
                    blockPos >>= 8;
                    used++;
                    if (nextByte !== currentByte) {
                        currentByte = nextByte;
                        if (space === 0) {
                            repeat = 1;
                            break output;
                        }

                        putByte(dest, nextOut, previous);
                        nextOut++;
                        space--;
                        advance = true;
                    } else if (used === end) {
                        if (space === 0) {
                            repeat = 1;
                            break output;
                        }

                        putByte(dest, nextOut, previous);
                        nextOut++;
                        space--;
                        advance = true;
                    }
                }

                repeat = 2;
                blockPos = table[index(table, blockPos)];
                let nextByte = (blockPos << 24) >> 24;
                blockPos >>= 8;
                if (++used !== end) {
                    if (nextByte !== currentByte) {
                        currentByte = nextByte;
                    } else {
                        repeat = 3;
                        blockPos = table[index(table, blockPos)];
                        nextByte = (blockPos << 24) >> 24;
                        blockPos >>= 8;
                        if (++used !== end) {
                            if (nextByte !== currentByte) {
                                currentByte = nextByte;
                            } else {
                                blockPos = table[index(table, blockPos)];
                                nextByte = (blockPos << 24) >> 24;
                                blockPos >>= 8;
                                used++;
                                repeat = (nextByte & 255) + 4;
                                blockPos = table[index(table, blockPos)];
                                currentByte = (blockPos << 24) >> 24;
                                blockPos >>= 8;
                                used++;
                            }
                        }
                    }
                }
            }

        state.outputTotal = (state.outputTotal + previousSpace - space) | 0;
        state.lastByte = previous;
        state.repeatCount = repeat;
        state.blockUsed = used;
        state.currentByte = currentByte;
        this.block = table;
        state.blockPos = blockPos;
        state.output = dest;
        state.nextOutput = nextOut;
        state.outputRemaining = space;
    }

    // rd.a(ILme;)I
    private static readBits(count: number, state: BZip2State): number {
        let live = state.liveBits,
            buffer = state.bitBuffer;
        while (live < count) {
            const at = state.nextInput,
                input = state.input;
            const next = input?.[at] ?? byteAt(input, at);
            state.bitBuffer = buffer = (buffer << 8) | next;
            state.liveBits = live = (live + 8) | 0;
            state.nextInput = (at + 1) | 0;
            state.inputTotal = (state.inputTotal + 1) | 0;
        }

        const result = (buffer >> (live - count)) & ((1 << count) - 1);
        state.liveBits = (live - count) | 0;
        return result;
    }

    // rd.b(Lme;)B
    private static readByte(state: BZip2State): number {
        return (this.readBits(8, state) << 24) >> 24;
    }

    // rd.c(Lme;)V
    private static decodeBlocks(state: BZip2State): void {
        let unary = 0;
        let alphabetSize = 0;
        let groups = 0;
        let selectorCount = 0;
        let endSymbol = 0;
        let selectorNo = 0;
        let remaining = 0;
        let symbol = 0;
        let decoded = 0;
        let run = 0;
        let weight = 0;
        let length = 0;
        let bits = 0;
        let code = 0;
        let bit = 0;
        let selector = 0;
        let minBits = 0;
        let limit: Int32Array;
        let base: Int32Array;
        let perm: Int32Array;
        state.blockSize100k = 1;
        if (this.block === null) {
            this.block = new Int32Array(state.blockSize100k * 100000);
        }

        const block = this.block;
        const mtf = state.mtfBytes,
            heads = state.mtfBases;
        const frequencies = state.frequencies,
            symbols = state.symbols,
            cumulative = state.cumulative;
        let another = true;

        while (another) {
            let symbolByte = this.readByte(state);
            if (symbolByte === 23) {
                return;
            }

            symbolByte = this.readByte(state);
            symbolByte = this.readByte(state);
            symbolByte = this.readByte(state);
            symbolByte = this.readByte(state);
            symbolByte = this.readByte(state);
            symbolByte = this.readByte(state);
            symbolByte = this.readByte(state);
            symbolByte = this.readByte(state);
            symbolByte = this.readByte(state);
            symbolByte = this.readBit(state);
            state.originalPointer = 0;
            symbolByte = this.readByte(state);
            state.originalPointer = (state.originalPointer << 8) | (symbolByte & 255);
            symbolByte = this.readByte(state);
            state.originalPointer = (state.originalPointer << 8) | (symbolByte & 255);
            symbolByte = this.readByte(state);
            state.originalPointer = (state.originalPointer << 8) | (symbolByte & 255);

            for (let i = 0; i < 16; i++) {
                symbolByte = this.readBit(state);
                if (symbolByte === 1) {
                    state.groupsInUse[i] = 1;
                } else {
                    state.groupsInUse[i] = 0;
                }
            }

            for (let i = 0; i < 256; i++) {
                state.inUse[i] = 0;
            }

            for (let group = 0; group < 16; group++) {
                if (state.groupsInUse[group]) {
                    for (let j = 0; j < 16; j++) {
                        symbolByte = this.readBit(state);
                        if (symbolByte === 1) {
                            state.inUse[group * 16 + j] = 1;
                        }
                    }
                }
            }

            this.makeSymbols(state);
            alphabetSize = state.symbolCount + 2;
            groups = this.readBits(3, state);
            selectorCount = this.readBits(15, state);

            for (let i = 0; i < selectorCount; i++) {
                unary = 0;

                while (true) {
                    symbolByte = this.readBit(state);
                    if (symbolByte === 0) {
                        state.selectorMtf[index(state.selectorMtf, i)] = (unary << 24) >> 24;
                        break;
                    }

                    unary++;
                }
            }

            const position = new Int8Array(6);
            let pos = 0;

            while (pos < groups) {
                position[index(position, pos)] = pos++;
            }

            for (let i = 0; i < selectorCount; i++) {
                pos = state.selectorMtf[index(state.selectorMtf, i)];

                let value;
                for (value = position[index(position, pos)]; pos > 0; pos--) {
                    position[index(position, pos)] = position[index(position, pos - 1)];
                }

                position[0] = value;
                state.selectors[i] = value;
            }

            for (let group = 0; group < groups; group++) {
                length = this.readBits(5, state);

                for (let i = 0; i < alphabetSize; i++) {
                    while (true) {
                        symbolByte = this.readBit(state);
                        if (symbolByte === 0) {
                            state.codeLengths[group][i] = (length << 24) >> 24;
                            break;
                        }

                        symbolByte = this.readBit(state);
                        if (symbolByte === 0) {
                            length++;
                        } else {
                            length--;
                        }
                    }
                }
            }

            for (let group = 0; group < groups; group++) {
                let shortest = 32;
                let longest = 0;

                for (let i = 0; i < alphabetSize; i++) {
                    if (state.codeLengths[group][i] > longest) {
                        longest = state.codeLengths[group][i];
                    }

                    if (state.codeLengths[group][i] < shortest) {
                        shortest = state.codeLengths[group][i];
                    }
                }

                this.buildTables(state.limits[group], state.bases[group], state.permutations[group], state.codeLengths[group], shortest, longest, alphabetSize);
                state.minLengths[group] = shortest;
            }

            endSymbol = state.symbolCount + 1;
            selectorNo = -1;
            remaining = 0;

            for (let i = 0; i <= 255; i++) {
                frequencies[i] = 0;
            }

            let write = 4095;

            for (let row = 15; row >= 0; row--) {
                for (let col = 15; col >= 0; col--) {
                    mtf[write] = row * 16 + col;
                    write--;
                }

                heads[row] = write + 1;
            }

            decoded = 0;
            selectorNo++;
            remaining = 50;
            selector = state.selectors[index(state.selectors, selectorNo)];
            minBits = state.minLengths[index(state.minLengths, selector)];
            limit = state.limits[selector];
            perm = state.permutations[selector];
            base = state.bases[selector];

            remaining--;
            bits = minBits;
            code = this.readBits(minBits, state);

            while (code > limit[index(limit, bits)]) {
                bits++;
                bit = this.readBit(state);
                code = (code << 1) | bit;
            }

            symbol = perm[index(perm, (code - base[index(base, bits)]) | 0)];

            while (symbol !== endSymbol) {
                if (symbol !== 0 && symbol !== 1) {
                    let symbolIndex = symbol - 1;
                    if (symbolIndex < 16) {
                        const front = heads[0];

                        for (symbolByte = mtf[index(mtf, front + symbolIndex)]; symbolIndex > 3; symbolIndex -= 4) {
                            const p = front + symbolIndex;
                            mtf[index(mtf, p)] = mtf[index(mtf, p - 1)];
                            mtf[index(mtf, p - 1)] = mtf[p - 2];
                            mtf[p - 2] = mtf[p - 3];
                            mtf[p - 3] = mtf[p - 4];
                        }

                        while (symbolIndex > 0) {
                            mtf[index(mtf, front + symbolIndex)] = mtf[front + symbolIndex - 1];
                            symbolIndex--;
                        }

                        mtf[front] = symbolByte;
                    } else {
                        let groupNo = (symbolIndex / 16) | 0;
                        const within = symbolIndex % 16;
                        let p = heads[index(heads, groupNo)] + within;

                        for (symbolByte = mtf[index(mtf, p)]; p > heads[index(heads, groupNo)]; p--) {
                            mtf[index(mtf, p)] = mtf[index(mtf, p - 1)];
                        }

                        heads[index(heads, groupNo)]++;

                        while (groupNo > 0) {
                            heads[index(heads, groupNo)]--;
                            mtf[heads[index(heads, groupNo)]] = mtf[heads[index(heads, groupNo - 1)] + 16 - 1];
                            groupNo--;
                        }

                        heads[0]--;
                        mtf[index(mtf, heads[0])] = symbolByte;
                        if (heads[0] === 0) {
                            let write = 4095;

                            for (let row = 15; row >= 0; row--) {
                                for (let col = 15; col >= 0; col--) {
                                    mtf[write] = mtf[heads[row] + col];
                                    write--;
                                }

                                heads[row] = write + 1;
                            }
                        }
                    }

                    frequencies[symbols[symbolByte & 255] & 255]++;
                    block[index(block, decoded)] = symbols[symbolByte & 255] & 255;
                    decoded++;
                    if (remaining === 0) {
                        selectorNo++;
                        remaining = 50;
                        selector = state.selectors[index(state.selectors, selectorNo)];
                        minBits = state.minLengths[index(state.minLengths, selector)];
                        limit = state.limits[selector];
                        perm = state.permutations[selector];
                        base = state.bases[selector];
                    }

                    remaining--;
                    bits = minBits;
                    code = this.readBits(minBits, state);

                    while (code > limit[index(limit, bits)]) {
                        bits++;
                        bit = this.readBit(state);
                        code = (code << 1) | bit;
                    }

                    symbol = perm[index(perm, (code - base[index(base, bits)]) | 0)];
                } else {
                    run = -1;
                    weight = 1;

                    do {
                        if (symbol === 0) {
                            run = (run + weight) | 0;
                        } else if (symbol === 1) {
                            run = (run + 2 * weight) | 0;
                        }

                        weight <<= 1;
                        if (remaining === 0) {
                            selectorNo++;
                            remaining = 50;
                            selector = state.selectors[index(state.selectors, selectorNo)];
                            minBits = state.minLengths[index(state.minLengths, selector)];
                            limit = state.limits[selector];
                            perm = state.permutations[selector];
                            base = state.bases[selector];
                        }

                        remaining--;
                        bits = minBits;
                        code = this.readBits(minBits, state);

                        while (code > limit[index(limit, bits)]) {
                            bits++;
                            bit = this.readBit(state);
                            code = (code << 1) | bit;
                        }

                        symbol = perm[index(perm, (code - base[index(base, bits)]) | 0)];
                    } while (symbol === 0 || symbol === 1);

                    run = (run + 1) | 0;
                    symbolByte = symbols[mtf[index(mtf, heads[0])] & 255];

                    frequencies[symbolByte & 255] += run;
                    // Every decoded index in this run is valid. The checked loop below retains
                    // any stores completed before the first out-of-range index in a damaged block.
                    if (run > 0 && decoded + run <= block.length) {
                        block.fill(symbolByte & 255, decoded, decoded + run);
                        decoded += run;
                        run = 0;
                    } else {
                        for (; run > 0; run--) {
                            block[index(block, decoded)] = symbolByte & 255;
                            decoded++;
                        }
                    }
                }
            }

            state.repeatCount = 0;
            state.lastByte = 0;
            cumulative[0] = 0;

            for (let i = 1; i <= 256; i++) {
                cumulative[i] = frequencies[i - 1];
            }

            for (let i = 1; i <= 256; i++) {
                cumulative[i] = cumulative[i] + cumulative[i - 1];
            }

            for (let i = 0; i < decoded; i++) {
                symbolByte = (block[i] << 24) >> 24;
                const target = index(block, cumulative[symbolByte & 255]);
                block[target] = block[target] | (i << 8);
                cumulative[symbolByte & 255]++;
            }

            state.blockPos = block[index(block, state.originalPointer)] >> 8;
            state.blockUsed = 0;
            state.blockPos = block[index(block, state.blockPos)];
            state.currentByte = (state.blockPos << 24) >> 24;
            state.blockPos >>= 8;
            state.blockUsed++;
            state.blockLength = decoded;
            this.writeOutput(state);
            if (state.blockUsed === state.blockLength + 1 && state.repeatCount === 0) {
                another = true;
            } else {
                another = false;
            }
        }
    }

    // rd.d(Lme;)V
    private static makeSymbols(state: BZip2State): void {
        state.symbolCount = 0;

        for (let i = 0; i < 256; i++) {
            if (state.inUse[i]) {
                state.symbols[state.symbolCount] = (i << 24) >> 24;
                state.symbolCount++;
            }
        }
    }

    // rd.a([I[I[I[BIII)V
    private static buildTables(limits: Int32Array, base: Int32Array, permutation: Int32Array, lengths: Int8Array, min: number, max: number, count: number): void {
        let slot = 0;

        for (let len = min; len <= max; len++) {
            for (let i = 0; i < count; i++) {
                if (lengths[index(lengths, i)] === len) {
                    permutation[index(permutation, slot)] = i;
                    slot++;
                }
            }
        }

        for (let i = 0; i < 23; i++) {
            base[index(base, i)] = 0;
        }

        for (let i = 0; i < count; i++) {
            base[index(base, lengths[index(lengths, i)] + 1)]++;
        }

        for (let i = 1; i < 23; i++) {
            base[index(base, i)] += base[index(base, i - 1)];
        }

        for (let i = 0; i < 23; i++) {
            limits[index(limits, i)] = 0;
        }

        let code = 0;

        for (let i = min; i <= max; i++) {
            code += base[index(base, i + 1)] - base[index(base, i)];
            limits[index(limits, i)] = code - 1;
            code <<= 1;
        }

        for (let i = min + 1; i <= max; i++) {
            base[index(base, i)] = ((limits[index(limits, i - 1)] + 1) << 1) - base[index(base, i)];
        }
    }

    // rd.e(Lme;)B
    private static readBit(state: BZip2State): number {
        return this.readBits(1, state);
    }
}
