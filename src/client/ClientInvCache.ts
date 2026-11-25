import { isJavaRuntimeException } from '#/util/JavaException';
import { releaseReferences } from '#/util/StaticReferences';
import WrappedException from '#/util/WrappedException';
import InvType from '#/config/InvType';
import ObjType from '#/config/ObjType';
import HashTable from '#/datastruct/HashTable';
import IntNode from '#/datastruct/IntNode';
import Linkable from '#/datastruct/Linkable';
import { arrayAtI32, arrayPutI32 } from '#/util/JavaArray';
import GameShellClass from './GameShell';
import { glJar } from './ClientVariant';
import { loadClient, loadPlayerModel } from '#/util/GamepackClasses';

// he extends jf
export default class ClientInvCache extends Linkable {
    // HD qe.c(I)V
    static releaseClientInvCacheStatics(guard: number): void {
        try {
            if (guard > -73) {
                ClientInvCache.releaseClientInvCacheStatics(-59);
            }
            const GameShell = GameShellClass;
            releaseReferences(GameShell, 'timer');
            const PlayerModel = loadPlayerModel();
            releaseReferences(PlayerModel, 'recolourSources');
            const Client = loadClient();
            releaseReferences(Client, 'soundEffectIds');
        } catch (error) {
            if (!isJavaRuntimeException(error)) throw error;
            throw WrappedException.wrap(error, 'qe.B(' + guard + ')');
        }
    }

    // he.t:[I
    counts = new Int32Array(1);
    // he.x:[I
    ids = Int32Array.of(-1);

    // he.<init>()V
    constructor() {
        super();
    }

    // mf.d:Lnc;
    static m_invList = new HashTable<ClientInvCache>(32);

    // ck.c(I)V
    static DeleteAll(): void {
        ClientInvCache.m_invList = new HashTable<ClientInvCache>(32);
    }

    // rc.a(IIIII)V
    static Set(obj: number, inventory: number, count: number, slot: number): void {
        const key = BigInt(inventory);
        let container = ClientInvCache.m_invList.get(key);
        if (container === null) {
            container = new ClientInvCache();
            ClientInvCache.m_invList.put(container, key);
        }
        if (slot >= container.ids.length) {
            const ids = new Int32Array((slot + 1) | 0);
            const counts = new Int32Array((slot + 1) | 0);
            for (let i = 0; i < container.ids.length; i++) {
                ids[i] = container.ids[i];
                counts[i] = arrayAtI32(container.counts, i);
            }
            for (let i = container.ids.length; i < slot; i++) {
                ids[i] = -1;
                counts[i] = 0;
            }
            container.counts = counts;
            container.ids = ids;
        }
        arrayPutI32(container.ids, slot, obj);
        arrayPutI32(container.counts, slot, count);
    }

    // id.c(III)I
    static GetType(inventory: number, slot: number): number {
        const container = ClientInvCache.m_invList.get(BigInt(inventory));
        return container !== null && slot >= 0 && slot < container.ids.length ? container.ids[slot] : -1;
    }

    // wk.a(IIB)I
    static GetCount(inventory: number, slot: number): number {
        const container = ClientInvCache.m_invList.get(BigInt(inventory));
        return container !== null && slot >= 0 && slot < container.counts.length ? container.counts[slot] : 0;
    }

    // SD ok.a(III)I / HD wj.a(BII)I
    static InvTotal(start: number, inventory: number, obj: number): number {
        const container = ClientInvCache.m_invList.get(BigInt(inventory));
        if (container === null || obj === -1) return 0;
        let total = 0;
        for (let i = glJar ? 0 : start; i < container.counts.length; i++) {
            if (arrayAtI32(container.ids, i) === obj) total = (total + arrayAtI32(container.counts, i)) | 0;
        }
        return total;
    }

    // jd.a(ZI)V
    static Blank(inventory: number): void {
        const container = ClientInvCache.m_invList.get(BigInt(inventory));
        if (container === null) return;
        for (let i = 0; i < container.ids.length; i++) {
            container.ids[i] = -1;
            arrayPutI32(container.counts, i, 0);
        }
    }

    // me.a(BI)V
    static Delete(inventory: number): void {
        ClientInvCache.m_invList.get(BigInt(inventory))?.Unlink();
    }

    // wd.a(II)I
    static GetFreeSpace(inventory: number): number {
        if (inventory < 0) return 0;
        const container = ClientInvCache.m_invList.get(BigInt(inventory));
        if (container === null) return InvType.List(inventory).m_size;
        let free = 0;
        for (const id of container.ids) if (id === -1) free++;
        return (free + InvType.List(inventory).m_size - container.ids.length) | 0;
    }

    // bi.a(IBIZ)I
    static GetParamCount(param: number, inventory: number, stackWeighted: boolean): number {
        const container = ClientInvCache.m_invList.get(BigInt(inventory));
        if (container === null) return 0;
        let total = 0;
        for (let i = 0; i < container.ids.length; i++) {
            const id = container.ids[i];
            if (id < 0 || id >= ObjType.m_numDefinitions) continue;
            const node = ObjType.List(id).params?.get(BigInt(param));
            if (node == null) continue;
            if (!(node instanceof IntNode)) throw new TypeError('Expected integer object parameter');
            total = (total + (stackWeighted ? Math.imul(arrayAtI32(container.counts, i), node.value) : node.value)) | 0;
        }
        return total;
    }
}
