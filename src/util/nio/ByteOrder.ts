import { arrayAtU8 } from '#/util/JavaArray';

// java.nio.ByteOrder
export default class ByteOrder {
    // java.nio.ByteOrder.name:Ljava/lang/String;
    private readonly name: string;

    // java.nio.ByteOrder.<init>(Ljava/lang/String;)V
    private constructor(name: string) {
        this.name = name;
    }

    // java.nio.ByteOrder.BIG_ENDIAN:Ljava/nio/ByteOrder;
    static readonly BIG_ENDIAN: ByteOrder = new ByteOrder('BIG_ENDIAN');

    // java.nio.ByteOrder.LITTLE_ENDIAN:Ljava/nio/ByteOrder;
    static readonly LITTLE_ENDIAN: ByteOrder = new ByteOrder('LITTLE_ENDIAN');

    // java.nio.ByteOrder.NATIVE_ORDER:Ljava/nio/ByteOrder;
    // Java asks Unsafe.isBigEndian(); here the host order of typed arrays, LITTLE_ENDIAN in every browser.
    private static readonly NATIVE_ORDER: ByteOrder = arrayAtU8(new Uint8Array(new Uint16Array([1]).buffer), 0) === 1 ? ByteOrder.LITTLE_ENDIAN : ByteOrder.BIG_ENDIAN;

    // java.nio.ByteOrder.nativeOrder()Ljava/nio/ByteOrder;
    static nativeOrder(): ByteOrder {
        return ByteOrder.NATIVE_ORDER;
    }

    // java.nio.ByteOrder.toString()Ljava/lang/String;
    toString(): string {
        return this.name;
    }
}
