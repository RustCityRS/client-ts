import HashTable from '#/datastruct/HashTable';
import LongNode from '#/datastruct/LongNode';
import SafeTime from '#/io/SafeTime';
import { arrayAtI32, arrayPutI32 } from './JavaArray';
import VarBitType from '#/config/VarBitType';
import VarpType from '#/config/VarpType';

const applyServer = 0x4000000000000000n;
const immediate = applyServer | 1n;

export default class ClientVarCache {
    // vj.d:[I
    static readonly m_var = new Int32Array(2500);
    // oc.c:[I
    static readonly m_varServ = new Int32Array(2500);
    // db.p:Lnc;
    static changes = new HashTable<LongNode>(16);
    // ie.a(II)I
    static GetVarbit(id: number): number {
        const bit = VarBitType.List(id);
        const mask = arrayAtI32(VarBitType.m_maskLookUp, bit.endBit - bit.startBit);
        return mask & (arrayAtI32(ClientVarCache.m_var, bit.baseVar) >> bit.startBit);
    }

    // se.a(III)V
    static SetVarbit(id: number, value: number): void {
        const bit = VarBitType.List(id);
        let mask = arrayAtI32(VarBitType.m_maskLookUp, bit.endBit - bit.startBit);
        if (value < 0 || value > mask) value = 0;
        mask <<= bit.startBit;
        ClientVarCache.setClient(bit.baseVar, ((value << bit.startBit) & mask) | (arrayAtI32(ClientVarCache.m_var, bit.baseVar) & ~mask));
    }

    // oi.a(III)V
    static setBitServer(value: number, id: number): void {
        const bit = VarBitType.List(id);
        let mask = arrayAtI32(VarBitType.m_maskLookUp, bit.endBit - bit.startBit);
        if (value < 0 || value > mask) value = 0;
        mask <<= bit.startBit;
        ClientVarCache.setServer(bit.baseVar, (arrayAtI32(ClientVarCache.m_varServ, bit.baseVar) & ~mask) | ((value << bit.startBit) & mask));
    }

    // ae.a(III)V
    static setClient(id: number, value: number): void {
        arrayPutI32(ClientVarCache.m_var, id, value);
        const node = ClientVarCache.changes.get(BigInt(id));
        if (node !== null && !(node instanceof LongNode)) throw new TypeError('ClassCastException: not a LongNode');
        const timeout = BigInt.asIntN(64, SafeTime.CurrentTimeMillis() + 500n);
        if (node !== null) node.value = timeout;
        else ClientVarCache.changes.put(new LongNode(timeout), BigInt(id));
    }

    // be.a(III)V
    static setServer(id: number, value: number): void {
        arrayPutI32(ClientVarCache.m_varServ, id, value);
        const node = ClientVarCache.changes.get(BigInt(id));
        if (node !== null && !(node instanceof LongNode)) throw new TypeError('ClassCastException: not a LongNode');
        if (node === null) ClientVarCache.changes.put(new LongNode(immediate), BigInt(id));
        else if (node.value !== immediate) node.value = BigInt.asIntN(64, SafeTime.CurrentTimeMillis() + 500n) | applyServer;
    }

    // v.a(IZ)I
    static poll(first: boolean): number {
        const now = SafeTime.CurrentTimeMillis();
        let node = first ? ClientVarCache.changes.head() : ClientVarCache.changes.next();
        while (node !== null) {
            if (!(node instanceof LongNode)) throw new TypeError('ClassCastException: not a LongNode');
            if (now > (node.value & (applyServer - 1n))) {
                if ((applyServer & node.value) !== 0n) {
                    const id = Number(BigInt.asIntN(32, node.key));
                    arrayPutI32(ClientVarCache.m_var, id, arrayAtI32(ClientVarCache.m_varServ, id));
                    node.Unlink();
                    return id;
                }
                node.Unlink();
            }
            node = ClientVarCache.changes.next();
        }
        return -1;
    }

    // bj.a(B)V
    static reset(): void {
        for (let id = 0; id < VarpType.m_numDefinitions; id++) {
            if (VarpType.List(id, 16).clientCode === 0) {
                arrayPutI32(ClientVarCache.m_varServ, id, 0);
                arrayPutI32(ClientVarCache.m_var, id, 0);
            }
        }
        ClientVarCache.changes = new HashTable(16);
    }
}
