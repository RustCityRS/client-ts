import { IllegalStateException, isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import Linkable from '#/datastruct/Linkable';
import LruHashTable from '#/datastruct/LruHashTable';
import SecondaryByteArrayNode from '#/datastruct/SecondaryByteArrayNode';
import type PacketT from '#/io/PacketT';
import { floorMod, intDivide, isPowerOfTwo } from '#/util/IntUtils';
import { arrayAtObj, arrayAtU8, arrayPutI32, arrayPutU8, requireNonNull } from '#/util/JavaArray';
import JavaRandom from '#/util/JavaRandom';
import { glJar } from '#/client/ClientVariant';
import ColourImageCache, { type ColourImageRow } from './ColourImageCache';
import MonochromeImageCache from './MonochromeImageCache';
import type TextureProvider from './TextureProvider';
import { loadClient, loadClientBuild, loadMinimenu, loadReflectionCheck } from '#/util/GamepackClasses';

export default abstract class TextureOp extends Linkable {
    // HD j.d(I)V
    static releaseTextureOpStatics(guard: number): void {
        try {
            if (guard !== 2) {
                const ReflectionCheck = loadReflectionCheck();
                ReflectionCheck.resetQueue(18);
            }
            const ClientBuild = loadClientBuild();
            releaseReferences(ClientBuild, 'DECORXOF2');
            const Client = loadClient();
            releaseReferences(Client, 'replaceCanvasCommand', 'shiftClickCommand', 'fontPlain11');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'j.PA(' + guard + ')');
        }
    }

    static width = 0; // hf.I:I
    static height = 0; // g.k:I
    static widthMask = 0; // kl.Eb:I
    static heightMask = 0; // vi.hb:I
    static sizeScale = 0; // j.b:I
    static normalisedX: Int32Array | null = null; // vg.U:[I
    static normalisedY: Int32Array | null = null; // cf.h:[I
    static sinTable: Int32Array | null = null; // h.e:[I
    static cosine: Int32Array | null = null; // c.t:[I
    static permutationCache: LruHashTable | null = new LruHashTable(16); // vb.e:Lvj;
    static textureProvider: TextureProvider | null = null; // gj.P:Lpc;

    children: (TextureOp | null)[] | null; // bf.z:[Lbf;
    colourImageCache: ColourImageCache | null = null; // bf.C:Lpi;
    monochromeImageCache: MonochromeImageCache | null = null; // bf.I:Lwk;
    cacheCapacity = 0; // bf.K:I
    monochrome: boolean; // bf.L:Z

    // bf.<init>(IZ)V
    constructor(inputs: number, monochrome: boolean) {
        super();
        this.children = new Array<TextureOp | null>(inputs).fill(null);
        this.monochrome = monochrome;
    }

    // bf.a(IZI)[[I
    getChildColourOutput(row: number, child: number): ColourImageRow | null {
        if (requireNonNull(arrayAtObj(this.children, child)).monochrome) {
            const mono = requireNonNull(arrayAtObj(this.children, child)).getMonochromeOutput(row, glJar ? -105 : 55);
            return [mono, mono, mono];
        }
        return requireNonNull(arrayAtObj(this.children, child)).getColourOutput(row);
    }

    // bf.a(I)I
    getTextureId(): number {
        return -1;
    }

    // SD bf.a(IB)[I, HD j.a(IB)[I
    getMonochromeOutput(row: number, guard = glJar ? -118 : 55): Int32Array | null {
        try {
            if (glJar) {
                intDivide(-71, intDivide(30 - guard, 36));
            } else if (guard !== 55) {
                return null;
            }
            throw new IllegalStateException('This operation does not have a monochrome output');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, (glJar ? 'j.D(' : 'bf.G(') + row + ',' + guard + ')');
        }
    }

    // bf.a(BII)V
    initCache(width: number, height: number): void {
        const capacity = this.cacheCapacity === 255 ? height : this.cacheCapacity;
        if (!this.monochrome) {
            this.colourImageCache = new ColourImageCache(capacity, height, width);
        } else {
            this.monochromeImageCache = new MonochromeImageCache(capacity, height, width);
        }
    }

    // bf.a(IIZ)[I
    getChildMonochromeOutput(child: number, row: number, guard = false): Int32Array | null {
        if (!requireNonNull(arrayAtObj(this.children, child)).monochrome) {
            return arrayAtObj(requireNonNull(arrayAtObj(this.children, child)).getColourOutput(row, glJar ? -1 : !guard), 0);
        }
        return requireNonNull(arrayAtObj(this.children, child)).getMonochromeOutput(row);
    }

    // bf.c(B)I
    getSpriteId(): number {
        return -1;
    }

    // bf.d(B)V
    clearImageCache(): void {
        if (!this.monochrome) {
            requireNonNull(this.colourImageCache).clear();
            this.colourImageCache = null;
        } else {
            requireNonNull(this.monochromeImageCache).clear(0);
            this.monochromeImageCache = null;
        }
    }

    // bf.b(I)V
    postDecode(): void {}

    // bf.a(Lgd;ZI)V
    decode(_packet: PacketT | null, _code: number): void {}

    // SD bf.a(ZI)[[I, HD j.b(II)[[I
    getColourOutput(row: number, guard: number | boolean = glJar ? -1 : true): ColourImageRow | null {
        try {
            if (glJar) {
                if (guard !== -1) return null;
            } else if (!guard) {
                releaseReferences(loadMinimenu(), 'hiddenUse');
            }
            throw new IllegalStateException('This operation does not have a colour output');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, (glJar ? 'j.T(' : 'bf.B(') + guard + ',' + row + ')');
        }
    }

    // SD vk.a(III)V, HD an.c(III)V.
    static setSize(width: number, height: number): void {
        if (TextureOp.width !== width) {
            TextureOp.normalisedX = new Int32Array(width);
            for (let x = 0; x < width; x++) {
                arrayPutI32(TextureOp.normalisedX, x, intDivide(x << 12, width));
            }
            TextureOp.sizeScale = width === 64 ? 2048 : 4096;
            if (glJar) {
                TextureOp.widthMask = (width - 1) | 0;
                TextureOp.width = width;
            } else {
                TextureOp.width = width;
                TextureOp.widthMask = (width - 1) | 0;
            }
        }
        if (TextureOp.height !== height) {
            if (TextureOp.width !== height) {
                TextureOp.normalisedY = new Int32Array(height);
                for (let y = 0; y < height; y++) {
                    arrayPutI32(TextureOp.normalisedY, y, intDivide(y << 12, height));
                }
            } else {
                TextureOp.normalisedY = TextureOp.normalisedX;
            }
            if (glJar) {
                TextureOp.height = height;
                TextureOp.heightMask = (height - 1) | 0;
            } else {
                TextureOp.heightMask = (height - 1) | 0;
                TextureOp.height = height;
            }
        }
    }

    // gf.e(I)V
    static initTrigTables(): void {
        if (TextureOp.sinTable === null || TextureOp.cosine === null) {
            TextureOp.sinTable = new Int32Array(256);
            TextureOp.cosine = new Int32Array(256);
            for (let i = 0; i < 256; i++) {
                const angle = Math.PI * 2 * (i / 255.0);
                arrayPutI32(TextureOp.sinTable, i, (Math.sin(angle) * 4096.0) | 0);
                arrayPutI32(TextureOp.cosine, i, (4096.0 * Math.cos(angle)) | 0);
            }
        }
    }

    // vk.a(ILjava/util/Random;I)I
    static nextInt(random: JavaRandom | null, bound: number): number {
        if (bound <= 0) throw new RangeError('IllegalArgumentException');
        if (isPowerOfTwo(bound)) {
            const bits = requireNonNull(random).nextInt() >>> 0;
            return Number((BigInt(bound) * BigInt(bits)) >> 32n) | 0;
        }
        const limit = (-2147483648 - (4294967296 % bound)) | 0;
        let value: number;
        do {
            value = requireNonNull(random).nextInt();
        } while (limit <= value);
        return floorMod(value, bound);
    }

    // wf.a(IB)[B
    static getPermutation(seed: number): Uint8Array | null {
        const hit = requireNonNull(TextureOp.permutationCache).Find(BigInt(seed));
        if (hit !== null && !(hit instanceof SecondaryByteArrayNode)) throw new TypeError('ClassCastException: not a SecondaryByteArrayNode');
        let node: SecondaryByteArrayNode | null = hit;
        if (node === null) {
            const permutation = new Uint8Array(512);
            const random = new JavaRandom(BigInt(seed));
            for (let i = 0; i < 255; i++) permutation[i] = i;
            for (let i = 0; i < 255; i++) {
                const end = 255 - i;
                const other = TextureOp.nextInt(random, end);
                const value = arrayAtU8(permutation, other);
                arrayPutU8(permutation, other, arrayAtU8(permutation, end));
                arrayPutU8(permutation, 511 - i, value);
                arrayPutU8(permutation, end, value);
            }
            node = new SecondaryByteArrayNode(permutation);
            requireNonNull(TextureOp.permutationCache).Put(BigInt(seed), node);
        }
        return node.bytes;
    }
}
