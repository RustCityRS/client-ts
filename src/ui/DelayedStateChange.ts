import HashTable from '#/datastruct/HashTable';
import { glJar } from '#/client/ClientVariant';
import type JagString from '#/datastruct/JagString';
import SecondaryLinkedList from '#/datastruct/SecondaryLinkedList';
import SecondaryNode from '#/datastruct/SecondaryNode';
import SafeTime from '#/io/SafeTime';
import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import { loadEnvironment, loadScriptRunner } from '#/util/GamepackClasses';

const serverFlag = -(1n << 63n);

export default class DelayedStateChange extends SecondaryNode {
    // HD da.f(I)V
    static releaseHdStatics(guard: number): void {
        try {
            if (guard !== 3) return;
            const ScriptRunner = loadScriptRunner();
            releaseReferences(ScriptRunner, 'viaScript');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'da.O(' + guard + ')');
        }
    }

    // ce.H:I
    value = 0;
    // ce.L:I
    value3 = 0;
    // ce.O:Lid;
    text: JagString | null = null;
    // ce.S:I
    value2 = 0;
    // jd.d:Lnc;
    static readonly changes = new HashTable<DelayedStateChange>(16);
    // bb.k:Ltb;
    static readonly delayed = new SecondaryLinkedList<DelayedStateChange>();
    // n.d:Ltb;
    static readonly immediate = new SecondaryLinkedList<DelayedStateChange>();
    // od.U:[I
    static readonly varcs = new Int32Array(2000);
    // me.a:[Lid;
    static readonly varcStrings: (JagString | null)[] = new Array(1000).fill(null);
    // ce.<init>(II)V
    constructor(type: number, id: number) {
        super();
        this.key = BigInt.asIntN(64, (BigInt(type) << 32n) | BigInt(id));
    }

    // ce.d(I)I
    type(): number {
        return Number((this.key >> 32n) & 255n);
    }
    // ce.c(B)I
    id(): number {
        return Number(BigInt.asIntN(32, this.key));
    }
    // ce.d(B)J
    time(): bigint {
        return this.secondaryKey & ~serverFlag;
    }

    // ce.e(I)V
    private pushClient(hd = glJar): void {
        try {
            this.secondaryKey = BigInt.asIntN(64, (SafeTime.CurrentTimeMillis() + 500n) | (this.secondaryKey & serverFlag));
            DelayedStateChange.delayed.addTail(this);
        } catch (error) {
            if (!hd || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'da.U(true)');
        }
    }

    // ce.b(Z)V
    private pushServer(hd = glJar): void {
        try {
            this.secondaryKey |= serverFlag;
            if (this.time() === 0n) DelayedStateChange.immediate.addTail(this);
        } catch (error) {
            if (!hd || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'da.T(33)');
        }
    }

    // pi.a(IZI)Lce;
    static get(id: number, type: number, hd = glJar): DelayedStateChange {
        try {
            const key = BigInt.asIntN(64, BigInt(id) | (BigInt(type) << 32n));
            let change = DelayedStateChange.changes.get(key);
            if (change === null) {
                change = new DelayedStateChange(type, id);
                DelayedStateChange.changes.put(change, change.key);
            } else if (hd && !(change instanceof DelayedStateChange)) {
                throw new TypeError('ClassCastException: not a DelayedStateChange');
            }
            return change;
        } catch (error) {
            if (!hd || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'te.F(4,' + type + ',' + id + ')');
        }
    }

    // we.a(I)Lce;
    static poll(): DelayedStateChange | null {
        const first = DelayedStateChange.immediate.head();
        if (first !== null) {
            first.Unlink();
            first.unlinkSecondary();
            return first;
        }
        for (;;) {
            const change = DelayedStateChange.delayed.head();
            if (change === null || change.time() > SafeTime.CurrentTimeMillis()) return null;
            change.Unlink();
            change.unlinkSecondary();
            if ((change.secondaryKey & serverFlag) !== 0n) return change;
        }
    }

    // wf.b(Z)V
    static clear(): void {
        DelayedStateChange.changes.clear();
        DelayedStateChange.delayed.clear();
        DelayedStateChange.immediate.clear();
    }

    // ae.a(II)V
    static clientHidden(id: number): void {
        DelayedStateChange.get(id, 7).pushClient();
    }

    // SD cf.a(IZ)V, HD n.a(II)V.
    static clientText(id: number, guard = glJar ? 91 : undefined): void {
        try {
            DelayedStateChange.get(id, 3, guard !== undefined).pushClient(guard !== undefined);
            if (guard !== undefined && guard < 87) {
                releaseReferences(loadScriptRunner(), 'dateSeparator');
            }
        } catch (error) {
            if (guard === undefined || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'n.L(' + id + ',' + guard + ')');
        }
    }

    // fl.a(II)V
    static clientChange(type: number, id: number): void {
        DelayedStateChange.get(id, type).pushClient();
    }

    // ha.a(BI)V
    static clientColour(id: number): void {
        DelayedStateChange.get(id, 6).pushClient();
    }

    // lf.a(II)V
    static clientVarcString(id: number): void {
        DelayedStateChange.get(id, 2).pushClient();
    }

    // n.a(IB)V
    static clientAnimation(id: number): void {
        DelayedStateChange.get(id, 5).pushClient();
    }

    // nk.d(II)V
    static clientVarc(id: number): void {
        DelayedStateChange.get(id, 1).pushClient();
    }

    // pd.a(II)V
    static clientObj(id: number): void {
        DelayedStateChange.get(id, 9).pushClient();
    }

    // qg.a(BI)V
    static clientPosition(id: number): void {
        DelayedStateChange.get(id, 11).pushClient();
    }

    // re.a(II)V
    static clientScroll(id: number): void {
        DelayedStateChange.get(id, 12).pushClient();
    }

    // rf.a(IZ)V
    static clientModel(id: number): void {
        DelayedStateChange.get(id, 4).pushClient();
    }

    // ti.d(II)V
    static clientOffsets(id: number): void {
        DelayedStateChange.get(id, 10).pushClient();
    }

    // ce.a(IIIIB)V
    static serverOffsets(angle: number, id: number, y: number, x: number): void {
        const change = DelayedStateChange.get(id, 10);
        change.pushServer();
        change.value = x;
        change.value2 = y;
        change.value3 = angle;
    }

    // ck.a(IIII)V
    static serverObj(obj: number, count: number, id: number): void {
        const change = DelayedStateChange.get(id, 9);
        change.pushServer();
        change.value = obj;
        change.value2 = count;
    }

    // dg.a(IIIII)V
    static serverModel(type: number, model: number, extra: number, id: number): void {
        const change = DelayedStateChange.get(id, 4);
        change.pushServer();
        change.value = type;
        change.value2 = model;
        change.value3 = extra;
    }

    // hf.a(BII)V
    static serverScroll(scroll: number, id: number): void {
        const change = DelayedStateChange.get(id, 12);
        change.pushServer();
        change.value = scroll;
    }

    // hi.a(IIII)V
    static serverPosition(x: number, id: number, y: number): void {
        const change = DelayedStateChange.get(id, 11);
        change.pushServer();
        change.value = x;
        change.value2 = y;
    }

    // id.b(III)V
    static serverColour(type: number, id: number, colour: number): void {
        const change = DelayedStateChange.get(id, type);
        change.pushServer();
        change.value = colour;
    }

    // jh.a(BII)V
    static serverAnimation(seq: number, id: number): void {
        const change = DelayedStateChange.get(id, 5);
        change.pushServer();
        change.value = seq;
    }

    // SD kh.a(IIIII)V, HD ve.a(BIIII)V.
    static serverAngles(id: number, x: number, y: number, zoom: number, guard = glJar ? -124 : undefined): void {
        try {
            const change = DelayedStateChange.get(id, 8, guard !== undefined);
            change.pushServer(guard !== undefined);
            change.value3 = zoom;
            if (guard !== undefined) {
                if (guard >= -120) loadEnvironment().sunColour = -14;
                change.value = x;
                change.value2 = y;
            } else {
                change.value2 = y;
                change.value = x;
            }
        } catch (error) {
            if (guard === undefined || !isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 've.U(' + guard + ',' + zoom + ',' + id + ',' + y + ',' + x + ')');
        }
    }

    // me.a(BILid;)V
    static serverText(id: number, text: JagString | null): void {
        const change = DelayedStateChange.get(id, 3);
        change.pushServer();
        change.text = text;
    }

    // nl.a(IIB)V
    static serverVarc(value: number, id: number): void {
        const change = DelayedStateChange.get(id, 1);
        change.pushServer();
        change.value = value;
    }

    // ob.b(III)V
    static serverHidden(hidden: number, id: number): void {
        const change = DelayedStateChange.get(id, 7);
        change.pushServer();
        change.value = hidden;
    }

    // oe.a(Lid;IZ)V
    static serverVarcString(text: JagString | null, id: number): void {
        const change = DelayedStateChange.get(id, 2);
        change.pushServer();
        change.text = text;
    }

    // sa.a(III)V
    static serverComponentInt(id: number, type: number, value: number): void {
        const change = DelayedStateChange.get(id, type);
        change.pushServer();
        change.value = value;
    }
}
